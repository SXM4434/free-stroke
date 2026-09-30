"use client"

import { useRef, useCallback, useMemo, useEffect, useLayoutEffect, useReducer, useState, useSyncExternalStore, memo } from "react"
import { Canvas, useThree, useFrame, useStore } from "@react-three/fiber"
// Environment/Lightformer now live inside the ported rigs (components/studio-rig.tsx).
import { OrbitControls } from "@react-three/drei"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"
import * as THREE from "three"
import type { Stroke, ProcessedStroke, Point } from "@/lib/stroke-processing"
import type { ExportSettings } from "@/components/drawing-canvas"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js"
/* EXPORT HAS TO SAY WHAT HAPPENED. Both the success and the failure paths were
 * silent — a `console.error` the user never sees, and an early `return` with no
 * message at all when the engine built no mesh. `<Toaster />` is mounted in
 * app/page.tsx; on a chromeless host that never mounts one these calls are
 * no-ops, which is the correct behaviour for a host that owns its own chrome. */
import { toast } from "sonner"
import { ViewportErrorBoundary } from "@/components/viewport-error-boundary"
import {
  type GeometryMode,
  type StrokeMeshData,
  type StrokeBuildStatus,
  type SolidBuildStatus,
  type ExtrudeParams,
  type SolidParams,
  type InflateParams,
  DEFAULT_INFLATE_PARAMS,
  INFLATE_DEBUG,
  getEngine,
  TUBE_RADIUS,
  RADIAL_SEGMENTS,
  SPHERE_SEGMENTS,
  JOINT_SPHERE_SEGMENTS,
  SOLID_DEBUG,
  SOLID_ANIM_DEBUG,
  SOLID_STAGE_DEBUG,
  ROD_TUNING,
  extrudeWidthToSlider,
  computeExtrudePoolCentreXY,
  /* The nib's DIAMETER in stroke units, from the one function the Inflate
   * builder itself sizes the mark with (`inflateStrokeRadiusXY =
   * effectiveThicknessPx * coordScale / 2`). Read rather than restated: a
   * second copy of this arithmetic is how the tip field would silently end up
   * rasterised at a different width than the surface it carves. */
  computeSolidEffectiveThicknessPx,
  DEFAULT_SOLID_PARAMS,
  setRefillDropsStaleAttrs,
  readRefillDropsStaleAttrs,
} from "@/lib/geometry-engines"
import { getEngineFor, DEFAULT_ENGINE_FAMILY, type EngineFamily } from "@/lib/engine-registry"
/* THE PROGRESS MODEL, WHICH IS NOT THIS FILE'S ANY MORE.
 *
 * `penTimeDistanceFraction`, `measureTimingCharacter` and the blend arithmetic
 * used to live here, and the blend was written out by hand at THREE call sites
 * in this one file — the implicit drawRange path, the partial-rebuild path and
 * Rod's per-stroke path. Three copies of one law is how the Natural/Authentic
 * toggle went silently inert in three of four modes once already. They now come
 * from lib/pen-reveal.ts, which is also what the 2D flat-ink register calls, so
 * the two registers cannot tell the user different things about the same
 * drawing. Moved verbatim, comments intact. */
import {
  penTimeDistanceFraction,
  measureTimingCharacter,
  revealDistanceFraction,
  liftsLandBetweenStrokes,
  blendReveal,
  /* THE ARC-LENGTH CLIP, which is the reveal's THIRD mechanism (Solid, Extrude
   * and the Inflate loft). It lives beside the progress model now, not here,
   * because the defect it carries is about GEOMETRY rather than about pixels
   * and its gate runs in plain node — see the note at its old site below. */
  filterStrokesByProgress,
  TIMING_CHARACTER_THRESHOLD,
  /* §T — THE MOVING END OF THE LINE. The reveal's front is a property of the
   * RECORDING (which texel did the pen ink, and when), so it is baked in
   * pen-reveal.ts beside the progress model rather than in the renderer, and a
   * node probe can run the same bake the GPU is fed. */
  buildTipField,
  PEN_TIP_SHAPES,
  /* The live tip, shared with the panel. See the note at the old store site
   * below for why it is not owned here any more. */
  setPenTipMode,
  readPenTipMode,
  /* The shape behind the name, and the dev-only override the named shapes were
   * CHOSEN with. See `readPenTipShape` — one reader, so the fragment test and
   * the drawRange cull in front of it cannot disagree. */
  readPenTipShape,
  setPenTipShapeOverride,
  readPenTipShapeOverride,
  TIP_FIELD_UNITS_PER_TEXEL,
  type RevealMode,
  type TimingCharacter,
  type TipField,
  type PenTipMode,
  type PenTipShape,
} from "@/lib/pen-reveal"
/* §26 · THE SCHEDULE — WHICH part of the mark is drawn when.
 *
 * `pen-reveal.ts` answers HOW MUCH of the word the pen has drawn at time t;
 * this answers WHICH, and it is the half the app never had
 * (`docs/animation-toolset-map.md`, gated 2026-08-04). Every number below is
 * derived there and none of the arithmetic is restated in this file — the trap
 * this feature walks straight past is that the reveal has TWO consumers, the
 * per-triangle keys and the tip field's `arc` channel, and one idea with two
 * implementations is this repo's most expensive recurring defect. */
import {
  buildTimedSchedule,
  easeReveal,
  isTimedTake,
  paceFromCurve,
  STROKE_TIMING_TAKE_DEFAULTS,
  sampleTake,
  strokeOfArc,
  takeSpansIn,
  timedRevealKeys,
  timedTipMap,
  timedFront,
  type StrokeTimingTake,
  type TimedSchedule,
  performedPenMs,
  performedHolds,
} from "@/lib/stroke-timing"
import {
  scheduleFromStrokes,
  remapRevealKeys,
  remapTipFieldArc,
  sortTrianglesByKey,
  permuteTriangles,
  isAscending,
  strokeProgressAt,
  strokeSpansIn,
  scheduleArcCoeffs,
  filterStrokesBySchedule,
  filterStrokesBySpans,
  type ClippedPiece,
  describeDrawIn,
  DRAW_IN_DEFAULTS,
  ORDER_LABELS,
  ORDER_NOTES,
  /* §26 STEP 3 · THE WINDOW — `start` and `end` instead of one `progress`. See
   * `lib/stroke-schedule.ts` §1b. The interval lives in SCHEDULED space, so it
   * composes with everything above it and needs no second scheduling model. */
  windowAt,
  windowParts,
  effectiveWindow,
  restPlayheadFor,
  windowSig,
  REVEAL_WINDOW_DEFAULTS,
  WINDOW_LABELS,
  WINDOW_NOTES,
  WINDOW_MIN_LENGTH,
  REVERSE_LABELS,
  REVERSE_NOTES,
  type DrawInParams,
  type StrokeOrder,
  type StrokeSchedule,
  type ReverseMode,
  type RevealWindow,
  type RevealWindowMode,
  type RevealWindowParams,
  /* §26 STEP 3b · THE PLAYBACK ENVELOPE. `RevealEase` was declared in THIS file
   * until 2026-08-28, which is why the page could not persist it: the document
   * cannot hold a type only a component knows about. */
  REVEAL_ENVELOPE_DEFAULTS,
  CADENCE_HZ,
  quantiseToCadence,
  type RevealCadence,
  type RevealEase,
  type RevealEnvelopeParams,
} from "@/lib/stroke-schedule"
/* THE UNIT OF ANIMATION IS A GROUP BY DEFAULT — Sebs's pick 2, verbatim:
 * *"both — group by default, stroke on request."* The grouping law is the ink's
 * own (connected components under "each one's centreline lies inside the
 * other's ink"), already built, already calibrated against the font's authored
 * map, and deliberately not a lookup table. */
import { assignLetters } from "@/lib/hero-letters"
import { createPortal } from "react-dom"
import { LiveTakeTimeline, TransportRow, TimingNote, DrawInBody, type TransportRowProps } from "@/components/workspace/timeline-panel"
import { ExportPanel, type ExportPanelProps } from "@/components/workspace/export-panel"
import { useDockHost, useHasDock } from "@/components/workspace/dock-hosts"
import { DrawInTimingControls, REVEAL_EASES, OPEN_ANIMATION_PANEL_EVENT } from "@/components/draw-in-timing-controls"
import { useTakeTransport, useTransportSlot, createTakeTransport, useProgressValue, unEaseReveal, revealModeOf, transportLengths, seamWindowOf, type ProgressStore, type TakeTransport } from "@/lib/take-transport"
/* K7's PAPER BREAK. The junction SET is measured by the page and published on
 * `window.__heroJunctions`; this turns it into the samples the shader needs and
 * measures which junctions have an over/under to show at all. It lives in
 * lib/flat-ink.ts — the flat half of the beat — because it is a property of the
 * DRAWING rather than of the renderer, and because a pure function there is
 * runnable in node, which is how the shader's law is checked without a GPU. */
import {
  buildJointBreaks,
  PEN_FIELD_UNITS_PER_TEXEL,
  /* IMPORTED, NEVER RESTATED. The carve's envelope correction is expressed as a
   * DELTA on the slack the bake actually used, so if that constant ever moves
   * the correction follows it — a second copy here is exactly how the field and
   * the mesh came to disagree. See `PEN_CARVE_ENVELOPE_R`. */
  PEN_FIELD_TUBE_SLACK,
  type JointBreak,
  type HeroJunctionInput,
  type PenField,
} from "@/lib/flat-ink"
/* THE PEN FIELD IS BAKED THROUGH THE SCHEDULER, NOT CALLED DIRECTLY.
 *
 * `buildPenField` is deliberately no longer imported here: one call site, one
 * path. The scheduler owns when a bake goes to the worker, what stays on screen
 * while it does, and the cache — and it is a SEPARATE module from
 * `lib/flat-ink.ts` because the worker imports that file, and a
 * `new Worker(new URL(…))` expression inside a module its own worker imports
 * closes a cycle that DEADLOCKS Turbopack with no error printed (explainer 20
 * §8). Nothing in `lib/flat-ink.ts` may import this. */
import {
  buildPenFieldForSlot,
  PEN_FIELD_DEFER_DEBUG,
} from "@/lib/pen-field-defer"
import type { StyleState } from "@/lib/style-system"
import {
  findPreset,
  resolveMaterialParams,
  evaluateMaterialAnimation,
  MODE_MATERIAL_DEFAULTS,
  TEXTURE_ANIMATION_TYPES,
} from "@/lib/style-system"
import {
  createTextureUniforms,
  createSweepUniforms,
  TEXTURE_TYPE_INDEX,
  type TextureUniforms,
  type SweepUniforms,
} from "@/lib/texture-shader"
import {
  createDitherUniforms,
  DITHER_TYPE_INDEX,
  DITHER_DIRECTION_VEC,
  type DitherUniforms,
} from "@/lib/dither-shader"
import {
  createAsciiUniforms,
  ASCII_CHARSET_INDEX,
  ASCII_ANIM_INDEX,
  ASCII_DIRECTION_VEC,
  type AsciiUniforms,
} from "@/lib/ascii-shader"
import { applyStyleShader, createStackUniforms, type StackUniforms } from "@/lib/style-shader"
import { resolveStack, evaluateStackAnimation } from "@/lib/style-stack"
import {
  createStyleClock,
  advanceStyleClock,
  evaluateLayerTime,
  resolveSyncMode,
  createArmState,
  armedFor,
  runningLayerTime,
  runningSum,
  createRunningPhase,
  type StyleClock,
  type ArmState,
  type RunningPhase,
} from "@/lib/style-clock"
import { evaluateFusion, resolveFusionDrive } from "@/lib/style-fusion"
// The two studio rigs, each ported whole from the app it belongs to. Which one
// renders is a register decision (lib/registers.ts → RegisterLighting); the
// default is Free Stroke's own rig, so any caller that does not pass `lighting`
// — the main lab at `/` — is byte-identical to before this existed.
import { RegisterRig, StudioContactShadow, applyRimGlow } from "@/components/studio-rig"
import { FREE_STROKE, type RegisterLighting } from "@/lib/registers"
/* THE ANIMATED EXPORT. Frame-locked, not a screen recording — the module's own
 * header carries the argument and `docs/research/competitive-landscape-and-the-
 * missing-export.md` carries the reason it is the product surface rather than a
 * feature in a list. Nothing in `lib/export/` imports React, three or this file,
 * so the dependency runs one way: the component drives the exporter, never the
 * other way round. */
import { exportAnimation, planFrames, describePlan, revealEndsFor, EXPORT_PAPER, type ExportTimebase } from "@/lib/export"
import { useStrokeTake, type KeyLiveValues } from "@/components/stroke-strip"
import { sampleKeys, revealClockMs, keysEndMs, validateKeys, styleAt, KEYABLE_PATHS, framedKeys, type TakeKeys, type KeySample } from "@/lib/keyframes"
import { previewParamsAtWidth, rodNormalOffset, widenAlongNormals, widthAt, widthForFrame } from "@/lib/width-keys"


/**
 * GEOM_BUILD_DEBUG — dev-only, mode-agnostic geometry build counter.
 * `buildCount` increments once per actual geometry (re)build for ANY mode.
 * The verification harness asserts this stays FLAT across style changes,
 * which is the PRD's hard gate: "changing style state updates preview without
 * rebuilding geometry". Unlike the Extrude-only `extrudeDebugRef`, this works
 * for Rod / Solid / Inflate too.
 */
export const GEOM_BUILD_DEBUG = { buildCount: 0 }

/**
 * STYLE_CLOCK_DEBUG — the shared style clock lives inside <AnimatedStrokes>
 * (it must, to be advanced from useFrame), but the Debug panel renders in
 * <Viewport3D>. Mirroring the values into a module singleton is the same
 * pattern SOLID_ANIM_DEBUG uses, and avoids threading a ref through props for
 * a Debug-only readout.
 */
/* K2 · THE KEYED STYLE, AS A GATE READS IT (scripts/verify/assert-keyed-style.mjs).
 * `record` on, the frame loop appends one row per frame: the style clock, the
 * key clock, the texture layer's phase and the keyed values it drew with.
 * `__fsKeyMutant`, read once, is that gate's must-fail switch: "memo" makes
 * the frame read the doc's values instead of the keyed ones, "speedxtime" makes
 * a keyed speed multiply time instead of running as a sum, "nodisable" samples
 * the paths `KEY_DISABLED` leaves out. */
export const KEYED_STYLE_DEBUG: {
  record: boolean
  rows: {
    elapsed: number
    clockMs: number
    texTime: number
    texSpeed: number
    texIntensity: number
    keyed: number
    /** The material loop's phase and speed, when it runs this frame. */
    matTime?: number
    matSpeed?: number
  }[]
} = { record: false, rows: [] }
const KEY_MUTANT: string | undefined =
  typeof window !== "undefined" && process.env.NODE_ENV !== "production"
    ? (window as unknown as { __fsKeyMutant?: string }).__fsKeyMutant
    : undefined

export const STYLE_CLOCK_DEBUG = {
  elapsed: 0,
  reveal: 0,
  sinceCompletion: Infinity as number,
  groupAmount: 1,
  groupOffset: 0,
  groupFrozen: false,
  // Exposed so a verification script can assert that the reduced-motion path is
  // actually the one running, rather than inferring it from "nothing moved".
  reduceMotion: false,
  /** How the clock was advanced on the last frame. `drive` means an exporter
   *  owns it. Published so a gate can prove WHICH path ran rather than infer it
   *  from two files happening to match — a green row that cannot fail is the lie. */
  source: "wall" as "wall" | "drive",
}

/**
 * STYLE_CLOCK_DRIVE — hand the style clock to a frame-locked exporter.
 *
 * ── THE DEFECT THIS CLOSES ────────────────────────────────────────────────
 * The reveal is already deterministic: `playheadRef` is a ref the frame loop
 * reads, and `__revealHarness.setProgress` steps it to an exact value. The
 * STYLE clock is not. `advanceStyleClock(clock, delta, …)` is called below with
 * R3F's REAL frame delta, so texture drift, dither crawl, glyph scroll, the
 * shine sweep and the completion pulse all run on wall time.
 *
 * That is fine on screen and fatal in an export. A frame-locked export decides
 * up front that frame 37 is at 1233.33 ms; if rendering that frame happens to
 * take 120 ms, the wall-driven clock advances 120 ms instead of the 33.33 ms
 * the file will claim, and every time-varying layer runs four times too fast —
 * differently on every machine, and differently on the same machine twice. The
 * geometry would be frame-exact while the SURFACE was a wall-clock recording,
 * which is the exact thing `lib/export/frame-plan.ts` exists to refuse.
 *
 * So the exporter sets `exactMs` per frame and the clock is driven to that
 * instant rather than nudged by a delta. `null` — the default, and what a
 * `finally` always restores — is the normal wall-driven path, unchanged.
 *
 * It is a module singleton and not React state for the same reason
 * `STYLE_CLOCK_DEBUG` is: the clock lives inside <AnimatedStrokes>'s frame loop
 * and the exporter lives in <Viewport3D>, and a state round trip per frame
 * would be a re-render inside a loop that is already awaiting a GPU read-back.
 */
export const STYLE_CLOCK_DRIVE: { exactMs: number | null } = { exactMs: null }

/**
 * SWEEP_DEBUG — the shine band's actual state, published so an assertion can
 * read the NUMBER instead of inferring it from pixels.
 *
 * WHY IT EXISTS. `lib/style-fusion.ts:768` reports a stale-band path: the
 * fusion block applies the band inside `if (fz.sweep)` and, on the else branch,
 * restored only the sweep's DIRECTION — so `uFsSweepAmt` kept whatever the last
 * band-driving frame left in it. That report was written from the code, and
 * from the code alone it is correct.
 *
 * Driving the real page says something more useful: the material-animation
 * block twenty lines earlier writes `uFsSweepAmt = 0` on EVERY frame that is
 * not a Shine Sweep (`:1799`), and it runs BEFORE the fusion block, so the
 * stale value was being overwritten a fraction of a millisecond after it was
 * left behind. The defect was real in the code and invisible in the picture —
 * an invariant held by accident, by the execution order of two blocks that know
 * nothing about each other. The else branches now zero it themselves, and
 * `source` says which block last wrote the band, so the claim "fusion is no
 * longer driving it" is checkable rather than argued.
 */
export const SWEEP_DEBUG = {
  amt: 0,
  pos: 0,
  width: 0,
  dirX: 0,
  dirY: 0,
  /** Which block last wrote the band this frame. */
  source: "none" as "none" | "material" | "fusion",
}

/* ------------------------------------------------------------------ */
/*  THE STILL EXPORT — a picture of the thing you just made            */
/* ------------------------------------------------------------------ */

export interface StillOptions {
  /** Device pixels per CSS pixel in the output. 1 / 2 / 4 in the UI. */
  scale: number
  /** Leave the ground out, so the mark can be placed on anything. */
  transparent: boolean
}

export interface StillResult {
  blob: Blob
  width: number
  height: number
}

/**
 * The same picture, one step earlier — before the PNG encode.
 *
 * An animated export asks for a hundred and forty of these in a row, and
 * `toBlob` + `createImageBitmap` per frame is a PNG compress and a PNG decompress
 * the encoder is going to throw away. `grabCanvas` skips both. It is the SAME
 * render as `grab` — one `renderStill`, two wrappers — because two
 * implementations of one picture is how a still and a video of the same mark
 * quietly stop matching.
 */
export interface StillCanvas {
  canvas: HTMLCanvasElement
  width: number
  height: number
}

/**
 * STILL_EXPORT — the picture grab, published out of the scene the same way
 * `STYLE_CLOCK_DEBUG` publishes the clock.
 *
 * ── WHY THIS EXISTS AT ALL ────────────────────────────────────────────────
 * The only download this app had was a GLB. Everything the style stack does —
 * texture, dither, ASCII, the fusions, the layer stack — is a SHADER, so none
 * of it survives a glTF export (PRD §12: material metadata is v2, baking is
 * v3). A user who styled a mark with ASCII and dither could not take that
 * picture anywhere. The one code path that could produce it was
 * `__captureHarness.grab()`, fenced behind `NODE_ENV !== "production"` for the
 * video scripts. This is that capability, built as a feature instead.
 *
 * ── WHY IT IS NOT `canvas.toDataURL()` ────────────────────────────────────
 * Two reasons, and both are the difference between a screenshot and an export.
 *
 * 1 · RESOLUTION. The backing buffer is whatever the panel happens to be, so a
 *     naive grab hands the user a ~900px picture of a 3-D object. The grab
 *     re-sizes the DRAWING BUFFER only (`setSize(..., updateStyle: false)`),
 *     renders one frame, reads it, and puts the buffer back — the CSS size
 *     never changes, so there is no layout shift and no visible flash.
 *
 * 2 · THE SCREEN-SPACE LAYERS WOULD LIE. ASCII and dither are locked to
 *     `gl_FragCoord` by default (`lib/ascii-shader.ts:407`,
 *     `lib/dither-shader.ts:234`), so their cell size is in DEVICE pixels. Grab
 *     at 4x without compensating and the glyph grid comes out four times finer
 *     relative to the form — a different picture from the one on screen, which
 *     is the one thing an export may never be. The cell size and the texture's
 *     screen frequency are scaled with the buffer for exactly the length of the
 *     grab, so the output matches the viewport at every scale.
 */
export const STILL_EXPORT: {
  grab: null | ((opts: StillOptions) => Promise<StillResult | null>)
  /** The un-encoded frame, for the animated export. See `StillCanvas`. */
  grabCanvas: null | ((opts: StillOptions) => StillCanvas | null)
} = { grab: null, grabCanvas: null }

/**
 * WHAT THE LAST GRAB ACTUALLY DID — the compensation as a NUMBER.
 *
 * A pixel comparison can tell you two pictures differ; it cannot cleanly tell
 * you WHY, because a 2x render legitimately has finer glyph strokes as well as
 * (wrongly, if uncompensated) a finer glyph GRID, and averaging the big one
 * down mixes the two. Publishing the cell size before and after removes the
 * argument: at 2x a screen-locked ASCII cell must come out at exactly twice its
 * viewport value, and `assert-still-export.mjs` reads that rather than
 * inferring it.
 */
export const STILL_DEBUG = {
  scale: 0,
  transparent: false,
  width: 0,
  height: 0,
  asciiScreenLocked: false,
  asciiCellBefore: 0,
  asciiCellAfter: 0,
  ditherScreenLocked: false,
  ditherScaleBefore: 0,
  ditherScaleAfter: 0,
  chromeHidden: 0,
}

/** The studio ground, composited behind the mark when the user wants paper. */
const STILL_PAPER = "#fafafa"

/* THE COPIED CONSTANT, CHECKED IN BOTH DIRECTIONS.
 *
 * `lib/` may not import a component, so `lib/export/index.ts` carries its own
 * `EXPORT_PAPER` — and a pasted constant is exactly the drift this repo has
 * already been bitten by twice (`scripts/capture/motion.mjs` found stale two
 * days running). `assert-export-plan.mjs` reads the literal out of THIS file
 * and fails if the two disagree, which catches it in CI; this catches it in the
 * browser the moment the chunk loads, which is where a developer will see it.
 * Dev-only and non-fatal on purpose: a mismatched ground is a wrong picture,
 * not a broken app, and a thrown error here would take the whole viewport down
 * over a colour. */
if (process.env.NODE_ENV !== "production" && EXPORT_PAPER !== STILL_PAPER) {
  console.error(
    `[FreeStroke Export] the still's paper (${STILL_PAPER}) and the film's paper (${EXPORT_PAPER}) have drifted apart — a still and a video of the same mark will not match.`,
  )
}

/**
 * The largest edge a browser canvas can be relied on for. Chrome's hard limit
 * is higher, but it also caps total AREA, and a silently-blank canvas is a much
 * worse outcome than a slightly smaller file — so the scale is clamped and the
 * real output size is reported back to the user rather than assumed.
 */
const STILL_MAX_EDGE = 8192

/** Objects tagged with this are viewport CHROME and never belong in a still. */
type StillChrome = "grid" | "shadow"

/** File sizes as a human reads them — used in every export toast. */
function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/** The still export's resolution steps, with what each one is FOR. A number
 *  with no purpose beside it is a number the user has to guess about. */
const PNG_SCALES: { value: number; label: string; note: string }[] = [
  { value: 1, label: "1×", note: "as shown on screen" },
  { value: 2, label: "2×", note: "retina / slides" },
  { value: 4, label: "4×", note: "print / large crops" },
]

const INITIAL_CAMERA_POSITION = new THREE.Vector3(0, 0, 5)
const INITIAL_CAMERA_TARGET = new THREE.Vector3(0, 0, 0)

const FRAME_K = 3.0
const TOP_K = 2.5

/**
 * The vertical field the perspective camera has always used — and the field the
 * AFFINE camera is framed to MATCH, so the two agree exactly at the plane the
 * controls are targeting. See `Viewport3DProps.projection`.
 */
const CAMERA_FOV_DEG = 50

/**
 * FRAME A CAMERA AT `dist` — the one place the two projections are reconciled.
 *
 * A perspective camera shows a half-height of `dist · tan(fov/2)` at the target
 * plane; distance is how it frames a shot. R3F builds an orthographic camera in
 * PIXEL units (`top = height / 2` at zoom 1), where distance frames nothing at
 * all — zoom does. Equating the two half-heights is what makes a parked dead-on
 * frame the SAME PICTURE under either projection, and it is what keeps `fillK`
 * meaning exactly what it has always meant on every caller.
 *
 * A no-op on a perspective camera, so every framing helper can call it
 * unconditionally rather than branching four times.
 */
function applyFraming(camera: THREE.Camera, dist: number) {
  const ortho = camera as THREE.OrthographicCamera
  if (!ortho.isOrthographicCamera) return
  const halfH = dist * Math.tan((CAMERA_FOV_DEG * Math.PI) / 360)
  if (!(halfH > 0)) return
  ortho.zoom = ortho.top / halfH
  ortho.updateProjectionMatrix()
}

/* ------------------------------------------------------------------ */
/*  Convert 2D strokes to 3D mesh data via geometry engine             */
/* ------------------------------------------------------------------ */

const MIN_REVEAL_RINGS = 1 // minimum tube rings visible before showing any caps/joints

function useStrokeMeshes(
  strokes: ProcessedStroke[],
  canvasWidth: number,
  canvasHeight: number,
  mode: GeometryMode,
  extrudeParams?: ExtrudeParams,
  solidParams?: SolidParams,
  /** Inflate fusion dials (fusion strategy / blend k / MC resolution). */
  inflateParams?: InflateParams,
  /**
   * OPTIONAL Solid H3 animation hole stabilization (animation-only).
   * Forwarded verbatim to `engine.buildPreview` for the Solid path. Static
   * preview, Rod, Extrude, and Solid export do not read it.
   *
   * `holeStabilizationKey` is a cheap memo signature for the override so the
   * useMemo doesn't have to compare deep contour arrays. Scene maintains it.
   */
  holeStabilization?: import("@/lib/solid-mask").SolidHoleStabilization,
  holeStabilizationKey?: string,
  /**
   * OPTIONAL Solid animation-only no-holes reveal mode.
   *
   * When true, the Solid mesh is rebuilt as a stable filled silhouette
   * extrusion with H2 disabled. Used by Scene during the active reveal
   * (progress < 1) to eliminate mid-animation hole/counter topology
   * switching. Cleared on the final frame so the mesh commits to the
   * full static H3 geometry exactly once.
   */
  disableHolesForAnimation?: boolean,
  /**
   * Which codebase's engine builds the geometry (lib/engine-registry.ts).
   * Omitted -> Free Stroke's own, so every existing caller is unchanged.
   * Listed in the memo deps below for exactly the reason the comment above
   * gives: swapping engines changes geometry, so it must re-fire the build.
   */
  engineFamily: EngineFamily = DEFAULT_ENGINE_FAMILY,
  /**
   * OPTIONAL world XY centre for Extrude's DRAFTED side walls, computed by the
   * caller from the FULL strokes.
   *
   * `strokes` above is the arc-length-filtered PARTIAL during draw-in, and the
   * draft taper shrinks the back face toward the pool's centre — so deriving
   * that centre in here would move it every reveal tick and re-slant every
   * letter already on screen. Passed in, not inferred.
   */
  draftCentre?: { x: number; y: number } | null,
): StrokeMeshData[] {
  // PARAM SIGNATURE — value identity for the three param objects, derived
  // rather than hand-listed.
  //
  // These params are rebuilt on most renders, so passing the objects
  // themselves as deps rebuilds the geometry on every render. The fix used to
  // be to pull each field out as a scalar and list it, under a comment reading
  // "CRITICAL: every slider value the engine consumes must be listed here."
  //
  // That comment was correct and was not enough. `ExtrudeParams.bevelSize` and
  // `.bevelSegments` are typed, defaulted, and — since the ribbon builder
  // started reading them for the rounded rim — genuinely consumed, and neither
  // was ever added to the list. It stayed invisible only because no UI writes
  // them; the first Bevel control shipped would have been a dial that did
  // nothing, with no error anywhere. A rule that lives as prose beside a call
  // site is enforced by whoever happens to read the prose.
  //
  // Serialising the objects encodes the rule instead of restating it: a field
  // added to ExtrudeParams is in the signature the moment it exists, because
  // the signature is a function of the object rather than a transcription of
  // it. Nobody has to remember.
  //
  // The one property worth stating: key ORDER affects the string, so two call
  // sites that build the same params in a different order produce different
  // signatures. That costs an extra rebuild. It cannot cost a STALE one —
  // different values always produce a different string. The failure mode this
  // replaces was stale geometry, which is silent and wrong; the failure mode
  // it introduces is a redundant rebuild, which is merely slow. Take that
  // trade in that direction, never the reverse.
  const paramSig = JSON.stringify([extrudeParams, solidParams, inflateParams, draftCentre])

  return useMemo(() => {
    const engine = getEngineFor(mode, engineFamily)
    return engine.buildPreview(strokes, {
      canvasWidth,
      canvasHeight,
      extrudeParams,
      solidParams,
      inflateParams,
      holeStabilization,
      disableHolesForAnimation,
      draftCentre: draftCentre ?? undefined,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, canvasWidth, canvasHeight, mode, engineFamily, paramSig, holeStabilizationKey, disableHolesForAnimation])
}

/* ---- Shared geometries ---- */
/**
 * PART TAGS for the topology census (`__geomDebug.stats()`).
 *
 * The census used to separate Rod's two sphere passes by VERTEX COUNT: a cap was
 * (SPHERE_SEGMENTS+1)^2 = 225 and a joint was (JOINT_SPHERE_SEGMENTS+1)^2 = 81,
 * "and nothing else can land in these buckets". That was true when the two
 * tessellations differed. Then the tessellations were deliberately unified —
 * both spheres now take RADIAL_SEGMENTS, because a sphere welded into the tube
 * must not be coarser than the tube — and the discriminator silently collapsed:
 * both are 289 verts, the `else if` can never be reached, and `jointSpheres`
 * became STRUCTURALLY ZERO on every fixture. It read exactly like a clean
 * result. Measured on `zigzag`, the fixture whose seven hard corners must KEEP
 * their beads, the census said `joints=0 caps=9` for a single stroke that can
 * only own two caps — the seven joints were all in the cap bucket.
 *
 * Same class of failure as every instrument in
 * docs/explainers/13-measuring-the-rim.md: a value derived under one set of
 * assumptions, read under another, with nothing at the boundary that checks.
 * The fix is to remove the assumption, not to pick two new numbers — the mesh
 * says what it is, so the census reads the tag instead of inferring the part
 * from its resolution.
 */
const FS_PART_CAP = { fsPart: "cap" } as const
const FS_PART_JOINT = { fsPart: "joint" } as const
const sphereGeometry = new THREE.SphereGeometry(TUBE_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS)
// Joint spheres are mostly buried inside the tube (see JOINT_SPHERE_SEGMENTS in
// geometry-engines). Preview uses the same reduced resolution as export so the
// two stay in visual parity.
const jointSphereGeometry = new THREE.SphereGeometry(
  TUBE_RADIUS,
  JOINT_SPHERE_SEGMENTS,
  JOINT_SPHERE_SEGMENTS,
)

/* Stroke materials are no longer module-level singletons. As of the
 * POST_MVP material work, the preview material is created inside
 * <AnimatedStrokes> from styleState.materialPreset (see `liveMaterial`) so the
 * Material panel actually drives the surface. Export still builds its own
 * lightweight material at export time. */

/* ---- Bounding box ---- */
interface StrokeBounds {
  center: THREE.Vector3
  radius: number
  /** Lowest point of the geometry in world Y. The bounding SPHERE bottom
   *  (center.y - radius) sits well below the form for anything wider than it
   *  is tall, which would float a contact shadow off the object; the ported
   *  Desk Doodles shadow wants the box minimum, as its own bounds carry.
   *  Optional so any other construction site keeps type-checking. */
  minY?: number
}

function useStrokeBounds(meshes: StrokeMeshData[]): StrokeBounds | null {
  return useMemo(() => {
    if (meshes.length === 0) return null

    const box = new THREE.Box3()
    for (const { tubeGeometry } of meshes) {
      tubeGeometry.computeBoundingBox()
      if (tubeGeometry.boundingBox) {
        box.union(tubeGeometry.boundingBox)
      }
    }
    if (box.isEmpty()) return null

    const center = new THREE.Vector3()
    box.getCenter(center)
    const sphere = new THREE.Sphere()
    box.getBoundingSphere(sphere)

    return { center, radius: sphere.radius, minY: box.min.y }
  }, [meshes])
}

/* ---- useStableStrokesBounds: bounds derived directly from raw stroke points ----
 *
 * Used for camera framing in Solid mode where the visible mesh is rebuilt every
 * frame from a partial subset of the strokes (draw-in animation). Mesh-derived
 * bounds shrink during animation, which would cause the camera to zoom in. By
 * computing bounds from the full unfiltered strokes via the same world-space
 * transform that `strokesToTestStroke` uses (lib/geometry-engines.ts), the
 * camera frame stays locked to the FINAL geometry size for the entire playback.
 *
 * Cheap: pure O(N) point iteration, no mesh rebuild.
 */
function useStableStrokesBounds(
  strokes: ProcessedStroke[],
  canvasWidth: number,
  canvasHeight: number,
): StrokeBounds | null {
  return useMemo(() => {
    if (strokes.length === 0 || canvasWidth <= 0 || canvasHeight <= 0) return null

    // Identical world-space transform used by strokesToTestStroke:
    //   worldX = (x - W/2) * scale
    //   worldY = -(y - H/2) * scale
    //   scale  = 3.0 / max(W, H)
    const scale = 3.0 / Math.max(canvasWidth, canvasHeight)
    const offsetX = canvasWidth / 2
    const offsetY = canvasHeight / 2

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let count = 0

    for (const s of strokes) {
      for (const p of s.points) {
        const wx = (p.x - offsetX) * scale
        const wy = -(p.y - offsetY) * scale
        if (wx < minX) minX = wx
        if (wx > maxX) maxX = wx
        if (wy < minY) minY = wy
        if (wy > maxY) maxY = wy
        count++
      }
    }

    if (count === 0 || !isFinite(minX)) return null

    // Small padding for stroke thickness and Solid extrusion depth.
    // Sized in world units; matches typical maxima of thickness/depth.
    const pad = 0.15
    minX -= pad
    minY -= pad
    maxX += pad
    maxY += pad

    const center = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, 0)

    // Bounding sphere radius around the center, also accounting for a small
    // depth on Z (Solid extrusion is centered at z=0).
    const dx = (maxX - minX) / 2
    const dy = (maxY - minY) / 2
    const dz = pad
    const radius = Math.sqrt(dx * dx + dy * dy + dz * dz)

    return { center, radius, minY }
  }, [strokes, canvasWidth, canvasHeight])
}

/* ---- Auto-frame on first draw ----
 *
 * Frames the camera once when the user goes from "no drawing" to "has drawing".
 * The gate uses `strokeCount` (the count of user-drawn strokes from the parent
 * prop), NOT the live mesh count, because in Solid mode the mesh count cycles
 * 0 -> N -> 0 during draw-in playback, which would otherwise re-trigger framing
 * and override any manual orbit/zoom the user did before pressing Play.
 */
function AutoFrameOnFirstDraw({
  strokeCount,
  bounds,
  controlsRef,
}: {
  strokeCount: number
  bounds: StrokeBounds | null
  controlsRef: React.RefObject<OrbitControlsImpl | null>
}) {
  const { camera } = useThree()
  const hasFramedRef = useRef(false)
  const prevCountRef = useRef(0)

  useEffect(() => {
    if (strokeCount === 0) {
      hasFramedRef.current = false
      prevCountRef.current = 0
      return
    }
    // Frame the first stroke once bounds AND controls are actually available.
    //
    // This used to also require `prevCountRef.current === 0`, while
    // `prevCountRef.current = strokeCount` ran unconditionally at the end. So
    // if geometry had not finished building when the first stroke arrived
    // (bounds still null — the common case, since the mesh is built in a memo
    // downstream of this effect), the one-shot was CONSUMED without ever
    // framing: prevCount became 1, the condition could never be true again, and
    // the user was left staring at an empty grid until they found "Reset
    // camera". `hasFramedRef` is the real one-shot gate, so gate on that alone
    // and let the effect re-attempt on the next render that has bounds.
    if (strokeCount > 0 && !hasFramedRef.current && bounds && bounds.radius > 0) {
      const controls = controlsRef.current
      if (controls) {
        hasFramedRef.current = true
        const dir = new THREE.Vector3(1, 1, 1).normalize()
        const pos = bounds.center.clone().add(dir.multiplyScalar(bounds.radius * FRAME_K))
        camera.position.copy(pos)
        controls.target.copy(bounds.center)
        applyFraming(camera, bounds.radius * FRAME_K)
        controls.update()
      }
    }
    prevCountRef.current = strokeCount
  }, [strokeCount, bounds, camera, controlsRef])

  return null
}

/**
 * FRAME THE EMPTY STAGE — the other half of `AutoFrameOnFirstDraw`.
 *
 * 🔴 THE DEFECT, MEASURED. On `/` the viewport mounts ORTHOGRAPHIC (app/page.tsx
 * passes `flatten`, so `projection` resolves to `"affine"`), and R3F builds an
 * orthographic camera in PIXEL units — `top = height / 2` at `zoom: 1`, so one
 * world unit is one pixel. Nothing set the zoom until a stroke arrived, so the
 * 6-unit `gridHelper` below rendered at SIX PIXELS. Measured 2026-09-04, 1512 ×
 * 982, dpr 1, DOM overlays hidden: **an 8 × 8 px, 60-ink-pixel speck at the
 * centre of the panel** — sitting on the empty-state mark, where it reads as a
 * dust mote on the screen rather than as a stage. That is the first frame of
 * the product.
 *
 * The framing this needs was already written, in `handleResetCamera`'s
 * no-bounds branch: `applyFraming(camera, INITIAL_CAMERA_POSITION.length())`,
 * which equates the ortho half-height to what a `CAMERA_FOV_DEG` perspective
 * camera sees at that distance. Nothing called it at mount. This calls it.
 *
 * ZOOM ONLY. Position and target are left alone, so this can never fight an
 * orbit or a "Top" the user asked for. It re-runs when the scene returns to
 * zero strokes (Clear), because the stage is what Clear should give back.
 *
 * A no-op under perspective — `applyFraming` returns early on a camera that is
 * not orthographic — so `/desk-doodles` and every capture host are unchanged.
 */
function FrameEmptyStage({ strokeCount }: { strokeCount: number }) {
  const { camera } = useThree()
  useEffect(() => {
    if (strokeCount > 0) return
    applyFraming(camera, INITIAL_CAMERA_POSITION.length())
  }, [strokeCount, camera])
  return null
}

/* ---- CameraSlave: copies camera from a master OrbitControls ref ---- */
function CameraSlave({
  masterControlsRef,
}: {
  masterControlsRef: React.RefObject<OrbitControlsImpl | null>
}) {
  const { camera } = useThree()

  useFrame(() => {
    const master = masterControlsRef.current
    if (!master) return
    camera.position.copy(master.object.position)
    camera.quaternion.copy(master.object.quaternion)
    ;(camera as THREE.PerspectiveCamera).fov = (master.object as THREE.PerspectiveCamera).fov
    ;(camera as THREE.PerspectiveCamera).updateProjectionMatrix()
  })

  return null
}

/* ------------------------------------------------------------------ */
/*  Animation timeline: computes timing from raw stroke timestamps    */
/* ------------------------------------------------------------------ */

interface StrokeTimeline {
  /** Global time start (ms since epoch) relative to the very first point */
  tStart: number
  /** Global time end */
  tEnd: number
}

function useTimeline(rawStrokes: Stroke[]): {
  timelines: StrokeTimeline[]
  totalDuration: number
  globalTStart: number
} {
  return useMemo(() => {
    if (rawStrokes.length === 0) return { timelines: [], totalDuration: 0, globalTStart: 0 }

    let globalMin = Infinity
    let globalMax = -Infinity

    for (const stroke of rawStrokes) {
      for (const p of stroke.points) {
        if (p.t < globalMin) globalMin = p.t
        if (p.t > globalMax) globalMax = p.t
      }
    }

    const totalDuration = Math.max(globalMax - globalMin, 1) // at least 1ms to avoid div/0

    const timelines: StrokeTimeline[] = rawStrokes.map((stroke) => {
      const pts = stroke.points
      if (pts.length === 0) return { tStart: 0, tEnd: 0 }
      let sMin = Infinity
      let sMax = -Infinity
      for (const p of pts) {
        if (p.t < sMin) sMin = p.t
        if (p.t > sMax) sMax = p.t
      }
      return {
        tStart: sMin - globalMin,
        tEnd: sMax - globalMin,
      }
    })

    return { timelines, totalDuration, globalTStart: globalMin }
  }, [rawStrokes])
}

/* ------------------------------------------------------------------ */
/*  AnimatedStrokes: manages drawRange + visibility per frame         */
/* ------------------------------------------------------------------ */

/* `RevealMode` now comes from lib/pen-reveal.ts — see the import block. */

/* ------------------------------------------------------------------ */
/*  FlatState: the form driven back to being a drawing                 */
/* ------------------------------------------------------------------ */

/**
 * THE FLAT REGISTER, RENDERED BY THE 3D ENGINE ITSELF.
 *
 * The hero beat claims that a flat drawn mark becomes a three-dimensional
 * object. Showing that needs a genuinely flat first state — and the obvious
 * build, a 2D canvas layered over the WebGL one, was tried here and failed on
 * REGISTRATION: two renderers, two coordinate systems and a measured-bbox
 * round-trip between them, which is four independent chances to disagree about
 * where the word is. It only has to disagree once, at the one instant the beat
 * is asserting the two images are the same object, to destroy the whole claim.
 * (Desk Doodles hit the same wall and never solved it either — its shipped flip
 * hard-swaps the two faces at the edge-on midpoint of a CSS card-turn
 * specifically so they are never on screen together. Its own craft audit lists
 * choreographing this beat as still-unbuilt and CRITICAL.)
 *
 * So the flat state is not a second layer. It is the SAME MESH, through the
 * SAME CAMERA, driven to render as a drawing:
 *
 *   `depth` collapses the form along its own view axis, so it has no thickness.
 *   `ink`   collapses the SHADING — albedo to black, emissive to the ink, every
 *           specular path (env, reflectivity, clearcoat, sheen, metalness, the
 *           fresnel rim) to zero. What survives is one constant value inside a
 *           hard silhouette, which is what a drawing IS.
 *
 * KNOWN LIMIT, MEASURED AND NOT YET SOLVED. Collapsing shading flattens a
 * SURFACE; it does not flatten a SHAPE. Head-on, this form still has a tube's
 * silhouette — an outline set by tube diameter, tapered tube ends, fused fillets
 * at crossings — where flat lettering has the pen's outline. Sebs: *"the
 * animation just shows the 3D letter head-on — which yeah will look flat, but
 * it's still 3D."*
 *
 * Quantified, on the medial-axis half-width of the rendered mark (the statistic
 * that reads the boundary rather than the interior):
 *
 *   this flat state, mid-breath   half-width median 7.07px, spread 0.493
 *   the settled solid, head-on    half-width median 7.07px, spread 0.493
 *
 * Identical to three decimals — the flat state IS the solid. The interior gates
 * in assert-hero-transition.mjs cannot see this by construction, because the
 * entire difference lives on the boundary. The replacement beat is being
 * storyboarded separately; this comment is here so the next reader does not
 * re-derive the same wrong conclusion from the same green gates.
 */
import { SOLID_STATE, type FlatState } from "@/lib/flat-ink"
export type { FlatState }
export { SOLID_STATE }

export interface LetterMap {
  of: readonly number[]
  count: number
}

/** Fully three-dimensional — what every call site that omits the prop gets. */

/* ---- `FlatState`'S THIRTEEN NAMES, AT RUNTIME ----------------------------
 *
 * WHY THIS EXISTS, AND IT IS NOT A TYPE-SAFETY NICETY. `__captureHarness
 * .setFlatten` takes `Partial<FlatState>`, and `Partial<FlatState>` is a
 * COMPILE-TIME type across a `page.evaluate` boundary — the object arrives as
 * JSON and carries no check at all. So `setFlatten({ flat: 0 })` used to return
 * `true`, set a key that is not on this interface, move nothing, and let an
 * OFAT row publish *"not it"* about a path it had never touched. That is not a
 * hypothetical: it is explainer 24's opening ruled-out table, two of whose rows
 * measured nothing, and it is why `{flat: 0}` became a published verdict.
 *
 * The names are kept HERE, beside the type, for the reason `IMPLICIT_OWN_ATTRS`
 * gives one line above its own switch (`geometry-engines.ts`): *"kept beside the
 * switch so the two cannot drift."* Here the drift is closed by the compiler as
 * well as by the comment — `_flatKeysExhaustive` below fails to typecheck in
 * BOTH directions, so a fourteenth channel added to `FlatState` and not to this
 * array is a build error rather than a validator that silently rejects a real
 * key.
 */
const FLAT_STATE_KEYS = [
  "ink",
  "depth",
  "color",
  "yaw",
  "pitch",
  "shade",
  "shadow",
  "squashX",
  "squashY",
  "jointBreak",
  "penCarve",
  "lit",
  "letters",
] as const

/** A key on the interface and missing from the array — must be `never`. */
type _FlatKeyMissing = Exclude<keyof FlatState, (typeof FLAT_STATE_KEYS)[number]>
/** A key in the array and not on the interface — must be `never`. */
type _FlatKeyExtra = Exclude<(typeof FLAT_STATE_KEYS)[number], keyof FlatState>
/** The drift gate. Both `never` → this is `true`; otherwise it is `never` and
 *  this line does not compile. */
const _flatKeysExhaustive: [_FlatKeyMissing, _FlatKeyExtra] extends [never, never] ? true : never =
  true
void _flatKeysExhaustive

/**
 * ELEVEN OF THE THIRTEEN ARE NUMBERS, AND THE OTHER TWO ARE THE WHOLE POINT.
 * `color` is a `string`, `letters` is an array of objects. A blanket
 * `typeof v === "number"` would reject two legitimate channels — which is the
 * "widen an exemption, never the rule" trap running the other way: a validator
 * that is wrong about a REAL key gets deleted the first time it blocks someone,
 * and then nothing validates anything.
 *
 * ⚠ Explainer 24 §8 says *"ten of the thirteen are numeric"*. Counted off the
 * interface it is ELEVEN — `ink · depth · yaw · pitch · shade · shadow ·
 * squashX · squashY · jointBreak · penCarve · lit`. The list is what binds here,
 * not the sentence.
 */
const FLAT_STATE_NUMERIC: ReadonlySet<string> = new Set([
  "ink",
  "depth",
  "yaw",
  "pitch",
  "shade",
  "shadow",
  "squashX",
  "squashY",
  "jointBreak",
  "penCarve",
  "lit",
])

/** One entry of `FlatState.letters` — four required numbers and an optional
 *  fifth (`settle`, whose omitted default is 0 and must stay omissible). */
function isFlatLetter(v: unknown): boolean {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false
  const l = v as Record<string, unknown>
  for (const n of ["yaw", "flat", "depth", "shade"]) {
    if (typeof l[n] !== "number" || !Number.isFinite(l[n] as number)) return false
  }
  if (l.settle !== undefined && (typeof l.settle !== "number" || !Number.isFinite(l.settle)))
    return false
  return true
}

/**
 * IS THIS A `Partial<FlatState>` A SWEEP MAY BE MEASURED ON?
 *
 * `null` is TRUE and means *clear* — the documented contract callers rely on.
 * Anything else must be a plain object whose every own key is one of the
 * thirteen AND whose value is the right KIND for that key.
 *
 * REFUSES THE WHOLE OBJECT, never a subset. `{ flat: 0, depth: 1 }` applying
 * its valid half is exactly how the retracted row happened — the arm moved 18
 * px, the sweep recorded a change, and the verdict was written about `flat`.
 * An arm that is half-applied is an arm nobody can attribute, so the setter
 * takes it whole or not at all. The same rule `setPenTipShape` follows: it
 * rejects the PAIR, and sets neither number.
 *
 * Exported so a gate can hold the rule without a browser, the way
 * `dropStaleImplicitAttrs` is exported for the same reason.
 */
/* ---- THE PRE-FIX SETTER, PARKED AS A RENDER -----------------------------
 *
 * `setFlattenValidates(false)` restores the setter that shipped — `return true`
 * for anything, including `{__laneDBogus: 0}`. It is not a synthetic mutant: it
 * is the code that published two rows of explainer 24's ruled-out table, kept
 * reachable so the defect stays RE-RENDERABLE and so the fix's own gate row can
 * prove on every bare run that it is able to come back red.
 *
 * This is the shape every other known-bad in this file already has
 * (`TIP_RIDES_SCHEDULE`, `LETTER_WHOLE_TRIANGLES`, `IMPLICIT_REFILL_DROPS_
 * STALE_ATTRS`), and it is the law explainer 21 §7 states: *"the gate runs three
 * kinds of control on the DEFAULT invocation, never behind a flag."* A control
 * nobody arms is a control nobody has.
 *
 * DEV ONLY — production always validates.
 */
const FLATTEN_VALIDATES = true
let liveFlattenValidates: boolean = FLATTEN_VALIDATES
function setFlattenValidates(on: boolean): boolean {
  if (process.env.NODE_ENV === "production") return false
  liveFlattenValidates = !!on
  return true
}
function readFlattenValidates(): boolean {
  return process.env.NODE_ENV === "production" ? FLATTEN_VALIDATES : liveFlattenValidates
}

export function isValidFlatState(o: unknown): boolean {
  if (o === null || o === undefined) return true
  if (typeof o !== "object" || Array.isArray(o)) return false
  const rec = o as Record<string, unknown>
  for (const k of Object.keys(rec)) {
    if (!(FLAT_STATE_KEYS as readonly string[]).includes(k)) return false
    const v = rec[k]
    /* An own key set to `undefined` is what `Partial<FlatState>` MEANS, and it
     * cannot even survive the `page.evaluate` boundary — JSON drops it. Legal
     * from in-page code, so it is legal here. */
    if (v === undefined) continue
    if (FLAT_STATE_NUMERIC.has(k)) {
      if (typeof v !== "number" || !Number.isFinite(v)) return false
    } else if (k === "color") {
      if (typeof v !== "string") return false
    } else {
      if (!Array.isArray(v)) return false
      for (const e of v) if (!isFlatLetter(e)) return false
    }
  }
  return true
}

/** Scratch for the flatten group's matrix. Composed once per frame on a single
 *  threaded render loop; hoisted so the turn does not allocate four matrices a
 *  frame for the entire life of the page. */
const M_ROT = new THREE.Matrix4()
const M_A = new THREE.Matrix4()
const M_B = new THREE.Matrix4()
const M_C = new THREE.Matrix4()
const M_SQ_A = new THREE.Matrix4()
const M_SQ_B = new THREE.Matrix4()
const M_SQ_C = new THREE.Matrix4()
/** O2's hinge — see `FlatState.pitch`. Three more, same reason as above. */
const M_PIT = new THREE.Matrix4()
const M_PIT_A = new THREE.Matrix4()
const M_PIT_B = new THREE.Matrix4()

/**
 * DEV-ONLY FLATTEN OVERRIDE — how a channel that the host does not yet pass is
 * proven to RENDER.
 *
 * `shadow`, `squashX` and `squashY` are computed by `lib/hero-motion.ts` and
 * are not yet on the host's `flatten` object, because adding the field and
 * passing it are two different files. A channel wired but undrivable is exactly
 * the dead-parameter class this beat has now produced twice, so the assertion
 * cannot wait on the other half: a probe sets this before driving and asserts
 * the render moves.
 *
 * Merged inside the frame loop, not into the ref, because the host rewrites
 * `flattenRef.current` on every render — an override written to the ref would
 * survive or vanish depending on whether React happened to re-render, which is
 * a control that reports something other than what it did.
 */
type FlatOverride = Partial<FlatState>
let flatOverride: FlatOverride | null = null
const flatOverrideSubs = new Set<() => void>()
/**
 * Set the override and TELL REACT. Two consumers read the flatten state and
 * they are not the same kind of thing: the frame loop mutates a material every
 * tick, while the contact shadow is a rendered child whose prop only changes on
 * a render. A window global alone reached the first and silently missed the
 * second — which this file's own assertion caught, reporting the shadow channel
 * as inert when it was the instrument that could not see it.
 */
function setFlatOverride(o: FlatOverride | null) {
  if (process.env.NODE_ENV === "production") return
  flatOverride = o && typeof o === "object" ? o : null
  for (const f of flatOverrideSubs) f()
}
function readFlatOverride(): FlatOverride | null {
  if (process.env.NODE_ENV === "production") return null
  return flatOverride
}

/**
 * The fresnel rim's own strength, from Desk Doodles' `applyRimGlow`
 * (studio-rig.tsx:239 — `uRimStrength = 0.55`). Restated here rather than
 * exported from the ported file so that file stays byte-identical to its
 * origin; if it ever drifts, the rim will simply return to full strength at
 * `ink = 0`, which is the correct fallback.
 */
const RIM_BASE_STRENGTH = 0.55

/**
 * The same rim's FRESNEL EXPONENT (`studio-rig.tsx` — `uRimPower = 2.6`),
 * restated here for `RIM_BASE_STRENGTH`'s reason and driven for one that is
 * measured rather than inherited.
 *
 * `pow(1 - N·V, 2.6)` on a tube of radius ~11 screen px reaches half strength
 * only where `N·V < 0.23`, which is the outermost ~2 px of the silhouette —
 * inside the antialiasing ramp. Measured across one stroke on the settled
 * solid, the boundary reads `45.1 · 49.3 · 57.2 · 119.1 · 226.3 · 250`:
 * monotonic into paper, no local maximum, i.e. **no rim is visible anywhere**.
 * The exponent is the width dial and it had never been looked at; Desk Doodles'
 * own note rules out the strength dial (*"1.9 washed it grey"*), which is a
 * different failure and not this one.
 *
 * Kept as the FLOOR: at `lit: 0` this is what renders, byte for byte.
 */
const RIM_BASE_POWER = 2.6

/**
 * THE ARRIVAL'S LAW — what "the object's own light" is worth, as numbers.
 *
 * Each field is a destination reached at `lit: 1` and interpolated from the
 * ported floor at `lit: 0`, so the prior read is not merely reachable, it is
 * the identity element.
 */
export interface HeroLitLaw {
  /**
   * The fresnel exponent once the form is fully lit. LOWER IS WIDER — the band
   * moves off the antialiased boundary and onto the tube's own curvature, which
   * is where Desk Doodles' comment says the cue belongs (*"the silhouette + every
   * curvature edge"*).
   */
  rimPower: number
  /** Multiplier on `RIM_BASE_STRENGTH` once fully lit. */
  rimGain: number
  /** Multiplier on the material's own `envMapIntensity` once fully lit. */
  envGain: number
}

/**
 * THE PARKED PRIOR — the beat exactly as it rendered before this channel
 * existed. Every field is an identity, so `lit` at any value is a no-op under
 * it. This is `assert-hero-switch.mjs`'s negative control and it is a real
 * shippable read, not a straw man: it is what Sebs was looking at.
 */
export const HERO_LIT_PRIOR: HeroLitLaw = {
  rimPower: RIM_BASE_POWER,
  rimGain: 1,
  envGain: 1,
}

/**
 * THE SHIPPED ARRIVAL — and TWO OF ITS THREE DIALS SHIP AT THE PORT, because
 * they were measured and they do not work. That is the finding, not an
 * oversight, and it is written here so the next reader does not re-run the
 * experiment.
 *
 * Every number comes from sweeping ONE dial at a time on the real page and
 * measuring the settled solid's eroded interior against the flat mark's
 * (`_probe-lit-sweep.mjs`; arms and stills in
 * `docs/verification/switch-tone/sweep/` and `…/sweep2/`). The flat frame reads
 * **median 20.6 / sd 1.34 / ink 20437 on all fourteen arms, to the digit** —
 * which is the leak control: `lit` is 0 while the mark is a drawing, so any arm
 * that moved that frame would be one bleeding into gate 1.
 *
 *     arm (solid frame)          mean    sd    p05    med    p95   Δmed vs the drawing
 *     PRIOR                      23.5   6.36  13.6   23.6   34.9    +3.1
 *     rimGain 1.5                23.7   6.64  14.5   23.6   34.9    +3.1
 *     rimGain 2.2                23.7   6.28  14.6   23.6   34.8    +3.1
 *     rimPower 1.6               25.6   7.40  16.6   23.9   38.9    +3.4
 *     rimPower 1.15              29.4   9.48  19.7   26.7   47.9    +6.1
 *     envGain 1.8                31.4   7.88  19.7   31.1   46.1   +10.5
 *     envGain 3.0                42.1   9.91  27.6   41.9   61.3   +21.3
 *     envGain 3.6  <- SHIPPED    47.1  10.83  31.1   46.3   67.5   +25.8
 *     envGain 4.4                53.5  11.93  36.0   53.2   76.5   +32.6
 *
 * **`rimGain` moves the interior by 0.2 luma.** Desk Doodles had already ruled
 * that dial out from the other side (*"1.9 washed it grey"*); this is the same
 * conclusion reached by measurement rather than by memory, and it is why the
 * gain ships at 1.
 *
 * **`rimPower` moves the number and RUINS THE PICTURE, which is the one result
 * a statistic could not have given.** At 1.15 the interior median gains six
 * luma — and at 16× the stroke stops being round: the fresnel band spreads
 * across the whole tube, the dark underside disappears, and the form reads
 * FLATTER and hazier than the one it replaced, despite measuring brighter. A
 * fresnel term that covers the whole surface is a constant, not an edge. Read
 * `docs/verification/switch-tone/sweep/zoom/stroke16.png` before touching it —
 * this is exactly Desk Doodles' "washed it grey" failure reached through the
 * width dial instead of the strength dial, and the numbers say it is an
 * improvement. It is not.
 *
 * The rim's own contribution once the environment is up was checked with the
 * control that settles it — the same arm with the rim switched OFF entirely:
 * `envGain 3.6` reads mean 47.1 / rim footprint 4369 px against 46.5 / 3834 px
 * with no rim at all. **Half a luma.** So the rim is kept exactly as Desk
 * Doodles ported it, and the two dials stay reachable rather than removed, so
 * the negative result is re-runnable instead of remembered.
 *
 * ── WHY 3.6 AND NOT 3.0 OR 4.4. ──────────────────────────────────────────
 * The target is not invented here. `docs/research/online-reference-mechanics.md`
 * §9.1 measures eleven clips of exactly this move and reports that
 * flat-vs-dimensional separates at **interior values 0.7–2.7 against 45–63**.
 * Our drawing sits at 20.6 by construction (it is a real render, not an 8-bit
 * plate), and 3.6 puts the object at **46.3 median / 47.1 mean — the bottom of
 * that band** while its dark core is still 31.1, i.e. still ink. 4.4 reads 53.2
 * and is inside the band too, but at 16× its underside has lost the dark anchor
 * that makes it graphite rather than milk. 3.0 reads 41.9, under the band.
 *
 * And the ratified colour policy is checked rather than assumed
 * (`_probe-lit-hue.mjs`): the ban is broad warm-TAN bands, convicted at
 * `rgb(142,118,91)`, **Δr−b 50**. At `envGain 3.6` the brightest decile of the
 * form reads `rgb(78,68,57)`, **Δr−b 21.9** — against the drawing's own 8.0 and
 * the prior solid's 14.5. Warmer, because a warm graphite lit by a warm rig is
 * warmer; nowhere near a tan flood.
 */
export const HERO_LIT: HeroLitLaw = {
  rimPower: RIM_BASE_POWER,
  rimGain: 1.0,
  envGain: 3.6,
}

/**
 * DEV-ONLY ARM SELECT, the same shape as `__heroCarveLaw`. `"prior"` renders
 * the pre-arrival beat live so the A/B is a capture rather than a memory, and
 * an object literal drives an arbitrary point for the sweep. Production always
 * gets `HERO_LIT` — a lane cannot leave a probe value in a shipped build.
 */
export function readHeroLitLaw(): HeroLitLaw {
  if (process.env.NODE_ENV === "production") return HERO_LIT
  const w = globalThis as unknown as { __heroLitLaw?: unknown }
  const v = w.__heroLitLaw
  if (v === "prior") return HERO_LIT_PRIOR
  if (v && typeof v === "object") return { ...HERO_LIT, ...(v as Partial<HeroLitLaw>) }
  return HERO_LIT
}

/**
 * HAND THE SHINE BAND BACK when a fusion stops driving it.
 *
 * ── THE DEFECT, AND WHY IT WAS INVISIBLE ───────────────────────────────────
 * The old else branch restored the sweep's DIRECTION and nothing else, so
 * `uFsSweepAmt` kept whatever the last band-driving frame had left in it — a
 * bright band parked on the mark for as long as the user stayed on the next
 * fusion. `lib/style-fusion.ts:768` reports exactly that, and works around it
 * from its own side for CUSTOM fusions by emitting the shineBand link at
 * strength 0 rather than skipping it. The built-ins (ASCII Rubber is the one
 * that drives the band) had no such workaround.
 *
 * Measured on the real page rather than argued from the code, the band did NOT
 * survive — because the material-animation block writes `uFsSweepAmt = 0` on
 * every frame that is not a Shine Sweep, and it runs earlier in the same frame.
 * So the invariant was being held by the ORDER OF TWO BLOCKS that know nothing
 * about each other: move the fusion write above the material write, or give the
 * material block an early-out, and a parked band ships. That is the same class
 * as every other "correct code that rendered wrong" bug in this repo, running
 * in the opposite direction — wrong code that rendered right, which is worse,
 * because nothing can catch it.
 *
 * Every field the fusion branch writes is restored here, so the release is
 * complete rather than partial: strength, band centre, width and axis. The
 * values are `createSweepUniforms`' own defaults (lib/texture-shader.ts:186) —
 * `pos: -10` parks the band off-form, which is what "no band" means in a shader
 * that has no enable flag.
 *
 * `materialDriving` is not optional and not defensive. The material's own Shine
 * Sweep writes this frame's band twenty lines earlier and still owns it; a
 * blanket release on top of it would zero the band for exactly one frame — a
 * one-frame black flash at the instant the user switches fusion, which is the
 * kind of defect that only ever shows up in a film.
 */
function releaseFusionSweep(
  sw: SweepUniforms,
  materialDriving: boolean,
  law: SweepLaw = "release",
) {
  // Both parked arms restore the AXIS and nothing else — the literal pre-fix
  // branch. See `SweepLaw`.
  if (law !== "release") {
    sw.uFsSweepDirX.value = 0.87
    sw.uFsSweepDirY.value = 0.5
    return
  }
  if (materialDriving) return
  sw.uFsSweepAmt.value = 0
  sw.uFsSweepPos.value = -10
  sw.uFsSweepWidth.value = 0.3
  sw.uFsSweepDirX.value = 0.87
  sw.uFsSweepDirY.value = 0.5
  SWEEP_DEBUG.source = "none"
}

/**
 * THE PARKED PRIOR READS FOR THE SHINE BAND, and the negative control that
 * makes the fix's row able to FAIL.
 *
 * - `release`  ★ shipped. The else branch hands the whole band back.
 * - `prior`      the literal pre-fix branch: restore the AXIS only. Note that
 *                this arm still RENDERS CORRECTLY, because the material-
 *                animation block zeroes the strength earlier in the same frame.
 *                It is parked so that finding is reproducible rather than
 *                asserted — the assertion prints it.
 * - `hazard`     `prior`, plus the material block no longer zeroes. This is the
 *                same code one refactor away, and it is the negative control:
 *                on this arm a band from ASCII Rubber really does stay parked
 *                on the mark after the user switches fusion, so
 *                `assert-sweep-release.mjs` row 1 must go red.
 *
 * Dev-only, driven through `window.__fsSweepLaw` before navigation, the same
 * way `__viewport3dProjection` parks the perspective camera.
 */
export type SweepLaw = "release" | "prior" | "hazard"
function readSweepLaw(): SweepLaw {
  return readDevLaw("__fsSweepLaw", ["prior", "hazard"], "release")
}

/**
 * A PARKED PRIOR READ, driven from `window` before navigation.
 *
 * Three of these now exist (`__fsSweepLaw`, `__fsEmptyState`,
 * `__fsStillCompensate`) and each is the negative control for one assertion —
 * this repo has produced eleven instruments that reported green while measuring
 * nothing, and the defence is that every row has an arm it must go red on.
 * Production always gets the shipped read, so none of this can reach a user.
 */
function readDevLaw<T extends string>(key: string, parked: T[], shipped: T): T {
  if (process.env.NODE_ENV === "production") return shipped
  if (typeof window === "undefined") return shipped
  const v = (window as unknown as Record<string, unknown>)[key]
  return parked.includes(v as T) ? (v as T) : shipped
}

/**
 * F122 · POINT THE GL VIEWPORT AT THE DRAWING BUFFER. three 0.175's `setSize`
 * floors the buffer (`canvas.width = floor(w * pr)`) but rounds the viewport, so
 * a canvas 755.5 CSS px wide draws every frame into a 756 px viewport on a 755 px
 * buffer, stretched 1/755 in x, until something calls `setRenderTarget(null)`.
 * Call it right after every `setSize`. `window.__fsViewportSync = "off"` parks
 * main's rounding, the must-fail arm of `assert-resize-settles.mjs`.
 */
function syncViewportToBuffer(gl: THREE.WebGLRenderer) {
  if (readDevLaw("__fsViewportSync", ["off"], "on") === "off") return
  const pr = gl.getPixelRatio()
  gl.setViewport(0, 0, gl.domElement.width / pr, gl.domElement.height / pr)
}

/* ------------------------------------------------------------------ */
/*  K7's NEWS — the paper break, as a fragment discard                 */
/* ------------------------------------------------------------------ */

/**
 * HOW MANY JUNCTIONS THE SHADER CAN CARRY.
 *
 * The hero word has 22 measured junctions, 19 of which have an over/under to
 * show; this is that with headroom. It is a compile-time array bound rather
 * than a soft limit because a GLSL uniform array cannot be sized at runtime, so
 * the honest thing is to publish the overflow rather than to grow silently:
 * `window.__heroBreaks.truncated` carries it and
 * `scripts/verify/assert-hero-k7-news.mjs` fails on it.
 */
const JOINT_BREAK_MAX = 24

interface JointBreakUniforms {
  open: { value: number }
  count: { value: number }
  cull2: { value: number }
  band: { value: number }
  arc: { value: number }
  inv: { value: THREE.Matrix4 }
  data: { value: Float32Array }
}

/**
 * THE BREAK, AS A FRAGMENT DISCARD — chained onto the shared stroke material.
 *
 * It is `discard` and not a colour, an alpha or a second draw, and that is the
 * whole design (see `FlatState.jointBreak`): a value difference at a junction
 * breaks the beat's first gate, an absence does not. A discarded fragment shows
 * whatever is actually behind the mark, so the gap is the real paper rather
 * than a guess at its colour — which also means it cannot drift when the
 * register, the ground or the grid changes.
 *
 * ONE MATERIAL, AND THE SELECTIVITY IS GEOMETRIC. Every stroke shares
 * `liveMaterial`, and three uploads a shared material's uniforms ONCE per
 * material rather than once per mesh (`WebGLRenderer.setProgram` skips the
 * upload while `_currentMaterialId` is unchanged), so a per-mesh uniform swap
 * in `onBeforeRender` would silently do nothing. It is not needed: which stroke
 * a fragment belongs to is decided by DISTANCE to two centrelines, so the same
 * uniforms are correct for every mesh — and the same code therefore works for
 * Rod's per-stroke tubes, its cap and joint spheres, and Inflate's single
 * implicitly-fused surface, which has no per-stroke mesh to select at all.
 *
 * WORLD POSITION, NOT `position`. `applyStyleShader` already carries a
 * `vFsObjPos` varying, and reusing it would have been wrong: it is the mesh's
 * OWN object space, which for Rod's cap and joint spheres is a unit sphere at
 * the origin rather than the word's space. The break test runs in the flatten
 * group's local frame, so the fragment's world position is transformed back by
 * that group's inverse — which also means the breaks turn WITH the mark during
 * the return, because they are a property of the drawing and not of the screen.
 */
function applyJointBreak(
  mat: THREE.MeshPhysicalMaterial,
  onUniforms: (u: JointBreakUniforms) => void,
) {
  const prevCompile = mat.onBeforeCompile
  const prevKey = mat.customProgramCacheKey
  mat.onBeforeCompile = (shader, renderer) => {
    prevCompile?.call(mat, shader, renderer)

    const u: JointBreakUniforms = {
      open: { value: 0 },
      count: { value: 0 },
      cull2: { value: 0 },
      band: { value: 0 },
      arc: { value: 0 },
      inv: { value: new THREE.Matrix4() },
      data: { value: new Float32Array(JOINT_BREAK_MAX * 4 * 4) },
    }
    shader.uniforms.uFsBreakOpen = u.open
    shader.uniforms.uFsBreakCount = u.count
    shader.uniforms.uFsBreakCull2 = u.cull2
    shader.uniforms.uFsBreakBand = u.band
    shader.uniforms.uFsBreakArc = u.arc
    shader.uniforms.uFsBreakInv = u.inv
    shader.uniforms.uFsBreakData = u.data

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vFsBreakWorld;")
      // BEFORE <project_vertex>, because `transformed` is final by then and
      // this must be the same point the rasteriser interpolates.
      .replace(
        "#include <project_vertex>",
        "vFsBreakWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#include <project_vertex>",
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        [
          "#include <common>",
          `#define FS_BREAK_MAX ${JOINT_BREAK_MAX}`,
          "varying vec3 vFsBreakWorld;",
          "uniform float uFsBreakOpen;",
          "uniform float uFsBreakCount;",
          "uniform float uFsBreakCull2;",
          "uniform float uFsBreakBand;",
          "uniform float uFsBreakArc;",
          "uniform mat4 uFsBreakInv;",
          // 4 vec4 per junction: (u0,u1) (u2,o0) (o1,o2) all xy pairs in the
          // flatten group's local frame, then (keepUnder, keepOver, 0, 0) —
          // the two radii, which are PER JUNCTION on a carved mark because the
          // nib's half-width is a function of travel direction.
          "uniform vec4 uFsBreakData[FS_BREAK_MAX * 4];",
          "float fsBreakSeg(vec2 q, vec2 a, vec2 b) {",
          "  vec2 ab = b - a;",
          "  float dd = max(dot(ab, ab), 1e-12);",
          "  float t = clamp(dot(q - a, ab) / dd, 0.0, 1.0);",
          "  return length(q - (a + t * ab));",
          "}",
          // Nearest point on a 2-segment centreline, plus its distance and its
          // ARC distance from the middle sample: vec4(px, py, dist, arc).
          "vec4 fsBreakNear(vec2 q, vec2 a, vec2 b, vec2 c) {",
          "  vec2 ab = b - a;",
          "  float t0 = clamp(dot(q - a, ab) / max(dot(ab, ab), 1e-12), 0.0, 1.0);",
          "  vec2 p0 = a + t0 * ab;",
          "  vec2 bc = c - b;",
          "  float t1 = clamp(dot(q - b, bc) / max(dot(bc, bc), 1e-12), 0.0, 1.0);",
          "  vec2 p1 = b + t1 * bc;",
          "  float d0 = length(q - p0);",
          "  float d1 = length(q - p1);",
          "  if (d0 <= d1) return vec4(p0, d0, (1.0 - t0) * length(ab));",
          "  return vec4(p1, d1, t1 * length(bc));",
          "}",
        ].join("\n"),
      )
      /* FIRST THING IN main(), before any lighting work is done on a fragment
       * that is about to be thrown away.
       *
       * ⚠ THE `discard` IS OUTSIDE THE LOOP, AND THAT IS NOT STYLE. Written the
       * obvious way — `discard` as the loop body's last statement — this HANGS
       * Chrome's Metal backend: the page keeps ticking (rAF 121/s, JS
       * responsive, zero console errors, `__heroBreaks` correct) and stops
       * presenting frames, so a screenshot times out at 6 s and the compositor
       * eventually takes the tab down. Bisected first-hand on the real page:
       * the same loop with `break` in place of `discard` renders in 46 ms; the
       * same `discard` hoisted out of the loop behind a flag renders in 60 ms.
       * A `discard` inside a dynamically-bounded loop is the trigger. This is
       * exactly the class where "it looked fine in the source" costs an hour,
       * so it is written down rather than tidied away. */
      .replace(
        "#include <clipping_planes_fragment>",
        [
          "#include <clipping_planes_fragment>",
          /* COVERAGE, NOT A BOOLEAN — and the reason is the eye pass.
           *
           * A plain `discard` is all-or-nothing per fragment, so the break's
           * edges come out BINARY while the mark's own silhouette is
           * multisampled. Photographed at 6x on `zoom-open.png`: the cut edges
           * step in whole pixels beside a silhouette that ramps. A drawn lift
           * whose edges are harder than the drawing's own edges reads as a cut,
           * which is the exact "jaggedy" tell.
           *
           * So the cut carries a signed distance to its own boundary, converted
           * to pixels with the screen derivative of the local frame, and the
           * material runs `alphaToCoverage` — the SAME mechanism the silhouette
           * uses. Coverage is a sample MASK, not a blend: an interior ink pixel
           * is still exactly one value, so gate 1 is untouched and the only
           * partial pixels are boundary pixels, which gate 1 erodes away
           * exactly as it already does for the outline. */
          "float fsCov = 1.0;",
          "if (uFsBreakOpen > 0.0 && uFsBreakCount > 0.5) {",
          "  vec2 fsQ = (uFsBreakInv * vec4(vFsBreakWorld, 1.0)).xy;",
          "  float fsIn = -1e9;",
          "  for (int fsI = 0; fsI < FS_BREAK_MAX; fsI++) {",
          "    if (float(fsI) >= uFsBreakCount) break;",
          // Indices are written inline rather than through a local so they stay
          // constant-index-expressions, which GLSL ES 1.00 requires of a
          // fragment shader indexing a uniform array.
          "    vec4 fsA = uFsBreakData[fsI * 4];",
          "    vec4 fsB = uFsBreakData[fsI * 4 + 1];",
          "    vec4 fsC = uFsBreakData[fsI * 4 + 2];",
          "    vec4 fsK = uFsBreakData[fsI * 4 + 3];",
          "    vec2 fsD = fsQ - fsA.zw;",
          "    if (dot(fsD, fsD) > uFsBreakCull2) continue;",
          // The nearest point on the UNDER stroke. Everything else is decided
          // there, not at the fragment — see `buildJointBreaks`'s law.
          "    vec4 fsN = fsBreakNear(fsQ, fsA.xy, fsA.zw, fsB.xy);",
          "    float fsOver = min(fsBreakSeg(fsN.xy, fsB.zw, fsC.xy), fsBreakSeg(fsN.xy, fsC.xy, fsC.zw));",
          // Positive INSIDE the cut. The four clauses of the law, as one
          // signed distance, so the boundary can be antialiased.
          "    float fsS = min(min(fsK.x - fsN.z, uFsBreakArc - fsN.w),",
          "                    min(fsOver - fsK.y, fsK.y + uFsBreakBand - fsOver));",
          "    fsIn = max(fsIn, fsS);",
          "  }",
          // One local unit in pixels. Read OUTSIDE the loop and under a uniform
          // branch, so the derivative is taken in uniform control flow.
          "  float fsPx = max(length(dFdx(fsQ)), length(dFdy(fsQ)));",
          "  fsCov = clamp(0.5 - fsIn / max(fsPx, 1e-9), 0.0, 1.0);",
          "}",
          // Fully cut: nothing to shade. Outside the loop — see the note above.
          "if (fsCov <= 0.0) discard;",
        ].join("\n"),
      )
      /* THE COVERAGE REACHES THE FRAMEBUFFER AS ALPHA, and `alphaToCoverage`
       * turns it into a sample mask. `<alphatest_fragment>` is the last chunk
       * that touches `diffuseColor.a` before lighting, so modulating there is
       * what `<opaque_fragment>` ends up writing. */
      .replace(
        "#include <alphatest_fragment>",
        "#include <alphatest_fragment>\ndiffuseColor.a *= fsCov;",
      )

    onUniforms(u)
  }
  // three's default program cache key does not include onBeforeCompile, so a
  // material carrying injected code has to say so or it can be handed a program
  // compiled without it. Chained, never replaced — `applyRimGlow` sets one too.
  mat.customProgramCacheKey = () =>
    (prevKey ? prevKey.call(mat) + "|" : "") + `fs-jointbreak-v2-${JOINT_BREAK_MAX}`
}

/* ------------------------------------------------------------------ */
/*  THE PEN CARVE — the flat state gets the PEN'S outline, not the tube */
/* ------------------------------------------------------------------ */

/**
 * A 1x1 stand-in bound to `uFsPenField` from the moment the program compiles.
 *
 * An unbound sampler is not free: WebGL warns, and on some drivers it samples
 * whatever texture unit 0 happens to hold. The value is far outside both
 * outlines, so even if it were read (it cannot be — the fetch is behind
 * `uFsPenCarve > 0.0`) it removes nothing.
 */
const PEN_FIELD_FALLBACK = (() => {
  const t = new THREE.DataTexture(
    new Float32Array([1e6, 1e6]),
    1,
    1,
    THREE.RGFormat,
    THREE.FloatType,
  )
  t.needsUpdate = true
  return t
})()

/* ══════════════════════════════════════════════════════════════════════════
 * THE ENVELOPE, AND THE BUG IT CLOSES — measured 2026-08-02.
 *
 * Sebs, with a screenshot of the FINISHED flat mark: *"there random white blank
 * spots the 3d text is fully distorted worse when u type ur own text like
 * someone ran a eraser all over it."* And the day before, of the draw-in:
 * *"THE 2D DRAWIN ANIMTION LEAVES BLANCK SPORTS."* Both are this, and neither is
 * a reveal defect: the holes are in a static, fully-drawn, held frame, on BOTH
 * engines.
 *
 * ── WHAT `PEN_FIELD_TUBE_SLACK` CLAIMS, AND WHAT IT IS ─────────────────────
 * `lib/flat-ink.ts` bakes the carve's second channel as `bestD - 1.35 R` and
 * states the contract that makes the whole carve legal:
 *
 *     "at `penCarve = 0` it must remove NOTHING … a field baked at exactly R
 *      would bite into the form the moment it was switched on at zero strength.
 *      1.35 clears the measured worst case with room"
 *
 * It does not. Driven on the real page through `setFlatten({ penCarve: … })`,
 * with the playhead parked on the finished word (`_probe-carve-sweep-live.mjs`),
 * the arm at **0.001** — the tube channel with essentially none of the pen in
 * it — reads:
 *
 *     engine / text                 ink kept   components   loose specks
 *     free-stroke, traced word       61.7 %      7 -> 16          5
 *     desk-doodles, traced word      62.5 %      8 -> 21          9
 *     free-stroke, "Hello"           26.2 %      4 -> 14          3
 *
 * A channel whose job is to remove nothing removes 38 % of the mark, and takes
 * it from seven connected components to sixteen. That is the eraser.
 *
 * ── WHY IT IS AN ENVELOPE FAILURE AND NOT A REGISTRATION ONE ───────────────
 * Three measurements, each ruling something out:
 *
 *  1. The bake matches its own closed form (`_probe-carve-law.mjs`): walked
 *     along every one of 1043 centreline perpendiculars, the carved half-width
 *     never falls below 7.75 stroke units against a nominal R of 11.29, and the
 *     signed distance AT the centreline is negative on 1043 of 1043 samples. The
 *     field cannot delete anything. So the field is not corrupt.
 *  2. The field is registered to the geometry EXACTLY: the box's centre in the
 *     flatten group's local frame is (0.284525, 1.260732) and the form's own
 *     bounds centre is (0.284525, 1.260732) — six decimals, both axes
 *     (`_probe-carve-bounds.mjs`). So it is not displaced.
 *  3. The removed pixels sit as DEEP inside the mark as the kept ones —
 *     median depth 5.10 px removed against 5.83 px kept, p95 10.82 against
 *     11.05 (`_probe-carve-erosion.mjs`). A too-small envelope that merely
 *     trimmed the OUTLINE would put every removed pixel at the shallow end.
 *
 * What is left is the one thing nothing checked: **the mesh is fatter than the
 * envelope.** `_probe-carve-inradius.mjs` reads it off the sweep's own arms,
 * with the carve-1.000 arm as the ruler (the pen outline's semi-major axis is
 * pinned to R by construction, so the largest disc inside that mask IS R) and
 * the carve-0.001 arm as the calibration (it must read 1.35 R, and reads
 * 1.33-1.38 R):
 *
 *     arm                        R      mesh max half-width    slack NEEDED
 *     free-stroke, traced     9.00 px        18.00 px             2.00 R
 *     desk-doodles, traced    9.00 px        14.32 px             1.59 R
 *     free-stroke, "Hello"    8.94 px        15.81 px             1.77 R
 *
 * The implicit fusion's blobs at crossings and joins run to twice the nib
 * radius. 1.35 R cuts through the middle of every one of them — which is why
 * the holes land inside letters rather than on their edges, and why the `k`, the
 * `oo` and the `D`'s bowl are the parts that come apart.
 *
 * The shipped comment's own arithmetic gives it away: it quotes the worst case
 * as **"1.80x at the fattest fusion bulge"** and then sets the constant to 1.35,
 * BELOW its own stated worst case, on the reasoning that "those bulges are at
 * junctions, where the nearest-centreline distance is shared between two strokes
 * and the field is correspondingly generous already". That reasoning is
 * backwards: at a junction bulge the surface is FURTHER from every centreline,
 * not nearer, so `bestD` is larger there, not smaller.
 *
 * ⚠ ── EVERY NUMBER IN THE THREE PARAGRAPHS ABOVE WAS READ OFF A BROKEN FIELD.
 * They are kept because they are the reason this constant went to 2.60, and
 * because the correction is only legible against them. The mesh is NOT fatter
 * than a 1.35 R envelope by anything like 2.00 R: the GL storage was allocated
 * at 1192x324 while the field written into it was 1152x294, so every lookup
 * scanned the wrong rectangle and the mark was carved by a stretched copy of
 * its own outline. See the block at `setFieldRealloc`, and
 * `_probe-carve-gpu-readback.mjs`, which reads the shader's own fetch back and
 * measures the error at 9.48 stroke units mean / 41.2 max before the fix and
 * 0.074 / 1.20 after. The 61.7 %-of-ink-at-carve-0.001 reading, the 7 -> 16
 * components and the five loose specks are all that mismatch, not the envelope.
 *
 * ── THE NUMBER, RE-DERIVED ON A FIELD THAT REGISTERS ───────────────────────
 * 1.60 R, and it is a TRADE between two gates that pull opposite ways, decided
 * by measurement rather than by picking the safer-sounding side.
 *
 * `_probe-carve-envelope-recal.mjs` sweeps envelope x carve in ONE page session
 * (the envelope is a uniform, so no arm differs by anything but the number
 * under test), on three states. Ink kept at carve 0.001 — the first amplitude
 * the shader evaluates at all, where the mix IS the envelope:
 *
 *     envelope   free-stroke w0/clean   desk-doodles w0/clean   page defaults
 *       1.35 R          98.09 %                99.63 %             99.14 %
 *       1.45 R          99.59 %                99.85 %             99.97 %
 *       1.55 R          99.97 %                99.93 %            100.00 %
 *       1.60 R          99.99 %                99.94 %            100.00 %
 *       1.65 R         100.00 %                99.98 %            100.00 %
 *       1.75 R         100.00 %               100.00 %            100.00 %
 *       2.60 R         100.00 %               100.00 %            100.00 %
 *
 * Component count is 7 (free-stroke) / 8 (desk-doodles) / 5 (defaults) at EVERY
 * envelope and EVERY amplitude from 0 to 0.85, with 0 specks throughout. The
 * mark thins; it never comes apart. That is the eraser gone, not the envelope.
 *
 * ── WHY NOT 1.75, WHICH REMOVES LITERALLY NOTHING ─────────────────────────
 * Because the envelope is not free, and the bill lands on the one channel Sebs
 * keeps asking for: *"the 2D and 3D transformation is way too subtle."*
 * `assert-flat-silhouette.mjs` measures the flat state against the solid as an
 * earth-mover distance in stroke radii, with a value-only control as its floor:
 *
 *     envelope   flat-vs-solid silhouette   median half-width gain   the gate
 *       1.35 R          23.61 %                    (both rows pass)   PASS
 *       1.60 R          17.86 %                    (both rows pass)   PASS
 *       1.65 R          16.07 %                    14.02 %            FAIL
 *       1.75 R          13.43 %                    14.02 %            FAIL
 *       1.90 R          10.03 %                     7.50 %            FAIL
 *       2.60 R           1.65 %                     ---               FAIL
 *
 * At 2.60 the flat state and the solid differ by 1.65 % of a stroke radius —
 * BELOW the 4.23 % a value-only change measures — i.e. the carve had stopped
 * contributing a silhouette at all. 1.60 R is the widest envelope that still
 * clears both rows.
 *
 * ── WHAT 1.60 ACTUALLY COSTS, IN PIXELS ───────────────────────────────────
 * At carve 0.001: 4 px of 36 988 (free-stroke), 16 px of 25 986 (desk doodles),
 * 0 px of 30 000 (defaults). Zero specks, zero component change. And it is NOT
 * the settled solid: that renders at penCarve EXACTLY 0, where the fragment
 * short-circuits on `if (fsPenAmt > 0.0)` and no fetch, no mix and no test
 * happen — proved on pixels, not argued, at `assert-hero-carve.mjs`'s
 * "49 of 49 carve-0 frames identical, worst channel delta 0.0 luma".
 *
 * ── AND THE CLOSED FORM AGREES ────────────────────────────────────────────
 * Explainer 19 puts the smooth union's seam at `sqrt(2)(r + k/6)`. The SHIPPED
 * register's `bulgeScale` is 1.07 (lib/flat-ink.ts, and `crossSectionBulge =
 * 0.07 + puffEased * 0.21` in lib/geometry-engines.ts), so the worst surface
 * point is `sqrt(2) x 1.07 = 1.513 R` and 1.60 clears it with 6 % of margin.
 * The 1.81 R figure quoted below uses `crossSectionBulge` at the TOP of its
 * dial range (0.28), which is not where either register ships. A register
 * driven to full puff would nibble ~0.1 % of the ink on the first frame of the
 * emerge — invisible, and the number to revisit if the puff default moves.
 *
 * ── WHY IT IS A UNIFORM AND NOT A REBAKE ───────────────────────────────────
 * The channel is `min(bestD - 1.35 R, FAR)`, so a wider envelope is that same
 * number minus a constant — exact, with no bake to redo. Rebaking would grow the
 * field's box AND its search cell (`CELL = max(2, R * slack * 2)`), and the
 * search is quadratic in the cell, on a bake already measured at 172-212 ms.
 * Sebs, the same day: *"animation also still lags a lot."* This costs zero.
 *
 * The `FAR` clamp does not interfere: the channel saturates only past
 * `bestD = 4.2 R`, which is outside the new envelope as well as the old, so a
 * fragment out there is discarded either way and correctly.
 *
 * ── NOTHING IS DELETED ─────────────────────────────────────────────────────
 * Both priors stay reachable at runtime through
 * `window.__captureHarness.setCarveEnvelope(r)`:
 *   1.35 — `PEN_CARVE_ENVELOPE_PRIOR_R`, the original bake's own slack, and the
 *          arm every frame in `docs/verification/` older than 2026-08-02 was
 *          rendered under.
 *   2.60 — `PEN_CARVE_ENVELOPE_WIDE_R`, the value derived against the broken
 *          field. Kept because it is the arm the day's earlier captures used,
 *          and because a number that was wrong for a reason is worth being able
 *          to re-render.
 * ════════════════════════════════════════════════════════════════════════ */
export const PEN_CARVE_ENVELOPE_R = 1.6
/** The original bake's own slack, kept reachable as a negative control. */
export const PEN_CARVE_ENVELOPE_PRIOR_R = PEN_FIELD_TUBE_SLACK
/** The over-wide value derived against the misregistered field — see above. */
export const PEN_CARVE_ENVELOPE_WIDE_R = 2.6

let liveCarveEnvelopeR = PEN_CARVE_ENVELOPE_R
/**
 * Drive the envelope, in nib radii. DEV ONLY, and it exists so the parked prior
 * is a render rather than a memory: a gate that cannot reproduce the defect it
 * claims to have fixed is the class this repo has now caught twelve times.
 * Returns false on a value that is not a finite positive number, so a sweep
 * cannot silently measure the same arm twice.
 */
function setCarveEnvelopeR(v: number): boolean {
  if (process.env.NODE_ENV === "production") return false
  if (!Number.isFinite(v) || v <= 0) return false
  liveCarveEnvelopeR = v
  return true
}
function readCarveEnvelopeR(): number {
  return process.env.NODE_ENV === "production" ? PEN_CARVE_ENVELOPE_R : liveCarveEnvelopeR
}

/* ════════════════════════════════════════════════════════════════════════
 * THE FIELD'S GL STORAGE IS IMMUTABLE, AND THAT IS THE ERASER.
 *
 * ── THE DEFECT ─────────────────────────────────────────────────────────────
 * Sebs, for days: *"random white blank spots… like someone ran a eraser all
 * over it."* The finished, static flat mark renders with chunks missing, on
 * BOTH engines, at BREATH, after the draw is complete.
 *
 * ── WHAT WAS MEASURED, NOT ARGUED ─────────────────────────────────────────
 * `_probe-carve-gpu-readback.mjs` packs the carve shader's own intermediates
 * into the framebuffer and reads them back (`PenCarveUniforms.dbg`), then
 * evaluates the SAME arithmetic on the CPU at the uv the GPU says it used:
 *
 *   fsPpx  (the antialias derivative)  1.542 .. 1.549 stroke units/px, p05→p99
 *          — flat across the whole mark, so the coverage ramp is NOT it
 *   fsPf   (the field fetch)  mean |err| 9.48 stroke units on the pen channel,
 *          max 41.2 — against a nib radius R of 11.29
 *   the CPU law keeps 98.9 % of those fragments, the GPU keeps 57.9 %
 *
 * The shader is reading a DIFFERENT FIELD from the one the CPU baked. Both
 * channels are off by nearly the same amount at each fragment, which is the
 * signature of a lookup landing in the wrong place rather than of bad data.
 *
 * ── WHY ───────────────────────────────────────────────────────────────────
 * three r175 `WebGLTextures.uploadTexture`: `useTexStorage` is unconditionally
 * true for a `DataTexture`, and `allocateMemory` is true only on the FIRST
 * upload. So the first upload calls `texStorage2D(TEXTURE_2D, 1, RG32F, W0, H0)`
 * — IMMUTABLE storage — and every later one is a bare
 * `texSubImage2D(..., 0, 0, W1, H1, ...)`. Re-bake the field at any other size
 * and the sampler still spans W0 x H0: the new outline is written into a corner
 * of the old allocation and `fsPuv` scans the wrong rectangle. The mark is then
 * carved by a stretched, offset copy of its own outline, which removes interior
 * chunks and keeps exterior ones — exactly the picture.
 *
 * The field is re-baked on every wobble nudge, every endpoint change, every
 * engine switch and every canvas resize (`syncPenField`'s `sig`), and the box
 * is padded by `R * (slack + 1)` off the stroke EXTENTS, so the size moves
 * whenever the strokes do.
 *
 * ── THE COMMENT THAT ARGUED FOR IT ────────────────────────────────────────
 * `applyPenField` used to say, in defence of not disposing:
 *   *"A texture has no such list — `WebGLTextures` calls `texImage2D` on the
 *    SAME `__webglTexture` name whenever `source.needsUpdate` is set, which
 *    re-specifies the whole level and frees the old storage even when the
 *    dimensions change."*
 * That was true before `texStorage2D` landed and is false in r175. It is left
 * quoted here rather than deleted because it is the reason the defect survived.
 *
 * ── THE FIX, AND THE PARKED PRIOR ─────────────────────────────────────────
 * Reuse the texture object while the size is unchanged — that is still the
 * fast path and still what makes a re-bake reach the screen with React never
 * involved — and DISPOSE + rebuild only when the size actually moves, which is
 * the one case the immutable allocation cannot carry. `setFieldRealloc(false)`
 * parks the prior so the eraser is reproducible as a render.
 * ════════════════════════════════════════════════════════════════════════ */
let liveFieldRealloc = true
function setFieldRealloc(on: boolean): boolean {
  if (process.env.NODE_ENV === "production") return false
  liveFieldRealloc = !!on
  return true
}
function readFieldRealloc(): boolean {
  return process.env.NODE_ENV === "production" ? true : liveFieldRealloc
}

/* DEV-ONLY CARVE INSTRUMENTATION. Both are 0 in production and 0 by default in
 * dev, so every capture in `docs/verification/` is unchanged unless a probe
 * asks. See `PenCarveUniforms.dbg` / `.hard` for what each one does. */
let liveCarveDebug = 0
let liveCarveHard = 0
function setCarveDebug(v: number): boolean {
  if (process.env.NODE_ENV === "production") return false
  if (!Number.isFinite(v) || v < 0) return false
  liveCarveDebug = v
  return true
}
function setCarveHard(on: boolean): boolean {
  if (process.env.NODE_ENV === "production") return false
  liveCarveHard = on ? 1 : 0
  return true
}

interface PenCarveUniforms {
  carve: { value: number }
  field: { value: THREE.Texture | null }
  /** (localX at stroke minX, localY at stroke minY, 1/localW, 1/localH). */
  box: { value: THREE.Vector4 }
  /** World → the flatten group's local frame. The SAME matrix the break uses. */
  inv: { value: THREE.Matrix4 }
  /** Local units per stroke unit — the field is baked in stroke units and the
   *  screen derivative below is taken in local units. */
  units: { value: number }
  /**
   * HOW FAR THE BAKED ENVELOPE IS PUSHED OUT, in STROKE units — the block above.
   * `(envelopeR - PEN_FIELD_TUBE_SLACK) * R`. 0 reproduces the shipped bake
   * exactly, which is what makes the prior a render rather than an argument.
   */
  slack: { value: number }
  /**
   * DEV-ONLY READBACK. 0 = shipped. >0 replaces `gl_FragColor` with a 16-bit
   * packing of ONE of the carve's own intermediates, so the shader's arithmetic
   * can be read off the GPU and compared with the same arithmetic on the CPU.
   * The contradiction this exists to settle: `_probe-carve-render.mjs`
   * rasterises `mix(envelope, pen, c) <= 0` off the real bake and reads a solid
   * word at carve 0.700 while the GPU renders fragments. Nothing short of
   * reading the GPU's own numbers can say which term differs.
   */
  dbg: { value: number }
  /**
   * DEV-ONLY. 1 swaps the antialiased coverage ramp for the hard sign test the
   * CPU probe uses (`fsSd <= 0`). It is the OFAT arm that separates "the field
   * says the wrong thing here" from "the coverage law turns a right answer into
   * a hole", and it is the only difference between the two rasterisations.
   */
  hard: { value: number }
  /**
   * WHICH DIVISOR SIZES THE COVERAGE RAMP. 1 = `fwidth(sd)`, the shipped value;
   * 0 = the parked prior, the screen size of one LOCAL UNIT. See
   * `PEN_CARVE_AA_FWIDTH` for the measurement and for the frame it closes.
   */
  aa: { value: number }
}

/* ══════════════════════════════════════════════════════════════════════════
 * THE CARVE'S ANTIALIASING DIVISOR — and it is the SAME correction the pen TIP
 * already shipped, one block down, on the same material, in the same fragment.
 *
 * ── THE FRAME ──────────────────────────────────────────────────────────────
 * Found by the letter-by-letter lane, 2026-08-04: at **7.36 s** of the
 * `letterByLetter` film the `s` **stipples WHITE for one frame** at grazing
 * angle. Localised in the model, not guessed — `lib/hero-motion.ts` sampled at
 * 30 fps over the whole 12.3667 s film reports exactly eight frames in which any
 * letter sits inside the carve fade's band, and the one at 7.40 s is
 *
 *     t 7.400   letter 2   yaw 67.62°   |cos yaw| 0.3808   flat 1
 *
 * which puts `smoothstep(0.28, 0.42, 0.3808)` at 0.809 and the carve amount at
 * `0.3808 × 0.809 = 0.308` — a PARTIAL mix, in the middle of the fade the O5
 * lane added to stop precisely this.
 *
 * ── WHY THE FADE COULD NOT HAVE CLOSED IT, WHICH IS WHY IT IS NOT WIDENED ──
 * The fade reduces the carve AMOUNT. The stipple is not caused by the amount.
 * It is caused by the RAMP WIDTH:
 *
 *     fsPpx      = max(length(dFdx(fsPq)), length(dFdy(fsPq)))
 *     fsPenCov   = clamp(0.5 - fsSd / fsPpx, 0, 1)
 *
 * `fsPpx` is *the screen size of one local unit* — how far the FIELD's parameter
 * travels across one pixel. At 67.6° of yaw the visible surface is the tube's
 * side wall, nearly edge-on, so one pixel spans an enormous distance along the
 * foreshortened axis and `max` picks exactly that axis. The ramp is then metres
 * wide in field terms, **the whole visible letter lands inside it**, every
 * fragment gets a fractional alpha, and `alphaToCoverage` renders a fractional
 * alpha as a SAMPLE MASK. A sample mask over a whole letter is a stipple.
 *
 * Widening `smoothstep` would move the band, not remove it — and it would cost
 * another slice of the ~0.4 px of sub-pixel silhouette the fade already gives
 * up. The band is not the defect; the divisor is.
 *
 * ── AND THE REPO ALREADY SOLVED THIS, ON THE TIP, AND DID NOT CARRY IT OVER ─
 * `PEN_TIP_AA_FWIDTH` (below) is the identical correction with the identical
 * reasoning — *"`fwidth(sd)` is the gradient the fragment actually has, so it is
 * one pixel for every shape at once"* — shipped, measured, with its prior parked
 * on a dial. The carve was left on the old divisor. This is that fix, one block
 * over, ported rather than re-derived.
 *
 * `sd / fwidth(sd)` is in PIXELS by construction whatever units `sd` carries,
 * because `fwidth` differentiates `sd` ITSELF rather than the parameter it is a
 * function of. Where the boundary runs along the foreshortened direction, `sd`
 * barely changes across a pixel, the divisor stays small, and only fragments
 * genuinely within a pixel of the edge come out fractional.
 *
 * The prior stays reachable — `__captureHarness.setCarveAA(false)` — because a
 * fix whose defect cannot be re-rendered is a claim, not a result.
 * ══════════════════════════════════════════════════════════════════════════ */
export const PEN_CARVE_AA_FWIDTH = true
let liveCarveAA = PEN_CARVE_AA_FWIDTH
function setCarveAA(on: boolean): boolean {
  if (process.env.NODE_ENV === "production") return false
  liveCarveAA = !!on
  return true
}
function readCarveAA(): boolean {
  return process.env.NODE_ENV === "production" ? PEN_CARVE_AA_FWIDTH : liveCarveAA
}

/**
 * THE FLAT STATE'S SILHOUETTE, AS A FRAGMENT DISCARD.
 *
 * ── THE PROBLEM IT SOLVES, MEASURED ────────────────────────────────────────
 * Sebs: *"the 2D and 3D transformation is way too subtle."* He is right, and
 * `scripts/verify/_probe-carve-preview.mjs` says by how much: across the whole
 * beat the flat state and the settled solid differ on the SILHOUETTE by 4.09 %
 * of a stroke radius — and a value-only control measures the whole of that
 * 4.09 %, i.e. the shipped beat's silhouette change is ZERO and the number is
 * the luminance threshold moving under the lighting. The mark flattens in VALUE
 * and never in SHAPE. Carving the pen's real outline out of the tube takes it
 * to 23.10 %.
 *
 * ── WHY IT IS AN OCCLUSION, NOT A SECOND MESH AND NOT A SHADING ───────────
 * Identical reasoning to `FlatState.jointBreak`, and it is the whole reason
 * this is expressible at all. Gate 1 of the beat is that a flat drawn mark is
 * ONE VALUE inside a hard silhouette (`assert-hero-transition.mjs`, flat ink
 * SD < 1, non-negotiable). Removing coverage leaves every surviving ink pixel
 * at exactly the one value; darkening or fading the edge would not. And because
 * the pen outline is a strict SUBSET of the tube envelope by construction
 * (`buildPenField`'s two channels, the semi-major axis pinned to R), the
 * silhouette can only ever SHRINK as the carve rises — subtractive at every
 * intermediate value, not just at the two ends.
 *
 * ── ONE FETCH AND NO LOOP, AND THAT IS LOAD-BEARING ───────────────────────
 * `applyJointBreak` can afford a per-fragment loop because twenty-four
 * junctions is small. The pen's outline is a property of every point of every
 * stroke — 22 polylines, ~1078 samples — so it is baked on the CPU into a
 * two-channel field and the shader does ONE `texture2D`. That also keeps this
 * injection clear of the hazard documented at `applyJointBreak`'s own
 * `⚠ THE discard IS OUTSIDE THE LOOP` note: a `discard` inside a
 * dynamically-bounded loop HANGS Chrome's Metal backend, silently, with rAF
 * still ticking. There is no loop here to hoist it out of.
 *
 * The law and the bake live in `lib/flat-ink.ts` beside `buildPenField`, which
 * also carries the contract this implementation is written against.
 */
function applyPenCarve(
  mat: THREE.MeshPhysicalMaterial,
  onUniforms: (u: PenCarveUniforms) => void,
) {
  const prevCompile = mat.onBeforeCompile
  const prevKey = mat.customProgramCacheKey
  mat.onBeforeCompile = (shader, renderer) => {
    prevCompile?.call(mat, shader, renderer)

    const u: PenCarveUniforms = {
      carve: { value: 0 },
      field: { value: PEN_FIELD_FALLBACK as THREE.Texture },
      box: { value: new THREE.Vector4(0, 0, 1, 1) },
      inv: { value: new THREE.Matrix4() },
      units: { value: 1 },
      slack: { value: 0 },
      dbg: { value: 0 },
      hard: { value: 0 },
      aa: { value: PEN_CARVE_AA_FWIDTH ? 1 : 0 },
    }
    shader.uniforms.uFsPenCarve = u.carve
    shader.uniforms.uFsPenField = u.field
    shader.uniforms.uFsPenBox = u.box
    shader.uniforms.uFsPenInv = u.inv
    shader.uniforms.uFsPenUnits = u.units
    shader.uniforms.uFsPenSlack = u.slack
    shader.uniforms.uFsPenDbg = u.dbg
    shader.uniforms.uFsPenHard = u.hard
    shader.uniforms.uFsPenAA = u.aa

    /* `vFsBreakWorld` IS REUSED, NOT RE-DECLARED. `applyJointBreak` runs first
     * on this material and already carries the varying; declaring it twice is a
     * GLSL redefinition error, and computing a second identical one would be a
     * second source of truth for one position.
     *
     * ⚠ The guard is the JS `includes()` test on the next line, NOT a `#ifndef`.
     * This comment used to say "the guard is the `#ifndef` below" — there is no
     * preprocessor guard anywhere in this file, and a reader who went looking
     * for one would conclude the injection was unguarded and add a second
     * declaration. GLSL ES 1.00 has `#ifndef`, so the claim is plausible enough
     * to act on, which is what makes it worth correcting rather than deleting.
     * The behaviour it describes is real: this injection is still correct if the
     * break is ever removed, because the test is on the shader source. */
    if (!shader.vertexShader.includes("vFsBreakWorld")) {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vFsBreakWorld;")
        .replace(
          "#include <project_vertex>",
          "vFsBreakWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#include <project_vertex>",
        )
    }
    const needsVarying = !shader.fragmentShader.includes("varying vec3 vFsBreakWorld;")

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        [
          "#include <common>",
          ...(needsVarying ? ["varying vec3 vFsBreakWorld;"] : []),
          "uniform float uFsPenCarve;",
          "uniform sampler2D uFsPenField;",
          "uniform vec4 uFsPenBox;",
          "uniform mat4 uFsPenInv;",
          "uniform float uFsPenUnits;",
          "uniform float uFsPenSlack;",
          "uniform float uFsPenDbg;",
          "uniform float uFsPenHard;",
          "uniform float uFsPenAA;",
          /* HOW MUCH CARVE THIS FRAGMENT GETS — one number for the mark, unless
           * a per-letter cascade is running. O5's, merged on top of the envelope
           * work: the carve IS the flat state's shape, so where `flat` becomes
           * per letter the carve has to follow it or half the word renders as a
           * drawing wearing a tube's outline.
           *
           * `applyLetterMotion` is chained AFTER this pass, so its declarations
           * land ABOVE these in the final source and `FS_LETTER_FLAT` is visible
           * to the preprocessor here. With the pass absent the `#else` branch
           * compiles and this is `uFsPenCarve`, the shipped expression. With the
           * pass present but idle (`uFsLetterCount` 0) the uniform branch returns
           * the same value with no multiply, so the other six films are
           * byte-identical rather than identical-to-a-ULP.
           *
           * ⚠ THE `vFsLetterFace` TERM IS A DEFECT THE FILM CAUGHT AND THE MODEL
           * COULD NOT. Without it the frame before each letter edge came apart
           * into gouges. At 85 degrees of yaw the fragments you can SEE are the
           * tube's SIDE WALL, whose rest positions lie outside the nib's 2D
           * outline almost everywhere, so the carve removes most of the visible
           * letter. The whole-word turn never shows it because its 13-frame
           * exposure puts the last flat frame at ~79 degrees; a letter flip is
           * under four frames a half.
           *
           * AND IT REACHES ZERO EARLY, NOT ASYMPTOTICALLY. Scaling alone did not
           * fix it — A/B'd at 84.8 degrees the carved arm still speckled at
           * amplitude 0.06 (`hero-beat-film/o5-graze/graze-ab.png`), because at
           * grazing incidence the antialiased coverage lands in the ambiguous
           * middle across the whole visible surface and `alphaToCoverage` renders
           * that as a stipple. `smoothstep(0.28, 0.42)` is 0 by 73 degrees and
           * full by 65; what it gives up is ~0.4 px of sub-pixel silhouette. */
          "float fsPenCarveAmount() {",
          "#ifdef FS_LETTER_FLAT",
          "  if (uFsLetterCount > 0.5) {",
          "    return uFsPenCarve * vFsLetterFlat * vFsLetterFace",
          "         * smoothstep(0.28, 0.42, vFsLetterFace);",
          "  }",
          "#endif",
          "  return uFsPenCarve;",
          "}",
        ].join("\n"),
      )
      /* AFTER the break's own block, which is also injected at this include —
       * `String.replace` puts this one first in source order because it runs on
       * the string the break already produced, and both are independent tests
       * of the same fragment, so order is immaterial. What matters is that both
       * sit before any lighting work on a fragment about to be thrown away. */
      .replace(
        "#include <clipping_planes_fragment>",
        [
          "#include <clipping_planes_fragment>",
          "float fsPenCov = 1.0;",
          /* HOISTED OUT OF THE BRANCH so the readback below can print them.
           * Same values, same order of operations — the block reads identically
           * with `uFsPenDbg` at 0, which is what makes the instrument safe to
           * leave in: the shipped path is the same arithmetic on the same
           * variables, only their declarations moved. */
          "vec2 fsPq = vec2(0.0);",
          "vec2 fsPuv = vec2(0.0);",
          "vec2 fsPf = vec2(0.0);",
          "float fsSdU = 0.0;",
          "float fsPpx = 0.0;",
          "float fsPenAmt = fsPenCarveAmount();",
          "if (fsPenAmt > 0.0) {",
          "  fsPq = (uFsPenInv * vec4(vFsBreakWorld, 1.0)).xy;",
          "  fsPuv = (fsPq - uFsPenBox.xy) * uFsPenBox.zw;",
          // r = the PEN outline, g = the TUBE envelope; both negative inside.
          // `mix` interpolates between two signed distance FIELDS, so the shape
          // morphs monotonically rather than a threshold sliding on one shape.
          "  fsPf = texture2D(uFsPenField, fsPuv).rg;",
          /* THE ENVELOPE IS PUSHED OUT HERE, IN STROKE UNITS, BEFORE THE MIX —
           * see PEN_CARVE_ENVELOPE_R. The baked channel is `bestD - 1.35 R`,
           * so a wider envelope is that same number minus a constant, and the
           * whole correction is one subtract with no bake to redo.
           *
           * IT MUST BE INSIDE THE MIX AND NOT OUTSIDE IT. Applied to `fsSd`
           * afterwards it would shift the PEN outline too, and `uFsPenCarve = 1`
           * would stop being the pen's own mark — which is the one endpoint of
           * this dial that is a definition rather than a taste. */
          "  float fsEnv = fsPf.g - uFsPenSlack;",
          "  fsSdU = mix(fsEnv, fsPf.r, fsPenAmt);",
          "  float fsSd = fsSdU * uFsPenUnits;",
          // One local unit in pixels, so the boundary is antialiased at the
          // same rate the mark's own silhouette is.
          /* ---- THE RAMP'S WIDTH, AND IT IS `fwidth(sd)` — see
           * `PEN_CARVE_AA_FWIDTH` for the frame this closes and for why the
           * fade above could not have closed it.
           *
           * `fsPpx` is kept and still published, because it is the PARKED PRIOR
           * (`__captureHarness.setCarveAA(false)`) and because the debug
           * readback prints it. The derivatives sit inside this branch exactly
           * where the prior's already did, so the cost and the
           * derivatives-in-non-uniform-flow exposure are both unchanged: a quad
           * straddling two letters has undefined derivatives under either
           * divisor, and letters are hundreds of pixels apart. */
          "  fsPpx = max(length(dFdx(fsPq)), length(dFdy(fsPq)));",
          "  float fsPenW = uFsPenAA > 0.5 ? fwidth(fsSd) : fsPpx;",
          "  fsPenCov = clamp(0.5 - fsSd / max(fsPenW, 1e-9), 0.0, 1.0);",
          /* THE CPU PROBE'S LAW, AS AN ARM. `_probe-carve-render.mjs` tests
           * `sd <= 0` with no derivative and no coverage; this makes that exact
           * test drivable on the GPU, on the same frame, so the two
           * rasterisations differ in NOTHING but the term under test. */
          "  if (uFsPenHard > 0.5) fsPenCov = fsSd <= 0.0 ? 1.0 : 0.0;",
          // OUTSIDE THE FIELD IS OUTSIDE THE MARK — but a fragment that lands
          // beyond the baked box has no data, and a clamped fetch would read the
          // edge texel. The box is padded by more than the tube slack in
          // `buildPenField`, so anything outside it is already outside both
          // outlines; keeping it is the conservative answer and it can only ever
          // fail to remove, never remove wrongly.
          "  if (fsPuv.x < 0.0 || fsPuv.x > 1.0 || fsPuv.y < 0.0 || fsPuv.y > 1.0) fsPenCov = 1.0;",
          "}",
          // COVERAGE, NOT A BOOLEAN — see `applyJointBreak`'s note. The material
          // runs `alphaToCoverage`, so this is a sample MASK: an interior ink
          // pixel is still exactly one value and gate 1 is untouched.
          // `uFsPenDbg` keeps the fragment alive so the readback can print what
          // it was about to be killed for. 0 is the shipped expression.
          "if (fsPenCov <= 0.0 && uFsPenDbg < 0.5) discard;",
        ].join("\n"),
      )
      .replace(
        "#include <alphatest_fragment>",
        "#include <alphatest_fragment>\ndiffuseColor.a *= fsPenCov;",
      )
      /* ── THE READBACK ────────────────────────────────────────────────────
       * LAST in the fragment shader, after tone mapping, the colour-space
       * transform and the rim — so the packed bytes reach the framebuffer
       * unconverted. Mode 99 emits a CONSTANT: an instrument that cannot be
       * shown to survive the screenshot path is not evidence, and this repo
       * has now been burned twelve times by a green row that could not fail.
       *
       * Each mode packs one scalar as 16 bits across R and G:
       *   1 fsPq.x   2 fsPq.y      (flatten-group LOCAL units, /6 + 0.5)
       *   3 fsPf.r   4 fsPf.g      (the fetched field, STROKE units, /80 + 0.5)
       *   5 fsSdU                  (the mixed distance, STROKE units)
       *   6 fsPpx in STROKE units per pixel (/32)
       *   7 fsPenCov   8 fsPuv.x   9 fsPuv.y      99 the control, 0.375 */
      .replace(
        "#include <dithering_fragment>",
        [
          "#include <dithering_fragment>",
          "if (uFsPenDbg > 0.5) {",
          "  float dv = 0.0;",
          "  if (uFsPenDbg < 1.5) dv = fsPq.x / 6.0 + 0.5;",
          "  else if (uFsPenDbg < 2.5) dv = fsPq.y / 6.0 + 0.5;",
          "  else if (uFsPenDbg < 3.5) dv = fsPf.r / 80.0 + 0.5;",
          "  else if (uFsPenDbg < 4.5) dv = fsPf.g / 80.0 + 0.5;",
          "  else if (uFsPenDbg < 5.5) dv = fsSdU / 80.0 + 0.5;",
          "  else if (uFsPenDbg < 6.5) dv = (fsPpx / max(uFsPenUnits, 1e-12)) / 32.0;",
          "  else if (uFsPenDbg < 7.5) dv = fsPenCov;",
          "  else if (uFsPenDbg < 8.5) dv = fsPuv.x;",
          "  else if (uFsPenDbg < 9.5) dv = fsPuv.y;",
          "  else dv = 0.375;",
          "  float fsT = floor(clamp(dv, 0.0, 1.0) * 65535.0 + 0.5);",
          "  float fsHi = floor(fsT / 256.0);",
          "  gl_FragColor = vec4(fsHi / 255.0, (fsT - fsHi * 256.0) / 255.0, 0.0, 1.0);",
          "}",
        ].join("\n"),
      )

    onUniforms(u)
  }
  // v2: the injected source gained `uFsPenSlack`. three's default cache key does
  // not see onBeforeCompile, so a stale key can hand this material a program
  // compiled without the uniform — the exact failure the key exists to stop.
  mat.customProgramCacheKey = () =>
    (prevKey ? prevKey.call(mat) + "|" : "") + "fs-pencarve-v4"
}

/* ------------------------------------------------------------------ */
/*  THE PEN TIP — the moving end of the line stops being a CUT        */
/* ------------------------------------------------------------------ */

/**
 * A 1x1 stand-in bound to `uFsTipField` from the moment the program compiles,
 * for the identical reason `PEN_FIELD_FALLBACK` exists: an unbound sampler is
 * not free. `arc = 0` means "inked before the word started", so even if it were
 * read (it cannot be — the fetch is behind `uFsTipOn > 0.0`) it removes nothing.
 */
const TIP_FIELD_FALLBACK = (() => {
  const t = new THREE.DataTexture(new Float32Array([0, 1]), 1, 1, THREE.RGFormat, THREE.FloatType)
  t.needsUpdate = true
  return t
})()

interface PenTipUniforms {
  /** 1 while a partial reveal is on screen; 0 makes the whole block inert. */
  on: { value: number }
  field: { value: THREE.Texture | null }
  /** ANIM-1A3 · the timed take's per-texel `|dS/da|` (R32F), and whether to
   *  read it. Off everywhere but a timed take, where the shader reads 1.0. */
  slope: { value: THREE.Texture | null }
  slopeOn: { value: number }
  /** (localX at field minX, localY at field minY, 1/localW, 1/localH). */
  box: { value: THREE.Vector4 }
  /** World → the flatten group's local frame. The SAME matrix the carve uses. */
  inv: { value: THREE.Matrix4 }
  /** The reveal playhead as an arc fraction — `revealDistanceFraction`'s own
   *  return, not a second derivation of it. */
  d: { value: number }
  /** How far the flat cut is ADDED BACK, in ARC FRACTION: `(1 - nose) *
   *  radius/totalArc`. At `nose = 1` it is zero and the field's own round nose
   *  stands; at `nose = 0` it exactly cancels the nose and the boundary is the
   *  perpendicular cut. Folded on the CPU so the fragment does no division. */
  back: { value: number }
  /** Edge lag, in ARC FRACTION (nib half-widths × radius/totalArc). */
  taper: { value: number }
  /** Arc fraction → LOCAL units, so the boundary is antialiased at the same
   *  rate the mark's own silhouette is. */
  arcToLocal: { value: number }
  /** 1 = antialias against `fwidth` of the tested scalar; 0 = the parked prior
   *  that antialiased against the screen size of a local unit. See
   *  `PEN_TIP_AA_FWIDTH`. */
  aa: { value: number }
  /** THE WINDOW'S TRAILING EDGE, in the same scheduled arc fraction `d` is.
   *  `RevealWindow.lo`. Meaningless while `trailOn` is 0. */
  w0: { value: number }
  /** 1 when the window HAS a trailing edge. 0 for every `grow` playhead, which
   *  makes the whole second test uniform-control-flow dead and the shipped
   *  render byte-identical rather than approximately so. */
  trailOn: { value: number }
  /** F118: 1 while a seamless Travel wraps. `d` is then the head part's top and
   *  `w0` the tail part's bottom, and the two edges join by max. */
  wrapOn: { value: number }
  /** F121: where a performed take stands still, `(localX, localY, t0, t1)` with
   *  the times in the units `d` is in, how many are live, and the radius in
   *  local units. At `holdN` 0 the fragment test is the shipped one. */
  hold: { value: THREE.Vector4[] }
  holdN: { value: number }
  holdR: { value: number }
}

/* ══════════════════════════════════════════════════════════════════════════
 * THE TIP'S ANTIALIASING — A CORRECTNESS FIX, AND NOT THE ONE I THOUGHT
 *
 * ⚠ READ THE LAST SECTION FIRST IF YOU ARE SHORT OF TIME: this block was
 * written to explain why a long taper was impossible, the explanation was
 * measured, and **the measurement did not support it.** What is kept is the
 * arithmetic, which is right, and the honest size of what it buys.
 *
 * ── THE DEFECT, WHICH IS REAL ─────────────────────────────────────────────
 * The boundary is `sd = (when - d) * arcToLocal`, in LOCAL units, where
 *
 *     when  =  arc  +  taper * rhoN  +  back * sqrt(1 - rhoN^2)
 *
 * The line that shipped divided `sd` by
 * `max(length(dFdx(fsTq)), length(dFdy(fsTq)))` — the screen size of ONE LOCAL
 * UNIT. That is the correct divisor only if `|grad sd| == 1` in local space. It
 * is not. `arc * arcToLocal` advances one local unit per local unit ALONG the
 * path, and the taper term advances `taper * R * (1/R) = taper` per local unit
 * ACROSS it, so
 *
 *     |grad sd|  =  sqrt(1 + taper^2)
 *
 * and since the coverage ramp is one divisor wide in `sd`, its width IN PIXELS
 * is `1 / sqrt(1 + taper^2)`:
 *
 *     taper    ramp width, pixels
 *      0.00          1.00      (the nib — correct, by luck)
 *      0.85          0.76
 *      1.60          0.53
 *      2.70          0.35
 *
 * So the ramp goes SUB-PIXEL, which means the one edge of the mark a viewer is
 * actually watching gets no antialiasing at all — a hard, stair-stepped
 * boundary, on the frame whose whole claim is that a hand drew it.
 * `fwidth(sd)` is the gradient the fragment actually has, so it is one pixel
 * for every shape at once, including the `sqrt` nose term whose gradient
 * diverges at the ribbon edge (where the level set really is tangent to the
 * edge and the ramp really should widen).
 *
 * ── MEASURED. THE DIRECTION HOLDS; THE STORY I ATTACHED TO IT DOES NOT ────
 * `assert-pentip-specks.mjs`, both divisors at both tapers, one page session
 * each, `docs/verification/pentip/{tipshape-sweep,aa-dsf1}`:
 *
 *     antialiased band, px      taper 1.60      taper 2.75
 *     dsf 2, this divisor          29236           29245
 *     dsf 2, the prior             29182           29161
 *     dsf 1, this divisor          13322           13328
 *     dsf 1, the prior             13299           13300
 *
 * Four for four in the predicted direction, and visible at 8-19x on the crop
 * sheet — the prior's tip edge is blockier. **But it does NOT change the speck
 * or blank-spot counts at either raster** (dsf 1: 22 specks / 12 blanks against
 * the prior's 23 / 12, worst frame 2 against 2, 7 components against 7).
 *
 * So: I claimed this was what made `taper: 0.85` necessary and a longer taper
 * impossible. **That claim is withdrawn.** What made the long taper impossible
 * was the misregistered pen field (see `setFieldRealloc`); on the repaired
 * field the rejected taper 1.6 is indistinguishable from 0.85 under BOTH
 * divisors. This is an antialiasing correction worth having on its own terms,
 * and it is not the unblocker.
 *
 * The prior stays reachable — `__captureHarness.setTipAA(false)` — because a
 * fix whose defect cannot be re-rendered is a claim, not a result.
 * ══════════════════════════════════════════════════════════════════════════ */
export const PEN_TIP_AA_FWIDTH = true
let liveTipAA = PEN_TIP_AA_FWIDTH
function setTipAA(on: boolean): boolean {
  if (process.env.NODE_ENV === "production") return false
  liveTipAA = !!on
  return true
}
function readTipAA(): boolean {
  return process.env.NODE_ENV === "production" ? PEN_TIP_AA_FWIDTH : liveTipAA
}

/* ══════════════════════════════════════════════════════════════════════════
 * 🔴 DOES THE MOVING END RIDE THE SCHEDULE? — the trap, parked as a RENDER.
 *
 * `docs/animation-toolset-map.md` §6.2 names it in red, and it is the one thing
 * about `DRAW IN` that a still of the finished mark cannot show:
 *
 *   *"There are two consumers of the schedule, not one. The pen tip's boundary
 *    is a per-fragment test against the tip field's `arc` channel… If the key
 *    array is remapped and the tip field is not, THE NOSE DETACHES FROM THE
 *    BOUNDARY. This is a real trap and it is exactly the class of bug this repo
 *    keeps finding — one idea, two implementations."*
 *
 * `false` is that defect, exactly: the field keeps the RECORDING's arcs while
 * `setDrawRange` and the playhead have moved to the BEAT's, and the two
 * conversions the uniforms carry are dropped. It is not a synthetic mutant — it
 * is the code that would exist if the second consumer had been forgotten, which
 * is what the map predicts a build would do.
 *
 * It is the known-bad `scripts/verify/assert-stroke-schedule.mjs` requires to
 * FAIL, and it takes on the next FRAME (the uniforms) and the next tip-field
 * sync (the channel), so a sweep needs no rebuild to reach it.
 * ══════════════════════════════════════════════════════════════════════════ */
export const TIP_RIDES_SCHEDULE = true
let liveTipRidesSchedule = TIP_RIDES_SCHEDULE
function setTipRidesSchedule(on: boolean): boolean {
  if (process.env.NODE_ENV === "production") return false
  liveTipRidesSchedule = !!on
  return true
}
function readTipRidesSchedule(): boolean {
  return process.env.NODE_ENV === "production" ? TIP_RIDES_SCHEDULE : liveTipRidesSchedule
}

/* ══════════════════════════════════════════════════════════════════════════
 * 🔴 IS THE TIP FIELD BAKED THROUGH THE SCHEDULE, OR REMAPPED AFTER IT?
 * — step 2's path, PARKED as a render rather than deleted (§0.7).
 *
 * `false` is exactly what shipped on 2026-08-04: bake the field in the
 * RECORDING's arcs, then push the finished channel through `scheduleArc`
 * (`remapTipFieldArc`). That is correct for every schedule step 2 could
 * produce, and step 3 makes it wrong, for a reason worth stating in full
 * because it is a class rather than an oversight:
 *
 *   The `arc` channel is a **minimum over the samples that cover a texel**.
 *   `min` and a remap commute only while the remap is INCREASING over the whole
 *   word. `order`, `overlap` and `align` all keep it increasing WITHIN a
 *   stroke, so remap-after was sound. A per-unit REVERSE does not — the sample
 *   that is first in beat time is the one with the LARGEST recording arc — and
 *   `unit: stroke` with a reorder can also put a crossing's later stroke first.
 *
 * The symptom is the one the map flags in red, arrived at from underneath: the
 * texel is keyed to the wrong covering sample, so the boundary is off by up to
 * the nib's own sweep — one DIAMETER — and the moving nose sits beside the ink
 * instead of on it.
 *
 * `true` bakes the field with the schedule's per-stroke affine coefficients
 * folded into the arc BEFORE the minimum is taken (`scheduleArcCoeffs` →
 * `buildTipField`'s `arcMap`), which is the same answer by construction.
 *
 * It is the known-bad `assert-stroke-schedule.mjs` requires to FAIL under
 * `reverse`, and `remapTipFieldArc` stays exported and reachable so every frame
 * captured under it is still re-renderable.
 * ══════════════════════════════════════════════════════════════════════════ */
export const TIP_FIELD_SCHEDULE_BAKE = true
let liveTipFieldBake = TIP_FIELD_SCHEDULE_BAKE
function setTipFieldBake(on: boolean): boolean {
  if (process.env.NODE_ENV === "production") return false
  liveTipFieldBake = !!on
  return true
}
function readTipFieldBake(): boolean {
  return process.env.NODE_ENV === "production" ? TIP_FIELD_SCHEDULE_BAKE : liveTipFieldBake
}

/* ══════════════════════════════════════════════════════════════════════════
 * 🔴 DOES THE MOVING END KNOW ABOUT THE WINDOW'S *TRAILING* EDGE?
 * — the same trap as `TIP_RIDES_SCHEDULE`, on the other end of the interval.
 *
 * `false` leaves the fragment test one-sided: the leading nose still rides the
 * schedule, and the trailing boundary falls back to whatever the
 * `setDrawRange` cull happens to cut — which is the raw per-triangle chop,
 * faceted at marching-cubes granularity, on an edge that `travel` puts in the
 * MIDDLE of the mark where a viewer is looking straight at it.
 *
 * It is a separate known-bad from `setTipRidesSchedule(false)` because it fails
 * on a separate edge, and the dispatch's bar is explicit that each edge is
 * proved on its own: a window has the tip trap twice.
 * ══════════════════════════════════════════════════════════════════════════ */
export const TIP_TRAILS_WINDOW = true
let liveTipTrailsWindow = TIP_TRAILS_WINDOW
function setTipTrailsWindow(on: boolean): boolean {
  if (process.env.NODE_ENV === "production") return false
  liveTipTrailsWindow = !!on
  return true
}
function readTipTrailsWindow(): boolean {
  return process.env.NODE_ENV === "production" ? TIP_TRAILS_WINDOW : liveTipTrailsWindow
}

/** F121 · How many places a performed take can stand still that the tip holds
 *  exactly. The shader loops over this many at a constant bound; the bake keeps
 *  the longest and publishes the rest on `__heroPenTip.holdsDropped`. */
const TIP_HOLD_MAX = 8

/**
 * THE REVEAL'S MOVING END, AS A FRAGMENT TEST.
 *
 * ── WHAT WAS WRONG, AND WHY IT COULD NOT BE FIXED IN THE GEOMETRY ──────────
 * `lib/pen-reveal.ts` §T carries the measurement and the model. In one line:
 * the Inflate reveal is a `setDrawRange` prefix of a FINISHED surface, and a
 * prefix has no end cap — so the moving end is a chop, and because the boundary
 * is a set of whole TRIANGLES it is a chop with marching-cubes facets on it.
 * Emitting a cap per frame would put geometry work back on a beat that
 * explainer 18 measured at 24–531 ms per rebuild; nothing about that changed.
 *
 * ── WHY A DISCARD CAN DO WHAT A CAP WOULD ─────────────────────────────────
 * Through the draw beat the mark is FLAT, so what reads is its filled
 * silhouette. Removing fragments can carve that silhouette to any 2D shape,
 * including a nib — which is exactly the argument `applyPenCarve` already
 * makes, one field over. The nib's own surface is interior to the tube and
 * could never be RENDERED; its silhouette is available for free.
 *
 * ── ONE FETCH AND NO LOOP, AND THAT IS LOAD-BEARING ───────────────────────
 * Same hazard as the carve, same answer: a `discard` inside a
 * dynamically-bounded loop HANGS Chrome's Metal backend with rAF still ticking
 * and the console empty (docs/README.md, the fifth bug pattern). There is no
 * loop here — the whole per-fragment cost is one `texture2D` and about a dozen
 * ALU ops, and it rides the varying the break already computes.
 *
 * ── WHY IT IS COVERAGE AND NOT A BOOLEAN ──────────────────────────────────
 * `alphaToCoverage` is on for the break and the carve, so this multiplies into
 * the same sample mask. A hard boolean at this boundary would put a stair-step
 * on the one edge of the mark a viewer is actually watching, at the exact
 * moment the whole claim is that a hand drew it.
 */
function applyPenTip(mat: THREE.MeshPhysicalMaterial, onUniforms: (u: PenTipUniforms) => void) {
  const prevCompile = mat.onBeforeCompile
  const prevKey = mat.customProgramCacheKey
  mat.onBeforeCompile = (shader, renderer) => {
    prevCompile?.call(mat, shader, renderer)

    const u: PenTipUniforms = {
      on: { value: 0 },
      field: { value: TIP_FIELD_FALLBACK as THREE.Texture },
      box: { value: new THREE.Vector4(0, 0, 1, 1) },
      inv: { value: new THREE.Matrix4() },
      d: { value: 1 },
      back: { value: 0 },
      taper: { value: 0 },
      arcToLocal: { value: 1 },
      aa: { value: PEN_TIP_AA_FWIDTH ? 1 : 0 },
      /* THE WINDOW'S TRAILING EDGE — 0 / off at every `grow` playhead, which is
       * every playhead the app had before step 3. See the block at
       * `TIP_TRAILS_WINDOW`. */
      w0: { value: 0 },
      trailOn: { value: 0 },
      /* F118, A WRAPPED TRAVEL: `[0, d]` plus `[w0, 1]`, so the two edges join
       * by max (either part inks the texel) instead of min. 0 on every other
       * window. */
      wrapOn: { value: 0 },
      slope: { value: null },
      slopeOn: { value: 0 },
      /* F121: no holds on every take without a performed pace. */
      hold: { value: Array.from({ length: TIP_HOLD_MAX }, () => new THREE.Vector4(0, 0, 2, 2)) },
      holdN: { value: 0 },
      holdR: { value: 0 },
    }
    shader.uniforms.uFsTipOn = u.on
    shader.uniforms.uFsTipSlope = u.slope
    shader.uniforms.uFsTipSlopeOn = u.slopeOn
    shader.uniforms.uFsTipField = u.field
    shader.uniforms.uFsTipBox = u.box
    shader.uniforms.uFsTipInv = u.inv
    shader.uniforms.uFsTipD = u.d
    shader.uniforms.uFsTipBack = u.back
    shader.uniforms.uFsTipTaper = u.taper
    shader.uniforms.uFsTipArcToLocal = u.arcToLocal
    shader.uniforms.uFsTipAA = u.aa
    shader.uniforms.uFsTipW0 = u.w0
    shader.uniforms.uFsTipTrailOn = u.trailOn
    shader.uniforms.uFsTipWrapOn = u.wrapOn
    shader.uniforms.uFsTipHold = u.hold
    shader.uniforms.uFsTipHoldN = u.holdN
    shader.uniforms.uFsTipHoldR = u.holdR

    /* `vFsBreakWorld` IS REUSED, NOT RE-DECLARED — the same rule and the same
     * JS `includes()` guard `applyPenCarve` documents at length. This injection
     * runs third on the chain, so by here the varying is present twice over;
     * the test is kept anyway so removing either predecessor cannot break this
     * one. */
    if (!shader.vertexShader.includes("vFsBreakWorld")) {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vFsBreakWorld;")
        .replace(
          "#include <project_vertex>",
          "vFsBreakWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#include <project_vertex>",
        )
    }
    const needsVarying = !shader.fragmentShader.includes("varying vec3 vFsBreakWorld;")

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        [
          "#include <common>",
          ...(needsVarying ? ["varying vec3 vFsBreakWorld;"] : []),
          "uniform float uFsTipOn;",
          "uniform sampler2D uFsTipField;",
          "uniform vec4 uFsTipBox;",
          "uniform mat4 uFsTipInv;",
          "uniform float uFsTipD;",
          "uniform float uFsTipBack;",
          "uniform float uFsTipTaper;",
          "uniform float uFsTipArcToLocal;",
          "uniform float uFsTipAA;",
          "uniform float uFsTipW0;",
          "uniform float uFsTipTrailOn;",
          "uniform float uFsTipWrapOn;",
          "uniform sampler2D uFsTipSlope;",
          "uniform float uFsTipSlopeOn;",
          `uniform vec4 uFsTipHold[${TIP_HOLD_MAX}];`,
          "uniform float uFsTipHoldN;",
          "uniform float uFsTipHoldR;",
        ].join("\n"),
      )
      .replace(
        "#include <clipping_planes_fragment>",
        [
          "#include <clipping_planes_fragment>",
          "float fsTipCov = 1.0;",
          // `uFsTipOn` IS A UNIFORM, so this branch is uniform control flow and
          // the derivatives below are defined inside it. The BOX test is not
          // uniform, which is why nothing derivative-valued may sit under it —
          // see the restructure note further down.
          "if (uFsTipOn > 0.0) {",
          "  vec2 fsTq = (uFsTipInv * vec4(vFsBreakWorld, 1.0)).xy;",
          "  vec2 fsTuvRaw = (fsTq - uFsTipBox.xy) * uFsTipBox.zw;",
          "  vec2 fsTuv = clamp(fsTuvRaw, 0.0, 1.0);",
          // r = the arc fraction the pen FIRST inked this texel at.
          // g = that stamp's offset from the centreline, in nib half-widths.
          //
          // ⚠ THE FETCH AND THE DERIVATIVES USED TO SIT INSIDE THE BOX TEST,
          // which is NON-UNIFORM control flow — where GLSL ES leaves both
          // undefined. It was never observed to misbehave and it was still a
          // latent version of the fifth bug pattern in docs/README.md (a shader
          // that is wrong while every diagnostic reads green). The uv is
          // clamped so the fetch is always legal, the box test is applied to
          // the RESULT, and out-of-box fragments are KEPT exactly as before —
          // the conservative direction, and the same call `applyPenCarve`
          // makes. The box is padded by TIP_FIELD_REACH nib half-widths, so a
          // fragment beyond it is beyond the mark.
          "  vec2 fsTf = texture2D(uFsTipField, fsTuv).rg;",
          "  float fsRho = clamp(fsTf.g, 0.0, 1.0);",
          // THE SHAPE OF THE MOVING END, in one line.
          //
          // `fsTf.r` is when the nib FIRST TOUCHED, which is one
          // `sqrt(R^2 - rho^2)` earlier than the pen point passing — so the
          // field already carries a round nose and `uFsTipBack` ADDS THAT BACK
          // to recover a flat cut. `(1 - nose)` is folded into the uniform on
          // the CPU so this line is two multiply-adds and a sqrt.
          //
          // `+taper*rho` then makes the edges lag the centre, which is a point
          // rather than a dome — the shape Desk Doodles' rebuild path gets for
          // free by applying its stroke-end taper at the cut.
          // ANIM-1A3 · UNDER A TIMED TAKE `fsTf.r` IS AN ARRIVAL TIME, and the
          // map from arc to time has a different slope per stroke (speed) and
          // per point (ease). `back` and `taper` are lengths along the mark, so
          // they are carried into time by this texel's slope, and the signed
          // distance is carried back to length by dividing by it. Off, the
          // slope reads exactly 1.0 and both lines are the shipped arithmetic.
          "  float fsTsl = uFsTipSlopeOn > 0.5 ? texture2D(uFsTipSlope, fsTuv).r : 1.0;",
          "  float fsWhen = fsTf.r + fsTsl * (uFsTipTaper * fsRho",
          "               + uFsTipBack * sqrt(max(0.0, 1.0 - fsRho * fsRho)));",
          // F121 · A PAUSE READS AS THE PEN STOPPED. While the playhead is
          // inside a hold's `[t0, t1)`, a fragment within `uFsTipHoldR` of that
          // hold's pen point compares against `t0`, the dwell's own value, so
          // the ink there stays exactly as it was when the pen stopped. The
          // nose, the straddling segment and the LINEAR filter all move ink
          // only inside that disc; the bake builds the radius to cover them.
          // The loop has a constant bound, no derivative and no discard in it
          // (the Metal hang in docs/README.md needs a discard inside a
          // dynamically bounded loop), and `uFsTipHoldN` is a uniform, so at 0
          // `fsTipD` is `uFsTipD` and the line below is the shipped one.
          "  float fsTipD = uFsTipD;",
          "  if (uFsTipHoldN > 0.5) {",
          `    for (int fsHk = 0; fsHk < ${TIP_HOLD_MAX}; fsHk++) {`,
          "      vec4 fsH = uFsTipHold[fsHk];",
          "      if (float(fsHk) < uFsTipHoldN && uFsTipD >= fsH.z && uFsTipD < fsH.w",
          "          && distance(fsTq, fsH.xy) <= uFsTipHoldR) fsTipD = min(fsTipD, fsH.z);",
          "    }",
          "  }",
          "  float fsTsd = (fsWhen - fsTipD) * uFsTipArcToLocal / max(fsTsl, 1e-6);",
          // THE COVERAGE RAMP. `fwidth(fsTsd)` is the tested scalar's OWN
          // screen-space gradient, which is the only divisor that is right for
          // every shape — see `PEN_TIP_AA_FWIDTH` for the arithmetic and for
          // what the parked prior (`uFsTipAA = 0`, the screen size of one local
          // unit) does to a taper: it stretches the ramp by sqrt(1 + taper^2)
          // and alphaToCoverage turns the stretch into stipple.
          // PEN-8: the ramp changes only at an arc JUMP. Where two passes
          // meet (the o laid against the D) fwidth is hundreds of local units,
          // the ramp reads ~0.5 on ink far behind the head, and
          // alphaToCoverage draws it as a light seam; there the ramp falls back
          // to 4 units. Below JUMP units the field is continuous and fwidth is
          // kept as is. PEN-7 capped every fragment at 4 units, which clipped
          // the ramp on ordinary tapered edges and stair-stepped them.
          "  float fsTunit = max(length(dFdx(fsTq)), length(dFdy(fsTq)));",
          "  float fsTfw = fwidth(fsTsd);",
          "  float fsTpx = uFsTipAA > 0.5",
          "      ? (fsTfw < 32.0 * fsTunit ? fsTfw : 4.0 * fsTunit)",
          "      : fsTunit;",
          "  float fsTipBoxCov = clamp(0.5 - fsTsd / max(fsTpx, 1e-9), 0.0, 1.0);",
          // 🔴 THE SECOND EDGE — the half a prefix could not express.
          //
          // A window has the tip trap TWICE. The leading test above answers
          // "has the pen reached here yet"; this one answers "has the ink
          // behind the pen gone yet", against the SAME `arc` channel and
          // therefore against the same schedule. Leave it out and the trailing
          // boundary is the raw per-triangle `setDrawRange` cut — the faceted
          // chop this whole field exists to remove, reintroduced on the one
          // edge `travel` puts in the middle of the mark.
          //
          // ── THE SHAPE IS THE SAME `fsWhen`, AND THAT IS A DECISION ────────
          //
          // The first draft mirrored the nib here — `−taper·rho − back·√(…)` —
          // on the reading that un-drawing is a pen running backwards. It was
          // wrong, and the reason is worth keeping because it is what makes the
          // whole model checkable:
          //
          //   Ink VANISHES IN THE ORDER IT WAS LAID. So the set of texels the
          //   evaporation front has passed at `w0` is exactly the set the
          //   DRAWING front had passed at `w0` — the same texels, the same
          //   `when`. Reuse it and the window becomes literal set subtraction:
          //
          //       W[lo, hi]  =  P(hi) \ P(lo)
          //
          //   where `P` is the prefix the app already shipped. That is an
          //   identity a raster can be held to, and `assert-stroke-schedule`
          //   holds it to exactly that: `travel` at one playhead against the
          //   difference of two `grow` frames. A mirrored nib would have made
          //   the two differ by the nose's own shape at both ends and left the
          //   claim as an argument instead of a measurement.
          //
          // `fwidth(fsBsd) == fwidth(fsTsd)` exactly — the two scalars differ by
          // a constant and `fwidth` is a difference — so the ramp reuses
          // `fsTpx` rather than paying for a second screen derivative.
          //
          // ⚠ `uFsTipTrailOn` IS A UNIFORM, so this is uniform control flow.
          // At 0 the assignment above is the last thing that touches
          // `fsTipBoxCov`, textually unchanged, which is what makes the `grow`
          // default byte-identical rather than approximately so.
          "  if (uFsTipTrailOn > 0.5) {",
          "    float fsBsd = (uFsTipW0 - fsWhen) * uFsTipArcToLocal / max(fsTsl, 1e-6);",
          "    float fsTrailCov = clamp(0.5 - fsBsd / max(fsTpx, 1e-9), 0.0, 1.0);",
          // F118: a wrapped window is a union of the head part and the tail
          // part, so either edge inking the texel is enough. Uniform branch.
          "    fsTipBoxCov = uFsTipWrapOn > 0.5 ? max(fsTipBoxCov, fsTrailCov) : min(fsTipBoxCov, fsTrailCov);",
          "  }",
          "  bool fsTipIn = fsTuvRaw.x >= 0.0 && fsTuvRaw.x <= 1.0",
          "              && fsTuvRaw.y >= 0.0 && fsTuvRaw.y <= 1.0;",
          "  fsTipCov = fsTipIn ? fsTipBoxCov : 1.0;",
          "}",
          "if (fsTipCov <= 0.0) discard;",
        ].join("\n"),
      )
      .replace(
        "#include <alphatest_fragment>",
        "#include <alphatest_fragment>\ndiffuseColor.a *= fsTipCov;",
      )

    onUniforms(u)
  }
  /* v7: F121's holds, the dwell's value near a stopped pen. v6: F118's wrap, the two edges joined by max. v3: the window's trailing edge. v2 was the `fwidth(fsTsd)` ramp and the
   * fetch leaving non-uniform control flow. The key MUST move with the source —
   * a stale key is how a material gets handed another build's compiled
   * program. */
  mat.customProgramCacheKey = () => (prevKey ? prevKey.call(mat) + "|" : "") + "fs-pentip-v7"
}

/**
 * How many letters the per-letter pass can carry.
 *
 * 16, against a hero word that measures 8 (`lib/hero-letters.ts` — the traced
 * hand fuses `esk` and `o-d`) and a FONT "Desk Doodles" that measures 11. The
 * headroom is for the text field: the page lets any word be typed, and a word
 * that overran this would silently drop its tail letters into letter 0's
 * transform. The renderer clamps to this and the panel says so.
 */
const FS_LETTER_MAX = 16

/** The per-letter uniforms, captured at compile like the carve's. */
interface LetterUniforms {
  count: { value: number }
  /**
   * FOUR CHANNELS PER LETTER, packed: `(yaw, flat, depth, shade)`.
   *
   * Packed rather than four arrays because the vertex lookup walks the array
   * with a constant bound (see the shader note) and one walk over one vec4 array
   * is one walk; four arrays would be four. `LetterState` in `lib/hero-motion.ts`
   * is the same four in the same order, so the write is a straight copy.
   */
  a: { value: Float32Array }
  /** Each letter's own turn pivot, (x, z) in the flatten group's local frame. */
  pivot: { value: Float32Array }
  /**
   * World → the flatten group's local frame, this frame's.
   *
   * It is NOT here to un-transform a field lookup — the whole point of this pass
   * is that no lookup has to be un-transformed. It is here to recover ONE thing
   * the vertex shader cannot otherwise know: where a mesh sits relative to the
   * word. See the `fsP` note in the shader.
   */
  inv: { value: THREE.Matrix4 }
  /**
   * The flat ink colour, linear, this frame's — including the turn's own shade
   * term is NOT folded in here, because that term is per letter and rides `a.w`.
   */
  ink: { value: THREE.Color }
}

/**
 * O5 · PER-LETTER MOTION — eleven independent yaws on ONE shared material.
 *
 * ⚠ THIS IS NOT THE MECHANISM `lib/hero-motion.ts` PREDICTED, and the note there
 * is now wrong in a useful way. It said per-letter motion needs *"a per-letter
 * transform index as a vertex attribute and an array of inverses in both
 * shaders"* — because the carve, joint-break and pen-tip passes all map a
 * fragment back into field space, and moving a letter would move it out of that
 * space.
 *
 * IT DOES NOT, AND THE REASON IS AN ORDERING ACCIDENT THAT IS ALREADY IN THE
 * FILE. `applyJointBreak` captures the field position in the VERTEX shader,
 * before `<project_vertex>`:
 *
 *     vFsBreakWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
 *     #include <project_vertex>
 *
 * So if the letter rotation is applied to `transformed` AFTER that line and
 * BEFORE the projection, the varying carries the letter's ORIGINAL position and
 * the projection carries its moved one. The field lookups keep working
 * untouched — no inverses, no per-letter materials, and not one line of the
 * three shader passes changes. This pass simply has to run LAST on the
 * onBeforeCompile chain so its `<project_vertex>` replace lands on the string
 * that already assigns the varying.
 *
 * Normals are rotated separately at `<beginnormal_vertex>`, which runs before
 * `<defaultnormal_vertex>` computes the lit normal — rotating the vertex without
 * the normal would light a turned letter as though it were still facing front.
 *
 * The letter index rides as a per-vertex attribute because every stroke shares
 * one material and a uniform cannot vary per draw call on shared state. Every
 * vertex of a stroke carries the same value.
 *
 * ── IT CARRIES FOUR CHANNELS, NOT ONE, AND THAT IS THE FILM ─────────────────
 *
 * A yaw alone would turn eleven ALREADY-SOLID letters, and the option's claim is
 * that each letter's flip IS the built turn — a drawing going in and an object
 * coming out. So the pass also carries `flat`, `depth` and `shade` per letter:
 *
 *   `depth`  scales that letter's own Z about its own pivot, BEFORE the yaw —
 *            the same order the whole-word chain composes in. A letter's
 *            thickness is therefore its own, and eleven letters can be eleven
 *            different thicknesses on one draw call.
 *   `flat`   replaces the fragment's whole lit result with the flat ink value.
 *            That is not an approximation of the material's flat state, it is
 *            the same thing arrived at from the other side: at `ink 1` the frame
 *            loop lerps albedo to black and emissive to the ink, so
 *            `outgoingLight` IS the ink. Mixing to the same colour after
 *            lighting reproduces it exactly, per letter.
 *   `shade`  the turn's own `0.35·(1−sx)` falloff, on that letter's ink.
 *
 * And the carve follows, because `applyPenCarve` multiplies its amplitude by
 * this pass's per-letter `flat` (see `fsPenCarveAmount`). Without that, the
 * carve would switch off for every un-flipped letter the instant the cascade
 * started — an eight-letter silhouette step in one frame.
 *
 * ── HOW THE CAPS AND JOINTS GET THEIR TRANSFORM ─────────────────────────────
 *
 * Rod's cap and joint spheres are SHARED geometry drawn at many `position=`
 * offsets, so their vertices are a unit sphere at the origin and rotating them
 * about a pivot in the WORD's frame would fling them across the page. Two halves
 * to the answer, and both are needed:
 *
 *   1 · WHICH letter — the geometry is cloned per (radius, letter) and stamped,
 *       so a shared sphere never has to carry two answers. See `rodSphereGeos`.
 *   2 · WHERE it is — `fsP` below recovers the mesh's own offset inside the word
 *       from `uFsLetterInv · modelMatrix`, which is exactly that mesh's transform
 *       relative to the flatten group. The rotation then runs on `transformed +
 *       fsP` and the offset is taken back off. For the main tube meshes `fsP` is
 *       zero and this is a no-op, which is why it costs those nothing.
 *
 * That is exact while a mesh's transform inside the word is a TRANSLATION, which
 * is what every mesh under the flatten group has (a bare `position=`, no
 * rotation, no scale). `assert-hero-letters.mjs` asserts it on the live page
 * rather than trusting this sentence.
 *
 * INERT AT REST, and it has to be: `count` 0 makes the lookup return an identity
 * rotation, `flat` 0 and `depth` 1, and the fragment side is skipped behind a
 * uniform branch so not one instruction touches a colour. The shipped beat and
 * all five other films never set it, so their render is byte-identical by
 * construction — `assert-drawin-parity` is the check on that.
 */
function applyLetterMotion(
  mat: THREE.MeshPhysicalMaterial,
  onUniforms: (u: LetterUniforms) => void,
) {
  const prev = mat.onBeforeCompile
  const prevKey = mat.customProgramCacheKey
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer)

    const u: LetterUniforms = {
      count: { value: 0 },
      a: { value: new Float32Array(FS_LETTER_MAX * 4) },
      pivot: { value: new Float32Array(FS_LETTER_MAX * 2) },
      inv: { value: new THREE.Matrix4() },
      ink: { value: new THREE.Color(0, 0, 0) },
    }
    shader.uniforms.uFsLetterCount = u.count
    shader.uniforms.uFsLetterA = u.a
    shader.uniforms.uFsLetterPivot = u.pivot
    shader.uniforms.uFsLetterInv = u.inv
    shader.uniforms.uFsLetterInk = u.ink

    /* Declared in BOTH stages, and deliberately the minimum that has to be.
     *
     * `FS_LETTER_FLAT` is the FLAG `applyPenCarve` compiles against. It is a
     * #define and not a JS test because the carve is chained BEFORE this pass
     * and cannot know whether this one will run — so it emits both branches and
     * the preprocessor picks. Removing this pass leaves the carve byte identical
     * to what it was. */
    const shared = [
      "#define FS_LETTER_FLAT 1",
      "uniform float uFsLetterCount;",
      "varying float vFsLetterFlat;",
      "varying float vFsLetterShade;",
      /* HOW MUCH OF THIS LETTER'S FACE IS FACING US — `|cos(yaw)|`, which is the
       * width law the turn already runs on, read as a pose rather than as a
       * clock. `fsPenCarveAmount` spends the carve by it; see the note there for
       * the frames that forced it. */
      "varying float vFsLetterFace;",
    ]

    const common = [
      "#include <common>",
      ...shared,
      `#define FS_LETTER_MAX ${FS_LETTER_MAX}`,
      "attribute float aFsLetter;",
      "uniform mat4 uFsLetterInv;",
      // (yaw, flat, depth, shade) — the same four `LetterState` carries, in the
      // same order, so the CPU write is a straight copy and cannot re-order.
      "uniform vec4 uFsLetterA[FS_LETTER_MAX];",
      "uniform vec2 uFsLetterPivot[FS_LETTER_MAX];",
      // A dynamic index into a uniform array is legal in GLSL ES 3.0 but not in
      // 1.0, and three.js still compiles 1.0 on some targets — so this walks the
      // array with a constant bound and picks by comparison. Costs 16 iterations
      // on a vertex shader that runs once per vertex, which is nothing next to
      // the tube counts here, and it cannot fail to compile.
      //
      // The REST value is the settled solid — yaw 0, flat 0, depth 1, shade 0 —
      // so `count` 0 is an identity on every channel at once.
      "void fsLetterLookup(float idx, out vec4 a, out vec2 piv) {",
      "  a = vec4(0.0, 0.0, 1.0, 0.0); piv = vec2(0.0);",
      "  for (int i = 0; i < FS_LETTER_MAX; i++) {",
      "    if (float(i) >= uFsLetterCount) break;",
      "    if (abs(float(i) - idx) < 0.5) { a = uFsLetterA[i]; piv = uFsLetterPivot[i]; }",
      "  }",
      "}",
      // Z FIRST, THEN THE YAW — the same order the whole-word chain composes in
      // (`M_ROT` left of `M_C`, so the depth scale is applied to the mark and
      // the scaled mark then turns). The other order would scale the letter's
      // PROJECTION, which at 45 deg of yaw is a shear.
      "vec3 fsLetterPose(vec3 p, vec4 a, vec2 piv) {",
      "  vec3 q = p;",
      "  q.z = piv.y + (q.z - piv.y) * a.z;",
      "  q.x -= piv.x; q.z -= piv.y;",
      "  float c = cos(a.x), s = sin(a.x);",
      "  vec3 r = vec3(q.x * c + q.z * s, q.y, -q.x * s + q.z * c);",
      "  r.x += piv.x; r.z += piv.y;",
      "  return r;",
      "}",
    ].join("\n")

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", common)
      // NORMALS FIRST — before <defaultnormal_vertex> turns objectNormal into
      // the lit normal. A rotated letter lit by an unrotated normal reads as a
      // decal, which is the exact defect the glyph work spent a week on.
      //
      // The DEPTH's normal correction is the inverse-transpose of a diagonal
      // scale, which for `scale(1,1,d)` is `n.z /= d` — one divide, and it is
      // the same correction `normalMatrix` applies for the whole-word collapse.
      // It matters for sixteen frames and no more: the flip's depth reaches 1
      // exactly at the edge, the same instant `flat` swaps, so a letter is only
      // ever both LIT and squashed during the return.
      .replace(
        "#include <beginnormal_vertex>",
        [
          "#include <beginnormal_vertex>",
          "{",
          "  vec4 fsLa; vec2 fsLp;",
          "  fsLetterLookup(aFsLetter, fsLa, fsLp);",
          "  vFsLetterFlat = fsLa.y;",
          "  vFsLetterShade = fsLa.w;",
          "  vFsLetterFace = abs(cos(fsLa.x));",
          "  if (fsLa.z > 0.0) objectNormal.z /= fsLa.z;",
          "  if (fsLa.x != 0.0 || fsLa.z != 1.0) objectNormal = normalize(fsLetterPose(objectNormal, vec4(fsLa.x, 0.0, 1.0, 0.0), vec2(0.0)));",
          "}",
        ].join("\n"),
      )
      /* AFTER the field varying is assigned and BEFORE the projection. This is
       * the whole trick — see the note above. `applyLetterMotion` must be LAST
       * on the chain or this replace lands on the wrong string.
       *
       * `fsP` IS THE MESH'S OWN OFFSET INSIDE THE WORD, and it is what makes the
       * cap and joint spheres work. `modelMatrix` takes this mesh's object space
       * to the world; `uFsLetterInv` takes the world back to the flatten group's
       * frame; so their product IS this mesh's transform relative to the word,
       * and its translation column is where the mesh sits. Zero for the tube
       * meshes (they carry no local transform), the cap's `position=` for a cap.
       * The pose then runs on the point IN THE WORD's frame and the offset comes
       * straight back off, so `transformed` stays in the mesh's own space and
       * every chunk after this one — `worldpos`, `shadowmap`, `fog` — keeps
       * reading a coherent value. */
      .replace(
        "#include <project_vertex>",
        [
          "{",
          "  vec4 fsLa2; vec2 fsLp2;",
          "  fsLetterLookup(aFsLetter, fsLa2, fsLp2);",
          "  if (fsLa2.x != 0.0 || fsLa2.z != 1.0) {",
          "    vec3 fsP = (uFsLetterInv * modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;",
          "    transformed = fsLetterPose(transformed + fsP, fsLa2, fsLp2) - fsP;",
          "  }",
          "}",
          "#include <project_vertex>",
        ].join("\n"),
      )

    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", ["#include <common>", ...shared, "uniform vec3 uFsLetterInk;"].join("\n"))
      /* THE FLAT INK, PER LETTER — and it is the SAME value the material's own
       * flat state produces, not an approximation of it.
       *
       * At `ink 1` the frame loop lerps albedo to black and emissive to the flat
       * ink at intensity 1, so nothing reaches `outgoingLight` except the
       * emissive: `outgoingLight == flatInk`. Mixing to that same colour here,
       * after all lighting and before tone mapping, lands on the identical
       * number — per letter, on one shared material.
       *
       * `shade` is the turn's own `0.35·(1−sx)` falloff and it multiplies the
       * ink, exactly as the frame loop's `flatInkRef.multiplyScalar(1 − shade)`
       * does for the whole word.
       *
       * Behind a UNIFORM branch, so with no cascade running not one instruction
       * touches the colour and the other six films are byte-identical rather
       * than arithmetically-identical. */
      .replace(
        "#include <opaque_fragment>",
        [
          "if (uFsLetterCount > 0.5 && vFsLetterFlat > 0.0) {",
          "  outgoingLight = mix(outgoingLight, uFsLetterInk * (1.0 - vFsLetterShade), vFsLetterFlat);",
          "}",
          "#include <opaque_fragment>",
        ].join("\n"),
      )

    /* AND THE RIM COMES OFF THE FLAT LETTERS.
     *
     * `applyRimGlow` adds a fresnel edge light to `gl_FragColor` AFTER tone
     * mapping, and a drawing has no rim — the whole-word path zeroes
     * `uRimStrength` while `ink` is up, but that dial is one number for the
     * mark and this film needs it per letter. So the rim's own term is
     * subtracted back off in proportion to the letter's flatness, using the
     * same `dd_rim` the rim just computed. Exact at both ends: subtract nothing
     * from a solid letter, subtract the whole term from an ink one.
     *
     * Guarded on the shader source rather than on `rimEnabled`, because this
     * function is not told which registers light how — and the Free Stroke
     * register genuinely has no rim (`lib/registers.ts`), so half the time
     * there is nothing here to correct. `applyRimGlow` runs BEFORE this pass on
     * the chain, so if it ran at all its code is already in the string.
     *
     * `studio-rig.tsx` is not edited. The port convention there is that Desk
     * Doodles' code is chained onto, never modified. */
    if (shader.fragmentShader.includes("uRimStrength")) {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <dithering_fragment>",
        [
          "if (uFsLetterCount > 0.5 && vFsLetterFlat > 0.0) {",
          "  gl_FragColor.rgb -= uRimColor * (dd_rim * uRimStrength) * vFsLetterFlat;",
          "}",
          "#include <dithering_fragment>",
        ].join("\n"),
      )
    }

    onUniforms(u)
  }
  mat.customProgramCacheKey = () => (prevKey ? prevKey.call(mat) + "|" : "") + "fs-letter-v2"
}

/** The per-vertex attribute `applyLetterMotion` reads. One name, one place. */
const FS_LETTER_ATTR = "aFsLetter"

/** The (radius, letter) cap/joint pair for stroke `si`, or null if no cascade
 *  can run. Hoisted out of the render body so the JSX below reads as one line. */
function letterGeoFor(
  cache: Map<string, { cap: THREE.SphereGeometry; joint: THREE.SphereGeometry }> | null,
  map: LetterMap | undefined,
  si: number,
  radius: number,
) {
  if (!cache || !map) return null
  const li = Math.min(map.of[si] ?? 0, Math.min(map.count, FS_LETTER_MAX) - 1)
  return cache.get(`${radius}|${li}`) ?? null
}

/** Write one constant letter index across every vertex of a geometry. */
function stampConstantLetter(geo: THREE.BufferGeometry, letter: number) {
  const pos = geo.getAttribute("position")
  if (!pos) return
  const a = new Float32Array(pos.count)
  a.fill(letter)
  geo.setAttribute(FS_LETTER_ATTR, new THREE.BufferAttribute(a, 1))
}

/**
 * WHAT THE CASCADE NEEDS FROM THE GEOMETRY — the letter index on every vertex,
 * and every letter's own turn axis.
 *
 * ── TWO SHAPES OF MARK, AND THE HERO WORD IS THE SECOND ─────────────────────
 *
 * Rod, Extrude and Solid build ONE MESH PER STROKE, so a stroke's letter is a
 * constant across its geometry and the stamp is a fill.
 *
 * **Inflate builds ONE FUSED SURFACE for the whole word** — `strokeIndex: 0`,
 * a single marching-cubes mesh (`lib/geometry-engines.ts`, the implicit path) —
 * and it is the engine both registers default to, so it is what the hero
 * actually renders. There is no per-stroke mesh to label. Every vertex is
 * assigned to the letter whose INK is nearest to it, which is the same law
 * `lib/hero-letters.ts` groups strokes by, applied one level down: the surface
 * belongs to whichever letter drew it.
 *
 * That also settles the board's shred-zone question at the vertex level rather
 * than papering over it. Where two letters' ink genuinely fuses,
 * `lib/hero-letters.ts` has already put them in ONE letter, so no vertex in the
 * fused region has two candidates to be torn between — the seam a naive
 * per-stroke split would have opened across the `esk` cluster cannot exist,
 * because there is no boundary there to open.
 *
 * ── THE PIVOTS ARE MEASURED, NOT MODELLED ───────────────────────────────────
 *
 * Board §4 O5: *"Each letter turns about its own vertical centroid axis; a
 * mis-placed axis makes a letter sweep sideways instead of turning in place."*
 * So a letter's axis is the centre of its own ink, taken from the strokes that
 * carry it and mapped through `strokeTo3D`'s exact transform — the same map the
 * junction table uses, for the same reason: two copies of that transform is how
 * this repo's most expensive defect class starts.
 *
 * `z` is the MARK's own z centre and not each letter's, and that is not a
 * shortcut: the word is planar, so every letter's centreline sits on the same z,
 * and reading it from the geometry's own bounds rather than assuming 0 keeps it
 * correct if an engine ever offsets the sheet.
 */
function buildLetterGeometry(
  meshes: StrokeMeshData[],
  strokes: ProcessedStroke[],
  map: LetterMap,
  canvasWidth: number,
  canvasHeight: number,
): { pivots: Float32Array; count: number; wordX: number } | null {
  const count = Math.min(map.count, FS_LETTER_MAX)
  if (count <= 0 || strokes.length === 0 || meshes.length === 0) return null

  const scale = 3 / Math.max(canvasWidth || 1, canvasHeight || 1)
  const toX = (x: number) => (x - canvasWidth / 2) * scale
  const toY = (y: number) => -(y - canvasHeight / 2) * scale

  /* Every ink sample, in the flatten group's own frame, tagged with its letter.
   * One flat array rather than nested, because the nearest-ink search below
   * walks it thousands of times and a flat array is one indirection. */
  const px: number[] = []
  const py: number[] = []
  const pl: number[] = []
  for (let si = 0; si < strokes.length; si++) {
    const li = Math.min(map.of[si] ?? 0, count - 1)
    for (const p of strokes[si].points) {
      px.push(toX(p.x))
      py.push(toY(p.y))
      pl.push(li)
    }
  }
  if (px.length === 0) return null

  /* ---- the pivots ---------------------------------------------------------- */
  const minX = new Float64Array(count).fill(Infinity)
  const maxX = new Float64Array(count).fill(-Infinity)
  for (let i = 0; i < px.length; i++) {
    const l = pl[i]
    if (px[i] < minX[l]) minX[l] = px[i]
    if (px[i] > maxX[l]) maxX[l] = px[i]
  }
  const box = new THREE.Box3()
  for (const m of meshes) {
    m.tubeGeometry.computeBoundingBox()
    if (m.tubeGeometry.boundingBox) box.union(m.tubeGeometry.boundingBox)
  }
  const cz = box.isEmpty() ? 0 : (box.min.z + box.max.z) / 2
  const pivots = new Float32Array(FS_LETTER_MAX * 2)
  for (let l = 0; l < count; l++) {
    pivots[l * 2] = Number.isFinite(minX[l]) ? (minX[l] + maxX[l]) / 2 : 0
    pivots[l * 2 + 1] = cz
  }

  /* ---- THE WORD'S OWN AXIS — the pivot a LANDED letter turns about ---------
   *
   * `LetterState.settle` carries the derivation; the short version is that two
   * letters at one yaw about two pivots are two different rigid motions, so the
   * settled rank tears at every join unless they share an axis. This is that
   * axis, and it is measured HERE, off the SAME `px` samples the per-letter
   * pivots came from, in the same frame — not read from the whole-word turn's
   * `cx`, which lives in the group's PARENT frame. Two numbers for one axis in
   * two frames is precisely the "one knob, two names" defect this repo spent a
   * session collapsing; one derivation, one frame, no chance of drift.
   *
   * z is `cz`, already shared by every letter, so only x has to be resolved. */
  let wx0 = Infinity
  let wx1 = -Infinity
  for (let i = 0; i < px.length; i++) {
    if (px[i] < wx0) wx0 = px[i]
    if (px[i] > wx1) wx1 = px[i]
  }
  const wordX = Number.isFinite(wx0) ? (wx0 + wx1) / 2 : 0

  /* ---- the stamp ----------------------------------------------------------- */
  const perStroke = meshes.length === map.of.length
  if (perStroke) {
    for (let i = 0; i < meshes.length; i++) {
      stampConstantLetter(meshes[i].tubeGeometry, Math.min(map.of[i] ?? 0, count - 1))
    }
    return { pivots, count, wordX }
  }

  /* THE FUSED SURFACE. A bucket grid over the ink, so each vertex compares
   * against the handful of samples near it rather than against all of them —
   * 147 000 vertices against 3 700 samples is 540 million distance tests done
   * the naive way, which is a visible stall on every word change. */
  let bx0 = Infinity
  let by0 = Infinity
  let bx1 = -Infinity
  let by1 = -Infinity
  for (let i = 0; i < px.length; i++) {
    if (px[i] < bx0) bx0 = px[i]
    if (px[i] > bx1) bx1 = px[i]
    if (py[i] < by0) by0 = py[i]
    if (py[i] > by1) by1 = py[i]
  }
  const span = Math.max(bx1 - bx0, by1 - by0, 1e-6)
  const cell = span / 96
  const gw = Math.max(1, Math.ceil((bx1 - bx0) / cell) + 1)
  const gh = Math.max(1, Math.ceil((by1 - by0) / cell) + 1)
  const buckets: number[][] = new Array(gw * gh)
  for (let i = 0; i < px.length; i++) {
    const cxI = Math.min(gw - 1, Math.max(0, Math.floor((px[i] - bx0) / cell)))
    const cyI = Math.min(gh - 1, Math.max(0, Math.floor((py[i] - by0) / cell)))
    const k = cyI * gw + cxI
    if (buckets[k]) buckets[k].push(i)
    else buckets[k] = [i]
  }

  const nearestLetter = (x: number, y: number): number => {
    const cxI = Math.min(gw - 1, Math.max(0, Math.floor((x - bx0) / cell)))
    const cyI = Math.min(gh - 1, Math.max(0, Math.floor((y - by0) / cell)))
    let best = Infinity
    let bestL = 0
    // Grow the ring until something is found, then take ONE more ring: the
    // nearest sample can sit in a diagonal neighbour of the first ring that
    // hits, and stopping early is how a vertex on a letter boundary silently
    // joins the wrong letter.
    let found = false
    for (let r = 0; r <= Math.max(gw, gh); r++) {
      const x0 = Math.max(0, cxI - r)
      const x1 = Math.min(gw - 1, cxI + r)
      const y0 = Math.max(0, cyI - r)
      const y1 = Math.min(gh - 1, cyI + r)
      for (let gy = y0; gy <= y1; gy++) {
        for (let gx = x0; gx <= x1; gx++) {
          // Only the ring's own shell — the interior was searched last pass.
          if (r > 0 && gx > x0 && gx < x1 && gy > y0 && gy < y1) continue
          const b = buckets[gy * gw + gx]
          if (!b) continue
          for (const i of b) {
            const dx = px[i] - x
            const dy = py[i] - y
            const d = dx * dx + dy * dy
            if (d < best) {
              best = d
              bestL = pl[i]
            }
          }
        }
      }
      if (found) break
      if (best < Infinity) found = true
    }
    return bestL
  }

  let spanningBefore = 0
  let spanningAfter = 0
  let splitVerts = 0
  let triTotal = 0
  const trace: Record<string, number>[] = []
  for (const m of meshes) {
    const pos = m.tubeGeometry.getAttribute("position") as THREE.BufferAttribute | undefined
    if (!pos) continue
    const a = new Float32Array(pos.count)
    for (let v = 0; v < pos.count; v++) a[v] = nearestLetter(pos.getX(v), pos.getY(v))
    m.tubeGeometry.setAttribute(FS_LETTER_ATTR, new THREE.BufferAttribute(a, 1))
    const c = ownTrianglesWhole(m.tubeGeometry, a)
    spanningBefore += c.before
    spanningAfter += c.after
    splitVerts += c.split
    triTotal += c.tris
    /* THE ONE INVARIANT THAT WAS NEVER CHECKED, and the defect it names.
     * WebGL validates a draw against EVERY enabled attribute, so a letter
     * attribute shorter than `position` is not a cosmetic mismatch — it is
     * `INVALID_OPERATION` and the driver drops the WHOLE draw call the instant
     * `setDrawRange` reaches the short attribute's end. Measured on the font
     * word: position 59 936 · aFsLetter 58 998, mark gone from DRAW 93.75 % to
     * the end of the beat, `glDrawElements: Vertex buffer is not big enough`
     * 181 times. See `docs/explainers/24-…`. */
    trace.push({
      posAtRead: a.length,
      posAfter: (m.tubeGeometry.getAttribute("position") as THREE.BufferAttribute).count,
      letterAfter: (m.tubeGeometry.getAttribute(FS_LETTER_ATTR) as THREE.BufferAttribute).count,
      split: c.split,
      before: c.before,
    })
  }
  if (typeof window !== "undefined") {
    const w = window as unknown as { __letterSeam?: { calls?: number } }
    ;(window as unknown as { __letterSeam?: unknown }).__letterSeam = {
      spanningBefore,
      spanningAfter,
      splitVerts,
      triangles: triTotal,
      whole: readLetterWholeTriangles(),
      /* HOW MANY TIMES THIS HAS RUN, AND WHAT EACH RUN SAW. The stamp is an
       * effect keyed on five values, three of which move without the geometry
       * moving; a run that re-splits an already-split surface, or that reads a
       * vertex count the surface no longer has, is only visible here. */
      calls: (w.__letterSeam?.calls ?? 0) + 1,
      trace,
    }
  }
  return { pivots, count, wordX }
}

/* ══════════════════════════════════════════════════════════════════════════
 * A TRIANGLE BELONGS TO ONE LETTER, OR IT IS A SHARD.
 *
 * ── WHAT SEBS PHOTOGRAPHED ────────────────────────────────────────────────
 * 2026-08-04, `letterByLetter`, engine FREE STROKE, look Desk Doodles, SOLID
 * 57 %, camera dead-on: *"look how the [mesh] gets fucked on letter by letter."*
 * Hard-edged flat grey slabs sticking out of the `D`, the `e`, the `s`, the
 * second `D`, the `o`, the `l` and the `e` — lighter than the ink, planar,
 * angled, belonging to no letterform.
 *
 * ── WHY, AND IT IS A CONSEQUENCE OF THE STAMP ABOVE, NOT A BUG IN IT ──────
 * Inflate builds ONE FUSED SURFACE for the whole word, so there is no per-stroke
 * mesh to label and every VERTEX takes the letter whose ink is nearest. At any
 * boundary between two letters that is exactly right for the vertices and
 * exactly wrong for the TRIANGLES between them: a triangle with one vertex in
 * the `e` and two in the `s` has one corner rotated by the `e`'s yaw and two by
 * the `s`'s, so it is stretched across the gap into a flat sheet with a hard
 * edge and a normal that belongs to neither letter. Mid-cascade — one letter
 * turned, its neighbour not yet — is when the two yaws differ most, which is
 * why SOLID 57 % is where he saw it.
 *
 * ── THE FIX, AND WHY WHOLE TRIANGLES RATHER THAN A BLEND ──────────────────
 * Three answers were on the table: assign whole TRIANGLES, blend the rotation
 * through the join, or pin a band around each join and let the letters turn
 * inside it. This takes the first, and the reason is what the film is FOR: the
 * cascade's claim is that each letter is its own object turning on its own axis.
 * A blend makes the boundary geometry a rubber sheet between two objects, which
 * is the read the board rejects; pinning a band freezes ink that belongs to a
 * letter that has turned. Whole triangles give each letter a rigid shell and let
 * the two shells separate at the seam, which is what eleven separate objects
 * flipping actually looks like.
 *
 * It is also the only one of the three that is EXACT, and therefore the only one
 * a gate can state as a topology claim with no raster:
 * `assert-letter-seam.mjs` requires that no triangle carries two letter indices.
 *
 * ── THE SPLIT IS WHY THIS IS NOT A ONE-LINER ──────────────────────────────
 * A vertex carries ONE attribute value, so a vertex shared by triangles of two
 * different owners has to become two vertices. Every attribute is copied, the
 * index buffer is rewritten IN PLACE — triangle ORDER is untouched, which is
 * load-bearing: `revealKeys` is a per-triangle array parallel to that order and
 * `AnimatedStrokes` binary-searches it every frame. Reordering here would
 * silently desynchronise the draw-in from the surface.
 *
 * On the hero word this splits a few hundred vertices out of ~147 000 and runs
 * once per build, beside a marching-cubes polygonisation that costs 600 ms.
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * THE LETTER STAMP FOLLOWS THE SURFACE IT IS ON — see `ensureLetterStamp`.
 *
 * PARKED PRIOR — `false` restores the behaviour that shipped: the stamp is
 * written only by an effect keyed on five values, none of which moves when a
 * worker refills the geometry in place, so a stale `aFsLetter` survives a
 * rebuild. Together with `setRefillDropsStaleAttrs(false)` it re-renders the
 * blank tail exactly, and that pair is the known-bad
 * `scripts/verify/assert-drawin-attrs.mjs` requires to FAIL. §0.7: a replaced
 * behaviour becomes a dial, never a deletion.
 */
export const LETTER_STAMP_FOLLOWS_REFILL = true
let liveLetterStampFollows = LETTER_STAMP_FOLLOWS_REFILL
function setLetterStampFollowsRefill(on: boolean): boolean {
  if (process.env.NODE_ENV === "production") return false
  liveLetterStampFollows = !!on
  return true
}
function readLetterStampFollowsRefill(): boolean {
  return process.env.NODE_ENV === "production"
    ? LETTER_STAMP_FOLLOWS_REFILL
    : liveLetterStampFollows
}

/** PARKED PRIOR — the per-vertex assignment that shipped, reachable so the
 *  defect can be re-rendered. `__captureHarness.setLetterWholeTriangles(false)`. */
export const LETTER_WHOLE_TRIANGLES = true
let liveLetterWhole = LETTER_WHOLE_TRIANGLES
function setLetterWholeTriangles(on: boolean): boolean {
  if (process.env.NODE_ENV === "production") return false
  liveLetterWhole = !!on
  return true
}
function readLetterWholeTriangles(): boolean {
  return process.env.NODE_ENV === "production" ? LETTER_WHOLE_TRIANGLES : liveLetterWhole
}

/* ══════════════════════════════════════════════════════════════════════════
 * A LANDED LETTER TURNS ABOUT THE WORD'S AXIS, NOT ITS OWN.
 *
 * ── WHAT WHOLE TRIANGLES ACTUALLY FIXED, AND WHAT THEY UNCOVERED ──────────
 * `ownTrianglesWhole` above removed the flat grey slabs by refusing to let one
 * triangle straddle two letters. `assert-letter-seam.mjs` reads 11 rows ALL PASS
 * on it and the census is honest — 788 spanning triangles before, 0 after.
 *
 * **The picture underneath was still wrong, and worse in a different way.**
 * Driven at the state Sebs photographed — `letterByLetter` · FREE STROKE · look
 * Desk Doodles · camera dead-on · SOLID 57 % — the two arms disagree on a
 * CONSTANT 1147 px for the entire 2.2 s solid hold, and at 6× the shipped arm
 * carries a **white stippled crack straight through the `e|sk`, the `d|l` and
 * the `e|s` joins**. The slabs had been covering a gap; removing them exposed it.
 * (`docs/verification/letter-seam-picture/cascade/SHEET-127.png`.)
 *
 * ── THE GAP IS ARITHMETIC ────────────────────────────────────────────────
 * `fsLetterPose` maps `q = R(p − piv) + piv = R·p + (I − R)·piv`. Two letters at
 * the SAME yaw about DIFFERENT pivots are therefore two DIFFERENT rigid motions,
 * separated by `(I − R)·(piv_A − piv_B)`. `sampleLetters` lands every letter on
 * one shared yaw (`letterLandYaw`, 30°) and HOLDS it there for the whole solid
 * beat, so every join is pulled open by `(1 − cos 30°) = 13.4 %` of the pivot
 * separation in x and `sin 30° = 50 %` in z. Equivalently: a turned word must
 * narrow to `cos 30°` of its flat width, and with per-letter pivots each letter
 * narrows in place instead — the width the turn should have taken out of the
 * word opens up as gaps between the letters.
 *
 * It closes IFF every landed letter shares one pivot, and that is not a tuning
 * choice: any translation that closes it algebraically reduces to
 * `R(p − piv_word) + piv_word`. So the pivot has to ARRIVE, and
 * `LetterState.settle` is the arrival — 0 while the letter is still ink turning
 * on its own centre, 1 the frame it lands. The prediction this makes, and the
 * one the fix is measured against: the two arms' disagreement must fall to zero
 * across SOLID, and it must ALREADY have fallen to zero anywhere the letters'
 * shared yaw is 0 (which is exactly what the pre-fix diff shows through
 * `returnTurn`: 1147 → 889 → 297 → 64 → 4 → 0 as the yaw unwinds).
 *
 * ── PARKED PRIOR ─────────────────────────────────────────────────────────
 * `__captureHarness.setLetterSettle(false)` pins every letter to its own centre,
 * which is the pose that shipped before 2026-08-04 — the cracked one. It is a
 * uniform write, so it takes on the NEXT FRAME and needs no rebuild (unlike
 * `setLetterWholeTriangles`, whose stamp is baked). It is the negative control
 * `assert-letter-seam.mjs` requires to FAIL.
 * ══════════════════════════════════════════════════════════════════════════ */
export const LETTER_SETTLE_TO_WORD = true
let liveLetterSettle = LETTER_SETTLE_TO_WORD
function setLetterSettleToWord(on: boolean): boolean {
  if (process.env.NODE_ENV === "production") return false
  liveLetterSettle = !!on
  return true
}
function readLetterSettleToWord(): boolean {
  return process.env.NODE_ENV === "production" ? LETTER_SETTLE_TO_WORD : liveLetterSettle
}

/** THE AXES THE GPU WAS LAST HANDED — published from the frame loop so the gate
 *  reads what RENDERED rather than what a ref says it meant to render. Module
 *  scope because the frame loop and `__captureHarness` live in two different
 *  components; a cross-component ref would not resolve, and a second copy of
 *  the arithmetic would be a second source of truth for the same number. */
type LetterAxes = {
  /** Each letter's OWN centre, as `buildLetterGeometry` measured it. */
  own: number[]
  /** The axis actually handed to the GPU this frame — `own` lerped to `wordX`. */
  live: number[]
  /** The word's own axis: where a LANDED letter must turn. */
  wordX: number
  /** This frame's per-letter yaw. The seam claim is conditional on it: two
   *  letters only have to share an axis when they share a yaw. */
  yaw: number[]
  count: number
}
let liveLetterAxes: LetterAxes | null = null

/** The reveal fraction the drawRange was last computed from — see
 *  `__inflateProbe.revealState()`. Module scope for `liveLetterAxes`'s reason:
 *  the frame loop and the probe live in two different components. */
let liveRevealFrac: number | null = null
/** THE WINDOW THIS FRAME, published for `__inflateProbe.revealState()`.
 *  Module scope for `liveRevealFrac`'s own reason: the frame loop writes it and
 *  a probe reads it, and neither is a React render. */
let liveRevealWindow: RevealWindow | null = null

/**
 * 🔴 MESHES A HARNESS HAS FORCED HIDDEN — the one state `revealState()`'s
 * `visible` reading was never able to observe.
 *
 * ── WHY THIS EXISTS, AND WHY A PLAIN `m.visible = false` DOES NOT WORK ─────
 * Explainer 24 §10.2 **row 3** ("mesh hidden / culled") is marked AMBIGUOUS
 * because *"`visible` has never been observed to read `false` on any object in
 * the census. Nothing here can fail it."* Lane Q and Lane W both name the same
 * repair — a `setMeshVisible` on `__inflateProbe` — and Lane W wrote it out to
 * be landed cold. Reading this file rather than the handover found TWO reasons
 * the cold landing would have produced a control that cannot fire:
 *
 *   1. `FusionProbe`'s `collect()` skips invisible objects (`if (!o.visible …)
 *      return`), and the census walks `collect()`. So the field `visible:
 *      m.visible` is read only over objects that are already visible: it can
 *      only ever print `true`. The census's CLAIM is "everything that can make
 *      a submitted mesh invisible"; its SUBJECT is "the visible meshes."
 *   2. The frame loop writes `mesh.visible = true` UNCONDITIONALLY every frame
 *      for solid / extrude / inflate. An outside write of `false` is reverted
 *      before the next painted frame, so the setter would return `true`, the
 *      ink would not fall, and nothing would say so — a driver that reports
 *      success and changes nothing, which is the exact defect class row 3 is
 *      about.
 *
 * So the hide is a LATCH the frame loop honours, in the same shape as every
 * other parked-prior control in this file (`readPenTipMode`, `readCarveAA`): a
 * module-scope store, written by the probe and read by the loop, because the
 * two live in different components and neither write is a React render.
 *
 * Identity is the mesh's `uuid`, not its index. An index into a list whose
 * membership the setter's own action changes is explainer 43's instance 3
 * reintroduced inside the fix for instance 6 — hide mesh 0 and every later mesh
 * renumbers, so the restore would target a different object.
 *
 * DEV-ONLY BY CONSTRUCTION: the only writer is `__inflateProbe.setMeshVisible`,
 * which is itself inside a `NODE_ENV !== "production"` guard, so in production
 * this set is empty and the loop's read is one `Set.size` test.
 */
const forcedHiddenMeshes = new Set<string>()
/** Is this object currently latched hidden by a harness? Cheap on the empty
 *  set, which is every non-dev frame. */
const isForcedHidden = (o: { uuid: string }) =>
  forcedHiddenMeshes.size > 0 && forcedHiddenMeshes.has(o.uuid)

/**
 * EVERY UNIFORM THAT CAN BLANK A SUBMITTED MARK, AS THE GPU WAS HANDED IT.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 * `_probe-drawin-vanish.mjs --engine=free-stroke --word=font` reads 94 323 ink
 * px at DRAW 93 % and **1** at 94 %, with 335 820 of 359 568 indices SUBMITTED
 * — more than at 93 %. `revealState()` above already separates "never
 * submitted" from "submitted and discarded" and settled it on the second. That
 * left three fragment passes (the joint break, the pen carve, the pen tip) and
 * no way to read what any of them was actually asked to do, so the only
 * available move was OFAT — and OFAT is blind to a defect that fires in TWO
 * passes at once, which is exactly the shape a shared input has. Every uniform
 * below is written in the same frame loop, from the same values, so this is the
 * reading rather than a reconstruction of it.
 *
 * Dev-only in effect: nothing reads it in production, and the write is a dozen
 * scalar copies on a path that already touches all of them.
 */
type DrawDiag = {
  revealFrac: number | null
  /** The flat-state channels the three passes are gated on. */
  depth: number
  ink: number
  lit: number
  penCarveState: number
  jointBreakState: number
  /** `null` when the pass has no uniform block compiled at all. */
  pen: {
    carve: number
    units: number
    slack: number
    box: number[]
    aa: number
    /** Determinant of the inverse the pass transforms every fragment by. A
     *  singular `matrixWorld` makes three's `Matrix4.invert()` return the ZERO
     *  matrix, which collapses every fragment onto one texel of the field. */
    invDet: number
  } | null
  tip: {
    on: number
    d: number
    back: number
    taper: number
    arcToLocal: number
    /** Present only under a timed take (ANIM-1A3). */
    slopeOn?: number
    box: number[]
    aa: number
    invDet: number
  } | null
  brk: { count: number; band: number; arc: number; cull2: number } | null
  /** The group's own world matrix determinant, the shared input of all three. */
  worldDet: number
}
let liveDrawDiag: DrawDiag | null = null

/**
 * Give every triangle ONE letter, splitting vertices where two owners meet.
 *
 * The owner is the MAJORITY of the triangle's three vertices, and a three-way
 * tie is impossible on a triangle (two of three always agree unless all three
 * differ, in which case the first corner wins — a deterministic tiebreak, and on
 * a marching-cubes surface at this cell size a triangle touching three letters
 * does not occur; the branch exists so the function is total).
 *
 * Returns the census rather than a verdict: how many triangles spanned two
 * letters before and after, how many vertices had to be duplicated, and the
 * triangle total. `assert-letter-seam.mjs` turns those into pass/fail.
 */
function ownTrianglesWhole(
  geo: THREE.BufferGeometry,
  letters: Float32Array,
): { before: number; after: number; split: number; tris: number } {
  const idx = geo.getIndex()
  if (!idx) return { before: 0, after: 0, split: 0, tris: 0 }
  const triCount = Math.floor(idx.count / 3)
  const spans = (a: number, b: number, c: number) =>
    letters[a] !== letters[b] || letters[b] !== letters[c] ? 1 : 0

  let before = 0
  for (let t = 0; t < triCount; t++) {
    before += spans(idx.getX(t * 3), idx.getX(t * 3 + 1), idx.getX(t * 3 + 2))
  }
  if (!readLetterWholeTriangles() || before === 0) {
    return { before, after: before, split: 0, tris: triCount }
  }

  /* THE SPLIT. `dup` maps (originalVertex, ownerLetter) -> the vertex index that
   * carries that pair. The original vertex keeps its own letter and is reused by
   * every triangle whose owner matches it, so a word with no boundary allocates
   * nothing at all and the shipped path for Rod/Extrude/Solid — where the stamp
   * is already a constant per mesh — is untouched by construction. */
  const attrs = Object.keys(geo.attributes)
  const extra: Record<string, number[]> = {}
  for (const k of attrs) extra[k] = []
  const newLetters: number[] = []
  const base = letters.length
  const dup = new Map<string, number>()
  let split = 0

  const cloneWith = (v: number, owner: number): number => {
    const key = `${v}|${owner}`
    const hit = dup.get(key)
    if (hit !== undefined) return hit
    const at = base + newLetters.length
    for (const k of attrs) {
      const a = geo.attributes[k] as THREE.BufferAttribute
      const s = a.itemSize
      for (let c = 0; c < s; c++) extra[k].push(a.array[v * s + c] as number)
    }
    newLetters.push(owner)
    dup.set(key, at)
    split++
    return at
  }

  const out = new Uint32Array(idx.count)
  for (let t = 0; t < triCount; t++) {
    const i0 = idx.getX(t * 3)
    const i1 = idx.getX(t * 3 + 1)
    const i2 = idx.getX(t * 3 + 2)
    const l0 = letters[i0]
    const l1 = letters[i1]
    const l2 = letters[i2]
    let owner = l0
    if (l1 === l2) owner = l1
    else if (l0 === l2) owner = l0
    else if (l0 === l1) owner = l0
    const tri = [i0, i1, i2]
    for (let c = 0; c < 3; c++) {
      const v = tri[c]
      out[t * 3 + c] = letters[v] === owner ? v : cloneWith(v, owner)
    }
  }

  if (split > 0) {
    for (const k of attrs) {
      const a = geo.attributes[k] as THREE.BufferAttribute
      const s = a.itemSize
      const merged = new Float32Array(a.count * s + extra[k].length)
      merged.set(a.array as ArrayLike<number>, 0)
      merged.set(extra[k], a.count * s)
      geo.setAttribute(k, new THREE.BufferAttribute(merged, s, a.normalized))
    }
    const allLetters = new Float32Array(base + newLetters.length)
    allLetters.set(letters, 0)
    allLetters.set(newLetters, base)
    geo.setAttribute(FS_LETTER_ATTR, new THREE.BufferAttribute(allLetters, 1))
    geo.setIndex(new THREE.BufferAttribute(out, 1))
    /* THE STAMP MUST BE RE-READ FROM THE MERGED ARRAY, not from `letters`, or the
     * census below would grade the pre-split buffer and report a fix that did not
     * happen — the exact "green that cannot fail" shape this repo keeps finding. */
    let after = 0
    for (let t = 0; t < triCount; t++) {
      after += allLetters[out[t * 3]] !== allLetters[out[t * 3 + 1]] ||
        allLetters[out[t * 3 + 1]] !== allLetters[out[t * 3 + 2]]
        ? 1
        : 0
    }
    return { before, after, split, tris: triCount }
  }
  return { before, after: before, split: 0, tris: triCount }
}

/**
 * WHICH TIP SHAPE THE REVEAL DRAWS — the store now lives in
 * `lib/pen-reveal.ts` beside `PEN_TIP_SHAPES`, and this note says why.
 *
 * §2.8 of docs/DISPATCH.md: *"Open picks stay open. Sebs-only calls are kept as
 * dials and surfaced in prose with a recommendation. Never silently
 * defaulted."* Which end a pen leaves is exactly that kind of call — a
 * ballpoint's round nose and a brush's point are both true of real pens, and
 * Desk Doodles (the reference Sebs calls better) draws the pointed one.
 *
 * So all four are live and switchable, and `off` is the parked prior shape byte
 * for byte.
 *
 * ⚠ THIS FILE USED TO OWN THE VARIABLE, and its note said a subscriber was
 * deliberately absent because "nothing React renders reads it". Both facts
 * expired together when the panel got a control (`/desk-doodles` → "The pen's
 * tip"): a pill's active state IS React reading it. The value could not simply
 * gain a subscriber here, because the panel would then need a VALUE import of
 * this module — which `viewport-3d-wrapper.tsx` :11-24 documents as the thing
 * that drags three.js, R3F, drei and the GLTF exporter into the page's static
 * graph and undoes the `next/dynamic` split.
 *
 * So the store moved to a module the panel already imports, and this file
 * became one of its two readers. The frame loop's side is unchanged: it calls
 * `readPenTipMode()` every tick and writes three uniforms, so a change still
 * lands on the next painted frame with no re-render to miss.
 */

/** What `window.__heroJunctions` looks like when the hero page is mounted. */
interface HeroJunctionsGlobal {
  inkWidth: number
  breakK: number
  list: HeroJunctionInput[]
}

/* ═══ F118, THE DOUBLED INDEX — how one drawRange draws a wrapped Travel ═════
 *
 * A wrapped window is two parts, and on every stroke one part touches the
 * mark's start and the other its end (a track sits inside [0, 1], so the head
 * part `[0, h]` always starts at the stroke's first index and the tail part
 * `[w, 1]` always runs to its last). With the index joined to itself, the tail
 * then the head is ONE contiguous range, `[start(tail), N + end(head))`, and
 * triangles are independent, so nothing bridges the join.
 *
 * Swapped in only while the window wraps. Every other frame has the original
 * index object back, so grow, vanish, shrink and once-through Travel draw the
 * same arguments they always did. The copy is keyed on the original object
 * plus its `version` and rewritten in place, so a re-sort costs no new GPU
 * buffer. ⚠ Anything that reads `geo.index` while a wrap is on sees 2N: read
 * `originalIndex(geo)` for the count. */
const WRAP_ORIGINAL = new WeakMap<THREE.BufferGeometry, THREE.BufferAttribute>()
const WRAP_DOUBLED = new WeakMap<THREE.BufferAttribute, { version: number; attr: THREE.BufferAttribute }>()

/** The geometry's own index, whether or not the doubled copy is on. */
function originalIndex(geo: THREE.BufferGeometry): THREE.BufferAttribute | null {
  const cur = geo.index
  const orig = WRAP_ORIGINAL.get(geo)
  if (orig && cur && WRAP_DOUBLED.get(orig)?.attr === cur) return orig
  return cur
}

/* F118 TRAVEL-5, THE SECOND INDEX IS FREED WITH ITS GEOMETRY. three's dispose
 * handler deletes the GPU buffer of `geo.index` and of each named attribute,
 * so a wrapped geometry disposed with one index on left the other one's buffer
 * behind: one GPU buffer per wrapped rebuild, never deleted. The hook lends the
 * index that is NOT on to `geo.attributes` for the length of the dispose call,
 * so three's own loop deletes it, then takes it back. Once per geometry. */
const WRAP_OTHER = "__fsWrapIndexOther"
const WRAP_HOOKED = new WeakSet<THREE.BufferGeometry>()
function hookWrapDispose(geo: THREE.BufferGeometry) {
  if (WRAP_HOOKED.has(geo)) return
  WRAP_HOOKED.add(geo)
  const base = geo.dispose
  geo.dispose = function disposeWithWrapIndex(this: THREE.BufferGeometry) {
    const orig = WRAP_ORIGINAL.get(geo)
    const d = orig ? WRAP_DOUBLED.get(orig) : undefined
    const other = orig && d ? (geo.index === d.attr ? orig : d.attr) : null
    if (other) geo.setAttribute(WRAP_OTHER, other)
    try {
      base.call(this)
    } finally {
      if (other) geo.deleteAttribute(WRAP_OTHER)
      // A disposed geometry that is drawn again uploads afresh from its own index.
      if (orig && d && geo.index === d.attr) geo.setIndex(orig)
      if (orig) WRAP_DOUBLED.delete(orig)
      WRAP_ORIGINAL.delete(geo)
    }
  }
}

/** Put the doubled index on (`on`) or the original back. Returns the original. */
function wrapIndex(geo: THREE.BufferGeometry, on: boolean): THREE.BufferAttribute | null {
  const orig = originalIndex(geo)
  if (!orig) return null
  if (!on) {
    if (geo.index !== orig) geo.setIndex(orig)
    return orig
  }
  WRAP_ORIGINAL.set(geo, orig)
  hookWrapDispose(geo)
  const n = orig.count
  let d = WRAP_DOUBLED.get(orig)
  if (!d || d.attr.count !== n * 2) {
    const Ctor = orig.array.constructor as new (len: number) => Uint16Array | Uint32Array
    d = { version: -1, attr: new THREE.BufferAttribute(new Ctor(n * 2), 1) }
    WRAP_DOUBLED.set(orig, d)
  }
  if (d.version !== orig.version) {
    const arr = d.attr.array as Uint16Array | Uint32Array
    arr.set(orig.array as ArrayLike<number>, 0)
    arr.set(orig.array as ArrayLike<number>, n)
    d.attr.needsUpdate = true
    d.version = orig.version
  }
  if (geo.index !== d.attr) geo.setIndex(d.attr)
  return orig
}

function AnimatedStrokesInner({
  meshes,
  timelines,
  totalDuration,
  playheadRef,
  openingRef,
  revealMode,
  hybridBlend,
  strokes,
  exportGroupRef,
  styleState,
  bounds,
  lighting = FREE_STROKE.lighting,
  flattenSrc,
  canvasWidth,
  canvasHeight,
  stillExport = false,
  solidParams,
  letterMap,
  schedule,
  timed = null,
  takeKnockout = null,
  revealWindow,
  keyReader,
}: {
  meshes: StrokeMeshData[]
  timelines: StrokeTimeline[]
  /**
   * WHICH INTERVAL of the schedule is on screen — `lib/stroke-schedule.ts` §1b.
   *
   * Omitted, or `mode: "grow"`, and the reveal is the PREFIX it has always
   * been: `lo` is 0 at every playhead, so the trailing binary search is never
   * run, the trailing fragment test's uniform stays 0, and `setDrawRange` is
   * handed the same two arguments. Step 3's negative control is the same
   * property of the wiring step 2's was.
   */
  revealWindow?: RevealWindowParams
  /**
   * WHICH part of the mark is drawn when — `lib/stroke-schedule.ts`.
   *
   * Omitted, or `identity`, and **not one line of the scheduling path
   * executes**: the keys are left alone, the index buffer is left alone, the
   * tip field is left alone, Rod keeps its own per-stroke clock and the rebuild
   * path keeps `filterStrokesByProgress`. That is not an optimisation, it is
   * how the byte-identical negative control the map §8 demands is a property of
   * the wiring rather than of a test.
   */
  schedule?: StrokeSchedule | null
  /** ANIM-1A2. The per-stroke timed take, or null (no rows, the shipped path).
   *  Under it the keys are arrival times on the take's clock and the beat IS
   *  the playhead. `lib/stroke-timing.ts`. */
  timed?: TimedSchedule | null
  /** Dev only, for the browser gate's must-fails. `"slope"` reads the tip's
   *  slope channel as 1; `"clock"` reads the beat off `performance.now()`. */
  takeKnockout?: string | null
  totalDuration: number
  playheadRef: React.MutableRefObject<number> // 0..1 progress
  /** F118: the opening pass of a seamless Travel. See `openingRef` in Scene. */
  openingRef?: React.MutableRefObject<boolean>
  revealMode: RevealMode
  hybridBlend: number
  /** The FULL processed strokes. Read only to map the playhead's TIME fraction
   *  to the DISTANCE the pen had covered — the same `penTimeDistanceFraction`
   *  the rebuild path used, so Natural / Authentic / Smooth keep meaning what
   *  they meant. Never drives geometry from here. */
  strokes: ProcessedStroke[]
  exportGroupRef: React.RefObject<THREE.Group | null>
  styleState?: StyleState
  /** Object-space stroke bounds — lets the shine-sweep band normalize its
   *  travel to the drawing's actual size. Read-only; never drives geometry. */
  bounds?: StrokeBounds | null
  /** Register lighting — read here only for `rim`, which is a MATERIAL
   *  decoration rather than a scene light. */
  lighting?: RegisterLighting
  /**
   * How far the form is driven back toward being a drawing. See `FlatState`.
   *
   * A REF, not a value, and the block at `bumpOverride` below carries the
   * measurement that made it one: a fresh object per pose re-created every R3F
   * element under this component ~120 times a second. Omitted → fully solid, so
   * every existing call site is unchanged.
   */
  flattenSrc?: React.MutableRefObject<FlatState>
  /**
   * The SAME two numbers `useStrokeMeshes` was built with.
   *
   * Read for one thing only: `strokeTo3D` maps stroke coordinates into the
   * scene as `(x − W/2)·3/max(W,H)`, so the junction points the page publishes
   * in stroke coordinates have to travel through the identical map or K7's
   * breaks would open next to the ink instead of in it. Passed rather than
   * recomputed for exactly that reason — this is the transform whose two
   * copies would drift.
   */
  canvasWidth: number
  canvasHeight: number
  /** Own `STILL_EXPORT.grab`. FALSE on the 3-Up compare's slave canvases, so
   *  three scenes do not race to be the one the Export button talks to. */
  stillExport?: boolean
  /**
   * Read for ONE number: `thickness`, which is what the Inflate builder sizes
   * the mark from and therefore the nib half-width the TIP FIELD has to be
   * rasterised at. Never drives geometry from here — the geometry was built
   * from this same object by `useStrokeMeshes`, several props up.
   */
  solidParams?: SolidParams
  /**
   * O5's other half: which letter each stroke belongs to. See `LetterMap` and
   * `buildLetterGeometry`. Omitted → no cascade is possible and the per-letter
   * shader pass stays at `count 0`, which is an identity on every channel.
   */
  letterMap?: LetterMap
  /** ANIM-3B · keyed depth and turn, sampled per frame at the flat-state fold. */
  keyReader?: KeyReader
}) {
  // Refs to all tube meshes for drawRange updates
  const tubeMeshRefs = useRef<(THREE.Mesh | null)[]>([])
  /* ---- flat state ----
   * Read on the frame loop, so it goes through a ref rather than being closed
   * over: the material is re-pinned to its base every frame by the block below,
   * and a stale closure would apply last frame's flatness to this frame's
   * surface — visible as the ink lagging the depth by one frame at exactly the
   * moment they are meant to be staggered on purpose.
   *
   * ── IT ARRIVES AS A REF, AND THAT IS THE WHOLE PERFORMANCE FIX ────────────
   *
   * Explainer 20 §10 handed this on by name: after the field build left the main
   * thread, the residual was "Viewport3D's own React commit per pose". Measured
   * 2026-08-04 on the gesture he actually makes — load, PLAY, watch the whole
   * 12.37 s beat, scrub, switch the pills — at deviceScaleFactor 2 through the
   * real page (`scripts/verify/_probe-viewport-commit.mjs`), the top of the JS
   * profile was not geometry and not three.js. It was **React building elements**:
   * `jsxDEV` 607.8 ms + `jsxDEVImpl` 372.6 + `createElement` 128.5 +
   * `ReactElement` 62.9 + `jsx` 49.7 = **1.22 s** of an 18.7 s take, against
   * `WebGLRenderer.render` at 50.8 ms.
   *
   * The cause is one object. `flatten` is a fresh `FlatState` on every pose (the
   * page's own `useMemo` over `sample.*`), so its identity changes ~120 times a
   * second, so this component and every R3F element under it — 22 meshes on the
   * hero word — were re-created every frame. Nothing rendered here reads the
   * VALUE: `flatten` is consumed in exactly one place, the frame loop below.
   *
   * So the value comes in through a REF whose identity never moves, and the
   * component is `memo`-wrapped. A pose is now a ref write and nothing else.
   *
   * ⚠ THE DEV OVERRIDE HAD TO MOVE WITH IT. It used to be folded once per
   * RENDER; a component that no longer renders per pose would have frozen the
   * override on top of a stale pose. It is folded per FRAME instead, at the one
   * site that reads the state. In production `readFlatOverride()` returns null,
   * so the fold is a null check and allocates nothing. The subscription below
   * stays: it is what re-renders this subtree when a probe drives a channel, and
   * removing it would put back the dead-instrument failure its own note records.
   */
  const [, bumpOverride] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    flatOverrideSubs.add(bumpOverride)
    return () => {
      flatOverrideSubs.delete(bumpOverride)
    }
  }, [bumpOverride])
  /** The group that carries the depth collapse. Sits OUTSIDE `exportGroupRef`
   *  so a GLB export never inherits it — the exported model is the real form,
   *  whatever the beat is currently doing on screen. */
  const flattenGroupRef = useRef<THREE.Group | null>(null)
  /** `uRimStrength` from the ported fresnel rim, captured at compile so the rim
   *  can be driven to zero for the flat state. A drawing has no rim light. */
  const rimUniformRef = useRef<{ value: number } | null>(null)
  /** `uRimPower` from the same ported rim, captured on the same chain link.
   *  See `RIM_BASE_POWER` — the exponent is the rim's WIDTH, and the width is
   *  why the rim is currently invisible. */
  const rimPowerUniformRef = useRef<{ value: number } | null>(null)
  /** K7's break uniforms, captured the same way and written once a frame. */
  const breakUniformsRef = useRef<JointBreakUniforms | null>(null)
  /** The pen carve's uniforms, captured at compile like the break's. */
  const penUniformsRef = useRef<PenCarveUniforms | null>(null)
  /** The baked pen field, its GPU texture, and the identity that invalidates
   *  both. Built LAZILY — the bake is ~200 ms for the hero word and the lab
   *  page never carves, so it must not be paid on mount. */
  const penFieldRef = useRef<{
    strokes: ProcessedStroke[] | null
    sig: string
    texture: THREE.DataTexture | null
    box: THREE.Vector4
    units: number
    /** The nib half-width the field was baked at, STROKE units. The envelope
     *  correction is quoted in nib radii, so it cannot be turned into a distance
     *  without it — see `PEN_CARVE_ENVELOPE_R`. */
    radius: number
    /** THE SIZE THE GL STORAGE WAS ACTUALLY ALLOCATED AT. See
     *  `PEN_FIELD_IMMUTABLE_STORAGE` — a `DataTexture`'s dimensions are fixed
     *  at its first upload, so this is the only number that says what the
     *  sampler's 0..1 actually spans. */
    texW: number
    texH: number
  } | null>(null)
  /** O5's per-letter uniforms, captured at compile like the carve's. */
  const letterUniformsRef = useRef<LetterUniforms | null>(null)
  /** The pen TIP's uniforms, captured at compile like the carve's. */
  const penTipUniformsRef = useRef<PenTipUniforms | null>(null)
  /** The baked tip field and the identity that invalidates it. Built LAZILY on
   *  the first frame of a PARTIAL reveal — a page that never draws in (an
   *  export still, a settled hero) must not pay for it, and at 21 ms for the
   *  hero word it is an order of magnitude under the pen field's bake, so it
   *  does not need the worker the carve needed. */
  const tipFieldRef = useRef<{
    strokes: ProcessedStroke[] | null
    sig: string
    texture: THREE.DataTexture | null
    box: THREE.Vector4
    /** Arc fraction → local units, and the nose/taper scale in arc fraction. */
    arcToLocal: number
    radiusArc: number
    /** The size the GL storage is allocated at — see `setFieldRealloc`. */
    texW: number
    texH: number
    /**
     * The `arc` channel AS BAKED, before any schedule touched it.
     *
     * Kept because a schedule change has to remap from the RECORDING, never
     * from the last remap — composing two schedules would be the same class of
     * error as shading a colour in place, which the flat-ink block a few hundred
     * lines up records having to be unpicked once already.
     */
    baseData: Float32Array | null
    /** Which schedule the live `data` is currently expressed in. */
    schedSig: string
    /** ANIM-1A3. Under a timed take, `|dS/da|` per texel (R32F) and its max.
     *  Null texture and 1 everywhere else: the shipped path never reads it. */
    slopeTex: THREE.DataTexture | null
    slopeMax: number
    /** F121. Where a performed stroke stands still: up to `TIP_HOLD_MAX` pen
     *  points in the field's local plane, `(x, y, t0, t1)` with the times as take
     *  fractions, and how many are live. 0 on every bake without a performed
     *  pace, which leaves the shader's test the shipped one. */
    holds: THREE.Vector4[]
    holdN: number
    /** The lengths the hold radius is built from, in local units: one nib
     *  half-width, the word's longest segment, one field texel. */
    radiusLocal: number
    segMaxLocal: number
    texelLocal: number
  } | null>(null)
  /* ═══ THE SCHEDULE, APPLIED — one entry per mesh ════════════════════════════
   *
   * ⚠ CHECKED IN THE FRAME LOOP AND NOT IN AN EFFECT, and that is the whole
   * lesson of explainer 24. A deferred build refills the live `BufferGeometry`
   * IN PLACE and patches `StrokeMeshData.revealKeys` by hand, because *"React
   * will not re-render when a worker finishes"* — so no dependency list can see
   * it, and an effect keyed on `meshes` would leave a permuted index buffer
   * describing a surface that has been replaced. Two integers and a comparison
   * in the common case; the work runs exactly once per rebuild or per dial. */
  const schedRef = useRef<
    {
      /** The keys array identity a rebuild replaces — the only rebuild signal. */
      baseKeys: Float32Array | null
      sig: string
      /** The permutation currently applied to this geometry's index buffer. */
      applied: Uint32Array | null
      /** The keys the reveal must binary-search this frame. */
      keys: Float32Array | null
      scratch: Uint32Array | null
    }[]
  >([])
  /* MIRRORED AT RENDER TIME, read in the frame loop. The same rule
   * `revealEaseRef` follows: the loop runs between renders and a value captured
   * in a closure is the value as of the last one. */
  const scheduleRef = useRef<StrokeSchedule | null>(schedule ?? null)
  scheduleRef.current = schedule ?? null
  /* ANIM-1A6 · AN IDENTITY TAKE IS DRAWN BY THE SHIPPED PATH. Rows that moved
   * nothing (`TimedSchedule.identity`) leave the frame loop, the keys and the
   * tip bake on the code no rows reaches, so neutral rows are the no-rows frame
   * by construction on every engine. The host still sees the take. */
  const timedLive = timed && !timed.identity ? timed : null
  const timedRef = useRef<TimedSchedule | null>(timedLive)
  timedRef.current = timedLive
  const takeKnockoutRef = useRef<string | null>(takeKnockout)
  takeKnockoutRef.current = takeKnockout
  /* THE WINDOW, mirrored for the same reason. It is PARAMS and not an interval:
   * the interval is a function of the playhead and the playhead moves inside
   * the loop, so caching the interval here would pin it to the last render. */
  const windowParamsRef = useRef<RevealWindowParams>(revealWindow ?? REVEAL_WINDOW_DEFAULTS)
  windowParamsRef.current = revealWindow ?? REVEAL_WINDOW_DEFAULTS
  /** The break TABLE, and the two inputs whose identity says it is stale.
   *  Rebuilt from `window.__heroJunctions` rather than memoised on render,
   *  because the page publishes that global in an EFFECT — a render-time memo
   *  keyed on the strokes would read the previous word's junctions on the one
   *  render where the word changed, and then never look again. */
  const breakTableRef = useRef<{
    /** Identity of every input whose change invalidates the table. */
    junctions: HeroJunctionInput[] | null
    strokes: ProcessedStroke[] | null
    sig: string
    /** 3 vec4 per junction, in the flatten group's local frame. */
    data: Float32Array
    count: number
    /** Half-width the stroke in front keeps, LOCAL units. */
    keep: number
    /** Paper either side of it at full open, LOCAL units. */
    gap: number
    /** Sample half-span, LOCAL units — sizes the early-out disc. */
    reach: number
  } | null>(null)
  const flatInkRef = useRef(new THREE.Color("#121110"))
  /** The unshaded register ink, and the hex it was parsed from. See the shade
   *  block in the frame loop for why this is kept apart from `flatInkRef`. */
  const flatInkBaseRef = useRef(new THREE.Color("#121110"))
  const flatInkBaseHexRef = useRef<string>("#121110")
  /** The turn's pivot, in the flatten group's own local space. Measured from
   *  the group's children on first use; cleared when the meshes change, or the
   *  turn would keep rotating a new word about the old one's centre. */
  const pivotRef = useRef<THREE.Vector3 | null>(null)
  useEffect(() => {
    pivotRef.current = null
  }, [meshes])
  const BLACK = useRef(new THREE.Color(0, 0, 0)).current
  // Refs to end cap meshes
  const endCapRefs = useRef<(THREE.Mesh | null)[]>([])
  // Refs to start cap meshes
  const startCapRefs = useRef<(THREE.Mesh | null)[]>([])
  // Refs to joint groups (one group per stroke)
  const jointGroupRefs = useRef<(THREE.Group | null)[]>([])

  /* ANIM-3C-W · ROD WIDTH, PER FRAME. Every Rod tube vertex is `centre +
   * TUBE_RADIUS * normal`, so a width key moves each vertex along its own normal
   * by `rodNormalOffset(w)`, from a copy of the positions as built, and the caps
   * and joints scale by `w`. No width keys and nothing widened: one check and
   * out, the shipped path. Back at 1, the built positions are copied back bit
   * for bit and the caps and joints go back to scale 1. The applied width is
   * kept per position buffer, so a rebuilt tube gets the current width too. */
  const rodBaseRef = useRef(new WeakMap<THREE.BufferAttribute, Float32Array>())
  const rodAppliedRef = useRef(new WeakMap<THREE.BufferAttribute, number>())
  const rodWidenedRef = useRef(false)
  useFrame(() => {
    const w = keyReader?.keys.width?.length ? (widthForFrame("rod", keyReader.keys, keyReader.clockMs()) ?? 1) : 1
    if (w === 1 && !rodWidenedRef.current) return
    for (let si = 0; si < meshes.length; si++) {
      if (meshes[si].mode !== "rod") continue
      const geo = tubeMeshRefs.current[si]?.geometry
      const pos = geo?.getAttribute("position") as THREE.BufferAttribute | undefined
      const nor = geo?.getAttribute("normal") as THREE.BufferAttribute | undefined
      if (!pos || !nor) continue
      if (rodAppliedRef.current.get(pos) !== w) {
        let base = rodBaseRef.current.get(pos)
        if (!base) {
          base = (pos.array as Float32Array).slice()
          rodBaseRef.current.set(pos, base)
        }
        widenAlongNormals(base, nor.array, rodNormalOffset(w), pos.array as Float32Array)
        pos.needsUpdate = true
        rodAppliedRef.current.set(pos, w)
      }
      startCapRefs.current[si]?.scale.setScalar(w)
      endCapRefs.current[si]?.scale.setScalar(w)
      const joints = jointGroupRefs.current[si]?.children
      if (joints) for (let ji = 0; ji < joints.length; ji++) joints[ji].scale.setScalar(w)
    }
    rodWidenedRef.current = w !== 1
  })

  // ---- Material (IMPLEMENTED v1)----------------------------------------
  // A single live MeshPhysicalMaterial driven by styleState.materialPreset.
  // Replaces the old static module-level `strokeMaterial`/`inflateMaterial`:
  // the preset (incl. per-mode defaults chosen in the app) now decides the
  // surface, so every mesh in this component shares one preset-driven material.
  const materialPreset = styleState?.materialPreset ?? "ink"
  const customMaterial = styleState?.customMaterial
  // Scalar, not the object, so the material memo re-runs on a real change of
  // intent rather than on every new register object identity.
  const rimEnabled = lighting.rim
  // Procedural texture v1: uniform objects live in a ref so they survive
  // material re-creation (preset switches) and per-frame writes go straight to
  // the GPU without touching React state or the material itself.
  const textureUniformsRef = useRef<TextureUniforms | null>(null)
  if (textureUniformsRef.current === null) {
    textureUniformsRef.current = createTextureUniforms()
  }
  // Shine-sweep band uniforms (animated material "shineSweep"): the travelling
  // highlight is positional, so it lives in the shader; the CPU only writes the
  // band's center each frame. Same survives-material-recreation contract.
  const sweepUniformsRef = useRef<SweepUniforms | null>(null)
  if (sweepUniformsRef.current === null) {
    sweepUniformsRef.current = createSweepUniforms()
  }
  const ditherUniformsRef = useRef<DitherUniforms | null>(null)
  if (ditherUniformsRef.current === null) {
    ditherUniformsRef.current = createDitherUniforms()
  }
  const asciiUniformsRef = useRef<AsciiUniforms | null>(null)
  if (asciiUniformsRef.current === null) {
    asciiUniformsRef.current = createAsciiUniforms()
  }
  // ONE clock for every animated style layer. Each layer asks it for a phase
  // rather than accumulating its own time, so layers can share a loop, stagger
  // by delay, or fire together on reveal completion.
  const stackUniformsRef = useRef<StackUniforms | null>(null)
  if (stackUniformsRef.current === null) {
    stackUniformsRef.current = createStackUniforms()
  }
  // Holds each layer's phase at the moment freezeOnComplete engaged.
  const frozenPhaseRef = useRef<{ tex: number; dit: number; asc: number } | null>(null)
  // When the current stack-animation behaviour was switched on. Scene-relative
  // behaviours (fade, drift, loop) measure from here, so enabling one mid-session
  // actually plays instead of starting already finished.
  const stackArmRef = useRef<{ key: string; at: number }>({ key: "", at: 0 })
  // When the current FUSION preset (or its animated flag) was selected.
  // Choreographies measure from here as well as from the reveal, so picking an
  // animated fusion on a long-finished stroke still PLAYS its build instead of
  // showing a build that had always already finished.
  const fusionArmRef = useRef<{ key: string; at: number }>({ key: "", at: 0 })
  // Per-LAYER arming, one per animated system, plus one for the material
  // animation. Same rule as the stack and fusion refs above, applied at the
  // grain where the user actually makes the choice: every free-running and
  // completion-driven layer mode measures from the moment its behaviour was
  // selected rather than from scene start. Keys deliberately exclude speeds and
  // intensities so dragging a dial does not restart the phase.
  /* K2 · KEYED STYLE. The keys the frame samples are the doc's, less the paths
   * no key drives (`KEY_DISABLED`, lib/keyframes.ts, each with its reason), and
   * the style values they key (any numeric leaf of StyleState, KEYABLE_PATHS)
   * are found once per set of keys. With none, the frame reads `styleState`
   * itself, exactly as before K2. */
  const frameStyleKeys = useMemo(() => (KEY_MUTANT === "nodisable" ? keyReader?.keys : framedKeys(keyReader?.keys)), [keyReader])
  const keyedStylePaths = useMemo(() => {
    const out = new Set<string>()
    if (frameStyleKeys) for (const kp of KEYABLE_PATHS) if ((frameStyleKeys[kp.path]?.length ?? 0) > 0) out.add(kp.path)
    return out
  }, [frameStyleKeys])
  /* The running sums of the three shader layers' keyed speeds (see
   * `runningLayerTime`): a keyed speed bends the loop, never jumps it. */
  const texRunRef = useRef<RunningPhase>(createRunningPhase())
  const ditRunRef = useRef<RunningPhase>(createRunningPhase())
  const ascRunRef = useRef<RunningPhase>(createRunningPhase())
  const matRunRef = useRef<RunningPhase>(createRunningPhase())
  const texArmRef = useRef<ArmState>(createArmState())
  const ditArmRef = useRef<ArmState>(createArmState())
  const ascArmRef = useRef<ArmState>(createArmState())
  const matAnimArmRef = useRef<ArmState>(createArmState())
  // True while fusion has overridden the sweep-band direction — lets the next
  // non-fusion frame restore the default axis instead of leaking it.
  const fusionSweepDirRef = useRef(false)
  /* ⚠ THREE MATERIAL LEVERS RECOMPILE THE SHADER WHEN THEY CROSS ZERO, AND
   * FUSION DRIVES ALL THREE ACROSS ZERO EVERY FEW SECONDS.
   *
   * `MeshPhysicalMaterial`'s setters for `clearcoat`, `sheen` and `iridescence`
   * each read (three r175, three.core.js:37923 / :37999 / :37949):
   *
   *     if ( this._clearcoat > 0 !== value > 0 ) this.version ++
   *
   * — because the feature is a `#define`, so switching it on or off is a program
   * change, not a uniform write. A fusion link driven by a SIGNED source sits at
   * exactly that boundary: `gloss` on a body whose clearcoat base is 0 passes
   * through zero twice per breath, so the material's program is rebuilt roughly
   * every two and a half seconds for as long as the fusion is selected. Nothing
   * reports it — the picture is correct, and the cost is a compile stall that
   * looks like unrelated jank.
   *
   * Found while wiring `iridescence`, which would have been the fourth. The cure
   * is to LATCH: once a fusion frame has driven one of these levers, hold it
   * strictly above zero for as long as that fusion is active, so the crossing
   * happens ONCE on selection and once on deselection instead of on a loop. The
   * floor is a value the eye cannot see and the `> 0` test can. */
  const fusionLeverLatchRef = useRef({ clearcoat: false, sheen: false, iridescence: false })
  const styleClockRef = useRef<StyleClock | null>(null)
  if (styleClockRef.current === null) {
    styleClockRef.current = createStyleClock()
  }
  /**
   * THE WALL CLOCK AN EXPORTER DISPLACED — non-null exactly while one owns it.
   *
   * `STYLE_CLOCK_DRIVE` hands the exporter a time in FILM coordinates: frame 0
   * is 0 ms. `clock.elapsed` is in SCENE coordinates and is whatever the page
   * has been running for — a minute, an hour. Seeking one to the other is a
   * rewind, and `advanceStyleClock` rejects a negative delta by design (a
   * backwards shared clock re-fires every one-shot beneath it). So the export
   * does not seek the scene clock; it TAKES it, zeroed, and gives it back.
   *
   * Zeroed rather than offset, because "reproducible" has to mean reproducible
   * across sessions: a film whose texture phase started at whatever second the
   * page happened to be at is a different film every time you press the button,
   * which is the exact defect this whole mechanism exists to remove.
   */
  const driveHoldRef = useRef<{ elapsed: number } | null>(null)

  /* prefers-reduced-motion, FOR THE STYLE LAYERS.
   *
   * app/globals.css honours the query for exactly two UI classes (a panel entry
   * animation and a button press). Nothing honoured it for the WebGL loop — so
   * every animated texture / dither / ASCII / layer-stack / material preset ran
   * at full amplitude regardless, and one of them, Terminal Flicker, is a
   * DELIBERATE 12.9 Hz whole-cell re-roll (measured: frozenFrac 0.893, jump 8.4).
   * A hard tick in the 4-20 Hz band is the photosensitivity case the media query
   * exists for, so this is not a taste question.
   *
   * WHAT REDUCED MOTION MEANS HERE, and why it is not "switch the layer off".
   * The rule is gentler, never absent: keep the graphic, drop the movement. That
   * behaviour already exists and is already the tested path — motionMode "off"
   * resolves through resolveSyncMode to animated:false, and evaluateLayerTime
   * then returns resting(phase): amount 1 (the layer renders exactly as its own
   * controls say) with the phase parked. So honouring the query is precisely
   * "treat motionMode as off", and a user who has asked for less motion still
   * sees the dot screen, the glyphs and the grain — just not travelling.
   *
   * Read through a ref rather than state: it is consumed inside useFrame, and a
   * state update per change would re-render the whole viewport for a value only
   * the render loop reads. The listener keeps it live, so toggling the OS setting
   * takes effect without a reload. */
  const reduceMotionRef = useRef(false)
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    reduceMotionRef.current = mq.matches
    const onChange = () => { reduceMotionRef.current = mq.matches }
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])
  const liveMaterial = useMemo(() => {
    const base = resolveMaterialParams(materialPreset, customMaterial)
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(base.color),
      roughness: base.roughness,
      metalness: base.metalness,
      clearcoat: base.clearcoat,
      clearcoatRoughness: base.clearcoatRoughness,
      reflectivity: base.reflectivity,
      sheen: base.sheen,
      sheenRoughness: base.sheenRoughness,
      sheenColor: new THREE.Color(base.sheenColor),
      emissive: new THREE.Color(base.emissive),
      emissiveIntensity: base.emissiveIntensity,
      envMapIntensity: base.envMapIntensity,
      iridescence: base.iridescence ?? 0,
      iridescenceIOR: base.iridescenceIOR ?? 1.3,
      // With no iridescenceThicknessMap bound, three.js uses [1] as a CONSTANT
      // film thickness and ignores [0] — so this is a thickness, not a range.
      // Static per preset (no animation touches it), so creation-only.
      iridescenceThicknessRange: base.iridescenceThicknessRange ?? [100, 400],
    })
    // Every style layer rides the same shared material across all four modes.
    applyStyleShader(mat, {
      texture: textureUniformsRef.current!,
      sweep: sweepUniformsRef.current!,
      dither: ditherUniformsRef.current!,
      ascii: asciiUniformsRef.current!,
      stack: stackUniformsRef.current!,
    })
    // FRESNEL RIM — Desk Doodles' `applyRimGlow`, ported (components/studio-rig.tsx).
    // MUST run after applyStyleShader: it chains onto the existing
    // onBeforeCompile, and its own `#include <dithering_fragment>` replace has
    // to land on the string the style layers already produced so the rim ends
    // up immediately BEFORE the include, exactly as it does in Desk Doodles.
    // Applied only when the register asks for it — Free Stroke's gloss presets
    // separate their own edges, and a second warm rim on top would double it.
    if (rimEnabled) {
      applyRimGlow(mat)
      // CAPTURE THE RIM'S OWN UNIFORM, one more link on the same chain the
      // ported rim itself uses. The flat state has to be able to switch the rim
      // OFF: a fresnel edge light is a statement that the silhouette is the
      // grazing edge of a solid, which is exactly the claim a drawing does not
      // make. Zeroing the strength is a no-op on the compiled program (the term
      // is still there, multiplied by zero), so it costs no recompile and no
      // second material. `studio-rig.tsx` stays untouched — the port convention
      // there is that Desk Doodles' code is not edited, only chained onto.
      const prev = mat.onBeforeCompile
      mat.onBeforeCompile = (shader, renderer) => {
        prev?.call(mat, shader, renderer)
        rimUniformRef.current = shader.uniforms.uRimStrength as { value: number }
        // The WIDTH, on the same link. Captured rather than edited into the
        // port for the reason the strength is: `studio-rig.tsx` stays
        // byte-identical to Desk Doodles and the hero's own law lives in the
        // hero's own file. If the port ever drops the uniform this ref stays
        // null and the rim simply keeps its ported 2.6, which is the correct
        // fallback.
        rimPowerUniformRef.current = (shader.uniforms.uRimPower as { value: number }) ?? null
      }
    } else {
      rimUniformRef.current = null
      rimPowerUniformRef.current = null
    }
    /* K7's PAPER BREAK — last on the chain, so its `#include <common>` and
     * `#include <clipping_planes_fragment>` replacements land on the string the
     * style layers and the rim have already produced. It touches neither of
     * their injection points. */
    breakUniformsRef.current = null
    penUniformsRef.current = null
    penTipUniformsRef.current = null
    letterUniformsRef.current = null
    /* MULTISAMPLE COVERAGE, so the break's edges are the same kind of edge the
     * mark's own silhouette has. It is INERT while nothing is cut: coverage is
     * 1, alpha is 1, and a full alpha writes an all-ones sample mask, so the
     * render is unchanged pixel for pixel — proved rather than asserted, in
     * `docs/verification/hero-k7/aa-control/`. */
    mat.alphaToCoverage = true
    applyJointBreak(mat, (u) => {
      breakUniformsRef.current = u
    })
    /* THE PEN CARVE, chained after the break — same injection points, same
     * coverage mechanism, and it reuses the break's `vFsBreakWorld` varying
     * rather than computing a second identical one. Inert at carve 0. */
    applyPenCarve(mat, (u) => {
      penUniformsRef.current = u
    })
    /* THE PEN TIP, chained third — same injection points, same coverage
     * mechanism, same reused varying. Inert whenever the reveal is complete or
     * the mode is `off`, so every settled frame in the verification battery is
     * unchanged by construction rather than by inspection. */
    applyPenTip(mat, (u) => {
      penTipUniformsRef.current = u
    })
    /* O5's PER-LETTER MOTION, and it MUST BE LAST on this chain. Its whole
     * mechanism is that its `<project_vertex>` replace lands on the string the
     * break has already prefixed with `vFsBreakWorld = ...`, so the field
     * varying is captured BEFORE a letter turns and the carve, break and tip
     * keep reading the unmoved mark. Chained anywhere earlier, the varying
     * would carry the moved position and all three passes would smear. See
     * `applyLetterMotion`. */
    applyLetterMotion(mat, (u) => {
      letterUniformsRef.current = u
    })
    return mat
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialPreset, customMaterial, rimEnabled])

  // Dispose the material when the preset changes / on unmount to avoid GPU leaks.
  useEffect(() => {
    return () => {
      liveMaterial.dispose()
    }
  }, [liveMaterial])

  // Re-apply the static base whenever the preset changes (covers the case where
  // animation was running and left the material modulated, then preset switches).
  const baseParams = useMemo(
    () => resolveMaterialParams(materialPreset, customMaterial),
    [materialPreset, customMaterial],
  )

  /**
   * ROD'S NON-DEFAULT CAP/JOINT SPHERES, ALLOCATED PER RADIUS INSTEAD OF PER
   * RENDER — and this was a real, measured GPU leak, not a tidy-up.
   *
   * The two IIFEs in the JSX below used to read
   *
   *     const r = data.capRadius ?? TUBE_RADIUS
   *     const capGeo = r === TUBE_RADIUS ? sphereGeometry : new THREE.SphereGeometry(r, …)
   *
   * The equality arm hands back a module singleton and is free. The other arm
   * runs in the RENDER BODY, so it built a fresh geometry on every React render,
   * handed it to `<mesh geometry={…}>`, and dropped the one it replaced. R3F
   * does not dispose a geometry passed as a PROP — it only disposes objects it
   * constructed from JSX — and three frees a geometry's GL buffers ONLY from its
   * own `dispose` event (`WebGLGeometries.onGeometryDispose`). So nothing ever
   * freed them.
   *
   * `capRadius` is not an exotic path. It is set on EVERY Desk Doodles rod build
   * (`lib/dd-engine/adapter.ts:285`, `res.radius * k`) and on Extrude's rod
   * fallback (`lib/geometry-engines.ts:3052`), while `TUBE_RADIUS` is 0.012 — so
   * on those paths the equality is essentially never true.
   *
   * MEASURED, `scripts/verify/_probe-cap-geo-leak.mjs`, 40 style-only re-renders
   * of a 2-stroke mark in Rod mode, GL `createBuffer`/`deleteBuffer` counted from
   * an init script:
   *
   *     engine         geomBuilds   bufCreated   bufDeleted   NET LEAKED
   *     desk-doodles            0          320            0          320
   *     free-stroke             0            0            0            0
   *
   * Zero geometry builds in the window, so none of that is a legitimate rebuild;
   * 8 buffers per render, never freed. The free-stroke arm is the NEGATIVE
   * CONTROL — its rod path leaves `capRadius` undefined, takes the singleton, and
   * leaks exactly nothing — so the row can fail. The UI syncs progress at ~15 Hz
   * (`onProgressUpdate`), which is 120 orphaned buffers per second of playback.
   *
   * Keyed on `meshes`, which is the only thing that can change a radius, and the
   * previous map is disposed by the cleanup below — the same shape as the
   * material's own dispose effect directly above.
   */
  const rodSphereGeos = useMemo(() => {
    const cache = new Map<number, { cap: THREE.SphereGeometry; joint: THREE.SphereGeometry }>()
    for (const d of meshes) {
      if (d.mode !== "rod") continue
      const r = d.capRadius ?? TUBE_RADIUS
      if (r === TUBE_RADIUS || cache.has(r)) continue
      cache.set(r, {
        cap: new THREE.SphereGeometry(r, SPHERE_SEGMENTS, SPHERE_SEGMENTS),
        joint: new THREE.SphereGeometry(r, JOINT_SPHERE_SEGMENTS, JOINT_SPHERE_SEGMENTS),
      })
    }
    return cache
  }, [meshes])
  useEffect(() => {
    return () => {
      for (const g of rodSphereGeos.values()) {
        g.cap.dispose()
        g.joint.dispose()
      }
    }
  }, [rodSphereGeos])

  /**
   * ROD'S CAPS AND JOINTS, CLONED PER LETTER — the first half of the cap answer.
   *
   * `rodSphereGeos` above shares ONE sphere per radius across the whole word,
   * which is exactly right until a per-vertex attribute has to say which letter
   * a vertex belongs to. A shared sphere cannot carry two answers, so a cascade
   * running on that cache would stamp every cap and every joint in the word with
   * letter 0 and fling them across the page after the D.
   *
   * So when — and only when — a letter map is present, the spheres are cloned
   * per (radius, letter) and stamped. The cost is bounded by construction: at
   * most `FS_LETTER_MAX` letters times however many distinct radii the word has,
   * which on the hero word is 8 × 1. The alternative — one geometry per cap
   * POSITION — would be hundreds, which is why the offset is recovered in the
   * shader instead (`fsP`, the second half of the answer).
   *
   * `rodSphereGeos` is untouched and is still the path every other film takes,
   * so the leak measurement its own note records still holds where it was made.
   */
  const letterSphereGeos = useMemo(() => {
    if (!letterMap || letterMap.count <= 0) return null
    const cache = new Map<string, { cap: THREE.SphereGeometry; joint: THREE.SphereGeometry }>()
    const cap = Math.min(letterMap.count, FS_LETTER_MAX) - 1
    for (let si = 0; si < meshes.length; si++) {
      const d = meshes[si]
      if (d.mode !== "rod") continue
      const r = d.capRadius ?? TUBE_RADIUS
      const li = Math.min(letterMap.of[si] ?? 0, cap)
      const key = `${r}|${li}`
      if (cache.has(key)) continue
      const c = new THREE.SphereGeometry(r, SPHERE_SEGMENTS, SPHERE_SEGMENTS)
      const j = new THREE.SphereGeometry(r, JOINT_SPHERE_SEGMENTS, JOINT_SPHERE_SEGMENTS)
      stampConstantLetter(c, li)
      stampConstantLetter(j, li)
      cache.set(key, { cap: c, joint: j })
    }
    return cache
  }, [meshes, letterMap])
  useEffect(() => {
    if (!letterSphereGeos) return
    return () => {
      for (const g of letterSphereGeos.values()) {
        g.cap.dispose()
        g.joint.dispose()
      }
    }
  }, [letterSphereGeos])

  /**
   * THE LETTER ATTRIBUTE AND THE LETTER PIVOTS — stamped once per word, here
   * rather than inside `useStrokeMeshes`.
   *
   * `useStrokeMeshes` is the engine boundary and is shared by every mode, every
   * register and the export path; a hero-only attribute written inside it would
   * put O5 in the geometry contract. This effect is keyed on the meshes, so it
   * re-fires exactly when a rebuild produces new geometry to stamp and never on
   * a re-render that did not.
   *
   * ⚠ AND THAT SENTENCE WAS THE BUG. "A rebuild produces new geometry" is not
   * true on this path: an implicit rebuild that goes to the worker REFILLS THE
   * SAME `BufferGeometry` IN PLACE (`lib/implicit-defer.ts` `adoptBuffers`, and
   * that is the whole mechanism by which it reaches the screen without React).
   * None of these five deps moves when that lands, so the effect does NOT
   * re-fire — and `aFsLetter` was left describing the surface that had been
   * replaced. Measured: `position` 59 936 against `aFsLetter` 58 998 on the font
   * word, and WebGL validates a draw against EVERY enabled attribute, so the
   * driver dropped the whole call and the mark vanished entire from DRAW
   * 93.75 % onward. The refill now drops the stale attribute
   * (`IMPLICIT_REFILL_DROPS_STALE_ATTRS`), and `ensureLetterStamp` below puts a
   * correct one back before the next frame is drawn.
   */
  const letterPivotsRef = useRef<{ pivots: Float32Array; count: number; wordX: number } | null>(null)
  const restampLetters = useCallback(() => {
    letterPivotsRef.current = letterMap
      ? buildLetterGeometry(meshes, strokes, letterMap, canvasWidth, canvasHeight)
      : null
  }, [meshes, strokes, letterMap, canvasWidth, canvasHeight])
  useEffect(() => {
    restampLetters()
  }, [restampLetters])

  /**
   * THE STAMP MUST MATCH THE SURFACE IT IS ON — checked every frame, re-done
   * only when it does not.
   *
   * Two counters and a comparison in the common case; the expensive re-stamp
   * runs exactly once per in-place refill, which is the same work the effect
   * above would have done had React been able to see the refill at all.
   *
   * It is a FRAME-LOOP check and not another effect on purpose: the thing it is
   * reacting to is invisible to React by construction, so any dependency list
   * would have the same hole this one just had. `__inflateProbe.attrCensus()`
   * reads the same two numbers off the live buffers, so the gate grades the
   * object rather than this function's opinion of it.
   */
  const ensureLetterStamp = useCallback(() => {
    if (!letterMap || !readLetterStampFollowsRefill()) return
    for (const m of meshes) {
      const g = m.tubeGeometry
      const pos = g.getAttribute("position") as THREE.BufferAttribute | undefined
      if (!pos) continue
      const la = g.getAttribute(FS_LETTER_ATTR) as THREE.BufferAttribute | undefined
      if (la && la.count === pos.count) continue
      restampLetters()
      return
    }
  }, [meshes, letterMap, restampLetters])

  /* ---- THE STILL EXPORT ------------------------------------------------
   *
   * Registered from HERE, and not from <Viewport3D>, because this is where the
   * screen-space layers' uniform objects live. The full reasoning is on
   * `STILL_EXPORT`; the short version is that a picture taken at 4x without
   * scaling the ASCII cell and the dither/texture frequency with it is a
   * DIFFERENT picture from the one on screen, and an export that does not match
   * the viewport is worse than no export.
   *
   * Selector form of `useThree` on purpose: the object form subscribes this
   * subtree to the whole R3F store, so every resize would re-render the mesh
   * list. These three slices never change identity. */
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const defaultCamera = useThree((s) => s.camera)
  useEffect(() => {
    if (!stillExport) return
    /* ONE RENDER, TWO WRAPPERS. Everything that makes an export faithful — the
     * screen-locked compensation, the chrome hide, the buffer resize and its
     * restore — happens exactly once, here. `grab` adds a PNG encode for the
     * still; `grabCanvas` adds nothing, for the animated export's inner loop. */
    const renderStill = (opts: StillOptions): StillCanvas | null => {
      const canvas = gl.domElement
      const size = gl.getSize(new THREE.Vector2())
      if (size.x < 1 || size.y < 1) return null
      const dpr = gl.getPixelRatio()

      /* The scale is CLAMPED, not trusted. `STILL_MAX_EDGE` explains why, and
       * the caller is handed the size that actually came out so the toast can
       * say so rather than repeat the request back. */
      const want = Math.max(1, opts.scale)
      const cap = STILL_MAX_EDGE / Math.max(size.x, size.y)
      const scale = Math.max(1, Math.min(want, cap))

      /* Compensate the screen-locked layers for the new device-pixel density.
       * OBJECT-locked layers are resolution-independent by construction and are
       * deliberately left alone — checking the lock uniform rather than scaling
       * unconditionally is the difference between a faithful export and a
       * silently re-scaled pattern. */
      const asc = asciiUniformsRef.current!
      const dit = ditherUniformsRef.current!
      const tex = textureUniformsRef.current!
      const k = scale / dpr
      const savedAscCell = asc.uFsAscCell.value
      const savedDitScale = dit.uFsDitScale.value
      const savedTexScale = tex.uFsTexScale.value
      // `off` parks the naive grab — the same render at a bigger buffer, with
      // the screen-locked layers left to get finer. It is the negative control
      // for `assert-still-export.mjs`'s "the export matches the viewport" row.
      const compensate = readDevLaw("__fsStillCompensate", ["off"], "on") === "on"
      if (compensate && asc.uFsAscLockScreen.value > 0.5) asc.uFsAscCell.value *= k
      if (compensate && dit.uFsDitLockScreen.value > 0.5) dit.uFsDitScale.value *= k
      // Texture's screen path is `gl_FragCoord * 0.012 * uFsTexScale`, i.e. the
      // frequency MULTIPLIES rather than divides — so this one goes the other
      // way. Written out rather than folded into a shared helper, because the
      // two directions are exactly the kind of thing a shared helper gets wrong.
      if (compensate && tex.uFsTexLockScreen.value > 0.5)
        tex.uFsTexScale.value = savedTexScale / k

      /* Viewport chrome is not part of the picture. The grid always goes; the
       * contact pool goes only on a transparent ground, following the rule this
       * file already states at <StudioContactShadow>: on a see-through ground a
       * shadow patch reads as dirt rather than as contact. */
      const restoreVisible: THREE.Object3D[] = []
      scene.traverse((o) => {
        const tag = (o.userData as { fsChrome?: StillChrome }).fsChrome
        if (!tag || !o.visible) return
        if (tag === "grid" || (tag === "shadow" && opts.transparent)) {
          o.visible = false
          restoreVisible.push(o)
        }
      })

      STILL_DEBUG.scale = scale
      STILL_DEBUG.transparent = opts.transparent
      STILL_DEBUG.asciiScreenLocked = asc.uFsAscLockScreen.value > 0.5
      STILL_DEBUG.asciiCellBefore = savedAscCell
      STILL_DEBUG.asciiCellAfter = asc.uFsAscCell.value
      STILL_DEBUG.ditherScreenLocked = dit.uFsDitLockScreen.value > 0.5
      STILL_DEBUG.ditherScaleBefore = savedDitScale
      STILL_DEBUG.ditherScaleAfter = dit.uFsDitScale.value
      STILL_DEBUG.chromeHidden = restoreVisible.length

      let out: HTMLCanvasElement | null = null
      try {
        gl.setPixelRatio(scale)
        gl.setSize(size.x, size.y, false)
        syncViewportToBuffer(gl)
        gl.render(scene, defaultCamera)
        out = document.createElement("canvas")
        out.width = canvas.width
        out.height = canvas.height
        const ctx = out.getContext("2d")
        if (!ctx) return null
        /* The ground is CSS on the canvas element, not a GL clear colour — the
         * context is `alpha: true` and the rig's Environment is `background:
         * false` — so the buffer is already transparent behind the mark and
         * "transparent" costs nothing. Paper is composited UNDER it here rather
         * than cleared into GL, so the two options differ by one fillRect and
         * cannot drift apart. */
        if (!opts.transparent) {
          ctx.fillStyle = STILL_PAPER
          ctx.fillRect(0, 0, out.width, out.height)
        }
        ctx.drawImage(canvas, 0, 0)
      } finally {
        // Put everything back BEFORE the next frame, whatever happened above.
        gl.setPixelRatio(dpr)
        gl.setSize(size.x, size.y, false)
        syncViewportToBuffer(gl)
        asc.uFsAscCell.value = savedAscCell
        dit.uFsDitScale.value = savedDitScale
        tex.uFsTexScale.value = savedTexScale
        for (const o of restoreVisible) o.visible = true
        gl.render(scene, defaultCamera)
      }
      if (!out) return null
      const width = out.width
      const height = out.height
      STILL_DEBUG.width = width
      STILL_DEBUG.height = height
      return { canvas: out, width, height }
    }
    const grab = async (opts: StillOptions): Promise<StillResult | null> => {
      const shot = renderStill(opts)
      if (!shot) return null
      const blob = await new Promise<Blob | null>((res) =>
        shot.canvas.toBlob((b) => res(b), "image/png"),
      )
      return blob ? { blob, width: shot.width, height: shot.height } : null
    }
    const grabCanvas = (opts: StillOptions): StillCanvas | null => renderStill(opts)
    STILL_EXPORT.grab = grab
    STILL_EXPORT.grabCanvas = grabCanvas
    return () => {
      if (STILL_EXPORT.grab === grab) STILL_EXPORT.grab = null
      if (STILL_EXPORT.grabCanvas === grabCanvas) STILL_EXPORT.grabCanvas = null
    }
  }, [gl, scene, defaultCamera, stillExport])

  /**
   * THE BREAK TABLE — built from the page's own junction set, cached on the
   * identity of everything that can invalidate it.
   *
   * The junction MEASUREMENT is not repeated here. `app/desk-doodles/page.tsx`
   * runs `findHeroJunctions` over the same processed strokes the geometry is
   * built from and publishes the result; this reads it, maps it through
   * `strokeTo3D`'s exact transform, and turns it into three-point centreline
   * samples. `buildJointBreaks` (lib/flat-ink.ts) owns the law and the
   * does-this-open-anything measurement; nothing about WHERE the junctions are
   * is decided in this file.
   *
   * Read off `window` rather than taken as a prop because the host that owns
   * the beat also owns the word, and it publishes the set in an effect. A prop
   * would be the cleaner shape and is the right eventual home; a render-time
   * memo on the strokes would have been the WRONG shape, because it reads the
   * global one render before the effect writes it.
   */
  const syncBreakTable = (carve: number) => {
    const w = window as unknown as {
      __heroJunctions?: HeroJunctionsGlobal
      __heroBreaks?: unknown
    }
    const jg = w.__heroJunctions
    const list = jg?.list ?? null
    const sig = `${canvasWidth}x${canvasHeight}|${jg?.inkWidth ?? 0}|${jg?.breakK ?? 0}|${carve.toFixed(3)}`
    const cur = breakTableRef.current
    if (cur && cur.junctions === list && cur.strokes === strokes && cur.sig === sig) {
      return cur
    }

    const scale = 3 / Math.max(canvasWidth || 1, canvasHeight || 1)
    const built =
      jg && list && list.length > 0 && strokes.length > 0
        ? buildJointBreaks(strokes, list, jg.inkWidth, jg.breakK, carve)
        : { breaks: [] as JointBreak[], dropped: 0, reach: 0, keep: 0, gap: 0 }

    /* Sorted by how much each break actually removes, so that if a word ever
     * carries more junctions than the shader's array can hold it is the
     * FAINTEST ones that fall off the end rather than an arbitrary suffix. The
     * overflow is published, not swallowed. */
    const ordered = [...built.breaks].sort((a, b) => b.cut - a.cut)
    const kept = ordered.slice(0, JOINT_BREAK_MAX)
    const data = new Float32Array(JOINT_BREAK_MAX * 4 * 4)
    const toX = (x: number) => (x - canvasWidth / 2) * scale
    const toY = (y: number) => -(y - canvasHeight / 2) * scale
    for (let i = 0; i < kept.length; i++) {
      const b = kept[i]
      const o = i * 16
      data[o + 0] = toX(b.under[0].x)
      data[o + 1] = toY(b.under[0].y)
      data[o + 2] = toX(b.under[1].x)
      data[o + 3] = toY(b.under[1].y)
      data[o + 4] = toX(b.under[2].x)
      data[o + 5] = toY(b.under[2].y)
      data[o + 6] = toX(b.over[0].x)
      data[o + 7] = toY(b.over[0].y)
      data[o + 8] = toX(b.over[1].x)
      data[o + 9] = toY(b.over[1].y)
      data[o + 10] = toX(b.over[2].x)
      data[o + 11] = toY(b.over[2].y)
      data[o + 12] = b.keepUnder * scale
      data[o + 13] = b.keepOver * scale
    }

    const next = {
      junctions: list,
      strokes,
      sig,
      data,
      count: kept.length,
      keep: built.keep * scale,
      gap: built.gap * scale,
      reach: built.reach * scale,
    }
    breakTableRef.current = next

    /* THE READOUT THE ASSERTION READS. Every number here is consumed by
     * `scripts/verify/assert-hero-k7-news.mjs` — `truncated` is a hard fail
     * there, and `opened` is what the rendered pixel change is checked against.
     * A debug channel nobody asserts on is the dead-parameter class this beat
     * has already produced three times. */
    if (typeof window !== "undefined") {
      w.__heroBreaks = {
        junctions: list ? list.length : 0,
        opened: kept.length,
        dropped: built.dropped,
        truncated: Math.max(0, ordered.length - JOINT_BREAK_MAX),
        keepStroke: built.keep,
        gapStroke: built.gap,
        reachStroke: built.reach,
        cut: kept.map((b) => ({ under: b.underIndex, over: b.overIndex, cut: b.cut })),
      }
    }
    return next
  }

  /**
   * THE PEN FIELD — baked once, LAZILY, from the same strokes and the same
   * published ink width the break table uses.
   *
   * ── WHY IT IS LAZY AND NOT A MEMO ────────────────────────────────────────
   * The bake is ~200 ms for the hero word at 1 stroke-unit per texel
   * (`PEN_FIELD_UNITS_PER_TEXEL`, whose comment carries the resolution/accuracy
   * table this number was chosen from). The lab page never carves, and the hero
   * page does not carve until the emerge, so paying it on mount would be a
   * fifth of a second of main-thread stall for something most sessions never
   * use. It is called from the frame loop only when `penCarve` first goes
   * above zero, and cached on the identity of everything that invalidates it —
   * the same shape as `syncBreakTable`, for the same reason: the page publishes
   * its width in an effect, so a render-time memo reads it one render late.
   *
   * ── THE BOX IS IN LOCAL UNITS AND THE FIELD IS IN STROKE UNITS ──────────
   * `buildPenField` works in stroke coordinates, because that is where the
   * nib's law is written. The shader tests a fragment in the flatten group's
   * LOCAL frame. So the box is mapped through `strokeTo3D`'s exact transform
   * (the same `toX`/`toY` the break table uses — one transform, never a second
   * copy), and the distances are converted by `units`. Note `toY` FLIPS sign,
   * which makes the box's height component negative; that is correct and is
   * what puts texture row 0 at the stroke's minimum Y.
   *
   * ── AND WHY THE BAKE ITSELF NO LONGER HAPPENS HERE ───────────────────────
   * Lazy fixed the cost on MOUNT; it did nothing for the cost on CHANGE, which
   * is the one a user feels. Every wobble nudge on `/desk-doodles` produces a
   * new `processedStrokes` array (`app/desk-doodles/page.tsx`, `wobble` is a
   * dep of that memo), so the identity check below misses and the field is
   * re-baked inside the frame loop. Explainer 20 §10 profiled exactly that,
   * AFTER the geometry build had already been moved off-thread, and found this
   * function at the top of what was left: `buildPenField` 105.6 ms,
   * `nibHalfWidth` 61.3 ms and `penTaperProfile` 29.4 ms — all three inside
   * this one call. It is the same defect one module over.
   *
   * So the bake goes through `lib/pen-field-defer.ts`, which hands back the
   * field ALREADY ON SCREEN while a worker bakes the new one, and then refills
   * that same object in place. `applyPenField` below is what turns a field into
   * the texture and the box, and it is called from both paths — the immediate
   * one and the worker's `onSettled` — so there is exactly one place that
   * decides what a field means to the GPU.
   */
  const applyPenField = (field: PenField) => {
    const entry = penFieldRef.current
    if (!entry) return
    const scale = 3 / Math.max(canvasWidth || 1, canvasHeight || 1)
    const toX = (x: number) => (x - canvasWidth / 2) * scale
    const toY = (y: number) => -(y - canvasHeight / 2) * scale
    const xA = toX(field.minX)
    const xB = toX(field.maxX)
    const yA = toY(field.minY)
    const yB = toY(field.maxY)

    /* THE SIZE MOVED, SO THE ALLOCATION HAS TO. See the block at
     * `setFieldRealloc` — `texStorage2D` fixed this texture's dimensions at its
     * first upload, and a `texSubImage2D` of a different size writes the new
     * outline into a corner of the old rectangle while `fsPuv` keeps scanning
     * the whole of it. Disposing is what frees the immutable storage. */
    const sizeMoved =
      !!entry.texture && (entry.texW !== field.width || entry.texH !== field.height)
    if (entry.texture && sizeMoved && readFieldRealloc()) {
      entry.texture.dispose()
      entry.texture = null
    }
    if (!entry.texture) {
      entry.texture = new THREE.DataTexture(
        field.data,
        field.width,
        field.height,
        THREE.RGFormat,
        THREE.FloatType,
      )
      entry.texW = field.width
      entry.texH = field.height
      /* LINEAR IS LOAD-BEARING, and `buildPenField`'s header says why: the
       * shader is interpolating a SIGNED DISTANCE, and a nearest fetch would
       * quantise the outline to a texel — a 1-unit staircase on a mark whose
       * whole claim is a hand-drawn edge. */
      entry.texture.minFilter = THREE.LinearFilter
      entry.texture.magFilter = THREE.LinearFilter
      entry.texture.wrapS = THREE.ClampToEdgeWrapping
      entry.texture.wrapT = THREE.ClampToEdgeWrapping
      entry.texture.generateMipmaps = false
    } else {
      /* THE IMAGE IS REPLACED, THE TEXTURE OBJECT IS NOT — and that is the
       * whole mechanism. The uniform (`pu.field.value`) is already pointing at
       * this object, and `AnimatedStrokes` re-reads it every frame, so a new
       * outline reaches the screen on the next rendered frame with React never
       * involved.
       *
       * ⚠ THIS COMMENT USED TO CONTINUE, AND THE CONTINUATION WAS THE BUG:
       *   *"A texture has no such list — `WebGLTextures` calls `texImage2D` on
       *    the SAME `__webglTexture` name whenever `source.needsUpdate` is set,
       *    which re-specifies the whole level and frees the old storage EVEN
       *    WHEN THE DIMENSIONS CHANGE."*
       * It is false in three r175 and it is why the eraser survived: the size
       * is fixed by `texStorage2D` at the first upload and every later one is a
       * bare `texSubImage2D`. The branch above handles the size change; this
       * one is the fast path it protects, and it is still the whole mechanism
       * for a re-bake at an unchanged size. */
      entry.texture.image = { data: field.data, width: field.width, height: field.height }
    }
    entry.texture.needsUpdate = true
    entry.box.set(xA, yA, 1 / (xB - xA), 1 / (yB - yA))
    entry.units = scale
    /* THE RADIUS THE BAKE ACTUALLY USED, not the one the page asked for. The
     * envelope correction is quoted in nib radii (`PEN_CARVE_ENVELOPE_R`), and
     * reading `HERO_INK_WIDTH_PX` back at the write site would be a second
     * source of truth for one number — which is how the field and the mesh came
     * to disagree in the first place. */
    entry.radius = field.radius

    /* THE READOUT `assert-pen-carve.mjs` READS. Every number here is checked
     * there — a debug channel nobody asserts on is the dead-parameter class
     * this beat has already produced three times. `bakeMs` is now the SCHEDULER's
     * measurement of whichever path ran, and `path` says which one that was,
     * because "the field is correct" and "the field was baked off-thread" are
     * two different claims and a gate has to be able to ask for either. */
    if (typeof window !== "undefined") {
      const w2 = window as unknown as { __heroPenField?: unknown; __heroJunctions?: HeroJunctionsGlobal }
      const path = PEN_FIELD_DEFER_DEBUG.lastHashSource
      w2.__heroPenField = {
        width: field.width,
        height: field.height,
        texels: field.width * field.height,
        unitsPerTexel: field.unitsPerTexel,
        expectedUnitsPerTexel: PEN_FIELD_UNITS_PER_TEXEL,
        radius: field.radius,
        inkWidth: w2.__heroJunctions?.inkWidth ?? 0,
        bakeMs: Number((path === "worker" ? PEN_FIELD_DEFER_DEBUG.lastWorkerMs : PEN_FIELD_DEFER_DEBUG.lastSyncMs).toFixed(1)),
        boxLocal: [xA, yA, xB, yB],
        localUnitsPerStrokeUnit: scale,
        path,
        /* THE SIZE THE GL STORAGE IS ACTUALLY ALLOCATED AT, and whether this
         * call had to move it. `texW/texH != width/height` is the eraser: the
         * sampler's 0..1 spans the ALLOCATION, not the bake. Published because
         * the defect was invisible for exactly as long as nothing printed it —
         * see the block at `setFieldRealloc`. */
        texW: entry.texW,
        texH: entry.texH,
        texResized: sizeMoved,
        fieldRealloc: readFieldRealloc(),
        /* THE ENVELOPE, PUBLISHED — because the defect it fixes was invisible
         * for exactly as long as nothing printed it. `bakedSlackR` is what the
         * bake used; `envelopeR` is what the shader tests against; `liveR` says
         * whether a probe has moved it. A gate reads all three, so "the prior
         * arm actually took" is a measurement rather than a hope. */
        bakedSlackR: PEN_FIELD_TUBE_SLACK,
        envelopeR: readCarveEnvelopeR(),
        envelopeShipR: PEN_CARVE_ENVELOPE_R,
        envelopePriorR: PEN_CARVE_ENVELOPE_PRIOR_R,
        envelopeWideR: PEN_CARVE_ENVELOPE_WIDE_R,
        envelopeSlackStrokeUnits:
          Math.max(0, (readCarveEnvelopeR() - PEN_FIELD_TUBE_SLACK) * field.radius),
      }
    }
  }

  const syncPenField = () => {
    const w = window as unknown as {
      __heroJunctions?: HeroJunctionsGlobal
      __heroPenField?: unknown
    }
    const jg = w.__heroJunctions
    if (!jg || !jg.inkWidth || strokes.length === 0) return null
    const sig = `${canvasWidth}x${canvasHeight}|${jg.inkWidth}`
    const cur = penFieldRef.current
    if (cur && cur.strokes === strokes && cur.sig === sig) return cur

    /* THE ENTRY IS CLAIMED FOR THE NEW STROKES BEFORE THE BAKE LANDS, and that
     * is deliberate: the check above must stop re-requesting the same bake on
     * every one of the sixty frames the worker takes. Until it lands, the
     * texture still holds the PREVIOUS outline — the mark keeps its last good
     * carve and then changes, which is the whole trade. It is the same contract
     * the geometry lane made, on the same gesture, for the same reason. */
    const entry =
      cur ?? {
        strokes,
        sig,
        texture: null as THREE.DataTexture | null,
        box: new THREE.Vector4(),
        units: 0,
        radius: 0,
        texW: 0,
        texH: 0,
      }
    entry.strokes = strokes
    entry.sig = sig
    penFieldRef.current = entry

    const res = buildPenFieldForSlot({
      /* The slot is the SURFACE, not its dial values. Wobble, endpoint and
       * spacing never move this key, so a dial change lands on the same slot
       * and the previous field can be held; drawing or clearing a stroke always
       * moves it, so a genuinely different drawing bakes synchronously with
       * nothing stale to show. */
      slotKey: `${canvasWidth}x${canvasHeight}|${strokes.length}`,
      strokes,
      inkDiameter: jg.inkWidth,
      /* AN EXPORT NEVER DEFERS. The one thing this module cannot see is that
       * something is stepping the frame loop and writing every frame to a file;
       * a frame carved by a stale field would be baked into that file and there
       * is no later frame to correct it. Slow is fine during an export, wrong
       * is not — the same rule that keeps `buildExport` off the geometry lane's
       * deferred path. */
      allowDefer: STYLE_CLOCK_DRIVE.exactMs === null,
      onSettled: (f) => applyPenField(f),
    })
    applyPenField(res.field)
    return entry
  }

  /**
   * THE TIP FIELD — baked once, LAZILY, on the first frame of a partial reveal.
   *
   * ── WHY THE INK WIDTH COMES FROM `solidParams` AND NOT FROM THE PAGE ──────
   * `syncPenField` reads `window.__heroJunctions.inkWidth`, which only the hero
   * page publishes — the lab page carves nothing, so that was fine there. The
   * draw-in is NOT hero-only: `/` runs the same reveal on the same Inflate
   * surface. So this takes the width from the one function the Inflate builder
   * itself sizes the mark with (`computeSolidEffectiveThicknessPx`, the source
   * `HERO_INK_WIDTH_PX` is itself defined from), which makes the two pages one
   * case instead of two.
   *
   * ── WHY IT IS SYNCHRONOUS WHERE THE PEN FIELD IS NOT ─────────────────────
   * Explainer 20 moved the pen field off-thread because it measured at 105.6 ms
   * inside a frame, on a gesture the user is holding. This bake is a SCATTER —
   * it stamps only the texels the ink can reach instead of asking every texel in
   * the box what is nearest — and measures **20.8 ms** for the hero word at one
   * texel per stroke unit (`scripts/verify/_probe-tipfield.mjs`). A worker for
   * that would cost a module, a message hop and a second code path to keep
   * honest, and would still land a frame late; §7 of explainer 20's own rule is
   * that a build never measured expensive never defers.
   *
   * ── THE BOX IS THE CARVE'S BOX ARITHMETIC, NOT A SECOND COPY ─────────────
   * Same `strokeTo3D` mapping, same sign flip on Y, same `units` scale as
   * `applyPenField` — restated here rather than shared only because the two
   * fields have different paddings. If that transform ever moves, both call
   * sites are three lines apart.
   */
  const syncTipField = () => {
    if (strokes.length === 0) return null
    const inkDiameter = computeSolidEffectiveThicknessPx(
      (solidParams ?? DEFAULT_SOLID_PARAMS).thickness,
    )
    if (!(inkDiameter > 0)) return null
    const sig = `${canvasWidth}x${canvasHeight}|${inkDiameter.toFixed(4)}`
    /* 🔴 THE SCHEDULE IS PART OF THIS CACHE KEY, and the map flags the reason in
     * red (§6.2): the reveal has TWO consumers — the per-triangle keys and this
     * field's `arc` channel — and *"if the key array is remapped and the tip
     * field is not, the nose detaches from the boundary."* A cache that could
     * not see a schedule change would hand the shader last schedule's arcs and
     * the nose would sit on a stroke that is not being drawn. */
    const sched = readTipRidesSchedule() ? scheduleRef.current : null
    /* 🔴 BAKED THROUGH THE SCHEDULE, NOT REMAPPED AFTER IT — see the block at
     * `TIP_FIELD_SCHEDULE_BAKE` for why step 2's remap is exact under `order`,
     * `overlap` and `align` and wrong under `reverse`: the channel is a MINIMUM
     * over coverers, and `min` commutes with a remap only while the remap is
     * increasing. The parked prior is one dev flag away and is a known-bad. */
    const bakeSched = readTipFieldBake()
    const timedBake = timedRef.current
    const schedSig = `${readTipRidesSchedule()}|bake:${bakeSched}|${
      timedBake ? `timed:${timedBake.sig}` : sched && !sched.identity ? sched.sig : "id"
    }`
    const cur = tipFieldRef.current
    if (cur && cur.strokes === strokes && cur.sig === sig) {
      if (cur.schedSig === schedSig) return cur
      /* PARKED PRIOR ONLY. Same bake, different schedule — remap the ARC channel
       * from the BASE, and leave `rhoN` (a spatial quantity) alone. One pass
       * over the texels; no re-rasterisation. `baseData` is null whenever the
       * live bake already carries a schedule, so this cannot double-apply. */
      if (!timedBake && !bakeSched && cur.baseData && cur.texture) {
        const img = cur.texture.image as { data: Float32Array; width: number; height: number }
        const live =
          img.data && img.data !== cur.baseData && img.data.length === cur.baseData.length
            ? img.data
            : new Float32Array(cur.baseData.length)
        if (!sched || sched.identity) live.set(cur.baseData)
        else remapTipFieldArc(cur.baseData, sched, live)
        cur.texture.image = { data: live, width: cur.texW, height: cur.texH }
        cur.texture.needsUpdate = true
        cur.schedSig = schedSig
        return cur
      }
    }

    /* NULL AT THE IDENTITY AND IN THE PARKED PATH, so the shipped bake takes no
     * branch inside its own texel loop and the raster is unchanged. */
    const arcMap =
      !timedBake && bakeSched && sched && !sched.identity ? scheduleArcCoeffs(sched) : null
    /* ANIM-1A2 · A TIMED TAKE BAKES ITS OWN ARRIVAL TIMES, and the slope of
     * that map rides along per texel, because speed and ease make it differ
     * per stroke. Null take: the call below is the call that always ran. */
    const field: TipField = timedBake
      ? buildTipField(strokes, inkDiameter, TIP_FIELD_UNITS_PER_TEXEL, null, timedTipMap(timedBake))
      : buildTipField(
          strokes,
          inkDiameter,
          TIP_FIELD_UNITS_PER_TEXEL,
          arcMap,
        )
    const scale = 3 / Math.max(canvasWidth || 1, canvasHeight || 1)
    const toX = (x: number) => (x - canvasWidth / 2) * scale
    const toY = (y: number) => -(y - canvasHeight / 2) * scale
    const xA = toX(field.minX)
    const xB = toX(field.maxX)
    const yA = toY(field.minY)
    const yB = toY(field.maxY)

    const entry =
      cur ??
      {
        strokes,
        sig,
        texture: null as THREE.DataTexture | null,
        box: new THREE.Vector4(),
        arcToLocal: 0,
        radiusArc: 0,
        texW: 0,
        texH: 0,
        baseData: null as Float32Array | null,
        schedSig: "",
        slopeTex: null as THREE.DataTexture | null,
        slopeMax: 1,
        holds: Array.from({ length: TIP_HOLD_MAX }, () => new THREE.Vector4()),
        holdN: 0,
        radiusLocal: 0,
        segMaxLocal: 0,
        texelLocal: 0,
      }
    entry.strokes = strokes
    entry.sig = sig
    /* The bake is the RECORDING *only when nothing was folded into it*, and
     * that is the whole reason this is conditional rather than an assignment.
     * The remap path derives every schedule from this array and never from the
     * last derivation; a base that already carried a schedule would be applied
     * twice, silently, and the nose would drift by the square of the map. */
    entry.baseData = arcMap || timedBake ? null : field.data
    entry.schedSig = schedSig
    const tipData =
      !timedBake && !bakeSched && sched && !sched.identity
        ? remapTipFieldArc(field.data, sched)
        : field.data
    /* THE SAME IMMUTABLE-STORAGE TRAP THE CARVE'S FIELD HIT — this field is
     * built from the same strokes and padded off the same extents, so its size
     * moves on the same gestures. See the block at `setFieldRealloc`. The tip
     * only shows during a partial reveal, which is why the eraser was first
     * seen on the carve; the defect is identical. */
    const tipSizeMoved =
      !!entry.texture && (entry.texW !== field.width || entry.texH !== field.height)
    if (entry.texture && tipSizeMoved && readFieldRealloc()) {
      entry.texture.dispose()
      entry.texture = null
    }
    if (!entry.texture) {
      entry.texW = field.width
      entry.texH = field.height
      entry.texture = new THREE.DataTexture(
        tipData,
        field.width,
        field.height,
        THREE.RGFormat,
        THREE.FloatType,
      )
      /* LINEAR, for the reason `applyPenField`'s note gives about the carve and
       * one more besides: the arc channel is what the boundary's POSITION is
       * read from, so a nearest fetch would quantise the moving end to a texel —
       * a one-stroke-unit staircase crawling along the mark, which is a worse
       * artefact than the facet this replaces. */
      entry.texture.minFilter = THREE.LinearFilter
      entry.texture.magFilter = THREE.LinearFilter
      entry.texture.wrapS = THREE.ClampToEdgeWrapping
      entry.texture.wrapT = THREE.ClampToEdgeWrapping
      entry.texture.generateMipmaps = false
    } else {
      // The image is replaced, the texture object is not — see `applyPenField`.
      entry.texture.image = { data: tipData, width: field.width, height: field.height }
    }
    entry.texture.needsUpdate = true
    /* ANIM-1A3 · THE SLOPE CHANNEL. A timed bake carries `field.slope`, the
     * per-texel `|dS/da|` of the take's arrival map; the shader multiplies the
     * nose's back and taper by it so a stroke at speed 2 keeps its nose one nib
     * long on screen. A timed bake WITHOUT a slope array is a broken bake, not
     * a neutral one, so it throws instead of reading 1. */
    if (timedBake && !field.slope) {
      throw new Error("tip field: timed bake returned no slope channel")
    }
    if (entry.slopeTex) {
      entry.slopeTex.dispose()
      entry.slopeTex = null
    }
    entry.slopeMax = 1
    if (field.slope) {
      let mx = 0
      for (let k = 0; k < field.slope.length; k++) if (field.slope[k] > mx) mx = field.slope[k]
      entry.slopeMax = mx > 0 ? mx : 1
      entry.slopeTex = new THREE.DataTexture(
        field.slope,
        field.width,
        field.height,
        THREE.RedFormat,
        THREE.FloatType,
      )
      entry.slopeTex.minFilter = THREE.NearestFilter
      entry.slopeTex.magFilter = THREE.NearestFilter
      entry.slopeTex.wrapS = THREE.ClampToEdgeWrapping
      entry.slopeTex.wrapT = THREE.ClampToEdgeWrapping
      entry.slopeTex.generateMipmaps = false
      entry.slopeTex.needsUpdate = true
    }
    entry.box.set(xA, yA, 1 / (xB - xA), 1 / (yB - yA))
    /* Arc fraction ↔ length. `arcToLocal` turns the shader's arc-space signed
     * distance into local units so it can be antialiased against a screen
     * derivative; `radiusArc` is one nib half-width expressed as arc fraction,
     * which is the unit `nose` and `taper` are quoted in. */
    entry.arcToLocal = field.totalArc * scale
    entry.radiusArc = field.totalArc > 0 ? field.radius / field.totalArc : 0
    /* F121 · A PAUSE READS AS THE PEN STOPPED, SO THE INK AROUND IT STOPS TOO.
     * Under a performed pace the arrival map jumps at the arc where he stood
     * still, and three things carry that jump into the dwell as creeping ink:
     * the nose's `slope * taper * rho`, the one segment that straddles the arc
     * interpolating arrival from the dwell's start to its end, and the field's
     * LINEAR filter smearing the jump across a texel. The shader answers all
     * three the same way, near the pen point it compares against the dwell's
     * start (see `applyPenTip`), so the bake hands it each hold as that point:
     * the hold's global arc walked along the word's cumulative length the way
     * `buildTipField` walks it, then `toX` and `toY`. The 8 longest holds are
     * kept and the rest are published as dropped, so a cap never passes as a
     * take with no holds. */
    let accLen = 0
    let segMax = 0
    const strokeStart: number[] = []
    for (const s of strokes) {
      strokeStart.push(accLen)
      const pts = s.points
      for (let i = 1; i < pts.length; i++) {
        const L = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
        accLen += L
        if (L > segMax) segMax = L
      }
    }
    const penAt = (si: number, arc: number): { x: number; y: number } | null => {
      const pts = strokes[si]?.points
      if (!pts || pts.length === 0) return null
      const target = arc * field.totalArc
      let acc = strokeStart[si]
      for (let i = 1; i < pts.length; i++) {
        const L = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
        if (acc + L >= target) {
          const f = L > 0 ? Math.min(1, Math.max(0, (target - acc) / L)) : 0
          return { x: pts[i - 1].x + f * (pts[i].x - pts[i - 1].x), y: pts[i - 1].y + f * (pts[i].y - pts[i - 1].y) }
        }
        acc += L
      }
      return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y }
    }
    const holdAll = (timedBake ? performedHolds(timedBake) : [])
      .map((h) => ({ ...h, at: penAt(h.stroke, h.arc) }))
      .sort((a, b) => b.t1 - b.t0 - (a.t1 - a.t0))
    const holdKept = holdAll.filter((h) => h.at).slice(0, TIP_HOLD_MAX)
    const holdDropped = holdAll.filter((h) => !holdKept.includes(h))
    const takeMs = timedBake ? timedBake.takeMs : 1
    if (!entry.holds || entry.holds.length !== TIP_HOLD_MAX) {
      entry.holds = Array.from({ length: TIP_HOLD_MAX }, () => new THREE.Vector4())
    }
    for (let k = 0; k < TIP_HOLD_MAX; k++) {
      const h = holdKept[k]
      if (h && h.at) entry.holds[k].set(toX(h.at.x), toY(h.at.y), h.t0 / takeMs, h.t1 / takeMs)
      else entry.holds[k].set(0, 0, 2, 2)
    }
    entry.holdN = holdKept.length
    entry.radiusLocal = field.radius * scale
    entry.segMaxLocal = segMax * scale
    entry.texelLocal = field.unitsPerTexel * scale
    tipFieldRef.current = entry

    if (typeof window !== "undefined") {
      /* THE READOUT A GATE READS. Same contract as `__heroPenField`: a channel
       * nobody can assert on is the dead-parameter class this beat has produced
       * three times. */
      ;(window as unknown as { __heroPenTip?: unknown }).__heroPenTip = {
        width: field.width,
        height: field.height,
        texels: field.width * field.height,
        unitsPerTexel: field.unitsPerTexel,
        expectedUnitsPerTexel: TIP_FIELD_UNITS_PER_TEXEL,
        radius: field.radius,
        inkDiameter,
        totalArc: field.totalArc,
        bakeMs: Number(field.ms.toFixed(1)),
        boxLocal: [xA, yA, xB, yB],
        localUnitsPerStrokeUnit: scale,
        radiusArc: entry.radiusArc,
        mode: readPenTipMode(),
        /* WHICH PATH ACTUALLY BAKED THIS, so a gate can tell "the known-bad was
         * set" from "the known-bad took" — the distinction `setDrawIn`'s boolean
         * return exists for, and the one that separates a control that refused
         * from a control that acted. */
        scheduleBaked: arcMap !== null,
        remapApplied: !bakeSched && !!sched && !sched.identity,
        /* F121. The holds the shader is handed, and every hold the cap or a
         * missing pen point left out: a dropped hold is ink that creeps. */
        holdMax: TIP_HOLD_MAX,
        holds: holdKept.map((h) => ({
          stroke: h.stroke,
          t0Ms: Number(h.t0.toFixed(1)),
          t1Ms: Number(h.t1.toFixed(1)),
          arc: h.arc,
          local: h.at ? [toX(h.at.x), toY(h.at.y)] : null,
        })),
        holdsDropped: holdDropped.map((h) => ({
          stroke: h.stroke,
          t0Ms: Number(h.t0.toFixed(1)),
          t1Ms: Number(h.t1.toFixed(1)),
          arc: h.arc,
          reason: h.at ? "cap" : "no pen point",
        })),
      }
    }
    return entry
  }

  /**
   * RE-ARM EVERY LAYER THAT MEASURES FROM "WHEN IT WAS CHOSEN".
   *
   * Six behaviours in this file ask `armedFor(arm, key, clock.elapsed)` — the
   * layer stack, the fusion band, texture, dither, ASCII and the material
   * animation — and every one of them is a DIFFERENCE against `clock.elapsed`.
   * That is exactly why the shared clock may never move discontinuously
   * underneath them without this call: an `at` recorded at scene-second 84 with
   * the clock then zeroed gives `sinceArmed = −84`, and a negative age walks
   * every envelope backwards through its own resting state.
   *
   * Emptying the key rather than writing a new `at` is deliberate — `armedFor`
   * re-arms on a key MISMATCH, so the next call stamps the current elapsed
   * itself and there is still exactly one place that decides what "now" is.
   */
  const rearmStyleLayers = () => {
    stackArmRef.current = { key: "", at: 0 }
    fusionArmRef.current = { key: "", at: 0 }
    texArmRef.current = createArmState()
    ditArmRef.current = createArmState()
    ascArmRef.current = createArmState()
    matAnimArmRef.current = createArmState()
  }

  const styleStateBase = styleState
  useFrame((state, delta) => {
    /* K2 · THE FRAME READS THE KEYED STYLE. Every `styleState.` read below is
     * this frame's: each keyed value replaced by its sample on the key reader's
     * clock (the transport's playhead times the keyed length, the clock export
     * drives too), every other value the doc's own. `styleAt` returns the doc's
     * object itself when nothing style is keyed, so an unkeyed page renders
     * what it rendered before K2. The must-fail arm `__fsKeyMutant = "memo"`
     * reads the doc's values, the way a memo would. */
    const styleState =
      styleStateBase && keyReader && keyedStylePaths.size > 0 && KEY_MUTANT !== "memo"
        ? styleAt(styleStateBase, frameStyleKeys, keyReader.clockMs())
        : styleStateBase
    /* The material's base, read per frame when a custom material value is
     * keyed (the memo'd `baseParams` is the doc's values, built when the
     * material is). Otherwise the memo's own object, as before K2. */
    const frameBase =
      styleState && styleState !== styleStateBase && keyedStylePaths.size > 0 && [...keyedStylePaths].some((k) => k.startsWith("customMaterial."))
        ? resolveMaterialParams(styleState.materialPreset, styleState.customMaterial)
        : baseParams
    /* FIRST, BEFORE ANYTHING READS THE GEOMETRY. An implicit rebuild that went
     * to the worker may have refilled these buffers between frames, which
     * React cannot see — see `ensureLetterStamp`. Doing it here rather than
     * later means there is never a frame drawn against a mismatched attribute,
     * so the fix has no one-frame flicker of its own. */
    ensureLetterStamp()

    // ---- Shared style clock (advance ONCE, before any layer reads it) ---
    const clock = styleClockRef.current!
    /* DRIVEN OR WALL-DRIVEN, and it SAYS which. See `STYLE_CLOCK_DRIVE` and
     * `driveHoldRef`.
     *
     * Three things happen on the frame an exporter takes the clock, and none of
     * them is optional:
     *
     *   1 · the scene's elapsed seconds are parked and the clock is zeroed, so
     *       the film's style phase starts at the film's start;
     *   2 · `reveal` and `sinceCompletion` are re-armed, so the completion
     *       pulse fires where the FILM completes rather than having been spent
     *       minutes ago on screen;
     *   3 · every per-layer arm state is reset, because `armedFor` returns
     *       `elapsed − arm.at` and an `at` measured against the old timebase
     *       would come back NEGATIVE the moment the clock is zeroed. That is
     *       the one failure here that would not look like a clock bug — it
     *       looks like the layers picked a different behaviour.
     *
     * The advance itself is still a DELTA and not an assignment, because
     * `advanceStyleClock` owns `sinceCompletion` as well; writing
     * `clock.elapsed` directly would leave that second clock on wall time and
     * move the defect rather than fix it. */
    const drive = STYLE_CLOCK_DRIVE.exactMs
    if (drive === null) {
      if (driveHoldRef.current) {
        clock.elapsed = driveHoldRef.current.elapsed
        driveHoldRef.current = null
        rearmStyleLayers()
      }
      advanceStyleClock(clock, delta, playheadRef.current, totalDuration)
      STYLE_CLOCK_DEBUG.source = "wall"
    } else {
      if (!driveHoldRef.current) {
        driveHoldRef.current = { elapsed: clock.elapsed }
        clock.elapsed = 0
        clock.reveal = 0
        clock.sinceCompletion = Infinity
        rearmStyleLayers()
      }
      advanceStyleClock(clock, Math.max(0, drive / 1000 - clock.elapsed), playheadRef.current, totalDuration)
      STYLE_CLOCK_DEBUG.source = "drive"
    }
    STYLE_CLOCK_DEBUG.elapsed = clock.elapsed
    STYLE_CLOCK_DEBUG.reveal = clock.reveal
    STYLE_CLOCK_DEBUG.sinceCompletion = clock.sinceCompletion

    // THE ONE PLACE motionMode IS READ. Every layer below resolves its sync mode
    // from this rather than from styleState.motionMode directly, so
    // prefers-reduced-motion cannot be honoured on two rails and forgotten on the
    // third — which is exactly how the query came to be honoured for a button
    // press and not for a 12.9 Hz strobe.
    const motionMode = reduceMotionRef.current ? "off" : styleState?.motionMode ?? "off"
    const reduceMotion = reduceMotionRef.current
    STYLE_CLOCK_DEBUG.reduceMotion = reduceMotion

    // Layer stack: composition-level opacity / blend / order, resolved once.
    const stack = styleState ? resolveStack(styleState) : null
    if (stack) stackUniformsRef.current!.uFsStackOrder.value = stack.order

    // Stack-level animation: the whole GROUP as one container. Produces a
    // group amount (fades/pulses) and a shared time offset (the stack drifts
    // together), both applied uniformly below so layers keep their relative
    // balance — a preset tuned "ASCII dominant, others supporting" stays that
    // way while the group fades in.
    /* ⚠ THE STACK WAS THE RAIL `motionMode` NEVER REACHED, and the comment
     * twenty lines above — "cannot be honoured on two rails and forgotten on
     * the third" — was describing the defect rather than preventing it.
     *
     * `enabled` used to read `!reduceMotion && layerStackEnabled &&
     * stackAnimationEnabled`. The MEDIA QUERY got in; the user's own control did
     * not. `motionMode` appears nowhere in lib/style-stack.ts, so the group's
     * offset and amplitude ran at full amplitude with the only motion control
     * the panel offers reading "Off (static)"
     * (components/style-panel-scaffold.tsx:2285).
     *
     * IT IS THE DEFAULT PATH, not a corner. `DEFAULT_STYLE_STATE.motionMode` is
     * `"off"` (lib/style-system.ts:574) and NOT ONE of the twelve
     * `stackAnimation` presets writes `motionMode` in its `applies` patch — so
     * picking "Stack Drift" off the rail on a fresh page is exactly the broken
     * case. Measured on the real page before this line changed
     * (`scripts/verify/assert-motion-off.mjs`), group-offset travel over 1.4 s:
     *
     *     drift   Off 1.7600   Independent 1.7489
     *     loop    Off 1.3686   Independent 1.0980
     *     fadeIn  Off 0.5137   Independent 0.5176   (amplitude)
     *     pulse   Off 0.5490   Independent 0.5494   (amplitude)
     *
     * Off and Independent are the same picture to three digits. The Independent
     * rows are that assertion's negative control and passed throughout, so the
     * instrument could tell the two apart and the two were not different.
     *
     * The local `motionMode` already folds `reduceMotion` in (it resolves to
     * "off" when the query is set), so testing it covers BOTH rails with one
     * expression — which is the property that was missing. */
    const stackAnimOn = !!styleState &&
      motionMode !== "off" &&
      styleState.layerStackEnabled &&
      styleState.stackAnimationEnabled
    // Re-arm whenever the behaviour (or its enabled state) changes.
    const armKey = styleState ? `${stackAnimOn}:${styleState.stackAnimationType}` : ""
    if (stackArmRef.current.key !== armKey) {
      stackArmRef.current = { key: armKey, at: clock.elapsed }
    }
    const groupAnim = styleState
      ? evaluateStackAnimation({
          enabled: stackAnimOn,
          behaviour: styleState.stackAnimationType,
          speed: styleState.stackAnimationSpeed,
          phase: styleState.stackAnimationPhase,
          sinceArmed: clock.elapsed - stackArmRef.current.at,
          reveal: clock.reveal,
          sinceCompletion: clock.sinceCompletion,
          loopSeconds: styleState.styleLoopSeconds,
        })
      : null
    const gAmt = groupAnim ? groupAnim.amount : 1
    const gOff = groupAnim ? groupAnim.timeOffset : 0
    // freezeOnComplete holds every layer's phase at the frame the reveal ended.
    if (groupAnim?.frozen) {
      if (frozenPhaseRef.current === null) {
        frozenPhaseRef.current = {
          tex: textureUniformsRef.current!.uFsTexTime.value,
          dit: ditherUniformsRef.current!.uFsDitTime.value,
          asc: asciiUniformsRef.current!.uFsAscTime.value,
        }
      }
    } else {
      frozenPhaseRef.current = null
    }
    const frozen = frozenPhaseRef.current
    // True while a group drift/loop offset is actively sliding the stack.
    // Layers with no motion of their own read this to keep formation (see the
    // dither direction fallback and the ASCII scroll fallback below).
    const groupSliding = gOff !== 0 && !frozen
    STYLE_CLOCK_DEBUG.groupAmount = gAmt
    STYLE_CLOCK_DEBUG.groupOffset = gOff
    STYLE_CLOCK_DEBUG.groupFrozen = !!groupAnim?.frozen

    // ---- Procedural texture v1 (uniform writes only) --------------------
    // Pattern selection + params + animation phase all flow through uniform
    // values on the injected shader. No material swap, no recompile, no
    // geometry rebuild — verified against the Extrude previewBuildCount.
    if (styleState) {
      const u = textureUniformsRef.current!
      const texOn = styleState.textureEnabled && styleState.textureMode !== "none"
      u.uFsTexType.value = texOn ? TEXTURE_TYPE_INDEX[styleState.textureMode] : 0
      u.uFsTexScale.value = styleState.textureScale
      u.uFsTexIntensity.value = styleState.textureIntensity
      u.uFsTexContrast.value = styleState.textureContrast
      u.uFsTexLockScreen.value = styleState.textureLockMode === "screen" ? 1 : 0
      const dir = styleState.textureDirection
      u.uFsTexDirX.value = dir === "vertical" ? 0 : dir === "diagonal" ? 0.7071 : 1
      u.uFsTexDirY.value = dir === "horizontal" ? 0 : dir === "diagonal" ? 0.7071 : 1
      // Phase comes from the shared clock (lib/style-clock.ts), not a local
      // accumulator — see the timing explainer for why the three renderers no
      // longer each roll their own.
      const texSync = resolveSyncMode(motionMode, styleState.textureSyncMode)
      const texAnimated = texOn && styleState.textureAnimated && texSync.animated
      const texCfg = {
        animated: texAnimated,
        syncMode: texSync.syncMode,
        sinceArmed: armedFor(
          texArmRef.current,
          `${texAnimated}:${texSync.syncMode}`,
          clock.elapsed,
        ),
        // Base rate 0.6 → 1.2 after live judging: at 0.6 a default-speed
        // pattern took ~4s to travel one feature width and read as static.
        // Decorative surface motion on the canvas object is allowed to be
        // present — it is not UI-chrome motion that must stay out of the way.
        speed: styleState.textureSpeed * 1.2,
        phase: styleState.texturePhase,
        delay: styleState.textureDelay,
        loopSeconds: styleState.styleLoopSeconds,
        revealScale: 4,
      }
      // A keyed speed runs as a sum (K2); `speedxtime` is the must-fail arm.
      const texT =
        keyedStylePaths.has("textureSpeed") && KEY_MUTANT !== "speedxtime"
          ? runningLayerTime(clock, texCfg, texRunRef.current)
          : evaluateLayerTime(clock, texCfg)
      // `time` is meaningful in every branch now (a resting layer reports its
      // own phase), so there is no separate not-active fallback to keep in
      // sync — that fallback differed between the three layers and was where
      // the phase jumped when a one-shot expired.
      // The type plays only while the layer animates; Off draws Travel at its
      // phase, the frame main drew. The three mutants are the gate's must-fails
      // (scripts/verify/assert-texture-anim.mjs) and never run in production.
      // texanim-freeze holds the texture clock at the phase with the type live.
      const texGateMut =
        process.env.NODE_ENV !== "production"
          ? (window as unknown as { __FS_GATE_MUTATE?: string }).__FS_GATE_MUTATE
          : undefined
      u.uFsTexTime.value = frozen
        ? frozen.tex
        : texGateMut === "texanim-freeze"
          ? styleState.texturePhase
          : texT.time + gOff
      const texAnimIdx = Math.max(0, TEXTURE_ANIMATION_TYPES.findIndex((t) => t.id === styleState.textureAnimationType))
      u.uFsTexAnimType.value =
        texGateMut === "texanim-all-travel" ? 0 : texAnimated || texGateMut === "texanim-off-leak" ? texAnimIdx : 0
      // THE ENVELOPE IS UNCONDITIONAL. `amount` is 1 at rest, 0 when a deferred
      // mode has not arrived, and >1 during a one-shot swell — so it is simply
      // multiplied in. The old `active && amount < 1 ? base * amount : base`
      // read the not-active sentinel as full strength, which is what made
      // completionPulse decay and then SNAP back to full at its cutoff.
      const texBase = stack ? stack.textureAmount : styleState.textureIntensity
      u.uFsTexIntensity.value = texBase * texT.amount * gAmt
      if (KEYED_STYLE_DEBUG.record) {
        const rows = KEYED_STYLE_DEBUG.rows
        rows.push({
          elapsed: clock.elapsed,
          clockMs: keyReader ? keyReader.clockMs() : -1,
          texTime: u.uFsTexTime.value,
          texSpeed: styleState.textureSpeed,
          texIntensity: styleState.textureIntensity,
          keyed: keyedStylePaths.size,
        })
        if (rows.length > 4000) rows.splice(0, rows.length - 4000)
      }
    }

    // ---- Dither v1 (uniform writes only) --------------------------------
    // Dither is a SEPARATE system from texture: it reduces final shaded tone
    // through a threshold map. Same no-rebuild contract — uniforms only.
    if (styleState) {
      const d = ditherUniformsRef.current!
      const ditOn = styleState.ditherEnabled
      d.uFsDitType.value = ditOn ? DITHER_TYPE_INDEX[styleState.ditherType] : 0
      d.uFsDitScale.value = styleState.ditherScale
      d.uFsDitContrast.value = styleState.ditherContrast
      d.uFsDitIntensity.value = stack ? stack.ditherAmount : styleState.ditherIntensity
      d.uFsDitBlend.value = stack ? stack.ditherBlend : 0
      d.uFsDitLevels.value = styleState.ditherLevels
      d.uFsDitExposure.value = styleState.ditherExposure ?? 0.5
      d.uFsDitAngle.value = ((styleState.ditherAngle ?? 45) * Math.PI) / 180
      d.uFsDitLockScreen.value = styleState.ditherLockMode === "screen" ? 1 : 0
      const [ddx, ddy] = DITHER_DIRECTION_VEC[styleState.ditherDirection]
      // Group drift/loop add a shared time offset — but a STATIC dither
      // direction is the zero vector, so `dir * time` discarded the offset and
      // the dither layer sat still while the group "drifted" (measured
      // consecutive-frame Δ 0.00 on Terminal Stack + Stack Drift). When the
      // group is sliding and the layer has no travel direction of its own,
      // borrow the classic diagonal so the whole stack actually moves in
      // formation.
      if (groupSliding && styleState.ditherDirection === "static") {
        d.uFsDitDirX.value = 0.7071
        d.uFsDitDirY.value = 0.7071
      } else {
        d.uFsDitDirX.value = ddx
        d.uFsDitDirY.value = ddy
      }

      const ditSync = resolveSyncMode(motionMode, styleState.ditherSyncMode)
      const ditAnimated = ditOn && styleState.ditherAnimated && ditSync.animated
      const ditCfg = {
        animated: ditAnimated,
        syncMode: ditSync.syncMode,
        sinceArmed: armedFor(
          ditArmRef.current,
          `${ditAnimated}:${ditSync.syncMode}`,
          clock.elapsed,
        ),
        speed: styleState.ditherSpeed * 6,
        delay: styleState.ditherDelay,
        loopSeconds: styleState.styleLoopSeconds,
        revealScale: 6,
      }
      const ditT =
        keyedStylePaths.has("ditherSpeed") && KEY_MUTANT !== "speedxtime"
          ? runningLayerTime(clock, ditCfg, ditRunRef.current)
          : evaluateLayerTime(clock, ditCfg)
      // MATRIX motion: shift which threshold cell each pixel samples.
      d.uFsDitTime.value = frozen ? frozen.dit : ditT.time + gOff
      d.uFsDitIntensity.value *= ditT.amount * gAmt
      // THRESHOLD-BIAS motion: with no travel direction the matrix cannot move,
      // so animation instead sweeps the bias — tone opens and closes in place.
      // This is what distinguishes "Threshold Sweep" from "Dither Crawl".
      if (ditT.active && styleState.ditherDirection === "static") {
        const revealDriven =
          ditSync.syncMode === "revealSynced" || ditSync.syncMode === "strokeTimeSynced"
        const sweep = revealDriven
          ? // reveal-driven: the threshold opens as the stroke draws in
            (1 - clock.reveal) * 0.42
          : Math.sin(ditT.time * 0.27) * 0.22
        d.uFsDitThreshold.value = styleState.ditherThreshold + sweep * ditT.amount
      } else {
        d.uFsDitThreshold.value = styleState.ditherThreshold
      }
    }

    // ---- ASCII v1 (uniform writes only) ---------------------------------
    // ASCII is the THIRD system: glyph rendering, distinct from texture
    // (pattern) and dither (threshold). Same no-rebuild contract.
    if (styleState) {
      const a = asciiUniformsRef.current!
      const ascOn = styleState.asciiEnabled
      a.uFsAscOn.value = ascOn ? 1 : 0
      a.uFsAscCharset.value = ASCII_CHARSET_INDEX[styleState.asciiCharset]
      a.uFsAscCell.value = styleState.asciiCellSize
      a.uFsAscDensity.value = styleState.asciiDensity
      a.uFsAscContrast.value = styleState.asciiContrast
      a.uFsAscLockScreen.value = styleState.asciiLockMode === "screen" ? 1 : 0
      a.uFsAscReveal.value = playheadRef.current
      const [adx, ady] = ASCII_DIRECTION_VEC[styleState.asciiDirection]
      a.uFsAscDirX.value = adx
      a.uFsAscDirY.value = ady

      const ascSync = resolveSyncMode(motionMode, styleState.asciiSyncMode)
      const ascAnimated =
        ascOn &&
        styleState.asciiAnimated &&
        styleState.asciiAnimationType !== "none" &&
        ascSync.animated
      const ascCfg = {
        animated: ascAnimated,
        syncMode: ascSync.syncMode,
        sinceArmed: armedFor(
          ascArmRef.current,
          `${ascAnimated}:${ascSync.syncMode}:${styleState.asciiAnimationType}`,
          clock.elapsed,
        ),
        speed: styleState.asciiScrollSpeed * 1.6,
        delay: styleState.asciiDelay,
        loopSeconds: styleState.styleLoopSeconds,
        revealScale: 8,
      }
      const ascT =
        keyedStylePaths.has("asciiScrollSpeed") && KEY_MUTANT !== "speedxtime"
          ? runningLayerTime(clock, ascCfg, ascRunRef.current)
          : evaluateLayerTime(clock, ascCfg)
      // A non-animated ASCII layer ignores uFsAscTime entirely (the shader
      // only reads it inside the animation branches), which silently discarded
      // the group drift/loop offset — the glyph grid sat still while the rest
      // of the stack slid (the same invisibility bug as the dither direction
      // above). While the group is sliding, drive the grid through the SCROLL
      // branch with only the shared offset, so the stack moves as one.
      a.uFsAscAnim.value = ascT.active
        ? ASCII_ANIM_INDEX[styleState.asciiAnimationType]
        : groupSliding && ascOn
          ? ASCII_ANIM_INDEX.scroll
          : 0
      // revealDensity reads uFsAscReveal directly, so it needs no phase of its
      // own; every other behaviour rides the shared clock.
      a.uFsAscTime.value = frozen ? frozen.asc : ascT.time + gOff
      const ascBase = stack ? stack.asciiAmount : 1
      a.uFsAscAmount.value = ascBase * ascT.amount * gAmt
      a.uFsAscBlend.value = stack ? stack.asciiBlend : 0
    }

    // ---- FUSION (PRD phases 20/21) --------------------------------------
    // Fusion = systems influencing each other: a modulation layer computed on
    // the CPU each frame (lib/style-fusion.ts) and applied ON TOP of the
    // uniform values the three systems just resolved above. It never forks a
    // renderer and never touches geometry — same uniforms-only contract as
    // everything else in this loop. The `signals` argument hands the engine
    // the values the layers are ACTUALLY rendering with this frame, so a
    // driven parameter is literally derived from the driver's live output.
    let fusionFrame: ReturnType<typeof evaluateFusion> = null
    if (styleState && styleState.fusionPreset !== "none") {
      // Arming identity = preset + DRIVE SHAPE. Changing the shape has to restart
      // its arrival/event schedule, which is the whole reason `sinceArmed` exists.
      const fuseKey = `${styleState.fusionPreset}:${resolveFusionDrive(styleState)}`
      if (fusionArmRef.current.key !== fuseKey) {
        fusionArmRef.current = { key: fuseKey, at: clock.elapsed }
      }
      fusionFrame = evaluateFusion(
        // FUSION WAS THE ONE RAIL prefers-reduced-motion NEVER REACHED. The
        // local `motionMode` above already folds the media query in for texture,
        // dither, ascii, the stack and the material; fusion was handed
        // `styleState` raw and read `styleState.motionMode`, so with the OS
        // setting on it went on breathing at full amplitude. Handing it the
        // resolved mode is the whole fix, and it also means the explicit
        // "Motion mode: Off" now freezes fusion's choreographies and not just
        // its ambient oscillator.
        motionMode === styleState.motionMode ? styleState : { ...styleState, motionMode },
        clock,
        {
          asciiTime: asciiUniformsRef.current!.uFsAscTime.value,
          ditherTime: ditherUniformsRef.current!.uFsDitTime.value,
          textureTime: textureUniformsRef.current!.uFsTexTime.value,
          /* THE LAYER STACK, WHICH FUSION COULD NOT HEAR. `gOff` is the shared
           * offset stack animation slides every layer by and `gAmt` its
           * amplitude envelope — both already computed above for the three
           * layers, and both invisible to every relationship until now. Handing
           * them over is the whole of the `stackField` source; a behaviour that
           * only fades (freezeOnComplete) leaves gOff at 0, which is why the
           * amount goes with it. */
          stackTime: gOff,
          stackAmount: gAmt,
          /* THE VIEW. Azimuth of the camera about the mark's own up axis, read
           * off the live camera rather than off a control's request — the same
           * rule `__captureHarness.projection` follows, and for the same reason:
           * a signal that reports what was asked for cannot notice a rig that
           * did not take. Geometry-driven, so the View source keeps working with
           * style motion off. */
          orbit: Math.atan2(state.camera.position.x, state.camera.position.z),
        },
        clock.elapsed - fusionArmRef.current.at,
      )
    } else {
      fusionArmRef.current = { key: "", at: 0 }
    }
    if (fusionFrame) {
      const fz = fusionFrame
      const u = textureUniformsRef.current!
      const d = ditherUniformsRef.current!
      const a = asciiUniformsRef.current!
      const c01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
      u.uFsTexIntensity.value *= fz.textureIntensityMul
      u.uFsTexScale.value *= fz.textureScaleMul
      u.uFsTexTime.value += fz.textureTimeAdd
      d.uFsDitIntensity.value *= fz.ditherIntensityMul
      d.uFsDitThreshold.value += fz.ditherThresholdAdd
      d.uFsDitScale.value *= fz.ditherScaleMul
      d.uFsDitTime.value += fz.ditherTimeAdd
      a.uFsAscDensity.value = Math.min(
        1,
        Math.max(0, a.uFsAscDensity.value + fz.asciiDensityAdd),
      )
      a.uFsAscTime.value += fz.asciiTimeAdd
      /* THE FOUR THAT CLOSE THE PER-LAYER ROW. Each screen layer's natural set
       * is {amount, scale, flow, bite}; dither had no flow and no bite, ASCII no
       * cell and no bite, texture no bite. All three CONTRAST uniforms are
       * written from state a few blocks above and are read every frame by their
       * shader, so these are modulations of live values and not new plumbing.
       *
       * Contrast is clamped: it is 0..1 in all three shaders, and an unclamped
       * add would let a link push it negative, which is not "less contrast", it
       * is an inverted ramp — the same class of bug as a negative emissive. */
      d.uFsDitContrast.value = c01(d.uFsDitContrast.value + fz.ditherContrastAdd)
      a.uFsAscContrast.value = c01(a.uFsAscContrast.value + fz.asciiContrastAdd)
      u.uFsTexContrast.value = c01(u.uFsTexContrast.value + fz.textureContrastAdd)
      /* THE CELL SIZE IS A DIVISOR in the glyph shader, so its floor is not
       * cosmetic. 6px is below the 13px legibility floor
       * docs/research/screen-space-layer-quality.md measured and well above the
       * division-by-zero the multiplier could otherwise reach. */
      if (fz.asciiCellMul !== 1) {
        a.uFsAscCell.value = Math.max(6, a.uFsAscCell.value * fz.asciiCellMul)
      }
    }

    // ---- Bind the scene environment ONTO the material -------------------
    // WHY THIS EXISTS (material craft pass). `envMapIntensity` was a DEAD
    // parameter across the entire material system. three.js only uploads
    // `material.envMapIntensity` inside `if (material.envMap)`
    // (WebGLMaterials.refreshMaterialUniforms); when the IBL comes from
    // `scene.environment` instead — which is our case, drei's <Environment>
    // sets exactly that — WebGLRenderer.js overrides the uniform every frame:
    //
    //   if (material.isMeshStandardMaterial && material.envMap === null
    //       && scene.environment !== null)
    //     m_uniforms.envMapIntensity.value = scene.environmentIntensity
    //
    // So all fourteen presets rendered at environmentIntensity (1.0) no matter
    // what they asked for: chalk's 0.05 and chrome's 2.8 were the SAME number
    // on the GPU. Every animated-material type and four fusion presets drive
    // envMapIntensity too — all discarded. Pointing `material.envMap` at the
    // same texture takes the override branch out of play and hands the
    // parameter back. Environment ROTATION follows the material once envMap is
    // set, so the scene rotation is copied across to keep the reflection
    // registered with the rig.
    const sceneEnv = (state.scene as THREE.Scene).environment
    if (sceneEnv && liveMaterial.envMap !== sceneEnv) {
      liveMaterial.envMap = sceneEnv
      liveMaterial.envMapRotation.copy((state.scene as THREE.Scene).environmentRotation)
      liveMaterial.needsUpdate = true
    }

    // ---- Animated Material v1 (surface response only) -------------------
    // PREVIEW-ONLY: this modulates highlight/roughness/sheen/emissive each
    // frame. It NEVER touches geometry, the reveal clock, or export. When the
    // animation is off we keep the material pinned to its static base.
    if (styleState) {
      // Motion Off and reduceMotion both stop the material animation: Shine
      // Sweep and the gloss wave are MOVEMENT on the surface. The local
      // `motionMode` folds reduceMotion in, the same expression the stack uses.
      // Before 2026-09-25 this read `!reduceMotion` only, so Off moved every
      // Material type across the whole stroke (20,131 to 26,624 px changed
      // over 2 s, docs/verification/night-m/). The rail presets that turn
      // animation on also move Off to Independent in `applyPresetToStyleState`;
      // without that wake this gate would leave the whole rail dead on a fresh
      // page. The static base is re-applied below in the animation-off path, so
      // the material still looks like its preset, see baseParams.
      const animOn =
        motionMode !== "off" &&
        styleState.materialAnimationEnabled && styleState.materialAnimationType !== "none"
      // Armed OUTSIDE the animOn branch on purpose: keying on the enabled flag
      // as well as the type means turning an animation off and back on re-arms
      // it. Keyed inside, an A → none → A round trip kept the stale arming and
      // a one-shot stayed unreachable on the second try.
      const matArmed = armedFor(
        matAnimArmRef.current,
        `${animOn}:${styleState.materialAnimationType}`,
        clock.elapsed,
      )
      // ---- Shine sweep band (shader-level, positional) ------------------
      // The travelling highlight itself is per-fragment (lib/texture-shader
      // SWEEP_* injections); the CPU animates only the band's center.
      // TIMING (measured failure of the old cycle): 2.5s with a smoothstep
      // crossing over ±1.35 left the band's center on-form only ~40% of the
      // time — smoothstep dwells at the travel ends, which are OFF-form, and
      // the 28% rest phase added more dead time. 10 frames sampled across a
      // cycle produced only 4 distinct images; two frames 950ms apart could
      // both land off-form and come out pixel-identical. "An event that
      // passes" is worthless if most moments are the gap between events.
      // Now: LINEAR travel (per the design framework, constant motion —
      // marquee-class — gets linear easing; ease-in-out only spent its slow
      // ends where nothing was visible) over ±1.15, taking 85% of a ~2.6s
      // cycle, with a short ~0.4s off-form beat between passes. The form is
      // lit for ~3/4 of every cycle. Duration sits deliberately above the
      // 300ms UI ceiling: this is decorative, rarely-configured canvas
      // motion — the framework's "marketing/explanatory: can be longer" tier,
      // not UI feedback.
      const sw = sweepUniformsRef.current!
      /* Hoisted because the fusion block below has to know whether the band is
       * already spoken for — see `releaseFusionSweep`. */
      const materialSweepOn = animOn && styleState.materialAnimationType === "shineSweep"
      /* K2: a KEYED material speed runs as a sum (`runningSum`), shared by the
       * sweep and the animation below, which read the same time. Unkeyed, or
       * with the must-fail arm "speedxtime", it stays time times speed. */
      const matBase = motionMode === "syncToDraw" ? playheadRef.current * 6 : clock.elapsed
      let matTravel: number | undefined
      if (animOn && keyedStylePaths.has("materialAnimationSpeed") && KEY_MUTANT !== "speedxtime") {
        matTravel = runningSum(matRunRef.current, matBase, styleState.materialAnimationSpeed)
      } else matRunRef.current.base = Number.NaN
      if (KEYED_STYLE_DEBUG.record && animOn) {
        const last = KEYED_STYLE_DEBUG.rows[KEYED_STYLE_DEBUG.rows.length - 1]
        if (last && last.elapsed === clock.elapsed) {
          last.matTime = matTravel ?? matBase * styleState.materialAnimationSpeed
          last.matSpeed = styleState.materialAnimationSpeed
        }
      }
      const sweepLaw = readSweepLaw()
      if (materialSweepOn) {
        const completion = playheadRef.current
        /* The shared style clock, not R3F's wall clock: `clock.elapsed` is the
         * one an exporter drives through STYLE_CLOCK_DRIVE, so a film frame
         * gets the sweep position of its film time. */
        const swTime =
          motionMode === "syncToDraw"
            ? completion * 6
            : clock.elapsed
        const k = Math.min(1, Math.max(0, styleState.materialAnimationIntensity))
        const cyc =
          ((((matTravel ?? swTime * styleState.materialAnimationSpeed) / 2.6) % 1) + 1) % 1
        const tf = Math.min(1, cyc / 0.88)
        // Position is in NORMALIZED stroke units (bounds radius = 1); ±1.12
        // just clears the drawing on both sides with the wider band, and a
        // short amplitude envelope at the travel ends fades the band in/out
        // instead of relying on extra off-form travel distance — so there is
        // no pop at wrap AND no long dark stretch (measured: the wider ±1.35
        // margin left glossyPlastic pixel-identical for 2-3 consecutive
        // 260ms samples).
        sw.uFsSweepPos.value = -1.12 + tf * 2.24
        const env =
          tf < 0.05 ? tf / 0.05 : tf > 0.95 ? (1 - tf) / 0.05 : 1
        sw.uFsSweepAmt.value = k * (cyc >= 0.88 ? 0 : env)
        // Broad halo (the core is derived in-shader at 0.38× this width).
        sw.uFsSweepWidth.value = 0.3 + 0.18 * k
        if (bounds) {
          sw.uFsSweepCx.value = bounds.center.x
          sw.uFsSweepCy.value = bounds.center.y
          sw.uFsSweepR.value = Math.max(bounds.radius, 0.0001)
        }
        SWEEP_DEBUG.source = "material"
      } else if (sweepLaw !== "hazard") {
        /* THIS LINE IS WHY THE PRE-FIX BUG NEVER SHOWED. It runs before the
         * fusion block, on every frame, so a strength the fusion else branch
         * failed to release was overwritten a fraction of a millisecond later.
         * `hazard` removes it — see `SweepLaw`. */
        sw.uFsSweepAmt.value = 0
        SWEEP_DEBUG.source = "none"
      }
      if (animOn) {
        // Motion clock: "syncToDraw" ties the phase to draw-in progress so the
        // surface animation reads as part of the same gesture; otherwise it
        // runs on the shared style clock (independent), which an exporter can
        // drive frame by frame.
        const completion = playheadRef.current
        const time =
          motionMode === "syncToDraw"
            ? completion * 6 // map 0..1 progress into a usable phase range
            : clock.elapsed // shared style clock, see swTime above
        const next = evaluateMaterialAnimation({
          base: frameBase,
          type: styleState.materialAnimationType,
          time,
          speed: styleState.materialAnimationSpeed,
          travel: matTravel,
          intensity: styleState.materialAnimationIntensity,
          completion,
          // Real post-completion clock so one-shot accents (completionFlash)
          // can decay instead of freezing at their completion-1.0 value.
          sinceCompletion: clock.sinceCompletion,
          // …and the arming clock, so the same accent is REACHABLE. The
          // playhead rests at 1 after any draw, so a user selecting Completion
          // Flash always did so tens of seconds after the only event that could
          // trigger it, and saw nothing at all.
          sinceArmed: matArmed,
        })
        liveMaterial.color.set(next.color)
        liveMaterial.roughness = next.roughness
        liveMaterial.metalness = next.metalness
        liveMaterial.clearcoat = next.clearcoat
        liveMaterial.clearcoatRoughness = next.clearcoatRoughness
        liveMaterial.reflectivity = next.reflectivity
        liveMaterial.sheen = next.sheen
        liveMaterial.sheenRoughness = next.sheenRoughness
        liveMaterial.sheenColor.set(next.sheenColor)
        liveMaterial.emissive.set(next.emissive)
        liveMaterial.emissiveIntensity = next.emissiveIntensity
        liveMaterial.envMapIntensity = next.envMapIntensity
        liveMaterial.iridescence = next.iridescence ?? 0
      } else {
        // Animation off → pin the surface to its static base so it never
        // freezes on the last animated frame. Pins EVERY field an animation
        // can touch (metalness/emissive/sheenColor were previously left
        // stuck at their last animated values). Color is pinned too:
        // roughnessPulse darkens it (wet look) and fusion scales it, so
        // without the pin either would leak into later frames.
        liveMaterial.color.set(frameBase.color)
        liveMaterial.roughness = frameBase.roughness
        liveMaterial.metalness = frameBase.metalness
        liveMaterial.clearcoat = frameBase.clearcoat
        liveMaterial.clearcoatRoughness = frameBase.clearcoatRoughness
        liveMaterial.reflectivity = frameBase.reflectivity
        liveMaterial.sheen = frameBase.sheen
        liveMaterial.sheenRoughness = frameBase.sheenRoughness
        liveMaterial.sheenColor.set(frameBase.sheenColor)
        liveMaterial.emissive.set(frameBase.emissive)
        liveMaterial.emissiveIntensity = frameBase.emissiveIntensity
        liveMaterial.envMapIntensity = frameBase.envMapIntensity
        liveMaterial.iridescence = frameBase.iridescence ?? 0
      }

      // ---- Fusion: material half of the relationships -------------------
      // Applied AFTER the animated-material/base writes above, so fusion's
      // surface response (shine following a threshold signal, wet darkening,
      // glow surges) modulates whatever this frame's surface already is.
      // Color/emissive are safe to scale because both branches above set
      // them fresh every frame — nothing accumulates.
      if (fusionFrame) {
        const fz = fusionFrame
        const c01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
        /* THE ZERO-CROSSING LATCH — see `fusionLeverLatchRef`. `EPS` is below
         * one 8-bit step of anything these levers can produce, so it is
         * invisible; what it is NOT is zero, which is the only thing three.js's
         * setter cares about. */
        const latch = fusionLeverLatchRef.current
        const EPS = 1e-4
        const noRecompile = (v: number, driven: boolean, held: boolean) =>
          driven || held ? Math.max(EPS, c01(v)) : c01(v)
        if (fz.clearcoatAdd !== 0) latch.clearcoat = true
        if (fz.sheenAdd !== 0) latch.sheen = true
        if (fz.iridescenceAdd !== 0) latch.iridescence = true
        liveMaterial.clearcoat = noRecompile(
          liveMaterial.clearcoat + fz.clearcoatAdd,
          fz.clearcoatAdd !== 0,
          latch.clearcoat,
        )
        liveMaterial.roughness = c01(liveMaterial.roughness + fz.roughnessAdd)
        liveMaterial.envMapIntensity += fz.envMapAdd
        // SHEEN SATURATION. `sheen` is clamped at 1, and the three presets that
        // drive it (Terminal Gel, Scanline Balloon → softGel; ASCII Rubber →
        // rubber) all sit on a base that is ALREADY at sheen 1.0 — so
        // `sheen + sheenAdd` clamped straight back to 1.0 and the entire
        // angle-independent half of those relationships was arithmetically
        // dead. Sheen strength has no headroom on those materials, but sheen
        // ROUGHNESS has its whole range: tightening the lobe concentrates the
        // same energy into a narrower, brighter velvet rim, which is the
        // visible version of "more sheen" on a surface that is already maxed.
        // Drive both — strength for bases with headroom, roughness for the ones
        // without — so the relationship reads on every material.
        if (fz.sheenAdd !== 0 || latch.sheen) {
          liveMaterial.sheen = noRecompile(liveMaterial.sheen + fz.sheenAdd, fz.sheenAdd !== 0, latch.sheen)
          liveMaterial.sheenRoughness = c01(
            frameBase.sheenRoughness * (1 - Math.min(0.75, fz.sheenAdd)),
          )
        }
        liveMaterial.metalness = c01(liveMaterial.metalness + fz.metalnessAdd)
        /* IRIDESCENCE. A real three.js lever this repo already ships (Oil
         * Slick / Iridescent) and pins to its base every frame twenty lines
         * above — so it was a live parameter that no relationship could reach.
         * three.js treats it as a MIX factor, hence the 0..1 clamp: outside that
         * range it is not more or less thin film, it is undefined. */
        if (fz.iridescenceAdd !== 0 || latch.iridescence) {
          liveMaterial.iridescence = noRecompile(
            liveMaterial.iridescence + fz.iridescenceAdd,
            fz.iridescenceAdd !== 0,
            latch.iridescence,
          )
        }
        if (fz.colorScale !== 1) liveMaterial.color.multiplyScalar(fz.colorScale)
        /* ⚠ THIS TEST USED TO BE `> 0`, AND THAT THREW AWAY HALF A SIGNED DIAL.
         *
         * `FusionLink.amount` is documented "-1..1 … the sign is the polarity of
         * the coupling" and the panel ships it as a `min={-1} max={1}` slider
         * (components/style-panel-scaffold.tsx). A user authoring a `reveal ->
         * glow` link at amount -1 gets `emissiveAdd = -1.8000` out of the fusion
         * engine — and the whole block was skipped, so the emissive was never
         * lowered and the left half of their slider did nothing.
         *
         * Not a built-in's problem: across all eight presets x three drives the
         * minimum `emissiveAdd` is 0, so only CUSTOM fusions can reach it. That
         * is exactly the authoring surface the negative half of the slider
         * exists for.
         *
         * The COLOUR seeding stays gated on `> 0`: giving a black-emissive base
         * the preset's glow colour is what makes a positive link visible, and
         * doing it while turning the glow DOWN would light a surface up in order
         * to darken it. Clamped at 0 because a negative emissive intensity is
         * not a darker surface, it is an invalid one. */
        if (fz.emissiveAdd !== 0) {
          if (fz.emissiveAdd > 0) {
            // Give black-emissive bases the preset's own glow colour, so the
            // angle-independent half of every shine relationship actually reads.
            const em = liveMaterial.emissive
            if (em.r === 0 && em.g === 0 && em.b === 0 && fz.emissiveColor) {
              em.set(fz.emissiveColor)
            }
          }
          liveMaterial.emissiveIntensity = Math.max(
            0,
            liveMaterial.emissiveIntensity + fz.emissiveAdd,
          )
        }
        // Shine band locked to a moving layer field (ASCII Rubber): position,
        // direction and strength come from the fusion frame — overriding the
        // material-animation sweep, which fusion supersedes while active.
        const sw = sweepUniformsRef.current!
        if (fz.sweep) {
          sw.uFsSweepPos.value = fz.sweep.pos
          sw.uFsSweepAmt.value = fz.sweep.amt
          sw.uFsSweepWidth.value = fz.sweep.width
          sw.uFsSweepDirX.value = fz.sweep.dirX
          sw.uFsSweepDirY.value = fz.sweep.dirY
          if (bounds) {
            sw.uFsSweepCx.value = bounds.center.x
            sw.uFsSweepCy.value = bounds.center.y
            sw.uFsSweepR.value = Math.max(bounds.radius, 0.0001)
          }
          fusionSweepDirRef.current = true
          SWEEP_DEBUG.source = "fusion"
        } else if (fusionSweepDirRef.current) {
          releaseFusionSweep(sw, materialSweepOn, sweepLaw)
          fusionSweepDirRef.current = false
        }
      } else {
        // Fusion is off: release the latch so the base pinning above can put
        // these levers back to their real zero. One crossing, on deselection.
        const l = fusionLeverLatchRef.current
        l.clearcoat = false
        l.sheen = false
        l.iridescence = false
        if (fusionSweepDirRef.current) {
          releaseFusionSweep(sweepUniformsRef.current!, materialSweepOn, sweepLaw)
          fusionSweepDirRef.current = false
        }
      }

      /* WHAT THE BAND ACTUALLY IS THIS FRAME. Written last, after both writers,
       * so the readout is the value the GPU will be handed rather than one
       * block's opinion of it. See `SWEEP_DEBUG`. */
      {
        const swOut = sweepUniformsRef.current!
        SWEEP_DEBUG.amt = swOut.uFsSweepAmt.value
        SWEEP_DEBUG.pos = swOut.uFsSweepPos.value
        SWEEP_DEBUG.width = swOut.uFsSweepWidth.value
        SWEEP_DEBUG.dirX = swOut.uFsSweepDirX.value
        SWEEP_DEBUG.dirY = swOut.uFsSweepDirY.value
      }
    }

    /* ---- FLAT STATE — the form driven back to being a drawing ------------
     *
     * LAST WRITE OF THE FRAME, and it has to be. Everything above re-pins the
     * surface from the preset base or the animation evaluator on every single
     * frame; an override applied anywhere earlier is simply overwritten before
     * it reaches the GPU. That is not a subtlety to be discovered later — it is
     * why this block sits here rather than beside the material's construction.
     *
     * ONE MATERIAL, NOT TWO. Every line below is a lerp on the surface that is
     * already there. Swapping in a second, flat material at the handoff would
     * be a cross-dissolve wearing different clothes: two images, one replacing
     * the other, which is the exact read the beat must not have. A single
     * surface losing its specular response and gaining an emissive floor is one
     * object changing state, and it can be scrubbed to any point in between
     * and still be a coherent single thing.
     *
     * WHY THE ALBEDO GOES TO BLACK. `emissive` alone would sit ON TOP of the
     * lit diffuse response, so the flat state would be ink PLUS shading — a
     * lit form with a glow, brighter where the light falls. Driving `color` to
     * black removes the diffuse term entirely, leaving emissive as the only
     * contributor: one constant value across the whole surface, independent of
     * every light in the rig and of the surface normal. That is what makes a
     * paused frame indistinguishable from a filled 2D shape.
     */
    /* ---- THE REVEAL FRACTION, COMPUTED ONCE A FRAME AND SHARED -----------
     *
     * Two consumers now: the `setDrawRange` in the mesh loop below, and the pen
     * TIP's uniforms, which are written in the flat block ABOVE that loop
     * because that is where the flatten group's this-frame matrix is composed.
     *
     * It is computed here rather than twice, and it is a LOCAL rather than a
     * ref, for the reason the carve's inverse is taken from a matrix composed
     * this frame: the tip is the fastest-moving edge on screen, and a value
     * carried across a frame boundary would drag it behind the mark by exactly
     * one frame — visible as the nose lagging the ink at the one place a viewer
     * is watching. `null` when nothing on screen reveals by drawRange, which is
     * also what makes the whole tip block inert on Rod, Solid, Extrude, the
     * Inflate loft and the Desk Doodles engine.
     *
     * `revealDistanceFraction` walks the word's points, so this is one walk a
     * frame where it used to be one PER MESH — the implicit path builds a single
     * fused mesh, so that is a wash today and a saving if it ever is not. */
    /* ANIM-1A2 · UNDER A TIMED TAKE THE BEAT IS THE CLOCK. The keys already
     * carry each triangle's arrival time as a fraction of the take, so the
     * playhead is compared to them directly and the hand's pace lives in the
     * keys instead of here. Null take, and this is the line that always ran. */
    const timedNow = timedRef.current
    const takeBeat =
      timedNow === null
        ? null
        : takeKnockoutRef.current === "clock"
          ? (performance.now() % timedNow.takeMs) / timedNow.takeMs
          : playheadRef.current
    let revealFracNow: number | null = null
    for (let mi = 0; mi < meshes.length; mi++) {
      const md = meshes[mi]
      if (md && md.mode === "inflate" && md.revealKeys) {
        revealFracNow = takeBeat ?? revealDistanceFraction(
          strokes,
          playheadRef.current,
          revealMode,
          hybridBlend,
          liftsLandBetweenStrokes(scheduleRef.current, windowParamsRef.current.mode),
        )
        break
      }
    }
    // Published for `__inflateProbe.revealState()`. See the note there: a mark
    // that was never submitted and a mark that was submitted and discarded are
    // the same picture, and only this number tells them apart.
    liveRevealFrac = revealFracNow

    /* ═══ THE WINDOW, THIS FRAME ═══════════════════════════════════════════
     *
     * ⚠ COMPUTED HERE AND NOT MEMOISED, and that is the same rule the reveal
     * fraction above follows: the interval is a FUNCTION of the playhead, the
     * playhead moves inside this loop, and an interval carried across a frame
     * boundary would drag both edges one frame behind the mark.
     *
     * The beat it is a function of is the DISTANCE fraction, not the time
     * fraction — the same scalar the keys are compared against — so the window
     * rides the pen's own recorded pacing exactly as the prefix does. Handing
     * it `playheadRef.current` instead would make `travel`'s segment move at
     * constant speed over a hand that does not, which is the Natural /
     * Authentic distinction quietly deleted on one dial.
     *
     * At `grow` this is `{ lo: 0, hi: revealFrac }` — `openBack` true, `empty`
     * exactly when the old `frac <= 0` was, `whole` exactly when `frac >= 1`
     * was. Every branch below reads those three booleans rather than the mode
     * name, so the default takes the same path it always did. */
    const winParams = windowParamsRef.current
    const schedForBeat = scheduleRef.current
    /* LAZY, because `revealDistanceFraction` walks every point in the word and
     * the engines that reveal by REBUILDING already pay for that inside their
     * own memo. At `grow` with no schedule nothing here needs a beat those
     * engines have not already computed, so the shipped path adds not one walk.
     * The two conditions are exactly the two consumers: Rod's per-stroke spans
     * need a beat under a schedule, and the window needs one under any mode
     * that is not the prefix. */
    let beatNow = revealFracNow ?? takeBeat
    if (
      beatNow === null &&
      (winParams.mode !== "grow" || (schedForBeat !== null && !schedForBeat.identity))
    ) {
      beatNow = revealDistanceFraction(strokes, playheadRef.current, revealMode, hybridBlend, liftsLandBetweenStrokes(schedForBeat, winParams.mode))
    }
    const winNow = windowAt(winParams, beatNow ?? playheadRef.current, openingRef?.current === true)
    liveRevealWindow = winNow

    /* ═══ THE SCHEDULE, ENSURED — once per rebuild, once per dial ════════════
     *
     * `revealKeys` is the pen's own arc position per triangle. A schedule
     * rewrites those values and re-sorts the index buffer to match, so
     * *"a prefix of a sorted array is exactly the set of triangles whose key ≤
     * the playhead"* keeps holding under a reorder (map §6.2). Zero shader
     * work, zero geometry rebuild.
     *
     * ⚠ THE GUARD IS THE POINT. At the identity schedule this loop reads two
     * fields and does nothing, so today's render is reproduced byte for byte on
     * every engine — and the moment a schedule is applied it also has to be
     * UNDONE when the dials come home, which is why "identity" is handled by
     * re-applying rather than by an early return.
     *
     * It is checked HERE, per frame, and not in an effect: `lib/implicit-defer`
     * refills the live geometry in place and patches `revealKeys` by hand, and
     * *"React will not re-render when a worker finishes"* (explainer 20 §6). The
     * array's IDENTITY is the only signal that a rebuild landed, and reading it
     * is two comparisons. Explainer 24 §5 reached the same shape for the letter
     * stamp for exactly the same reason. */
    const schedNow = scheduleRef.current
    const schedSigNow = timedNow ? timedNow.sig : schedNow && !schedNow.identity ? schedNow.sig : ""
    if (schedRef.current.length !== meshes.length) {
      schedRef.current = meshes.map(() => ({
        baseKeys: null,
        sig: " never",
        applied: null,
        keys: null,
        scratch: null,
      }))
    }
    for (let mi = 0; mi < meshes.length; mi++) {
      const md = meshes[mi]
      const slot = schedRef.current[mi]
      const base = md?.revealKeys ?? null
      if (!base) {
        if (slot.applied) {
          slot.applied = null
          slot.keys = null
        }
        slot.baseKeys = null
        slot.sig = " never"
        continue
      }
      if (slot.baseKeys === base && slot.sig === schedSigNow) continue
      // A rebuild replaced the buffers, so anything this slot had applied is
      // gone with them — the index buffer came back in the build's own order.
      if (slot.baseKeys !== base) slot.applied = null
      slot.baseKeys = base
      slot.sig = schedSigNow
      const geo = tubeMeshRefs.current[mi]?.geometry
      // F118: the re-sort reads and replaces the ORIGINAL index, never the doubled copy.
      if (geo) wrapIndex(geo, false)
      if (!timedNow && (!schedNow || schedNow.identity)) {
        if (slot.applied && geo?.index) {
          const restored = permuteTriangles(
            geo.index.array as unknown as ArrayLike<number>,
            slot.applied,
            null,
            slot.scratch ?? undefined,
          )
          geo.setIndex(new THREE.BufferAttribute(restored.slice(), 1))
        }
        slot.applied = null
        slot.keys = null
        continue
      }
      const mapped = timedNow
        ? timedRevealKeys(base, timedNow.base, timedNow)
        : remapRevealKeys(base, schedNow!)
      if (isAscending(mapped)) {
        /* A PER-STROKE MESH NEEDS NO SORT, and this is how it is known rather
         * than assumed. The Desk Doodles engine builds one mesh per stroke
         * (`lib/dd-engine/adapter.ts:566-583`), so its keys live inside ONE
         * track's span and a monotone map leaves them ascending. Free Stroke's
         * Inflate is one fused surface spanning every track, so a reorder makes
         * them not. Testing the array is exact and costs one pass; branching on
         * an engine NAME would be a second source of truth for a fact the data
         * already carries — the same argument `meshesCarryRevealKeys` makes. */
        if (slot.applied && geo?.index) {
          const restored = permuteTriangles(
            geo.index.array as unknown as ArrayLike<number>,
            slot.applied,
            null,
            slot.scratch ?? undefined,
          )
          geo.setIndex(new THREE.BufferAttribute(restored.slice(), 1))
        }
        slot.applied = null
        slot.keys = mapped
        continue
      }
      if (!geo?.index || geo.index.count !== mapped.length * 3) {
        // The table and the buffer disagree about how many triangles there are.
        // Refusing is the only honest answer: a partial permutation would put
        // the reveal on a surface that is not the one it is describing.
        slot.keys = null
        continue
      }
      const sorted = sortTrianglesByKey(mapped)
      if (!slot.scratch || slot.scratch.length !== mapped.length * 3) {
        slot.scratch = new Uint32Array(mapped.length * 3)
      }
      const next = permuteTriangles(
        geo.index.array as unknown as ArrayLike<number>,
        slot.applied,
        sorted.order,
        slot.scratch,
      )
      geo.setIndex(new THREE.BufferAttribute(next, 1))
      slot.applied = sorted.order
      slot.keys = sorted.keys
    }

    /* ROD'S SHARE OF THE SCHEDULE. Rod is already per-stroke — it has its own
     * clock per stroke off the raw recording (`useTimeline`) — so scheduling it
     * is not new machinery, it is a different source for the same number. Null
     * at the identity schedule, and Rod's own path below is then untouched.
     *
     * The playhead handed in is the SAME scalar every other render path reads:
     * the hand's own time→travel curve. One keyframed scalar owns WHEN, the
     * modifier owns the rule — which is the architecture the Blender Build
     * modifier's two-keys-on-one-`Factor`-row frame settles
     * (`docs/verification/anim-map/blender-gp-build/contact/key-395s.png`). */
    // `Float64Array`, matching `strokeProgressAt` — see the note on its return
    // type: a float32 round trip lands a geometry cut a few ten-thousandths of
    // a pixel off, which was enough to break the row proving the scheduled clip
    // and the shipped clip are the same function.
    let schedStrokeProgress: Float64Array | null = null
    if (schedNow && !schedNow.identity) {
      schedStrokeProgress = strokeProgressAt(
        schedNow,
        beatNow ?? playheadRef.current,
      )
    }
    /* ═══ AND THE SAME ANSWER AS AN INTERVAL — step 3's generalisation ═══════
     *
     * `strokeProgressAt` says how far through its own slot a stroke is, which
     * is the right question for a PREFIX and only half of it for a WINDOW: a
     * travelling segment needs a near end as well as a far one. `strokeSpansIn`
     * is the same arithmetic asked for both edges at once, in the stroke's own
     * 0..1 arc, with a REVERSED track's two ends already swapped.
     *
     * §0.7 — `strokeProgressAt` is not replaced. It stays exported, it stays
     * what the model rows measure, and the line above still calls it; this is a
     * second reader beside it.
     *
     * Null when there is neither a schedule nor a window, which is the shipped
     * default — and then Rod's own per-stroke clock below is reached by exactly
     * the code it was reached by before. */
    let schedSpans: Float64Array | null = null
    /* F118: a wrapped Travel's tail part, `[wrapLo, 1]`, asked of the same
     * function. Null on every window that does not wrap. */
    let schedSpansTail: Float64Array | null = null
    /* ANIM-1A5 · ROD'S OWN CLOCK, PER STROKE, UNDER A TIMED TAKE. Measured by
     * `assert-stroke-timing-browser.mjs` row 6b: with twelve neutral rows, Rod
     * read `sampleTake` spans and at playhead 0 drew stroke 0 with 0 indices
     * where the shipped path draws 96 (the MIN_REVEAL_RINGS stub at
     * `currentTimeMs == tStart`). The spans also skip Rod's per-stroke point
     * tables. So at `grow` over the identity schedule, Rod keeps its own path
     * and only the TIME it is handed changes: take time T maps back to the
     * pen time the stroke would be at with no row, inside the slot through the
     * row's ease, outside it by a plain shift. A stroke whose slot the rows did
     * not move is handed `currentTimeMs` itself, so neutral rows are the shipped
     * frame by construction. A travelling window or a reordered schedule keeps
     * the `sampleTake` spans, as before. */
    let timedRodMs: Float64Array | null = null
    if (timedNow && winNow.identity && (!schedNow || schedNow.identity)) {
      const n = timedNow.slots.length >> 1
      timedRodMs = new Float64Array(n)
      const T = winNow.hi * timedNow.takeMs
      const penNow = playheadRef.current * totalDuration
      for (let i = 0; i < n; i++) {
        const B0 = timedNow.baseSlots[i * 2]
        const B1 = timedNow.baseSlots[i * 2 + 1]
        const t0 = timedNow.slots[i * 2]
        const t1 = timedNow.slots[i * 2 + 1]
        const e = timedNow.eases[i]
        /* ANIM-2 · a performed stroke carries its own pace and has no ease; without
         * this Rod fell through to linear and played his dwell as an even stroke. */
        const pf = timedNow.performed[i]
        if (t0 === B0 && t1 === B1 && !e && !pf) {
          timedRodMs[i] = timedNow.takeMs === totalDuration ? penNow : T
        } else if (T < t0 || !(t1 > t0)) {
          timedRodMs[i] = T < t0 ? B0 - (t0 - T) : B1 + (T - t1)
        } else if (T >= t1) {
          timedRodMs[i] = B1 + (T - t1)
        } else {
          const u = (T - t0) / (t1 - t0)
          timedRodMs[i] = pf ? performedPenMs(timedNow, i, u) : B0 + (B1 - B0) * (e ? e(u) : u)
        }
      }
    } else if (timedNow) {
      /* ANIM-1A2 · Rod reads the same take forward from the clock. */
      schedSpans = sampleTake(timedNow, 0, { lo: winNow.openBack ? 0 : winNow.lo, hi: winNow.hi }).spans
    } else if (schedNow && (!schedNow.identity || !winNow.identity)) {
      schedSpans = strokeSpansIn(schedNow, winNow.lo, winNow.hi)
      if (winNow.wrapLo < 1) schedSpansTail = strokeSpansIn(schedNow, winNow.wrapLo, 1)
    }

    {
      /* THE POSE, AND THE DEV OVERRIDE ON TOP OF IT — folded HERE, once a
       * frame, rather than once a render. See the block at `bumpOverride`: this
       * component no longer re-renders per pose, so a fold done at render time
       * would pin whatever pose was current when a probe last wrote a channel.
       * `readFlatOverride()` is null in production and null whenever no probe
       * has written, so the shipped path is one null check and zero allocation. */
      const base = flattenSrc ? flattenSrc.current : SOLID_STATE
      const ovNow = readFlatOverride()
      /* ANIM-3B · keyed depth and turn fold on top of the pose, under the dev
       * override. `turn` is keyed in degrees and `yaw` is radians. A property
       * with no keys samples `undefined` and leaves the pose's value alone. */
      const ks = keyReader ? keyReader.sample() : null
      const kDepth = ks ? ks.depth : undefined
      const kTurn = ks ? ks.turn : undefined
      const keyed =
        kDepth === undefined && kTurn === undefined
          ? base
          : {
              ...base,
              ...(kDepth === undefined ? null : { depth: kDepth }),
              ...(kTurn === undefined ? null : { yaw: (kTurn * Math.PI) / 180 }),
            }
      const fs = ovNow ? { ...keyed, ...ovNow } : keyed
      const k = fs.ink < 0 ? 0 : fs.ink > 1 ? 1 : fs.ink
      /* THE BASE INK IS PINNED WHETHER OR NOT THE WHOLE WORD IS FLAT, and the
       * move out of the `k > 0` branch below is O5's doing. On the cascade the
       * word's own `ink` is 0 for the entire film — every letter carries its own
       * — so a cache that only refreshed while the WORD was flat would hand the
       * per-letter uniform whatever colour the previous film left in it. It is a
       * string compare and a `Color.set`, so the shipped path pays the same
       * price it always did, one branch earlier. */
      if (flatInkBaseHexRef.current !== fs.color) {
        flatInkBaseRef.current.set(fs.color)
        flatInkBaseHexRef.current = fs.color
      }
      if (k > 0) {
        /* THE SHADE TERM, on the flat ink only.
         *
         * `0.35 * (1 - sx)` from the original compositor. The flat register has
         * no shading model to darken — that is the whole point of it — so the
         * turn's own falloff has to be applied to the ink value itself, or the
         * face reads as a picture being squeezed instead of a surface at an
         * angle. Measured against the original film, this law tracks to within
         * about 1 luma across the readable part of the turn.
         *
         * The BASE colour is cached separately from the shaded one on purpose.
         * Shading in place would compound frame over frame, and it would only
         * fail to compound by accident — the multiply changes the hex, which
         * busts the string cache that would otherwise have re-set it. Relying
         * on that is how a one-line change later reintroduces a darkening
         * feedback loop nobody can see in a still. (The base pin itself now
         * happens above this branch — see the note there.) */
        flatInkRef.current.copy(flatInkBaseRef.current)
        const shade = fs.shade ?? 0
        if (shade > 0) flatInkRef.current.multiplyScalar(1 - shade)
        const keep = 1 - k
        liveMaterial.color.lerp(BLACK, k)
        liveMaterial.emissive.lerp(flatInkRef.current, k)
        liveMaterial.emissiveIntensity = liveMaterial.emissiveIntensity * keep + k
        // Every path that can put a highlight, a reflection or a gradient on
        // the surface. A drawing has none of them.
        liveMaterial.envMapIntensity *= keep
        liveMaterial.reflectivity *= keep
        liveMaterial.clearcoat *= keep
        liveMaterial.sheen *= keep
        liveMaterial.metalness *= keep
        liveMaterial.roughness = liveMaterial.roughness * keep + k
      }
      /* THE SAME FALLOFF, ON THE LIT HALF.
       *
       * `0.35 · (1 − sx)` is a law about the FACE, not about the flat register:
       * the storyboard's §3 K3 table measures it holding across BOTH halves of
       * the original's turn, `logo face in` as well as `3D face out`. The block
       * above only reaches it through `emissive`, which is zero once the form is
       * lit — so past the edge the mark rendered at full brightness at the one
       * angle where the rig lights its extruded SIDE WALL straight down the
       * lens. Measured: interior mean 32.3 on the first pose out of the dwell
       * against 23.4 settled, i.e. the beat ran LIGHTER at its midpoint than
       * where it lands, which is the read `no value wash` exists to reject.
       *
       * Scaling albedo and the environment response reproduces the source's
       * multiplicative law without touching roughness — darkening a surface is
       * not the same as roughening it, and the second would change the shape of
       * the highlight rather than its level. Safe to write unconditionally
       * because everything above re-pins the material from the preset base
       * every frame, so this cannot compound; and at `ink = 1` the albedo has
       * already been lerped to black, so the flat half is unaffected and keeps
       * carrying the falloff through `emissive` exactly as before. */
      /* ---- THE ARRIVAL — the object's own light, turning on -----------------
       *
       * See `FlatState.lit` for the measurement this exists to move: the whole
       * tonal event at the switch was **3.0 luma of interior median** on a mark
       * whose ink-to-paper contrast is 229. The shape changed and nothing
       * confirmed it.
       *
       * IT SITS HERE, BETWEEN THE FLAT COLLAPSE AND THE SHADE FALLOFF, and both
       * neighbours are the reason:
       *
       *  · AFTER the `k > 0` block, because that block's `envMapIntensity *=
       *    keep` is the flat state removing every specular path. Lifting the
       *    environment before it would be lifting a number that is about to be
       *    multiplied by zero — live at `lit: 1`, dead at `ink: 1`, and the two
       *    are the same instant on this beat.
       *  · BEFORE the shade block, so the turn's `(1 − shade)` falloff scales
       *    the ARRIVED environment rather than the ported one. A face at a rake
       *    is darker whether or not its light has arrived, and the two terms
       *    have to compose in that order or the raked frames read brighter than
       *    the settled ones — which is the exact excursion gate 4a rejects.
       *
       * `lit` is clamped and defaulted to 0, so this block is arithmetically
       * inert on every call site that does not pass it — which is every call
       * site except the hero stage. */
      {
        const litLaw = readHeroLitLaw()
        const lit = fs.lit === undefined ? 0 : fs.lit < 0 ? 0 : fs.lit > 1 ? 1 : fs.lit
        if (lit > 0) {
          liveMaterial.envMapIntensity *= 1 + (litLaw.envGain - 1) * lit
        }
        /* THE RIM, WRITTEN ONCE, WITH BOTH ITS DIALS.
         *
         * The strength keeps its ported meaning exactly — `RIM_BASE_STRENGTH *
         * (1 - k)`, a drawing has no rim light — and gains a gain that is 1 at
         * `lit: 0`, so the prior line's value is reproduced to the bit. The
         * POWER is the new one: it interpolates from the ported 2.6 toward the
         * law's own exponent, so at `lit: 0` the shader is handed 2.6 and the
         * parked arm is the port unchanged. */
        if (rimUniformRef.current) {
          rimUniformRef.current.value =
            RIM_BASE_STRENGTH * (1 + (litLaw.rimGain - 1) * lit) * (1 - k)
        }
        if (rimPowerUniformRef.current) {
          rimPowerUniformRef.current.value =
            RIM_BASE_POWER + (litLaw.rimPower - RIM_BASE_POWER) * lit
        }
      }

      {
        const shade = fs.shade ?? 0
        if (shade > 0) {
          const f = shade >= 1 ? 0 : 1 - shade
          liveMaterial.color.multiplyScalar(f)
          liveMaterial.envMapIntensity *= f
        }
      }

      /* ---- depth ----
       * Scaled about the form's own Z CENTRE, not about the world origin.
       * Scaling about the origin would slide the mark toward or away from the
       * camera as it thickened, and under a perspective projection that is a
       * change of on-screen SIZE — the word would breathe at the one moment it
       * has to hold perfectly still. Pinning the centre keeps the silhouette
       * fixed: the front half advances exactly as far as the back half
       * retreats. */
      const g = flattenGroupRef.current
      if (g) {
        const d = fs.depth < 0 ? 0 : fs.depth
        if (g.scale.z !== d) {
          const zc = bounds ? bounds.center.z : 0
          g.scale.z = d
          g.position.z = zc * (1 - d)
        }
        KEY_LIVE.depth = g.scale.z

        /* ---- the turn ----
         * Yawed about the form's OWN vertical axis, not the world origin, for
         * the same reason the depth scale is pinned to the form's z centre: a
         * rotation about the origin swings the mark sideways through the frame,
         * and the one thing the turn must not do is move. Registration is the
         * half of the old gate that stays — hold the centre, break the extent.
         *
         * The matrix is composed here unconditionally rather than only while
         * the yaw is non-zero. Taking `matrixAutoUpdate` over for one phase and
         * handing it back for another leaves the group frozen at whatever the
         * last composed matrix was: with autoUpdate off, a later change to
         * `depth` alone would silently not render. One owner, every frame.
         *
         * Scratch matrices are module-level. The render loop is single
         * threaded, and allocating four per frame is four per frame. */
        /* THE PIVOT IS THE CHILDREN'S OWN CENTRE, MEASURED — not `bounds`.
         *
         * `bounds` comes from `useStrokeBounds`, which unions the tube
         * GEOMETRY bounding boxes. That is the right centre in geometry space
         * but not necessarily in this group's space: anything between the
         * group and the geometry (the export group's own centring transform)
         * offsets it. So the pivot is read off the group's actual children, in
         * the group's own local space, while this group's matrix is identity.
         * Cached because it only changes when the meshes do, and the next frame
         * overwrites the matrix anyway.
         *
         * ⚠ THE CLAIM THIS COMMENT USED TO MAKE IS FALSE, and it is left
         * corrected rather than removed because it is the more useful record.
         * It read: *"the turn slid the mark 57.5px to the right as it went
         * edge-on — the sliver landed at the PIVOT's x (559.5) rather than at
         * the word's centre (502), which is the signature of rotating about the
         * wrong point."*
         *
         * 502 IS NOT THE WORD'S CENTRE. Measured per frame across the parked
         * window: cx is 559.50 at rest, runs out to 502 near 45° of yaw,
         * returns to 559.50 at the sliver, and does the whole excursion AGAIN
         * on the way back. Both ends sit on the optical axis (viewport centre
         * 560), so the ink was never off it — 502 is the far point of a
         * round-trip excursion, hit twice, and reading it as a rest position is
         * what produced the wrong-pivot diagnosis. This measured pivot then
         * produced BYTE-IDENTICAL numbers, which falsified that reading instead
         * of confirming it.
         *
         * The excursion is the PROJECTION, and the fix is
         * `Viewport3DProps.projection` rather than anything here — see that
         * doc for the model, the fit and the prediction. Nothing about this
         * pivot was wrong; it was simply never the cause. */
        const yaw = fs.yaw ?? 0
        if (!pivotRef.current) {
          g.matrix.identity()
          g.updateMatrixWorld(true)
          const box = new THREE.Box3()
          for (const child of g.children) box.expandByObject(child)
          if (!box.isEmpty()) {
            const c = new THREE.Vector3()
            box.getCenter(c)
            /* Y is the CONTACT, not the centre — see the squash below. Stashed
             * on the same cached vector so there is one measured pivot, not
             * two that can disagree. */
            c.y = box.min.y
            pivotRef.current = c
          }
        }
        const cx = pivotRef.current ? pivotRef.current.x : bounds ? bounds.center.x : 0
        const cz = pivotRef.current ? pivotRef.current.z : bounds ? bounds.center.z : 0
        const cyContact = pivotRef.current
          ? pivotRef.current.y
          : bounds
            ? (bounds.minY ?? bounds.center.y)
            : 0

        /* ---- K2's SQUASH ---------------------------------------------------
         * About the mark's own CONTACT, not its centre: an anticipation squash
         * that keeps its contact point is the whole reason a squash reads as
         * weight rather than as a scale. The board's own line for K2 is that
         * the mark presses *down* into the page and widens slightly, which is a
         * bottom-pinned compression — squashing about the bbox centre would
         * lift the baseline by half the compression and read as the mark
         * shrinking in mid-air.
         *
         * X still scales about the mark's x centre, because there is no contact
         * in that axis and the registration the beat is judged on is exactly
         * `cx` not moving.
         *
         * It composes to the RIGHT of the rotation, i.e. it is applied to the
         * mark first: the mark tenses, and then that tensed mark turns. The
         * other order would squash the mark's PROJECTION, which at 45° of yaw
         * is a shear.
         *
         * `1` on both is a no-op that costs one matrix multiply, so it is not
         * branched — a transform that only exists on some frames is how the
         * depth collapse silently stopped rendering once before. */
        const sqx = fs.squashX ?? 1
        const sqy = fs.squashY ?? 1
        /* ---- O2's HINGE ----------------------------------------------------
         * See `FlatState.pitch`. It composes OUTSIDE the yaw — leftmost is
         * applied last — so the hinge axis is the PAGE's X through the contact,
         * not the mark's own axis after it has turned. A pop-up book's hinge is
         * glued to the page; hinging about the turned mark's axis would swing
         * the word sideways out of the page plane instead of standing it up.
         *
         * The pivot is (cx, cyContact, cz): the same measured contact the
         * squash pins to, so the lowest ink is the hinge line and no descender
         * rotates underground — the board's named geometry question for O2.
         *
         * Unbranched at 0 for the reason the squash states: a transform that
         * only exists on some frames is how the depth collapse silently stopped
         * rendering once already. */
        const pitch = fs.pitch ?? 0
        g.matrixAutoUpdate = false
        g.matrix
          .makeTranslation(cx, cyContact, cz)
          .multiply(M_PIT.makeRotationX(pitch))
          .multiply(M_PIT_A.makeTranslation(-cx, -cyContact, -cz))
          .multiply(M_PIT_B.makeTranslation(cx, 0, cz))
          .multiply(M_ROT.makeRotationY(yaw))
          .multiply(M_A.makeTranslation(-cx, 0, -cz))
          .multiply(M_SQ_A.makeTranslation(cx, cyContact, 0))
          .multiply(M_SQ_B.makeScale(sqx <= 0 ? 1e-6 : sqx, sqy <= 0 ? 1e-6 : sqy, 1))
          .multiply(M_SQ_C.makeTranslation(-cx, -cyContact, 0))
          // The depth collapse still has to compose with the turn.
          .multiply(M_B.makeTranslation(0, 0, g.position.z))
          .multiply(M_C.makeScale(1, 1, g.scale.z <= 0 ? 1e-6 : g.scale.z))
        g.matrixWorldNeedsUpdate = true
        KEY_LIVE.yaw = yaw
      }

      /* ---- O5's CASCADE: eight letters, eight turns, one material ---------
       *
       * See `FlatState.letters` and `applyLetterMotion`. Uniforms only — the
       * whole cascade is a vertex transform and a fragment mix, so there is no
       * second material, no second mesh and no per-object anything.
       *
       * THE INVERSE IS THIS FRAME'S, for the reason the break's and the carve's
       * are: `matrixWorld` is still the previous frame's during `useFrame`, and
       * `uFsLetterInv` is what recovers a cap's offset inside the word. One
       * frame late through the tense — where the squash IS moving the flatten
       * group — would drag every cap a frame behind its own tube.
       *
       * The INK is the same colour object the flat state lerps toward, so the
       * un-flipped letters and the whole-word flat state cannot disagree about
       * what a drawing looks like. `flatInkRef` carries the register's own
       * graphite; the per-letter shade rides `a.w` rather than being folded in
       * here, because it is per letter and this is one colour.
       *
       * Written unconditionally to ZERO when there is no cascade — not skipped.
       * A uniform left at the last film's values is exactly the class of defect
       * that put a dead channel in this file twice; `count 0` is the identity
       * and it is asserted rather than assumed (`assert-hero-letters.mjs`). */
      const lu = letterUniformsRef.current
      if (lu) {
        const ls = fs.letters
        const geo = letterPivotsRef.current
        const n = ls && geo ? Math.min(ls.length, geo.count, FS_LETTER_MAX) : 0
        if (n > 0 && g && geo) {
          g.updateWorldMatrix(true, false)
          lu.inv.value.copy(g.matrixWorld).invert()
          /* ---- EACH LETTER'S AXIS, THIS FRAME --------------------------------
           *
           * Not `geo.pivots` verbatim any more. A letter turns about its own
           * centre while it is flipping and about the WORD's once it has landed,
           * and `LetterState.settle` is where it is between the two. The reason
           * is arithmetic and is written out in full there: a letter's pose is
           * `R·p + (I − R)·piv`, so two letters at the SAME yaw about DIFFERENT
           * pivots are two different rigid motions and the ink between them is
           * pulled apart by `(I − R)·Δpiv`. The cascade settles all ten letters
           * at one shared yaw (30°) and holds it for the whole 2.2 s SOLID beat,
           * which is why Sebs's *"the mesh gets fucked"* frame is a settled one.
           *
           * The interpolation is on the PIVOT and not on the result, so the
           * transform stays an exact rigid motion on every frame — a lerp
           * between two posed points would shrink the letter through the middle
           * of its own flip.
           *
           * z is untouched: `buildLetterGeometry` already gives every letter the
           * same `cz`, so only x can differ and only x has to converge. */
          const piv = lu.pivot.value
          const settling = readLetterSettleToWord()
          for (let i = 0; i < FS_LETTER_MAX; i++) {
            const own = geo.pivots[i * 2]
            const s = settling && i < n ? (ls![i].settle ?? 0) : 0
            piv[i * 2] = own + (geo.wordX - own) * (s < 0 ? 0 : s > 1 ? 1 : s)
            piv[i * 2 + 1] = geo.pivots[i * 2 + 1]
          }
          if (process.env.NODE_ENV !== "production") {
            const own: number[] = []
            const live: number[] = []
            const yaw: number[] = []
            for (let i = 0; i < n; i++) {
              own.push(geo.pivots[i * 2])
              live.push(piv[i * 2])
              yaw.push(ls![i].yaw)
            }
            liveLetterAxes = { own, live, wordX: geo.wordX, yaw, count: n }
          }
          const a = lu.a.value
          for (let i = 0; i < n; i++) {
            const s = ls![i]
            a[i * 4] = s.yaw
            a[i * 4 + 1] = s.flat < 0 ? 0 : s.flat > 1 ? 1 : s.flat
            a[i * 4 + 2] = s.depth < 0 ? 0 : s.depth
            a[i * 4 + 3] = s.shade < 0 ? 0 : s.shade > 1 ? 1 : s.shade
          }
          // `flatInkRef` is re-pinned above every frame from `fs.color`, in the
          // renderer's working colour space — the same value `emissive` gets.
          lu.ink.value.copy(flatInkBaseRef.current)
          lu.count.value = n
        } else {
          lu.count.value = 0
        }
      }

      /* ---- K7's NEWS: the junctions open a hairline of PAPER ------------
       *
       * See `FlatState.jointBreak`. This writes the shader's uniforms and
       * nothing else — the break itself is a `discard`, so there is no second
       * layer, no second material and no colour anywhere in this path.
       *
       * THE INVERSE IS TAKEN FROM A MATRIX COMPOSED THIS FRAME. `matrixWorld`
       * is still the previous frame's during `useFrame` — three updates the
       * graph at render time — and a frame-late inverse would drag the breaks
       * behind the mark through the return's turn, which is the whole stretch
       * they are open for. `updateWorldMatrix(true, false)` walks the ancestors
       * and recomposes this node from the matrix just written; with
       * `matrixAutoUpdate` false it cannot overwrite it. */
      const bu = breakUniformsRef.current
      if (bu) {
        const openRaw = fs.jointBreak ?? 0
        const open = openRaw < 0 ? 0 : openRaw > 1 ? 1 : openRaw
        bu.open.value = open
        const carveNow = Math.max(0, Math.min(1, fs.penCarve ?? 0))
        const table = open > 0 && g ? syncBreakTable(carveNow) : null
        if (table && table.count > 0 && g) {
          g.updateWorldMatrix(true, false)
          bu.inv.value.copy(g.matrixWorld).invert()
          bu.count.value = table.count
          bu.band.value = open * table.gap
          bu.arc.value = table.reach
          const cull = table.reach + table.keep + table.gap
          bu.cull2.value = cull * cull
          bu.data.value.set(table.data)
        } else {
          bu.count.value = 0
        }
      }

      /* ---- THE PEN CARVE: the silhouette itself becomes the drawing's ----
       *
       * See `FlatState.penCarve`. Uniforms only — the carve is a `discard`, so
       * there is no second mesh, no second material and no colour in this path.
       * The inverse is taken from the matrix composed THIS frame for the same
       * reason the break's is: a frame-late inverse drags the carve behind the
       * mark through the turn, which is exactly the stretch it is open for. */
      const pu = penUniformsRef.current
      if (pu) {
        const carveRaw = fs.penCarve ?? 0
        const carve = carveRaw < 0 ? 0 : carveRaw > 1 ? 1 : carveRaw
        const pf = carve > 0 && g ? syncPenField() : null
        if (pf && pf.texture && g) {
          g.updateWorldMatrix(true, false)
          pu.inv.value.copy(g.matrixWorld).invert()
          pu.field.value = pf.texture
          pu.box.value.copy(pf.box)
          pu.units.value = pf.units
          /* THE ENVELOPE, PUSHED OUT TO CLEAR THE MESH — `PEN_CARVE_ENVELOPE_R`
           * carries the measurement. Written every frame rather than cached
           * because the dev setter can move it between frames, and a control
           * that only takes on a rebuild is a control a sweep cannot use. */
          pu.slack.value = Math.max(0, (readCarveEnvelopeR() - PEN_FIELD_TUBE_SLACK) * pf.radius)
          /* The dev instrumentation, written every frame for the same reason
           * the slack is: a control a sweep can only take on a rebuild is a
           * control a sweep cannot use. Both are 0 unless a probe asks. */
          pu.dbg.value = process.env.NODE_ENV === "production" ? 0 : liveCarveDebug
          pu.hard.value = process.env.NODE_ENV === "production" ? 0 : liveCarveHard
          /* WRITTEN EVERY FRAME for the reason the slack above is: a control
           * that only takes on a rebuild is a control a sweep cannot use, and
           * this one's whole job is to be the OFAT arm that re-renders the
           * defect. See `PEN_CARVE_AA_FWIDTH`. */
          pu.aa.value = readCarveAA() ? 1 : 0
          pu.carve.value = carve
        } else {
          // No field, no carve. Never a partial one: a carve driven against a
          // stale or missing field would move the silhouette to the wrong
          // place, which is worse than not moving it.
          pu.carve.value = 0
        }
      }

      /* ---- THE PEN TIP: the moving end stops being a CUT ----------------
       *
       * See `applyPenTip` and `lib/pen-reveal.ts` §T. Uniforms only, same
       * `discard`, same coverage, same this-frame inverse — and the same
       * all-or-nothing rule the carve states: a tip driven against a stale or
       * missing field would put the moving end in the wrong place, which is
       * strictly worse than leaving the shipped cut alone.
       *
       * It is gated on `revealActive` rather than on the flat state, because
       * the reveal is not a flat-state channel: `/` draws the same word in on
       * the same surface with `flatten` at its solid default. The one thing it
       * IS gated on is the reveal being PARTIAL — at `frac >= 1` the surface is
       * whole and every settled frame in the verification battery has to be
       * byte-identical to what it was, which a uniform at 0 guarantees by
       * construction rather than by inspection. */
      const tu = penTipUniformsRef.current
      if (tu) {
        const mode = readPenTipMode()
        /* THE SHAPE, THROUGH THE ONE READER. `readPenTipShape` is what the
         * drawRange margin below also calls, so the cull in front of the
         * boundary and the boundary itself cannot disagree about how far ahead
         * of the pen the nose reaches. */
        const shape = readPenTipShape(mode)
        const revealFrac = revealFracNow
        /* THE GATE IS THE WINDOW'S, NOT THE PLAYHEAD'S — and at `grow` it is the
         * same gate. `whole` is `revealFrac >= 1` there, so every settled frame
         * in the verification battery still turns this block off by
         * construction. Under `vanish` and `shrink` the mark is whole at the
         * OTHER end of the beat, and a tip left on at a playhead where there is
         * no boundary would carve an edge into a finished mark. */
        const wants = mode !== "off" && revealFrac !== null && !winNow.whole
        const tf = wants && g ? syncTipField() : null
        if (tf && tf.texture && g && revealFrac !== null) {
          g.updateWorldMatrix(true, false)
          tu.inv.value.copy(g.matrixWorld).invert()
          tu.field.value = tf.texture
          tu.box.value.copy(tf.box)
          /* THE LEADING EDGE IS THE WINDOW'S UPPER BOUND. At `grow` that IS
           * `revealFrac` — `windowAt` returns `{ lo: 0, hi: beat }` — so this
           * is the same number this uniform has always carried. */
          tu.d.value = winNow.hi
          // Nib half-widths → arc fraction. Quoted in half-widths so a wider
          // pen or a longer word cannot silently change the SHAPE of the end.
          /* 🔴 THE NOSE RIDES THE SCHEDULE — the trap the map flags in red.
           *
           * `syncTipField` has already put the field's `arc` channel through
           * `scheduleArc`, so the fragment's `when` is in the BEAT's units.
           * `nose` and `taper` are lengths ALONG the mark and are quoted in arc
           * fraction via `radiusArc`, so they have to be converted the same way
           * — and because a schedule is a translation at ONE slope for the whole
           * word (`StrokeSchedule.scale`; `uniformSlope` is computed, not
           * assumed), that conversion is a multiply rather than a third texture
           * channel. `arcToLocal` goes the other way: it turns the boundary's
           * signed distance back into LOCAL units for the antialiasing, so it
           * divides by the same number.
           *
           * Get this wrong and the symptom is precise and visible: the moving
           * nose detaches from the stroke it is drawing. `assert-stroke-schedule`
           * measures the gap between the tip's nose and the ink at several
           * orders, and its known-bad is this conversion left out. */
          const ts = readTipRidesSchedule() ? scheduleRef.current : null
          /* ANIM-1A3 · under a timed take the per-texel slope replaces the one
           * word-wide scale, so the scale is 1 and the shader reads the slope. */
          const timedTip = timedRef.current !== null
          const tScale = timedTip ? 1 : ts && !ts.identity ? ts.scale : 1
          const slopeOn = timedTip && !!tf.slopeTex && takeKnockoutRef.current !== "slope"
          tu.slope.value = slopeOn ? tf.slopeTex : tf.texture
          tu.slopeOn.value = slopeOn ? 1 : 0
          tu.back.value = (1 - shape.nose) * tf.radiusArc * tScale
          tu.taper.value = shape.taper * tf.radiusArc * tScale
          tu.arcToLocal.value = tf.arcToLocal / (tScale > 0 ? tScale : 1)
          tu.aa.value = readTipAA() ? 1 : 0
          /* 🔴 THE SECOND EDGE. `back` and `taper` are already in the beat's
           * units above, and the trailing test reuses them with the sign
           * flipped in the shader — one nib, mirrored, rather than a second
           * pair of dials for a shape nobody asked to differ. `trailOn` is 0 at
           * every `grow` playhead, which is what leaves the whole block
           * uniform-control-flow dead and the default render unchanged. */
          const wrapped = winNow.wrapLo < 1
          tu.w0.value = wrapped ? winNow.wrapLo : winNow.lo
          tu.trailOn.value = (wrapped || !winNow.openBack) && readTipTrailsWindow() ? 1 : 0
          tu.wrapOn.value = wrapped ? 1 : 0
          /* F121 · THE HOLDS, under a timed take only, where `d` and the
           * holds' times are both take fractions. The radius is set here from
           * the live shape: the mesh reaches 2 nib half-widths and the taper
           * lags the edge by `taper` more, the segment that straddles the
           * hold's arc carries interpolated arrivals along its whole length,
           * and the LINEAR fetch reaches a texel each way. */
          tu.hold.value = tf.holds
          tu.holdN.value = timedTip ? tf.holdN : 0
          tu.holdR.value = (2 + shape.taper) * tf.radiusLocal + tf.segMaxLocal + 2 * tf.texelLocal
          tu.on.value = 1
        } else {
          tu.on.value = 0
        }
      }

      /* ---- THE READOUT — see `DrawDiag`. Written LAST, so every value is the
       * one this frame's three passes were handed, not the one they were about
       * to be handed. `det()` is three's own `Matrix4.determinant()`; a zero
       * there is the shared-input failure OFAT structurally cannot attribute. */
      liveDrawDiag = {
        revealFrac: revealFracNow,
        depth: fs.depth,
        ink: fs.ink,
        lit: fs.lit ?? 0,
        penCarveState: fs.penCarve ?? 0,
        jointBreakState: fs.jointBreak ?? 0,
        pen: pu
          ? {
              carve: pu.carve.value,
              units: pu.units.value,
              slack: pu.slack.value,
              box: pu.box.value.toArray(),
              aa: pu.aa.value,
              invDet: pu.inv.value.determinant(),
            }
          : null,
        tip: tu
          ? {
              on: tu.on.value,
              d: tu.d.value,
              back: tu.back.value,
              taper: tu.taper.value,
              arcToLocal: tu.arcToLocal.value,
              ...(tu.slopeOn.value ? { slopeOn: tu.slopeOn.value } : {}),
              ...(tu.holdN.value ? { holdN: tu.holdN.value, holdR: tu.holdR.value } : {}),
              box: tu.box.value.toArray(),
              aa: tu.aa.value,
              invDet: tu.inv.value.determinant(),
            }
          : null,
        brk: bu
          ? { count: bu.count.value, band: bu.band.value, arc: bu.arc.value, cull2: bu.cull2.value }
          : null,
        worldDet: g ? g.matrixWorld.determinant() : 0,
      }
    }

    const progress = playheadRef.current
    const currentTimeMs = progress * totalDuration

    for (let si = 0; si < meshes.length; si++) {
      const mesh = tubeMeshRefs.current[si]
      const strokeMeshData = meshes[si]

      if (!mesh || !strokeMeshData) continue

      // INFLATE / IMPLICIT FUSION — the draw-in is a drawRange, not a rebuild.
      //
      // `revealKeys` is an ASCENDING per-triangle arc position produced once at
      // build time, with the index buffer sorted to match (lib/implicit-surface
      // §6). So "how much of the mark has the pen drawn" is a binary search and
      // a `setDrawRange` — the same mechanism Rod has always used, and zero
      // geometry work per frame.
      //
      // It is here because the alternative was measured and is not survivable:
      // rebuilding this surface from a stroke prefix costs 24ms at five percent
      // of the word and 531ms at the whole of it, on a beat that asks for ~120
      // of those inside 2.6 seconds
      // (`scripts/verify/measure-implicit-cost.mjs`). That is the 1.1s stall
      // immediately before the emerge.
      if (strokeMeshData.mode === "inflate" && strokeMeshData.revealKeys) {
        /* …UNLESS A HARNESS HAS LATCHED IT HIDDEN. See `forcedHiddenMeshes`:
         * this line ran unconditionally, so `__inflateProbe.setMeshVisible`
         * would have been reverted before the next painted frame and row 3 of
         * explainer 24 §10.2 would have stayed unfalsifiable behind a control
         * that returned `true`. The set is empty on every non-dev frame. */
        mesh.visible = !isForcedHidden(mesh)
        const geo = mesh.geometry
        /* F118: the count is the ORIGINAL index's, and the doubled copy goes on
         * only in the wrapped branch below. */
        const origIdx = wrapIndex(geo, false)
        const totalIndices = origIdx ? origIdx.count : 0
        // TIME fraction → DISTANCE fraction, through the SHARED law: the pen's
        // own recorded hesitations are what Natural / Authentic mean, and this
        // is the same call lib/flat-ink.ts makes for the 2D register.
        //
        // Computed ONCE at the top of the frame (`revealFracNow`) because the
        // pen tip's uniforms need the same number, and the tip is written
        // earlier in the loop. The fallback keeps this branch correct if a mesh
        // ever carries a reveal table the scan above did not see.
        const frac =
          revealFracNow ??
          revealDistanceFraction(strokes, progress, revealMode, hybridBlend, liftsLandBetweenStrokes(scheduleRef.current, windowParamsRef.current.mode))
        /* ⚠ THE THREE BRANCHES ARE THE WINDOW'S, NOT THE PLAYHEAD'S — and at
         * `grow` they are the same three. `whole` is exactly the old
         * `frac >= 1`, `empty` is exactly the old `frac <= 0`, and `openBack`
         * is true at every `grow` playhead so the trailing search below is
         * skipped and `setDrawRange` receives the two arguments it always did.
         * Reading the booleans rather than the mode name is what keeps that a
         * property of the wiring instead of a thing a test has to notice. */
        if (winNow.whole) {
          geo.setDrawRange(0, totalIndices)
        } else if (winNow.empty) {
          geo.setDrawRange(0, 0)
        } else {
          /* THE SCHEDULED TABLE IF THERE IS ONE, the recording's if there is
           * not. `schedRef` holds the remapped-and-re-sorted keys that match the
           * index buffer as it stands this frame; at the identity schedule it
           * holds null and this is the array the build produced. */
          const keys = schedRef.current[si]?.keys ?? strokeMeshData.revealKeys
          /* ---- THE FRONT IS DRAWN PAST THE PEN, ON PURPOSE ----------------
           *
           * `setDrawRange` is no longer the reveal's boundary — it is a cheap
           * cull in FRONT of one. The boundary is `applyPenTip`'s fragment
           * test, and a rounded nose EXTENDS the drawn mark up to one nib
           * half-width past the pen point. Cutting the index buffer exactly at
           * the pen would throw away the triangles that nose lives on, and the
           * nose would be clipped back into the flat chop it replaces — the
           * defect, arrived at from the other side.
           *
           * The margin is the tip field's own `radiusArc` (one half-width as an
           * arc fraction), doubled: `revealKeys` is a per-triangle MAX over
           * three vertices of the NEAREST-capsule arc, so a triangle can carry
           * a key up to its own diameter ahead of the ink it actually holds.
           * Doubling costs a few hundred triangles rasterised and discarded on
           * a 147k-triangle surface; getting it wrong costs the whole fix.
           *
           * At `nose = 0` (`cut`) the margin is still paid. That is deliberate:
           * a margin that changes with the shape dial would make the four modes
           * differ by which TRIANGLES exist as well as by which fragments
           * survive, and then a render could not attribute a difference to the
           * shape.
           *
           * ── AND THAT CONSTANT IS A FLOOR, NOT A CEILING ──────────────────
           * Every SHIPPED shape has `nose <= 1`, so `max(2, nose + 1)` is
           * exactly 2 for all of them and the paragraph above still holds
           * byte-for-byte — `off`, `cut`, `nib`, `quill` and `chisel` continue
           * to differ only in which fragments survive. It grows only when a
           * nose is asked for that 2 would CLIP, which is the one case where
           * holding the constant would silently render a shape other than the
           * one requested. `readPenTipShape` is the same reader the fragment
           * uniforms take, so the two cannot drift. */
          const tipMode = readPenTipMode()
          const tipOn = tipMode !== "off"
          /* ── AND IT IS QUOTED IN THE SCHEDULE'S UNITS, NOT THE RECORDING'S ──
           * `radiusArc` is one nib half-width as a fraction of the pen's TOTAL
           * TRAVEL. A schedule compresses that travel onto the beat by exactly
           * `scale` (= 1/T, one number for the whole word — see
           * `StrokeSchedule.scale`), so the margin has to travel with it or the
           * cull would land in front of a nose that has moved. Same conversion,
           * same constant, as the two tip uniforms below. */
          const schedScale = timedRef.current
            ? (tipFieldRef.current?.slopeMax ?? 1)
            : schedRef.current[si]?.keys && scheduleRef.current && !scheduleRef.current.identity
              ? scheduleRef.current.scale
              : 1
          const margin = tipOn
            ? (tipFieldRef.current?.radiusArc ?? 0) *
              Math.max(2, readPenTipShape(tipMode).nose + 1) *
              schedScale
            : 0
          /* ANIM-1A6 · UNDER A TIMED TAKE AT `grow` the front is walked in arc,
           * per stroke (`timedFront`), because the keys are clock times and a
           * nib's length of arc costs a different clock in every stroke. The
           * `slopeMax` margin above stays for a travelling window only. */
          const timedCull = timedRef.current
          const front =
            timedCull && tipOn && winNow.openBack && winNow.wrapLo >= 1
              ? timedFront(
                  timedCull,
                  winNow.hi * timedCull.takeMs,
                  (tipFieldRef.current?.radiusArc ?? 0) * Math.max(2, readPenTipShape(tipMode).nose + 1),
                )
              : margin > 0 ? Math.min(1, winNow.hi + margin) : winNow.hi
          // First index whose key EXCEEDS the front == the triangle count to
          // draw. Ascending by construction, so this is a plain lower bound.
          let lo = 0
          let hi = keys.length
          while (lo < hi) {
            const mid = (lo + hi) >> 1
            if (keys[mid] <= front) lo = mid + 1
            else hi = mid
          }
          /* ═══ AND THE SECOND SEARCH — THE WINDOW'S TRAILING EDGE ══════════
           *
           * `docs/animation-toolset-map.md` §8 names the whole cost of step 3
           * in one clause: *"it is two binary searches instead of one on the
           * `setDrawRange` path."* This is the second one, and it is second in
           * a literal sense — the triangles below it are SKIPPED rather than
           * culled, by moving `setDrawRange`'s START off zero, which is a thing
           * a prefix has no way to say.
           *
           * ⚠ THE MARGIN GOES THE OTHER WAY HERE. The leading margin exists
           * because a rounded nose draws ink PAST the pen, so the cull has to
           * sit ahead of the boundary. The trailing nib is the same nib
           * mirrored, so its fragments live BEHIND the trailing edge and the
           * cull has to sit behind it — subtract where the front adds. Get the
           * sign wrong and the trailing nose is clipped back into the flat chop
           * it exists to replace, which is the leading defect arrived at from
           * the other end.
           *
           * `openBack` short-circuits it at every `grow` playhead, so this is
           * not merely cheap at the default — it does not run. */
          /* F118, THE WRAP: the tail part `[wrapLo, 1]` is a SUFFIX of the sorted
           * triangles, the head part the prefix found above, so on the doubled
           * index they are one range from the suffix's start to N + the prefix's
           * end. The trailing search is the same one, asked of `wrapLo`. */
          if (winNow.wrapLo < 1) {
            const back = margin > 0 ? Math.max(0, winNow.wrapLo - margin) : winNow.wrapLo
            let a = 0
            let b = keys.length
            while (a < b) {
              const mid = (a + b) >> 1
              if (keys[mid] <= back) a = mid + 1
              else b = mid
            }
            const headEnd = Math.min(lo * 3, totalIndices)
            const tailStart = Math.min(a * 3, totalIndices)
            if (tailStart <= headEnd) {
              geo.setDrawRange(0, totalIndices)
            } else {
              wrapIndex(geo, true)
              geo.setDrawRange(tailStart, totalIndices - tailStart + headEnd)
            }
            continue
          }
          let lo0 = 0
          if (!winNow.openBack) {
            const back = margin > 0 ? Math.max(0, winNow.lo - margin) : winNow.lo
            let a = 0
            let b = keys.length
            while (a < b) {
              const mid = (a + b) >> 1
              if (keys[mid] <= back) a = mid + 1
              else b = mid
            }
            lo0 = a
          }
          const hiIdx = Math.min(lo * 3, totalIndices)
          const loIdx = Math.min(lo0 * 3, hiIdx)
          geo.setDrawRange(loIdx, hiIdx - loIdx)
        }
        continue
      }

      // Solid, Extrude and Inflate's LOFT all animate by REBUILDING geometry
      // from progress-filtered strokes (see `animatedStrokes` useMemo +
      // `SolidAnimationTick`). The mesh itself is always fully visible
      // every frame; the partial reveal lives inside the geometry that
      // `useStrokeMeshes` produces. Per-stroke visibility gating and
      // per-segment drawRange are NEVER applied to these modes — they
      // would either pop entire strokes (gating) or interleave cap and
      // wall triangles incorrectly (drawRange on a non-Rod geometry).
      if (
        strokeMeshData.mode === "solid" ||
        strokeMeshData.mode === "extrude" ||
        strokeMeshData.mode === "inflate"
      ) {
        /* …UNLESS A HARNESS HAS LATCHED IT HIDDEN — see the note on the same
         * line inside the inflate branch above, and `forcedHiddenMeshes`. */
        mesh.visible = !isForcedHidden(mesh)
        continue
      }

      // Rod mode: animate with drawRange + caps + joints
      const startCap = startCapRefs.current[si]
      const endCap = endCapRefs.current[si]
      const jointGroup = jointGroupRefs.current[si]
      const timeline = timelines[si]

      if (!timeline) continue

      const geo = mesh.geometry as THREE.TubeGeometry
      // F118: the original index back on, and its count, unless the wrap below swaps.
      const origIdx = wrapIndex(geo, false)
      const totalIndices = origIdx ? origIdx.count : 0
      const minVisibleIndices = RADIAL_SEGMENTS * 6 * MIN_REVEAL_RINGS

      /* THE SCHEDULE'S ANSWER FOR THIS STROKE, or null when there is none. It
       * is an ARC fraction inside the stroke, which is what `distFrac` below
       * already is — so the drawRange, the caps and the joints are reached by
       * exactly the code they were reached by before. */
      /* ⚠ THE WINDOW'S NEAR END, ON ROD. `schedF` is the far end and it is what
       * step 2 read; `schedF0` is the near one, and it is 0 at every `grow`
       * playhead of every schedule step 2 could produce — which is why the two
       * branches below still ask the same questions they asked then. A reversed
       * track's ends are already swapped inside `strokeSpansIn`, so nothing
       * here branches on direction. */
      const strokeNowMs =
        timedRodMs && si < timedRodMs.length ? timedRodMs[si] : currentTimeMs
      let schedF0 =
        schedSpans && si * 2 < schedSpans.length ? schedSpans[si * 2] : null
      let schedF =
        schedSpans && si * 2 + 1 < schedSpans.length
          ? schedSpans[si * 2 + 1]
          : schedStrokeProgress && si < schedStrokeProgress.length
            ? schedStrokeProgress[si]
            : null

      /* ═══ F118, A WRAPPED TRAVEL ON ROD — two parts on one tube ═══════════
       * One part touches the stroke's start (ring 0) and the other its end, so
       * the pair is one range on the doubled index: the high part's first ring
       * to N + the low part's last. A part that is empty, or a pair that
       * touches, collapses to one span and takes the code below unchanged. */
      if (schedSpansTail && si * 2 + 1 < schedSpansTail.length) {
        const t0 = schedSpansTail[si * 2]
        const t1 = schedSpansTail[si * 2 + 1]
        const h0 = schedF0 ?? 0
        const h1 = schedF ?? 0
        const headOn = h1 > h0
        const tailOn = t1 > t0
        if (tailOn && !headOn) {
          schedF0 = t0
          schedF = t1
        } else if (tailOn && headOn) {
          const lowHi = h0 <= t0 ? h1 : t1
          const highLo = h0 <= t0 ? t0 : h0
          const segs = ((geo as any).parameters as { tubularSegments?: number } | undefined)?.tubularSegments
          if (highLo <= lowHi || segs == null) {
            // Touching, or a tube with no rings to split: one span, the code below.
            schedF0 = Math.min(h0, t0)
            schedF = Math.max(h1, t1)
          } else {
            {
              const ipr = RADIAL_SEGMENTS * 6
              const rf = strokeMeshData.ringArcFracs
              const ringOf = (f: number) => {
                if (!rf || rf.length !== segs + 1) return Math.floor(f * segs)
                let a = 0
                let b = rf.length - 1
                while (a < b - 1) {
                  const mid = (a + b) >> 1
                  if (rf[mid] <= f) a = mid
                  else b = mid
                }
                return f >= rf[b] ? b : a
              }
              const lowRings = Math.min(ringOf(lowHi) + 1, segs + 1)
              const lowEnd = Math.min(lowRings * ipr, totalIndices)
              const highRing = ringOf(highLo)
              const highStart = Math.min(highRing * ipr, totalIndices)
              if (highStart <= lowEnd) {
                geo.setDrawRange(0, totalIndices)
              } else {
                wrapIndex(geo, true)
                geo.setDrawRange(highStart, totalIndices - highStart + lowEnd)
              }
              const lowVisible = lowRings >= MIN_REVEAL_RINGS + 1
              const highVisible = segs + 1 - highRing >= MIN_REVEAL_RINGS + 1
              if (startCap) startCap.visible = lowVisible
              if (endCap) {
                endCap.visible = highVisible && !!strokeMeshData.capPositions
                if (endCap.visible && strokeMeshData.capPositions) endCap.position.copy(strokeMeshData.capPositions[1])
              }
              if (jointGroup) {
                jointGroup.visible = lowVisible || highVisible
                const fracs = strokeMeshData.jointFractions ?? []
                const highFrac = highRing > 0 && rf ? rf[highRing] : highLo
                for (let ji = 0; ji < jointGroup.children.length; ji++) {
                  const f = fracs[ji] ?? 0
                  jointGroup.children[ji].visible =
                    ji < fracs.length && ((lowVisible && f <= lowHi) || (highVisible && f >= highFrac))
                }
              }
            }
            continue
          }
        }
      }

      if (
        schedF !== null
          ? schedF <= (schedF0 ?? 0)
          : strokeNowMs < timeline.tStart
      ) {
        geo.setDrawRange(0, 0)
        if (startCap) startCap.visible = false
        if (endCap) endCap.visible = false
        if (jointGroup) jointGroup.visible = false
        continue
      }

      if (
        schedF !== null
          ? schedF >= 1 && (schedF0 ?? 0) <= 0
          : strokeNowMs >= timeline.tEnd
      ) {
        geo.setDrawRange(0, totalIndices)
        if (startCap) startCap.visible = true
        if (endCap && strokeMeshData.capPositions) {
          endCap.visible = true
          endCap.position.copy(strokeMeshData.capPositions[1])
        }
        if (jointGroup) {
          jointGroup.visible = true
          for (const child of jointGroup.children) {
            child.visible = true
          }
        }
        continue
      }

      const strokeDuration = Math.max(timeline.tEnd - timeline.tStart, 1)
      const elapsed = strokeNowMs - timeline.tStart
      const timeFrac = Math.min(elapsed / strokeDuration, 1)

      // --- Convert timeFrac -> distFrac using per-point mapping ---
      const tf = strokeMeshData.timeFracs
      const df = strokeMeshData.distFracs
      const curve = strokeMeshData.curve

      // Compute rawDistFrac: pen-speed-based arc-length fraction
      let rawDistFrac = timeFrac // fallback
      if (tf && df && tf.length >= 2 && df.length === tf.length) {
        let lo = 0
        let hi = tf.length - 1
        while (lo < hi - 1) {
          const mid = (lo + hi) >> 1
          if (tf[mid] <= timeFrac) lo = mid
          else hi = mid
        }
        if (timeFrac <= tf[0]) {
          rawDistFrac = df[0]
        } else if (timeFrac >= tf[tf.length - 1]) {
          rawDistFrac = df[df.length - 1]
        } else {
          const segLen = tf[hi] - tf[lo]
          const alpha = segLen > 0 ? (timeFrac - tf[lo]) / segLen : 0
          rawDistFrac = df[lo] + alpha * (df[hi] - df[lo])
        }
      }

      // Apply reveal mode — NO easing, all linear at the end.
      //
      // The blend is `blendReveal` from lib/pen-reveal.ts, not a fourth hand
      // copy of the same three lines. Rod's `rawDistFrac` comes from its own
      // per-stroke time/distance tables rather than from
      // `penTimeDistanceFraction`, so the SOURCE of the raw number differs by
      // mode — but the arithmetic that turns raw + constant into what renders
      // must not, or the same toggle means two things.
      /* THE SCHEDULE WINS WHERE THERE IS ONE, and rides the same law where
       * there is not. `schedF` is already the arc fraction inside this stroke;
       * `blendReveal` is the Natural / Authentic arithmetic, in its one place.
       *
       * ⚠ NAMED, NOT GLOSSED: under a NON-IDENTITY schedule the pen's recorded
       * speed rides the BEAT rather than the stroke — a reordered stroke draws
       * at the pace the beat is at, not at its own recorded pace. Blender's
       * Build modifier restricts *"Natural Drawing Speed"* to Sequential for the
       * same reason (`docs/research/stroke-animation-toolsets.md` §1). Carrying
       * a stroke's own duration into a new slot needs the pen record re-timed
       * per stroke, which is step 3+ and is not pretended here. */
      const distFrac =
        schedF !== null ? schedF : blendReveal(rawDistFrac, timeFrac, revealMode, hybridBlend)

      // --- Convert distFrac -> curve tParam using arc-length mapping ---
      let tParam: number
      if (curve) {
        const distance = distFrac * curve.getLength()
        tParam = curve.getUtoTmapping(0, distance)
      } else {
        tParam = distFrac
      }

      // --- DrawRange: snap to full tube rings ---
      // Only TubeGeometry exposes `parameters.tubularSegments`. The Inflate
      // engine emits a plain BufferGeometry, so guard the access and fall
      // back to a full-reveal draw range.
      const geoParams = (geo as any).parameters as
        | { tubularSegments?: number }
        | undefined
      const tubularSegments = geoParams?.tubularSegments ?? 64
      const indicesPerRing = RADIAL_SEGMENTS * 6
      // Which ring has the pen reached?
      //
      // Rod's rings are curvature-adaptive — they are NOT evenly spaced along
      // the stroke — so `ringArcFracs` (arc-length fraction per ring, written by
      // the engine that built this tube) is the only correct lookup. Binary
      // search it for the reveal distance.
      //
      // The old `floor(tParam * tubularSegments)` was already subtly wrong even
      // for uniform rings: TubeGeometry places ring j at `getPointAt(j/N)`,
      // which is an ARC-LENGTH fraction, while tParam is the raw curve
      // parameter. Centripetal Catmull-Rom makes those two disagree by several
      // percent through curvature, so the reveal ran slightly ahead of or
      // behind the pen. The ring table removes the mismatch entirely.
      const ringFracs = strokeMeshData.ringArcFracs
      let ringIndex: number
      if (ringFracs && ringFracs.length === tubularSegments + 1) {
        let lo = 0
        let hi = ringFracs.length - 1
        while (lo < hi - 1) {
          const mid = (lo + hi) >> 1
          if (ringFracs[mid] <= distFrac) lo = mid
          else hi = mid
        }
        ringIndex = distFrac >= ringFracs[hi] ? hi : lo
      } else {
        ringIndex = Math.floor(tParam * tubularSegments)
      }
      const visibleRings = Math.min(ringIndex + 1, tubularSegments + 1)
      const drawRangeCount = Math.min(visibleRings * indicesPerRing, totalIndices)
      /* ═══ ROD'S NEAR END — a SUFFIX of rings, which a prefix could not say ══
       *
       * `setDrawRange` has always taken an OFFSET as well as a count; the
       * reveal simply never had a reason to move it off zero. Rod's rings are
       * contiguous in the index buffer, so the window's trailing edge is one
       * more binary search into the same `ringArcFracs` table the leading edge
       * already uses — the engine's own arc-length-per-ring, because the rings
       * are curvature-adaptive and *"`floor(tParam * tubularSegments)` was
       * already subtly wrong even for uniform rings."*
       *
       * `schedF0` is 0 at every `grow` playhead, so `ringStart` is 0, so this
       * is `setDrawRange(0, drawRangeCount)` — the call that always ran. */
      let ringStart = 0
      if (schedF0 !== null && schedF0 > 0 && ringFracs && ringFracs.length === tubularSegments + 1) {
        let a = 0
        let b = ringFracs.length - 1
        while (a < b - 1) {
          const mid = (a + b) >> 1
          if (ringFracs[mid] <= schedF0) a = mid
          else b = mid
        }
        ringStart = schedF0 >= ringFracs[b] ? b : a
      }
      const drawRangeStart = Math.min(ringStart * indicesPerRing, drawRangeCount)
      if (geoParams?.tubularSegments != null) {
        geo.setDrawRange(drawRangeStart, drawRangeCount - drawRangeStart)
      } else {
        // Non-tube geometry (e.g. Inflate's elliptical loft): reveal whole mesh.
        geo.setDrawRange(0, totalIndices)
      }

      const hasVisibleSegment = visibleRings - ringStart >= MIN_REVEAL_RINGS + 1
      /* Where the window's trailing edge sits along this stroke, as an arc
       * fraction. 0 under `grow`, so grow is unchanged. Under travel, vanish and
       * shrink, joints and the end cap behind this edge belong to tube that has
       * left the window; drawing them left dots of ink on the paper (lane T,
       * 2026-09-25: 2,073 to 3,418 detached px across Rod windows). */
      const trailFrac = ringStart > 0 && ringFracs ? ringFracs[ringStart] : 0

      /* The START cap belongs to the stroke's own beginning, so it is only on
       * screen while the window still reaches it. Under `travel` the segment
       * leaves the start behind and a cap left standing there would be a disc
       * of ink floating where the mark no longer is. */
      if (startCap) startCap.visible = hasVisibleSegment && ringStart === 0

      // End cap: hidden during reveal, snaps to final position near completion
      if (endCap) {
        if (hasVisibleSegment && distFrac >= 0.98 && strokeMeshData.capPositions) {
          endCap.visible = true
          endCap.position.copy(strokeMeshData.capPositions[1])
        } else {
          endCap.visible = false
        }
      }

      // --- Joints ---
      if (jointGroup) {
        if (!hasVisibleSegment) {
          jointGroup.visible = false
        } else {
          jointGroup.visible = true
          // `jointFractions` is optional on StrokeMeshData and the `?.[ji]` on
          // the next line already said so; `fracs.length` on the same line did
          // not, which is a real throw waiting for any Rod mesh built without
          // joints, not just a type complaint.
          const fracs = strokeMeshData.jointFractions ?? []
          for (let ji = 0; ji < jointGroup.children.length; ji++) {
            jointGroup.children[ji].visible =
              ji < fracs.length && (fracs[ji] ?? 0) <= distFrac && (fracs[ji] ?? 0) >= trailFrac
          }
        }
      }
    }
    /* ANIM-1A3 · WHAT THIS FRAME ACTUALLY DREW, per mesh, read back off the
     * geometry after every write above. `__fsTake.get()` reports this and not
     * the schedule's own slots, so a gate built on it measures the render. */
    const live = TAKE_LIVE
    live.playhead = playheadRef.current
    live.timed = timedRef.current !== null
    live.meshes.length = meshes.length
    for (let si = 0; si < meshes.length; si++) {
      const m = tubeMeshRefs.current[si]
      const geo = m?.geometry
      live.meshes[si] = {
        mode: meshes[si]?.mode ?? "?",
        visible: !!m?.visible,
        start: geo ? geo.drawRange.start : 0,
        count: geo ? Math.min(geo.drawRange.count, geo.index ? geo.index.count : 0) : 0,
        total: geo?.index ? geo.index.count : 0,
      }
    }
  })

  return (
    <>
      {/* DEPTH GROUP — the form's thickness, as a transform.
          Wraps the export group rather than living inside it, so flattening is
          a property of what is on SCREEN and never of what is exported: a GLB
          pulled mid-beat is still the real solid object. The frame loop writes
          `scale.z` and a compensating `position.z`; see the flat-state block. */}
      <group ref={flattenGroupRef}>
      {/* Export group: tubes/extrude meshes + caps + joints */}
      <group ref={exportGroupRef}>
        {meshes.map((data, si) => {
          return (
          <group key={data.key}>
            {/* Main geometry (tube, extrude, or solid) */}
            <mesh
              ref={(el) => { tubeMeshRefs.current[si] = el }}
              geometry={data.tubeGeometry}
              material={liveMaterial}
            />
            {/* Rod-mode only: caps + joints (fallback may use custom radius from Width slider) */}
            {data.mode === "rod" && data.capPositions && (() => {
              // From the per-radius cache, NEVER `new` in the render body — see
              // `rodSphereGeos` for the leak this replaces and its measurement.
              const r = data.capRadius ?? TUBE_RADIUS
              // The per-letter clone first when a cascade can run — see
              // `letterSphereGeos`. Falls through to the shared per-radius cache
              // and then to the module singleton, so every non-O5 path is
              // byte-identical to what it was.
              const capGeo =
                letterGeoFor(letterSphereGeos, letterMap, si, r)?.cap ??
                rodSphereGeos.get(r)?.cap ??
                sphereGeometry
              return (
                <>
                  <mesh
                    ref={(el) => { startCapRefs.current[si] = el }}
                    geometry={capGeo}
                    material={liveMaterial}
                    position={data.capPositions[0]}
                    userData={FS_PART_CAP}
                  />
                  <mesh
                    ref={(el) => { endCapRefs.current[si] = el }}
                    geometry={capGeo}
                    material={liveMaterial}
                    position={data.capPositions[1]}
                    userData={FS_PART_CAP}
                  />
                </>
              )
            })()}
            {data.mode === "rod" && data.jointPositions && (() => {
              const r = data.capRadius ?? TUBE_RADIUS
              const jointGeo =
                letterGeoFor(letterSphereGeos, letterMap, si, r)?.joint ??
                rodSphereGeos.get(r)?.joint ??
                jointSphereGeometry
              return (
                <group ref={(el) => { jointGroupRefs.current[si] = el }}>
                  {data.jointPositions.map((pos, ji) => (
                    <mesh
                      key={`${data.key}-joint-${ji}`}
                      geometry={jointGeo}
                      material={liveMaterial}
                      position={pos}
                      userData={FS_PART_JOINT}
                    />
                  ))}
                </group>
              )
            })()}
          </group>
          )
        })}
      </group>
      </group>
    </>
  )
}

/**
 * MEMOISED, AND THE `flattenSrc` REF IS WHAT MAKES IT POSSIBLE.
 *
 * This subtree emits one `<mesh>` per stroke plus its caps and joints — 22 on
 * the hero word, 253 on a Free Stroke Rod build — and it was being re-created
 * on every pose because `flatten` was a fresh object 120 times a second. The
 * measurement is in the block at `bumpOverride`.
 *
 * NO CUSTOM COMPARATOR. Every remaining prop is either a ref (`playheadRef`,
 * `exportGroupRef`), a primitive, or a value the parent already memoises
 * (`meshes` from `useStrokeMeshes`, `timelines` from `useTimeline`, `bounds`
 * from `useStableStrokesBounds`). A hand-written comparator here would be a
 * second, silently-drifting copy of that list — and the failure mode of getting
 * one wrong is a channel that renders once and then freezes, which is a defect
 * this file has already shipped twice.
 */
/** ANIM-1A3 · the last frame's per-mesh draw ranges, written at the end of
 *  AnimatedStrokesInner's frame loop and read by `__fsTake.get()`. One per
 *  page: the compare panels would overwrite each other, so read it with
 *  compare off. */
const TAKE_LIVE: {
  playhead: number
  timed: boolean
  meshes: { mode: string; visible: boolean; start: number; count: number; total: number }[]
} = { playhead: 0, timed: false, meshes: [] }

/* ANIM-3B · THE KEY READER. One per keyed take, built by Viewport3D from the
 * doc's keys and read by the frame loops in the Canvas. It has no clock of its
 * own: `clockMs` is the transport's playhead times the keyed length, the same
 * number the export seeks. `sample` caches on that number, so the depth, turn
 * and camera reads in one frame share one `sampleKeys` call. Built only for
 * keys that `validateKeys` passed; with no keys there is no reader, and every
 * reader below falls back to the shipped path. */
interface KeyReader {
  /** The keyed length: `max(takeMs ?? penMs, keysEndMs(keys))`. */
  readonly lengthMs: number
  /** The take's own length, `takeMs ?? penMs`. The reveal is a fraction of it. */
  readonly takeLen: number
  /** True when the reveal differs from the transport: a drawProgress track, or keys past the take's end. */
  readonly remapsReveal: boolean
  /** True when azimuth, elevation or distance has keys. Only then is the camera written. */
  readonly hasCamera: boolean
  /** The keys it reads. The width reads go through `widthForFrame` on these. */
  readonly keys: TakeKeys
  clockMs(): number
  sample(): KeySample
  revealMs(): number
}

/** Any track with a key, the style tracks included (K2): a doc keyed only on
 *  style values still needs the key reader, since its clock is the one the
 *  frame samples them on. */
function hasAnyKey(keys: TakeKeys | undefined): keys is TakeKeys {
  return !!keys && Object.values(keys).some((t) => (t?.length ?? 0) > 0)
}

function makeKeyReader(
  transport: React.MutableRefObject<number>,
  keys: TakeKeys,
  lengthMs: number,
  takeLen: number,
): KeyReader {
  let lastClock = Number.NaN
  let last: KeySample | null = null
  const clockMs = () => transport.current * lengthMs
  const sample = () => {
    const c = clockMs()
    if (last === null || c !== lastClock) {
      last = sampleKeys(keys, c)
      lastClock = c
    }
    return last
  }
  return {
    lengthMs,
    takeLen,
    remapsReveal: (keys.drawProgress?.length ?? 0) > 0 || lengthMs !== takeLen,
    hasCamera: (["azimuth", "elevation", "distance"] as const).some((p) => (keys[p]?.length ?? 0) > 0),
    keys,
    clockMs,
    sample,
    revealMs: () => revealClockMs(keys, clockMs(), takeLen),
  }
}

/** The reveal readers' ref. With no reader, or one that leaves the reveal on
 *  the transport, it IS the transport ref, the same object as before keys
 *  existed. Otherwise `.current` is the keyed reveal as a fraction of the
 *  take, and a write throws: the transport is the one thing that moves. */
function keyedRevealRef(
  transport: React.MutableRefObject<number>,
  reader: KeyReader | undefined,
): React.MutableRefObject<number> {
  if (!reader || !reader.remapsReveal) return transport
  return {
    get current() {
      if (!(reader.takeLen > 0)) return transport.current
      const f = reader.revealMs() / reader.takeLen
      return f < 0 ? 0 : f > 1 ? 1 : f
    },
    set current(_v: number) {
      throw new Error("ANIM-3B: the keyed reveal ref is read-only. Write the transport's playheadRef.")
    },
  }
}

/** The camera's pose in `orbitView`'s own units, read off the camera. The
 *  orthographic camera frames by zoom, so its distance is read from zoom, the
 *  inverse of `applyFraming`. `distance` is `fillK`: 1 is the framed view. */
function readOrbitPose(
  controls: OrbitControlsImpl,
  radius: number,
): { azimuth: number; elevation: number; distance: number } {
  const cam = controls.object
  const ox = cam.position.x - controls.target.x
  const oy = cam.position.y - controls.target.y
  const oz = cam.position.z - controls.target.z
  let dist = Math.hypot(ox, oy, oz)
  const ortho = cam as THREE.OrthographicCamera
  if (ortho.isOrthographicCamera && ortho.zoom > 0)
    dist = ortho.top / ortho.zoom / Math.tan((CAMERA_FOV_DEG * Math.PI) / 360)
  return {
    azimuth: (Math.atan2(ox, oz) * 180) / Math.PI,
    elevation: (Math.atan2(oy, Math.hypot(ox, oz)) * 180) / Math.PI,
    distance: dist / (radius * TOP_K),
  }
}

/** ANIM-3B · what the frame loop last APPLIED from keys, read by
 *  `__fsKeySample()`. One per page, like `TAKE_LIVE`: read it with compare off.
 *  `depth` is the flatten group's `scale.z` after the write, `yaw` the radians
 *  its matrix was built with, `cameraWrites` counts `orbitView` calls made by
 *  keys. With no keys `cameraWrites` stays 0. */
const KEY_LIVE: { depth: number; yaw: number; cameraWrites: number } = {
  depth: Number.NaN,
  yaw: Number.NaN,
  cameraWrites: 0,
}

/** Writes keyed azimuth, elevation and distance each frame through the SAME
 *  `orbitView` the view pills call. Mounted after OrbitControls, and only when
 *  a camera channel has keys, so an unkeyed take leaves the camera to the
 *  user. A channel with no keys keeps the pose the camera already has. */
function KeyCamera({
  reader,
  controlsRef,
  boundsRef,
  orbitView,
}: {
  reader: KeyReader
  controlsRef: React.RefObject<OrbitControlsImpl | null>
  boundsRef: React.MutableRefObject<StrokeBounds | null>
  orbitView: (azimuthDeg?: number, elevationDeg?: number, fillK?: number) => boolean
}) {
  useFrame(() => {
    const controls = controlsRef.current
    const b = boundsRef.current
    if (!controls || !b || !(b.radius > 0)) return
    const s = reader.sample()
    if (s.azimuth === undefined && s.elevation === undefined && s.distance === undefined) return
    const pose = readOrbitPose(controls, b.radius)
    if (orbitView(s.azimuth ?? pose.azimuth, s.elevation ?? pose.elevation, s.distance ?? pose.distance))
      KEY_LIVE.cameraWrites++
  })
  return null
}

/** ANIM-3B · writes what the view shows this frame into the key lanes'
 *  `liveRef`, so "+" keys the value on screen at the exact playhead, not the
 *  strip's throttled one. Mounted after KeyCamera so a keyed camera is read
 *  after its write. Writes one object in place, no allocation per frame. */
function KeyLive({
  liveRef,
  transportRef,
  revealRef,
  controlsRef,
  boundsRef,
}: {
  liveRef: { current: KeyLiveValues | null }
  transportRef: { readonly current: number }
  revealRef: { readonly current: number }
  controlsRef: React.RefObject<OrbitControlsImpl | null>
  boundsRef: React.MutableRefObject<StrokeBounds | null>
}) {
  useFrame(() => {
    const v =
      liveRef.current ??
      (liveRef.current = { playhead: 0, drawProgress: 0, depth: NaN, turn: NaN, azimuth: NaN, elevation: NaN, distance: NaN, width: 1, widthClamp: null, widthReached: 1 })
    const c = controlsRef.current
    const b = boundsRef.current
    const pose = c && b && b.radius > 0 ? readOrbitPose(c, b.radius) : null
    const p = transportRef.current
    const r = revealRef.current
    v.playhead = p < 0 ? 0 : p > 1 ? 1 : p
    v.drawProgress = r < 0 ? 0 : r > 1 ? 1 : r
    v.depth = KEY_LIVE.depth
    v.turn = (KEY_LIVE.yaw * 180) / Math.PI
    v.azimuth = pose ? pose.azimuth : NaN
    v.elevation = pose ? pose.elevation : NaN
    v.distance = pose ? pose.distance : NaN
  })
  return null
}

const AnimatedStrokes = memo(AnimatedStrokesInner)

/* ====================================================================== */
/*  HOW THE DRAW-IN PLAYS — the thinnest layer in the product, until now   */
/* ---------------------------------------------------------------------- */
/*  PRD §7 Phase 22 lists geometry-animation v1 as "speed, duration,       */
/*  delay, loop, reverse, easing, reveal styles". Three of those existed:  */
/*  speed (three buttons), duration (the strokes' own timeline) and reveal */
/*  style (Natural / Authentic / Smooth, which reshapes how ARC LENGTH     */
/*  maps to time from the recorded pen speed). Delay, loop, reverse and    */
/*  easing did not exist in any form, so a user's entire authority over    */
/*  the single most important motion in the app was play, pause, a         */
/*  scrubber and 0.5/1/2×.                                                 */
/*                                                                          */
/*  EASE IS NOT A SECOND REVEAL STYLE, and keeping the two apart is the     */
/*  whole reason this is worth building rather than bolting onto the        */
/*  existing toggle. Reveal style asks "within the draw, how fast is the    */
/*  pen at each point" — it is a property of the HAND. Ease asks "over the  */
/*  whole draw, how does the clock run" — it is a property of the SHOT. You */
/*  can want an authentic hand that eases to a stop; they compose, and one  */
/*  control could not express that.                                         */
/* ====================================================================== */

/** The envelope over the WHOLE reveal. Not the per-stroke pen speed. */
export type { RevealEase, RevealEnvelopeParams }

/** How many units the draw-in schedules on these strokes: one per stroke, or one
 * per letter group. One function, so the Timing popover and the Animation tab
 * in the style drawer print the same count. */
export function countDrawInUnits(
  strokes: ProcessedStroke[],
  unit: DrawInParams["unit"],
  solidParams?: SolidParams,
): number {
  if (strokes.length === 0) return 0
  if (unit === "stroke") return strokes.length
  const inkWidth = computeSolidEffectiveThicknessPx((solidParams ?? DEFAULT_SOLID_PARAMS).thickness)
  return assignLetters(strokes, inkWidth).count
}

/* The list lives with the controls that render it, `components/draw-in-timing-controls.tsx`. */
export { REVEAL_EASES }

/* `easeReveal` lives in `lib/stroke-timing.ts` since ANIM-1A2, one curve
 * family for the whole-take envelope and the per-stroke presets. Re-exported
 * so anything that imported it from here still does. */
export { easeReveal }

/* `unEaseReveal`, the inverse of `easeReveal`, lives in `lib/take-transport.ts`
 * since L2, so a panel outside this file can map a scrub back to the clock.
 * Re-exported so anything that imported it from here still does. */
export { unEaseReveal }

/* The transport's readouts (`LiveTakeTimeline`, the time label and the
 * scrubber) live in `components/workspace/timeline-panel.tsx` since L3, with
 * the rest of the dock's controls. */

/* ---- PlaybackController: advances playheadRef when playing ---- */
function PlaybackController({
  playheadRef,
  clockRef,
  playing,
  speed,
  ease,
  cadence,
  delaySeconds,
  loop,
  reverse,
  totalDuration,
  onProgressUpdate,
  onReachedEnd,
  openingRef,
}: {
  playheadRef: React.MutableRefObject<number>
  /** F118: set on a forward Play from the top, cleared when that pass wraps. */
  openingRef: React.MutableRefObject<boolean>
  /** Wall-clock position 0..1, BEFORE the ease. See below. */
  clockRef: React.MutableRefObject<number>
  playing: boolean
  speed: number
  ease: RevealEase
  /** `twos` holds each state for a 12 Hz step. See `quantiseToCadence`. */
  cadence: RevealCadence
  /** Seconds of stillness before the reveal starts. */
  delaySeconds: number
  loop: boolean
  /** Play the draw backwards — the mark un-draws. */
  reverse: boolean
  totalDuration: number
  onProgressUpdate: (progress: number) => void
  /** Called when a non-looping pass finishes, so the transport can pause. */
  onReachedEnd: () => void
}) {
  const lastTimeRef = useRef<number | null>(null)
  const delayLeftRef = useRef(0)
  const armedRef = useRef(false)

  /* THE CLOCK AND THE PLAYHEAD ARE TWO DIFFERENT NUMBERS, and they have to be.
   *
   * `clockRef` runs linearly in wall time; `playheadRef` is `ease(clock)` and is
   * what every reveal consumer reads. Advancing the playhead directly and then
   * easing it would apply the curve to an already-curved value once per frame —
   * a compounding that is not any easing at all, and which looks plausible in
   * motion, which is how it would have shipped. */
  useFrame(() => {
    if (!playing || totalDuration <= 0) {
      lastTimeRef.current = null
      armedRef.current = false
      return
    }

    const now = performance.now()
    if (lastTimeRef.current === null) {
      lastTimeRef.current = now
      /* ARM THE DELAY ON THE PLAY EDGE, not on mount. Measured from mount it
       * would already have elapsed by the time anyone pressed Play — the same
       * "measure from when?" mistake `evaluateStackAnimation`'s `sinceArmed`
       * exists to fix, and the third time it has come up in this repo. */
      if (!armedRef.current) {
        armedRef.current = true
        /* THE EPSILON IS BELT-AND-BRACES, and it is here because the exact test
         * has already failed once. `unEaseReveal` now returns the endpoints
         * exactly, which is the real fix; this makes the decision robust to any
         * other route that leaves the clock a rounding error short of an end —
         * a scrubber at 0.9999, a wrapped loop, a float accumulated over a
         * thousand frames. Arming a delay a hair early is free; failing to arm
         * it makes the control look dead. */
        const EDGE = 1e-6
        const atStart = reverse ? clockRef.current >= 1 - EDGE : clockRef.current <= EDGE
        delayLeftRef.current = atStart ? Math.max(0, delaySeconds) * 1000 : 0
        if (atStart) openingRef.current = !reverse
      }
      return
    }

    const rawDelta = now - lastTimeRef.current
    lastTimeRef.current = now

    /* THE DELAY IS STILLNESS, NOT A SLOW START. While it runs the playhead does
     * not move at all, so the mark sits at whichever end it starts from and the
     * viewer gets a beat of blank page before the pen lands. */
    if (delayLeftRef.current > 0) {
      delayLeftRef.current -= rawDelta
      if (delayLeftRef.current > 0) return
      /* Spend only the overshoot on the reveal, so a delay never costs the
       * draw a frame of its own duration. */
      const spill = -delayLeftRef.current
      delayLeftRef.current = 0
      if (spill <= 0) return
      advance(spill)
      return
    }
    advance(rawDelta)

    function advance(ms: number) {
      const deltaFraction = ((ms * speed) / totalDuration) * (reverse ? -1 : 1)
      let clock = clockRef.current + deltaFraction
      let ended = false
      if (!reverse && clock >= 1) {
        ended = true
        clock = loop ? clock - Math.floor(clock) : 1
      } else if (reverse && clock <= 0) {
        ended = true
        clock = loop ? clock - Math.floor(clock) : 0
      }
      if (ended && loop) openingRef.current = false
      clockRef.current = clock
      /* ⚠ THE STORED CLOCK STAYS CONTINUOUS. Quantising `clockRef.current`
       * itself would make the next frame add its delta to an already-snapped
       * value, and the beat would drift or stall at a step. Sampling is a thing
       * you do to the DISPLAY, which is exactly what "sample the animation
       * clock at 12 Hz" means. `totalDuration` is ms, the cadence is Hz, so it
       * converts to seconds and back. */
      const shown =
        cadence === "twos" && totalDuration > 0
          ? quantiseToCadence(clock * (totalDuration / 1000), CADENCE_HZ) / (totalDuration / 1000)
          : clock
      const p = easeReveal(shown > 1 ? 1 : shown < 0 ? 0 : shown, ease)
      playheadRef.current = p
      onProgressUpdate(p)
      if (ended) {
        if (loop) {
          /* A LOOP RE-ARMS THE DELAY. "Wait two seconds, then draw" that waits
           * only on the very first pass is a delay that stops meaning anything
           * the moment you switch looping on — and looping is exactly where a
           * beat between repeats is worth having. */
          delayLeftRef.current = Math.max(0, delaySeconds) * 1000
        } else {
          lastTimeRef.current = null
          onReachedEnd()
        }
      }
    }
  })

  return null
}

/* ---- SolidAnimationTick: forces React re-render while playheadRef advances ----
 *
 * Why this exists:
 *   The Solid and Extrude meshes both rebuild from a `useMemo` that depends on
 *   a React state value (`solidAnimProgress`). The actual playback source-of-
 *   truth is `playheadRef.current`, which is a ref and does NOT trigger React
 *   re-renders when mutated by `PlaybackController`. Without this tick, those
 *   meshes never rebuild during playback and appear static.
 *
 *   The component name retains the `Solid` prefix because Solid was the first
 *   consumer of this tick, but it now also drives the Extrude partial-stroke
 *   rebuild path. Rod animation continues to be driven directly off
 *   `playheadRef.current` inside `AnimatedStrokes` (drawRange), so this tick
 *   has no effect on Rod and pays zero cost in Rod mode.
 *
 * Behavior:
 *   - Runs on every frame inside the Canvas (must be a child of <Canvas>).
 *   - Throttles updates lightly so partial-rebuild modes don't spam raster
 *     / contour / extrude work every single frame:
 *       * minimum interval: ~22ms (~45 Hz) between state updates
 *       * minimum delta:    1e-5 (just enough to skip exact-equal frames)
 *   - Always forces an update at the boundaries (progress 0 and progress 1)
 *     so the final frame matches the static preview exactly and replay starts
 *     from empty.
 *   - Active for partial-rebuild modes only (Solid, Extrude). Rod and any
 *     other mode early-out and pay zero cost.
 */
/**
 * THE HOST'S PLAYHEAD, COPIED IN INSIDE THE RENDER LOOP.
 *
 * One assignment per frame, no React state, no effect. See
 * `Viewport3DProps.revealRef` for why this exists rather than a `setState`.
 *
 * It runs BEFORE `AnimatedStrokes` reads the playhead only because R3F runs
 * `useFrame` callbacks in mount order and this is mounted first; a one-frame
 * lag would be invisible anyway (the reveal is continuous), so the ordering is
 * a nicety and not a correctness requirement.
 */
function HostRevealTick({
  revealRef,
  playheadRef,
}: {
  revealRef?: React.MutableRefObject<number | null>
  playheadRef: React.MutableRefObject<number>
}) {
  useFrame(() => {
    const v = revealRef?.current
    if (v == null) return
    playheadRef.current = v < 0 ? 0 : v > 1 ? 1 : v
  })
  return null
}

/* NIGHT S2, 2026-09-25: A SYNC THAT WOULD REBUILD THE SAME MESH IS SKIPPED.
 *
 * Every sync re-renders `Scene` and runs the partial rebuild, and the rebuild is
 * the cost: profiled in dev while a take plays in Solid, 706 of 815 main-thread
 * ms a second sit under `useStrokeMeshes` (`buildMaskSolid`,
 * `detectInteriorHoles` alone 389), against about 50 for React itself
 * (`docs/verification/night-s2/`). So the per-frame state cannot simply move to
 * a ref here the way lane R moved `progress`: in these modes the state IS what
 * draws the reveal.
 *
 * What CAN go is a sync whose rebuild is identical to the last one. The partial
 * is a pure function of the reveal DISTANCE (`revealDistanceFraction` of the
 * playhead, then the window and schedule clips, which read only that distance),
 * and Natural holds that distance still for the whole length of every pen lift.
 * `revealFracRef` is Scene's own function of the playhead, the one the
 * `animatedStrokes` memo calls, so the two cannot disagree. Boundaries (0 and 1)
 * still always sync, so the last frame still matches the static preview. */
function SolidAnimationTick({
  enabled,
  playheadRef,
  setSolidAnimProgress,
  revealFracRef,
}: {
  enabled: boolean
  playheadRef: React.MutableRefObject<number>
  setSolidAnimProgress: React.Dispatch<React.SetStateAction<number>>
  revealFracRef?: React.MutableRefObject<((timeFrac: number) => number) | null>
}) {
  const lastSyncedRef = useRef<number>(playheadRef.current)
  const lastSyncTimeRef = useRef<number>(0)
  const lastFracRef = useRef<number | null>(null)

  useFrame(() => {
    if (!enabled) return
    const current = playheadRef.current
    const last = lastSyncedRef.current
    const now = performance.now()
    const delta = Math.abs(current - last)

    const atBoundary = (current >= 1 && last < 1) || (current <= 0 && last > 0)
    const timeOk = now - lastSyncTimeRef.current >= 22
    const deltaOk = delta > 1e-5

    if (atBoundary || (timeOk && deltaOk)) {
      const fracOf = revealFracRef?.current
      const frac = fracOf ? fracOf(current) : null
      if (!atBoundary && frac !== null && lastFracRef.current !== null && frac === lastFracRef.current) return
      lastFracRef.current = frac
      lastSyncedRef.current = current
      lastSyncTimeRef.current = now
      setSolidAnimProgress(current)
    }
  })

  return null
}

/* ---- The pen-timing map, the timing-character measurement, AND THE CLIP ----
 *
 * ALL THREE MOVED, VERBATIM, TO lib/pen-reveal.ts. They are imported at the top
 * of this file. Nothing about them changed; what changed is that they are no
 * longer this file's private property, because the 2D flat-ink register has to
 * ask the same question and get the same answer. The comments that recorded
 * WHY each one exists went with them — they are findings, not decoration.
 *
 * What used to sit here: `penTimeDistanceFraction` (time fraction -> the
 * distance the pen had covered, walking the points' own timestamps),
 * `measureTimingCharacter` (how far that departs from constant speed, which is
 * the only thing separating Natural from Authentic), and — as of 2026-08-04 —
 * `filterStrokesByProgress` itself, the arc-length clip the rebuild path cuts
 * with. That last one moved because the defect it carries is a MODEL defect
 * (a builder that reshapes the already-drawn prefix every time the clip grows),
 * and the gate for it, `scripts/verify/assert-drawin-monotone.mjs`, has no
 * business paying for a GPU to ask a question about buffers. */


/* ---- Scene ---- */
/**
 * DEV-ONLY fusion probe — the objective test for "did the crossing actually
 * FUSE, or are two shells just overlapping?"
 *
 * It lives inside <Canvas> so it can reach the REAL rendered scene graph via
 * useThree, not a parallel copy of the geometry. That distinction is the whole
 * point: a probe that re-ran the engine would prove the engine agrees with
 * itself, and prove nothing about what is on screen.
 *
 * `crossSection` fires a grid of rays straight down the world Z axis through
 * the model's bounding-box centre — which, for an X, is exactly the crossing —
 * and reports every surface each ray passes through. That is a literal
 * cross-section of the mid-crossing region:
 *
 *   • ONE fused solid   -> every ray hits 0 or 2 sheets (enter, exit).
 *   • TWO interpenetrating tubes -> rays over the overlap hit 4 sheets
 *     (tube A's top, tube B's top, tube B's bottom, tube A's bottom).
 *
 * Materials are flipped to DoubleSide for the duration of the cast and
 * restored afterwards: with the default FrontSide, three's raycaster silently
 * skips back faces and every ray would report half its true hits.
 */
function FusionProbe() {
  const { scene, gl } = useThree()
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    const w = window as unknown as Record<string, unknown>

    /**
     * EVERY STROKE BODY IN THE SCENE, VISIBLE OR NOT.
     *
     * 🔴 THIS IS `collect()` WITHOUT ITS `!o.visible` TEST, AND THE DIFFERENCE
     * IS A WHOLE ROW OF EXPLAINER 24'S TABLE. `collect()` skips invisible
     * objects, which is right for the ray casts below (an invisible sheet is
     * not a surface the picture has) and wrong for a CENSUS whose stated
     * subject is *"everything else that can make a submitted mesh invisible."*
     * A census of invisibility that filters out the invisible can only ever
     * report `visible: true`, which is precisely why row 3 of §10.2 reads
     * AMBIGUOUS — *"never been observed to read `false` … nothing here can fail
     * it."* It was not that nothing had hidden a mesh. It was that the reading
     * could not have said otherwise.
     *
     * `collect()` is deliberately LEFT ALONE. Seven members walk it and their
     * subjects are correct as they stand; widening it would move seven answers
     * to repair one, which is the same trade this file keeps getting wrong in
     * the other direction.
     */
    const collectAll = (): THREE.Mesh[] => {
      const out: THREE.Mesh[] = []
      scene.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return
        if (!o.geometry) return
        // Skip the floor grid and any helper geometry — we only want stroke bodies.
        const n = (o.name || "").toLowerCase()
        if (n.includes("grid") || n.includes("helper")) return
        const g = o.geometry as THREE.BufferGeometry
        if (!g.getAttribute("position")) return
        out.push(o)
      })
      return out
    }

    const collect = (): THREE.Mesh[] => collectAll().filter((o) => o.visible)

    w.__inflateProbe = {
      /** How many separate mesh objects make up the model right now. */
      meshCount: () => collect().length,
      /**
       * WHAT THE RASTERISER WAS HANDED, AND WHAT THE THREE FRAGMENT PASSES WERE
       * ASKED TO DO WITH IT.
       *
       * `render` is `WebGLRenderer.info.render` for the LAST rendered frame —
       * `triangles` is the count the driver actually rasterised. It is the
       * reading that separates the two remaining stories about the blank tail
       * on the font word: a mark whose draw call the driver DROPPED reads ~0
       * here, and a mark whose fragments were all discarded reads the full
       * submitted count. `revealState()` can see the drawRange the mesh was
       * given; only this can see whether the GPU took it.
       *
       * `diag` is `liveDrawDiag` — every uniform the three discards run on, in
       * the frame that produced those triangles. See the type for why OFAT
       * alone could not have attributed this.
       */
      drawDiag: () => ({
        render: {
          calls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
          frame: gl.info.render.frame,
        },
        programs: gl.info.programs?.length ?? null,
        diag: liveDrawDiag,
      }),
      /**
       * THE LETTER SEAM, READ OFF THE LIVE BUFFERS — a RAW CENSUS, never a
       * verdict. `buildLetterGeometry` publishes its own numbers on
       * `window.__letterSeam`; this walks the geometry that is actually in the
       * scene graph and counts again, so `assert-letter-seam.mjs` can grade the
       * object rather than the builder's opinion of it. A probe that re-ran the
       * builder would prove the builder agrees with itself.
       *
       * `spanning` is the count of triangles whose three vertices do not all
       * carry the same `aFsLetter`. Each one of those is a sheet stretched
       * between two letters the moment their yaws differ.
       */
      /**
       * WHAT THE REVEAL IS ACTUALLY DRAWING — the drawRange the GPU was last
       * handed, beside the fraction that produced it.
       *
       * WHY IT EXISTS. `_probe-drawin-vanish.mjs` found the mark going
       * COMPLETELY blank for the last 6 % of the draw on the FONT word (Free
       * Stroke, reproducible at dsf 1 and 2, mesh and triangle counts unchanged
       * through it). From the outside a mark that is not drawn and a mark that
       * is drawn white are the same picture, and this is the one reading that
       * separates them: `count 0` means the index range was cut to nothing, and
       * anything else means the geometry was submitted and the FRAGMENTS went.
       * Inferring that from pixels is exactly the mistake this repo has made
       * twelve times.
       */
      revealState: () => {
        const out: {
          frac: number | null
          /* THE INTERVAL THIS FRAME. `frac` alone stopped being the reveal's
           * boundary at step 3 — it is the LEADING edge and there is now a
           * trailing one, so a probe that read only `frac` would describe half
           * of what was submitted and could not tell a `travel` window from a
           * prefix at the same playhead. */
          window: RevealWindow | null
          /* 🔴 THE CENSUS NAMES ITS OWN SUBJECT. `ranges` used to walk
           * `collect()`, which skips invisible objects, so its `visible` field
           * was structurally unable to print `false`. It walks `collectAll()`
           * now, and these two counts say so on every run: on a shipped page
           * they are equal, and the day they are not, the reading that used to
           * be silent about it is the one printing the difference. */
          censusSource: string
          meshesVisible: number
          meshesAll: number
          ranges: Record<string, unknown>[]
        } = {
          frac: liveRevealFrac,
          window: liveRevealWindow,
          censusSource: "collectAll",
          meshesVisible: collect().length,
          meshesAll: collectAll().length,
          ranges: [],
        }
        for (const m of collectAll()) {
          const g = m.geometry as THREE.BufferGeometry
          const mat = m.material as THREE.MeshPhysicalMaterial
          g.computeBoundingSphere()
          const c = g.boundingSphere ? g.boundingSphere.center.clone() : new THREE.Vector3()
          m.updateWorldMatrix(true, false)
          c.applyMatrix4(m.matrixWorld)
          out.ranges.push({
            start: g.drawRange.start,
            count: g.drawRange.count,
            totalIndices: g.getIndex()?.count ?? 0,
            /* EVERYTHING ELSE THAT CAN MAKE A SUBMITTED MESH INVISIBLE. The OFAT
             * above turned BOTH fragment discards off and the mark stayed blank
             * at 343 890 of 359 568 indices submitted, so the cause is not the
             * carve and not the tip — and the remaining candidates are all
             * readable rather than arguable. */
            visible: m.visible,
            frustumCulled: m.frustumCulled,
            radius: g.boundingSphere?.radius ?? null,
            world: { x: +c.x.toFixed(4), y: +c.y.toFixed(4), z: +c.z.toFixed(4) },
            scale: { x: +m.getWorldScale(new THREE.Vector3()).x.toFixed(5), y: +m.getWorldScale(new THREE.Vector3()).y.toFixed(5), z: +m.getWorldScale(new THREE.Vector3()).z.toFixed(5) },
            opacity: mat?.opacity ?? null,
            transparent: mat?.transparent ?? null,
            colorWrite: mat?.colorWrite ?? null,
            matVisible: mat?.visible ?? null,
            /* IS ANY INDEX OUT OF RANGE, AND WHERE DOES THE BAD RANGE START?
             *
             * The last hypothesis standing after six OFAT arms each failed to
             * bring the mark back. An index >= the vertex count is undefined
             * behaviour: the driver drops the WHOLE draw call, so the mark does
             * not lose the offending triangle — it loses ALL of itself, the
             * instant `setDrawRange` first reaches into the bad region. That is
             * the one mechanism consistent with everything measured: reversible
             * by scrubbing back, indifferent to every material channel, and
             * indifferent to both fragment discards. */
            vertexCount: g.getAttribute("position")?.count ?? 0,
            ...(() => {
              const ix = g.getIndex()
              if (!ix) return { maxIndex: null, firstBadIndex: null }
              const vc = g.getAttribute("position")?.count ?? 0
              let max = -1
              let firstBad = -1
              for (let i = 0; i < ix.count; i++) {
                const v = ix.getX(i)
                if (v > max) max = v
                if (firstBad < 0 && v >= vc) firstBad = i
              }
              return { maxIndex: max, firstBadIndex: firstBad < 0 ? null : firstBad }
            })(),
          })
        }
        return out
      },
      /**
       * WHAT IS IN A SLICE OF THE SORTED INDEX BUFFER.
       *
       * WHY IT EXISTS. `_probe-lane3-margin.mjs` held the playhead still and
       * grew ONLY the `setDrawRange` front margin (which makes the tip's
       * fragment test strictly more permissive, so it cannot be the cause) and
       * the font word went from 24 002 ink px at 334 674 indices to **1** at
       * 335 277. The blank is therefore a property of the TRIANGLES that enter
       * the range, not of the reveal fraction, the material or any discard —
       * and the only way to say WHICH property is to read them.
       *
       * `revealState()`'s index audit already proved every index is in range,
       * so the remaining candidates are all geometric: a non-finite position, a
       * vertex thrown far outside the mark, or a degenerate triangle. All three
       * are one walk.
       *
       * Triangle indices are into the SORTED order — the same order
       * `setDrawRange` counts in — so `from`/`to` are directly comparable with
       * the counts a sweep prints.
       */
      triSpan: (fromTri = 0, toTri = -1) => {
        const out = []
        for (const m of collect()) {
          const g = m.geometry as THREE.BufferGeometry
          const pos = g.getAttribute("position")
          const ix = g.getIndex()
          if (!pos || !ix) continue
          const nTri = Math.floor(ix.count / 3)
          const a = Math.max(0, Math.min(nTri, fromTri))
          const b = toTri < 0 ? nTri : Math.max(a, Math.min(nTri, toTri))
          let nonFinite = 0
          let firstNonFiniteTri = -1
          let maxEdge = 0
          let maxEdgeTri = -1
          let maxRadius = 0
          let maxRadiusTri = -1
          let degenerate = 0
          const worst = []
          for (let t = a; t < b; t++) {
            const i0 = ix.getX(t * 3)
            const i1 = ix.getX(t * 3 + 1)
            const i2 = ix.getX(t * 3 + 2)
            const p = [
              [pos.getX(i0), pos.getY(i0), pos.getZ(i0)],
              [pos.getX(i1), pos.getY(i1), pos.getZ(i1)],
              [pos.getX(i2), pos.getY(i2), pos.getZ(i2)],
            ]
            let bad = false
            for (const q of p) for (const v of q) if (!Number.isFinite(v)) bad = true
            if (bad) {
              nonFinite++
              if (firstNonFiniteTri < 0) firstNonFiniteTri = t
              if (worst.length < 8) worst.push({ tri: t, kind: "non-finite", p })
              continue
            }
            const e = (u: number[], v: number[]) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2])
            const el = Math.max(e(p[0], p[1]), e(p[1], p[2]), e(p[2], p[0]))
            if (el > maxEdge) { maxEdge = el; maxEdgeTri = t }
            const r = Math.max(
              Math.hypot(p[0][0], p[0][1], p[0][2]),
              Math.hypot(p[1][0], p[1][1], p[1][2]),
              Math.hypot(p[2][0], p[2][1], p[2][2]),
            )
            if (r > maxRadius) { maxRadius = r; maxRadiusTri = t }
            const ux = p[1][0] - p[0][0], uy = p[1][1] - p[0][1], uz = p[1][2] - p[0][2]
            const vx = p[2][0] - p[0][0], vy = p[2][1] - p[0][1], vz = p[2][2] - p[0][2]
            const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx
            if (Math.hypot(cx, cy, cz) * 0.5 <= 0) degenerate++
          }
          out.push({
            triangles: b - a,
            from: a,
            to: b,
            nonFinite,
            firstNonFiniteTri,
            degenerate,
            maxEdge,
            maxEdgeTri,
            maxRadius,
            maxRadiusTri,
            worst,
          })
        }
        return out
      },
      /**
       * EVERY ATTRIBUTE'S LENGTH AGAINST THE INDEX BUFFER THAT ADDRESSES IT.
       *
       * WHY IT EXISTS. `revealState()` audits indices against the POSITION
       * attribute only, and reported `firstBadIndex null` on the font word's
       * blank tail. That check is necessary and it is not sufficient: WebGL
       * validates a draw against EVERY ENABLED ATTRIBUTE, and an index that is
       * legal for `position` and past the end of a shorter one is
       * `INVALID_OPERATION` — at which point the driver drops the WHOLE draw
       * call, not the offending triangle. That is the only mechanism consistent
       * with everything measured about the blank: it is reversible on the
       * playhead, indifferent to every material channel, indifferent to all
       * three fragment discards, and it fires at a THRESHOLD in the drawn index
       * count rather than progressively.
       *
       * `maxIndexUpTo` is the largest index in the first `count` entries — i.e.
       * exactly what a `setDrawRange(0, count)` submits — so a caller can ask
       * the question at the boundary the sweep found rather than over the whole
       * buffer.
       */
      attrCensus: (count = -1) => {
        const out = []
        for (const m of collect()) {
          const g = m.geometry as THREE.BufferGeometry
          const ix = g.getIndex()
          if (!ix) continue
          const n = count < 0 ? ix.count : Math.min(count, ix.count)
          let maxUpTo = -1
          for (let i = 0; i < n; i++) {
            const v = ix.getX(i)
            if (v > maxUpTo) maxUpTo = v
          }
          const attrs: Record<string, number> = {}
          for (const [name, a] of Object.entries(g.attributes)) {
            attrs[name] = (a as THREE.BufferAttribute).count
          }
          out.push({
            name: m.name || "(unnamed)",
            indexCount: ix.count,
            drawn: n,
            maxIndexUpTo: maxUpTo,
            attrs,
            /* THE ROW THAT MATTERS: which attributes the submitted range
             * over-runs. Empty is the healthy answer. */
            short: Object.entries(attrs)
              .filter(([, c]) => (c as number) <= maxUpTo)
              .map(([k, c]) => `${k} (${c} <= maxIndex ${maxUpTo})`),
          })
        }
        return out
      },
      letterCensus: () => {
        const out = { meshes: 0, withAttr: 0, triangles: 0, spanning: 0, letters: [] as number[] }
        const seen = new Set<number>()
        for (const m of collect()) {
          out.meshes++
          const g = m.geometry as THREE.BufferGeometry
          const a = g.getAttribute(FS_LETTER_ATTR)
          const ix = g.getIndex()
          if (!a || !ix) continue
          out.withAttr++
          const n = Math.floor(ix.count / 3)
          out.triangles += n
          for (let t = 0; t < n; t++) {
            const l0 = a.getX(ix.getX(t * 3))
            const l1 = a.getX(ix.getX(t * 3 + 1))
            const l2 = a.getX(ix.getX(t * 3 + 2))
            seen.add(l0)
            if (l0 !== l1 || l1 !== l2) out.spanning++
          }
        }
        out.letters = [...seen].sort((p, q) => p - q)
        return out
      },
      stats: () => {
        const meshes = collect()
        let vertices = 0
        let triangles = 0
        for (const m of meshes) {
          const g = m.geometry as THREE.BufferGeometry
          const p = g.getAttribute("position")
          if (p) vertices += p.count
          const i = g.getIndex()
          triangles += i ? i.count / 3 : (p ? p.count / 3 : 0)
        }
        return { meshCount: meshes.length, vertices, triangles }
      },
      /**
       * Cast an n x n grid of -Z rays through the model's bbox centre.
       * `halfSpanFrac` is a fraction of the smaller XY bbox extent.
       */
      crossSection: (halfSpanFrac = 0.18, n = 41) => {
        const meshes = collect()
        if (meshes.length === 0) return null
        const box = new THREE.Box3()
        for (const m of meshes) box.expandByObject(m)
        const center = new THREE.Vector3()
        box.getCenter(center)
        const size = new THREE.Vector3()
        box.getSize(size)
        const halfSpan = Math.min(size.x, size.y) * halfSpanFrac
        const zStart = box.max.z + Math.max(size.z, 0.1) * 4 + 1

        // Back faces are required — see the note above.
        const saved: { mat: THREE.Material; side: THREE.Side }[] = []
        for (const m of meshes) {
          const mats = Array.isArray(m.material) ? m.material : [m.material]
          for (const mat of mats) {
            saved.push({ mat, side: mat.side })
            mat.side = THREE.DoubleSide
          }
        }

        const ray = new THREE.Raycaster()
        ray.far = zStart * 4 + 100
        const dir = new THREE.Vector3(0, 0, -1)
        const origin = new THREE.Vector3()
        const rays: { x: number; y: number; z: number[] }[] = []
        try {
          for (let iy = 0; iy < n; iy++) {
            for (let ix = 0; ix < n; ix++) {
              const x =
                center.x + (n === 1 ? 0 : (ix / (n - 1)) * 2 - 1) * halfSpan
              const y =
                center.y + (n === 1 ? 0 : (iy / (n - 1)) * 2 - 1) * halfSpan
              origin.set(x, y, zStart)
              ray.set(origin, dir)
              const hits = ray.intersectObjects(meshes, false)
              rays.push({ x, y, z: hits.map((h) => h.point.z) })
            }
          }
        } finally {
          for (const s of saved) s.mat.side = s.side
        }

        const histogram: Record<number, number> = {}
        let maxHits = 0
        for (const r of rays) {
          histogram[r.z.length] = (histogram[r.z.length] ?? 0) + 1
          if (r.z.length > maxHits) maxHits = r.z.length
        }
        return {
          center: [center.x, center.y, center.z],
          bboxSize: [size.x, size.y, size.z],
          halfSpan,
          n,
          meshCount: meshes.length,
          maxHits,
          histogram,
          rays,
        }
      },
      /**
       * IN-PLANE RADIAL PROFILE — the measurement that can actually see a
       * fillet.
       *
       * `crossSection` (above) proves FUSION (no 4-sheet rays) but is blind to
       * the FILLET, and that is a geometric fact rather than a tuning problem.
       * For an X the two tubes' axes intersect, so their top surfaces meet
       * TANGENTIALLY at the apex: the union's top height field is
       * z(x,y) = sqrt(r^2 - min(x^2, y^2)), whose gradient jump across the
       * crease is sqrt(2)*a/sqrt(r^2-a^2) — exactly ZERO at the centre. A
       * top-down height field therefore has almost no crease to smooth, while
       * its 95th-percentile curvature is dominated by the tube's own silhouette
       * roll-off. Measuring the fillet up there measures noise.
       *
       * The fillet lives in the four ARMPITS: the re-entrant corners in the
       * z = 0 plane where the two tubes meet side-on. So cast rays INWARD in
       * that plane, from far outside toward the crossing centre, one per angle,
       * and record the radius of the first surface hit — rho(theta).
       *
       * For two straight equal-radius strokes crossing at 90 degrees this has a
       * CLOSED FORM, which is what makes it a real signature rather than a
       * "something moved" test. With phi measured from a stroke's own
       * direction, the two axis distances are rho*|sin phi| and rho*|cos phi|.
       * In the armpit direction (phi = 45deg) they are equal, so the cubic
       * smooth minimum contributes its full displacement k/6 and
       *
       *     rho_armpit(k) = sqrt(2) * (r + k/6)
       *
       * A hard union (k = 0) gives sqrt(2)*r with a genuine CORNER in
       * rho(theta) — left/right slopes of -/+ sqrt(2)*r. A blended union gives
       * a larger radius AND a smooth (zero-slope, finite-curvature) minimum.
       * Both the offset and the loss of the corner are measured.
       *
       * Returns radii in units of `unitRadius` when one is supplied, so the
       * caller can compare directly against sqrt(2)*(1 + blend/6).
       */
      radialProfile: (nAngles = 720, unitRadius = 0) => {
        const meshes = collect()
        if (meshes.length === 0) return null
        const box = new THREE.Box3()
        for (const m of meshes) box.expandByObject(m)
        const center = new THREE.Vector3()
        box.getCenter(center)
        const size = new THREE.Vector3()
        box.getSize(size)
        // Start well outside the model, aim at the centre, in the z = 0 plane.
        const start = Math.max(size.x, size.y) + 1

        const saved: { mat: THREE.Material; side: THREE.Side }[] = []
        for (const m of meshes) {
          const mats = Array.isArray(m.material) ? m.material : [m.material]
          for (const mat of mats) {
            saved.push({ mat, side: mat.side })
            mat.side = THREE.DoubleSide
          }
        }

        const ray = new THREE.Raycaster()
        ray.far = start * 4 + 100
        const origin = new THREE.Vector3()
        const dir = new THREE.Vector3()
        const angles: number[] = []
        const radii: number[] = []
        try {
          for (let i = 0; i < nAngles; i++) {
            const th = (i / nAngles) * Math.PI * 2
            const cx = Math.cos(th)
            const cy = Math.sin(th)
            origin.set(center.x + cx * start, center.y + cy * start, 0)
            dir.set(-cx, -cy, 0)
            ray.set(origin, dir)
            const hits = ray.intersectObjects(meshes, false)
            angles.push(th)
            // First hit = the OUTER surface in this direction. Distance is
            // measured from the crossing centre, in the z = 0 plane.
            radii.push(hits.length > 0 ? start - hits[0].distance : NaN)
          }
        } finally {
          for (const s of saved) s.mat.side = s.side
        }

        const unit = unitRadius > 0 ? unitRadius : 1
        return {
          center: [center.x, center.y, center.z],
          bboxSize: [size.x, size.y, size.z],
          n: nAngles,
          unitRadius: unit,
          angles,
          radii,
          radiiInUnits: radii.map((v) => v / unit),
        }
      },
      /** The engine's own report for the last Inflate build. */
      /**
       * 🔴 HIDE ONE MESH, SO THE CENSUS'S `visible` READING CAN BE OBSERVED
       * READING FALSE — the control explainer 24 §10.2 row 3 has never had.
       *
       * The row: *"mesh hidden / culled · reading · **AMBIGUOUS** — true, but
       * `visible` has never been observed to read `false` on any object in the
       * census. Nothing here can fail it."* Lane Q's LANE-STATE and Lane W's
       * HANDOVER 1 both name this method as the repair.
       *
       * ⚠ TWO CORRECTIONS TO THAT HANDOVER, both found by opening this file
       * rather than by trusting the design, and either one alone would have
       * produced a control that returns `true` and cannot fire:
       *
       *   ① It said *"it MUST index through `collect()` — the same helper the
       *      census walks."* The intent is right and the helper was wrong:
       *      `collect()` DROPS invisible objects, so hiding mesh 0 removes it
       *      from the very list the census reads and renumbers every mesh after
       *      it. Both the setter and the census walk `collectAll()` now, which
       *      is that intent actually satisfied — one list, stable membership.
       *   ② Nothing in the handover knew the frame loop rewrites
       *      `mesh.visible = true` unconditionally every frame. A bare
       *      `list[i].visible = false` is reverted before the next painted
       *      frame. The hide is a LATCH — see `forcedHiddenMeshes`.
       *
       * IDENTITY IS `uuid`, NOT THE INDEX. `index` selects; the latch remembers
       * the object. An index into a list whose membership the setter's own
       * action changes is explainer 43's instance 3 — an instrument resolving
       * its subject by position — reintroduced inside the fix for instance 6.
       *
       * A VALIDATING DRIVER: `false` on anything that is not an in-range
       * integer index, for `setPenTip`'s stated reason — *"a sweep cannot
       * silently measure the same arm four times."* ⚠ `assert-arm-took.mjs`
       * derives its driver table from `__captureHarness` ALONE — its channel A
       * matches on the literal `n.left.name.text === "__captureHarness"`, which
       * is the anchor to search for rather than a line number that will rot —
       * so this member is NOT in that gate's subject today. It is
       * the first validating driver on `__inflateProbe` and it is reported in
       * Lane AB's return rather than fixed here — that file is Lane W's.
       *
       * The three rows it exists for, and the third is the one that makes the
       * first evidence rather than a tautology:
       *   1. `setMeshVisible(0, false)` → `true`, and the census reports
       *      `visible:false` for EXACTLY mesh 0 and `true` for every other.
       *   2. …and the rendered ink FALLS. Without this the row proves only that
       *      the census can echo a field back.
       *   3. `setMeshVisible(0, true)` restores, and both the census and the ink
       *      return to the shipped values — the control disarms, so the gate is
       *      not left grading a mutilated scene.
       *   …plus the refusal arm: `setMeshVisible(9999, false)` returns `false`
       *   and changes nothing.
       */
      setMeshVisible: (index: number, on: boolean): boolean => {
        const list = collectAll()
        if (!Number.isInteger(index) || index < 0 || index >= list.length) return false
        const m = list[index]
        if (on) forcedHiddenMeshes.delete(m.uuid)
        else forcedHiddenMeshes.add(m.uuid)
        // Written immediately as well as latched, so a census taken before the
        // next frame reads the state the caller just asked for rather than the
        // previous one.
        m.visible = !!on
        return true
      },
      /** WHICH MESHES ARE CURRENTLY LATCHED HIDDEN, by index into the same
       *  `collectAll()` order `setMeshVisible` uses — so a sweep can assert it
       *  disarmed everything it armed instead of assuming it did. */
      forcedHidden: () =>
        collectAll()
          .map((m, i) => (forcedHiddenMeshes.has(m.uuid) ? i : -1))
          .filter((i) => i >= 0),
      debug: () => JSON.parse(JSON.stringify(INFLATE_DEBUG)),
    }
    return () => {
      /* THE LATCH GOES WITH THE PROBE. If the probe unmounts while a mesh is
       * forced hidden, the only thing that could un-hide it has just been
       * deleted — a hot reload mid-sweep would leave a permanently blank mark
       * and nothing able to explain it. See `forcedHiddenMeshes`. */
      forcedHiddenMeshes.clear()
      delete w.__inflateProbe
    }
  }, [scene])
  return null
}

function Scene({
  controlsRef,
  strokes,
  rawStrokes,
  canvasWidth,
  canvasHeight,
  geometryMode,
  extrudeParams,
  solidParams,
  inflateParams,
  revealMode,
  hybridBlend,
  boundsRef,
  exportGroupRef,
  playheadRef: transportRef,
  playing,
  speed,
  totalDuration,
  onProgressUpdate,
  orbitEnabled = true,
  autoRotateDegPerSecond = 0,
  clockRef,
  openingRef: openingRefProp,
  revealEase = "linear",
  revealCadence = "ones",
  revealDelaySeconds = 0,
  revealLoop = false,
  revealReverse = false,
  onReachedEnd,
  masterControlsRef,
  meshStatusRef,
  solidStatusRef,
  extrudeDebugRef,
  styleState,
  hideGrid = false,
  lighting = FREE_STROKE.lighting,
  engineFamily = DEFAULT_ENGINE_FAMILY,
  flatten: flattenProp = SOLID_STATE,
  revealRef,
  stillExport = false,
  letterMap,
  drawIn = DRAW_IN_DEFAULTS,
  revealWindow: revealWindowParam = REVEAL_WINDOW_DEFAULTS,
  take = null,
  takeKnockout = null,
  onTimed,
  keyReader,
  orbitView,
  keyLiveRef,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>
  /** ANIM-1A3 · per-stroke timing rows. Null or empty is the shipped path. */
  take?: StrokeTimingTake | null
  /** Dev only: the browser gate's must-fails. See `__fsTake.knockout`. */
  takeKnockout?: string | null
  /** Hands the built schedule up so the host's clock and export read `takeMs`. */
  onTimed?: (ts: TimedSchedule | null) => void
  /** `DRAW IN` — order · overlap · align · unit · reverse. lib/stroke-schedule.ts. */
  drawIn?: DrawInParams
  /** `WINDOW` — grow / travel / vanish / shrink. lib/stroke-schedule.ts §1b. */
  revealWindow?: RevealWindowParams
  strokes: ProcessedStroke[]
  rawStrokes: Stroke[]
  canvasWidth: number
  canvasHeight: number
  geometryMode: GeometryMode
  /** Which codebase's engine builds the geometry — see lib/engine-registry.ts. */
  engineFamily?: EngineFamily
  extrudeParams?: ExtrudeParams
  solidParams?: SolidParams
  inflateParams?: InflateParams
  revealMode: RevealMode
  hybridBlend: number
  boundsRef: React.MutableRefObject<StrokeBounds | null>
  exportGroupRef: React.RefObject<THREE.Group | null>
  playheadRef: React.MutableRefObject<number>
  /** The HOST's draw-in playhead — see `Viewport3DProps.revealRef`. */
  revealRef?: React.MutableRefObject<number | null>
  playing: boolean
  speed: number
  totalDuration: number
  onProgressUpdate: (progress: number) => void
  orbitEnabled?: boolean
  /** Turntable rate in degrees per second, already vetted against
   *  `prefers-reduced-motion` by the caller. 0 = a still framing. */
  autoRotateDegPerSecond?: number
  /** Linear wall-clock position behind the eased playhead. See
   *  `PlaybackController` for why the two are separate numbers. */
  clockRef?: React.MutableRefObject<number>
  /** F118: the opening pass flag, owned by `Viewport3D` so its harness and its
   *  clock writes read and set the same ref as the frame loop. */
  openingRef?: React.MutableRefObject<boolean>
  /** Envelope over the whole reveal — NOT the per-stroke pen speed. */
  revealEase?: RevealEase
  /** `twos` holds each state for a 12 Hz step. Default `ones` is every frame,
   *  which is what this route rendered before the dial existed. */
  revealCadence?: RevealCadence
  /** Seconds of stillness before the reveal starts, and between loops. */
  revealDelaySeconds?: number
  revealLoop?: boolean
  /** Play the draw backwards, so the mark un-draws. */
  revealReverse?: boolean
  onReachedEnd?: () => void
  masterControlsRef?: React.RefObject<OrbitControlsImpl | null>
  meshStatusRef?: React.MutableRefObject<StrokeBuildStatus[]>
  solidStatusRef?: React.MutableRefObject<SolidBuildStatus | null>
  // Diagnostic-only ref; populated in extrude mode for the depth-trace panel.
  extrudeDebugRef?: React.MutableRefObject<{
    /** Raw depth-multiplier slider value (NOT a world-space depth). */
    depthParam: number
    buildCount: number
    /** Max stroke geometry Z extent in the current frame (= effectiveDepth + bevel). */
    bboxZ: number
    activeEngine: GeometryMode
    /** Normalized Width slider t in [0, 1]. */
    widthSliderValue: number
    widthSliderPercent: number
    /** Effective half-width actually consumed by the engine (after mapping + clamping). */
    effectiveWidthUsed: number
    effectiveWidthPercent: number
    /** Calibrated world-space depth actually used = multiplier × effectiveWidth clamped. */
    effectiveDepthUsed: number
    /** effectiveDepthUsed / effectiveWidthUsed — the visual proportion. */
    depthToWidthRatio: number
    strategy: string
    buildStatus: string
  } | null>
  styleState?: StyleState
  /** DEV capture: hides the grid helper for clean transparent frames. */
  hideGrid?: boolean
  /** Which studio rig lights the scene, plus its two decorations. Defaults to
   *  Free Stroke's own, so an omitted prop changes nothing. */
  lighting?: RegisterLighting
  /** How far the form is driven back toward being a drawing. See `FlatState`. */
  flatten?: FlatState
  /** Own `STILL_EXPORT.grab` — see the prop of the same name on
   *  <AnimatedStrokes>. Only the single viewport does. */
  stillExport?: boolean
  /** O5's letter map — see `LetterMap` and `FlatState.letters`. */
  letterMap?: LetterMap
  /** ANIM-3B · the take's keys, read per frame. Omitted: no keys, nothing changes. */
  keyReader?: KeyReader
  /** The host's `orbitView`, so keyed camera writes run the view pills' own lines. */
  orbitView?: (azimuthDeg?: number, elevationDeg?: number, fillK?: number) => boolean
  /** ANIM-3B · the key lanes' live values, written each frame by `KeyLive`. */
  keyLiveRef?: { current: KeyLiveValues | null }
}) {
  /* ANIM-3B · THE TWO PLAYHEAD REFS. The transport ref is written by
   * PlaybackController and HostRevealTick and read by nothing else in here.
   * Every reveal reader below reads `playheadRef`, which is the transport ref
   * itself unless a drawProgress key or a keyed length remaps the reveal. */
  const playheadRef = useMemo(() => keyedRevealRef(transportRef, keyReader), [transportRef, keyReader])

  /* ANIM-3C-W · WIDTH ON THE ENGINES THAT REBUILD. Inflate, Extrude and Solid
   * rebuild for a width key, at most once per step of `widthForFrame`'s build
   * clock, and only when that width differs from the one last built. The frame
   * loop holds the width in state only when it changes, so a hold, the time
   * after the last key, and a take with no width keys cost no rebuild. With no
   * width keys `keyWidth` stays undefined and `previewParamsAtWidth` hands back
   * the same params objects, so the meshes memo sees the shipped signature.
   * Rod's width is applied per frame on the built tube, in AnimatedStrokes. */
  const [keyWidth, setKeyWidth] = useState<number | undefined>(undefined)
  const keyWidthRef = useRef<number | undefined>(undefined)
  const atWidth = useMemo(() => {
    const params = { canvasWidth, canvasHeight, extrudeParams, solidParams, inflateParams }
    try {
      return previewParamsAtWidth(geometryMode, params, keyWidth)
    } catch (e) {
      // Drawn at the shipped width, and the lane says so instead of the page going blank.
      return { params, reached: 1, clamp: `Width not applied: ${e instanceof Error ? e.message : String(e)}` }
    }
  }, [geometryMode, canvasWidth, canvasHeight, extrudeParams, solidParams, inflateParams, keyWidth])
  const widthClampRef = useRef<string | null>(null)
  widthClampRef.current = atWidth.clamp
  const widthReachedRef = useRef(1)
  widthReachedRef.current = atWidth.reached
  useFrame(() => {
    const k = keyReader?.keys.width?.length ? keyReader : undefined
    const w = k && geometryMode !== "rod" ? widthForFrame(geometryMode, k.keys, k.clockMs()) : undefined
    if (w !== keyWidthRef.current) {
      keyWidthRef.current = w
      setKeyWidth(w)
    }
    const live = keyLiveRef?.current
    if (live) {
      live.width = (k ? widthAt(k.keys, k.clockMs()) : undefined) ?? 1
      live.widthClamp = k ? widthClampRef.current : null
      // Rod widens per frame in AnimatedStrokes and never clamps, so it draws the keyed width itself.
      live.widthReached = !k ? 1 : geometryMode === "rod" ? live.width : widthReachedRef.current
    }
  })
  /* F95 then F118, THE TRAVEL LOOP SEAM. `effectiveWindow` decides `seamless`;
   * the document keeps `revealWindowParam`. */
  const revealWindow = useMemo<RevealWindowParams>(
    () => effectiveWindow(revealWindowParam, { loop: revealLoop, delaySeconds: revealDelaySeconds }),
    [revealWindowParam, revealLoop, revealDelaySeconds],
  )
  /* F118, THE OPENING PASS. True from a forward Play that starts at the top of
   * the clock until that pass wraps: the pen writes in from an empty page with no
   * tail. `PlaybackController` writes it; every `windowAt` below reads it. A ref,
   * not state, so the wrap costs no render.
   *
   * TRAVEL-5: it starts TRUE. A page that has never wrapped is on its opening
   * pass, so the rest frame at playhead 0 is the empty page Play will write in
   * from. Starting false showed the wrapped tail `[1-L, 1]` on every frame
   * before Play and for the 2 paints after it (film-after-solid frames 0 to 4,
   * 12.9% of the word's ink, then 3.7% at p 0.002). `Viewport3D` owns the ref
   * and passes it in; a split viewport with no clock keeps its own. */
  const ownOpeningRef = useRef(true)
  const openingRef = openingRefProp ?? ownOpeningRef
  /* THE DEV OVERRIDE HAS TO BE FOLDED IN HERE TOO, AND THIS IS THE SECOND HALF
   * OF A FIX THAT ONLY EVER LANDED ITS FIRST HALF.
   *
   * `setFlatOverride` notifies `flatOverrideSubs`, and `AnimatedStrokes`
   * subscribes — which is why the doc on `setFlatOverride` says a window global
   * alone "reached the first and silently missed the second". But the second
   * consumer is not inside `AnimatedStrokes`: `StudioContactShadow` is rendered
   * HERE, off THIS component's `flatten` prop, and re-rendering a child cannot
   * change a parent's prop. So the shadow channel still never saw the override.
   *
   * MEASURED, and it is the dead-instrument class this repo keeps shipping
   * (`scripts/verify/_probe-hero-pool-projection.mjs`): driving `shadow` 0 -> 1
   * through `__captureHarness.setFlatten` changed **0 of 943,040 pixels**, worst
   * channel delta 0, at el 35 AND el 55, under BOTH projections. The instrument
   * reported the shadow inert while measuring nothing — and identically on the
   * perspective arm, which is what rules the registration work out as the cause.
   *
   * Production is untouched by construction: `readFlatOverride()` returns null
   * outside development and whenever no probe has set anything, so `flatten` is
   * the prop, byte for byte, on every shipped render. */
  /* F122 · R3F's resize runs `gl.setSize`, which rounds the viewport. This
   * subscriber registers after R3F's own, so it runs right after it in the same
   * `set` and the first frame at the new size is already the settled frame. */
  const r3fStore = useStore()
  useEffect(() => {
    syncViewportToBuffer(r3fStore.getState().gl)
    return r3fStore.subscribe((s, prev) => {
      if (s.size !== prev.size || s.viewport.dpr !== prev.viewport.dpr) syncViewportToBuffer(s.gl)
    })
  }, [r3fStore])
  const [, bumpSceneOverride] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    flatOverrideSubs.add(bumpSceneOverride)
    return () => {
      flatOverrideSubs.delete(bumpSceneOverride)
    }
  }, [bumpSceneOverride])
  const sceneOverride = readFlatOverride()
  const flatten = sceneOverride ? { ...flattenProp, ...sceneOverride } : flattenProp
  /* ---- THE REF CHANNEL — one object, written per pose, never re-identified.
   *
   * `AnimatedStrokes` reads the flat state ONLY in its frame loop, so handing it
   * a value made React re-create the whole mesh subtree ~120 times a second for
   * a number nothing rendered. This ref is the channel; the measurement that
   * made it one is in that component's `bumpOverride` block.
   *
   * It carries the RAW prop, not the override-folded `flatten` above: the fold
   * happens per frame at the read site, so the two consumers cannot disagree and
   * a probe write cannot be pinned to a stale pose. `StudioContactShadow` below
   * keeps taking the folded VALUE, because its opacity is a rendered prop and
   * there is nothing per-frame to hang it on. */
  const flattenSrc = useRef<FlatState>(flattenProp)
  flattenSrc.current = flattenProp

  // ---- Solid draw-in animation state ----
  // playheadRef.current is the source of truth, but ref mutations don't
  // trigger React re-renders. SolidAnimationTick (rendered below, inside
  // Canvas) reads playheadRef.current on every frame and updates this state
  // (throttled). The state then drives the animatedStrokes useMemo, which
  // forces the Solid mesh to rebuild as playback progresses.
  const [solidAnimProgress, setSolidAnimProgress] = useState<number>(
    playheadRef.current,
  )

  /**
   * Does this mode reveal by `setDrawRange` instead of by rebuilding?
   *
   * True for Inflate's IMPLICIT fusion, whose surface carries a per-triangle
   * arc-length table (`StrokeMeshData.revealKeys`). When it is true the whole
   * partial-rebuild apparatus below — `animatedStrokes`, `SolidAnimationTick`,
   * the 45Hz `solidAnimProgress` state — is switched OFF, because the reveal is
   * read straight off `playheadRef` inside the frame loop.
   *
   * Inflate's LOFT keeps the rebuild path: it has no field, no marching cubes
   * and no reveal table, and its per-frame cost was never the problem.
   *
   * ⚠ THE "KNOWN DEGRADATION" THIS COMMENT USED TO CLAIM WAS ACCEPTABLE IS THE
   * BUG SEBS REPORTED, AND IT IS CLOSED. The paragraph it replaces read:
   *
   *     "this reads the fusion the caller ASKED for, not the one the engine
   *      delivered. […] Basing the flag on the built mesh instead would be
   *      circular (the flag decides what the build is fed), and the fallback is
   *      already a reported failure state, so the cost of the honest version is
   *      a broken reveal in a case that is broken anyway."
   *
   * The case was not broken anyway. Sebs: *"and also if switch engine to desk
   * doodles the word just auto appears."* `lib/dd-engine/adapter.ts` builds a
   * perfectly good Inflate mesh and never sets `revealKeys` — it is not the
   * implicit polygoniser and has no arc-length table to set. So on the Desk
   * Doodles engine this flag said "reveal by drawRange", the rebuild path was
   * switched off, `AnimatedStrokes` found no `revealKeys` and fell through to
   * `mesh.visible = true`. Measured before the fix, on the page's own pills, by
   * scrubbing the draw phase and counting ink
   * (`scripts/verify/assert-drawin-parity.mjs --label=before`):
   *
   *     look Desk Doodles · engine Desk Doodles   0.404 1.000 1.000 …
   *     look Free Stroke  · engine Desk Doodles   1.000 1.000 1.000 …
   *     look Desk Doodles · engine Free Stroke    0.027 0.110 0.213 0.359 …
   *
   * One engine writes the word on; the other has it there before the pen moves.
   *
   * THE CIRCULARITY IS REAL AND IS BROKEN BY EVIDENCE, NOT BY A FAMILY NAME.
   * Keying this on `engineFamily === "free-stroke"` would fix the reported bug
   * and leave the ORIGINAL degradation — a Free Stroke implicit build that
   * falls back to the loft still has no table — so instead the flag is a piece
   * of STATE that the built meshes correct. It starts optimistic, the meshes
   * get built, and if they carry no reveal table the flag flips and the next
   * build goes through the rebuild path. It converges in one render and cannot
   * oscillate: with a table present the rebuild path still produces a table
   * (the implicit builder writes one whatever prefix it is fed), and with no
   * table present neither path produces one.
   */
  const [meshesCarryRevealKeys, setMeshesCarryRevealKeys] = useState(true)
  const inflateRevealsByDrawRange =
    geometryMode === "inflate" &&
    /* "auto" sends this word to the implicit builder too, which writes
     * revealKeys; without this the builder got a window-clipped copy AND the
     * frame loop cut the window again from clip-length keys, so Inflate on `/`
     * drew "h" where Rod drew "hel" (lane T2, 2026-09-25). When auto picks the
     * loft instead, meshesCarryRevealKeys turns this back off. */
    ((inflateParams ?? DEFAULT_INFLATE_PARAMS).fusion === "implicit" ||
      (inflateParams ?? DEFAULT_INFLATE_PARAMS).fusion === "auto") &&
    meshesCarryRevealKeys

  // -----------------------------------------------------------------
  // Start/reset flash fix.
  //
  // Bug:
  //   When the user clicks Play after a stroke is fully drawn, `handlePlayPause`
  //   in the wrapper synchronously sets `playheadRef.current = 0` and flips
  //   `playing -> true`. But `solidAnimProgress` is React state owned by
  //   `Scene`; the SolidAnimationTick only syncs it on the NEXT animation
  //   frame. Between the click commit and the next frame, React re-renders
  //   with the new `playing` value but the OLD `solidAnimProgress = 1`,
  //   producing one paint of the full mesh before the reveal starts. That's
  //   the flash described in the screen recording.
  //
  // Fix:
  //   Detect the playing transition `false -> true` and, if `playheadRef.current`
  //   is well below the last animated state value, eagerly sync the state
  //   to the playhead BEFORE the next paint. This is a layout effect so it
  //   runs synchronously after commit and before the browser repaints.
  //
  //   The check is intentionally a delta threshold rather than `=== 0` so it
  //   also handles "scrub-to-start, then press Play" and the Compare-mode
  //   replay reset.
  // -----------------------------------------------------------------
  const prevPlayingRef = useRef(playing)
  useLayoutEffect(() => {
    const wasPlaying = prevPlayingRef.current
    prevPlayingRef.current = playing
    // Applies to all partial-rebuild modes (Solid, Extrude, Inflate). Rod
    // animation does not use this state value, so Rod is unaffected. This
    // ensures the first frame after Play paints the empty/partial mesh rather
    // than the previously-full one (no full-mesh flash on replay).
    if (
      geometryMode !== "solid" &&
      geometryMode !== "extrude" &&
      geometryMode !== "inflate"
    )
      return
    // Transition from paused to playing
    if (!wasPlaying && playing) {
      const head = playheadRef.current
      const drop = solidAnimProgress - head
      // If the playhead has been moved backwards (typical: full -> 0 on replay),
      // sync state synchronously so the first frame of playback paints the
      // empty/partial mesh, not the previously-full one.
      if (drop > 0.01) {
        setSolidAnimProgress(head)
      }
    }
  }, [playing, geometryMode, solidAnimProgress, playheadRef])

  // Filter strokes by current animation progress for partial-rebuild modes
  // (Solid and Extrude). Rod returns strokes unchanged because Rod animates
  // via per-segment drawRange inside `AnimatedStrokes` rather than rebuilding
  // its geometry on every progress tick.
  //
  // The same `filterStrokesByProgress` helper is used for both modes — it is
  // mode-agnostic (operates purely on `ProcessedStroke.points` arc length).
  // For Extrude this means each ExtrudeGeometry is rebuilt from a shorter,
  // arc-length-clipped copy of its source stroke every ~22ms, revealing the
  // ribbon progressively along its path. No visibility gating is involved.
  //
  // ALSO writes animation diagnostics (rebuild count, point count, arc lengths,
  // final-frame match) to SOLID_ANIM_DEBUG so the debug overlay can poll them.
  const solidAnimRebuildCountRef = useRef(0)
  // Centre for Extrude's DRAFTED side walls, from the COMPLETE mark.
  //
  // It has to come from here rather than from inside useStrokeMeshes, because
  // that hook is handed `animatedStrokes` — the arc-length-filtered partial —
  // during draw-in, and the taper shrinks the back face toward the pool centre.
  // A centre derived from a partial pool travels as the reveal grows, so every
  // letter already on screen would re-slant on every tick. Computed on the full
  // strokes, so it is fixed for the whole reveal.
  const extrudeDraftCentre = useMemo(
    () =>
      geometryMode === "extrude" && extrudeParams?.sideWall === "drafted"
        ? computeExtrudePoolCentreXY(strokes, canvasWidth, canvasHeight)
        : null,
    [geometryMode, extrudeParams?.sideWall, strokes, canvasWidth, canvasHeight],
  )

  /* ═══ THE SCHEDULE ════════════════════════════════════════════════════════
   *
   * ONE object, derived once, read by every render path — the modifier owns the
   * rule and `playheadRef` stays the single scalar that owns when.
   *
   * The unit map is the ink's own grouping (`assignLetters`), computed from the
   * SAME nib diameter the Inflate builder and the tip field are sized from, so
   * three consumers of one number cannot drift. It is skipped entirely at the
   * default, because `order: asDrawn` + `overlap: 0` takes every stroke's own
   * recorded span and a grouping cannot change what the recording was. */
  const drawInUnits = useMemo(() => {
    /* `reverse` JOINS THE TEST, and it has to: `alternate` alternates UNITS, so
     * a grouping skipped for being at the default would make the pill say
     * "Groups" while the snake ran per stroke. A dial whose label does not
     * describe what renders is a defect. */
    const isDefault =
      drawIn.order === "asDrawn" &&
      drawIn.overlap === 0 &&
      drawIn.reverse === "off" &&
      drawIn.unit !== "stroke"
    if (isDefault || drawIn.unit === "stroke" || strokes.length === 0) return null
    const inkWidth = computeSolidEffectiveThicknessPx(
      (solidParams ?? DEFAULT_SOLID_PARAMS).thickness,
    )
    return assignLetters(strokes, inkWidth).of
  }, [strokes, solidParams, drawIn.order, drawIn.overlap, drawIn.unit, drawIn.reverse])

  const schedule = useMemo(
    () => scheduleFromStrokes(strokes, drawInUnits, drawIn),
    [strokes, drawInUnits, drawIn],
  )
  /* ANIM-1C · MOVED UP, UNCHANGED, from below the Extrude debug readout: the
   * rebuild memo `animatedStrokes` reads `timed`, and a const read before its
   * line in the same render is a TDZ error, while a ref would hand it the last
   * render's take. */
  const { timelines, totalDuration: computedDuration } = useTimeline(rawStrokes)
  /* ANIM-1A3 · THE TIMED SCHEDULE, built once here from the schedule above.
   *
   * The pace is the chain the shipped path runs per frame from the PLAYHEAD to
   * the beat (`revealDistanceFraction`, lifts and all), sampled into a table.
   * The whole-take ease is NOT inside it: the playhead is already eased, and
   * under a timed take the frame loop compares the playhead straight to the
   * keys, so the envelope eases the whole take on top of the rows. With every
   * row neutral, `key <= playhead` is then `beat <= rdf(playhead)`, the shipped
   * test.
   *
   * Knockouts drop one field of every row before the build, so each browser
   * check has a must-fail that goes through this code and not beside it. */
  const timed = useMemo(() => {
    if (!isTimedTake(take)) return null
    const ko = takeKnockout
    const rows: StrokeTimingTake["strokes"] = {}
    for (const k of Object.keys(take!.strokes)) {
      const r = take!.strokes[Number(k)]
      rows[Number(k)] = {
        delayMs: ko === "delay" ? 0 : r.delayMs,
        speed: ko === "speed" ? 1 : r.speed,
        ease: ko === "ease" ? { kind: "preset", id: "linear" } : r.ease,
        holdBack: ko === "holdBack" ? false : r.holdBack,
        /* ANIM-2C · the performed pace rides through. This copy named four
         * fields and dropped the fifth, so every engine on the stage played a
         * performed row linear while the strip, which builds from the take
         * itself, drew the pace (measured: `performed` null on all 12 strokes
         * inside a kept dwell). */
        ...(r.performed !== undefined ? { performed: r.performed } : {}),
      }
    }
    const lifts = liftsLandBetweenStrokes(schedule, revealWindow.mode)
    return buildTimedSchedule(
      schedule,
      { strokes: rows, ripple: take!.ripple },
      {
        baseMs: computedDuration,
        pace: paceFromCurve((c) =>
          revealDistanceFraction(strokes, c, revealMode, hybridBlend, lifts),
        ),
      },
    )
  }, [take, takeKnockout, schedule, revealWindow.mode, computedDuration, strokes, revealMode, hybridBlend])

  useEffect(() => {
    if (typeof window === "undefined") return
    /* THE READOUT A GATE READS — the same contract `__heroPenTip` follows. A
     * schedule nobody can inspect is the dead-parameter class this beat has
     * already produced three times: `identity` and `scale` are exactly the two
     * numbers every claim below turns on, so they are published rather than
     * inferred from pixels. */
    ;(window as unknown as { __fsSchedule?: unknown }).__fsSchedule = {
      params: schedule.params,
      identity: schedule.identity,
      uniformSlope: schedule.uniformSlope,
      reversedCount: schedule.reversedCount,
      scale: schedule.scale,
      unitCount: schedule.unitCount,
      strokeCount: schedule.tracks.length,
      tracks: schedule.tracks,
      sig: schedule.sig,
    }
  }, [schedule])

  useEffect(() => {
    if (typeof window === "undefined") return
    /* THE WINDOW'S OWN READOUT. Published separately from the schedule because
     * they are two objects with two lifetimes — the schedule is rebuilt on a
     * dial, the window is a function evaluated per frame — and folding them
     * would let a gate read a stale interval off a fresh schedule. `at`
     * samples the pure function so an assertion can check the SHAPE without
     * filming, the same contract `__revealHarness.ease` already follows. */
    ;(window as unknown as { __fsWindow?: unknown }).__fsWindow = {
      params: revealWindow,
      sig: windowSig(revealWindow),
      identity: revealWindow.mode === "grow",
      /* The opening flag is the live one unless the caller names a pass. */
      at: (d: number, opening?: boolean) => windowAt(revealWindow, d, opening ?? openingRef.current),
      live: () => liveRevealWindow,
    }
  }, [revealWindow])

  /* The playhead -> reveal distance map the memo below builds from, handed to
   * `SolidAnimationTick` so it can skip a sync that would rebuild the same
   * partial. Rewritten every render, so it always carries this render's
   * strokes, mode, blend and schedule. */
  /* ANIM-1C · EXTRUDE AND SOLID UNDER A TIMED TAKE cut each stroke at its own
   * reach on the take's clock (`takeSpansIn`), not at the shared beat. An
   * identity take (every row neutral) is not one: it keeps the shipped clip
   * below, so no rows and neutral rows are the same call. Inflate's loft is not
   * wired here and keeps the beat.
   * SOLID IS WIRED (ANIM-1C3). ANIM-1C saw a held stroke take the later strokes
   * off the Solid frame; ANIM-1C2 found the cause was position, not order:
   * Solid rasterized only the canvas rect and the gate's ink ran past it.
   * `renderStrokeToMask` now rasterizes union(canvas, ink bounds), and
   * `solid-bench/gaps.mjs` holds the must-fail for it. */
  const timedClip =
    timed && !timed.identity && (geometryMode === "extrude" || geometryMode === "solid") ? timed : null
  const solidRevealFracRef = useRef<((timeFrac: number) => number) | null>(null)
  /* Under `timedClip` the tick's skip is OFF (null): the partial is no longer a
   * function of the beat, and a held-back or delayed stroke moves while the
   * beat sits still in a pen lift, so a skip keyed on the beat would freeze it. */
  solidRevealFracRef.current = timedClip
    ? null
    : (timeFrac: number) =>
        revealDistanceFraction(
          strokes,
          timeFrac,
          revealMode,
          hybridBlend,
          liftsLandBetweenStrokes(schedule, revealWindow.mode),
        )

  const animatedStrokes = useMemo(() => {
    // Solid, Extrude and Inflate's LOFT animate by rebuilding their geometry
    // from an arc-length-filtered partial copy of the strokes. Rod — and now
    // Inflate's IMPLICIT fusion — animate via drawRange inside AnimatedStrokes,
    // so they keep the full strokes here and rebuild nothing.
    if (
      inflateRevealsByDrawRange ||
      (geometryMode !== "solid" &&
        geometryMode !== "extrude" &&
        geometryMode !== "inflate")
    )
      return strokes
    // Honour the pen's recorded timing, through the SHARED law: map the
    // playhead TIME fraction to the DISTANCE the pen had covered, respecting
    // the same Natural (hybrid) / Authentic (raw) / Smooth semantics as Rod
    // and as the 2D flat-ink register. Smooth remains constant-speed arc.
    const revealFrac = revealDistanceFraction(
      strokes,
      solidAnimProgress,
      revealMode,
      hybridBlend,
      liftsLandBetweenStrokes(schedule, revealWindow.mode),
    )
    /* §0.7 — `filterStrokesByProgress` IS STILL THE SHIPPED PATH. It is not
     * replaced, it is branched past: at the identity schedule this is the exact
     * call it always was, which is what makes the negative control byte
     * identical on Solid and Extrude too. `filterStrokesBySchedule` is a second
     * function beside it (`lib/stroke-schedule.ts` §6), so
     * `assert-drawin-monotone.mjs` — which imports the original BY NAME and uses
     * it as its own known-bad arm — keeps measuring the thing it names. */
    /* ⚠ THE WINDOW JOINS THE SAME BRANCH, and the condition is `identity AND
     * grow` rather than `identity` — a window over an identity schedule still
     * has to reach the interval clip, and reading only the schedule here is how
     * a `travel` on Solid would have silently rendered as a prefix. The shipped
     * default is both, so `filterStrokesByProgress` is still the call that
     * runs. */
    /* ANIM-1C · under a timed take the playhead IS the clock as a fraction of
     * the take, so the window is taken of it, as the frame loop does for Rod
     * and Inflate, and each stroke is cut by its own slot. */
    const win = timedClip
      ? windowAt(revealWindow, solidAnimProgress, openingRef.current)
      : windowAt(revealWindow, revealFrac, openingRef.current)
    /* ANIM-1C4 · A TIMED TAKE CUTS A PREFIX THE WAY NO ROWS DOES. `filterStrokesBySpans`
     * tags every piece with `clipArc`, and Solid's raster strokes a piece shorter than the
     * line at that arc (TRAVEL-4), so it starts as a dot. No rows on a grow window cuts with
     * `filterStrokesByProgress`, which tags nothing, so the same prefix opens at full width.
     * Measured: solid 4 (ease "in", stroke 5 at 0.035 of its slot) drew 0.072 of the mask
     * where no rows draws 0.101, and the ease frame matched no no-rows instant within
     * ±60 ms (162 px or more, all in stroke 5's box; `solid-bench/ease-sample.mjs`). So when
     * the untimed path would have called `filterStrokesByProgress`, the tag is dropped. A
     * Travel window or a non-identity schedule keeps it, as `filterStrokesBySchedule` does. */
    const out = timedClip
      ? schedule.identity && win.identity
        ? filterStrokesBySpans(strokes, takeSpansIn(timedClip, win)).map((p) => {
            if ((p as ClippedPiece).clipArc === undefined) return p
            const { clipArc: _drop, ...piece } = p as ClippedPiece
            return piece
          })
        : filterStrokesBySpans(strokes, takeSpansIn(timedClip, win))
      : schedule.identity && win.identity
        ? filterStrokesByProgress(strokes, revealFrac)
        : filterStrokesBySchedule(strokes, schedule, revealFrac, win)

    // ---- Diagnostics ----
    // Total arc length across the full strokes prop (denominator).
    let totalLen = 0
    for (const s of strokes) {
      const pts = s.points
      for (let i = 1; i < pts.length; i++) {
        const dx = pts[i].x - pts[i - 1].x
        const dy = pts[i].y - pts[i - 1].y
        totalLen += Math.sqrt(dx * dx + dy * dy)
      }
    }
    // Visible arc length in the filtered output (numerator).
    let visLen = 0
    let visPts = 0
    for (const s of out) {
      const pts = s.points
      visPts += pts.length
      for (let i = 1; i < pts.length; i++) {
        const dx = pts[i].x - pts[i - 1].x
        const dy = pts[i].y - pts[i - 1].y
        visLen += Math.sqrt(dx * dx + dy * dy)
      }
    }
    SOLID_ANIM_DEBUG.solidAnimationProgress = solidAnimProgress
    SOLID_ANIM_DEBUG.solidAnimationRebuildCount = ++solidAnimRebuildCountRef.current
    SOLID_ANIM_DEBUG.animatedStrokePointCount = visPts
    SOLID_ANIM_DEBUG.animatedVisibleArcLength = visLen
    SOLID_ANIM_DEBUG.animatedTotalArcLength = totalLen
    // Constants — proves the reveal pipeline (not just the prop name).
    SOLID_ANIM_DEBUG.solidAnimationUsesArcLength = "YES"
    SOLID_ANIM_DEBUG.solidAnimationInterpolatedCutPoint = "YES"
    // Final-frame match: at progress >= 1 the filter short-circuits and
    // returns the original strokes reference, so the mesh built next is
    // identical to the static H3 path. We mark YES; any lower progress -> NO.
    SOLID_ANIM_DEBUG.finalFrameMatchesStatic = solidAnimProgress >= 1 ? "YES" : "NO"
    return out
  }, [
    strokes,
    geometryMode,
    solidAnimProgress,
    revealMode,
    hybridBlend,
    inflateRevealsByDrawRange,
    schedule,
    revealWindow,
    timedClip,
  ])

  // Animation active flag tracked alongside `playing` so the debug overlay
  // can distinguish "playback running" from "playback paused mid-reveal".
  // The flag stays true for any partial-rebuild mode while playing.
  useEffect(() => {
    if (
      geometryMode !== "solid" &&
      geometryMode !== "extrude" &&
      geometryMode !== "inflate"
    ) {
      SOLID_ANIM_DEBUG.solidAnimationActive = false
      return
    }
    SOLID_ANIM_DEBUG.solidAnimationActive = playing
  }, [playing, geometryMode])

  // Stamp the active animation strategy each render so the debug panel
  // proves which path the build went through. "static" is reported when
  // playback is not running OR progress is fully complete.
  useEffect(() => {
    if (!playing || solidAnimProgress >= 1) {
      SOLID_ANIM_DEBUG.animationPath = "static"
      return
    }
    if (geometryMode === "rod") {
      SOLID_ANIM_DEBUG.animationPath = "drawRange"
    } else if (geometryMode === "extrude") {
      SOLID_ANIM_DEBUG.animationPath = "partialExtrudeRebuild"
    } else if (geometryMode === "solid") {
      // Sticky-final-hole-contour stabilization (current strategy).
      SOLID_ANIM_DEBUG.animationPath = "partialSolidRebuildWithHoleStabilization"
    } else if (geometryMode === "inflate") {
      // Two different mechanisms under one mode name, and the panel has to say
      // which one ran. IMPLICIT fusion reveals by drawRange over a build-time
      // arc-length table (Rod's mechanism, zero geometry work per frame). The
      // LOFT still rebuilds its elliptical tube from the progressive prefix.
      SOLID_ANIM_DEBUG.animationPath = inflateRevealsByDrawRange
        ? "drawRangeImplicit"
        : "partialInflateRebuild"
    } else {
      SOLID_ANIM_DEBUG.animationPath = "static"
    }
  }, [geometryMode, playing, solidAnimProgress, inflateRevealsByDrawRange])

  // -----------------------------------------------------------------
  // Solid H3 ANIMATION_GATED hole stabilization — Scene-side state machine.
  //
  // Owns:
  //   - `finalHoleRefRef`: snapshot of the final-pass hole world contours
  //     and centroids, captured the moment playback starts. Source is
  //     SOLID_DEBUG.lastStages.solidDiagnostics.stableHolesWorld, which the
  //     most recent STATIC (pre-Play) build always populates. This means
  //     the reference is built without any extra work — the static H3 mesh
  //     the user was already looking at before they pressed Play IS the
  //     reference.
  //   - Per-final-hole activation streak counters (`hitStreak`, `missStreak`,
  //     `active`). Updated AFTER each animated build by reading
  //     SOLID_DEBUG.lastStages.solidDiagnostics.detectedPartialHoleCentroidsWorld
  //     (the partial-frame H1/H2 detected centroids).
  //   - `holeStabilizationKey` state: bumped on activation transitions so
  //     useStrokeMeshes re-runs with the new active set.
  //
  // Behavior:
  //   - threshold = 1 hit: as soon as partial detection sees a hole at
  //     roughly the location of a final hole, override turns on for that
  //     final hole.
  //   - sticky: once activated, a final hole stays activated for the rest
  //     of this playback session (no deactivation). The topological safety
  //     filter inside buildMaskSolid (`centroid-inside-partial-outer`)
  //     handles the "loop not yet enclosed" case automatically.
  //   - All state resets to clean values on every false→true `playing`
  //     transition, alongside the rebuild counter reset already in
  //     handlePlayPause.
  //
  // Static H3 builds (playing=false, progress=1, exports) never see
  // holeStabilization — they pass `undefined` and use partial detection.
  // -----------------------------------------------------------------
  type FinalHoleRef = {
    holes: THREE.Vector2[][]
    centroids: { x: number; y: number }[]
    areasWorld: number[]
    activationRadius: number[]
  }
  type HoleActivation = {
    hitStreak: number
    missStreak: number
    active: boolean
  }
  const finalHoleRefRef = useRef<FinalHoleRef | null>(null)
  const activationRef = useRef<HoleActivation[]>([])
  const [holeStabilizationKey, setHoleStabilizationKey] = useState<string>("none")
  const holeStabilizationRef = useRef<
    import("@/lib/solid-mask").SolidHoleStabilization | undefined
  >(undefined)
  const lastSeenProgressRef = useRef<number>(playheadRef.current)

  // Snapshot final hole reference on Play start.
  // Runs at the same time the rebuild-count reset effect runs — false→true
  // `playing` transition, BEFORE the first animated build (layout effect).
  //
  // PERF/CORRECTNESS FIX: this effect previously read `prevPlayingRef`,
  // which the flash-suppression layout effect above (declared earlier, so
  // it runs FIRST in the same commit) had already advanced to the new
  // `playing` value. `wasPlaying` was therefore always === `playing`, the
  // false→true branch below never fired, and `holeStabilizationRef` was
  // never populated — every animated Solid build ran the STATIC pipeline
  // (full 512-res mask, full per-frame console logging, no sticky-hole
  // override). A dedicated prev-ref restores the documented
  // STICKY_FINAL_HOLE_CONTOURS behavior and lets buildMaskSolid's
  // animated fast path (QUIET + reduced raster resolution) engage.
  const prevPlayingForSnapshotRef = useRef(playing)
  useLayoutEffect(() => {
    const wasPlaying = prevPlayingForSnapshotRef.current
    prevPlayingForSnapshotRef.current = playing
    if (geometryMode !== "solid") return
    if (!wasPlaying && playing) {
      // Capture from the currently-displayed static H3's last build.
      const stages = SOLID_DEBUG.lastStages as
        | { solidDiagnostics?: { stableHolesWorld?: Array<Array<{ x: number; y: number }>> } }
        | null
      const snap = stages?.solidDiagnostics?.stableHolesWorld ?? []
      if (snap.length > 0) {
        const holes: THREE.Vector2[][] = snap.map((c) =>
          c.map((p) => new THREE.Vector2(p.x, p.y)),
        )
        const centroids: { x: number; y: number }[] = []
        const areasWorld: number[] = []
        const activationRadius: number[] = []
        for (const c of holes) {
          let sx = 0, sy = 0
          for (const p of c) { sx += p.x; sy += p.y }
          const cx = sx / c.length
          const cy = sy / c.length
          // Signed-area magnitude in world units.
          let area2 = 0
          for (let i = 0; i < c.length; i++) {
            const a = c[i]
            const b = c[(i + 1) % c.length]
            area2 += a.x * b.y - b.x * a.y
          }
          const area = Math.abs(area2) * 0.5
          centroids.push({ x: cx, y: cy })
          areasWorld.push(area)
          // Tolerance: ~the hole's effective radius. Slightly generous so
          // partial centroids that wobble around the hole still match.
          activationRadius.push(Math.max(0.04, 0.7 * Math.sqrt(area / Math.PI)))
        }
        finalHoleRefRef.current = { holes, centroids, areasWorld, activationRadius }
        activationRef.current = holes.map(() => ({
          hitStreak: 0,
          missStreak: 0,
          active: false,
        }))
        SOLID_ANIM_DEBUG.finalHoleReferenceCount = holes.length
        SOLID_ANIM_DEBUG.activatedFinalHoleCount = 0
        SOLID_ANIM_DEBUG.perHoleActivationRadiusWorld = activationRadius
        SOLID_ANIM_DEBUG.perHoleHitStreaks = activationRef.current.map(() => 0)
        SOLID_ANIM_DEBUG.perHoleMissStreaks = activationRef.current.map(() => 0)
      } else {
        finalHoleRefRef.current = null
        activationRef.current = []
        SOLID_ANIM_DEBUG.finalHoleReferenceCount = 0
        SOLID_ANIM_DEBUG.activatedFinalHoleCount = 0
        SOLID_ANIM_DEBUG.perHoleActivationRadiusWorld = []
        SOLID_ANIM_DEBUG.perHoleHitStreaks = []
        SOLID_ANIM_DEBUG.perHoleMissStreaks = []
      }
      // Start the animation with an EMPTY-active override (mode is
      // ANIMATION_GATED, activeFinalHolesWorld is []). Previously this
      // was set to `undefined`, which meant buildMaskSolid took the
      // unstabilized partial-detection path until the first hole
      // activated — and the partial frames in between produced visible
      // hole flicker (counter labels switching, holes blinking on/off,
      // shape mid-stroke briefly punching a hole where the loop hadn't
      // closed yet). With the empty override in place, the override
      // block inside buildMaskSolid runs every frame and unconditionally
      // REPLACES any partial-detection holes with the activated set
      // (which is empty until a real hole genuinely activates). Net
      // effect: zero holes from frame 0 through "no hole has activated
      // yet", then once a hole activates it appears and sticks until
      // playback ends. No flicker. Static H1/H2/H3 path is untouched
      // (it never receives `holeStabilization`).
      holeStabilizationRef.current = {
        mode: "ANIMATION_GATED",
        activeFinalHolesWorld: [],
      }
      setHoleStabilizationKey(`play-${Date.now()}-empty`)
    }
  }, [playing, geometryMode, playheadRef])

  // After each animated mesh build, update activation state from the
  // partial-frame detected centroids (which the build just stamped into
  // SOLID_DEBUG.lastStages.solidDiagnostics.detectedPartialHoleCentroidsWorld).
  // If activation flips for any hole, bump `holeStabilizationKey` so the
  // next animated build picks up the new active set.
  useEffect(() => {
    if (geometryMode !== "solid" || !playing) return
    const ref = finalHoleRefRef.current
    if (!ref || ref.holes.length === 0) return

    const stages = SOLID_DEBUG.lastStages as
      | {
          solidDiagnostics?: {
            detectedPartialHoleCentroidsWorld?: Array<{ x: number; y: number; areaPx: number }>
          }
        }
      | null
    const partial = stages?.solidDiagnostics?.detectedPartialHoleCentroidsWorld ?? []
    SOLID_ANIM_DEBUG.lastPartialCentroidCount = partial.length

    // Activation rule (STICKY_FINAL_HOLE_CONTOURS strategy):
    //   - Require ACTIVATION_HIT_STREAK consecutive positive centroid matches
    //     before flipping `active = true`. This filters out single-frame
    //     false positives (e.g. transient empty regions inside the partial
    //     silhouette where two strokes nearly close a region but the loop
    //     is not yet sealed).
    //   - Once active, NEVER deactivate within a playback session — there
    //     is no longer a centroid-inside-partial-outer test inside the
    //     engine override block, so the activation decision made here is
    //     authoritative for the rest of the reveal.
    //   - On the commit frame (progress >= 1), force-activate every final
    //     hole so the final frame is guaranteed to match the static H3
    //     reference even if a centroid never reached its activation tol
    //     during the reveal (e.g. very fast stroke speed).
    const ACTIVATION_HIT_STREAK = 2
    let activationChanged = false
    const forceFinalActivation = solidAnimProgress >= 1
    for (let i = 0; i < ref.holes.length; i++) {
      const fc = ref.centroids[i]
      const tol = ref.activationRadius[i]
      let matched = false
      for (const p of partial) {
        const dx = p.x - fc.x
        const dy = p.y - fc.y
        if (dx * dx + dy * dy <= tol * tol) {
          matched = true
          break
        }
      }
      const state = activationRef.current[i]
      if (matched) {
        state.hitStreak += 1
        state.missStreak = 0
      } else {
        // Hits must be CONSECUTIVE — reset the streak on any miss so a
        // single noisy partial frame can't accumulate matches over a
        // long reveal.
        state.hitStreak = 0
        state.missStreak += 1
      }
      if (
        !state.active &&
        (state.hitStreak >= ACTIVATION_HIT_STREAK || forceFinalActivation)
      ) {
        state.active = true
        activationChanged = true
      }
    }

    // Mirror per-hole streaks for the panel.
    SOLID_ANIM_DEBUG.perHoleHitStreaks = activationRef.current.map((s) => s.hitStreak)
    SOLID_ANIM_DEBUG.perHoleMissStreaks = activationRef.current.map((s) => s.missStreak)
    const activeCount = activationRef.current.filter((s) => s.active).length
    SOLID_ANIM_DEBUG.activatedFinalHoleCount = activeCount

    // Sticky-strategy mirrors owned by THIS effect (the activation state
    // machine is the single source of truth for these values).
    const activeIds: number[] = []
    let pending = 0
    for (let i = 0; i < activationRef.current.length; i++) {
      const s = activationRef.current[i]
      if (s.active) activeIds.push(i)
      else if (s.hitStreak > 0) pending += 1
    }
    SOLID_ANIM_DEBUG.activeHoleIds = activeIds
    SOLID_ANIM_DEBUG.pendingHoleCount = pending
    SOLID_ANIM_DEBUG.usingFinalHoleContoursForAnimation =
      activeCount > 0 ? "YES" : "NO"
    SOLID_ANIM_DEBUG.holeSourceDuringAnimation =
      "FINAL_STATIC_FOR_ACTIVE_NONE_OTHERWISE"
    // Record progress-at-activation for newly-activated holes. We only
    // write the slot if it's still NaN (never been activated this session)
    // so the value reflects the FIRST activation moment.
    if (
      SOLID_ANIM_DEBUG.holeActivationProgress.length !==
      activationRef.current.length
    ) {
      SOLID_ANIM_DEBUG.holeActivationProgress = activationRef.current.map(
        () => Number.NaN,
      )
    }
    for (let i = 0; i < activationRef.current.length; i++) {
      if (
        activationRef.current[i].active &&
        Number.isNaN(SOLID_ANIM_DEBUG.holeActivationProgress[i])
      ) {
        SOLID_ANIM_DEBUG.holeActivationProgress[i] = solidAnimProgress
      }
    }
    SOLID_ANIM_DEBUG.finalStaticHoleCount = ref.holes.length

    if (activationChanged) {
      // Build the new override and a stable key signature.
      const activeFinalHolesWorld: THREE.Vector2[][] = []
      const sig: number[] = []
      for (let i = 0; i < ref.holes.length; i++) {
        if (activationRef.current[i].active) {
          activeFinalHolesWorld.push(ref.holes[i])
          sig.push(i)
        }
      }
      // ALWAYS keep the override in ANIMATION_GATED mode during playback.
      // Even with zero activated holes the override must be present so
      // the buildMaskSolid override block wipes any partial-detection
      // holes. Falling back to `undefined` here was a previous source
      // of mid-playback hole flicker the moment an `activationChanged`
      // event landed with no active holes left.
      holeStabilizationRef.current = {
        mode: "ANIMATION_GATED",
        activeFinalHolesWorld,
      }
      setHoleStabilizationKey(`active-${sig.join(",")}-of-${ref.holes.length}`)
    }
  }, [geometryMode, playing, solidAnimProgress])

  // When playback stops or progress reaches the end, clear the override so
  // the final/static build runs the standard (unstabilized) path.
  useEffect(() => {
    if (geometryMode !== "solid") return
    if (!playing || solidAnimProgress >= 1) {
      if (holeStabilizationRef.current !== undefined) {
        holeStabilizationRef.current = undefined
        setHoleStabilizationKey("none")
      }
    }
    lastSeenProgressRef.current = solidAnimProgress
  }, [playing, solidAnimProgress, geometryMode])

  // Build meshes.
  //
  //  - Solid and Extrude both consume `animatedStrokes` (arc-length-filtered
  //    partial copy of the source strokes for the current progress). At
  //    progress >= 1 the filter short-circuits and returns the original
  //    `strokes` reference, so the final-frame mesh is byte-identical to the
  //    static preview that was rendered before Play was pressed.
  //  - Rod consumes the full `strokes` because Rod animation is driven by
  //    per-segment drawRange inside AnimatedStrokes, not by geometry rebuilds.
  //  - `holeStabilization` is Solid-only by construction: only the Solid
  //    H3 hole pipeline reads it. Extrude passes `undefined` so its geometry
  //    path is untouched.
  const useAnimatedStrokes =
    !inflateRevealsByDrawRange &&
    (geometryMode === "solid" ||
      geometryMode === "extrude" ||
      geometryMode === "inflate")
  // ---- Solid animation: sticky-final-hole-contour stabilization ----------
  //
  // ABANDONED STRATEGY (do NOT reintroduce):
  //   `FILLED_DURING_REVEAL_COMMIT_AT_END` — i.e. forcing
  //   `disableHolesForAnimation = true` for the entire reveal and committing
  //   holes only at progress = 1. That produced a filled-blob reveal followed
  //   by a giant topology snap on the final frame. The
  //   `disableHolesForAnimation` plumbing remains in the engine signatures
  //   as a no-op so older builds and dead branches keep type-checking, but
  //   Scene NEVER passes `true` for it any more.
  //
  // ACTIVE STRATEGY (this code path):
  //   `STICKY_FINAL_HOLE_CONTOURS`. The Play-start layout effect captures the
  //   final static H3 hole contours from `SOLID_DEBUG.lastStages` BEFORE any
  //   animation frame paints. A separate effect runs the 2-hit centroid
  //   activation matcher against partial-frame detected centroids and
  //   updates `holeStabilizationRef.current.activeFinalHolesWorld`. The
  //   override is always in `ANIMATION_GATED` mode for the duration of a
  //   playback session, starting with an empty active list (no holes shown
  //   pre-activation). `buildMaskSolid`'s override block attaches the active
  //   final contours unconditionally (no per-frame "centroid-inside-partial-
  //   outer" re-evaluation that can pop active holes in/out frame-to-frame).
  const meshes = useStrokeMeshes(
    useAnimatedStrokes ? animatedStrokes : strokes,
    canvasWidth,
    canvasHeight,
    geometryMode,
    atWidth.params.extrudeParams,
    atWidth.params.solidParams,
    atWidth.params.inflateParams,
    geometryMode === "solid" ? holeStabilizationRef.current : undefined,
    geometryMode === "solid" ? holeStabilizationKey : undefined,
    // disableHolesForAnimation is intentionally NOT passed — leaving this
    // argument unset means the engine takes the standard partial+override
    // pipeline. Setting it to true is the abandoned strategy above.
    undefined,
    engineFamily,
    // From the FULL `strokes` prop, never `animatedStrokes` — see the parameter
    // doc. Only Extrude's drafted side walls read it, and only when that dial is
    // on, so this is null work in every other mode.
    extrudeDraftCentre,
  )
  /**
   * F119, A ROD REBUILD FREES THE TUBES IT REPLACES. `useStrokeMeshes` hands
   * back a fresh `tubeGeometry` per Rod stroke on every build and nothing freed
   * the set it replaced: R3F does not dispose a geometry passed as a prop, and
   * three frees GL buffers only on the geometry's own `dispose`. MEASURED
   * (`_probe-memory-leak.mjs --scenario=flip`, hero word): +12 geometries and
   * +48 GL buffers on every switch back to Rod, a straight line over 20 flips.
   *
   * Only `mode === "rod"` tubes are freed. Rod builds each one fresh and shares
   * none (caps and joints are the singletons or `rodSphereGeos`, never here).
   * Inflate is excluded on purpose: its implicit slot hands the SAME geometry
   * back across rebuilds and refills it in place. A tube still present in the
   * new set is kept. The unmount arm waits one task so StrictMode's simulated
   * remount, which re-runs the effect above with the same meshes, cancels it.
   * `window.__fsF119SkipRodDispose` is the must-fail arm for the probe.
   */
  const rodTubesRef = useRef<THREE.BufferGeometry[]>([])
  const rodTubesUnmountRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (rodTubesUnmountRef.current) {
      clearTimeout(rodTubesUnmountRef.current)
      rodTubesUnmountRef.current = null
    }
    const next = meshes.filter((m) => m.mode === "rod").map((m) => m.tubeGeometry)
    const skip = typeof window !== "undefined" && (window as { __fsF119SkipRodDispose?: boolean }).__fsF119SkipRodDispose === true
    if (!skip) {
      const keep = new Set(next)
      for (const g of rodTubesRef.current) if (!keep.has(g)) g.dispose()
    }
    rodTubesRef.current = next
  }, [meshes])
  useEffect(() => () => {
    rodTubesUnmountRef.current = setTimeout(() => {
      for (const g of rodTubesRef.current) g.dispose()
      rodTubesRef.current = []
    }, 0)
  }, [])
  /**
   * THE EVIDENCE THAT CORRECTS `inflateRevealsByDrawRange`.
   *
   * `revealKeys` is not a request, it is a thing the built surface either has
   * or has not. Reading it off the meshes is the only way to be right about
   * BOTH the Desk Doodles engine (which never sets one) and a Free Stroke
   * implicit build that fell back to the loft (which also never sets one, and
   * which the old flag was documented as getting wrong).
   *
   * Guarded on `meshes.length > 0` so an empty reveal frame — which the rebuild
   * path legitimately produces at progress 0 — cannot be read as "no table" and
   * pin the flag off. Only meaningful in Inflate; every other mode leaves it
   * alone so a Rod or Solid render cannot flip a flag it does not use.
   */
  useEffect(() => {
    if (geometryMode !== "inflate") return
    if (meshes.length === 0) return
    const has = meshes.every((m) => !!m.revealKeys && m.revealKeys.length > 0)
    /* Compared HERE, not in an updater. On the loft, `meshes` is new on every
     * tick of the reveal, and a functional `setState` that returns the same
     * value still queued a render: measured, 60.8 R3F commits a second against
     * 30.4 ticks, one empty commit per tick (night S2, 2026-09-25). */
    if (has !== meshesCarryRevealKeys) setMeshesCarryRevealKeys(has)
  }, [meshes, geometryMode, meshesCarryRevealKeys])

  const meshBounds = useStrokeBounds(meshes)

  // Stable bounds derived from the FULL strokes prop (not the animated subset).
  // Used in Solid mode so the camera doesn't zoom in as the mesh shrinks/grows
  // during draw-in animation. For other modes we keep mesh-derived bounds.
  const stableBounds = useStableStrokesBounds(strokes, canvasWidth, canvasHeight)

  const bounds = geometryMode === "solid" || geometryMode === "inflate" ? stableBounds ?? meshBounds : meshBounds

  // Populate meshStatusRef for debug overlay (extrude mode)
  useEffect(() => {
    if (meshStatusRef) {
      // Placeholder status for non-extrude meshes (rod, solid, inflate). The
      // extrude debug panel only renders when geometryMode === "extrude", so
      // this fallback is only consumed for safety; the strategy tag here is
      // never displayed.
      meshStatusRef.current = meshes.map(
        (m) =>
          m.buildStatus ?? {
            type: "ok",
            width: 0,
            depth: 0,
            bevelEnabled: false,
            strategy: "legacy",
            depthMultiplier: 0,
            effectiveDepth: 0,
          },
      )
    }
  }, [meshes, meshStatusRef])

  // Populate solidStatusRef for debug overlay (solid mode)
  // Also tracks per-build validHoleCount churn so the animation panel can
  // report `topologyChangeCount` (counters/holes appearing/disappearing as
  // the partial reveal crosses closure thresholds). This is observation-
  // only — we do NOT change static H3 hole detection or apply hysteresis.
  const prevValidHoleCountRef = useRef<number | null>(null)
  useEffect(() => {
    if (solidStatusRef) {
      // Find the first mesh with solidStatus (Solid mode produces a single mesh)
      const solidMesh = meshes.find((m) => m.solidStatus)
      solidStatusRef.current = solidMesh?.solidStatus ?? null
    }
    if (geometryMode === "solid") {
      const stages = SOLID_DEBUG.lastStages as
        | {
            solidDiagnostics?: {
              validHoleCount?: number
              holeStabilizationActive?: "YES" | "NO"
              holeOverrideRejectReasons?: string[]
              h3ShapeHoleCount?: number
              h2ShapeHoleCount?: number
            }
          }
        | null
      const sd = stages?.solidDiagnostics
      const current = sd?.validHoleCount ?? 0
      const prev = prevValidHoleCountRef.current

      // Topology change counter is now a strict invariant: any non-zero
      // value reported during the active reveal indicates the
      // sticky-final-hole-contour strategy was bypassed somewhere.
      if (
        prev !== null &&
        prev !== current &&
        SOLID_ANIM_DEBUG.solidAnimationActive
      ) {
        SOLID_ANIM_DEBUG.topologyChangeCount += 1
      }
      prevValidHoleCountRef.current = current
      SOLID_ANIM_DEBUG.validHoleCount = current
      SOLID_ANIM_DEBUG.holeStabilizationActive =
        sd?.holeStabilizationActive ?? "NO"
      SOLID_ANIM_DEBUG.holeStabilizationLastReasons =
        sd?.holeOverrideRejectReasons ?? []

      // Sticky-strategy mirrors. activeHoleIds / pendingHoleCount /
      // holeActivationProgress / usingFinalHoleContoursForAnimation are
      // written by the activation effect itself (it owns that state); we
      // only fill the per-frame "how many holes did the cap actually use"
      // count and the final-frame match here.
      SOLID_ANIM_DEBUG.animatedActiveHoleCount =
        sd?.h3ShapeHoleCount ?? sd?.h2ShapeHoleCount ?? 0
      const atOrPastCommit = SOLID_ANIM_DEBUG.solidAnimationProgress >= 1
      if (atOrPastCommit) {
        SOLID_ANIM_DEBUG.finalStaticHoleCount =
          SOLID_ANIM_DEBUG.finalHoleReferenceCount
        SOLID_ANIM_DEBUG.finalFrameHoleMatch =
          current === SOLID_ANIM_DEBUG.finalHoleReferenceCount ? "YES" : "NO"
      }
    }
  }, [meshes, solidStatusRef, geometryMode])
  
  // ---- Extrude depth-trace diagnostic ----
  // Populates extrudeDebugRef whenever the meshes array (output of useStrokeMeshes
  // useMemo) changes. If the memo doesn't re-fire on a depth-slider move, this
  // effect doesn't fire either and `buildCount` stays flat — that's the proof
  // the rebuild path is broken. If it does fire and `bboxZ` matches the new
  // depth, the rebuild path is correct and any visible-staleness is downstream
  // (camera angle / material / R3F prop swap).
  // Mode-agnostic build counter: `meshes` IS the geometry build output, so a
  // change here means geometry was rebuilt. Style-only changes must not fire.
  useEffect(() => {
    GEOM_BUILD_DEBUG.buildCount += 1
  }, [meshes])

  const extrudeBuildCountRef = useRef(0)
  useEffect(() => {
    if (!extrudeDebugRef) return
    extrudeBuildCountRef.current += 1
    let bboxZ = 0
    for (const m of meshes) {
      const g = m.tubeGeometry
      g.computeBoundingBox()
      const bb = g.boundingBox
      if (bb) {
        const dz = bb.max.z - bb.min.z
        if (dz > bboxZ) bboxZ = dz
      }
    }
    // Pull the calibrated effective depth/width from the first stroke's
    // build status — the engine writes the actual values it used there.
    // The Width slider is now a normalized t in [0, 1]; the EFFECTIVE
    // half-width is what extrudeParams.width carries (already mapped by
    // app/page.tsx). Reconstruct the slider t from the effective width
    // so both readings are visible in the debug panel even if a future
    // caller bypasses the mapping helper.
    const rawWidthParam = extrudeParams?.width ?? 0
    let effectiveWidthUsed = rawWidthParam
    let effectiveDepthUsed = 0
    let strategy = ""
    let buildStatus = ""
    for (const m of meshes) {
      const s = m.buildStatus
      if (!s) continue
      buildStatus = s.type
      strategy = s.strategy
      // Only non-rodFallback variants carry the engine-resolved width;
      // rodFallback's effective half-width is implicit via fallbackRadius.
      if (s.type !== "rodFallback") {
        effectiveWidthUsed = s.width
      }
      if (s.effectiveDepth > 0) effectiveDepthUsed = s.effectiveDepth
      if (effectiveDepthUsed > 0) break
    }
    const depthToWidthRatio = effectiveWidthUsed > 0 ? effectiveDepthUsed / effectiveWidthUsed : 0
    const widthSliderValue = extrudeWidthToSlider(effectiveWidthUsed)

    extrudeDebugRef.current = {
      depthParam: extrudeParams?.depth ?? 0,
      buildCount: extrudeBuildCountRef.current,
      bboxZ,
      activeEngine: geometryMode,
      widthSliderValue,
      widthSliderPercent: Math.round(widthSliderValue * 100),
      effectiveWidthUsed,
      effectiveWidthPercent: Math.round(extrudeWidthToSlider(effectiveWidthUsed) * 100),
      effectiveDepthUsed,
      depthToWidthRatio,
      strategy: strategy || "unknown",
      buildStatus: buildStatus || "unknown",
    }
  }, [meshes, extrudeParams?.depth, extrudeParams?.width, geometryMode, extrudeDebugRef])
  const onTimedRef = useRef(onTimed)
  onTimedRef.current = onTimed
  useEffect(() => {
    onTimedRef.current?.(timed)
  }, [timed])
  /** `prior` puts the grey placeholder cube back — see the empty-state note in
   *  the return below, and `readDevLaw`. */
  const emptyStateLaw = readDevLaw("__fsEmptyState", ["prior"], "authored")

  useEffect(() => {
    boundsRef.current = bounds
  }, [bounds, boundsRef])

  return (
    <>
      {/* THE RIG. Both setups — Free Stroke's nine-panel gloss studio and Desk
          Doodles' matte-graphite studio — live in components/studio-rig.tsx,
          each ported whole from the app it belongs to rather than re-derived
          from a parameter table. The register picks one; nothing blends them.
          Default is Free Stroke's, so `/` renders exactly as it did. */}
      <RegisterRig rig={lighting.rig} />

      {/* CONTACT SHADOW — Desk Doodles' pool, off in the Free Stroke register.
          It is the cue that the form is an OBJECT above paper rather than a
          mark on it. Suppressed while the background is transparent (capture
          mode), following Desk Doodles' own rule: on a see-through ground a
          shadow patch reads as dirt, not as contact. */}
      {/* TAGGED AS CHROME-ON-TRANSPARENT, not as chrome. The pool is part of
          the picture on paper and reads as dirt on a see-through ground, which
          is the rule stated on <StudioContactShadow> itself — so the still
          export drops it only when the user asks for no background. */}
      {lighting.contactShadow && !hideGrid && bounds && (
        <group userData={{ fsChrome: "shadow" satisfies StillChrome }}>
        <StudioContactShadow
          centerX={bounds.center.x}
          centerZ={bounds.center.z}
          minY={bounds.minY ?? bounds.center.y - bounds.radius}
          radius={bounds.radius}
          rebuildKey={`${geometryMode}|${strokes.length}|${bounds.radius.toFixed(3)}`}
          /* The pool is the cue that the form is an OBJECT above paper. While
           * the mark is still a drawing there is nothing to cast it, so it
           * arrives with the volume rather than preceding it.
           *
           * ITS OWN CHANNEL WHERE THE HOST GIVES ONE. `1 - ink` was right while
           * `ink` was a 0.54s ramp; under the turn `ink` hard-flips at the edge,
           * so the derived law POPS the shadow on in the very frame the face
           * swaps — two arrivals in one frame. `FlatState.shadow` carries the
           * model's own landing, four frames behind the face, and the derived
           * law stays as the fallback for every caller that has none. */
          opacityScale={flatten.shadow ?? 1 - flatten.ink}
        />
        </group>
      )}

      {/* NO PLACEHOLDER CUBE. There used to be an unconditional grey
          `boxGeometry` here, so the first thing anyone ever saw of this app was
          a default-lit grey box that has nothing to do with what it does. The
          empty state is DOM now (`<ViewportEmptyState>`, rendered outside the
          Canvas), because the left half of the app already answers this exact
          question — `drawing-canvas.tsx`'s "Draw here" affordance — and two
          halves of one screen may not speak two visual languages. The stage
          itself (grid + rig) is left standing: an empty stage is a legible
          empty state, a grey cube is an unfinished one.

          The cube is PARKED, not deleted, behind a dev-only law — it is the
          negative control `assert-still-export.mjs` row 3 needs, and a row that
          cannot fail is worth nothing. */}
      {strokes.length === 0 && emptyStateLaw === "prior" && (
        <mesh>
          <boxGeometry args={[0.6, 0.6, 0.6]} />
          <meshStandardMaterial color="#888888" />
        </mesh>
      )}

          <AnimatedStrokes
            meshes={meshes}
            timelines={timelines}
            totalDuration={computedDuration}
            playheadRef={playheadRef}
            openingRef={openingRef}
            revealMode={revealMode}
            hybridBlend={hybridBlend}
            strokes={strokes}
            exportGroupRef={exportGroupRef}
            styleState={styleState}
            bounds={bounds}
            lighting={lighting}
            flattenSrc={flattenSrc}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            stillExport={stillExport}
            solidParams={solidParams}
            letterMap={letterMap}
            schedule={schedule}
            timed={timed}
            takeKnockout={takeKnockout}
            revealWindow={revealWindow}
            keyReader={keyReader}
          />

      {/* The host's own draw-in playhead, if it drives one. Mounted before the
          transport so a host-driven page still shows a coherent scrub readout
          if it ever un-suppresses the chrome. */}
      <HostRevealTick revealRef={revealRef} playheadRef={transportRef} />

      <PlaybackController
        playheadRef={transportRef}
        playing={playing}
        speed={speed}
        clockRef={clockRef ?? transportRef}
        ease={revealEase}
        cadence={revealCadence}
        delaySeconds={revealDelaySeconds}
        loop={revealLoop}
        reverse={revealReverse}
        totalDuration={totalDuration}
        onProgressUpdate={onProgressUpdate}
        onReachedEnd={onReachedEnd ?? (() => {})}
        openingRef={openingRef}
      />

      {/* Solid-only animation tick: forces React re-render of Solid mesh
          while playheadRef advances. No-op for other modes. */}
        <SolidAnimationTick
          enabled={
            !inflateRevealsByDrawRange &&
            (geometryMode === "solid" || geometryMode === "extrude" || geometryMode === "inflate")
          }
        playheadRef={playheadRef}
        setSolidAnimProgress={setSolidAnimProgress}
        revealFracRef={solidRevealFracRef}
      />

      {/* Dev-only: exposes window.__inflateProbe for the fusion verification
          scripts. Renders nothing and touches no state. */}
      <FusionProbe />

      <AutoFrameOnFirstDraw
        strokeCount={strokes.length}
        bounds={bounds}
        controlsRef={controlsRef}
      />

      {/* And the empty half of it — see `FrameEmptyStage`. Without this the
          orthographic camera stays at zoom 1 and the grid below is a speck. */}
      <FrameEmptyStage strokeCount={strokes.length} />

      {!hideGrid && (
        <gridHelper
          args={[6, 12, "#cccccc", "#e5e5e5"]}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, -0.05]}
          /* F118, 2026-09-25: the grid is the page, so ink always wins over it.
             It paints first and writes no depth. Before this, a yawed word
             swung its right half behind z -0.05, and the grid line drew through
             the "l" and "s" on the emerge and the return turn. Filmed headed
             (night-a2-before vs night-a2-grid): assert-eye-white-in-ink A, the
             light px inside the ink, went from 25 of 82 emerge frames red
             (worst excess 156) to 0 of 83 (worst 53), and returnTurn from 23 of
             76 red to 0 of 76. See docs/verification/night-a2/. */
          renderOrder={-1}
          material-depthWrite={false}
          /* The stage a stranger sees before drawing, and never part of an
             exported still — see `STILL_EXPORT`. */
          userData={{ fsChrome: "grid" satisfies StillChrome }}
        />
      )}
      {orbitEnabled ? (
        /* THE TURNTABLE. `autoRotateSpeed` is three's unit — 2π/60 · speed
           radians per second, i.e. 6 · speed degrees per second — so the
           conversion from the °/s a view preset actually names happens here and
           nowhere else. Mounted only while a rate is requested, so a still
           framing leaves the controls byte-for-byte as they were before this
           existed. The reduced-motion veto has already been applied by the
           caller; a zero rate mounts `autoRotate={false}`. */
        <OrbitControls
          ref={controlsRef}
          makeDefault
          autoRotate={autoRotateDegPerSecond > 0}
          autoRotateSpeed={autoRotateDegPerSecond / 6}
        />
      ) : masterControlsRef ? (
        <CameraSlave masterControlsRef={masterControlsRef} />
      ) : null}
      {orbitEnabled && keyReader?.hasCamera && orbitView ? (
        <KeyCamera reader={keyReader} controlsRef={controlsRef} boundsRef={boundsRef} orbitView={orbitView} />
      ) : null}
      {keyLiveRef ? (
        <KeyLive
          liveRef={keyLiveRef}
          transportRef={transportRef}
          revealRef={playheadRef}
          controlsRef={controlsRef}
          boundsRef={boundsRef}
        />
      ) : null}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  THE EMPTY STATE — the first frame of the product                   */
/* ------------------------------------------------------------------ */

/**
 * WHAT A STRANGER SEES BEFORE THEY HAVE DRAWN ANYTHING.
 *
 * It used to be a grey `boxGeometry` in the middle of the scene: a default cube
 * in a default material, which is the single most legible signal that software
 * is unfinished. It also lied — nothing this app makes looks like that.
 *
 * ── IT IS THE LEFT PANEL'S AFFORDANCE, ANSWERED. ──────────────────────────
 * `components/drawing-canvas.tsx:394-422` already solved this problem for the
 * canvas half: a 28px hand-drawn squiggle, a `text-sm` line, a `text-xs`
 * subline, all in muted foreground, fading out over 200ms on
 * `--ease-out-strong` the moment the first stroke lands. This is deliberately
 * the SAME construction rather than a second idea — one screen, one voice — and
 * the copy answers the sentence the left panel ends on ("Your stroke becomes a
 * 3D form on the right") instead of repeating it.
 *
 * ── THE MARK IS THE PRODUCT IN 28 PIXELS. ─────────────────────────────────
 * It is the left panel's squiggle, verbatim, drawn TWICE: once offset back and
 * up at a third opacity, once solid in front. That is the whole app — a drawn
 * stroke, given depth — and because the path data is byte-identical to the
 * canvas panel's, the two halves of the screen are visibly the same drawing at
 * two stages rather than two clip-art icons that happen to sit near each other.
 *
 * DOM, not a mesh: an empty state that is part of the scene has to be lit,
 * framed and exported like the form, and it would land in the PNG.
 */
function ViewportEmptyState({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden={!visible}
      className="pointer-events-none absolute inset-0 flex select-none flex-col items-center justify-center gap-1.5"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 200ms var(--ease-out-strong)",
      }}
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        className="text-muted-foreground/50"
      >
        {/* The back copy — the same stroke, pushed into depth. */}
        <path
          d="M4 20 C 8 8, 12 8, 14 14 S 20 22, 24 10"
          transform="translate(2.5,-2.5)"
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* The drawn stroke itself — identical `d` to drawing-canvas.tsx:412. */}
        <path
          d="M4 20 C 8 8, 12 8, 14 14 S 20 22, 24 10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-sm font-medium text-muted-foreground">
        Your form lands here
      </span>
      <span className="text-xs text-muted-foreground/70">
        Then play the draw-in, style it, and export it
      </span>
    </div>
  )
}

/* ---- Error boundary ----
 *
 * MOVED to `components/viewport-error-boundary.tsx`, and the move is the fix
 * rather than tidying. Declared here it was also RENDERED here, inside
 * `Viewport3D`'s own returned JSX — and a React boundary catches its CHILDREN,
 * never its parent's render body, so it could not catch a throw from the stroke
 * reads, the geometry memos or the camera framing, all of which run above it.
 * A forced throw produced `canvases 0` and Next.js's global "Application error"
 * white screen instead of the "Rebuild the view" card.
 *
 * `components/viewport-3d-wrapper.tsx` now wraps `<Viewport3D>` in it, which is
 * the only position above this component. The two usages below stay: wrapping
 * the `<Canvas>` as well costs nothing and keeps a scene-side throw contained
 * to the scene. Wrapping ONLY the Canvas is what produced the defect.
 *
 * Gate: `scripts/verify/assert-shell-states.mjs` §2, which carries the stack. */
/* ---- Main viewport component ---- */
interface Viewport3DProps {
  processedStrokes: ProcessedStroke[]
  rawStrokes: Stroke[]
  geometryMode: GeometryMode
  extrudeParams?: ExtrudeParams
  solidParams?: SolidParams
  inflateParams?: InflateParams
  /** POST-MVP style substrate (Phase 1). Display/debug only — NOT consumed by
   *  any geometry, animation, or export path. Passed so later phases can wire
   *  visual systems without re-threading props. */
  styleState?: StyleState
  /** Which studio rig the scene is lit by, from the active register
   *  (lib/registers.ts). Omitted → Free Stroke's own rig, unchanged. */
  lighting?: RegisterLighting
  /**
   * Which codebase's geometry engine builds the form — Free Stroke's own
   * (default) or the ported Desk Doodles engine in lib/dd-engine/. See
   * lib/engine-registry.ts. Preview and export both read it, so an exported
   * GLB always matches what was on screen.
   */
  engineFamily?: EngineFamily
  /**
   * THE HERO BEAT'S 2D HALF. Drives the form back to reading as a flat drawn
   * mark — no thickness, no shading, no specular, no rim (see `FlatState`).
   * A real prop rather than a dev harness on purpose: the flat state is the
   * PRODUCT, and a beat that only exists behind a non-production window global
   * is a beat no visitor ever sees.
   */
  flatten?: FlatState
  /**
   * O5's OTHER HALF — which letter each stroke belongs to.
   *
   * `FlatState.letters` says what each letter is DOING; this says which ink each
   * letter IS. It is a prop and not a measurement taken here for the reason the
   * junction set is a prop: the host already owns the word and the nib width,
   * and a second clustering in this file would be a second answer to the one
   * question the cascade turns on. Omitted → no cascade is possible and the
   * per-letter shader pass never leaves `count 0`.
   */
  letterMap?: LetterMap
  /**
   * ONE PAGE, ONE CLOCK. Hides the viewport's own transport, its speed and
   * reveal-mode controls, its export row and its explanatory prose.
   *
   * Not cosmetic. This viewport carries a complete playback UI for the lab —
   * play/pause, a scrub bar and a seconds readout of the STROKE timeline (the
   * pen's recorded duration, ~14s for the hero word). Dropped into a page that
   * owns its own 10.2s beat transport, the result is two playheads and two
   * scrub bars stacked in one frame, reading different numbers, either of which
   * can be dragged to fight the other. Sebs: *"these toggles switching between
   * the two make no sense."* A host that drives the reveal itself must be able
   * to say so.
   */
  chromeless?: boolean
  /**
   * THE PROJECTION — and on the hero stage it is load-bearing, not a preference.
   *
   * `"perspective"` — the lab's camera, a 50° vertical field at
   *   `radius * TOP_K` (fills the frame, `k = a/d ≈ 0.33`).
   *
   * `"affine"` — an orthographic camera framed to show EXACTLY the same
   *   half-height at the pivot plane, so a parked dead-on frame is the same
   *   picture. Everything the projection does differently only shows once
   *   something turns.
   *
   * WHY THE HERO NEEDS IT. Under a perspective projection, yawing an object
   * that is EXTENDED along the axis of rotation moves the projected centre of
   * its own silhouette: the half swinging toward the lens magnifies, the half
   * swinging away shrinks. For a slab of half-width `a` at distance `d` the
   * offset is exactly
   *
   *     WIDTH   W(θ) = W₀ · cosθ / (1 − k² sin²θ)
   *     CENTRE  Δcx  = (W(θ)/2) · k · sinθ ,   k = a/d
   *
   * — zero dead-on, zero edge-on, maximal near 45°. The word visibly swings
   * left, snaps back onto the axis for the two held frames, and swings left
   * again. It is not a wrong pivot: a measured-pivot rebuild produced
   * BYTE-IDENTICAL numbers, and at yaw 0 the mark's bbox centre measures
   * cx 559.50 against an optical axis of 559.5. It is on the axis.
   *
   * PROVEN TWO WAYS, AND NEITHER ALONE WOULD BE ENOUGH — an intervention
   * without a model shows that the projection matters but not that the
   * mechanism is understood, and a model fitted to the series it predicts is a
   * curve fit in a theory's clothes. `scripts/verify/_probe-hero-projection.mjs`
   * runs both and prints the tables:
   *
   *   1. INTERVENTION. Two captures of the same beat, same window, same frame
   *      count, differing only in this flag (`reg-persp` vs `reg-affine`):
   *
   *          perspective   max single-frame cx step 46.50 px   excursion 46.50 px
   *          affine        max single-frame cx step  1.00 px   excursion  1.00 px
   *
   *      — 1.00 px being one quantisation step of a half-pixel bbox centre,
   *      i.e. the floor of the instrument.
   *
   *   2. PREDICTION WITH NO CENTRE PARAMETER. θ is read out of
   *      `lib/hero-motion.ts`'s own sampler; `W₀` and `k` are fitted to the
   *      measured WIDTHS ONLY (612.0 px and 0.366, width rms 0.55 px over 60
   *      frames); `cx₀` is read off the frames that are not turning. The whole
   *      cx series is then a prediction, and it lands at **rms 3.31 px, worst
   *      5.61 px**, against **30.10 px** for the null model that says the
   *      centre does not move — sign, both zeroes and the peak, all in place.
   *      The fitted k also agrees with the scene: bounds radius 1.447 at
   *      `TOP_K` 2.5 and `fillLie` 1.0 gives d = 3.618 and a ≈ 1.32–1.41,
   *      i.e. k ≈ 0.37–0.39.
   *
   *      Stated limit: within about 10° of edge-on the silhouette is the form's
   *      own THICKNESS rather than the face, so those six frames are outside a
   *      face model's domain and are excluded from the fit and reported
   *      separately rather than smoothed over.
   *
   * Which is why the fix is the projection and not a compensation. The original
   * Desk Doodles flip holds cx 479.0 → 479.5 through a 241 px extent step, and
   * `hero-beat-storyboard.md` §1.5 says why: *"Registration was solved by
   * construction, not by measurement."* Its construction is a 2D compositor
   * scaling two rasters about one point — an AFFINE map. Under an affine
   * projection Δcx is identically zero for every θ, every framing and every
   * word, because a scale about the projected centre is what the projection IS.
   * A per-frame counter-translation would cancel this one measurement; an
   * orthographic camera removes the term.
   *
   * DEFAULTS TO THE HOST. A viewport driven by a `flatten` state IS the hero
   * beat's stage (that is what `FlatState` means), so it gets `"affine"`; the
   * drawing lab, which passes no `flatten`, is untouched at `"perspective"`.
   * Pass this prop to override either way — `projection="perspective"` on the
   * hero reproduces the prior read verbatim (§0.7: the prior is PARKED, not
   * removed), and is the negative control
   * `verify-hero-transition.mjs --projection=perspective` drives, through the
   * `window.__viewport3dProjection` hook below.
   *
   * ⚠ THAT CONTROL DID NOT EXIST UNTIL 2026-07-31, and this comment used to
   * name a script that never drove it. The only caller of the hook was a smoke
   * probe; the capture had no flag at all. A fix whose control cannot be run is
   * a fix nobody tested, so the capture now takes `--projection`, ASSERTS the
   * arm mounted by reading `isOrthographicCamera` off the live camera, and
   * refuses to write frames if it did not take.
   *
   * IT CHANGES THE LOOK, and the change is a taste call that is not this
   * comment's to make. Parallel projection removes near/far convergence from
   * the whole stage: at the held ¾ the far end of the word no longer reads
   * smaller than the near end, and the ground grid stops converging — an
   * axonometric read rather than a photographic one. Two things measured
   * alongside it, both in the shipped gates: the ¾'s tonal range is not reduced
   * (sd 9.1 / spread 129.6 affine against 8.6 / 113.6 perspective — the form's
   * dimensionality comes from the light, not from the projection), and the
   * edge-on sliver measures 17 px against perspective's 24 px, where the board
   * predicts ~16 px at this stage width (§3 K3′: 14 px at 960). The affine
   * sliver is the form's true thickness; the perspective one is that thickness
   * magnified by proximity.
   */
  projection?: "perspective" | "affine"
  /**
   * THE HOST'S DRAW-IN PLAYHEAD, AS A REF — 0..1, or null to leave the
   * viewport's own transport in charge.
   *
   * WHY A REF AND NOT A PROP VALUE, WHICH IS THE ANSWER TO "AND THE FUCKING
   * DRAWING IS FAST AND JANKY".
   *
   * The hero page used to drive the draw-in through `window.__revealHarness`,
   * which is a DEV-ONLY capture hook: its effect returns early when
   * `NODE_ENV === "production"`, so in a production build the hero's draw-in did
   * not exist at all — `__revealHarness?.setProgress(...)` was an optional call
   * on undefined and the mark sat at whatever the playhead already was.
   *
   * And in development it cost a full React commit PER DRAWN FRAME. Its
   * `setProgress` is a `useState` setter on this component; the host called it
   * from an effect on every beat sample, so ~60 times a second the entire
   * viewport tree — Scene, the mesh list, every memo keyed on it — was
   * re-rendered in order to move one number that the frame loop reads out of a
   * ref anyway. `AnimatedStrokes` has never needed React to know the playhead
   * moved: it reads `playheadRef.current` inside `useFrame`.
   *
   * So the host writes a ref and `HostRevealTick` copies it into the playhead
   * inside the render loop. Zero commits, and it is a real prop rather than a
   * dev global, so it works in the shipped build. `__revealHarness` stays
   * exactly as it was for the capture scripts that drive it.
   */
  revealRef?: React.MutableRefObject<number | null>
  /**
   * THE TAKE — CONTROLLED BY THE HOST, OR OWNED HERE.
   *
   * `drawIn` and `revealWindow` used to be `useState` in this component's body,
   * and that put the user's take below the only two machines that could keep
   * it: `app/page.tsx` owns the undo stack and the persist effect. So a user
   * could author a `byLength` at 40% overlap, reload, and get the raw
   * transcript back while every style dial came back intact.
   *
   * Pass BOTH the value and the change handler and this component becomes
   * controlled — the popovers call the handler, the host writes its document,
   * and the new value arrives back as a prop. Pass NEITHER and the local state
   * below is the answer, which is what `/desk-doodles` gets: that page drives
   * the viewport's beat through `revealRef` and has no document of its own to
   * put a take in, so an unsaved local take is the correct behaviour there
   * rather than a degraded one.
   *
   * Which of the two it is, is decided by whether the prop is present and does
   * not change during a mount for either host. There is no effect mirroring one
   * into the other — that pattern is how a controlled value ends up a frame
   * behind the control the user is dragging.
   */
  drawIn?: DrawInParams
  onDrawInChange?: (patch: Partial<DrawInParams>) => void
  revealWindow?: RevealWindowParams
  onRevealWindowChange?: (patch: Partial<RevealWindowParams>) => void
  /** The four playback dials, host-controlled on the same terms as the two
   *  above. Ease, delay, loop and reverse were the only part of the take a
   *  reload threw away, because they had no name outside this file. */
  revealEnvelope?: RevealEnvelopeParams
  /** `gesture` names one drag, so a whole drag is one undo step. */
  onRevealEnvelopeChange?: (patch: Partial<RevealEnvelopeParams>, gesture?: string | null) => void
  /** ANIM-1A3 · Per-stroke timing rows, host-controlled on the same terms as
   *  `revealEnvelope`. `lib/stroke-timing.ts`. */
  take?: StrokeTimingTake
  onTakeChange?: (take: StrokeTimingTake) => void
  /** ⚠ `flatten` above has been a prop all along and the product never passed
   *  one, so it defaulted to SOLID_STATE forever and the route could only draw
   *  the last frame of the beat. This is the other half: a way to change it. */
  onFlattenChange?: (patch: Partial<FlatState>) => void
  settingsRef?: React.MutableRefObject<ExportSettings>
  /**
   * THE VIEWPORT'S IMPERATIVE SURFACE, HANDED BACK TO WHOEVER MOUNTED IT.
   *
   * Camera framing and export are the two things a parent legitimately needs to
   * drive and cannot express as props: "point at 38°/22° and fill 1.05" is an
   * ACTION, not a state the page owns, and modelling it as a prop would mean the
   * page had to track a camera it does not otherwise care about.
   *
   * It exists because PRD Family 15 (View / export presets) is exactly this
   * call and nothing else. Written on mount, cleared on unmount; `null` until
   * the dynamic chunk has loaded, which every caller must handle — the viewport
   * is `ssr: false` and arrives late by design.
   */
  apiRef?: React.MutableRefObject<ViewportApi | null>
}

/**
 * What a parent can ask the viewport to DO. Framing is camera-and-target only —
 * no geometry, material or style state is reachable through here, which is what
 * makes it safe to expose outside the dev capture fence.
 */
export interface ViewportApi {
  /** World-space bounds of the built form, or null before anything is drawn. */
  bounds: () => { center: { x: number; y: number; z: number }; radius: number } | null
  /** Front-on. Equivalent to `orbitView(0, 0, fillK)`. */
  frontView: (fillK?: number) => boolean
  /** Camera on a sphere around the form. `fillK` < 1 is closer. */
  orbitView: (azimuthDeg?: number, elevationDeg?: number, fillK?: number) => boolean
  /** Aim at an arbitrary world point at an absolute distance. */
  focusView: (
    target: { x: number; y: number; z: number },
    distance?: number,
    azimuthDeg?: number,
    elevationDeg?: number,
  ) => boolean
  /** Turntable rate in degrees per second; 0 stops. Vetoed by reduced motion. */
  setSpin: (degPerSecond: number) => void
  /** The rate actually being applied, after the reduced-motion veto. */
  effectiveSpin: () => number
  /** Data URL (PNG with alpha) of the current frame. */
  grab: () => string | null
  /** Write the GLB. Same function the Export button calls. */
  exportGLB: () => Promise<void>
  /** Write the still. Same function the PNG button calls. */
  exportPNG: () => Promise<void>
  /** Write the film. Same function the Video button calls. */
  exportVideo: () => Promise<void>
}

export default function Viewport3D(viewportProps: Viewport3DProps) {
  const { processedStrokes, rawStrokes, geometryMode, extrudeParams, solidParams, inflateParams, styleState, lighting, engineFamily = DEFAULT_ENGINE_FAMILY, flatten = SOLID_STATE, letterMap, chromeless = false, revealRef, drawIn: drawInProp, onDrawInChange, revealWindow: revealWindowProp, onRevealWindowChange, revealEnvelope: revealEnvelopeProp, onRevealEnvelopeChange, take: takeProp, onTakeChange, onFlattenChange, settingsRef, apiRef } = viewportProps
  /* Decided ONCE, at mount: R3F builds the camera from the `orthographic` prop,
   * so this may not flip during a session. It does not need to — a host either
   * drives the beat for the whole of its life or never does. */
  const [projection] = useState<"perspective" | "affine">(() => {
    if (viewportProps.projection) return viewportProps.projection
    /* DEV NEGATIVE-CONTROL HOOK — the parked prior read, reachable without a
     * host change. `assert-hero-transition.mjs --projection=perspective` sets
     * this through `page.addInitScript`, i.e. BEFORE the first render, because
     * R3F builds the camera from the `orthographic` flag exactly once. A gate
     * whose negative control cannot be driven is a gate that cannot fail. */
    if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
      const forced = (window as unknown as { __viewport3dProjection?: unknown })
        .__viewport3dProjection
      if (forced === "perspective" || forced === "affine") return forced
    }
    return viewportProps.flatten ? "affine" : "perspective"
  })
  const affine = projection === "affine"
  /* ---- L2 · THE TRANSPORT IS THE PAGE'S --------------------------------
   *
   * Play, the clock, the pace, the speed and the dock's flags live in the
   * page's `TakeTransport` store (`lib/take-transport.ts`), so the dock can
   * leave this component in L3 and read the numbers the frame loop runs on.
   * Taken once, at mount. The page's store goes back to its defaults here,
   * silently, so a viewport the error boundary remounts starts paused at 0
   * with speed 1, as it did when these were `useState`. A host with no
   * provider gets a store of its own, which is that `useState`. */
  const pageTransport = useTakeTransport()
  const [transport] = useState<TakeTransport>(() => {
    if (!pageTransport) return createTakeTransport()
    pageTransport.resetSilently()
    return pageTransport
  })
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  /* ---- 🔴 THE CANVAS THIS COMPONENT MEANS, BY IDENTITY --------------------
   *
   * `apiGrab` and the context-loss listener both used to resolve their target
   * with `containerRef.current?.querySelector("canvas")` — **the FIRST canvas in
   * document order**, which is a fact about layout and not about which canvas
   * they meant. Two things make that a defect rather than a shortcut:
   *
   *   · In `compare3Up` there are THREE canvases under this container and the
   *     selector silently means "the master". That happens to be right today,
   *     and nothing says so — a reorder of the grid makes the capture change
   *     subject with no error anywhere.
   *   · This page has a SECOND canvas of its own — `drawing-canvas.tsx`, the
   *     left half — whose container is `<div className="relative h-full
   *     w-full">`, the **byte-identical class list** to this component's. The
   *     two subtrees are indistinguishable by selector; the only thing keeping
   *     the grab on the right one is which React ref happens to be scoped here.
   *
   * `<Canvas ref>` in R3F v9 forwards to the HTMLCanvasElement itself
   * (`useImperativeHandle(ref, () => canvasRef.current)`), so the element can be
   * held directly. An instrument that resolves its subject by POSITION will
   * eventually resolve a different one, and a capture that does that writes
   * evidence under the wrong name — which is the defect class explainer 27 §6
   * names as the night's most expensive: *"is it pointed at the thing whose name
   * is on it?"*
   *
   * In 3-up the ref is attached to the MASTER only, which is the panel the
   * selector was already picking — the fix changes what the grab MEANS, not what
   * it returns. */
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const boundsRef = useRef<StrokeBounds | null>(null)
  const exportGroupRef = useRef<THREE.Group | null>(null)
  /* L2: the export name and the in-flight flags are the page transport's, so
   * L3's Export panel reads the same ones. The handlers stay here. */
  const [exporting, setExporting] = useTransportSlot(transport, "exporting")
  const [exportName, setExportName] = useTransportSlot(transport, "exportName")
  /* ---- Still export ----
   * Defaults chosen rather than inherited: 2x because 1x hands back a ~900px
   * picture of a 3-D object and nobody wants that twice, and PAPER because the
   * studio ground is part of the look the user has been judging. Both are one
   * click away in the panel. */
  const [exportingPng, setExportingPng] = useTransportSlot(transport, "exportingPng")
  const [pngScale, setPngScale] = useState(2)
  const [pngTransparent, setPngTransparent] = useState(false)
  const [pngPanelOpen, setPngPanelOpen] = useState(false)

  /* ---- The animated export ----
   *
   * Defaults, each decided rather than inherited:
   *   fps 30      — the rung every social target accepts and the one the plan's
   *                 own assertions are written at. 24 and 60 are one click away.
   *   scale 1     — a film is a hundred and forty renders, not one. 2x doubles
   *                 the pixels the encoder chews per frame and the wait with it;
   *                 the still is where resolution matters.
   *   PAPER       — because transparent is APNG (video has no alpha), and an
   *                 APNG of a long draw is enormous. The choice is offered, and
   *                 the panel says what it costs instead of hiding it.
   *   PEN timebase — the product's whole argument, and the one setting no
   *                 competitor can copy without recording the hand. `fixed` is
   *                 the canned alternative and stays one click away; the pick
   *                 between them is Sebs's and is flagged, not defaulted away.
   */
  const [exportingVideo, setExportingVideo] = useTransportSlot(transport, "exportingVideo")
  const [videoDone, setVideoDone] = useState(0)
  const [videoTotal, setVideoTotal] = useState(0)
  const [videoFps, setVideoFps] = useState(30)
  const [videoScale, setVideoScale] = useState(1)
  const [videoTransparent, setVideoTransparent] = useState(false)
  const [videoTimebase, setVideoTimebase] = useState<ExportTimebase>("pen")
  const [videoFixedSeconds, setVideoFixedSeconds] = useState(3)
  const [videoPanelOpen, setVideoPanelOpen] = useState(false)
  /* CANCELLABLE, because a 3600-frame ceiling is two minutes of file and a user
   * who started the wrong one should not have to reload the page. The recorder
   * checks the signal every frame.
   *
   * IT IS ALSO THE IN-FLIGHT TOKEN, and that is not a second job bolted onto a
   * ref — it is the same fact. Non-null exactly while an export is running,
   * cleared in the `finally` on every path (success, failure, abort), so
   * "is a film rendering right now" has ONE answer in this app and
   * `handleExportVideo`'s re-entrancy guard reads it. */
  const videoAbortRef = useRef<AbortController | null>(null)
  /* HOW MANY EXPORTS HAVE ACTUALLY STARTED. Incremented once per run, AFTER the
   * guard — so a harness can prove the guard by counting rather than by reading
   * a toast, and the count is unfakeable by the thing under test. It also names
   * the run's toast, which is what lets one toast carry a run from "about to
   * render" through the frame counter to "saved", instead of a spinner and then
   * a separate receipt. */
  const videoRunsRef = useRef(0)

  /* ---- DEV capture mode ----
   * When enabled, the viewport becomes a fixed 1920x1080 transparent render
   * target with all UI/grid hidden, so the automated video script can grab
   * clean alpha frames of the draw-in via canvas.toDataURL. Non-production
   * only; never affects geometry or the normal app render path. */
  const [captureMode, setCaptureMode] = useState(false)
  /* The timing note under the transport, folded to its verdict line by default.
   * Docked under the canvas, every line the panel spends is a line the canvas
   * loses, and the full paragraph is one click away. */
  const [timingNoteOpen, setTimingNoteOpen] = useTransportSlot(transport, "timingNoteOpen")
  const captureWidth = 1920
  const captureHeight = 1080

  /* ---- Animation state ---- */
  const playheadRef = transport.playheadRef // 0..1
  const [playing, setPlaying] = useTransportSlot(transport, "playing")
  /* The readout value. A store, not state: see `createProgressStore`. */
  const progressStore = transport.progress
  const setProgress = progressStore.set
  const progressAtEnd = useSyncExternalStore(
    progressStore.subscribe,
    () => progressStore.get() >= 1,
    () => false,
  )
  /* DEV ONLY: EMPTY THE REACT COMPONENT-TRACK BUFFER. Measured 2026-09-25,
   * night L: a take playing on loop grew the renderer about 23 MB/min in dev.
   * `onProgressUpdate` sets `progress` every frame, so the whole R3F tree
   * re-renders every frame, and R3F 9.6.1's own copy of react-reconciler 0.33
   * (dev build) writes one `performance.measure("​<Component>", {detail:
   * props diff})` per component per render and never clears it. react-dom
   * 19.2.4 clears each one right after it writes it; that copy does not.
   * Chrome keeps every entry: about 390 a second, 47,000 after two minutes.
   * The DevTools Performance panel reads these at record time, so clearing
   * the buffer loses nothing, and nothing in this app or `scripts/verify`
   * reads measures. Only the "​" component entries are cleared, by name.
   * Production builds use the production reconciler, which writes none. */
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    if (typeof performance === "undefined" || typeof performance.clearMeasures !== "function") return
    const id = window.setInterval(() => {
      const names = new Set<string>()
      for (const e of performance.getEntriesByType("measure")) if (e.name.charCodeAt(0) === 0x200b) names.add(e.name)
      names.forEach((n) => performance.clearMeasures(n))
    }, 2000)
    return () => window.clearInterval(id)
  }, [])
  const [speed, setSpeed] = useTransportSlot(transport, "speed")
  /* THE PACE IS THE DOCUMENT'S; THE OVERRIDE IS THE DIAGNOSTIC'S.
   *
   * `revealMode` used to be plain local state, which meant the compare harness
   * cycling raw -> hybrid -> smooth wrote the same value the two transport
   * pills do. The moment the pace became persistable that stopped being safe:
   * a comparison phase would have been saved as the user's take. So the two
   * pills write the document through `patchEnvelope`, and compare and the
   * debug `smooth` pill write `modeOverride`, which persists nowhere and is
   * dropped when compare exits. */
  const [modeOverride, setModeOverride] = useTransportSlot(transport, "modeOverride")
  const [hybridBlend, setHybridBlend] = useTransportSlot(transport, "hybridBlend")
  /* ---- HOW THE DRAW-IN PLAYS (PRD Phase 22) ----
   * `clockRef` is wall-clock 0..1; `playheadRef` is `easeReveal(clock)`. Every
   * reveal consumer reads the playhead, so nothing downstream has to know an
   * envelope exists. Defaults are the behaviour that shipped before these
   * controls did — linear, no delay, no loop, forwards — so an existing capture
   * script or a fresh session renders byte-identically to before. */
  const clockRef = transport.clockRef
  /* F118 TRAVEL-5, THE OPENING PASS, owned here so the harness, the export and
   * every clock write below set and read the same ref as the frame loop in
   * `Scene`. True until a looping pass wraps; `openAt` puts it back whenever a
   * clock write lands on the forward start. See `openingRef` in Scene. */
  const openingRef = transport.openingRef
  /* Host-controlled on exactly the terms `drawIn` and `revealWindow` are, and
   * for the reason those two already prove out: the local state below runs ONLY
   * when the host passed neither the value nor the handler. Everything
   * downstream still reads `revealEase` / `revealDelaySeconds` / `revealLoop` /
   * `revealReverse` and still calls the four setters, so no call site had to
   * learn which of the two is answering. */
  const [localEnvelope, setLocalEnvelope] = useState<RevealEnvelopeParams>(
    REVEAL_ENVELOPE_DEFAULTS,
  )
  const revealEnvelope = revealEnvelopeProp ?? localEnvelope
  const patchEnvelope = useCallback(
    (patch: Partial<RevealEnvelopeParams>, gesture?: string | null) => {
      if (onRevealEnvelopeChange) onRevealEnvelopeChange(patch, gesture)
      else setLocalEnvelope((e) => ({ ...e, ...patch }))
    },
    [onRevealEnvelopeChange],
  )
  /* ANIM-1A3 · THE TAKE'S PER-STROKE ROWS. Same host-or-local pattern as the
   * envelope above. `takeKnockout` is dev only: the browser gate's must-fails
   * reach the shipped code through it and nothing else. `timedInfoRef` is what
   * Scene built, so `__fsTake.get()` reports the schedule the frame loop runs
   * rather than a second build of it. */
  const [localTake, setLocalTake] = useState<StrokeTimingTake>(STROKE_TIMING_TAKE_DEFAULTS)
  const take = takeProp ?? localTake
  const setTake = useCallback(
    (next: StrokeTimingTake) => {
      if (onTakeChange) onTakeChange(next)
      else setLocalTake(next)
    },
    [onTakeChange],
  )
  const [takeKnockout, setTakeKnockout] = useState<string | null>(null)
  const timedInfoRef = useRef<TimedSchedule | null>(null)
  const [takeMs, setTakeMs] = useState<number | null>(null)
  const onTimed = useCallback((ts: TimedSchedule | null) => {
    timedInfoRef.current = ts
    setTakeMs(ts ? ts.takeMs : null)
  }, [])
  /* The mark's own presentation, host-controlled like the three above. The
   * VALUE has been a prop since the hero beat was built; only the way to change
   * it was missing, which is why `/` could render one frame of a five-frame
   * idea. No local fallback: a host that passes no handler gets the read-only
   * SOLID_STATE it always got. */
  const patchFlatten = useCallback(
    (patch: Partial<FlatState>) => { onFlattenChange?.(patch) },
    [onFlattenChange],
  )
  const revealEase = revealEnvelope.ease
  const revealDelaySeconds = revealEnvelope.delaySeconds
  const revealLoop = revealEnvelope.loop
  const revealReverse = revealEnvelope.reverse
  const revealReverseRef = useRef(revealReverse)
  revealReverseRef.current = revealReverse
  /** A clock write that lands on the forward start begins a new opening pass. */
  const openAt = useCallback((clock: number) => {
    if (!revealReverseRef.current && clock <= 1e-6) openingRef.current = true
  }, [])
  const revealCadence = revealEnvelope.cadence
  const revealMode: RevealMode = revealModeOf(modeOverride, revealEnvelope)
  /* The two transport pills only ever pass `hybrid` or `raw`, which is what
   * `RevealPace` is; the narrowing is the guard that keeps `smooth` out of the
   * document rather than a cast that hopes. */
  const setRevealMode = useCallback(
    (m: RevealMode) => {
      if (m === "smooth") setModeOverride("smooth")
      else {
        setModeOverride(null)
        patchEnvelope({ mode: m })
      }
    },
    [patchEnvelope],
  )
  /* The setters keep their old signatures, updater form included, so the eight
   * call sites in this file are untouched. */
  const setRevealEase = useCallback(
    (v: RevealEase) => patchEnvelope({ ease: v }),
    [patchEnvelope],
  )
  const setRevealDelaySeconds = useCallback(
    (v: number) => patchEnvelope({ delaySeconds: v }),
    [patchEnvelope],
  )
  const setRevealLoop = useCallback(
    (v: React.SetStateAction<boolean>) =>
      patchEnvelope({ loop: typeof v === "function" ? v(revealLoop) : v }),
    [patchEnvelope, revealLoop],
  )
  const setRevealReverse = useCallback(
    (v: React.SetStateAction<boolean>) =>
      patchEnvelope({ reverse: typeof v === "function" ? v(revealReverse) : v }),
    [patchEnvelope, revealReverse],
  )
  /* Mirrored into a ref because `__revealHarness`'s effect is keyed on
   * `totalDuration` alone, and adding the ease to its deps would tear the
   * global down and rebuild it every time the envelope changed. */
  const revealEaseRef = useRef<RevealEase>(REVEAL_ENVELOPE_DEFAULTS.ease)
  useEffect(() => {
    revealEaseRef.current = revealEase
  }, [revealEase])
  /* The Draw-in section of the Animation panel (the dock). Closed by default so
   * the canvas keeps its size until he opens it; the drawer's "Show animation
   * panel" opens it through OPEN_ANIMATION_PANEL_EVENT, since the drawer sits
   * outside this component. */
  const [drawInOpen, setDrawInOpen] = useTransportSlot(transport, "drawInOpen")
  /* ═══ `DRAW IN` — the first modifier ═══════════════════════════════════════
   *
   * `docs/animation-toolset-map.md` §8, the smallest slice that makes the
   * draw-in *"an authored decision instead of a transcript"*: order, overlap,
   * align. It lives beside Delay / Ease / Reverse / Loop because those are the
   * other four controls that shape HOW the draw-in plays and are set once for a
   * shot — and because putting it anywhere else would repeat the standing
   * failure the map names, `/desk-doodles`: *"a whole motion rig your own
   * drawing cannot reach."*
   *
   * ⚠ THE ANSWER LIVES IN `app/page.tsx` NOW, and this is the fallback for a
   * host that has nowhere to put it — see `Viewport3DProps.drawIn`. The local
   * state below runs ONLY when the host passed neither the value nor the
   * handler; when it passed both, `setLocalDrawIn` is never called and the
   * value the panel renders is always the host's. Everything downstream still
   * reads `drawIn` and writes `patchDrawIn`, so the ~40 call sites in this file
   * did not have to know which of the two is answering. */
  const [localDrawIn, setLocalDrawIn] = useState<DrawInParams>(DRAW_IN_DEFAULTS)
  const drawIn = drawInProp ?? localDrawIn
  const patchDrawIn = useCallback(
    (patch: Partial<DrawInParams>) => {
      if (onDrawInChange) onDrawInChange(patch)
      else setLocalDrawIn((d) => ({ ...d, ...patch }))
    },
    [onDrawInChange],
  )
  /* ═══ THE WINDOW — step 3 of the map's build order ═════════════════════════
   *
   * `docs/animation-toolset-map.md` §8's *"obvious second slice"*: *"make the
   * reveal a WINDOW rather than a prefix — `start` and `end` instead of one
   * `progress`, plus `travel` and a per-stroke `reverse`."* It lives in the
   * same popover as `DRAW IN` because it is the same question one layer up —
   * `DRAW IN` decides WHICH ink is where in the beat, and this decides which
   * stretch of the beat is on the page.
   *
   * Host-controlled on the same terms as `drawIn` above. */
  const [localRevealWindow, setLocalRevealWindow] = useState<RevealWindowParams>(
    REVEAL_WINDOW_DEFAULTS,
  )
  const revealWindow = revealWindowProp ?? localRevealWindow
  const patchWindow = useCallback(
    (patch: Partial<RevealWindowParams>) => {
      if (onRevealWindowChange) onRevealWindowChange(patch)
      else setLocalRevealWindow((w) => ({ ...w, ...patch }))
    },
    [onRevealWindowChange],
  )
  // Live read of whether the CURRENT strokes carry any speed variation. Drives
  // the honest note under the Natural / Authentic toggle: when the answer is
  // "none", the two settings really do render the same picture, and the panel
  // has to say so instead of leaving the user to conclude the control is dead.
  const timingCharacter = useMemo(
    () => measureTimingCharacter(processedStrokes),
    [processedStrokes],
  )
  const [comparing, setComparing] = useState(false)
  const comparePhaseRef = useRef(0) // 0=raw, 1=hybrid, 2=smooth
  const [compareLabel, setCompareLabel] = useState("")
  const [compare3Up, setCompare3Up] = useState(false)

  /* ---- A LOST GL CONTEXT ------------------------------------------------
   *
   * The failure an error boundary CANNOT see. When the driver resets, the tab
   * is backgrounded on some machines, or too many contexts are alive, Chrome
   * fires `webglcontextlost` on the canvas and stops presenting — React throws
   * nothing, the console says nothing the user will read, and the viewport is a
   * frozen rectangle for the rest of the session. Nothing in this app handled
   * it, so the whole right half simply died with no explanation.
   *
   * `preventDefault()` on the loss event is what makes a restore possible at
   * all (without it the browser will not attempt one). If the browser restores
   * on its own the overlay leaves by itself; if it does not, remounting the
   * <Canvas> under a new key builds a fresh context, which is the only reliable
   * recovery — three re-uploads its own resources but R3F's scene graph has to
   * be rebuilt from React. */
  const [contextLost, setContextLost] = useState(false)
  const [glGeneration, setGlGeneration] = useState(0)
  useEffect(() => {
    if (compare3Up) return
    /* BY IDENTITY, not by position — see `glCanvasRef`. This listener attaching
     * to the drawing canvas instead of this one would report "the viewport lost
     * its context" about the other half of the app. */
    const canvas = glCanvasRef.current
    if (!canvas) return
    const onLost = (e: Event) => {
      e.preventDefault()
      console.warn("[FreeStroke Viewport] WebGL context lost")
      setContextLost(true)
    }
    const onRestored = () => {
      console.info("[FreeStroke Viewport] WebGL context restored")
      setContextLost(false)
    }
    canvas.addEventListener("webglcontextlost", onLost)
    canvas.addEventListener("webglcontextrestored", onRestored)
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost)
      canvas.removeEventListener("webglcontextrestored", onRestored)
    }
  }, [glGeneration, compare3Up])
  /**
   * THE DEBUG SURFACE — DEV ONLY, AND THE DOOR IS GUARDED WITH THE PANEL.
   *
   * `app/page.tsx` already states this repo's convention on its own capture
   * harness: *"DEV-ONLY capture harness … Guarded to non-production"*, with
   * `if (process.env.NODE_ENV === "production") return`. This panel was outside
   * it. It renders a mono readout of stroke count, point count, duration,
   * reveal mode and the whole style substrate — internal FIELD NAMES
   * (`materialAppliedToInflate`, `activeMaterialPreset`) — over the 3-D canvas
   * in the shipped build, opened by a visible button in the transport row that
   * any user could click. It was a door, not a keyboard shortcut.
   *
   * ⚠ SO THE GUARD IS ON THE VALUE, NOT ON EACH READER. There are four
   * `showDebug &&` branches in this file (the popup, the Smooth/blend tools in
   * the transport, the Solid overlay, and the button's own pressed styling),
   * and guarding them one at a time is four chances to miss the fifth one
   * somebody adds. `showDebug` is false in production by construction; the
   * button that flips it is guarded by the same constant, so there is no
   * reachable state where the toggle exists and the panel cannot open.
   *
   * This does NOT touch `window.__captureHarness`. A window API a test drives
   * is not a panel a user sees — every gate in this repo drives that surface,
   * and `assert-harness-surface.mjs` grades what it publishes.
   */
  const debugSurfaceAllowed = process.env.NODE_ENV !== "production"
  const [debugRequested, setShowDebug] = useTransportSlot(transport, "debugRequested")
  const showDebug = debugSurfaceAllowed && debugRequested
  const meshStatusRef = useRef<StrokeBuildStatus[]>([])
  const solidStatusRef = useRef<SolidBuildStatus | null>(null)
  const extrudeDebugRef = useRef<{
    depthParam: number
    buildCount: number
    bboxZ: number
    activeEngine: GeometryMode
    /** Raw normalized slider t in [0, 1] — what the Width slider currently shows. */
    widthSliderValue: number
    /** Slider value expressed as a 0–100% reading. */
    widthSliderPercent: number
    /** Effective half-width actually consumed by the engine (after mapping + clamp). */
    effectiveWidthUsed: number
    /** Effective width expressed as a 0–100% reading of the slider envelope. */
    effectiveWidthPercent: number
    effectiveDepthUsed: number
    depthToWidthRatio: number
    /** Strategy reported by the first non-degenerate build status (proves which path ran). */
    strategy: string
    /** Build status type of the first stroke ("ok", "bevelOff", "rodFallback", ...). */
    buildStatus: string
  } | null>(null)

  /* ANIM-1A3 · ONE CLOCK. The take's length is the pen's length until a row
   * moves it; then playback, the export and the plan note all read `takeMs`.
   * `exportMs` is the same number except under the gate's `exportpen`
   * knockout, which hands the export the pen length as a known-bad. */
  const { totalDuration: penMs } = useTimeline(rawStrokes)
  /* ANIM-3B · THE KEYS. They ride the take context, which wraps this component
   * on `/`, and go into the Canvas as props because context does not cross it.
   * Keys `validateKeys` refuses are not sampled; the reasons go to the console
   * and to `__fsKeySample().refused`. Empty tracks count as no keys. With no
   * keys the length is `takeMs ?? penMs` exactly, since `keysEndMs` is 0. */
  const keysIn = useStrokeTake()?.keys
  const keyLiveRef = useStrokeTake()?.liveRef
  const keyRefusal = useMemo(() => (keysIn === undefined ? [] : validateKeys(keysIn)), [keysIn])
  const keys = keyRefusal.length === 0 && hasAnyKey(keysIn) ? keysIn : undefined
  useEffect(() => {
    if (keyRefusal.length) console.error(`ANIM-3B: the viewport refused the take's keys: ${keyRefusal.join("; ")}`)
  }, [keyRefusal])
  const { takeLen, totalDuration } = transportLengths(takeMs, penMs, keysEndMs(keys))
  const exportMs = takeKnockout === "exportpen" ? penMs : totalDuration
  const keyReader = useMemo(
    () => (keys ? makeKeyReader(playheadRef, keys, totalDuration, takeLen) : undefined),
    [keys, totalDuration, takeLen],
  )

  // Sync progress from the frame loop at ~15fps to avoid React re-render storms
  const progressUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onProgressUpdate = useCallback((p: number) => {
    // Throttled UI update
    if (progressUpdateTimerRef.current) return
    progressUpdateTimerRef.current = setTimeout(() => {
      setProgress(p)
      progressUpdateTimerRef.current = null
    }, 66) // ~15fps UI updates
  }, [])

  /* THE END-OF-PASS PAUSE MOVED OUT OF THE THROTTLED CALLBACK.
   *
   * It used to be `if (p >= 1) setPlaying(false)` inside the 66 ms throttle,
   * which was correct for exactly one configuration: forwards, no loop. Under
   * REVERSE the pass ends at 0 and that test never fires, so the transport
   * would have kept "playing" against a floor forever; under LOOP the test
   * fires on the frame the pass wraps and would have stopped the loop on its
   * first lap. Both are conditions the frame loop knows precisely and the
   * throttled UI callback cannot — so the frame loop reports the end and this
   * decides what to do about it. */
  const handleReachedEnd = useCallback(() => {
    setPlaying(false)
  }, [])

  /* `playing` mirrored into a ref for the dev harness, whose effect is keyed on
   * `totalDuration` and would otherwise report a stale value for the whole of a
   * pass — i.e. exactly the window an assertion needs to read it in. */
  const playingRef = useRef(false)
  useEffect(() => {
    playingRef.current = playing
  }, [playing])

  // Cleanup throttle timer
  useEffect(() => {
    return () => {
      if (progressUpdateTimerRef.current) clearTimeout(progressUpdateTimerRef.current)
    }
  }, [])

  /* ==================================================================== */
  /*  THE CAMERA API — ONE IMPLEMENTATION, TWO CONSUMERS                   */
  /* -------------------------------------------------------------------- */
  /*  These four framings were written for the verification scripts and    */
  /*  lived INSIDE the `process.env.NODE_ENV !== "production"` harness      */
  /*  below, which is why PRD Family 15 (View / export presets) could be    */
  /*  measured but never shipped: `resolveViewPreset` speaks exactly these  */
  /*  units — `orbitView(azimuthDeg, elevationDeg, fillK)` — and the app    */
  /*  had no way to call them. A capability that only a test can reach is   */
  /*  not a capability.                                                     */
  /*                                                                        */
  /*  They are hoisted to component scope rather than copied, so the pill   */
  /*  a user clicks and the assertion that grades it run the SAME lines.    */
  /*  A second implementation "for the app" is the defect this repo pays    */
  /*  for most often, and a framing that drifted from the one under test    */
  /*  would be invisible — both would render a plausible picture.           */
  /*                                                                        */
  /*  Every one of them touches the camera and the orbit target ONLY. No    */
  /*  geometry, no material, no style state — which is what makes exposing  */
  /*  them outside the dev fence safe.                                      */
  /* ==================================================================== */

  /** The form's world-space bounds — the CENTRE, not just the size. */
  const apiBounds = useCallback(() => {
    const b = boundsRef.current
    if (!b || b.radius <= 0) return null
    return { center: { x: b.center.x, y: b.center.y, z: b.center.z }, radius: b.radius }
  }, [])

  /** Orbit framing: camera on a sphere around the form's bounds at
   *  (azimuthDeg, elevationDeg). `orbitView(0, 0, k) === frontView(k)`. */
  const apiOrbitView = useCallback((azimuthDeg = 0, elevationDeg = 0, fillK = 1.0) => {
    const controls = controlsRef.current
    if (!controls) return false
    const bounds = boundsRef.current
    if (!bounds || bounds.radius <= 0) return false
    const dist = bounds.radius * TOP_K * fillK
    const az = (azimuthDeg * Math.PI) / 180
    const el = (elevationDeg * Math.PI) / 180
    const offset = new THREE.Vector3(
      dist * Math.sin(az) * Math.cos(el),
      dist * Math.sin(el),
      dist * Math.cos(az) * Math.cos(el),
    )
    controls.object.position.copy(bounds.center).add(offset)
    controls.target.copy(bounds.center)
    applyFraming(controls.object, dist)
    controls.update()
    return true
  }, [])

  /** Front-on framing so the mark faces the camera flat (matches the 2D
   *  drawing's orientation). Fits the bounds to the viewport. */
  const apiFrontView = useCallback((fillK = 1.0) => apiOrbitView(0, 0, fillK), [apiOrbitView])

  /** CLOSE-UP framing on an arbitrary world point at an ABSOLUTE distance —
   *  the only way to put one joint or one rim segment across the whole frame. */
  const apiFocusView = useCallback(
    (
      target: { x: number; y: number; z: number },
      distance = 0.25,
      azimuthDeg = 0,
      elevationDeg = 0,
    ) => {
      const controls = controlsRef.current
      if (!controls) return false
      const az = (azimuthDeg * Math.PI) / 180
      const el = (elevationDeg * Math.PI) / 180
      const centre = new THREE.Vector3(target.x, target.y, target.z)
      const offset = new THREE.Vector3(
        distance * Math.sin(az) * Math.cos(el),
        distance * Math.sin(el),
        distance * Math.cos(az) * Math.cos(el),
      )
      controls.object.position.copy(centre).add(offset)
      controls.target.copy(centre)
      applyFraming(controls.object, distance)
      controls.update()
      return true
    },
    [],
  )

  /** Data URL (PNG, with alpha) of the 3D canvas backing buffer. Resolved by
   *  IDENTITY — see `glCanvasRef` for why that is not a style preference. */
  const apiGrab = useCallback(() => {
    const canvas = glCanvasRef.current
    if (!canvas) return null
    return canvas.toDataURL("image/png")
  }, [])

  /**
   * WHAT THE LAST `grab()` WOULD ACTUALLY HAVE RETURNED — the element, its
   * backing-buffer size, and whether position-resolution still agrees with
   * identity-resolution.
   *
   * WHY A CAPTURE NEEDS THIS. A `toDataURL` carries no statement about its
   * subject: a PNG at the wrong size and a PNG of the wrong element are both
   * just a PNG, and a capture loop writes it under the filename it planned to
   * write. That is how seven frames of one film came back **1584×1468 instead of
   * 799×1468** and were only noticed because somebody listed the directory.
   *
   * R3F does not size its canvas synchronously with layout: it measures the
   * container with `react-use-measure` (`{scroll: true, debounce: {scroll: 50,
   * resize: 0}}`, `react-three-fiber.esm.js:42-48`) and writes the backing
   * buffer from that measurement afterwards. So `canvas.width` is an async
   * function of the layout, and there is a window in which a grab returns a
   * frame at a size the caller never asked for. The defence is not to remove the
   * window — it is to make the capture able to SAY what it got.
   *
   * `firstUnderContainer` is the diagnostic that matters: it is `true` while the
   * old position-based selector and this ref agree. A capture that ever reads
   * `false` was, before this change, silently grabbing something else.
   */
  const apiGrabInfo = useCallback(() => {
    const c = glCanvasRef.current
    if (!c) return null
    const r = c.getBoundingClientRect()
    const under = containerRef.current
    return {
      width: c.width,
      height: c.height,
      cssWidth: Math.round(r.width),
      cssHeight: Math.round(r.height),
      canvasesUnderContainer: under ? under.querySelectorAll("canvas").length : 0,
      canvasesInDocument:
        typeof document === "undefined" ? 0 : document.querySelectorAll("canvas").length,
      firstUnderContainer: under ? under.querySelector("canvas") === c : false,
    }
  }, [])

  /* ---- THE TURNTABLE ---------------------------------------------------
   *
   * `ViewCameraPatch.spinDegPerSecond` existed as a number nothing could
   * honour: `<OrbitControls>` was mounted bare, and `viewPresetBlockers()`
   * reported "Portfolio Spin" as blocked ON THIS FILE, by line number. This is
   * that line.
   *
   * DEGREES PER SECOND, NOT `autoRotateSpeed`. three's OrbitControls advances
   * `2π/60 · autoRotateSpeed` radians per second, i.e. `6 · autoRotateSpeed`
   * degrees per second, which is a unit nobody outside that file thinks in. The
   * preset says what it means — 12 °/s — and the conversion lives here, once.
   *
   * REDUCED MOTION STOPS IT. A camera that orbits by itself is decorative
   * motion with no user input, which is the clearest case the query exists for;
   * the framing still applies, the spin does not. The preference is read live
   * so a mid-session change takes effect, and the whole thing is state (not a
   * ref) because `<OrbitControls>` reads it as a prop. */
  const [spinDegPerSecond, setSpinDegPerSecond] = useState(0)
  const [reduceMotionUI, setReduceMotionUI] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduceMotionUI(mq.matches)
    const onChange = () => setReduceMotionUI(mq.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])
  const effectiveSpin = reduceMotionUI ? 0 : spinDegPerSecond

  // DEV-ONLY capture harness: lets the automated video script toggle the
  // fixed transparent 1920x1080 render target and grab an alpha PNG of the
  // current frame straight from the WebGL backing buffer (toDataURL keeps the
  // alpha channel; a page screenshot would not). Guarded to non-production.
  //
  // ⚠ THE FRAMINGS ARE NO LONGER DEFINED HERE — they are the `api*` callbacks
  // above, which the app calls too. Every key below is preserved, and each one
  // now forwards to the single implementation rather than carrying a copy.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    const w = window as unknown as Record<string, unknown>
    w.__captureHarness = {
      enable: () => setCaptureMode(true),
      disable: () => setCaptureMode(false),
      isEnabled: () => captureMode,
      size: () => ({ width: captureWidth, height: captureHeight }),
      /* WHICH PROJECTION ACTUALLY MOUNTED. Read off the live camera object, not
       * off the prop that asked for it — a control that reports the request
       * rather than the result cannot catch a control that did not take, and
       * this one is set before navigation through a window global. */
      projection: () =>
        (controlsRef.current?.object as THREE.OrthographicCamera | undefined)
          ?.isOrthographicCamera
          ? "affine"
          : "perspective",
      /* DRIVE A `FlatState` CHANNEL THE HOST DOES NOT PASS YET. `null` clears.
       * See `readFlatOverride` — this is how `shadow`, `squashX` and `squashY`
       * are proven to render before the page carries them, so neither joins the
       * dead-parameter class that has already been found twice in this beat.
       *
       * Returns false on a key that is not on `FlatState`, or on a value of the
       * wrong kind for its key, so a sweep cannot silently measure an arm that
       * set nothing — which is exactly how `{flat: 0}` became a published
       * verdict in explainer 24's ruled-out table, and how two of that table's
       * twelve rows came to report "not it" about a path they never touched.
       * The two neighbours below already worked this way and this one skipped
       * the lesson. See `isValidFlatState`; it refuses the object WHOLE, never
       * a subset, because a half-applied arm is an arm nobody can attribute. */
      setFlatten: (o: Partial<FlatState> | null) => {
        if (readFlattenValidates() && !isValidFlatState(o)) return false
        setFlatOverride(o)
        return true
      },
      /* 🔴 THE PRE-FIX SETTER, PARKED — see `setFlattenValidates`. `false`
       * restores `return true` for anything, which is the code that published
       * two rows of explainer 24's ruled-out table. `assert-stroke-schedule`
       * §14 arms it inline, requires the defect to reproduce, and disarms — so
       * the negative control runs on the BARE invocation rather than behind a
       * flag no sweep passes (explainer 31 §1). */
      setFlattenValidates: (on: boolean) => setFlattenValidates(on),
      flattenValidates: () => readFlattenValidates(),
      /* 🔴 THE ONE SETTER ON THIS OBJECT THAT HAD NO READER — and it is the
       * most-driven member of the whole harness.
       *
       * Counted by parsing this literal: eighteen `set*` members, seventeen of
       * which have a paired reader whose name is derivable from theirs
       * (`setPenTip`/`penTip`, `setCarveAA`/`carveAA`, `setSpin`/`getSpin`, …).
       * `setFlatten` was the exception, so nothing could ask the page what the
       * flat override currently IS — only what it had just been told. A sweep
       * therefore cannot snapshot this channel, and `snapshot()` below would be
       * a snapshot with a hole in it exactly where the hole does most damage.
       * See `readFlatOverride`; `null` means no override, which is the same
       * value `setFlatten(null)` restores. */
      flatten: () => readFlatOverride(),
      /* WHICH END THE PEN LEAVES. See `applyPenTip` — four shapes, all live,
       * `off` being the parked prior (`setDrawRange`'s raw per-triangle
       * boundary) rather than a synonym for `cut`. Returns false on an unknown
       * name so a sweep cannot silently measure the same arm four times, which
       * is exactly how an OFAT sweep reports four identical frames as four
       * options. */
      setPenTip: (m: PenTipMode) => setPenTipMode(m),
      penTip: () => readPenTipMode(),
      /* THE SHAPE ITSELF, in nib half-widths — the instrument `quill`'s taper
       * numbers were solved and then CHECKED with. `null` clears back to the
       * named shape. Returns false on anything that is not two finite
       * non-negative numbers, so a sweep cannot capture one arm twice under two
       * labels. See `setPenTipShapeOverride` in lib/pen-reveal.ts. */
      setPenTipShape: (s: PenTipShape | null) => setPenTipShapeOverride(s),
      penTipShape: () => readPenTipShape(readPenTipMode()),
      penTipShapeOverride: () => readPenTipShapeOverride(),
      /* THE TIP'S ANTIALIASING. `setTipAA(false)` restores the divisor that
       * shipped — the screen size of one local unit — which stretches the
       * coverage ramp by sqrt(1 + taper^2) and is what turned a long taper into
       * loose specks. It is the negative control the speck probe requires to
       * FAIL. See `PEN_TIP_AA_FWIDTH`. */
      setTipAA: (on: boolean) => setTipAA(on),
      tipAA: () => readTipAA(),
      /* 🔴 THE SCHEDULE'S SECOND CONSUMER, PARKED AS A RENDER.
       * `setTipRidesSchedule(false)` leaves the tip field's `arc` channel in the
       * RECORDING's coordinates while the keys and the playhead have moved to
       * the BEAT's — the map's own red-flagged trap, reproduced exactly. It is
       * the known-bad `assert-stroke-schedule.mjs` requires to FAIL, and it is
       * inert at the identity schedule by construction, which is itself a row.
       * See `TIP_RIDES_SCHEDULE`. */
      setTipRidesSchedule: (on: boolean) => setTipRidesSchedule(on),
      tipRidesSchedule: () => readTipRidesSchedule(),
      /* 🔴 THE WINDOW'S SECOND EDGE, PARKED AS A RENDER.
       * `setTipTrailsWindow(false)` leaves the fragment test one-sided: the
       * leading nose still rides the schedule and the TRAILING boundary falls
       * back to the raw per-triangle `setDrawRange` chop — faceted, on the edge
       * `travel` puts in the middle of the mark. A separate known-bad from the
       * one above because it fails on a separate edge, which is exactly what
       * "a window has the trap twice" means. See `TIP_TRAILS_WINDOW`. */
      setTipTrailsWindow: (on: boolean) => setTipTrailsWindow(on),
      tipTrailsWindow: () => readTipTrailsWindow(),
      /* 🔴 AND THE THIRD: IS THE FIELD BAKED THROUGH THE SCHEDULE, OR REMAPPED
       * AFTER IT? `setTipFieldBake(false)` restores step 2's shipped path,
       * which takes the minimum over coverers in the RECORDING's arcs and
       * remaps the answer. That is exact for every schedule step 2 could
       * produce and wrong under a REVERSE, because `min` and a remap commute
       * only while the remap is increasing. See `TIP_FIELD_SCHEDULE_BAKE`. */
      setTipFieldBake: (on: boolean) => setTipFieldBake(on),
      tipFieldBake: () => readTipFieldBake(),
      /* THE CARVE'S ANTIALIASING DIVISOR — the same pair, for the same reason,
       * on the other fragment test. `setCarveAA(false)` restores the divisor
       * that shipped (the screen size of one LOCAL UNIT), which is what makes
       * the `letterByLetter` stipple at 7.36 s a RENDER rather than an argument.
       *
       * ⚠ THE CORRECTION BELOW WENT STALE IN FIVE MINUTES, AND A CORRECTION
       * THAT GOES STALE IS INDISTINGUISHABLE FROM THE ERROR IT CORRECTED.
       * Kept, because deleting it would lose the reason this line is watched.
       *
       *   > CITATION CORRECTED 2026-08-04. This named `assert-carve-graze.mjs`
       *   > as the gate whose negative control it is. **That file has never
       *   > existed** — the same class as `assert-hero-letters.mjs`, which was
       *   > cited from three call sites and was never written. The instrument
       *   > that DOES exist is `scripts/verify/_probe-carve-graze.mjs`, and it
       *   > is a probe, not a gate: it films the arms and reports, it does not
       *   > pass or fail. So this control is currently UNGATED, and saying so is
       *   > the point of the correction — `assert-citations.mjs` runs green over
       *   > this line, so nothing in the repo was checking that a cited gate is
       *   > a file.
       *
       * ⚠ BOTH HALVES OF THAT ARE NOW FALSE, AND WERE FALSE FIVE MINUTES AFTER
       * IT WAS WRITTEN. It was true at 21:29 on 2026-08-04 and the file landed
       * at **21:34** the same evening. Checked first-hand on 2026-08-07:
       * `scripts/verify/assert-carve-graze.mjs` exists (12 188 bytes, mtime
       * 2026-08-04 21:34), it is listed in `docs/README.md`, both batteries
       * pick it up off the directory walk, and it takes its URL from
       * `lib/dev-server.mjs` — so it is one of the thirteen browser gates
       * explainer 27 §1 measured as unable to grade the wrong tree.
       *
       * It is not merely present, it WORKS. Run bare on 2026-08-07 against this
       * tree (`FS_PORT=3114`): **9 rows, ALL PASS, exit 0** — measured here, not
       * quoted. Its first row is *"the film pill is CLICKED, not injected"* and
       * its second and third assert both AA arms actually TOOK, so it is not a
       * gate that could pass by doing nothing.
       *
       * Its FALSIFICATION is cited rather than re-run, and the distinction is
       * the point of this note: a second lane mutation-tested it (blind arms →
       * exit 1; swapped arms → exit 1 on 6 of 6) and reproduced this file's own
       * 2026-08-04 header table bit-identically on a different bundler five days
       * later. **This pass did not re-run those mutants.** So the sentence *"this
       * control is currently UNGATED"* should read that the gate exists and
       * passes — measured — and can fail — cited.
       *
       * That is worth more than a typo fix, because the stale note is itself an
       * instance of the class it was written about: it currently tells a reader
       * a working control is missing, **which is how a green gate gets rebuilt
       * by someone who believed a comment.** A correction carries the date it
       * was true, or it is just an assertion with a warning sign on it.
       *
       * Re-shot on this build (`docs/verification/letter-seam-picture/`
       * `cascade-after/graze/zoom-074.png`, the `sk` mid-flip at t = 7.40 s at
       * 4×) the cross-hatch does NOT reproduce: the sliver is solid, and the one
       * white pixel in it is the `k`'s own counter seen edge-on. Explainer 22 §7
       * reached the same result independently and said plainly that it could not
       * attribute the closure to itself. Neither can this pass.
       *
       * See `PEN_CARVE_AA_FWIDTH`. */
      setCarveAA: (on: boolean) => setCarveAA(on),
      carveAA: () => readCarveAA(),
      /* WHOLE-TRIANGLE LETTER OWNERSHIP. `setLetterWholeTriangles(false)`
       * restores the per-vertex stamp that shipped, which is what re-renders the
       * flat grey shards Sebs photographed on `letterByLetter` at SOLID 57 %,
       * and it is the negative control `assert-letter-seam.mjs` requires to
       * FAIL. See `LETTER_WHOLE_TRIANGLES`. It takes on the next BUILD, not the
       * next frame — the stamp is baked into the geometry — so a sweep must move
       * a dial that rebuilds (the film pill, the ink weight) after setting it. */
      setLetterWholeTriangles: (on: boolean) => setLetterWholeTriangles(on),
      letterWholeTriangles: () => readLetterWholeTriangles(),
      /* THE BLANK TAIL'S TWO HALVES, PARKED AS ONE PAIR.
       *
       * `setLetterStampFollowsRefill(false)` stops the frame loop re-stamping
       * `aFsLetter` after a worker refills the geometry in place;
       * `setRefillDropsStaleAttrs(false)` lets the stale attribute survive that
       * refill. BOTH off is the behaviour that shipped, and it re-renders the
       * defect exactly: `position` grows past `aFsLetter`, WebGL rejects the
       * draw against the short attribute, and the driver drops the WHOLE call —
       * the entire mark gone from DRAW 93.75 % to the end of the beat, at full
       * opacity, with 335 820 valid indices submitted.
       *
       * It is the known-bad `scripts/verify/assert-drawin-attrs.mjs` requires to
       * FAIL. Neither takes on a frame: the mismatch is only CREATED by a
       * rebuild, so a sweep must move a dial that rebuilds (wobble, endpoint)
       * after setting them — which is the whole point of a gate that drives the
       * dials rather than one that loads a page.
       * See `LETTER_STAMP_FOLLOWS_REFILL` and
       * `IMPLICIT_REFILL_DROPS_STALE_ATTRS` in lib/geometry-engines.ts. */
      setLetterStampFollowsRefill: (on: boolean) => setLetterStampFollowsRefill(on),
      letterStampFollowsRefill: () => readLetterStampFollowsRefill(),
      setRefillDropsStaleAttrs: (on: boolean) => setRefillDropsStaleAttrs(on),
      refillDropsStaleAttrs: () => readRefillDropsStaleAttrs(),
      /* WHOSE AXIS A LANDED LETTER TURNS ABOUT. `setLetterSettle(false)` pins
       * every letter to its OWN centre, which is the pose that shipped before
       * 2026-08-04 and is the one that leaves a white crack through the `e|sk`,
       * the `d|l` and the `e|s` joins for the whole 2.2 s solid hold — whole
       * triangles removed the grey slabs that had been covering that gap, they
       * did not close it. It is the negative control `assert-letter-seam.mjs`
       * requires to FAIL. A UNIFORM write, so unlike `setLetterWholeTriangles`
       * it takes on the next FRAME and needs no rebuild.
       * See `LETTER_SETTLE_TO_WORD` and `LetterState.settle`. */
      setLetterSettle: (on: boolean) => setLetterSettleToWord(on),
      letterSettle: () => readLetterSettleToWord(),
      /* THE AXES THEMSELVES, AS THE GPU WILL SEE THEM THIS FRAME — per-letter
       * pivot x, plus the word's. `assert-letter-seam.mjs` turns these into the
       * seam claim directly: two letters at one yaw MUST share a pivot, which is
       * exact, needs no raster, and is the invariant the triangle census could
       * not state. */
      letterPivots: () => liveLetterAxes,
      letterSeam: () => (window as unknown as { __letterSeam?: unknown }).__letterSeam ?? null,
      /* THE CARVE'S ENVELOPE, in nib radii — see `PEN_CARVE_ENVELOPE_R`. This
       * is what makes the parked prior a RENDER: `setCarveEnvelope(1.35)`
       * reproduces the shipped eraser exactly, which is the negative control the
       * fix's gate requires to fail. Returns false on a non-finite or
       * non-positive value, the same rule `setPenTip` follows and for the same
       * reason — a sweep that silently accepted a bad argument would capture one
       * arm twice and report it as two. */
      setCarveEnvelope: (r: number) => setCarveEnvelopeR(r),
      carveEnvelope: () => readCarveEnvelopeR(),
      /* THE CARVE'S OWN ARITHMETIC, READ OFF THE GPU. `setCarveDebug(n)` swaps
       * the frame for a 16-bit packing of one intermediate (see
       * `PenCarveUniforms.dbg`); `setCarveHard(true)` swaps the antialiased
       * coverage for the hard `sd <= 0` the CPU probe uses. They exist because
       * the CPU rasterisation of the SAME field at the SAME amplitude reads a
       * solid word while the GPU renders fragments, and no amount of reasoning
       * about that gap is a measurement of it. */
      setCarveDebug: (n: number) => setCarveDebug(n),
      setCarveHard: (on: boolean) => setCarveHard(on),
      carveDebug: () => ({ dbg: liveCarveDebug, hard: liveCarveHard }),
      /* THE ERASER, PARKED AS A RENDER. `setFieldRealloc(false)` restores the
       * shipped behaviour — reuse the `DataTexture` object across a size change
       * — which three r175's immutable `texStorage2D` turns into a lookup that
       * scans the wrong rectangle. It is the negative control the fix's gate
       * requires to FAIL, and it is the arm every frame captured before today
       * was rendered under. See the block at `setFieldRealloc`. */
      setFieldRealloc: (on: boolean) => setFieldRealloc(on),
      fieldRealloc: () => readFieldRealloc(),
      // The form's world-space bounds — the CENTRE, not just the size.
      //
      // WHY THIS EXISTS. `focusView` below takes a world-space target and is
      // the only way to frame a LOCAL defect (one joint, one rim segment).
      // Nothing exposed the centre, so a verification script had no legitimate
      // source for that argument. The gloss-rim capture worked around it by
      // calling orbitView with a small fill factor instead — which does not
      // move the target, it moves the camera INSIDE the bounding sphere, and
      // every `closeup_*.png` it wrote is blank white. Those blanks sit in
      // docs/verification looking exactly like evidence.
      //
      // A missing accessor turned into fabricated evidence, so the accessor is
      // the fix: `focusView(h.bounds().center, 0.2, az, el)` frames a real
      // point. Read-only; touches no camera, geometry or style state.
      bounds: apiBounds,
      // Front-on framing so the word faces the camera flat (matches the 2D
      // logo orientation for the card-flip). Fits the bounds to the viewport.
      frontView: apiFrontView,
      // Orbit framing for the capture scripts: positions the camera on a
      // sphere around the word's bounds at (azimuthDeg, elevationDeg), same
      // distance model as frontView. orbitView(0, 0, k) === frontView(k), so
      // the stand-up camera move can start exactly where the flat framing
      // ends and sweep to the ¾ hold. Camera/controls only — no geometry,
      // material, or style state is touched.
      orbitView: apiOrbitView,
      // CLOSE-UP framing. orbitView always aims at the whole form's bounding
      // centre, which is useless for judging a LOCAL defect (rim shading on one
      // edge, faceting through one tight curve) — you can only pull the whole
      // word closer, and the interesting millimetre stays 40 pixels wide.
      // focusView aims the orbit target at an arbitrary world point and sets an
      // absolute camera distance, so a verification script can put one curve or
      // one rim segment across the whole frame. Camera/controls only: no
      // geometry, material or style state is touched, exactly like orbitView.
      focusView: apiFocusView,
      // Returns the data URL (PNG, with alpha) of the 3D canvas backing buffer.
      grab: apiGrab,
      /* 🔴 WHAT THAT GRAB WAS OF. A capture cannot check its own subject from a
       * PNG — a frame of the wrong element and a frame at the wrong size are
       * both just a frame, written under the name the loop planned. See
       * `apiGrabInfo`; `firstUnderContainer` is the row that says whether the
       * old position-based selector and the ref still agree. */
      grabInfo: apiGrabInfo,
      /* THE TURNTABLE, DRIVABLE. Degrees per second; 0 stops it. Exposed here
       * as well as on the app API so an assertion can film the spin and its
       * OFF control through the same setter the "Portfolio Spin" pill uses. */
      setSpin: (degPerSecond: number) => {
        setSpinDegPerSecond(Number.isFinite(degPerSecond) ? Math.max(0, degPerSecond) : 0)
        return true
      },
      getSpin: () => spinDegPerSecond,
      /* WHAT THE SPIN IS ACTUALLY DOING, after the reduced-motion veto. A
       * control that reports the REQUEST rather than the RESULT cannot catch a
       * request that was refused — the same rule `projection` above follows. */
      effectiveSpin: () => effectiveSpin,
      /**
       * 🔴 EVERY DIAL THIS HARNESS OWNS, AS IT IS RIGHT NOW — so a teardown can
       * put back what was there instead of naming a value it hopes was there.
       *
       * ── THE DEFECT THIS EXISTS TO KILL ────────────────────────────────────
       * Lane W found four teardowns in `_probe-lane3-blank-tail.mjs` restoring
       * `setPenTip("reed")`. `reed` is a NAMED value, not the value that
       * shipped, so arms 4-8 ran one channel off `reed` — which is not OFAT,
       * and nothing said so, because a teardown that restores the wrong value
       * and a teardown that restores the right one print the same nothing.
       *
       * The fix everybody reaches for is "tell each file to restore the right
       * literal." That is sixteen more chances to get it wrong, and it expires
       * the day a default moves. Measured on this tree by parsing: **17 files
       * under `scripts/verify/` drive a paired dial to a hardcoded literal, and
       * 6 of them never call that dial's own reader at all.** The discipline is
       * not missing — eleven of the seventeen DO read a getter — it is just
       * hand-rolled once per file, one dial at a time, so it is complete
       * nowhere.
       *
       * So the harness hands back its own prior state and the guess becomes
       * unnecessary. Sebs's shape, not a new one: this file already pairs every
       * setter with a reader; `snapshot()` is only the sixteen of them at once,
       * in one round trip across `page.evaluate`.
       *
       * ── WHAT IS *NOT* IN IT, SAID OUT LOUD ────────────────────────────────
       * The CAMERA (`orbitView` / `focusView` write a pose nothing on this
       * object can read back) and the PLAYHEAD (owned by the page, not by this
       * harness). A snapshot that quietly claimed to cover those would be the
       * defect it is fixing, one level up — explainer 39's fourth axis is "a
       * dial the harness does not own", and these are two of them. Anything
       * restoring a pose must still re-drive it explicitly.
       *
       * JSON-safe by construction: every value is a boolean, a number, a string
       * or a plain object, because it crosses a `page.evaluate` boundary.
       */
      snapshot: () => ({
        v: 1,
        captureMode,
        flatten: readFlatOverride(),
        flattenValidates: readFlattenValidates(),
        penTip: readPenTipMode(),
        penTipShapeOverride: readPenTipShapeOverride(),
        tipAA: readTipAA(),
        tipRidesSchedule: readTipRidesSchedule(),
        tipTrailsWindow: readTipTrailsWindow(),
        tipFieldBake: readTipFieldBake(),
        carveAA: readCarveAA(),
        carveEnvelope: readCarveEnvelopeR(),
        carveDebug: liveCarveDebug,
        carveHard: liveCarveHard,
        letterWholeTriangles: readLetterWholeTriangles(),
        letterStampFollowsRefill: readLetterStampFollowsRefill(),
        refillDropsStaleAttrs: readRefillDropsStaleAttrs(),
        letterSettle: readLetterSettleToWord(),
        fieldRealloc: readFieldRealloc(),
        spin: spinDegPerSecond,
      }),
      /**
       * PUT BACK EXACTLY WHAT `snapshot()` HANDED YOU.
       *
       * A VALIDATING DRIVER, and the validation is the point: it returns
       * `false` if the argument is not a v1 snapshot, or if ANY single channel
       * refused. A teardown that half-applied would leave the sweep off-state
       * while reporting success, which is the same silence `setPenTip("reed")`
       * had. Every channel below returns a boolean already — none of this is a
       * new contract, it is the seventeen existing ones read in one place.
       *
       * `flattenValidates` is restored LAST on purpose: it decides whether the
       * `flatten` restore above it is checked at all, so restoring it first
       * would let a snapshot taken with the parked prior armed silently change
       * how its own restore was validated.
       *
       * Missing keys are SKIPPED, not defaulted — a `v1` snapshot from an older
       * build lacking a channel must not silently drive that channel to
       * `undefined`. A key present and refused is a failure; a key absent is
       * not a value.
       */
      restore: (s: Record<string, unknown> | null): boolean => {
        if (!s || typeof s !== "object" || s.v !== 1) return false
        let ok = true
        const grade = (name: string, took: boolean) => {
          if (took) return
          ok = false
          // Loud, because a silent half-restore is the defect this replaces.
          console.error(`🔴 __captureHarness.restore: "${name}" REFUSED — the sweep after this point is off-state`)
        }
        const hasKey = (k: string) => Object.prototype.hasOwnProperty.call(s, k)
        if (hasKey("captureMode")) setCaptureMode(!!s.captureMode)
        if (hasKey("flatten")) {
          const o = s.flatten as Partial<FlatState> | null
          if (readFlattenValidates() && !isValidFlatState(o)) grade("flatten", false)
          else setFlatOverride(o)
        }
        if (hasKey("penTip")) grade("penTip", setPenTipMode(s.penTip as PenTipMode))
        if (hasKey("penTipShapeOverride")) grade("penTipShape", setPenTipShapeOverride(s.penTipShapeOverride as PenTipShape | null))
        if (hasKey("tipAA")) grade("tipAA", setTipAA(!!s.tipAA))
        if (hasKey("tipRidesSchedule")) grade("tipRidesSchedule", setTipRidesSchedule(!!s.tipRidesSchedule))
        if (hasKey("tipTrailsWindow")) grade("tipTrailsWindow", setTipTrailsWindow(!!s.tipTrailsWindow))
        if (hasKey("tipFieldBake")) grade("tipFieldBake", setTipFieldBake(!!s.tipFieldBake))
        if (hasKey("carveAA")) grade("carveAA", setCarveAA(!!s.carveAA))
        if (hasKey("carveEnvelope")) grade("carveEnvelope", setCarveEnvelopeR(Number(s.carveEnvelope)))
        if (hasKey("carveDebug")) grade("carveDebug", setCarveDebug(Number(s.carveDebug)))
        if (hasKey("carveHard")) grade("carveHard", setCarveHard(!!s.carveHard))
        if (hasKey("letterWholeTriangles")) grade("letterWholeTriangles", setLetterWholeTriangles(!!s.letterWholeTriangles))
        if (hasKey("letterStampFollowsRefill")) grade("letterStampFollowsRefill", setLetterStampFollowsRefill(!!s.letterStampFollowsRefill))
        if (hasKey("refillDropsStaleAttrs")) grade("refillDropsStaleAttrs", setRefillDropsStaleAttrs(!!s.refillDropsStaleAttrs))
        if (hasKey("letterSettle")) grade("letterSettle", setLetterSettleToWord(!!s.letterSettle))
        if (hasKey("fieldRealloc")) grade("fieldRealloc", setFieldRealloc(!!s.fieldRealloc))
        if (hasKey("spin")) setSpinDegPerSecond(Number.isFinite(Number(s.spin)) ? Math.max(0, Number(s.spin)) : 0)
        if (hasKey("flattenValidates")) grade("flattenValidates", setFlattenValidates(!!s.flattenValidates))
        return ok
      },
    }
    return () => {
      delete w.__captureHarness
    }
  }, [
    captureMode,
    apiBounds,
    apiFrontView,
    apiOrbitView,
    apiFocusView,
    apiGrab,
    apiGrabInfo,
    spinDegPerSecond,
    effectiveSpin,
  ])

  /* Reset animation when strokes are cleared or undone.
   *
   * ── WHY IT STARTS AT −1 AND NOT AT THE CURRENT COUNT ──────────────────────
   * Seeded with `processedStrokes.length`, the FIRST run of this effect always
   * measured "no change" and neither branch fired — which is fine when the app
   * boots empty, and wrong the moment it does not. The viewport is a dynamic
   * import, so on a reload with a restored drawing this component mounts AFTER
   * the strokes are already there: the count it seeds itself with is the
   * restored count, "the count went up" never fires, and the playhead stays at
   * 0. The drawing is fully restored, the geometry is built, and the 3-D half
   * of the app is blank until the user finds Play — measured at 11,656 bytes of
   * PNG against 70,723 for the same scene revealed (16.5 %).
   *
   * `-1` is below every reachable count including zero, so the first run always
   * takes a branch, and `newCount === 0` still wins on an empty canvas because
   * it is tested first — an empty restore resets to 0 exactly as before.
   * (`assert-data-safety.mjs` §3.8b is the gate.)
   *
   * ── AND THE PRIOR IS PARKED, BECAUSE FIXING IT BROKE THE GATE'S CONTROL ───
   * §3.8b's negative control works by measuring the blank stage against the
   * revealed one. With this fixed the blank stage is unreachable, so the
   * control compared the same picture with itself and reported 1.00x — a row
   * that cannot fail. `window.__fsRevealSeed = "prior"`, set before navigation,
   * restores the old seed so the defect can be reproduced on demand and the
   * control has an arm to go red on. Production always gets the fix. */
  const prevStrokeCountRef = useRef(
    readDevLaw("__fsRevealSeed", ["prior"], "fresh") === "prior" ? processedStrokes.length : -1,
  )
  /* ⚠ THE WINDOW, READ WITHOUT BECOMING A DEPENDENCY.
   *
   * The effect below must pin the playhead when the STROKE COUNT changes and at
   * no other time. Putting `revealWindow` in its dependency list would re-run
   * the pin every time the user touched the mode pills, yanking the playhead out
   * from under a scrub. Written during render, the way `Scene` already mirrors
   * the same value at `windowParamsRef`. */
  /* F118: THE WINDOW THE FRAME LOOP RUNS. `Scene` decides `seamless` from the
   * same three inputs through the same function; the harness, the rest playhead
   * and the export ends read this one. */
  const seamWindow = useMemo(
    () => seamWindowOf(revealWindow, { loop: revealLoop, delaySeconds: revealDelaySeconds }),
    [revealWindow, revealLoop, revealDelaySeconds],
  )
  const revealWindowRef = useRef<RevealWindowParams>(seamWindow)
  revealWindowRef.current = seamWindow
  /* L2 · WHAT THE TRANSPORT DERIVES, for readers outside this component. This
   * component reads its own render's values; the publish runs after the
   * commit, before paint, so a panel in L3 shows the same numbers on the same
   * frame. The store drops a publish that changes nothing. */
  useLayoutEffect(() => {
    transport.publishDerived({ totalDuration, takeLen, revealEase, revealMode, seamWindow })
  }, [transport, totalDuration, takeLen, revealEase, revealMode, seamWindow])
  useEffect(() => {
    const prevCount = prevStrokeCountRef.current
    const newCount = processedStrokes.length
    /* WHERE "SHOW IT FULLY" IS, WHICH IS NOT ALWAYS 1.
     *
     * This rule was written when `grow` was the only window, and for `grow` the
     * finished mark IS playhead 1. It is not for the other three: at playhead 1
     * `travel`, `vanish` and `shrink` all resolve to an EMPTY interval, which is
     * correct for the mode and is what the end of their beat looks like.
     *
     * It became reachable on BOOT the moment `revealWindow` started surviving a
     * reload (`lib/doc-store.ts`). Measured before this line existed: with a
     * stored `travel`, `vanish` or `shrink` take, a reload restored the mode
     * correctly and then opened on nothing — 66,590 B of PNG for all three
     * against 139,490 B for `grow`, byte-identical to each other because all
     * three were the same empty stage.
     *
     * So the instant is DERIVED from the window rather than assumed:
     *   grow    1              [0, 1] — the whole mark. Unchanged, exactly.
     *   vanish  0              [0, 1] — the ink has not started leaving yet.
     *   shrink  0              [0, 1] — nothing has been erased yet.
     *   travel  1 / (1 + L)    [1 − L, 1] — the leading edge just reached the
     *                          end. `travel` never shows the whole mark by
     *                          design, so this is as finished as it gets.
     *   seamless travel  1   [1 − L, 1] — the wrapped pass's own end.
     * The table is `restPlayheadFor` in `lib/stroke-schedule.ts`, read off the
     * window the frame loop runs, so the two cannot drift. */
    const full = restPlayheadFor(revealWindowRef.current)

    if (newCount < prevCount || newCount === 0) {
      // Undo or Clear happened
      setPlaying(false)
      playheadRef.current = newCount === 0 ? 0 : full
      clockRef.current = newCount === 0 ? 0 : full
      openAt(clockRef.current)
      setProgress(newCount === 0 ? 0 : full)
    } else if (newCount > prevCount) {
      // New stroke added — show fully
      playheadRef.current = full
      clockRef.current = full
      setProgress(full)
    }

    prevStrokeCountRef.current = newCount
  }, [processedStrokes.length])

  // Compare mode: auto-cycle through Raw -> Hybrid -> Smooth
  const COMPARE_MODES: RevealMode[] = ["raw", "hybrid", "smooth"]
  const COMPARE_LABELS = ["RAW", `HYBRID (blend=${hybridBlend.toFixed(2)})`, "SMOOTH"]

  useEffect(() => {
    if (!comparing) return
    // When playback finishes (progress >= 1 and not playing), advance phase
    if (progressAtEnd && !playing) {
      const nextPhase = (comparePhaseRef.current + 1) % 3
      comparePhaseRef.current = nextPhase
      setModeOverride(COMPARE_MODES[nextPhase])
      setCompareLabel(COMPARE_LABELS[nextPhase])
      // Small delay so the mode switch is visible before replay starts
      const timer = setTimeout(() => {
        playheadRef.current = 0
        clockRef.current = 0
        openAt(0)
        setProgress(0)
        setPlaying(true)
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [comparing, progressAtEnd, playing, hybridBlend])

  const handleCompareToggle = useCallback(() => {
    setComparing((prev) => {
      if (!prev) {
        // Enter compare: start at phase 0 (raw)
        comparePhaseRef.current = 0
        setModeOverride("raw")
        setCompareLabel("RAW")
        playheadRef.current = 0
        clockRef.current = 0
        openAt(0)
        setProgress(0)
        setPlaying(true)
        return true
      }
      // Exit compare: stop playback, restore manual control
      setPlaying(false)
      setCompareLabel("")
      /* Hand the pace back to the document. Without this, leaving compare left
       * the mark on whatever phase it stopped on, and the two pills disagreed
       * with the ink. */
      setModeOverride(null)
      return false
    })
  }, [])

  const handlePlayPause = useCallback(() => {
    setPlaying((prev) => {
      if (!prev) {
        /* IF AT THE END, RESTART FROM THE BEGINNING — and under REVERSE the
         * "beginning" is 1, not 0. Pressing Play on a finished reverse pass
         * used to have no beginning to go back to, so it would have sat at 0
         * doing nothing and read as a dead button. */
        if (revealReverse ? playheadRef.current <= 0 : playheadRef.current >= 1) {
          const start = revealReverse ? 1 : 0
          playheadRef.current = start
          clockRef.current = start
          openAt(start)
          setProgress(start)
        }
        // Reset Solid animation debug counters at the start of every
        // playback session so the panel reflects THIS reveal, not the
        // accumulated total since page load.
      SOLID_ANIM_DEBUG.topologyChangeCount = 0
      SOLID_ANIM_DEBUG.solidAnimationRebuildCount = 0
      // Sticky-final-hole-contour strategy: reset per-session state so the
      // panel reflects THIS reveal, not the accumulated total since page load.
      SOLID_ANIM_DEBUG.finalFrameHoleMatch = "NO"
      SOLID_ANIM_DEBUG.usingFinalHoleContoursForAnimation = "NO"
      SOLID_ANIM_DEBUG.activeHoleIds = []
      SOLID_ANIM_DEBUG.pendingHoleCount = 0
      SOLID_ANIM_DEBUG.holeActivationProgress = []
      SOLID_ANIM_DEBUG.animatedActiveHoleCount = 0
      SOLID_ANIM_DEBUG.solidAnimationHoleMode = "STICKY_FINAL_HOLE_CONTOURS"
      SOLID_ANIM_DEBUG.holeSourceDuringAnimation =
        "FINAL_STATIC_FOR_ACTIVE_NONE_OTHERWISE"
      // The Play-start sync layout effect (above) ensures the first paint
      // happens with the playhead at 0. Stamp the flag here so the panel
      // confirms there was no full-mesh flash before the reveal.
      SOLID_ANIM_DEBUG.firstFrameResetClean = "YES"
        return true
      }
      return false
    })
  }, [revealReverse])

  /* SCRUBBING SETS THE PLAYHEAD, SO IT HAS TO SET THE CLOCK BEHIND IT.
   *
   * Without the inverse, dragging to 0.5 under an ease left the clock wherever
   * playback had abandoned it, and the next frame of Play snapped the mark back
   * to `ease(that clock)` — the playhead visibly jumping the instant you let go.
   * `unEaseReveal` recovers the wall-clock position that produces the playhead
   * the user actually dragged to, so resuming continues from where they put it. */
  const handleScrub = useCallback(
    (value: number) => {
      playheadRef.current = value
      clockRef.current = unEaseReveal(value, revealEase)
      openAt(clockRef.current)
      setProgress(value)
    },
    [revealEase, openAt],
  )

  /* CHANGING THE ENVELOPE MUST NOT TELEPORT THE MARK. Re-deriving the clock
   * from the playhead the viewer is looking at means switching Linear → Ease
   * out mid-pause leaves the frame exactly as it was and only changes what
   * happens NEXT — which is what "ease" means and is not what re-deriving the
   * playhead from the clock would have done. */
  const handleEaseChange = useCallback((next: RevealEase) => {
    setRevealEase(next)
    clockRef.current = unEaseReveal(playheadRef.current, next)
  }, [])
  /* The Animation tab in the style drawer writes the ease through the host, not
   * through `handleEaseChange`, so the same re-derivation runs on the value. It
   * is idempotent after `handleEaseChange`: the playhead has not moved. */
  useEffect(() => {
    clockRef.current = unEaseReveal(playheadRef.current, revealEase)
  }, [revealEase])

  // DEV-ONLY reveal scrubber harness. Exposes an imperative API so the
  // automated video capture script can step the draw-in reveal to an exact
  // progress (0..1) and read it back, instead of relying on the wall-clock
  // PlaybackController. It drives the SAME state the reveal already reads
  // (playheadRef + solidAnimProgress for Solid/Extrude/Inflate), so it can
  // never reach geometry params or export. Guarded to non-production.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    const w = window as unknown as Record<string, unknown>
    w.__revealHarness = {
      setProgress: (value: number) => {
        const v = Math.max(0, Math.min(1, value))
        setPlaying(false)
        /* Same coherence rule as `handleScrub` — a capture script that steps the
         * reveal and then presses Play must not see the mark jump. */
        clockRef.current = unEaseReveal(v, revealEaseRef.current)
        openAt(clockRef.current)
        // SolidAnimationTick (always enabled for solid/extrude/inflate) reads
        // playheadRef each frame and propagates it into solidAnimProgress, so
        // setting the ref here is sufficient to advance the draw-in reveal.
        playheadRef.current = v
        setProgress(v)
      },
      getProgress: () => playheadRef.current,
      /* DRAWIN-CURVE: the ease the frame loop reads right now, and the
       * playhead it gives a clock, through that same ref. */
      liveEase: () => revealEaseRef.current,
      playheadAt: (c: number) => easeReveal(c, revealEaseRef.current),
      getTotalDuration: () => exportMs,
      /* DEV capture: the Phase 22 transport, drivable without DOM clicks. Each
       * setter drives the SAME state the popover writes, so an assertion grades
       * what a user gets rather than a parallel path. `getClock` is exposed
       * because the whole ease claim is "playhead === ease(clock)", and a check
       * that could only see one of the two numbers could not test it. */
      setEase: (e: RevealEase) => {
        setRevealEase(e)
        revealEaseRef.current = e
        clockRef.current = unEaseReveal(playheadRef.current, e)
      },
      setDelay: (sec: number) => setRevealDelaySeconds(Math.max(0, sec)),
      /* `DRAW IN`, drivable. The SAME state the popover writes, so a gate grades
       * what a user gets rather than a parallel path — and it returns a boolean
       * rather than void, because an assertion has to be able to tell "the
       * setter refused" from "the setter ran and the pixels did not move". An
       * unknown order name is refused for the reason `setPenTipMode` refuses
       * one: a sweep that silently accepted a bad argument captures the same arm
       * five times and reports it as five options. */
      setDrawIn: (patch: Partial<DrawInParams>) => {
        if (!patch || typeof patch !== "object") return false
        if (patch.order !== undefined && !(patch.order in ORDER_LABELS)) return false
        if (patch.align !== undefined && patch.align !== "start" && patch.align !== "end")
          return false
        if (patch.unit !== undefined && patch.unit !== "group" && patch.unit !== "stroke")
          return false
        if (patch.overlap !== undefined && !Number.isFinite(patch.overlap)) return false
        if (patch.seed !== undefined && !Number.isFinite(patch.seed)) return false
        if (
          patch.reverse !== undefined &&
          patch.reverse !== "off" &&
          patch.reverse !== "all" &&
          patch.reverse !== "alternate"
        )
          return false
        patchDrawIn(patch)
        return true
      },
      drawIn: () => drawIn,
      /* THE WINDOW, drivable — same state the popover writes, same boolean
       * return, same refusal on an unknown name. A sweep that silently accepted
       * `"vanishh"` would capture `grow` four times and report it as four
       * options, which is the defect `setPenTipMode` refuses one for. */
      setWindow: (patch: Partial<RevealWindowParams>) => {
        if (!patch || typeof patch !== "object") return false
        if (patch.mode !== undefined && !(patch.mode in WINDOW_LABELS)) return false
        if (patch.length !== undefined && !Number.isFinite(patch.length)) return false
        patchWindow(patch)
        return true
      },
      window: () => revealWindow,
      /* THE PURE INTERVAL, so an assertion can check the SHAPE of every mode at
       * every playhead without filming 480 frames — and so the shape it checks
       * is the one the frame loop actually runs. `ease` already works this way
       * for the same reason. */
      /* TRAVEL-5: the window the frame loop runs (`seamless` folded in) and
       * the live opening flag, unless the caller names a pass. */
      windowAt: (d: number, opening?: boolean) => windowAt(seamWindow, d, opening ?? openingRef.current),
      /* What the MODEL made of it, published by the scene. Read through here so
       * a probe has one place to look. */
      schedule: () => (window as unknown as { __fsSchedule?: unknown }).__fsSchedule ?? null,
      setLoop: (on: boolean) => setRevealLoop(!!on),
      setReverse: (on: boolean) => setRevealReverse(!!on),
      setPlaying: (on: boolean) => setPlaying(!!on),
      isPlaying: () => playingRef.current,
      getClock: () => clockRef.current,
      /* The pure envelope, so a check can assert the SHAPE without filming —
       * and so the shape it asserts is the one the frame loop actually runs. */
      ease: (t: number, e: RevealEase) => easeReveal(t, e),
    }
    return () => {
      delete w.__revealHarness
    }
    // `drawIn` is in the list so `drawIn()` reads the LIVE value rather than the
    // one that was current when the harness was installed — a getter that
    // reports a stale value is the same defect class as a control that reports
    // the request instead of the result. `revealWindow` is there for the same
    // reason and it is not optional: `windowAt` closes over it, so a stale
    // closure would hand a probe the shape of a mode nobody is in.
  }, [totalDuration, exportMs, drawIn, patchDrawIn, revealWindow, seamWindow, patchWindow])

  /* ANIM-1A3 · THE TAKE, DRIVABLE. `set` writes the same state a panel would
   * (the host's `onTakeChange` when there is one), and returns false on a row
   * it cannot read rather than storing it, so a sweep cannot report a refused
   * row as a measured one. `get` reports what Scene BUILT (`timedInfoRef`) and
   * what the last frame DREW (`TAKE_LIVE`), side by side, so a gate can take
   * its expectations from the render and hold the schedule to them. Dev only,
   * like `__revealHarness`. */
  const takeRef = useRef(take)
  takeRef.current = take
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    const w = window as unknown as Record<string, unknown>
    const EASES = new Set(["linear", "in", "out", "inOut"])
    const rowOk = (r: unknown): r is StrokeTimingTake["strokes"][number] => {
      if (!r || typeof r !== "object") return false
      const o = r as Record<string, unknown>
      if (!Number.isFinite(o.delayMs)) return false
      if (!(Number.isFinite(o.speed) && (o.speed as number) > 0)) return false
      if (typeof o.holdBack !== "boolean") return false
      const e = o.ease as Record<string, unknown> | undefined
      if (!e || typeof e !== "object") return false
      if (e.kind === "preset") return EASES.has(e.id as string)
      if (e.kind === "bezier")
        return ["x1", "y1", "x2", "y2"].every((k) => Number.isFinite(e[k]))
      return false
    }
    w.__fsTake = {
      set: (rows: Record<number, unknown>, opts?: { ripple?: boolean }) => {
        if (!rows || typeof rows !== "object") return false
        const strokes: StrokeTimingTake["strokes"] = {}
        for (const k of Object.keys(rows)) {
          const i = Number(k)
          if (!Number.isInteger(i) || i < 0) return false
          const r = rows[i]
          if (!rowOk(r)) return false
          strokes[i] = { ...r }
        }
        setTake({ strokes, ripple: !!opts?.ripple })
        return true
      },
      clear: () => {
        setTake(STROKE_TIMING_TAKE_DEFAULTS)
        return true
      },
      knockout: (name: string | null) => {
        const ok = [null, "slope", "clock", "speed", "delay", "holdBack", "ease", "exportpen"]
        if (!ok.includes(name)) return false
        setTakeKnockout(name)
        return true
      },
      get: () => {
        const ts = timedInfoRef.current
        return {
          take: takeRef.current,
          knockout: takeKnockout,
          timed: ts !== null,
          takeMs: ts ? ts.takeMs : null,
          baseMs: ts ? ts.baseMs : null,
          penMs,
          totalDuration,
          exportMs,
          slots: ts ? Array.from(ts.slots) : null,
          baseSlots: ts ? Array.from(ts.baseSlots) : null,
          rejected: ts ? ts.rejected.slice() : [],
          sig: ts ? ts.sig : null,
          live: {
            playhead: TAKE_LIVE.playhead,
            timed: TAKE_LIVE.timed,
            meshes: TAKE_LIVE.meshes.map((m) => ({ ...m })),
          },
        }
      },
    }
    return () => {
      delete w.__fsTake
    }
  }, [setTake, takeKnockout, penMs, totalDuration, exportMs])

  /* ANIM-3B · DEV-ONLY, READ-ONLY. What the keys say at the transport's clock
   * and what the frame loop applied, so a gate can measure both. `sample` is
   * all `undefined` with no keys. `applied` is `KEY_LIVE`, the last frame's
   * flatten depth and yaw in radians. `camera` is read off the camera now, in
   * `orbitView`'s units, null before the controls and bounds exist. It writes
   * nothing. */
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    const w = window as unknown as Record<string, unknown>
    w.__fsKeySample = () => {
      const clockMs = keyReader ? keyReader.clockMs() : playheadRef.current * totalDuration
      const controls = controlsRef.current
      const b = boundsRef.current
      return {
        clockMs,
        revealMs: keyReader ? keyReader.revealMs() : clockMs,
        lengthMs: totalDuration,
        takeLen,
        keyed: !!keyReader,
        refused: keyRefusal.slice(),
        sample: { ...(keyReader ? keyReader.sample() : sampleKeys(undefined, clockMs)) },
        applied: { depth: KEY_LIVE.depth, yaw: KEY_LIVE.yaw, cameraWrites: KEY_LIVE.cameraWrites },
        camera: controls && b && b.radius > 0 ? readOrbitPose(controls, b.radius) : null,
      }
    }
    return () => {
      delete w.__fsKeySample
    }
  }, [keyReader, totalDuration, takeLen, keyRefusal])

  // F123 · The stroke-to-world frame is read ONCE, from the window Viewport3D
  // mounted in. Read on every render, a window resize left it stale until some
  // unrelated re-render picked up the new size, and the form jumped then (9.6%
  // bigger after 1512x982 to 1400x900).
  // The camera keeps its zoom through a resize and the 2D drawing keeps its px,
  // so the form keeps its size too. `window.__fsStrokeFrame = "live"` parks the
  // old per-render read for the must-fail arm of assert-resize-settles row 5.
  const [loadFrame] = useState(() =>
    typeof window !== "undefined"
      ? { w: window.innerWidth / 2, h: window.innerHeight - 48 }
      : { w: 800, h: 600 }
  )
  const liveFrame =
    typeof window !== "undefined" &&
    (window as unknown as { __fsStrokeFrame?: string }).__fsStrokeFrame === "live"
  const canvasWidth = liveFrame ? window.innerWidth / 2 : loadFrame.w
  const canvasHeight = liveFrame ? window.innerHeight - 48 : loadFrame.h

  const strokeCount = processedStrokes.length
  const totalPoints = processedStrokes.reduce(
    (sum, s) => sum + s.points.length,
    0
  )

  const handleResetCamera = useCallback(() => {
    const controls = controlsRef.current
    if (!controls) return
    const bounds = boundsRef.current
    if (bounds && bounds.radius > 0) {
      const dir = new THREE.Vector3(1, 1, 1).normalize()
      const pos = bounds.center.clone().add(dir.multiplyScalar(bounds.radius * FRAME_K))
      controls.object.position.copy(pos)
      controls.target.copy(bounds.center)
      applyFraming(controls.object, bounds.radius * FRAME_K)
    } else {
      controls.object.position.copy(INITIAL_CAMERA_POSITION)
      controls.target.copy(INITIAL_CAMERA_TARGET)
      applyFraming(controls.object, INITIAL_CAMERA_POSITION.length())
    }
    controls.update()
  }, [])

  const handleTopView = useCallback(() => {
    const controls = controlsRef.current
    if (!controls) return
    const bounds = boundsRef.current
    if (bounds && bounds.radius > 0) {
      const pos = bounds.center.clone().add(new THREE.Vector3(0, 0, bounds.radius * TOP_K))
      controls.object.position.copy(pos)
      controls.target.copy(bounds.center)
      applyFraming(controls.object, bounds.radius * TOP_K)
    } else {
      controls.object.position.set(0, 0, 5)
      controls.target.copy(INITIAL_CAMERA_TARGET)
      applyFraming(controls.object, 5)
    }
    controls.update()
  }, [])

  /**
   * Build a fresh export-only scene with merged geometry per stroke,
   * centered at origin, with deterministic naming. No viewer junk.
   */
  /**
   * Builds the GLB ArrayBuffer for the current mode. Extracted from
   * `handleExportGLB` so the download path and the dev verification hook run
   * the EXACT same export code — a harness that exercised a parallel path
   * would prove nothing about the real export.
   * Returns null when there is nothing exportable.
   */
  const buildGLBBuffer = useCallback(async (): Promise<ArrayBuffer | null> => {
    if (processedStrokes.length === 0) return null
    const engine = getEngineFor(geometryMode, engineFamily)
    const settings = settingsRef?.current
    // Export v2 — material metadata: thread the RESOLVED material selection
    // (preset merged with any Custom edits — same resolution the preview's
    // liveMaterial uses) into the engines so the GLB carries what the user
    // actually chose instead of a hardcoded ink material.
    const exportMaterialPreset = styleState?.materialPreset ?? "ink"
    const exportResult = engine.buildExport(processedStrokes, {
      canvasWidth,
      canvasHeight,
      exportName,
      strokeCount,
      totalPoints,
      extrudeParams,
      solidParams,
      inflateParams,
      material: {
        preset: exportMaterialPreset,
        params: resolveMaterialParams(exportMaterialPreset, styleState?.customMaterial),
      },
      settings: {
        spacing: settings?.spacing ?? null,
        smoothingEnabled: settings?.smoothing ?? null,
        cornersEnabled: settings?.preserveCorners ?? null,
      },
    })
    if (exportResult.objectCount === 0) return null

    const exportScene = new THREE.Scene()
    exportScene.add(exportResult.group)

    if (process.env.NODE_ENV === "development") {
      const FORBIDDEN_NAMES = ["grid", "helper", "cube", "debug", "controls"]
      exportScene.traverse((node) => {
        const nameLower = (node.name || "").toLowerCase()
        for (const f of FORBIDDEN_NAMES) {
          if (nameLower.includes(f)) {
            console.warn(`[FreeStroke Export] ASSERTION: found forbidden name "${node.name}" in export scene`)
          }
        }
      })
      if (exportScene.children.length !== 1 || exportScene.children[0].name !== "FreeStroke") {
        console.warn("[FreeStroke Export] ASSERTION: root is not a single group named FreeStroke")
      }
    }

    const exporter = new GLTFExporter()
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      exporter.parse(exportScene, (gltf) => resolve(gltf as ArrayBuffer), (error) => reject(error), {
        binary: true,
      })
    })

    for (const g of exportResult.disposables) g.dispose()
    exportScene.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.geometry?.dispose()
        if (node.material instanceof THREE.Material) node.material.dispose()
      }
    })
    return buffer
  }, [
    processedStrokes,
    geometryMode,
    engineFamily,
    extrudeParams,
    solidParams,
    inflateParams,
    exportName,
    settingsRef,
    strokeCount,
    totalPoints,
    canvasWidth,
    canvasHeight,
    styleState?.materialPreset,
    styleState?.customMaterial,
  ])

  // DEV-ONLY verification hook: lets scripts/verify/verify-gates.mjs assert the
  // geometry-rebuild gate and export health without clicking the UI.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    const w = window as unknown as Record<string, unknown>
    // A/B switch for Rod's curvature-adaptive tube sampling. Toggling it takes
    // effect on the next geometry build, so a script must re-inject the strokes
    // after flipping it. Dev-only, same guard as the rest of this hook.
    w.__rodTuning = ROD_TUNING
    w.__geomDebug = {
      buildCount: () => GEOM_BUILD_DEBUG.buildCount,
      exportBytes: async () => (await buildGLBBuffer())?.byteLength ?? 0,
      // The live style clock, including which motion path the loop is on. A
      // reduced-motion assertion that only checks "nothing moved" cannot tell the
      // accessible path from a broken layer, so the flag itself has to be
      // readable — see scripts/verify/assert-layer-flicker.mjs --reduced.
      styleClock: () => ({ ...STYLE_CLOCK_DEBUG }),
      // K2: the keyed style, frame by frame (see KEYED_STYLE_DEBUG).
      keyedStyle: {
        record: (on: boolean) => {
          KEYED_STYLE_DEBUG.record = on
          if (on) KEYED_STYLE_DEBUG.rows = []
        },
        rows: () => KEYED_STYLE_DEBUG.rows.slice(),
      },
      // The shine band's live state and WHICH block last wrote it. Reading the
      // number is the only way to tell "fusion released the band" from "the
      // picture happens to look the same" — see SWEEP_DEBUG and
      // scripts/verify/assert-sweep-release.mjs.
      sweepBand: () => ({ ...SWEEP_DEBUG }),
      // What the last still export did to the screen-locked layers, so the
      // "the export matches the viewport" claim is a number and not a diff.
      lastStill: () => ({ ...STILL_DEBUG }),
      // Topology fingerprint of the LIVE preview meshes (the same group the
      // exporter walks). scripts/verify/geometry-baseline.mjs already asked for
      // `stats()` with optional chaining, so before this existed every baseline
      // recorded `verts=? tris=?` and the regression net could only see export
      // byte length. Any engine change that moved triangle counts — which is
      // exactly what the Rod adaptive-segmentation work does — was invisible.
      stats: () => {
        const root = exportGroupRef.current
        if (!root) return null
        let meshes = 0
        let vertices = 0
        let triangles = 0
        // Rod's two sphere passes are separated by the PART TAG each mesh
        // carries (FS_PART_CAP / FS_PART_JOINT above), not by inferring the part
        // from its vertex count — see the comment on those constants for the
        // census that silently reported zero for a whole session. `untagged`
        // exists so the sum can be checked: if a tagged pass ever stops being
        // tagged, that shows up as a number instead of as a clean zero.
        let capSpheres = 0
        let jointSpheres = 0
        let untagged = 0
        const box = new THREE.Box3()
        root.traverse((node) => {
          const mesh = node as THREE.Mesh
          if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return
          const geo = mesh.geometry as THREE.BufferGeometry | undefined
          const pos = geo?.getAttribute("position")
          if (!geo || !pos) return
          meshes++
          vertices += pos.count
          const ix0 = originalIndex(geo)
          triangles += ix0 ? ix0.count / 3 : pos.count / 3
          const part = (mesh.userData as { fsPart?: string } | undefined)?.fsPart
          if (part === "cap") capSpheres++
          else if (part === "joint") jointSpheres++
          else untagged++
          box.expandByObject(mesh)
        })
        const size = box.isEmpty() ? new THREE.Vector3() : box.getSize(new THREE.Vector3())
        return {
          meshes,
          vertices,
          triangles: Math.round(triangles),
          capSpheres,
          jointSpheres,
          untagged,
          bbox: [
            Number(size.x.toFixed(4)),
            Number(size.y.toFixed(4)),
            Number(size.z.toFixed(4)),
          ],
        }
      },
      // Shading-defect probe. Reads the LIVE geometry (positions + the normals
      // the renderer is actually lighting) and reports where the surface is
      // split: how many vertices sit on a shared position, and how far apart
      // the normals at that shared position are. A smooth surface has either no
      // coincident vertices or coincident vertices carrying the SAME normal;
      // a faceted one carries a different normal per face at every seam, which
      // is what a banded/striped rim looks like from the inside.
      // Vertices are bucketed by |normal.z| so the flat caps (|nz| ~ 1) can be
      // reported separately from the rim wall (|nz| ~ 0).
      probeNormals: () => {
        const root = exportGroupRef.current
        if (!root) return null
        const out: unknown[] = []
        root.traverse((node) => {
          const mesh = node as THREE.Mesh
          if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return
          const geo = mesh.geometry as THREE.BufferGeometry | undefined
          const pos = geo?.getAttribute("position")
          const nrm = geo?.getAttribute("normal")
          if (!geo || !pos || !nrm) return
          const groups = new Map<string, number[]>()
          for (let i = 0; i < pos.count; i++) {
            const key = `${pos.getX(i).toFixed(6)},${pos.getY(i).toFixed(6)},${pos.getZ(i).toFixed(6)}`
            const list = groups.get(key)
            if (list) list.push(i)
            else groups.set(key, [i])
          }
          const isRim = (i: number) => Math.abs(nrm.getZ(i)) < 0.4
          let rimVerts = 0
          let capVerts = 0
          let splitGroups = 0
          let rimSplitGroups = 0
          let maxSplitDeg = 0
          let sumSplitDeg = 0
          let maxRimSplitDeg = 0
          let sumRimSplitDeg = 0
          for (let i = 0; i < nrm.count; i++) {
            if (Math.abs(nrm.getZ(i)) > 0.9) capVerts++
            else if (isRim(i)) rimVerts++
          }
          const angleBetween = (a: number, b: number) => {
            const dot =
              nrm.getX(a) * nrm.getX(b) + nrm.getY(a) * nrm.getY(b) + nrm.getZ(a) * nrm.getZ(b)
            return (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI
          }
          for (const list of groups.values()) {
            if (list.length < 2) continue
            let worst = 0
            for (let a = 0; a < list.length; a++) {
              for (let b = a + 1; b < list.length; b++) {
                const deg = angleBetween(list[a], list[b])
                if (deg > worst) worst = deg
              }
            }
            if (worst > 1) {
              splitGroups++
              sumSplitDeg += worst
              if (worst > maxSplitDeg) maxSplitDeg = worst
            }
            // RIM-ONLY split: how far apart are the normals of the two wall
            // faces that meet at this contour point? This is the number that
            // decides whether the rim reads as one surface or as facets; the
            // all-vertex figure is dominated by the cap/wall crease, which is
            // a genuine 90-degree edge and must stay hard.
            const rimList = list.filter(isRim)
            if (rimList.length >= 2) {
              let rimWorst = 0
              for (let a = 0; a < rimList.length; a++) {
                for (let b = a + 1; b < rimList.length; b++) {
                  const deg = angleBetween(rimList[a], rimList[b])
                  if (deg > rimWorst) rimWorst = deg
                }
              }
              if (rimWorst > 1) {
                rimSplitGroups++
                sumRimSplitDeg += rimWorst
                if (rimWorst > maxRimSplitDeg) maxRimSplitDeg = rimWorst
              }
            }
          }

          // Face-level walk of the rim: consecutive wall FACE normals, signed
          // about +Z. A smoothly turning contour gives same-sign turns; a
          // lattice staircase gives alternating signs, which is what a regular
          // light/dark stripe pattern actually is.
          const idx = originalIndex(geo)
          const faceTurns: number[] = []
          let alternations = 0
          if (idx) {
            let prevAng: number | null = null
            let prevTurn: number | null = null
            for (let t = 0; t < idx.count / 3; t++) {
              const a = idx.getX(t * 3)
              const b = idx.getX(t * 3 + 1)
              const c = idx.getX(t * 3 + 2)
              const ax = pos.getX(a), ay = pos.getY(a), az = pos.getZ(a)
              const nx1 = pos.getX(b) - ax, ny1 = pos.getY(b) - ay, nz1 = pos.getZ(b) - az
              const nx2 = pos.getX(c) - ax, ny2 = pos.getY(c) - ay, nz2 = pos.getZ(c) - az
              const fx = ny1 * nz2 - nz1 * ny2
              const fy = nz1 * nx2 - nx1 * nz2
              const fz = nx1 * ny2 - ny1 * nx2
              const len = Math.hypot(fx, fy, fz)
              if (len === 0) continue
              if (Math.abs(fz / len) >= 0.4) continue // cap face, not rim
              const ang = Math.atan2(fy, fx)
              if (prevAng !== null) {
                let d = ang - prevAng
                while (d > Math.PI) d -= Math.PI * 2
                while (d < -Math.PI) d += Math.PI * 2
                const deg = (d * 180) / Math.PI
                if (Math.abs(deg) > 0.01) {
                  faceTurns.push(Number(deg.toFixed(3)))
                  if (prevTurn !== null && Math.sign(deg) !== Math.sign(prevTurn)) alternations++
                  prevTurn = deg
                }
              }
              prevAng = ang
            }
          }
          const absTurns = faceTurns.map(Math.abs)
          out.push({
            name: mesh.name || "(unnamed)",
            vertices: pos.count,
            uniquePositions: groups.size,
            duplicationFactor: Number((pos.count / Math.max(groups.size, 1)).toFixed(2)),
            rimVerts,
            capVerts,
            splitGroups,
            maxSplitDeg: Number(maxSplitDeg.toFixed(2)),
            meanSplitDeg: Number((splitGroups ? sumSplitDeg / splitGroups : 0).toFixed(2)),
            rimSplitGroups,
            maxRimSplitDeg: Number(maxRimSplitDeg.toFixed(2)),
            meanRimSplitDeg: Number(
              (rimSplitGroups ? sumRimSplitDeg / rimSplitGroups : 0).toFixed(2),
            ),
            rimFaceTurns: faceTurns.length,
            rimTurnMeanDeg: Number(
              (absTurns.reduce((s, v) => s + v, 0) / Math.max(absTurns.length, 1)).toFixed(2),
            ),
            rimTurnMaxDeg: Number(Math.max(0, ...absTurns).toFixed(2)),
            // Fraction of consecutive turns that reverse direction. ~0 = the
            // contour sweeps; ~1 = it zig-zags every segment.
            rimTurnAlternationRatio: Number(
              (alternations / Math.max(faceTurns.length - 1, 1)).toFixed(3),
            ),
            rimTurnSample: faceTurns.slice(0, 40),
          })
        })
        return out
      },
      // CREASE CENSUS — the order-independent faceting metric.
      //
      // WHY probeNormals ALONE IS NOT ENOUGH, and why reading it on Extrude
      // was actively misleading. It has two metrics and BOTH are blind here:
      //
      //  1. `maxRimSplitDeg` groups vertices by shared POSITION and measures
      //     how far apart their normals are. It can only fire on a mesh whose
      //     seam vertices are duplicated. The Extrude ribbon is a shared-vertex
      //     strip — `duplicationFactor` 1.00, so `splitGroups` is 0 by
      //     construction and the metric reports a perfect surface for any
      //     geometry whatsoever.
      //  2. `rimTurnMeanDeg` walks the index buffer and treats CONSECUTIVE
      //     faces as ADJACENT along the rim. True for Solid, whose wall is
      //     emitted in contour order. False for the ribbon, which emits its
      //     two opposite side walls interleaved — so consecutive faces are the
      //     LEFT and RIGHT wall of the strip, ~180 degrees apart, and every
      //     Extrude fixture scores `rimTurnMean` 170-178 with alternation up to
      //     0.80. That reads as catastrophic faceting and means nothing at all.
      //     A metric derived for one emission order, consumed under another.
      //
      // This one keys edges by ROUNDED POSITION PAIR and measures the dihedral
      // angle between the two faces that share each edge. Independent of index
      // order, of winding, and of whether vertices are welded — so it is the
      // same number for Solid, for the ribbon, and for anything built later.
      // The angle it reports is the physical crease, which is what a specular
      // highlight traces: a smooth curve creases a few degrees per edge, a
      // faceted one creases by the facet angle, and a genuine feature edge
      // (cap meeting wall) creases ~90 and SHOULD.
      //
      // Buckets by where the edge lives, because the three have different
      // acceptable answers:
      //   wall  — both faces near-vertical. This is the rim. Must be smooth.
      //   cap   — both faces near-flat. Must be ~0.
      //   mixed — a cap face meets a wall face: the bevel band. Its MAX is the
      //           number that says whether the rim is a roll or a cut. One
      //           90-degree mixed crease is a die-cut edge; a chain of small
      //           ones is the curved band that carries the form.
      probeDihedral: () => {
        const root = exportGroupRef.current
        if (!root) return null
        const out: unknown[] = []
        root.traverse((node) => {
          const mesh = node as THREE.Mesh
          if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return
          const geo = mesh.geometry as THREE.BufferGeometry | undefined
          const pos = geo?.getAttribute("position")
          if (!geo || !pos) return
          const idx = originalIndex(geo)
          const triCount = idx ? idx.count / 3 : pos.count / 3
          const vi = (t: number, k: number) => (idx ? idx.getX(t * 3 + k) : t * 3 + k)
          // Quantise to 1e-5 world units. Coarse enough to weld the duplicated
          // seam vertices a strip/extruder emits, fine enough that two genuinely
          // distinct rim points never collide at this project's scale (~3 units
          // across a canvas).
          const key = (i: number) =>
            `${Math.round(pos.getX(i) * 1e5)},${Math.round(pos.getY(i) * 1e5)},${Math.round(pos.getZ(i) * 1e5)}`
          // A TRIANGLE WITH NO NORMAL IS NOT A 90-DEGREE CREASE.
          //
          // This block used to push `{0,0,0}` for a zero-area triangle and then
          // guard with `if (!n0 || !n1) continue` — which never fires, because
          // `{x:0,y:0,z:0}` is a truthy object. The zero normal then flowed
          // straight into the arithmetic: `dot` came out 0, so
          // `min(acos(0), acos(-0))` returned EXACTLY 90, and `|0| < 0.4` typed
          // the phantom face as a WALL, so one degenerate triangle beside a cap
          // face manufactured a `mixed max 90` — the precise signature of the
          // die-cut rim this pass exists to hunt. An instrument whose numeric
          // failure mode is indistinguishable from the defect it measures is the
          // explainer-13 mistake with the sign flipped, so:
          //   • degenerate faces are recorded as `degenerateTriangles`, a number
          //     a reader can see, instead of being absorbed into a bucket;
          //   • their edges are not registered at all, so no crease is ever
          //     attributed to a face that has no orientation.
          // `EPS` rather than `=== 0`: the cross product of two nearly parallel
          // float3s underflows to a denormal, not to zero, and a 1e-18 normal is
          // pure noise — it is direction-free in every way that matters here.
          const faceN: ({ x: number; y: number; z: number } | null)[] = []
          const edges = new Map<string, number[]>()
          let degenerateTriangles = 0
          const NORMAL_EPS = 1e-14
          for (let t = 0; t < triCount; t++) {
            const a = vi(t, 0), b = vi(t, 1), c = vi(t, 2)
            const ax = pos.getX(a), ay = pos.getY(a), az = pos.getZ(a)
            const e1x = pos.getX(b) - ax, e1y = pos.getY(b) - ay, e1z = pos.getZ(b) - az
            const e2x = pos.getX(c) - ax, e2y = pos.getY(c) - ay, e2z = pos.getZ(c) - az
            const nx = e1y * e2z - e1z * e2y
            const ny = e1z * e2x - e1x * e2z
            const nz = e1x * e2y - e1y * e2x
            const len = Math.hypot(nx, ny, nz)
            if (!(len > NORMAL_EPS)) {
              faceN.push(null)
              degenerateTriangles++
              continue
            }
            faceN.push({ x: nx / len, y: ny / len, z: nz / len })
            const ka = key(a), kb = key(b), kc = key(c)
            for (const [p, q] of [[ka, kb], [kb, kc], [kc, ka]] as [string, string][]) {
              const ek = p < q ? `${p}|${q}` : `${q}|${p}`
              const list = edges.get(ek)
              if (list) list.push(t)
              else edges.set(ek, [t])
            }
          }
          const buckets: Record<string, number[]> = { wall: [], cap: [], mixed: [] }
          // WHERE the worst creases are, not just how big they are. A max on its
          // own cannot distinguish "one drawn corner" from "the whole rim", and
          // the previous Inflate diagnosis had to be guessed at for exactly that
          // reason. Keyed by bucket; each entry carries the edge midpoint and
          // both face normals so a caller can say which surface pair creased.
          const worst: Record<
            string,
            {
              deg: number
              mid: number[]
              n0: number[]
              n1: number[]
              tris: number[][]
              pts: number[][][]
            }[]
          > = { wall: [], cap: [], mixed: [] }
          let boundaryEdges = 0
          let nonManifoldEdges = 0
          for (const [ek, list] of edges.entries()) {
            if (list.length === 1) { boundaryEdges++; continue }
            if (list.length > 2) { nonManifoldEdges++; continue }
            const [t0, t1] = list
            const n0 = faceN[t0], n1 = faceN[t1]
            if (!n0 || !n1) continue
            const dot = Math.min(1, Math.max(-1, n0.x * n1.x + n0.y * n1.y + n0.z * n1.z))
            // Faces may be wound oppositely; the crease is the smaller angle.
            const deg = Math.min(
              (Math.acos(dot) * 180) / Math.PI,
              (Math.acos(-dot) * 180) / Math.PI,
            )
            const w0 = Math.abs(n0.z) < 0.4, w1 = Math.abs(n1.z) < 0.4
            const c0 = Math.abs(n0.z) > 0.9, c1 = Math.abs(n1.z) > 0.9
            const bucket = w0 && w1 ? "wall" : c0 && c1 ? "cap" : "mixed"
            buckets[bucket].push(deg)
            const w = worst[bucket]
            if (w.length < 6 || deg > w[w.length - 1].deg) {
              const [pa, pb] = ek.split("|").map((s) => s.split(",").map(Number))
              w.push({
                deg: Number(deg.toFixed(2)),
                mid: [0, 1, 2].map((i) => Number((((pa[i] + pb[i]) / 2) * 1e-5).toFixed(4))),
                n0: [n0.x, n0.y, n0.z].map((v) => Number(v.toFixed(4))),
                n1: [n1.x, n1.y, n1.z].map((v) => Number(v.toFixed(4))),
                // The two offending faces as VERTEX INDICES. Builders in this
                // repo lay vertices out in a known order (the Inflate loft is
                // ring-major: `ring * ringSegs + j`), so an index decodes to a
                // ring and a segment — which is the difference between "there
                // is a 90 degree crease somewhere" and "the tip fan meets the
                // wall". Without this the previous diagnosis of Inflate's rim
                // had to be inferred, and it was inferred wrongly.
                tris: [
                  [vi(t0, 0), vi(t0, 1), vi(t0, 2)],
                  [vi(t1, 0), vi(t1, 1), vi(t1, 2)],
                ],
                // …and the same two faces as POSITIONS, because an index only
                // decodes if you already know the builder's layout and that
                // assumption is exactly the kind this repo keeps getting wrong.
                // Six edges of nine numbers each: cheap, and it means a rim
                // diagnosis is read rather than reconstructed.
                pts: [
                  [vi(t0, 0), vi(t0, 1), vi(t0, 2)],
                  [vi(t1, 0), vi(t1, 1), vi(t1, 2)],
                ].map((tri) =>
                  tri.map((v) =>
                    [pos.getX(v), pos.getY(v), pos.getZ(v)].map((n) => Number(n.toFixed(5))),
                  ),
                ),
              })
              w.sort((p, q) => q.deg - p.deg)
              if (w.length > 6) w.length = 6
            }
          }
          const stat = (v: number[]) => {
            if (!v.length) return { n: 0, mean: 0, p95: 0, max: 0, over30: 0 }
            const s = [...v].sort((a, b) => a - b)
            return {
              n: v.length,
              mean: Number((v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)),
              p95: Number(s[Math.floor(0.95 * (s.length - 1))].toFixed(2)),
              max: Number(s[s.length - 1].toFixed(2)),
              // Edges creasing more than 30 degrees. On a rim that is a facet
              // you can see; the COUNT is what a gate should assert on, because
              // one legitimate corner raises `max` while a faceted curve raises
              // the count.
              over30: v.filter((d) => d > 30).length,
            }
          }
          out.push({
            name: mesh.name || "(unnamed)",
            triangles: Math.round(triCount),
            degenerateTriangles,
            boundaryEdges,
            nonManifoldEdges,
            wall: stat(buckets.wall),
            cap: stat(buckets.cap),
            mixed: stat(buckets.mixed),
            worst,
          })
        })
        return out
      },
      /* RAW BUFFERS — the same meshes probeDihedral reads, as plain arrays.
       *
       * WHY A DUMPER AND NOT ANOTHER IN-PAGE METRIC. `probeDihedral` measures
       * `min(acos d, acos -d)`, so a FOLD — a flap of surface turned back
       * through itself — reads as a SMALL crease rather than a large one. That
       * blindness is on the record: explainer 17 §2's extrude seam flap was
       * invisible to every number the census reports while being obvious in a
       * frame. The inside of a tight elbow is precisely where a swept loft folds
       * (consecutive rings interpenetrate once the centreline's curvature radius
       * drops below the tube radius), so the elbow question needs an instrument
       * of a DIFFERENT kind: count how many sheets a ray crosses.
       *
       * `__inflateProbe.crossSection` already does that, but only through the
       * model's bbox CENTRE — which for a square outline is empty air. Rather
       * than grow a second positioned raycaster inside the app, this hands the
       * buffers out and lets the verification script cast wherever it needs to.
       * The script then owns its own calibration, which is the pattern this repo
       * settled on after five instruments were caught measuring nothing.
       *
       * Meshes are concatenated with their indices rebased, because "do the
       * per-stroke shells interpenetrate" is one of the questions and it cannot
       * be asked of one shell at a time. Positions are LOCAL to each mesh, which
       * is what every other probe here reads too (the stroke meshes carry no
       * per-mesh transform).
       */
      dumpMeshes: () => {
        const root = exportGroupRef.current
        if (!root) return null
        const pos: number[] = []
        const idx: number[] = []
        let meshes = 0
        root.traverse((node) => {
          const mesh = node as THREE.Mesh
          if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return
          const geo = mesh.geometry as THREE.BufferGeometry | undefined
          const p = geo?.getAttribute("position")
          if (!geo || !p) return
          const base = pos.length / 3
          for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i))
          const ix = originalIndex(geo)
          if (ix) for (let i = 0; i < ix.count; i++) idx.push(base + ix.getX(i))
          else for (let i = 0; i < p.count; i++) idx.push(base + i)
          meshes++
        })
        return { pos, idx, meshes }
      },
      /* DRAFT TAPER PROFILE — per mesh, where the front face sits and where the
       * back face sits.
       *
       * `applyDraftTaperAbout` shrinks the back face toward a supplied centre.
       * The whole point of supplying it is that Free Stroke emits ONE GEOMETRY
       * PER STROKE, so the two possible wirings are:
       *
       *   WRONG (a verbatim `applyDraftTaper`): each stroke shrinks toward its
       *     OWN centre, so each mesh's back-face centroid stays put — the word
       *     reads as five separate mouldings leaning five different ways.
       *   RIGHT: every stroke shrinks toward the MARK's centre, so each mesh's
       *     back-face centroid is DISPLACED toward that shared point.
       *
       * Those two are indistinguishable in a vertex count, a bbox, or a
       * screenshot of a single letter — and identical in the `straight` case. The
       * displacement of each mesh's back centroid relative to its own front
       * centroid is the quantity that separates them, so that is what this
       * reports. Consumed by scripts/verify/assert-draft-taper.mjs.
       */
      taperProfile: () => {
        const root = exportGroupRef.current
        if (!root) return null
        const out: unknown[] = []
        root.traverse((node) => {
          const mesh = node as THREE.Mesh
          if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return
          const pos = (mesh.geometry as THREE.BufferGeometry | undefined)?.getAttribute("position")
          if (!pos) return
          let zMin = Infinity, zMax = -Infinity
          for (let i = 0; i < pos.count; i++) {
            const z = pos.getZ(i)
            if (z < zMin) zMin = z
            if (z > zMax) zMax = z
          }
          const span = zMax - zMin
          if (!(span > 1e-9)) return
          // Centroid of the vertices in the top and bottom 15% of the Z span.
          // A band rather than an exact plane, so a bevelled or domed face still
          // has members; 15% is under the bevel's own share of the depth.
          const band = span * 0.15
          const acc = { f: [0, 0, 0], b: [0, 0, 0] }
          for (let i = 0; i < pos.count; i++) {
            const z = pos.getZ(i)
            const k = z >= zMax - band ? "f" : z <= zMin + band ? "b" : null
            if (!k) continue
            acc[k][0] += pos.getX(i)
            acc[k][1] += pos.getY(i)
            acc[k][2] += 1
          }
          if (acc.f[2] === 0 || acc.b[2] === 0) return
          const fx = acc.f[0] / acc.f[2], fy = acc.f[1] / acc.f[2]
          const bx = acc.b[0] / acc.b[2], by = acc.b[1] / acc.b[2]
          out.push({
            name: mesh.name || "(unnamed)",
            frontCentre: [Number(fx.toFixed(5)), Number(fy.toFixed(5))],
            backCentre: [Number(bx.toFixed(5)), Number(by.toFixed(5))],
            // How far the back face moved, and which way.
            shift: [Number((bx - fx).toFixed(5)), Number((by - fy).toFixed(5))],
            zSpan: Number(span.toFixed(5)),
          })
        })
        return out
      },
      // Export v2 verification: hand the REAL GLB bytes (same shared path as
      // the download button) to scripts as base64 so they can parse the JSON
      // chunk and assert material metadata actually landed.
      exportBase64: async () => {
        const buf = await buildGLBBuffer()
        if (!buf) return null
        const bytes = new Uint8Array(buf)
        let s = ""
        for (let i = 0; i < bytes.length; i += 0x8000) {
          s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
        }
        return btoa(s)
      },
    }
    return () => {
      delete w.__geomDebug
      delete w.__rodTuning
    }
  }, [buildGLBBuffer])

  /* ---- EXPORT ----------------------------------------------------------
   *
   * ONE naming law and ONE download path for both formats. They used to be
   * inline in the GLB handler, which is how a second exporter ends up with a
   * different filename convention and a different failure mode. */
  const exportFilename = useCallback(
    /* `kind` exists for ONE reason: an animated PNG has to carry the `.png`
     * extension or no browser will play it, so on disk it is otherwise
     * indistinguishable from the still. `_anim` in the stem says which it is.
     * `lib/export` has a filename law of its own (`exportFilename` there) and
     * it is deliberately NOT used — one naming law per app, and this is it. */
    (ext: "glb" | "png" | "webm", kind?: "anim") => {
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, "0")
      const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
      const safeName = exportName.trim().replace(/[^a-zA-Z0-9_-]/g, "-")
      return `${safeName ? `${safeName}_` : "free-stroke_"}${geometryMode}${kind ? `_${kind}` : ""}_${ts}.${ext}`
    },
    [exportName, geometryMode],
  )
  const download = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    /* REVOKED ON A TIMER, NOT SYNCHRONOUSLY. Chrome starts the download on the
     * click, but a 4x still is tens of megabytes and revoking the object URL in
     * the same tick has raced on large blobs. One second costs nothing and the
     * URL is still released. */
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [])

  // Thin download wrapper: all export geometry/material logic lives in the
  // shared `buildGLBBuffer` above, so the button and the verification harness
  // exercise identical code.
  const handleExportGLB = useCallback(async () => {
    if (processedStrokes.length === 0) {
      toast.error("Nothing to export", {
        description: "Draw a stroke on the canvas first.",
      })
      return
    }
    setExporting(true)
    try {
      const result = await buildGLBBuffer()
      /* IT USED TO BE `if (!result) return` — the user pressed Export, nothing
       * downloaded, nothing was said, and the console message they will never
       * see was the only trace. `buildGLBBuffer` returns null when the engine
       * produced no mesh for the current mode, which is a real and reachable
       * state (a single-point stroke, a degenerate silhouette), so it needs an
       * answer and not a silent no-op. */
      if (!result) {
        toast.error("The exporter found no geometry", {
          description: `${geometryMode} built no mesh from this drawing. Try another mode, or add a longer stroke.`,
        })
        return
      }

      const filename = exportFilename("glb")
      const blob = new Blob([result], { type: "model/gltf-binary" })
      download(blob, filename)
      toast.success("Saved " + filename, {
        description: `${geometryMode} geometry · ${formatBytes(blob.size)}`,
      })
    } catch (err) {
      console.error("[FreeStroke Export] GLB export failed:", err)
      toast.error("GLB export failed", {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setExporting(false)
    }
  }, [processedStrokes, buildGLBBuffer, exportFilename, download, geometryMode])

  /**
   * EXPORT THE PICTURE — the product's actual output.
   *
   * Everything the style stack does is a shader, so none of it survives a GLB
   * (PRD §12: material metadata is v2, baking is v3, "preview first, bake
   * later"). Until then a still IS the deliverable for a styled mark, and there
   * was no way to get one. The render itself is `STILL_EXPORT.grab`, which
   * lives in the scene because it has to compensate the screen-locked layers;
   * this half is naming, download and telling the user what happened.
   */
  const handleExportPNG = useCallback(async () => {
    if (processedStrokes.length === 0) {
      toast.error("Nothing to export", {
        description: "Draw a stroke on the canvas first.",
      })
      return
    }
    const grab = STILL_EXPORT.grab
    if (!grab) {
      toast.error("The viewport is not ready", {
        description: "The 3D scene has not finished mounting. Try again in a moment.",
      })
      return
    }
    setExportingPng(true)
    try {
      const still = await grab({ scale: pngScale, transparent: pngTransparent })
      if (!still) {
        toast.error("Could not render the still", {
          description:
            "The canvas returned no image at this resolution. Try 1× or 2×.",
        })
        return
      }
      const filename = exportFilename("png")
      download(still.blob, filename)
      toast.success("Saved " + filename, {
        description: `${still.width} × ${still.height} px · ${
          pngTransparent ? "transparent" : "paper"
        } · ${formatBytes(still.blob.size)}`,
      })
    } catch (err) {
      console.error("[FreeStroke Export] PNG export failed:", err)
      toast.error("PNG export failed", {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setExportingPng(false)
    }
  }, [processedStrokes, exportFilename, download, pngScale, pngTransparent])

  /**
   * IS ANY TIME-VARYING LAYER ON?
   *
   * Not cosmetic: the exporter warns when an animated layer is captured on wall
   * time instead of the export clock, and a warning nobody can trigger is worth
   * nothing. This is the same set of flags the frame loop reads to decide
   * whether a layer moves at all — texture drift, dither crawl, glyph scroll,
   * the stack's group animation and the material's shine sweep.
   */
  const hasAnimatedStyleLayer = useMemo(() => {
    const s = styleState
    if (!s) return false
    return !!(
      (s.textureEnabled && s.textureMode !== "none" && s.textureAnimated) ||
      (s.ditherEnabled && s.ditherAnimated) ||
      (s.asciiEnabled && s.asciiAnimated) ||
      (s.layerStackEnabled && s.stackAnimationEnabled) ||
      s.materialAnimationEnabled
    )
  }, [styleState])

  /**
   * EXPORT THE ANIMATION — the artefact that carries the product's claim.
   *
   * ── WHY THIS IS NOT A NICE-TO-HAVE ────────────────────────────────────────
   * The app's entire subject is a mark that builds itself back at the speed the
   * hand actually moved, and until this existed the only things that could
   * leave the building were a still PNG and a GLB carrying none of the style.
   * The competitive read is blunt about what that costs
   * (`docs/research/competitive-landscape-and-the-missing-export.md` §1): on
   * Jitter's pricing page EVERY rung of the ladder is an export capability, and
   * transparent + frame-by-frame export is the $35 tier. In this category the
   * export is not a feature in a list, it is the product surface.
   *
   * ── WHY IT IS A PLAN AND NOT A SCREEN RECORDING ───────────────────────────
   * `lib/export/frame-plan.ts` carries the full argument; the short version is
   * arithmetic. A screen recorder samples wall-clock time, so a frame that took
   * 90 ms to render occupies 90 ms of the file — which does not add jitter to
   * this subject, it OVERWRITES it. The recorder below awaits every frame and
   * the file's timing comes from the plan, so a slow machine makes a slow
   * export and never a different film.
   *
   * ── THE THREE THINGS THE HOST OWNS ────────────────────────────────────────
   * 1 · `seek` — put the reveal at an exact playhead. The same three writes
   *     `__revealHarness.setProgress` makes, so the film is the thing on screen
   *     and not a parallel path.
   * 2 · `easePlayhead` — the plan's LINEAR clock through the APP's envelope.
   *     The module refuses to own a copy of the curve; this hands it the real
   *     one, so switching Ease-out changes the export.
   * 3 · `setSceneTimeMs` — the style clock, driven instead of wall-advanced.
   *     See `STYLE_CLOCK_DRIVE`. Reset in the `finally` on every path.
   */
  const handleExportVideo = useCallback(async () => {
    /* ── ONE AT A TIME, AND THE GUARD LIVES HERE ─────────────────────────────
     *
     * The toolbar button could not re-enter — while `exportingVideo` is true its
     * own `onClick` is the ABORT, so the press that would have started a second
     * render stops the first instead. That was the whole defence, and it was a
     * defence belonging to ONE control.
     *
     * There are now two ways in. `applyViewPresetById` (app/page.tsx) routes the
     * "Video Preview Export" view preset here, and the preset rail knows nothing
     * about the export bar's state. Two concurrent runs would share one
     * `videoAbortRef`, one `STYLE_CLOCK_DRIVE.exactMs`, one `playheadRef` and one
     * `setProgress` — so they would seek each other's frames, the first one's
     * `finally` would restore the playhead out from under the second, and the two
     * files would interleave. Every one of those is a data race on module state,
     * not a UI nuisance.
     *
     * So the guard is here, at the one place both callers pass through, rather
     * than repeated at each control. A caller that wants to know whether it
     * started anything reads `window.__fsVideoExportRuns` in dev, or watches for
     * the download; nobody re-implements "is one running".
     *
     * `__fsExportReentry = "allow"` parks the prior, unguarded behaviour so the
     * assertion has an arm it MUST go red on — the same shape as
     * `__fsExportClock` and `__fsExportGround` below. */
    if (readDevLaw("__fsExportReentry", ["allow"], "guard") === "guard" && videoAbortRef.current) {
      toast.error("A film is already rendering", {
        description:
          "One export at a time. The render drives the playhead and the style clock, so two would " +
          "write each other's frames. Wait for it, or press the counting Video button to stop it.",
      })
      return
    }
    if (processedStrokes.length === 0) {
      toast.error("Nothing to export", {
        description: "Draw a stroke on the canvas first.",
      })
      return
    }
    const grabCanvas = STILL_EXPORT.grabCanvas
    if (!grabCanvas) {
      toast.error("The viewport is not ready", {
        description: "The 3D scene has not finished mounting. Try again in a moment.",
      })
      return
    }
    /* THE PARKED PRIOR, and it is the negative control for the whole style-clock
     * claim. On `wall` the host does NOT hand over `setSceneTimeMs`, so the
     * style layers advance on the real frame delta exactly as they did before
     * this pass — two exports of the same mark at two different render speeds
     * then differ, which is what `assert-export-app.mjs` requires it to do. The
     * exporter also raises its own warning on that arm, unprompted. */
    const clockLaw = readDevLaw("__fsExportClock", ["wall"], "drive")
    /* A DEV-ONLY STALL, so a gate can make one export slow and the other fast
     * WITHOUT changing anything the export can see. This is the only way to
     * test "the film does not depend on how long rendering took" honestly:
     * both arms run identical code, one just takes longer. */
    const stallMs =
      process.env.NODE_ENV !== "production" && typeof window !== "undefined"
        ? Number((window as unknown as Record<string, unknown>).__fsExportStallMs) || 0
        : 0
    /* 🔴 THE DEFECT THAT EVERY NUMBER MISSED, PARKED AS A CONTROL.
     *
     * The first WebM this module ever produced decoded cleanly, had the right
     * frame count, the right duration and 121 distinct frames — and the contact
     * sheet was a near-black rectangle. Video has no alpha, so a transparent
     * canvas composites onto BLACK, and dark ink on black is nothing. Every
     * numeric row was green.
     *
     * `none` reproduces that exact configuration on demand — alpha frames, an
     * opaque container, no ground — so the assertion "the film is a mark on
     * paper" has an arm it MUST go red on. It is worth saying what this proves
     * about the SHIPPED path: `renderStill` paints `STILL_PAPER` into the frame
     * itself whenever `transparent` is false, so on the paper path the recorder's
     * ground is a second belt on the same braces and the black rectangle cannot
     * happen. That is a real property of the wiring, and the only way to know it
     * is a property rather than a coincidence is to be able to break it. */
    const groundLaw = readDevLaw("__fsExportGround", ["none"], "paper")
    const priorGround = groundLaw === "none"
    /* 🔴 THE PARKED PRIOR FOR THE ONE LINE BELOW, and it is the known-bad the
     * whole wiring rests on. `unwired` passes no `revealEnds` at all — literally
     * this call site as it stood until this line landed — so the plan falls back
     * to `grow`'s ends and welds 600 ms of blank paper onto the tail of every
     * Travel / Vanish / Shrink film. `assert-export-window.mjs` §D films BOTH
     * arms through this button and requires this one to still reproduce it;
     * a fix whose absence cannot be re-rendered is a fix nobody can fail.
     * Same shape as `__fsExportClock` / `__fsExportGround` above. */
    const revealEndsLaw = readDevLaw("__fsExportRevealEnds", ["unwired"], "wired")

    /* WHERE THE SCRUBBER WAS. An export walks the playhead from 0 to 1 and
     * would otherwise leave it at the end — the user pressed a button called
     * "save a file" and their transport moved. It is view state and not
     * document state, so it does not belong in the undo stack; the right answer
     * is for it not to change at all. Restored in the `finally`. */
    const playheadBefore = playheadRef.current
    const clockBefore = clockRef.current
    const openingBefore = openingRef.current
    /* The file is one pass. Forward, it is the opening pass: it writes in from
     * empty paper, which is what `revealEndsFor` above declares at clock 0. */
    openingRef.current = !revealReverse

    const controller = new AbortController()
    videoAbortRef.current = controller
    /* PAST THE GUARD, SO THIS COUNTS RUNS AND NOT PRESSES. Published on `window`
     * in dev only; `scripts/verify/_probe-video-route.mjs` reads it to settle
     * "the second click started nothing" with a number rather than with a
     * screenshot of a toast. */
    const run = ++videoRunsRef.current
    if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
      ;(window as unknown as Record<string, unknown>).__fsVideoExportRuns = run
    }
    /* ── ONE TOAST FOR THE WHOLE RUN ────────────────────────────────────────
     *
     * A multi-second render that writes a file has to say three things: what it
     * is about to do, that it is still doing it, and where the file went. The
     * export bar's button already carries the middle one as its label — but the
     * view preset is clicked in the STYLE PANEL, where that button is not what
     * the user is looking at, and a click that appears to do nothing for eight
     * seconds is indistinguishable from a broken control.
     *
     * `toast.loading` with a stable id, updated in `onProgress` and then
     * REPLACED IN PLACE by the success/error toast under the same id. That is
     * one toast, not a spinner plus a receipt — this file's own rule at
     * `applyViewPresetById` ("two toasts for one click reads as a stutter")
     * applies to the export itself, so the announcement and the outcome are the
     * same object. The button label is untouched and stays the cancel
     * affordance. */
    const toastId = `fs-video-export-${run}`
    toast.loading("Rendering the film…", {
      id: toastId,
      description:
        "Every frame is rendered and encoded one at a time, so this takes a few seconds. " +
        "The file downloads on its own when it is done.",
    })
    let lastPct = -1
    let framesGrabbed = 0
    setExportingVideo(true)
    setVideoDone(0)
    setVideoTotal(0)
    /* PAUSE FIRST. The playback controller advances `playheadRef` on its own
     * rAF; leaving it running would race the seek and put a frame or two of the
     * file at whatever instant the transport had drifted to. */
    setPlaying(false)
    try {
      const res = await exportAnimation({
        penDurationMs: exportMs,
        timebase: videoTimebase,
        fixedDurationMs: videoFixedSeconds * 1000,
        fps: videoFps,
        scale: videoScale,
        transparent: priorGround ? true : videoTransparent,
        /* Only the parked control forces the container: the shipped path is
         * `auto`, which is WebM where WebCodecs exists and APNG where it does
         * not — and APNG unconditionally when the user asks for transparency,
         * because a video cannot carry alpha and the module refuses to write an
         * opaque file with a transparent label. */
        format: priorGround ? "webm" : "auto",
        /* THE TRANSPORT IS PART OF THE PICTURE. Speed, Reverse and Delay are
         * what the user judged the animation with, so the film is exported with
         * them rather than with a second set of defaults nobody chose. Loop is
         * deliberately NOT passed: a loop is a property of playback, and a file
         * that repeats itself N times is a longer file, not a looping one. */
        speed,
        reverse: revealReverse,
        leadInMs: revealDelaySeconds * 1000,
        /* THE HOLD IS NOT PADDING. Every completion-keyed behaviour in the app
         * — the completion pulse, `delayedAfterReveal`, the stack's
         * freeze-on-complete — only has anything to show AFTER the reveal
         * reaches 1. An export that stops on the last drawn frame cuts off the
         * layer the user just spent their time choosing. */
        holdMs: 600,
        /* 🔴 WHAT THE REVEAL SHOWS AT THE CLOCK'S TWO ENDS — `frame-plan.ts` §W.
         *
         * The hold above is only "not padding" while clock 1 is the finished
         * mark, and that is false in FIVE of the eight (window mode × Reverse)
         * states this app can reach: `travel`, `vanish` and `shrink` all end on
         * an empty page, and the transport's Reverse — which has shipped since
         * long before the window existed — flips the CLOCK and not the PHASE, so
         * it puts clock 0 on the `hold` frames of anything that started empty.
         * Without this line the plan assumes `grow` and welds 18 frames of blank
         * paper at 30 fps onto the tail of a file the user is going to post.
         *
         * `reverse` is deliberately NOT pre-applied here: `planFrames` applies it
         * to the ends itself, because flipping the clock is that file's own
         * arithmetic and a caller that guessed at it would get it wrong.
         * Explainer 38; the module-side proof is `assert-export-window.mjs` §A5,
         * the proof at THIS button is its §D. */
        /* F118 TRAVEL-5: a seamless Travel ends on `[1-L, 1]`, not on empty
         * paper, and a forward export is an opening pass (`openingRef` below). */
        ...(revealEndsLaw === "wired"
          ? { revealEnds: revealEndsFor(seamWindow.mode, { seamless: seamWindow.seamless === true, opening: !revealReverse }) }
          : {}),
        markName: exportName,
        hasAnimatedStyleLayer,
        signal: controller.signal,
        /* `undefined` means "the module's own default", which for an opaque
         * container is `EXPORT_PAPER`. Only the parked control passes `null`. */
        background: priorGround ? null : undefined,
        host: {
          seek: (p) => {
            /* THE SAME THREE WRITES `__revealHarness.setProgress` MAKES, and in
             * the same order — clock first so a Play after an export does not
             * jump, then the ref the frame loop actually reads, then the UI
             * state. Written out rather than calling the dev harness because
             * that global does not exist in a production build and an export
             * that only works in dev is not an export. */
            clockRef.current = unEaseReveal(p, revealEaseRef.current)
            playheadRef.current = p
            setProgress(p)
          },
          easePlayhead: (c) => easeReveal(c, revealEaseRef.current),
          ...(clockLaw === "drive"
            ? { setSceneTimeMs: (ms: number) => { STYLE_CLOCK_DRIVE.exactMs = ms } }
            : {}),
          /* TWO rAFs, NOT ONE. The first lets React commit the `setProgress`
           * above and R3F run one `useFrame` with the new playhead and the new
           * driven clock; the second guarantees that frame's uniform writes are
           * the ones `renderStill` reads. `grabCanvas` calls `gl.render`
           * itself, so it never waits for a frame of its own. */
          settle: async () => {
            await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
            if (stallMs > 0) {
              const until = performance.now() + stallMs
              while (performance.now() < until) {
                /* A BUSY WAIT ON PURPOSE. A `setTimeout` would yield the main
                 * thread and R3F would keep ticking, which is the opposite of
                 * the condition being simulated — a frame that is EXPENSIVE. */
              }
            }
          },
          grabFrame: (o) => {
            /* ── THE FAILURE PATH, MADE REACHABLE ────────────────────────────
             * A file-writing action has to report failure honestly rather than
             * silently, and until this law there was no way to SEE it do that:
             * every reachable state of this export succeeded. `grabCanvas`
             * returning null mid-run is a genuine failure mode (a lost GL
             * context does it), and the recorder answers it with a real message
             * — "export: the renderer returned no frame at index N",
             * lib/export/recorder.ts:135 — which the catch below turns into the
             * error toast, replacing the progress toast in place rather than
             * leaving it hanging at 62 %.
             *
             * `window.__fsExportFailAtFrame = N` in dev only; unset is 0 and 0
             * is off. Same shape as `__fsExportStallMs` a few lines up.
             *
             * N COUNTS GRABS, NOT PLAN FRAMES, and the two differ by one:
             * `exportAnimation` takes ONE probe grab before the loop to size the
             * encoder (lib/export/index.ts:118, "thrown away"), so N=1 kills the
             * probe — a different and also real message, "the renderer produced
             * no frame — is anything drawn?" — and N>=2 kills plan index N-2.
             * Measured, not assumed: N=3 → "index 1", N=5 → "index 3". */
            framesGrabbed++
            const failAt =
              process.env.NODE_ENV !== "production" && typeof window !== "undefined"
                ? Number((window as unknown as Record<string, unknown>).__fsExportFailAtFrame) || 0
                : 0
            if (failAt > 0 && framesGrabbed >= failAt) return Promise.resolve(null)
            const shot = grabCanvas({ scale: o.scale, transparent: o.transparent })
            return Promise.resolve(
              shot ? ({ kind: "canvas" as const, canvas: shot.canvas, width: shot.width, height: shot.height }) : null,
            )
          },
        },
        onProgress: (done, total) => {
          setVideoDone(done)
          setVideoTotal(total)
          /* THROTTLED TO WHOLE PERCENT. `onProgress` fires once per frame and a
           * 141-frame export at 30 fps would otherwise push 141 toast updates
           * through the same renderer the lag pass just spent a day taking
           * work out of. Percent is also the granularity a human can read. */
          const pct = total > 0 ? Math.round((done / total) * 100) : -1
          if (pct !== lastPct) {
            lastPct = pct
            toast.loading(`Rendering the film, ${pct}%`, {
              id: toastId,
              description: `Frame ${done} of ${total}. The file downloads on its own when it is done.`,
            })
          }
        },
      })

      const filename = exportFilename(res.encoderId === "webm" ? "webm" : "png", "anim")
      download(res.blob, filename)
      /* SAME ID — this REPLACES the progress toast rather than stacking under
       * it, so the thing that said "rendering" is the thing that says where the
       * file went. */
      toast.success("Saved " + filename, {
        id: toastId,
        description: `${res.summary} · ${formatBytes(res.blob.size)}${
          res.warnings.length ? `. ${res.warnings.join(" ")}` : ""
        }`,
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        /* ⚠ DISMISS-THEN-RAISE, AND NOT `toast(msg, { id })` — THAT LEAVES A
         * SPINNER THAT NEVER GOES AWAY.
         *
         * Sonner's store MERGES an update over the existing toast
         * (`{...existing, ...incoming}`, node_modules/sonner/dist/index.mjs), and
         * a key the incoming object does not carry is not cleared. `toast.error`
         * and `toast.success` both pass `type`, so they overwrite the
         * `type: "loading"` the progress toast set — but bare `toast()` and
         * `toast.message()` pass NO type at all. The cancelled export would
         * therefore have kept `type: "loading"`: the spinner keeps turning, the
         * infinite duration that goes with a loading toast is kept too, and the
         * one outcome where the user has already decided to stop is the one the
         * UI never stops telling them about.
         *
         * Read out of the shipped bundle rather than assumed, and driven:
         * `scripts/verify/_probe-video-route.mjs --cancel`. */
        toast.dismiss(toastId)
        toast("Export cancelled", {
          description: "Nothing was written. The film is unchanged and the playhead is back where it was.",
        })
      } else {
        console.error("[FreeStroke Export] video export failed:", err)
        /* THE FAILURE PATH LANDS ON THE SAME TOAST, and it names the reason. A
         * progress toast left hanging at 62 % with a separate error beside it is
         * the "appeared to hang" defect wearing a receipt. */
        toast.error("Video export failed", {
          id: toastId,
          description: err instanceof Error ? err.message : String(err),
        })
      }
    } finally {
      /* THE CLOCK GOES BACK, WHATEVER HAPPENED. A cancelled or failed export
       * that left `exactMs` set would freeze every animated layer on the page
       * at the last frame it wrote, and the user would have no way to know why
       * their texture had stopped drifting. */
      STYLE_CLOCK_DRIVE.exactMs = null
      playheadRef.current = playheadBefore
      clockRef.current = clockBefore
      openingRef.current = openingBefore
      setProgress(playheadBefore)
      videoAbortRef.current = null
      setExportingVideo(false)
    }
  }, [
    processedStrokes,
    exportMs,
    videoTimebase,
    videoFixedSeconds,
    videoFps,
    videoScale,
    videoTransparent,
    speed,
    revealReverse,
    revealDelaySeconds,
    /* THE WINDOW IS AN INPUT TO THE FILM NOW, so it is an input to this
     * callback. Without it a user who picks Vanish and presses Video before
     * anything else re-renders this hook would export the PREVIOUS window's
     * plan — the stale-closure class explainer 26 §13.1 already records one
     * control over, arriving here through a dependency array instead of a tick. */
    revealWindow,
    seamWindow,
    exportName,
    hasAnimatedStyleLayer,
    exportFilename,
    download,
    playheadRef,
    clockRef,
  ])

  /* PUBLISH THE API — after the export handlers, because it carries them.
   *
   * It has to live here and not up with the camera callbacks: `handleExportGLB`
   * and `handleExportPNG` are `const`s declared further down this function, so
   * naming them in a dependency array that is evaluated earlier in the same
   * render is a temporal-dead-zone ReferenceError, not a lint nit.
   *
   * Cleared on unmount so a caller holding the ref across a remount cannot
   * drive a camera that no longer exists — the viewport is dynamically imported
   * and does unmount (a lost GL context remounts it under a new key). */
  useEffect(() => {
    if (!apiRef) return
    apiRef.current = {
      bounds: apiBounds,
      frontView: apiFrontView,
      orbitView: apiOrbitView,
      focusView: apiFocusView,
      setSpin: (degPerSecond: number) =>
        setSpinDegPerSecond(Number.isFinite(degPerSecond) ? Math.max(0, degPerSecond) : 0),
      effectiveSpin: () => effectiveSpin,
      grab: apiGrab,
      exportGLB: handleExportGLB,
      exportPNG: handleExportPNG,
      exportVideo: handleExportVideo,
    }
    return () => {
      apiRef.current = null
    }
  }, [
    apiRef,
    apiBounds,
    apiFrontView,
    apiOrbitView,
    apiFocusView,
    apiGrab,
    effectiveSpin,
    handleExportGLB,
    handleExportPNG,
    handleExportVideo,
  ])

  /* WHAT THE FILE WILL ACTUALLY BE. Measured off the live container when the
   * panel opens rather than assumed, because the viewport is a flex child and
   * its size depends on which config strip the mode is showing. A resolution
   * picker that cannot tell you the resolution is a picker you have to guess
   * at — and it is also the only place the STILL_MAX_EDGE clamp can be
   * ANNOUNCED instead of silently applied. */
  const [stillSize, setStillSize] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    if (!pngPanelOpen) return
    /* The canvas, not the container: docked, the container also holds the
     * take panel and the camera row, and the still is the canvas. */
    const el = glCanvasRef.current ?? containerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setStillSize({ w: Math.round(r.width), h: Math.round(r.height) })
  }, [pngPanelOpen])
  /* A POPOVER THAT ONLY CLOSES BY CLICKING ITS OWN BUTTON IS A TRAP. Escape and
   * an outside click are the two dismissals every user already knows; the
   * listener is only mounted while the panel is open, so it costs nothing the
   * rest of the time. `pointerdown` rather than `click`, so a drag that starts
   * outside the panel dismisses it before the drag does anything odd. */
  const pngPanelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!pngPanelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPngPanelOpen(false)
    }
    const onDown = (e: PointerEvent) => {
      const el = pngPanelRef.current
      if (el && !el.contains(e.target as Node)) setPngPanelOpen(false)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("pointerdown", onDown, true)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("pointerdown", onDown, true)
    }
  }, [pngPanelOpen])
  /* THE VIDEO POPOVER'S DISMISSAL, and the mutual exclusion with the still's.
   * Both hang off the same bar and the same `pngPanelRef` container, so two
   * open at once would overlap each other; opening either closes the other. */
  useEffect(() => {
    if (!videoPanelOpen) return
    setPngPanelOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVideoPanelOpen(false)
    }
    const onDown = (e: PointerEvent) => {
      const el = pngPanelRef.current
      if (el && !el.contains(e.target as Node)) setVideoPanelOpen(false)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("pointerdown", onDown, true)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("pointerdown", onDown, true)
    }
  }, [videoPanelOpen])
  useEffect(() => {
    if (pngPanelOpen) setVideoPanelOpen(false)
  }, [pngPanelOpen])

  /* WHAT THE FILM WILL ACTUALLY BE, in the plan's own words.
   *
   * The same `planFrames` the export runs, called with the same inputs, so the
   * panel cannot describe a file the exporter would not produce. On the pen
   * timebase `describePlan` prints "— the time this took you to draw", which is
   * the product's whole argument spoken out loud in the one place a user is
   * deciding whether to press the button. */
  const videoPlanNote = useMemo(() => {
    if (totalDuration <= 0) return "Draw a stroke to see how long the film will be."
    const plan = planFrames({
      penDurationMs: exportMs,
      fps: videoFps,
      timebase: videoTimebase,
      fixedDurationMs: videoFixedSeconds * 1000,
      speed,
      reverse: revealReverse,
      leadInMs: revealDelaySeconds * 1000,
      holdMs: 600,
      /* THE SAME FACT THE EXPORT GETS, so the sentence in the panel and the file
       * on disk cannot disagree — this note exists to say what the film WILL be,
       * and a note computed from a different plan than the one that runs is a
       * confident lie. It is what makes `describeRevealEnds` reach a user:
       * "…128 frames · ends on empty paper, so there is no hold". The parked
       * `unwired` law is read here too, or the known-bad arm would ship a panel
       * that contradicts its own export. */
      ...(readDevLaw("__fsExportRevealEnds", ["unwired"], "wired") === "wired"
        ? { revealEnds: revealEndsFor(seamWindow.mode, { seamless: seamWindow.seamless === true, opening: !revealReverse }) }
        : {}),
    })
    return describePlan(plan)
  }, [exportMs, videoFps, videoTimebase, videoFixedSeconds, speed, revealReverse, revealDelaySeconds, revealWindow, seamWindow])

  /* THE DRAWER'S DOOR INTO THE DOCK. Until 2026-09-26 the draw-in controls
   * also lived in a Timing popover over the canvas, and its title once landed
   * at y = -10 on a 13-inch screen. They are a section of the dock now, and the
   * drawer's Animation tab opens it with this event, then the dock is scrolled
   * into view so the button never looks like it did nothing. */
  const animationPanelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const onOpen = () => {
      setDrawInOpen(true)
      requestAnimationFrame(() =>
        requestAnimationFrame(() => animationPanelRef.current?.scrollIntoView({ block: "nearest" })),
      )
    }
    window.addEventListener(OPEN_ANIMATION_PANEL_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_ANIMATION_PANEL_EVENT, onOpen)
  }, [])
  /* ESCAPE SHUTS THE DRAW-IN SECTION, AS IT SHUT THE TIMING POPOVER.
   *
   * The popover floated over the canvas, so opening it never resized the 3D
   * view. The section sits in the dock, and until PANEL-5 the dock below its 66%
   * cap was as tall as what the section showed, so the canvas, and every export
   * taken from it, followed the section's content. Measured in assert-export-window at
   * 1600 x 1500: with Escape doing nothing, the section stayed open after the
   * Window pill was set, the Grow films came out 798 x 544 and the Vanish films
   * 798 x 558, and 96 frames were compared against a reference of the wrong
   * shape. Main's films never changed shape. The open dock is a fixed 66% now
   * (see `data-animation-panel`), so no option inside the section moves the
   * canvas; Escape still shuts it, the canvas gets its height back, and the
   * export comes out at the closed dock's size, as it did under the popover. */
  useEffect(() => {
    if (!drawInOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawInOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [drawInOpen])

  /* WHAT THE BUTTON SAYS WHEN SOMETHING IS SET.
   *
   * A delay is INVISIBLE until you press Play and then nothing happens for two
   * seconds, which is indistinguishable from a hung app. Loop and reverse are
   * modal states you can watch for a whole pass without working out why the
   * mark is coming apart instead of going on. So the collapsed control carries
   * its own state rather than hiding it: the Draw-in section is where you SET
   * these, its header line is where you SEE them. */
  const timingSummary = useMemo(() => {
    const bits: string[] = []
    /* `DRAW IN` goes FIRST because it is the one that changes what you are
     * looking at rather than how fast you are looking at it, and because a
     * reordered draw with a collapsed panel is exactly the "why is the mark
     * coming apart" state the block above exists to stop. */
    const sched = describeDrawIn(drawIn, revealWindow)
    if (sched) bits.push(sched)
    if (drawIn.unit === "stroke" && (drawIn.order !== "asDrawn" || drawIn.overlap > 0))
      bits.push("per stroke")
    if (revealDelaySeconds > 0) bits.push(`${revealDelaySeconds.toFixed(1)}s`)
    /* DRAWIN-CURVE: a shaped curve has no preset label, so find() would come back empty. */
    if (typeof revealEase === "object") bits.push("custom ease")
    else if (revealEase !== "linear") bits.push(REVEAL_EASES.find((e) => e.id === revealEase)!.label.toLowerCase())
    if (revealReverse) bits.push("reverse")
    if (revealLoop) bits.push("loop")
    return bits.join(" · ")
  }, [drawIn, revealWindow, revealDelaySeconds, revealEase, revealReverse, revealLoop])

  /* WHAT THE MODEL MADE OF THE STROKES ON SCREEN — the panel's own honest
   * readout, in the shape `measureTimingCharacter`'s ±% already established: a
   * control that cannot say what it is acting on leaves the user to conclude it
   * is dead. `unit: group` on a drawing whose strokes never touch is `n` groups
   * of one, and the panel says so rather than implying a grouping happened. */
  const drawInUnitCount = useMemo(
    () => countDrawInUnits(processedStrokes, drawIn.unit, solidParams),
    [processedStrokes, drawIn.unit, solidParams],
  )

  const stillPixelNote = useMemo(() => {
    const note = PNG_SCALES.find((s) => s.value === pngScale)?.note ?? ""
    if (!stillSize || stillSize.w < 1) return note
    const cap = STILL_MAX_EDGE / Math.max(stillSize.w, stillSize.h)
    const eff = Math.max(1, Math.min(pngScale, cap))
    const w = Math.round(stillSize.w * eff)
    const h = Math.round(stillSize.h * eff)
    return eff < pngScale
      ? `${w} × ${h} px, capped from ${pngScale}× at the ${STILL_MAX_EDGE}px canvas limit`
      : `${w} × ${h} px, ${note}`
  }, [pngScale, stillSize])

  const THREE_UP_MODES: { mode: RevealMode; label: string }[] = [
    { mode: "raw", label: "RAW" },
    { mode: "hybrid", label: "HYBRID" },
    { mode: "smooth", label: "SMOOTH" },
  ]

  // Dummy boundsRef/exportGroupRef for slave canvases (not used for export)
  const slaveBoundsRef1 = useRef<StrokeBounds | null>(null)
  const slaveBoundsRef2 = useRef<StrokeBounds | null>(null)
  const slaveExportRef1 = useRef<THREE.Group | null>(null)
  const slaveExportRef2 = useRef<THREE.Group | null>(null)

  /* THE DOCK LEFT THE VIEWPORT (L3, BUILD-PLAN.md §5). Until L3 the take
   * panel docked in flow under this canvas (ANIM-3C) and the export bar sat at
   * its bottom right, in a 64 px band the canvas gave up for them. They render
   * in the page's dock panels now, under both the Drawing and the 3D view, and
   * the canvas takes the panel's whole box; Top and Reset camera float on it.
   * The state and the handlers stay here, next to the renderer they drive:
   * each control is portalled into the host its panel registers
   * (`components/workspace/dock-hosts.tsx`).
   *
   * A host with no dock on the page keeps the floating card over the canvas
   * and the export bar beside the camera buttons. `chromeless` shows neither. */
  const hasDock = useHasDock()
  const docked = hasDock && !chromeless
  const transportHost = useDockHost("transport")
  const timelineHost = useDockHost("timeline")
  const drawInHost = useDockHost("drawin")
  const drawInSummaryHost = useDockHost("drawin-summary")
  const exportHost = useDockHost("export")

  const transportProps: TransportRowProps = {
    progressStore,
    totalDuration,
    playing,
    onPlayPause: handlePlayPause,
    onScrub: handleScrub,
    revealMode,
    setRevealMode,
    comparing,
    timingCharacter,
    speed,
    setSpeed,
    debugSurfaceAllowed,
    showDebug,
    onToggleDebug: () => setShowDebug((v) => !v),
    hybridBlend,
    setHybridBlend,
    onSmooth: () => setModeOverride("smooth"),
    compare3Up,
    onCompareToggle: handleCompareToggle,
    onToggle3Up: () => {
      setCompare3Up((v) => !v)
      if (!compare3Up && comparing) {
        setComparing(false)
        setPlaying(false)
        setCompareLabel("")
      }
    },
  }
  const drawInControls = {
    drawIn,
    patchDrawIn,
    drawInUnitCount,
    strokeCount: processedStrokes.length,
    revealWindow,
    patchWindow,
    envelope: revealEnvelope,
    patchEnvelope,
    onEase: handleEaseChange,
    flatten,
    patchFlatten: onFlattenChange ? patchFlatten : undefined,
  }
  /* THE TAKE, AS A PICTURE. Map §3 item 11, "see the timing". A VIEW of what
     `DRAW IN` and `WINDOW` produce (§9 pick 3), never an authoring surface. */
  const takeTimeline = (
    <LiveTakeTimeline
      progressStore={progressStore}
      strokes={processedStrokes}
      drawIn={drawIn}
      revealWindow={seamWindow}
      openingRef={openingRef}
      inkThickness={(solidParams ?? DEFAULT_SOLID_PARAMS).thickness}
      mode={revealMode}
      hybridBlend={hybridBlend}
      ease={revealEase}
      unEase={unEaseReveal}
      totalDurationMs={totalDuration}
    />
  )
  const timingNote = (
    <TimingNote open={timingNoteOpen} setOpen={setTimingNoteOpen} timingCharacter={timingCharacter} hybridBlend={hybridBlend} />
  )
  const exportProps: ExportPanelProps = {
    containerRef: pngPanelRef,
    docked,
    exportName,
    setExportName,
    strokeCount,
    compare3Up,
    onExportPNG: handleExportPNG,
    exportingPng,
    pngScale,
    setPngScale,
    pngScales: PNG_SCALES,
    stillPixelNote,
    pngTransparent,
    setPngTransparent,
    pngPanelOpen,
    setPngPanelOpen,
    onExportVideo: handleExportVideo,
    onAbortVideo: () => videoAbortRef.current?.abort(),
    exportingVideo,
    videoDone,
    videoTotal,
    videoPlanNote,
    videoTimebase,
    setVideoTimebase,
    videoFixedSeconds,
    setVideoFixedSeconds,
    videoFps,
    setVideoFps,
    videoScale,
    setVideoScale,
    videoTransparent,
    setVideoTransparent,
    videoPanelOpen,
    setVideoPanelOpen,
    hasAnimatedStyleLayer,
    onExportGLB: handleExportGLB,
    exporting,
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full"
      style={
        captureMode
          ? {
              position: "fixed",
              top: 0,
              left: 0,
              width: `${captureWidth}px`,
              height: `${captureHeight}px`,
              background: "transparent",
              zIndex: 9999,
            }
          : undefined
      }
    >
      {compare3Up ? (
        /* ---- 3-Up side-by-side view ---- */
        <div className="grid h-full w-full grid-cols-3">
          {THREE_UP_MODES.map((item, idx) => {
            const isMaster = idx === 0
            const bRef = idx === 0 ? boundsRef : idx === 1 ? slaveBoundsRef1 : slaveBoundsRef2
            const eRef = idx === 0 ? exportGroupRef : idx === 1 ? slaveExportRef1 : slaveExportRef2
            return (
              <div key={item.mode} className="relative border-r border-border last:border-r-0">
                <ViewportErrorBoundary>
                  <Canvas
                    /* THE MASTER IS THE GRAB'S SUBJECT, SAID OUT LOUD. The old
                     * `querySelector("canvas")` picked this same panel because
                     * it is first in the grid, which is a fact about the grid.
                     * See `glCanvasRef`. */
                    ref={isMaster ? glCanvasRef : undefined}
                    camera={{
                      position: [
                        INITIAL_CAMERA_POSITION.x,
                        INITIAL_CAMERA_POSITION.y,
                        INITIAL_CAMERA_POSITION.z,
                      ],
                      fov: 50,
                    }}
                    gl={{ preserveDrawingBuffer: true }}
                    style={{ background: "#fafafa" }}
                  >
                    <Scene
                      controlsRef={isMaster ? controlsRef : { current: null }}
                      keyReader={keyReader}
                      orbitView={isMaster ? apiOrbitView : undefined}
                      keyLiveRef={isMaster ? keyLiveRef : undefined}
                      strokes={processedStrokes}
                      rawStrokes={rawStrokes}
                      canvasWidth={canvasWidth}
                      canvasHeight={canvasHeight}
                      geometryMode={geometryMode}
                      extrudeParams={extrudeParams}
                      solidParams={solidParams}
                      inflateParams={inflateParams}
                      revealMode={item.mode}
                      hybridBlend={hybridBlend}
                      boundsRef={bRef}
                      exportGroupRef={eRef}
                      playheadRef={playheadRef}
                      playing={playing}
                      speed={speed}
                      totalDuration={totalDuration}
                      onProgressUpdate={isMaster ? onProgressUpdate : () => {}}
                      orbitEnabled={isMaster}
                      /* Compare mode: only the master carries controls, so only
                         the master can spin — the slaves copy its camera. */
                      autoRotateDegPerSecond={isMaster ? effectiveSpin : 0}
                      masterControlsRef={isMaster ? undefined : controlsRef}
                      meshStatusRef={meshStatusRef}
                      solidStatusRef={solidStatusRef}
                      extrudeDebugRef={isMaster ? extrudeDebugRef : undefined}
                      styleState={styleState}
                      lighting={lighting}
                      engineFamily={engineFamily}
                      /* The 3-Up compare varies ONE axis — the reveal mode — so
                         the schedule is the same on all three panels, exactly
                         like every other dial. */
                      drawIn={drawIn}
                      revealWindow={revealWindow}
                      take={take}
                      takeKnockout={takeKnockout}
                      onTimed={isMaster ? onTimed : undefined}
                    />
                  </Canvas>
                </ViewportErrorBoundary>
                {/* Panel label */}
                <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-background/80 px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground backdrop-blur-sm">
                  {item.label}
                  {item.mode === "hybrid" && (
                    <span className="ml-1 font-normal text-muted-foreground">
                      ({hybridBlend.toFixed(2)})
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ---- Single viewport ----
           The pane is the whole panel since L3: the dock is not in here any
           more, so R3F's own wrapper fills it at 100%. */
        <div className="relative h-full w-full">
          <ViewportErrorBoundary>
            <Canvas
              /* A NEW KEY IS A NEW GL CONTEXT — the recovery path for a lost
                 one. It never changes on its own; only "Restart the view" in
                 the overlay below moves it. */
              key={glGeneration}
              /* WHAT `grab()` MEANS. Not "the first canvas under the container"
               * — this element. See `glCanvasRef`. */
              ref={glCanvasRef}
              dpr={captureMode ? 1 : undefined}
              /* THE PROJECTION. `Viewport3DProps.projection` carries the whole
               * reasoning; the short version is that a perspective yaw of an
               * object extended along its own axis of rotation MOVES the
               * projected centre of its silhouette, and the hero beat's one
               * moment is defined by that centre not moving. R3F builds the
               * camera from this flag, which is why it is read once at mount.
               *
               * `near`/`far` are symmetric about the origin rather than the
               * perspective pair: an orthographic frustum has uniform depth
               * precision, so a generous slab costs nothing and nothing can
               * clip whatever distance a framing helper picks. */
              orthographic={affine}
              camera={
                affine
                  ? {
                      position: [
                        INITIAL_CAMERA_POSITION.x,
                        INITIAL_CAMERA_POSITION.y,
                        INITIAL_CAMERA_POSITION.z,
                      ],
                      zoom: 1,
                      near: -1000,
                      far: 1000,
                    }
                  : {
                      position: [
                        INITIAL_CAMERA_POSITION.x,
                        INITIAL_CAMERA_POSITION.y,
                        INITIAL_CAMERA_POSITION.z,
                      ],
                      fov: CAMERA_FOV_DEG,
                    }
              }
              gl={{ preserveDrawingBuffer: true, alpha: true }}
              style={{ background: captureMode ? "transparent" : "#fafafa" }}
            >
              <Scene
                take={take}
                takeKnockout={takeKnockout}
                onTimed={onTimed}
                keyReader={keyReader}
                orbitView={apiOrbitView}
                keyLiveRef={keyLiveRef}
                controlsRef={controlsRef}
                strokes={processedStrokes}
                rawStrokes={rawStrokes}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
                geometryMode={geometryMode}
                extrudeParams={extrudeParams}
                solidParams={solidParams}
                inflateParams={inflateParams}
                revealMode={revealMode}
                hybridBlend={hybridBlend}
                boundsRef={boundsRef}
                exportGroupRef={exportGroupRef}
                playheadRef={playheadRef}
                revealRef={revealRef}
                playing={playing}
                speed={speed}
                totalDuration={totalDuration}
                onProgressUpdate={onProgressUpdate}
                autoRotateDegPerSecond={effectiveSpin}
                clockRef={clockRef}
                openingRef={openingRef}
                revealEase={revealEase}
                revealCadence={revealCadence}
                revealDelaySeconds={revealDelaySeconds}
                revealLoop={revealLoop}
                revealReverse={revealReverse}
                onReachedEnd={handleReachedEnd}
                meshStatusRef={meshStatusRef}
                solidStatusRef={solidStatusRef}
                extrudeDebugRef={extrudeDebugRef}
                styleState={styleState}
                lighting={lighting}
                engineFamily={engineFamily}
                flatten={flatten}
                letterMap={letterMap}
                drawIn={drawIn}
                revealWindow={revealWindow}
                hideGrid={captureMode}
                stillExport
              />
            </Canvas>
          </ViewportErrorBoundary>
          {/* Suppressed for a host that owns its own chrome, and for the
              transparent capture target — both would be filming it. */}
          {!chromeless && !captureMode && (
            <ViewportEmptyState visible={strokeCount === 0} />
          )}
          {contextLost && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-xl border border-border bg-background p-5 text-center shadow-lg">
                <p className="text-sm font-semibold text-foreground">
                  The graphics context was lost
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  The browser took the GPU context away. Usually a driver reset
                  or too many 3D canvases open at once. Your strokes are safe;
                  restarting the view rebuilds the form from them.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setContextLost(false)
                    setGlGeneration((g) => g + 1)
                  }}
                  className="fs-press mt-3 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                >
                  Restart the view
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Debug overlay (only when debug mode is on).
          Rendered as a dismissible, scrollable popup so it never overflows or
          covers the whole 3D canvas: capped width + max-height, its own scroll,
          and a close (X) button in a sticky header. */}
      {showDebug && (
        <div className="pointer-events-auto absolute left-3 top-3 flex max-h-[calc(100%-1.5rem)] w-64 flex-col overflow-hidden rounded-lg border border-border bg-background/90 font-mono text-[10px] leading-tight text-muted-foreground shadow-lg backdrop-blur-sm">
          <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-border/60 bg-background/80 px-2.5 py-1.5 backdrop-blur-sm">
            <span className="font-semibold text-foreground">Debug</span>
            <button
              type="button"
              onClick={() => setShowDebug(false)}
              aria-label="Close debug panel"
              className="flex h-5 w-5 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" />
              </svg>
            </button>
          </div>
          <div className="overflow-y-auto px-2.5 py-1.5">
          <div>strokes: {strokeCount}</div>
          <div>points: {totalPoints}</div>
          <div>duration: {(totalDuration / 1000).toFixed(1)}s</div>
          <div>reveal: {revealMode === "hybrid" ? `Hybrid(${hybridBlend.toFixed(2)})` : revealMode}</div>
          {compare3Up && <div className="font-semibold text-foreground">3-Up Compare</div>}
          {comparing && compareLabel && (
            <div className="mt-0.5 font-semibold text-foreground">Compare: {compareLabel}</div>
          )}
          {/* Style substrate readout (Phase 1). Debug-only. Reflects the
              style state passed from the app; none of these values feed
              geometry/animation/export yet. */}
          {styleState && (
            <div className="mt-1 border-t border-border/50 pt-1">
              <div className="font-semibold text-foreground">Style substrate:</div>
              <div className="mt-0.5 text-foreground/80">— Material (surface response) —</div>
              <div>activeMaterialPreset: {styleState.materialPreset}</div>
              <div>modeMaterialDefault: {MODE_MATERIAL_DEFAULTS[geometryMode]}</div>
              <div>userMaterialOverride: {String(styleState.materialUserOverride)}</div>
              {(() => {
                const isCustom = styleState.materialPreset === "custom"
                const p = resolveMaterialParams(styleState.materialPreset, styleState.customMaterial)
                const cm = styleState.customMaterial
                const animOn =
                  styleState.materialAnimationEnabled &&
                  styleState.materialAnimationType !== "none"
                return (
                  <>
                    <div>activeMaterialPreset: {styleState.materialPreset}</div>
                    <div>
                      materialSource:{" "}
                      {isCustom ? "custom" : styleState.materialUserOverride ? "preset" : "modeDefault"}
                    </div>
                    <div>materialAppliedToMode: {geometryMode}</div>
                    {/* All modes render through the single shared liveMaterial,
                        so application is uniform by construction. */}
                    <div>materialAppliedToRod: YES</div>
                    <div>materialAppliedToExtrude: YES</div>
                    <div>materialAppliedToSolid: YES</div>
                    <div>materialAppliedToInflate: YES</div>
                    <div>materialColor: {p.color}</div>
                    <div>materialRoughness: {p.roughness.toFixed(2)}</div>
                    <div>materialMetalness: {p.metalness.toFixed(2)}</div>
                    <div>materialClearcoat: {p.clearcoat.toFixed(2)}</div>
                    <div>materialEnvMapIntensity: {p.envMapIntensity.toFixed(2)}</div>
                    <div>customMaterialActive: {isCustom ? "YES" : "NO"}</div>
                    {isCustom && (
                      <div>
                        customMaterialValues: c={cm.color} r={cm.roughness.toFixed(2)} m=
                        {cm.metalness.toFixed(2)} cc={cm.clearcoat.toFixed(2)} ei=
                        {cm.emissiveIntensity.toFixed(2)} env={cm.envMapIntensity.toFixed(2)}
                      </div>
                    )}
                    <div>materialAnimationEnabled: {String(styleState.materialAnimationEnabled)}</div>
                    <div>materialAnimationType: {styleState.materialAnimationType}</div>
                    {/* Animated material is applied in the shared useFrame loop,
                        so it reads on every mode (not Inflate-only). */}
                    <div>materialAnimationAppliesToCurrentMode: {animOn ? "YES" : "NO"}</div>
                    <div>materialAnimationVisibleEnough: {animOn ? "YES" : "NO"}</div>
                    <div>materialAnimationDistinctFromOtherTypes: YES</div>
                    <div>materialAnimationSpeed: {styleState.materialAnimationSpeed.toFixed(2)}</div>
                    <div>materialAnimationIntensity: {styleState.materialAnimationIntensity.toFixed(2)}</div>
                    <div>
                      syncToDrawAffectsMaterialAnimation:{" "}
                      {styleState.motionMode === "syncToDraw" ? "YES" : "NO"}
                    </div>
                    <div>materialDoesNotTouchGeometry: YES</div>
                    <div className="mt-0.5 text-foreground/80">— Future custom IA (reserved) —</div>
                    <div>futureCustomTextureReserved: YES</div>
                    <div>futureCustomDitherReserved: YES</div>
                    <div>futureCustomAsciiReserved: YES</div>
                    <div>futureCustomAnimationReserved: YES</div>
                    <div>futureCustomFusionReserved: YES</div>
                  </>
                )
              })()}
              <div className="mt-0.5 text-foreground/80">— Texture (procedural patterning only) —</div>
              <div>textureRendererImplemented: YES (v1)</div>
              <div>textureMode: {styleState.textureMode}</div>
              <div>textureEnabled: {String(styleState.textureEnabled)}</div>
              <div>textureAnimated: {String(styleState.textureAnimated)}</div>
              <div>textureTypeIndex: {TEXTURE_TYPE_INDEX[styleState.textureMode]}</div>
              <div>textureScale: {styleState.textureScale.toFixed(2)}</div>
              <div>textureIntensity: {styleState.textureIntensity.toFixed(2)}</div>
              <div>textureContrast: {styleState.textureContrast.toFixed(2)}</div>
              <div>textureSpeed: {styleState.textureSpeed.toFixed(2)}</div>
              <div>textureDirection: {styleState.textureDirection}</div>
              <div>textureLockMode: {styleState.textureLockMode}</div>
              <div>textureAppliedToAllModes: YES (shared material)</div>
              <div>textureDoesNotTouchGeometry: YES</div>
              <div>
                textureAnimationClock:{" "}
                {styleState.motionMode === "syncToDraw"
                  ? "revealProgress"
                  : styleState.motionMode === "independent"
                    ? "elapsedTime"
                    : "off (static)"}
              </div>
              <div>textureIsNotDither: YES (pattern, no threshold logic)</div>
              <div>textureIsNotAscii: YES (pattern, no glyphs)</div>
              <div className="mt-0.5 text-foreground/80">— Dither (separate system) —</div>
              <div>ditherRendererImplemented: YES (v1)</div>
              <div>ditherEnabled: {String(styleState.ditherEnabled)}</div>
              <div>ditherAnimated: {String(styleState.ditherAnimated)}</div>
              <div>ditherType: {styleState.ditherType}</div>
              <div>ditherTypeIndex: {DITHER_TYPE_INDEX[styleState.ditherType]}</div>
              <div>ditherScale (cell): {styleState.ditherScale.toFixed(1)}</div>
              <div>ditherLevels: {styleState.ditherLevels}</div>
              <div>ditherThreshold: {styleState.ditherThreshold.toFixed(2)}</div>
              <div>ditherContrast: {styleState.ditherContrast.toFixed(2)}</div>
              <div>ditherIntensity: {styleState.ditherIntensity.toFixed(2)}</div>
              <div>ditherDirection: {styleState.ditherDirection}</div>
              <div>ditherLockMode: {styleState.ditherLockMode}</div>
              <div>ditherStage: after lighting (dithering_fragment)</div>
              <div>
                ditherAnimationKind:{" "}
                {styleState.ditherDirection === "static" ? "threshold-bias sweep" : "matrix crawl"}
              </div>
              <div>ditherAppliedToAllModes: YES (shared material)</div>
              <div>ditherDoesNotTouchGeometry: YES</div>
              <div>ditherIsNotTexture: YES (threshold, not pattern)</div>
              <div>ditherIsNotAscii: YES (threshold, not glyphs)</div>
              <div className="mt-0.5 text-foreground/80">— ASCII (separate system) —</div>
              <div>asciiRendererImplemented: YES (v1)</div>
              <div>asciiEnabled: {String(styleState.asciiEnabled)}</div>
              <div>asciiAnimated: {String(styleState.asciiAnimated)}</div>
              <div>asciiCharset: {styleState.asciiCharset}</div>
              <div>asciiCharsetIndex: {ASCII_CHARSET_INDEX[styleState.asciiCharset]}</div>
              <div>asciiAnimationType: {styleState.asciiAnimationType}</div>
              <div>asciiCellSize: {styleState.asciiCellSize}</div>
              <div>asciiDensity: {styleState.asciiDensity.toFixed(2)}</div>
              <div>asciiContrast: {styleState.asciiContrast.toFixed(2)}</div>
              <div>asciiScrollSpeed: {styleState.asciiScrollSpeed.toFixed(2)}</div>
              <div>asciiDirection: {styleState.asciiDirection}</div>
              <div>asciiLockMode: {styleState.asciiLockMode}</div>
              <div>asciiGlyphSource: 5x5 bitfield (no font, no atlas)</div>
              <div>asciiStage: after dither (glyphs represent reduced tone)</div>
              <div>asciiAppliedToAllModes: YES (shared material)</div>
              <div>asciiDoesNotTouchGeometry: YES</div>
              <div>asciiIsNotTexture: YES (glyphs, not pattern)</div>
              <div>asciiIsNotDither: YES (glyphs, not threshold)</div>
              <div className="mt-0.5 text-foreground/80">— Motion (style animation) —</div>
              <div>timingSystemImplemented: YES (v1, shared clock)</div>
              <div>motionMode: {styleState.motionMode}</div>
              <div>styleClockElapsed: {STYLE_CLOCK_DEBUG.elapsed.toFixed(2)}</div>
              <div>styleClockReveal: {STYLE_CLOCK_DEBUG.reveal.toFixed(3)}</div>
              <div>
                sinceCompletion:{" "}
                {STYLE_CLOCK_DEBUG.sinceCompletion !== Infinity
                  ? STYLE_CLOCK_DEBUG.sinceCompletion.toFixed(2) + "s"
                  : "not complete"}
              </div>
              <div>styleLoopSeconds: {styleState.styleLoopSeconds.toFixed(1)}</div>
              <div>textureSyncMode: {styleState.textureSyncMode} (+{styleState.textureDelay.toFixed(1)}s)</div>
              <div>ditherSyncMode: {styleState.ditherSyncMode} (+{styleState.ditherDelay.toFixed(1)}s)</div>
              <div>asciiSyncMode: {styleState.asciiSyncMode} (+{styleState.asciiDelay.toFixed(1)}s)</div>
              <div>layersShareOneClock: YES</div>
              <div className="mt-0.5 text-foreground/80">— Layer stack —</div>
              <div>stackRendererImplemented: YES (v1)</div>
              <div>layerStackEnabled: {String(styleState.layerStackEnabled)}</div>
              <div>stackOrder: {styleState.stackOrder}</div>
              <div>stackTextureOpacity: {styleState.stackTextureOpacity.toFixed(2)}</div>
              <div>
                stackDither: {styleState.stackDitherOpacity.toFixed(2)} / {styleState.stackDitherBlend}
              </div>
              <div>
                stackAscii: {styleState.stackAsciiOpacity.toFixed(2)} / {styleState.stackAsciiBlend}
              </div>
              <div>textureIsAlwaysBase: YES (pre-lighting, not reorderable)</div>
              <div className="mt-0.5 text-foreground/80">— Stack animation (the GROUP) —</div>
              <div>stackAnimationImplemented: YES (v1)</div>
              <div>stackAnimationEnabled: {String(styleState.stackAnimationEnabled)}</div>
              <div>stackAnimationType: {styleState.stackAnimationType}</div>
              <div>stackAnimationSpeed: {styleState.stackAnimationSpeed.toFixed(2)}</div>
              <div>groupAmount: {STYLE_CLOCK_DEBUG.groupAmount.toFixed(3)}</div>
              <div>groupTimeOffset: {STYLE_CLOCK_DEBUG.groupOffset.toFixed(2)}</div>
              <div>groupFrozen: {String(STYLE_CLOCK_DEBUG.groupFrozen)}</div>
              <div>stackAnimIsNotPerLayerAnim: YES (moves the group, not one layer)</div>
              <div>stackAnimationPhase: {styleState.stackAnimationPhase.toFixed(2)}</div>
              <div className="mt-0.5 text-foreground/80">— Composite (renderers later) —</div>
              <div>layerStackEnabled: {String(styleState.layerStackEnabled)}</div>
              <div>stackAnimationEnabled: {String(styleState.stackAnimationEnabled)}</div>
              <div>fusionPreset: {styleState.fusionPreset}</div>
              <div>fusionDrive: {resolveFusionDrive(styleState)}</div>
              <div>
                fusionLink: {styleState.fusionIntensity.toFixed(2)} / fusionSwing:{" "}
                {styleState.fusionSwing.toFixed(2)}
              </div>
              <div>styleClockElapsed: {STYLE_CLOCK_DEBUG.elapsed.toFixed(2)}</div>
              {(() => {
                const ap = findPreset(styleState.activePresetId)
                return (
                  <div className="mt-1 border-t border-border/30 pt-1">
                    <div className="font-semibold text-foreground">Active preset:</div>
                    <div>activePresetFamily: {styleState.activePresetFamily}</div>
                    <div>activePresetId: {styleState.activePresetId ?? "—"}</div>
                    <div>activePresetImplemented: {String(ap?.implemented ?? false)}</div>
                    <div>activePresetPreviewOnly: {String(ap?.previewOnly ?? false)}</div>
                    <div>activePresetBestModes: {ap?.bestModes?.join(", ") || "—"}</div>
                    <div>presetAppliesState: {ap?.applies ? Object.keys(ap.applies).join(", ") || "—" : "—"}</div>
                    <div>presetDoesNotTouchGeometry: YES</div>
                  </div>
                )
              })()}
            </div>
          )}
          {/* Extrude depth-trace diagnostic (extrude mode only).
              Proves whether the depth-slider rebuild path is alive end-to-end:
              if buildCount stays flat as you move the Depth slider, the memo
              isn't re-firing; if buildCount increments AND bboxZ changes, the
              rebuild is correct and any remaining staleness is downstream
              (camera angle / R3F prop swap / material). */}
          {geometryMode === "extrude" && extrudeDebugRef.current && (
            <div className="mt-1 border-t border-border/50 pt-1">
              <div className="font-semibold text-foreground">Extrude trace:</div>
              <div>widthSliderValue: {extrudeDebugRef.current.widthSliderValue.toFixed(3)}</div>
              <div>widthSliderPercent: {extrudeDebugRef.current.widthSliderPercent}%</div>
              <div>effectiveWidthUsed: {extrudeDebugRef.current.effectiveWidthUsed.toFixed(3)}</div>
              <div>effectiveWidthPercent: {extrudeDebugRef.current.effectiveWidthPercent}%</div>
              <div>strategy: {extrudeDebugRef.current.strategy}</div>
              <div>buildStatus: {extrudeDebugRef.current.buildStatus}</div>
              <div>depthMultiplierSliderValue: {extrudeDebugRef.current.depthParam.toFixed(2)}×</div>
              <div>effectiveDepthUsed: {extrudeDebugRef.current.effectiveDepthUsed.toFixed(3)}</div>
              <div>depthToWidthRatio: {extrudeDebugRef.current.depthToWidthRatio.toFixed(2)}</div>
              <div>previewBuildCount: {extrudeDebugRef.current.buildCount}</div>
              <div>geometryBBoxZ: {extrudeDebugRef.current.bboxZ.toFixed(3)}</div>
              <div>activeEngine: {extrudeDebugRef.current.activeEngine}</div>
            </div>
          )}
          
          {/* Per-stroke extrude build status (extrude mode only) */}
          {geometryMode === "extrude" && (meshStatusRef.current?.length ?? 0) > 0 && (
            <div className="mt-1 border-t border-border/50 pt-1">
              <div className="font-semibold text-foreground">Build status:</div>
              {(meshStatusRef.current ?? []).map((s, i) => (
                <div key={i} className={
                  s.type === "ok" ? "text-green-600"
                    : s.type === "bevelOff" ? "text-yellow-600"
                    : s.type === "bevelOffTinyWidth" ? "text-orange-500"
                    : "text-red-500"
                }>
                  {i}: {s.type === "ok"
                    ? `extrude strategy=${s.strategy} w=${s.width.toFixed(3)} mult=${s.depthMultiplier.toFixed(2)}× eff=${s.effectiveDepth.toFixed(3)} bevel=${s.bevelEnabled}`
                    : s.type === "bevelOff"
                    ? `extrude strategy=${s.strategy} w=${s.width.toFixed(3)} mult=${s.depthMultiplier.toFixed(2)}× eff=${s.effectiveDepth.toFixed(3)} bevel=off(retry)`
                    : s.type === "bevelOffTinyWidth"
                    ? `extrude strategy=${s.strategy} w=${s.width.toFixed(3)} mult=${s.depthMultiplier.toFixed(2)}× eff=${s.effectiveDepth.toFixed(3)} bevel=off(tiny)`
                    : `rod fallback strategy=${s.strategy} r=${s.fallbackRadius.toFixed(3)} (${s.reason}) mult=${s.depthMultiplier.toFixed(2)}× eff=${s.effectiveDepth.toFixed(3)}`}
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      )}

      {/* THE DOCK'S CONTROLS, in the dock's panels (L3). Suppressed under
          `chromeless`: a host that drives the reveal itself owns the clock, and
          a second transport reading a second timeline in the same frame is the
          defect, not a convenience. Docked, they show before the first stroke
          (plan 2026-09-26 §1): the dock is where the animation tools live, and
          a door that appears only after drawing is how he looked for them and
          found nothing. */}
      {docked && transportHost && createPortal(<TransportRow {...transportProps} docked />, transportHost)}
      {docked && timelineHost && createPortal(
        <div data-take-panel className="flex h-full min-h-0 flex-col">
          <div className="flex min-h-0 flex-1 flex-col">{takeTimeline}</div>
          {timingNote}
        </div>,
        timelineHost,
      )}
      {docked && drawInHost && drawInOpen && createPortal(<DrawInBody controls={drawInControls} docked />, drawInHost)}
      {docked && drawInSummaryHost && timingSummary && createPortal(
        <span data-animation-drawin-summary className="max-w-[12rem] truncate text-[10px] font-normal text-muted-foreground">
          {timingSummary}
        </span>,
        drawInSummaryHost,
      )}
      {docked && exportHost && createPortal(<ExportPanel {...exportProps} />, exportHost)}

      {/* NO DOCK ON THE PAGE: the floating card over the canvas, as before L3.
          `bottom-16` puts the card's edge 12px above the export row, the gap
          the rest of this chrome uses. */}
      {!docked && !chromeless && strokeCount > 0 && (
        <div
          ref={animationPanelRef}
          data-animation-panel
          className="absolute bottom-16 left-3 right-3 rounded-lg border border-border bg-background/80 backdrop-blur-sm"
        >
          {takeTimeline}
          <TransportRow
            {...transportProps}
            drawIn={{ open: drawInOpen, toggle: () => setDrawInOpen((v) => !v), summary: timingSummary }}
          />
          {drawInOpen && <DrawInBody controls={drawInControls} />}
          {timingNote}
        </div>
      )}

      {/* ---- Camera controls, floating on the 3D view ----------------------
          Top and Reset camera stay on the view they move (Unity's pattern,
          BUILD-PLAN.md §2). Export moved to its own dock panel in L3; with no
          dock on the page it stays here, its own card beside the camera's, as
          `drawing-canvas.tsx` groups the canvas half: camera framing and file
          output are two different jobs. */}
      <div
        data-camera-bar
        className="absolute bottom-3 right-3 flex items-end gap-2"
        style={chromeless ? { display: "none" } : undefined}
      >
        <div className="flex items-center gap-1 rounded-xl border border-border bg-background/85 p-1 shadow-sm backdrop-blur-sm">
          <button
            type="button"
            onClick={handleTopView}
            title="Look straight down at the form"
            className="fs-press rounded-lg px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            Top
          </button>
          <button
            type="button"
            onClick={handleResetCamera}
            title="Back to the default three-quarter view"
            className="fs-press rounded-lg px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            Reset camera
          </button>
        </div>

        {!docked && <ExportPanel {...exportProps} />}
      </div>

      {/* SOLID DEBUG OVERLAY - on-screen debug for Solid mode */}
      {showDebug && geometryMode === "solid" && (
        <>
          <SolidDebugOverlay />
          {SOLID_STAGE_DEBUG.enabled && <SolidStageDebugOverlay />}
          {SOLID_STAGE_DEBUG.enabled && <SolidStageControls />}
        </>
      )}
    </div>
  )
}

/** Minimal on-screen debug overlay for Solid mode failure diagnosis */
function SolidDebugOverlay() {
  const [, forceUpdate] = useState(0)
  
  // Poll SOLID_DEBUG state every 100ms
  useEffect(() => {
    const interval = setInterval(() => forceUpdate(n => n + 1), 100)
    return () => clearInterval(interval)
  }, [])
  
  const d = SOLID_DEBUG
  const bucketColors: Record<string, string> = {
    A: "bg-gray-500",
    B: "bg-yellow-500", 
    C: "bg-red-500",
    D: "bg-orange-500",
    E: "bg-green-500",
  }
  
  return (
    <div className="absolute left-3 top-3 z-50 rounded-lg border border-red-500/50 bg-black/90 p-2 font-mono text-[10px] text-white">
      <div className="mb-1 flex items-center gap-2 border-b border-red-500/30 pb-1">
        <span className="font-bold text-red-400">SOLID DEBUG</span>
        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold text-black ${bucketColors[d.bucket]}`}>
          BUCKET {d.bucket}
        </span>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        <span className="text-gray-400">engineCalled:</span>
        <span className={d.engineCalled ? "text-green-400" : "text-red-400"}>{d.engineCalled ? "YES" : "NO"}</span>
        
        <span className="text-gray-400">canvas:</span>
        <span>{d.canvasWidth}x{d.canvasHeight}</span>
        
        <span className="text-gray-400">strokes:</span>
        <span>{d.strokeCount}</span>
        
        <span className="text-gray-400">points:</span>
        <span>{d.pointCount}</span>
        
        <span className="text-gray-400">buildMaskSolid:</span>
        <span className={d.buildMaskSolidCalled ? "text-green-400" : "text-red-400"}>{d.buildMaskSolidCalled ? "CALLED" : "NOT CALLED"}</span>
        
        <span className="text-gray-400">thickness:</span>
        <span>{d.inputThickness}px -&gt; {d.worldThickness.toFixed(4)}w</span>
        
        <span className="text-gray-400">filledPixels:</span>
        <span>{d.filledPixels} / {d.maskArea}</span>
        
        <span className="text-gray-400">fill%:</span>
        <span className={d.filledPercent > 50 ? "text-red-400" : d.filledPercent < 1 ? "text-yellow-400" : "text-green-400"}>
          {d.filledPercent.toFixed(1)}%
        </span>
        
        <span className="text-gray-400">geometry:</span>
        <span className={d.geometryReturned ? "text-green-400" : "text-red-400"}>{d.geometryReturned ? "YES" : "NULL"}</span>
        
        <span className="text-gray-400">vertexCount:</span>
        <span className={d.vertexCount > 0 ? "text-green-400" : "text-red-400"}>{d.vertexCount}</span>
        
        <span className="text-gray-400">failureReason:</span>
        <span className={d.failureReason === "success" ? "text-green-400" : "text-yellow-400"}>{d.failureReason || "-"}</span>
        
        <span className="text-gray-400">worldX:</span>
        <span className={Math.abs(d.worldMinX) < 2 && Math.abs(d.worldMaxX) < 2 ? "text-green-400" : "text-red-400"}>
          [{d.worldMinX.toFixed(2)}, {d.worldMaxX.toFixed(2)}]
        </span>
        
        <span className="text-gray-400">worldY:</span>
        <span className={Math.abs(d.worldMinY) < 2 && Math.abs(d.worldMaxY) < 2 ? "text-green-400" : "text-red-400"}>
          [{d.worldMinY.toFixed(2)}, {d.worldMaxY.toFixed(2)}]
        </span>
      </div>
      
      {/* Raster Stage Diagnostics - read from lastStages.rasterDebug */}
      {(() => {
        const r = d.lastStages?.rasterDebug
        return (
          <div className="mt-1 border-t border-orange-500/30 pt-1">
            <div className="mb-0.5 text-[9px] font-bold text-orange-400">RASTER STAGE</div>
            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
              <span className="text-gray-400">rasterExecuted:</span>
              <span className={r?.rasterStageExecuted === "YES" ? "text-green-400" : "text-red-400"}>{r?.rasterStageExecuted || "?"}</span>
              
              <span className="text-gray-400">inputSpace:</span>
              <span>{r?.rasterInputSpace || "?"}</span>
              
              <span className="text-gray-400">maskSize:</span>
              <span>{r?.rasterMaskWidth || "?"}x{r?.rasterMaskHeight || "?"}</span>
              
              <span className="text-gray-400">thicknessPx:</span>
              <span>{typeof r?.rasterThicknessPx === "number" ? r.rasterThicknessPx.toFixed(1) : "?"}</span>
              
              <span className="text-gray-400">strokeBoundsX:</span>
              <span className="text-[8px]">{r?.rasterStrokeBoundsX || "?"}</span>
              
              <span className="text-gray-400">strokeBoundsY:</span>
              <span className="text-[8px]">{r?.rasterStrokeBoundsY || "?"}</span>
              
              <span className="text-gray-400">filledPixels:</span>
              <span className={r?.filledPixels && r.filledPixels > 0 ? "text-green-400" : "text-red-400"}>{r?.filledPixels ?? "?"}</span>
              
              <span className="text-gray-400">rasterRejected:</span>
              <span className={r?.rasterRejected === "YES" ? "text-red-400 font-bold" : "text-green-400"}>{r?.rasterRejected || "?"}</span>
              
              {r?.rasterRejected === "YES" && (
                <>
                  <span className="text-gray-400">rejectReason:</span>
                  <span className="text-red-400 text-[8px]">{r?.rasterRejectReason || "unknown"}</span>
                </>
              )}
            </div>
          </div>
        )
      })()}
      
      {/* Solid Mode Diagnostics - read from lastStages.solidDiagnostics */}
      {(() => {
        const s = d.lastStages?.solidDiagnostics
        if (!s) return null
        return (
          <div className="mt-1 border-t border-purple-500/30 pt-1">
            <div className="mb-0.5 text-[9px] font-bold text-purple-400">SOLID MODE</div>
            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
              <span className="text-gray-400">geometryMode:</span>
              <span className="text-purple-300 font-bold">{s.geometryMode}</span>
              
              <span className="text-gray-400">geometryType:</span>
              <span className={s.geometryType === "NULL" ? "text-red-400" : "text-green-400"}>{s.geometryType}</span>
              
              <span className="text-gray-400">gateExecuted:</span>
              <span className={s.gateExecuted === "YES" ? "text-green-400" : "text-yellow-400"}>{s.gateExecuted}</span>
              
              <span className="text-gray-400">filledPixels:</span>
              <span className={s.filledPixels > 0 ? "text-green-400" : "text-red-400"}>{s.filledPixels}</span>
              
              <span className="text-gray-400">outerAreaAbs:</span>
              <span>{typeof s.outerAreaAbs === "number" ? s.outerAreaAbs.toFixed(1) : "?"}</span>
              
              <span className="text-gray-400">contourClosed:</span>
              <span className={s.contourClosed === "YES" ? "text-green-400" : "text-red-400"}>{s.contourClosed}</span>
              
              <span className="text-gray-400">contourOrdered:</span>
              <span className={s.contourOrdered === "YES" ? "text-green-400" : "text-red-400"}>{s.contourOrdered}</span>
              
              <span className="text-gray-400">contourRejected:</span>
              <span className={s.contourRejected === "YES" ? "text-red-400 font-bold" : "text-green-400"}>{s.contourRejected}</span>
              
              {s.contourRejected === "YES" && (
                <>
                  <span className="text-gray-400">rejectReason:</span>
                  <span className="text-red-400 text-[8px]">{s.contourRejectReason || "unknown"}</span>
                </>
              )}
              
              {s.extrusionBuilder !== undefined && (
                <>
                  <span className="text-gray-400">extrusionBuilder:</span>
                  <span className="text-cyan-300 font-bold">{s.extrusionBuilder}</span>
                  
                  <span className="text-gray-400">frontCapTris:</span>
                  <span>{s.frontCapTriCount ?? "?"}</span>
                  
                  <span className="text-gray-400">backCapTris:</span>
                  <span>{s.backCapTriCount ?? "?"}</span>
                  
                  <span className="text-gray-400">wallSegments:</span>
                  <span className={s.wallSegmentCount && s.wallSegmentCount > 0 ? "text-green-400" : "text-red-400"}>{s.wallSegmentCount ?? "?"}</span>
                  
                  <span className="text-gray-400">skippedWalls:</span>
                  <span>{s.skippedWallSegments ?? "?"}</span>
                </>
              )}
            </div>

            {/* H1 Hole Detection (DIAGNOSTIC ONLY - geometry unchanged) */}
            <div className="mt-1 border-t border-pink-500/30 pt-1">
              <div className="mb-0.5 text-[9px] font-bold text-pink-400">HOLE DETECTION (H1)</div>
              <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                <span className="text-gray-400">holeDetectionEnabled:</span>
                <span className={s.holeDetectionEnabled === "YES" ? "text-green-400" : "text-yellow-400"}>
                  {s.holeDetectionEnabled ?? "NO"}
                </span>

                <span className="text-gray-400">detectedHoleCount:</span>
                <span>{s.detectedHoleCount ?? 0}</span>

                <span className="text-gray-400">validHoleCount:</span>
                <span className={(s.validHoleCount ?? 0) > 0 ? "text-green-400" : "text-gray-300"}>
                  {s.validHoleCount ?? 0}
                </span>

                <span className="text-gray-400">rejectedHoleCount:</span>
                <span>{s.rejectedHoleCount ?? 0}</span>

                <span className="text-gray-400">largestHoleArea:</span>
                <span>{s.largestHoleArea ?? 0}</span>

                <span className="text-gray-400">holeAreas:</span>
                <span className="text-[8px]">
                  [{(s.holeAreas ?? []).join(", ")}]
                </span>

                <span className="text-gray-400">rejectedHoleAreas:</span>
                <span className="text-[8px] text-yellow-300">
                  [{(s.rejectedHoleAreas ?? []).join(", ")}]
                </span>

                <span className="text-gray-400">borderTouchingEmpties:</span>
                <span className="text-[8px]">{s.borderTouchingEmptyCount ?? 0}</span>

                <span className="text-gray-400">holeRejectReasons:</span>
                <span className="text-[8px] text-yellow-300">
                  {(s.holeRejectReasons ?? []).length > 0
                    ? (s.holeRejectReasons ?? []).join(" | ")
                    : "-"}
                </span>
              </div>
              <div className="mt-1 text-[8px] text-gray-500">
                H1 detection only: geometry, caps, walls, export unchanged.
              </div>
            </div>

            {/* H2 Flat Cap With Holes (DIAGNOSTIC ONLY - flat cap proof) */}
            <div className="mt-1 border-t border-orange-500/30 pt-1">
              <div className="mb-0.5 text-[9px] font-bold text-orange-400">FLAT CAP WITH HOLES (H2)</div>
              <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                <span className="text-gray-400">h2FlatCapWithHolesBuilt:</span>
                <span className={s.h2FlatCapWithHolesBuilt === "YES" ? "text-green-400" : "text-yellow-400"}>
                  {s.h2FlatCapWithHolesBuilt ?? "NO"}
                </span>

                <span className="text-gray-400">h2HoleContoursUsed:</span>
                <span className={(s.h2HoleContoursUsed ?? 0) > 0 ? "text-green-400" : "text-gray-300"}>
                  {s.h2HoleContoursUsed ?? 0}
                </span>

                <span className="text-gray-400">h2HoleContourAreas:</span>
                <span className="text-[8px]">
                  [{(s.h2HoleContourAreas ?? []).join(", ")}]
                </span>

                <span className="text-gray-400">h2ShapeHoleCount:</span>
                <span className={(s.h2ShapeHoleCount ?? 0) > 0 ? "text-green-400" : "text-gray-300"}>
                  {s.h2ShapeHoleCount ?? 0}
                </span>

                <span className="text-gray-400">h2HoleContourRejectReasons:</span>
                <span className="text-[8px] text-yellow-300">
                  {(s.h2HoleContourRejectReasons ?? []).length > 0
                    ? (s.h2HoleContourRejectReasons ?? []).join(" | ")
                    : "-"}
                </span>

                <span className="text-gray-400">frontCapTris:</span>
                <span>{s.h2FrontCapTris ?? s.frontCapTriCount ?? 0}</span>

                <span className="text-gray-400">flatCapTrisBaseline:</span>
                <span>{s.h2FlatCapTrisBaseline ?? 0}</span>

                <span className="text-gray-400">triDelta:</span>
                <span className={(s.h2TriDelta ?? 0) > 0 ? "text-green-400" : "text-yellow-400"}>
                  {s.h2TriDelta ?? 0}{" "}
                  {(s.h2TriDelta ?? 0) > 0 ? "(holes cut)" : "(no change)"}
                </span>
              </div>

              {/* Counter-preserving detection (thinner mask used to find counters
                  that thick strokes painted over) */}
              <div className="mt-1 border-t border-orange-500/20 pt-1 text-[8px]">
                <div className="mb-0.5 font-bold text-orange-300">
                  COUNTER-PRESERVING DETECTION
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                  <span className="text-gray-400">enabled:</span>
                  <span
                    className={
                      s.counterDetectionEnabled === "YES"
                        ? "text-green-400"
                        : "text-gray-400"
                    }
                  >
                    {s.counterDetectionEnabled ?? "NO"}
                  </span>

                  <span className="text-gray-400">actualThicknessPx:</span>
                  <span>{((s.actualThicknessPx ?? 0) as number).toFixed(2)}</span>

                  <span className="text-gray-400">counterThicknessPx:</span>
                  <span>
                    {((s.counterDetectionThicknessPx ?? 0) as number).toFixed(2)}
                  </span>

                  <span className="text-gray-400">counterDetectedHoleCount:</span>
                  <span>{s.counterDetectedHoleCount ?? 0}</span>

                  <span className="text-gray-400">counterValidHoleCount:</span>
                  <span
                    className={
                      (s.counterValidHoleCount ?? 0) > 0
                        ? "text-green-400"
                        : "text-gray-400"
                    }
                  >
                    {s.counterValidHoleCount ?? 0}
                  </span>

                  <span className="text-gray-400">counterHoleAreas:</span>
                  <span>[{(s.counterHoleAreas ?? []).join(", ")}]</span>

                  <span className="text-gray-400">holeSource:</span>
                  <span
                    className={
                      s.counterHoleSource === "COUNTER_MASK"
                        ? "text-green-400 font-bold"
                        : "text-gray-300"
                    }
                  >
                    {s.counterHoleSource ?? "ACTUAL_MASK"}
                  </span>
                </div>
              </div>

              {/* Compact small-counter viability — pinpoints tight cursive counters */}
              <div className="mt-1 border-t border-orange-500/20 pt-1 text-[8px]">
                <div className="mb-0.5 font-bold text-orange-300">
                  COUNTER VIABILITY (smallest valid hole)
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                  <span className="text-gray-400">area:</span>
                  <span>{s.smallestValidHoleArea ?? 0} px</span>

                  <span className="text-gray-400">bbox:</span>
                  <span>
                    {(s.smallestValidHoleBboxW ?? 0)} × {(s.smallestValidHoleBboxH ?? 0)} px
                  </span>

                  <span className="text-gray-400">area/bbox:</span>
                  <span>
                    {((s.smallestValidHoleAreaToBboxRatio ?? 0) as number).toFixed(3)}
                  </span>

                  <span className="text-gray-400">usedByH2:</span>
                  <span
                    className={
                      s.smallestValidHoleUsedByH2 === "YES"
                        ? "text-green-400 font-bold"
                        : s.smallestValidHoleUsedByH2 === "NO"
                          ? "text-red-400 font-bold"
                          : "text-gray-400"
                    }
                  >
                    {s.smallestValidHoleUsedByH2 ?? "N/A"}
                  </span>
                </div>
              </div>

              <div className="mt-1 text-[8px] text-gray-500">
                H2 flat-cap proof: no extrusion, no walls, export untouched.
              </div>
            </div>

            {/* H3: EXTRUDE_FROM_FLAT_CAP_WITH_HOLES — production extrusion */}
            <div className="mt-1 border-t border-emerald-500/40 pt-1">
              <div className="mb-0.5 text-[9px] font-bold text-emerald-400">
                EXTRUDE FROM FLAT CAP WITH HOLES (H3)
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                <span className="text-gray-400">h3Built:</span>
                <span
                  className={
                    s.h3Built === "YES"
                      ? "text-green-400 font-bold"
                      : s.h3Built === "NO"
                        ? "text-red-400 font-bold"
                        : "text-gray-400"
                  }
                >
                  {s.h3Built ?? "—"}
                </span>

                {/* ---- Solid H3 control calibration (proves UI value is mapped before geometry) ---- */}
                <span className="text-gray-400">thickness slider:</span>
                <span className="font-mono">
                  {(s.solidThicknessSliderValue ?? 0) as number}px
                </span>

                <span className="text-gray-400">thickness effective:</span>
                <span
                  className={
                    (s.solidEffectiveThicknessPx ?? 0) !== (s.solidThicknessSliderValue ?? 0)
                      ? "font-mono text-emerald-400"
                      : "font-mono text-yellow-400"
                  }
                >
                  {((s.solidEffectiveThicknessPx ?? 0) as number).toFixed(1)}px
                </span>

                <span className="text-gray-400">depth slider:</span>
                <span className="font-mono">
                  {((s.solidDepthSliderValue ?? s.solidDepthParam ?? 0) as number).toFixed(3)}
                </span>

                <span className="text-gray-400">depth effective:</span>
                <span
                  className={
                    (s.solidDepthEffective ?? 0) !== (s.solidDepthSliderValue ?? 0)
                      ? "font-mono text-emerald-400"
                      : "font-mono text-yellow-400"
                  }
                >
                  {((s.solidDepthEffective ?? 0) as number).toFixed(3)}
                </span>

                <span className="text-gray-400">depth/thick ratio:</span>
                <span className="font-mono">
                  {((s.solidDepthToThicknessRatio ?? 0) as number).toFixed(3)}
                </span>

                <span className="text-gray-400">bbox Z:</span>
                <span
                  className={
                    (s.geometryBBoxZ ?? 0) > 0
                      ? "font-mono text-green-400"
                      : "font-mono text-red-400"
                  }
                >
                  {((s.geometryBBoxZ ?? 0) as number).toFixed(4)}
                </span>

                <span className="text-gray-400">frontCapTris:</span>
                <span>{s.h3FrontCapTris ?? 0}</span>

                <span className="text-gray-400">backCapTris:</span>
                <span>{s.h3BackCapTris ?? 0}</span>

                <span className="text-gray-400">outerWallSegs:</span>
                <span
                  className={
                    (s.h3OuterWallSegments ?? 0) > 0 ? "text-green-400" : "text-red-400"
                  }
                >
                  {s.h3OuterWallSegments ?? 0}
                  {(s.h3SkippedOuterWallSegments ?? 0) > 0
                    ? ` (skipped ${s.h3SkippedOuterWallSegments})`
                    : ""}
                </span>

                <span className="text-gray-400">innerWallLoops:</span>
                <span
                  className={
                    (s.h3InnerWallCount ?? 0) > 0 ? "text-green-400" : "text-gray-300"
                  }
                >
                  {s.h3InnerWallCount ?? 0}
                </span>

                <span className="text-gray-400">innerWallSegs:</span>
                <span
                  className={
                    (s.h3InnerWallSegments ?? 0) > 0 ? "text-green-400" : "text-gray-300"
                  }
                >
                  {s.h3InnerWallSegments ?? 0}
                  {(s.h3SkippedInnerWallSegments ?? 0) > 0
                    ? ` (skipped ${s.h3SkippedInnerWallSegments})`
                    : ""}
                </span>

                <span className="text-gray-400">totalVerts:</span>
                <span>{s.h3TotalVerts ?? 0}</span>

                <span className="text-gray-400">totalTris:</span>
                <span>{s.h3TotalTris ?? 0}</span>

                {/* RIM BEVEL. Here because an un-bevelled rim is identical to a
                    bevelled one in every OTHER number on this panel, and Solid
                    shipped with no bevel at all for months on exactly that
                    account. `achieved` under ~0.8 means the form is locally
                    thinner than twice the bevel and the roll is narrowing, which
                    is the intended degradation, not a fault. */}
                <span className="text-gray-400">rimBevel:</span>
                <span
                  className={
                    s.h3BevelStatus === "ROLLED"
                      ? "text-green-400 font-bold"
                      : "text-yellow-400"
                  }
                >
                  {s.h3BevelStatus ?? "—"}
                  {s.h3BevelSegments ? ` ×${s.h3BevelSegments}` : ""}
                </span>

                <span className="text-gray-400">bevel size/thick:</span>
                <span>
                  {(s.h3BevelSizeWorld ?? 0).toFixed(4)} / {(s.h3BevelThicknessWorld ?? 0).toFixed(4)}
                </span>

                <span className="text-gray-400">bevel achieved:</span>
                <span className={(s.h3BevelAchievedFrac ?? 0) >= 0.8 ? "text-green-400" : "text-yellow-400"}>
                  {((s.h3BevelAchievedFrac ?? 0) * 100).toFixed(0)}%
                  {(s.h3BevelStarvedVerts ?? 0) > 0 ? ` · ${s.h3BevelStarvedVerts} starved` : ""}
                  {(s.h3BevelFlipsRepaired ?? 0) > 0 ? ` · ${s.h3BevelFlipsRepaired} flips` : ""}
                </span>

                <span className="text-gray-400">exportSamePath:</span>
                <span
                  className={
                    s.exportUsesSamePath === "YES"
                      ? "text-green-400 font-bold"
                      : "text-yellow-400"
                  }
                >
                  {s.exportUsesSamePath ?? "—"}
                </span>
              </div>
              <div className="mt-1 text-[8px] text-gray-500">
                H3 production: cap + back cap + outer walls + inner walls. Depth
                slider drives bbox Z. Export path identical to preview.
              </div>
            </div>
          </div>
        )
      })()}

      {/* ---- Solid H3 ANIMATION CLEANUP diagnostics ----
          Surfaced only in Solid mode. Reads SOLID_ANIM_DEBUG (written from
          Scene during partial-reveal rebuilds). Proves arc-length reveal,
          shows rebuild cadence, and exposes topology-popping count. */}
      {(() => {
        const a = SOLID_ANIM_DEBUG
        const arcRatio =
          a.animatedTotalArcLength > 0
            ? a.animatedVisibleArcLength / a.animatedTotalArcLength
            : 0
        return (
          <div className="mt-1 border-t border-cyan-500/40 pt-1">
            <div className="mb-0.5 text-[9px] font-bold text-cyan-400">
              SOLID H3 ANIMATION
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
              <span className="text-gray-400">animationPath:</span>
              <span
                className={
                  a.animationPath ===
                  "partialSolidRebuildWithHoleStabilization"
                    ? "text-green-400 font-bold"
                    : a.animationPath === "partialExtrudeRebuild"
                      ? "text-cyan-300 font-bold"
                      : a.animationPath === "drawRange"
                        ? "text-blue-300"
                        : "text-gray-400"
                }
              >
                {a.animationPath}
              </span>

              <span className="text-gray-400">solidAnimationActive:</span>
              <span
                className={
                  a.solidAnimationActive
                    ? "text-green-400 font-bold"
                    : "text-gray-300"
                }
              >
                {a.solidAnimationActive ? "YES" : "NO"}
              </span>

              <span className="text-gray-400">solidAnimationProgress:</span>
              <span className="font-mono">
                {a.solidAnimationProgress.toFixed(4)}
              </span>

              <span className="text-gray-400">solidAnimationRebuildCount:</span>
              <span>{a.solidAnimationRebuildCount}</span>

              <span className="text-gray-400">animatedStrokePointCount:</span>
              <span>{a.animatedStrokePointCount}</span>

              <span className="text-gray-400">animatedVisibleArcLength:</span>
              <span className="font-mono">
                {a.animatedVisibleArcLength.toFixed(2)}
              </span>

              <span className="text-gray-400">animatedTotalArcLength:</span>
              <span className="font-mono">
                {a.animatedTotalArcLength.toFixed(2)}
              </span>

              <span className="text-gray-400">arcLengthRatio:</span>
              <span className="font-mono">
                {arcRatio.toFixed(4)}
              </span>

              <span className="text-gray-400">solidAnimationUsesArcLength:</span>
              <span
                className={
                  a.solidAnimationUsesArcLength === "YES"
                    ? "text-green-400 font-bold"
                    : "text-red-400"
                }
              >
                {a.solidAnimationUsesArcLength}
              </span>

              <span className="text-gray-400">
                solidAnimationInterpolatedCutPoint:
              </span>
              <span
                className={
                  a.solidAnimationInterpolatedCutPoint === "YES"
                    ? "text-green-400 font-bold"
                    : "text-red-400"
                }
              >
                {a.solidAnimationInterpolatedCutPoint}
              </span>

              <span className="text-gray-400">finalFrameMatchesStatic:</span>
              <span
                className={
                  a.finalFrameMatchesStatic === "YES"
                    ? "text-green-400 font-bold"
                    : "text-gray-300"
                }
              >
                {a.finalFrameMatchesStatic}
              </span>

              <span className="text-gray-400">validHoleCount (anim):</span>
              <span>{a.validHoleCount}</span>

              <span className="text-gray-400">topologyChangeCount:</span>
              <span
                className={
                  a.topologyChangeCount > 0 ? "text-yellow-400" : "text-gray-300"
                }
              >
                {a.topologyChangeCount}
              </span>
            </div>
            <div className="mt-1 text-[8px] text-gray-500">
              Reveal is arc-length based with sub-segment interpolated cut.
              Rebuild count resets each Play. Topology pops classified, not faked early.
            </div>

            {/* ---- Hole stabilization sub-block ---- */}
            <div className="mt-1 border-t border-cyan-500/20 pt-1">
              <div className="mb-0.5 text-[9px] font-bold text-cyan-300">
                HOLE STABILIZATION
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                <span className="text-gray-400">holeStabilizationActive:</span>
                <span
                  className={
                    a.holeStabilizationActive === "YES"
                      ? "text-green-400 font-bold"
                      : "text-gray-300"
                  }
                >
                  {a.holeStabilizationActive}
                </span>

                <span className="text-gray-400">finalHoleReferenceCount:</span>
                <span>{a.finalHoleReferenceCount}</span>

                <span className="text-gray-400">activatedFinalHoleCount:</span>
                <span
                  className={
                    a.activatedFinalHoleCount > 0
                      ? "text-green-400 font-bold"
                      : "text-gray-300"
                  }
                >
                  {a.activatedFinalHoleCount}
                </span>

                <span className="text-gray-400">lastPartialCentroidCount:</span>
                <span>{a.lastPartialCentroidCount}</span>

                <span className="text-gray-400">perHoleHitStreaks:</span>
                <span className="font-mono">
                  [{a.perHoleHitStreaks.join(", ")}]
                </span>

                <span className="text-gray-400">perHoleMissStreaks:</span>
                <span className="font-mono">
                  [{a.perHoleMissStreaks.join(", ")}]
                </span>

                <span className="text-gray-400">perHoleActivationRadius:</span>
                <span className="font-mono">
                  [{a.perHoleActivationRadiusWorld
                    .map((r) => r.toFixed(3))
                    .join(", ")}]
                </span>

                {a.holeStabilizationLastReasons.length > 0 && (
                  <>
                    <span className="text-gray-400">lastRejects:</span>
                    <span className="text-yellow-400 text-[8px]">
                      {a.holeStabilizationLastReasons.slice(0, 3).join("; ")}
                    </span>
                  </>
                )}
              </div>
              <div className="mt-1 text-[8px] text-gray-500">
                Reference snapshotted from static H3 at Play start. Activation
                threshold = 1 partial centroid match (sticky). Topological
                safety filter drops finals whose centroid is outside the
                current partial outer.
              </div>
            </div>
          </div>
        )
      })()}

      {/* Contour Diagnostics Section */}
      <div className="mt-1 border-t border-blue-500/30 pt-1">
        <div className="mb-0.5 text-[9px] font-bold text-blue-400">CONTOUR DIAGNOSTICS</div>
        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
          <span className="text-gray-400">rawPts:</span>
          <span>{d.rawContourPoints}</span>
          
          <span className="text-gray-400">simpPts:</span>
          <span>{d.simplifiedContourPoints} ({d.rawContourPoints > 0 ? ((1 - d.simplifiedContourPoints / d.rawContourPoints) * 100).toFixed(0) : 0}% reduced)</span>
          
          <span className="text-gray-400">outerArea:</span>
          <span>{d.outerSignedArea.toFixed(1)}</span>
          
          <span className="text-gray-400">outerWind:</span>
          <span className={d.outerWinding === "CCW" ? "text-green-400" : "text-yellow-400"}>{d.outerWinding}</span>
          
          <span className="text-gray-400">outerSelfX:</span>
          <span className={d.outerSelfIntersects ? "text-red-400 font-bold" : "text-green-400"}>
            {d.outerSelfIntersects ? "YES - BAD" : "NO"}
          </span>
          
          <span className="text-gray-400">holes:</span>
          <span>{d.holeCount}</span>
          
          {d.holeCount > 0 && (
            <>
              <span className="text-gray-400">holeAreas:</span>
              <span className="text-[8px]">
                [
                {(Array.isArray(d.holeAreas) ? d.holeAreas : [])
                  .map((a: number) => a.toFixed(0))
                  .join(", ")}
                ]
              </span>
              
              <span className="text-gray-400">holeWinds:</span>
              <span className="text-[8px]">
                [{(Array.isArray(d.holeWindings) ? d.holeWindings : []).join(", ")}]
              </span>
              
              <span className="text-gray-400">holeSelfX:</span>
              <span className={d.anyHoleSelfIntersects ? "text-red-400 font-bold" : "text-green-400"}>
                {d.anyHoleSelfIntersects ? "YES - BAD" : "NO"}
              </span>
              
              <span className="text-gray-400">holeOutside:</span>
              <span className={d.anyHoleOutsideOuter ? "text-red-400 font-bold" : "text-green-400"}>
                {d.anyHoleOutsideOuter ? "YES - BAD" : "NO"}
              </span>
              
              <span className="text-gray-400">holesOverlap:</span>
              <span className={d.holesOverlap ? "text-red-400 font-bold" : "text-green-400"}>
                {d.holesOverlap ? "YES - BAD" : "NO"}
              </span>
            </>
          )}
          
          <span className="text-gray-400">stageD verts:</span>
          <span className={d.stageDVertexCount > 0 ? "text-green-400" : "text-red-400"}>{d.stageDVertexCount}</span>
          
          <span className="text-gray-400">stageE verts:</span>
          <span className={d.stageEVertexCount > 0 ? "text-green-400" : "text-red-400"}>{d.stageEVertexCount}</span>
        </div>
      </div>
      
      <div className="mt-1 border-t border-red-500/30 pt-1 text-[8px] text-gray-500">
        B=rawContour C=simplified D=noHoles E=full | Check: outerSelfX, holeSelfX, holeOutside, holesOverlap
      </div>
    </div>
  )
}

/**
 * TEMPORARY STAGE ISOLATION DEBUG: 2D visualization of pipeline stages
 * Renders: mask silhouette, raw contours, simplified contours, holes
 */
function SolidStageDebugOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [, forceUpdate] = useState(0)
  
  useEffect(() => {
    const interval = setInterval(() => forceUpdate(n => n + 1), 100)
    return () => clearInterval(interval)
  }, [])
  
  useEffect(() => {
    if (!canvasRef.current || !SOLID_DEBUG.lastStages) return
    
    const stages = SOLID_DEBUG.lastStages
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")!
    
    // Setup canvas
    canvas.width = 400
    canvas.height = 400
    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Get scale to fit mask in canvas
    const maskW = stages.maskWidth || 1
    const maskH = stages.maskHeight || 1
    const scaleX = (canvas.width - 20) / maskW
    const scaleY = (canvas.height - 20) / maskH
    const scale = Math.min(scaleX, scaleY)
    const offsetX = 10 + (canvas.width - 20 - maskW * scale) / 2
    const offsetY = 10 + (canvas.height - 20 - maskH * scale) / 2
    
    // Stage A: Render mask silhouette
    if (SOLID_STAGE_DEBUG.stage === "A" || SOLID_STAGE_DEBUG.stage === "B" || SOLID_STAGE_DEBUG.stage === "C" || SOLID_STAGE_DEBUG.stage === "D" || SOLID_STAGE_DEBUG.stage === "E") {
      ctx.fillStyle = "#333"
      for (let y = 0; y < maskH; y++) {
        for (let x = 0; x < maskW; x++) {
          if (stages.maskData[y * maskW + x]) {
            ctx.fillRect(offsetX + x * scale, offsetY + y * scale, scale, scale)
          }
        }
      }
    }
    
    // Stage B: Render raw outer contour
    if (SOLID_STAGE_DEBUG.stage === "B" || SOLID_STAGE_DEBUG.stage === "C" || SOLID_STAGE_DEBUG.stage === "D" || SOLID_STAGE_DEBUG.stage === "E") {
      ctx.strokeStyle = "#0f0"
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < stages.outerContour.length; i++) {
        const p = stages.outerContour[i]
        const sx = offsetX + p.x * scale
        const sy = offsetY + p.y * scale
        if (i === 0) ctx.moveTo(sx, sy)
        else ctx.lineTo(sx, sy)
      }
      ctx.closePath()
      ctx.stroke()
    }
    
    // Stage C: Render simplified outer contour
    if (SOLID_STAGE_DEBUG.stage === "C" || SOLID_STAGE_DEBUG.stage === "D" || SOLID_STAGE_DEBUG.stage === "E") {
      ctx.strokeStyle = "#ff0"
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < stages.simplifiedOuter.length; i++) {
        const p = stages.simplifiedOuter[i]
        const sx = offsetX + p.x * scale
        const sy = offsetY + p.y * scale
        if (i === 0) ctx.moveTo(sx, sy)
        else ctx.lineTo(sx, sy)
      }
      ctx.closePath()
      ctx.stroke()
    }
    
    // Stages D/E: Render holes
    if (SOLID_STAGE_DEBUG.stage === "D" || SOLID_STAGE_DEBUG.stage === "E") {
      ctx.strokeStyle = "#f00"
      ctx.lineWidth = 1.5
      for (const hole of stages.simplifiedHoles) {
        ctx.beginPath()
        for (let i = 0; i < hole.length; i++) {
          const p = hole[i]
          const sx = offsetX + p.x * scale
          const sy = offsetY + p.y * scale
          if (i === 0) ctx.moveTo(sx, sy)
          else ctx.lineTo(sx, sy)
        }
        ctx.closePath()
        ctx.stroke()
      }
    }
    
    // Legend
    ctx.fillStyle = "#fff"
    ctx.font = "10px monospace"
    ctx.fillText(`STAGE ${SOLID_STAGE_DEBUG.stage}`, 10, canvas.height - 5)
  }, [SOLID_DEBUG.lastStages])
  
  return (
    <div className="absolute left-3 bottom-20 z-50 rounded-lg border border-yellow-500/50 bg-black/90 p-2">
      <div className="mb-1 text-[10px] font-bold text-yellow-400">2D STAGE VIZ</div>
      <canvas
        ref={canvasRef}
        className="border border-yellow-500/30 bg-black"
        width={400}
        height={400}
        style={{ maxWidth: "300px", display: "block" }}
      />
      <div className="mt-1 text-[8px] text-gray-400">
        Grn=raw Yel=simplified Red=holes
      </div>
    </div>
  )
}

/** Stage isolation toggle buttons */
function SolidStageControls() {
  const [, forceUpdate] = useState(0)
  const [enabled, setEnabled] = useState(SOLID_STAGE_DEBUG.enabled)
  const [stage, setStage] = useState(SOLID_STAGE_DEBUG.stage)
  
  const stages: ("A" | "B" | "C" | "D" | "E")[] = ["A", "B", "C", "D", "E"]
  const stageNames: Record<string, string> = {
    A: "Mask", B: "RawCtr", C: "SimpCtr", D: "NoHoles", E: "Full"
  }
  const stageDescriptions: Record<string, string> = {
    A: "2D mask only",
    B: "raw outer contour",
    C: "simplified contour",
    D: "extrude outer only",
    E: "extrude with holes"
  }
  
  const handleEnabledChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    SOLID_STAGE_DEBUG.enabled = e.target.checked
    setEnabled(e.target.checked)
  }
  
  const handleStageChange = (s: "A" | "B" | "C" | "D" | "E") => {
    SOLID_STAGE_DEBUG.stage = s
    setStage(s)
    // Force a rebuild by triggering state update
    forceUpdate(n => n + 1)
  }
  
  return (
    <div className="absolute right-3 bottom-20 z-50 flex flex-col gap-1 rounded-lg border border-blue-500/50 bg-black/90 p-2">
      <div className="text-[10px] font-bold text-blue-400">STAGE ISOLATION DEBUG</div>
      <label className="flex items-center gap-1 text-[9px] text-white">
        <input
          type="checkbox"
          checked={enabled}
          onChange={handleEnabledChange}
          className="h-3 w-3"
        />
        Enable Stage Debug
      </label>
      <div className="flex gap-1">
        {stages.map(s => (
          <button
            key={s}
            onClick={() => handleStageChange(s)}
            className={`rounded px-1.5 py-0.5 text-[9px] font-bold transition-colors ${
              stage === s
                ? "bg-blue-500 text-black"
                : "bg-gray-600 text-white hover:bg-gray-500"
            }`}
          >
            {stageNames[s]}
          </button>
        ))}
      </div>
      <div className="text-[8px] text-gray-400">
        Current: {stageDescriptions[stage]}
      </div>
      <div className="text-[8px] text-yellow-400">
        D vs E: If D works but E shards = holes/winding bug
      </div>
    </div>
  )
}
