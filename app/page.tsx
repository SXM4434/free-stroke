"use client"

import { useState, useRef, useEffect, useCallback, useMemo, useSyncExternalStore } from "react"
import Viewport3DWrapper from "@/components/viewport-3d-wrapper"
import DrawingCanvas, { type ExportSettings } from "@/components/drawing-canvas"
import { DockShell } from "@/components/dock-shell"
import { StylePanelScaffold, type StylePanelId } from "@/components/style-panel-scaffold"
import { Toaster } from "@/components/ui/sonner"
import type { Stroke, ProcessedStroke, Point } from "@/lib/stroke-processing"
import { processStroke } from "@/lib/stroke-processing"
import {
  type GeometryMode,
  type ExtrudeParams,
  type SolidParams,
  type InflateParams,
  DEFAULT_EXTRUDE_PARAMS,
  DEFAULT_SOLID_PARAMS,
  DEFAULT_INFLATE_PARAMS,
  INFLATE_BLEND_MIN,
  INFLATE_BLEND_MAX,
  INFLATE_BLEND_STEP,
  INFLATE_RESOLUTION_MIN,
  INFLATE_RESOLUTION_MAX,
  INFLATE_RESOLUTION_STEP,
  EXTRUDE_WIDTH_SLIDER_MIN,
  EXTRUDE_WIDTH_SLIDER_MAX,
  EXTRUDE_WIDTH_SLIDER_STEP,
  mapExtrudeWidthSlider,
  extrudeWidthToSlider,
  EXTRUDE_DEPTH_MULTIPLIER_MIN,
  EXTRUDE_DEPTH_MULTIPLIER_MAX,
  EXTRUDE_DEPTH_MULTIPLIER_STEP,
  SOLID_THICKNESS_SLIDER_MIN,
  SOLID_THICKNESS_SLIDER_MAX,
  SOLID_THICKNESS_SLIDER_STEP,
  SOLID_DEPTH_SLIDER_MIN,
  SOLID_DEPTH_SLIDER_MAX,
  SOLID_DEPTH_SLIDER_STEP,
  computeSolidEffectiveThicknessPx,
} from "@/lib/geometry-engines"
import {
  ENGINE_FAMILIES,
  DEFAULT_ENGINE_FAMILY,
  isEngineFamily,
  type EngineFamily,
} from "@/lib/engine-registry"
import {
  type StyleState,
  DEFAULT_STYLE_STATE,
  MATERIAL_PRESETS,
  MATERIAL_ANIMATION_TYPES,
  MODE_MATERIAL_DEFAULTS,
  TEXTURE_MODES,
  DITHER_PRESETS,
  ASCII_PRESETS,
  FUSION_PRESETS,
  type PresetFamily,
  type GeometrySettings,
  findPreset,
  findPresetIn,
  presetEditedFields,
  applyPresetToStyleState,
  applyGeometryPreset,
  geometryPresetChangesMode,
  resolveViewPreset,
  resolveMotionPreset,
  viewPresetBlockers,
} from "@/lib/style-system"
// `CustomFusion` is the localStorage shape-check's type at the restore effect
// below; it was used there without being imported, which is 4 of the 4 tsc
// errors this file was carrying.
import {
  customFusionKey,
  comboStylePatch,
  comboFusionKey,
  fusionWakePatch,
  fusionUsesView,
  resolveFusionDrive,
  FUSION_COMBOS_BY_KEY,
  FUSION_VIEW_SPIN_DEG,
  BUILTIN_LINK_FUSIONS,
  type CustomFusion,
  type FusionCombo,
} from "@/lib/style-fusion"
import type { ViewportApi } from "@/components/viewport-3d"
import { toast } from "sonner"
import { setPenTipMode, readPenTipMode, type PenTipMode } from "@/lib/pen-reveal"
/* THE CHANNEL THAT TURNS A DRAWING INTO AN OBJECT. `flatten` is what the hero
 * beat animates, and until now `app/page.tsx` did not mention it once: the
 * viewport defaulted the prop to SOLID_STATE on every render, so the product
 * could only ever draw the LAST frame of the beat. Measured on this route
 * before wiring: ink 0 to 1 moves 34,117 px, yaw 73,390 px, pitch 62,712 px.
 * The engine was always here. Nothing handed it a value. */
import { SOLID_STATE, countDrawInUnits, type FlatState } from "@/components/viewport-3d"
import { UndoStack } from "@/lib/undo-stack"
import { readVersioned, writeVersioned } from "@/lib/storage"
import {
  strokesSchema,
  fusionsSchema,
  sessionSchema,
  trashSchema,
  defaultSession,
  DEFAULT_CANVAS_SETTINGS,
  type CanvasSettings,
  type SessionDoc,
} from "@/lib/doc-store"
import {
  type DrawInParams,
  type RevealWindowParams,
  type RevealEnvelopeParams,
  DRAW_IN_DEFAULTS,
  REVEAL_WINDOW_DEFAULTS,
  REVEAL_ENVELOPE_DEFAULTS,
} from "@/lib/stroke-schedule"
import { type StrokeTimingTake, STROKE_TIMING_TAKE_DEFAULTS, penMsOf } from "@/lib/stroke-timing"
import { clockStrokesFor, rebaseForPatch, patchMovesNib, gateKnocked, type ClockCanvas } from "@/lib/clock-rebase"
import { StrokeTakeProvider } from "@/components/stroke-strip"
import { KeyedStyle, keyedStyleEdit } from "@/components/key-button"
import { TakeTransportProvider } from "@/lib/take-transport"
import { compactKeys, validateKeys, type TakeKeys } from "@/lib/keyframes"

/**
 * SHORT names for the stack-animation behaviours, for the summary strip.
 *
 * The Layers panel's own select carries the full sentence ("Drift — every layer
 * slides together") because that is where you CHOOSE. The strip only has to
 * name what is running, in one or two words, at 11px, next to six siblings —
 * so it gets the noun and the panel keeps the explanation. Keyed by
 * `StyleState["stackAnimationType"]`, so a behaviour added without a label here
 * falls back to "animated" rather than printing a camelCase identifier at the
 * user, which is the leak this table exists to stop.
 */
const STACK_ANIMATION_LABELS: Partial<Record<StyleState["stackAnimationType"], string>> = {
  fadeIn: "Fade in",
  pulse: "Pulse",
  drift: "Drift",
  delayAfterReveal: "Delayed",
  completionPulse: "End pulse",
  freezeOnComplete: "Freeze",
  loop: "Loop",
  revealSynced: "Reveal track",
}

const GEOMETRY_MODES: { value: GeometryMode; label: string; disabled: boolean; tooltip?: string }[] = [
  { value: "rod", label: "Rod", disabled: false },
  { value: "extrude", label: "Extrude", disabled: false },
  { value: "solid", label: "Solid", disabled: false },
  { value: "inflate", label: "Inflate", disabled: false },
]

/* ========================================================================== */
/*  THE DOCUMENT                                                              */
/* ========================================================================== */

/**
 * EVERYTHING ⌘Z CAN REACH, IN ONE OBJECT.
 *
 * Snapshotting the WHOLE document rather than a field list is total by
 * construction — a per-field restore list is a thing to forget to update when a
 * field is added, and this file already learned that lesson once (see the
 * comment on the old `presetUndoRef`, which snapshotted the entire `StyleState`
 * for exactly that reason and then covered only two of fifteen preset
 * families).
 *
 * It is cheap because every field is treated as immutable everywhere in this
 * app: strokes are appended with `[...prev, next]`, style state with
 * `{ ...s, field }`. So a snapshot copies ten references, and a hundred
 * snapshots of a two-hundred-stroke drawing share all two hundred strokes.
 *
 * `processedStrokes` is in here even though it is derived, because it is
 * derived from raw strokes AND the canvas settings, and undo has to land on the
 * pair that were actually on screen together. Restoring raw and recomputing
 * would silently re-process an old drawing under new settings.
 *
 * The CAMERA is deliberately absent — see `lib/doc-store.ts` for why view state
 * is not document state.
 */
interface DocSnapshot {
  rawStrokes: Stroke[]
  processedStrokes: ProcessedStroke[]
  geometryMode: GeometryMode
  engineFamily: EngineFamily
  extrudeParams: ExtrudeParams
  widthSlider: number
  solidParams: SolidParams
  inflateParams: InflateParams
  styleState: StyleState
  canvas: CanvasSettings
  /* THE TAKE — how the mark draws itself in, and which stretch of the beat is
   * on the page. They were `useState` inside `components/viewport-3d.tsx` and
   * so were neither undoable nor saved: a user could spend ten minutes finding
   * a `byLength` at 40% overlap running end-aligned, reload, and get the
   * transcript back. They are document state by the same test everything else
   * here passes — the user authored them, and they change what is rendered. */
  drawIn: DrawInParams
  revealWindow: RevealWindowParams
  revealEnvelope: RevealEnvelopeParams
  /** Per-stroke timing rows (ANIM-1A3). `lib/stroke-timing.ts`. */
  take: StrokeTimingTake
  /** Keys beside the take (ANIM-3B), `lib/keyframes.ts`. REQUIRED even though
   *  `undefined` is its usual value: every undo snapshot has to carry it, or a
   *  ⌘Z could not put "no keys" back. `applyPatch` tests `"keys" in patch`. */
  keys: TakeKeys | undefined
  penTip: PenTipMode
  flatten: FlatState
}

/**
 * NAMES FOR THE FIELDS THE STYLE PANEL WRITES.
 *
 * The panel receives one `setStyleState` prop and drives every control in the
 * app through it, so this file cannot ask "which control fired?" — it can only
 * ask "what changed?". That turns out to be the better question: the label is
 * derived from the DIFF, so a control added to the panel tomorrow gets a
 * correct undo label with nobody coming back here to register it.
 *
 * The fallback humanises the field name (`ditherThreshold` → "Dither
 * threshold"), which is why this table only needs the entries where the field
 * name and the user-facing noun genuinely disagree.
 */
const STYLE_FIELD_LABELS: Partial<Record<keyof StyleState, string>> = {
  materialPreset: "Material",
  customMaterial: "Custom material",
  materialAnimationType: "Material animation",
  textureMode: "Texture",
  ditherType: "Dither pattern",
  asciiCharset: "ASCII charset",
  stackOrder: "Layer order",
  stackAnimationType: "Stack animation",
  fusionPreset: "Fusion",
  fusionDrive: "Fusion drive",
  motionMode: "Motion mode",
  customFusions: "Fusion library",
  activePresetId: "Preset",
}

/** `textureScale` → "Texture scale". SENTENCE case, not Title Case: these read
 *  inside a sentence ("Undo Texture scale"), and the panel's own row labels are
 *  sentence case too. `ascii` is special-cased because it is an acronym and
 *  "Ascii cell size" is the kind of small wrongness that reads as unfinished. */
const humanise = (k: string) =>
  k
    .replace(/^ascii/, "ASCII ")
    .replace(/([A-Z])/g, (m) => " " + m.toLowerCase())
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase())

/** Fields that are bookkeeping, not user intent. A change to ONLY these is not
 *  a step — it is the receipt of a step that already happened. */
const RECEIPT_FIELDS = new Set<keyof StyleState>([
  "activePresetFamily",
  "lastAppliedPresetId",
])

/** Top-level keys whose value differs. `customMaterial` is compared by value,
 *  one level down, so a colour drag reads as one field rather than as the whole
 *  object. */
function changedStyleKeys(a: StyleState, b: StyleState): (keyof StyleState)[] {
  const out: (keyof StyleState)[] = []
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof StyleState>
  for (const k of keys) {
    const av = a[k] as unknown
    const bv = b[k] as unknown
    if (av === bv) continue
    if (av && bv && typeof av === "object" && typeof bv === "object" && !Array.isArray(av)) {
      /* Shallow value compare so an object rebuilt with identical contents is
       * not reported as a change — the style panel rebuilds `customMaterial`
       * on every render path that touches it. */
      const ao = av as Record<string, unknown>
      const bo = bv as Record<string, unknown>
      const ks = new Set([...Object.keys(ao), ...Object.keys(bo)])
      let same = true
      for (const kk of ks) if (ao[kk] !== bo[kk]) { same = false; break }
      if (same) continue
    }
    out.push(k)
  }
  return out
}

const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/

/**
 * WHAT COALESCES INTO ONE UNDO STEP.
 *
 * The rule is the one every editor converged on, stated structurally rather
 * than per-control: a CONTINUOUS change to a SINGLE value merges with the ones
 * around it; a DISCRETE command never does.
 *
 * Here that is: exactly one field changed, and its value is a number (a slider
 * or a dial) or a hex colour (a colour picker, which fires per pointer sample
 * exactly like a slider). Anything else — a preset click, a toggle, a dropdown,
 * a delete — returns null and is its own step.
 *
 * The multi-field test is what stops two rapid preset clicks from merging: a
 * preset rewrites the composition rails, so it never presents as one field.
 */
function styleCoalesceKey(
  prev: StyleState,
  next: StyleState,
  changed: (keyof StyleState)[],
): string | null {
  if (changed.length !== 1) return null
  const k = changed[0]
  const a = prev[k] as unknown
  const b = next[k] as unknown
  if (typeof a === "number" && typeof b === "number") return `style:${k}`
  if (typeof a === "string" && typeof b === "string" && HEX_COLOR.test(b)) return `style:${k}`
  if (k === "customMaterial" && a && b && typeof a === "object" && typeof b === "object") {
    /* One level down: which sub-field of the custom material moved. Six sliders
     * and two colour pickers live in here and they must not merge with each
     * other. */
    const ao = a as Record<string, unknown>
    const bo = b as Record<string, unknown>
    const sub = Object.keys(bo).filter((kk) => ao[kk] !== bo[kk])
    if (sub.length !== 1) return null
    const v = bo[sub[0]]
    if (typeof v === "number") return `style:customMaterial.${sub[0]}`
    if (typeof v === "string" && HEX_COLOR.test(v)) return `style:customMaterial.${sub[0]}`
  }
  return null
}

/** The name that goes on the undo entry, from the same diff. */
function styleChangeLabel(
  prev: StyleState,
  next: StyleState,
  changed: (keyof StyleState)[],
): string {
  /* The fusion library is the one place where the field name does not say what
   * happened, and it is also where the destructive action lives. Comparing the
   * lengths is how "Delete fusion" gets its own honest name instead of every
   * library edit reading "Fusion library". */
  if (changed.includes("customFusions")) {
    const before = prev.customFusions.length
    const after = next.customFusions.length
    if (after < before) return "Delete fusion"
    if (after > before) return "Add fusion"
    return "Edit fusion"
  }
  const meaningful = changed.filter((k) => !RECEIPT_FIELDS.has(k))
  const head = meaningful[0] ?? changed[0]
  if (!head) return "Change"
  if (meaningful.length > 3) return "Apply preset"
  if (head === "customMaterial") {
    const ao = prev.customMaterial as unknown as Record<string, unknown>
    const bo = next.customMaterial as unknown as Record<string, unknown>
    const sub = Object.keys(bo).filter((kk) => ao[kk] !== bo[kk])
    if (sub.length === 1) return humanise(sub[0])
  }
  return STYLE_FIELD_LABELS[head] ?? humanise(String(head))
}

export default function Home() {
  const [rawStrokes, setRawStrokes] = useState<Stroke[]>([])
  const [processedStrokes, setProcessedStrokes] = useState<ProcessedStroke[]>(
    []
  )
  const [geometryMode, setGeometryMode] = useState<GeometryMode>("rod")
  // WHICH ENGINE BUILDS THE FORM. Free Stroke's own by default; "desk-doodles"
  // routes the same strokes and the same mode through the ported Desk Doodles
  // engine in lib/dd-engine/ so the two can be judged side by side under
  // identical lights and dials. See lib/engine-registry.ts.
  const [engineFamily, setEngineFamily] = useState<EngineFamily>(DEFAULT_ENGINE_FAMILY)
  const [extrudeParams, setExtrudeParams] = useState<ExtrudeParams>(DEFAULT_EXTRUDE_PARAMS)
  // Width slider is a normalized t in [0, 1]. The effective half-width
  // stored in `extrudeParams.width` is derived from t via
  // `mapExtrudeWidthSlider`, which uses a quadratic curve so the middle
  // of the slider lands on the previous default (clean), and the messy
  // / breaking widths are reserved for the last ~25% of slider travel.
  // The engine itself still consumes a raw half-width, so engine code
  // does not need to know about the slider at all.
  const [widthSlider, setWidthSlider] = useState<number>(
    extrudeWidthToSlider(DEFAULT_EXTRUDE_PARAMS.width),
  )
  const [solidParams, setSolidParams] = useState<SolidParams>(DEFAULT_SOLID_PARAMS)
  // Inflate fusion dials. These live in the Inflate CONFIG strip next to
  // Thickness/Puff — they are dials for the one Inflate mode, not a new
  // top-level mode pill. "Fusion" picks the surface strategy (fast per-stroke
  // loft vs. the signed-distance field that actually merges crossings);
  // Blend/Resolution only mean anything for the implicit strategy, so they are
  // rendered disabled while the loft is selected rather than hidden — a dial
  // that vanishes is a dial you forget exists.
  const [inflateParams, setInflateParams] = useState<InflateParams>(DEFAULT_INFLATE_PARAMS)
  // POST-MVP visual style substrate. Updating it never rebuilds geometry and
  // never touches the reveal clock — that separation is the PRD's first phase
  // gate ("style state changes must not rebuild geometry") and it still holds.
  //
  // ⚠ THE REST OF THIS COMMENT USED TO SAY "display/debug only … never affects
  // export", AND THAT HAS BEEN FALSE since export v2 landed. `materialPreset`
  // and `customMaterial` are read by `createExportMaterial`
  // (lib/geometry-engines.ts:963-1011) and written into the GLB as a real
  // material plus `extras` metadata. The screen-space layers — texture, dither,
  // ASCII — genuinely do not ride a GLB and are export v3.
  const [styleState, setStyleState] = useState<StyleState>(DEFAULT_STYLE_STATE)

  /* THE CANVAS PROCESSING SETTINGS LIVE HERE NOW.
   *
   * They used to be three `useState` hooks inside `DrawingCanvas`, mirrored out
   * through `settingsRef` for the consumers that needed them fresh. They moved
   * up for two reasons that are the same reason: `smoothing` visibly reshapes
   * the mark, so it is part of the document — which means it has to be
   * undoable, and it has to be persisted. Neither is possible from inside a
   * child that owns the state privately. */
  const [canvasSettings, setCanvasSettings] = useState<CanvasSettings>(DEFAULT_CANVAS_SETTINGS)

  /* THE MOTION SETTINGS LIVE HERE NOW, FOR THE REASON THE CANVAS SETTINGS DO.
   *
   * `drawIn` and `revealWindow` were `useState` inside the viewport, which put
   * them below the two things they need — the undo stack and the persist
   * effect, both of which are this component's. The viewport still renders
   * every control; it just no longer owns the answer. Defaults come from
   * `lib/stroke-schedule.ts`, the module that also defines the types and the
   * scheduler that reads them, so there is one copy of "what a fresh take is". */
  const [drawIn, setDrawIn] = useState<DrawInParams>(DRAW_IN_DEFAULTS)
  const [revealWindow, setRevealWindow] = useState<RevealWindowParams>(REVEAL_WINDOW_DEFAULTS)
  const [revealEnvelope, setRevealEnvelope] = useState<RevealEnvelopeParams>(REVEAL_ENVELOPE_DEFAULTS)
  const [take, setTake] = useState<StrokeTimingTake>(STROKE_TIMING_TAKE_DEFAULTS)
  const [keys, setKeysState] = useState<TakeKeys | undefined>(undefined)
  /* THE PEN'S TIP. Seeded FROM the module rather than from a literal, because
   * `lib/pen-reveal.ts` owns what a fresh tip is and a second copy here would
   * be a second answer. React state is the document's view of it; the effect
   * below is the only thing that writes the module. */
  const [penTip, setPenTip] = useState<PenTipMode>(readPenTipMode())
  const [flatten, setFlatten] = useState<FlatState>(SOLID_STATE)

  /* The hot-path mirror. Kept in `applyPatch` so it can never disagree with the
   * state it mirrors. */
  const settingsRef = useRef<ExportSettings>({ ...DEFAULT_CANVAS_SETTINGS })
  /* The canvas the playing clock was stamped with (the clock memo writes it),
   * so a reprocess rebases from the resample that played (CLOUD-HANDFIX). */
  const clockCsRef = useRef<ClockCanvas>({ ...DEFAULT_CANVAS_SETTINGS })

  /* ==================================================================== */
  /*  THE UNDO STACK                                                       */
  /* ==================================================================== */

  const undoRef = useRef<UndoStack<DocSnapshot> | null>(null)
  if (!undoRef.current) undoRef.current = new UndoStack<DocSnapshot>()
  const undo = undoRef.current
  /* `useSyncExternalStore` rather than mirroring the stack into React state:
   * the stack is written from event handlers that also write state, and a
   * second `useState` would render one frame behind the thing it describes —
   * an Undo button that stays disabled for a frame after the first stroke. */
  const undoState = useSyncExternalStore(undo.subscribe, undo.getState, undo.getState)

  /**
   * THE LIVE DOCUMENT.
   *
   * Read at the top of every mutating handler to get the BEFORE state, which is
   * what goes on the stack. It is written in two places and both are load
   * bearing: eagerly in `applyPatch` (so two writes inside one event chain
   * correctly, without waiting for a render) and in an effect with no dependency
   * array (so it re-syncs after every commit, and cannot drift if some path
   * ever sets state without going through `applyPatch`).
   */
  const docRef = useRef<DocSnapshot>({
    rawStrokes: [],
    processedStrokes: [],
    geometryMode: "rod",
    engineFamily: DEFAULT_ENGINE_FAMILY,
    extrudeParams: DEFAULT_EXTRUDE_PARAMS,
    widthSlider: extrudeWidthToSlider(DEFAULT_EXTRUDE_PARAMS.width),
    solidParams: DEFAULT_SOLID_PARAMS,
    inflateParams: DEFAULT_INFLATE_PARAMS,
    styleState: DEFAULT_STYLE_STATE,
    canvas: DEFAULT_CANVAS_SETTINGS,
    drawIn: DRAW_IN_DEFAULTS,
    revealEnvelope: REVEAL_ENVELOPE_DEFAULTS,
    take: STROKE_TIMING_TAKE_DEFAULTS,
    keys: undefined,
    penTip: readPenTipMode(),
    flatten: SOLID_STATE,
    revealWindow: REVEAL_WINDOW_DEFAULTS,
  })
  useEffect(() => {
    docRef.current = {
      rawStrokes,
      processedStrokes,
      geometryMode,
      engineFamily,
      extrudeParams,
      widthSlider,
      solidParams,
      inflateParams,
      styleState,
      canvas: canvasSettings,
      drawIn,
      revealWindow,
      revealEnvelope,
      take,
      keys,
      penTip,
      flatten,
    }
    settingsRef.current = { ...canvasSettings }
  })

  /**
   * Write a document patch to React state and to the live mirror. The ONLY
   * place any of these setters is called.
   *
   * IT IS ALSO THE DELIBERATE ESCAPE HATCH: "change the document without making
   * an undo step". Every history implementation the research reached has one and
   * names it — ProseMirror `addToHistory: false`, Yjs `trackedOrigins`,
   * Excalidraw `CaptureUpdateAction.NEVER`, tldraw `{ history: 'ignore' }` — and
   * ours was an ABSENCE (call the setter and skip `edit`) rather than a
   * mechanism, which is how a path ends up unrecorded by accident instead of by
   * decision. Calling `applyPatch` directly is the decision. Its three callers
   * are the boot restore, undo/redo themselves, and the debounced reprocess,
   * and each says in a comment why it is not a step.
   *
   * Note what it does NOT do: it never touches the redo stack. Excalidraw's
   * source calls this one out specifically — "a simple click (unselect) could
   * lead to losing all the redo entries" — so a non-recorded change must not
   * silently destroy a redo the user still has.
   */
  const applyPatch = useCallback((patch: Partial<DocSnapshot>) => {
    docRef.current = { ...docRef.current, ...patch }
    if (patch.rawStrokes !== undefined) setRawStrokes(patch.rawStrokes)
    if (patch.processedStrokes !== undefined) setProcessedStrokes(patch.processedStrokes)
    if (patch.geometryMode !== undefined) setGeometryMode(patch.geometryMode)
    if (patch.engineFamily !== undefined) setEngineFamily(patch.engineFamily)
    if (patch.extrudeParams !== undefined) setExtrudeParams(patch.extrudeParams)
    if (patch.widthSlider !== undefined) setWidthSlider(patch.widthSlider)
    if (patch.solidParams !== undefined) setSolidParams(patch.solidParams)
    if (patch.inflateParams !== undefined) setInflateParams(patch.inflateParams)
    if (patch.styleState !== undefined) setStyleState(patch.styleState)
    if (patch.drawIn !== undefined) setDrawIn(patch.drawIn)
    if (patch.revealWindow !== undefined) setRevealWindow(patch.revealWindow)
    if (patch.revealEnvelope !== undefined) setRevealEnvelope(patch.revealEnvelope)
    if (patch.take !== undefined) setTake(patch.take)
    /* `in`, not `!== undefined`: `undefined` is a real value here, "no keys",
     * and an undo back to a doc with none has to be able to write it. */
    if ("keys" in patch) setKeysState(patch.keys)
    if (patch.penTip !== undefined) setPenTip(patch.penTip)
    if (patch.flatten !== undefined) setFlatten(patch.flatten)
    if (patch.canvas !== undefined) {
      setCanvasSettings(patch.canvas)
      settingsRef.current = { ...patch.canvas }
    }
  }, [])

  /* A label supplied by the CALLER wins over the one derived from the diff.
   * `handleSelectPreset` knows the preset's real name; the diff can only say
   * which fields moved. */
  const labelOverrideRef = useRef<string | null>(null)

  /* HAND-DRAW-P2 (PEN-7). A new clock, rate, pace, draw-in, window, nib or
   * resample under a take with performed strokes re-stores those rows
   * (`rebasePerformed`), so each keeps the start and length he performed while
   * the other strokes follow the new clock. It rides in the same patch as the
   * change, one undo step. Null when nothing performed would move.
   * `rebaseForPatch` is in `lib/clock-rebase.ts`, so `assert-handfix` drives
   * the same call in Node. Refs only, so a callback holding an old copy is fine. */
  const rebaseForClock = (patch: Partial<DocSnapshot>): StrokeTimingTake | null => {
    if (gateKnocked("clock-no-rebase")) return null
    const d = docRef.current
    return rebaseForPatch(d.take, d, patch, clockCsRef.current, settingsRef.current)
  }

  /** Record the current document, then change it. Every mutation goes through
   *  here, which is what makes "does ⌘Z reach this?" a property of the file
   *  rather than of whether someone remembered. */
  const edit = useCallback(
    (label: string, key: string | null, patch: Partial<DocSnapshot>) => {
      undo.commit(docRef.current, { label: labelOverrideRef.current ?? label, key })
      /* CLOUD-HANDFIX, finding 1. The nib stamps the hand clock, and Thickness is
       * written from five places (both sliders, the geometry presets, the dev
       * dials), so the rebase sits here rather than at each. A patch that names
       * the take already decided it. */
      const nibTake = !("take" in patch) && patchMovesNib(docRef.current, patch) && !gateKnocked("clock-no-rebase-nib") ? rebaseForClock(patch) : null
      applyPatch(nibTake ? { ...patch, take: nibTake } : patch)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyPatch, undo],
  )

  /** Run `fn` as ONE undo step under a name of your choosing. */
  const labelled = useCallback(
    <R,>(label: string, fn: () => R): R => {
      const prev = labelOverrideRef.current
      labelOverrideRef.current = label
      try {
        return undo.transaction(fn)
      } finally {
        labelOverrideRef.current = prev
      }
    },
    [undo],
  )

  const doUndo = useCallback((): boolean => {
    const r = undo.undo(docRef.current)
    if (!r) return false
    applyPatch(r.snapshot)
    return true
  }, [applyPatch, undo])

  const doRedo = useCallback((): boolean => {
    const r = undo.redo(docRef.current)
    if (!r) return false
    applyPatch(r.snapshot)
    return true
  }, [applyPatch, undo])

  /**
   * THE GESTURE BRACKET — one pointer drag is one undo step, however long it
   * takes.
   *
   * The time window alone is wrong for this app. A dial here exists so the user
   * can drag it slowly and WATCH the render change; pausing mid-drag to look is
   * the intended use, and it crosses 500 ms every time. A window-only
   * implementation would split that single gesture into several steps, so ⌘Z
   * would walk the dial back in pieces. The graphics tools in the reference set
   * all bracket on the pointer instead (`docs/research/undo-redo-conventions.md`
   * §2) and so does this.
   *
   * IT LISTENS AT THE WINDOW, IN THE CAPTURE PHASE, RATHER THAN PER CONTROL —
   * and that is deliberate, not lazy. The style panel
   * (`components/style-panel-scaffold.tsx`) owns dozens of sliders and belongs
   * to another lane; a per-control `onPointerDown` would mean editing every one
   * of them, and would silently miss every slider added afterwards. One
   * listener covers every `input[type=range]` in the product, including ones
   * that do not exist yet.
   *
   * `pointercancel` and a window-level `pointerup` both close it: a drag that
   * ends outside the control, or is interrupted by a scroll or a context menu,
   * must not leave the bracket open — a stuck-open bracket would merge every
   * later dial move into one enormous step, which is worse than splitting one.
   */
  useEffect(() => {
    const isContinuous = (t: EventTarget | null) =>
      (t instanceof HTMLInputElement && (t.type === "range" || t.type === "color")) ||
      (t instanceof Element && t.closest("[data-stroke-drag]") !== null)
    const down = (e: PointerEvent) => {
      if (isContinuous(e.target)) undo.beginGesture()
    }
    const up = () => undo.endGesture()
    window.addEventListener("pointerdown", down, true)
    window.addEventListener("pointerup", up, true)
    window.addEventListener("pointercancel", up, true)
    return () => {
      window.removeEventListener("pointerdown", down, true)
      window.removeEventListener("pointerup", up, true)
      window.removeEventListener("pointercancel", up, true)
    }
  }, [undo])

  /* ==================================================================== */
  /*  THE DRAWING                                                          */
  /* ==================================================================== */

  /** A finished stroke. Its own step, always — two marks drawn a tenth of a
   *  second apart are two marks. */
  const handleStrokeComplete = useCallback(
    (raw: Stroke, processed: ProcessedStroke) => {
      edit("Draw stroke", null, {
        rawStrokes: [...docRef.current.rawStrokes, raw],
        processedStrokes: [...docRef.current.processedStrokes, processed],
      })
    },
    [edit],
  )

  /** The debounced re-derive that runs when a canvas setting changes. NOT a
   *  step: it is the tail of the setting change that already recorded itself,
   *  and recording it again would make one ⌘Z undo half of it. A new resample
   *  re-stamps the hand clock (and moves the recorded one's slots), so the
   *  performed rows are re-stored in the same patch (CLOUD-HANDFIX, finding 1);
   *  the undo snapshot before the setting change holds the old pair. */
  const handleReprocessed = useCallback(
    (processed: ProcessedStroke[]) => {
      const rebased = gateKnocked("clock-no-rebase-reprocess") ? null : rebaseForClock({ processedStrokes: processed })
      applyPatch(rebased ? { processedStrokes: processed, take: rebased } : { processedStrokes: processed })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyPatch],
  )

  const handleCanvasSettingsChange = useCallback(
    (patch: Partial<CanvasSettings>, opts?: { coalesceKey?: string }) => {
      const next = { ...docRef.current.canvas, ...patch }
      const key = Object.keys(patch)[0] ?? "canvas"
      edit(humanise(key), opts?.coalesceKey ?? null, { canvas: next })
    },
    [edit],
  )

  /**
   * THE TAKE, EDITED. The viewport's `DRAW IN` and `WINDOW` popovers call these
   * with the same `Partial<…>` patch shape they used to hand their own setter,
   * so nothing in that panel changed except where the answer lives.
   *
   * No coalesce key, and that is a decision rather than an omission: `overlap`
   * and `length` are `input[type=range]`, so the window-level gesture bracket
   * above already makes one drag one step, and everything else in these two
   * objects is a pill or a select where one click IS one step.
   *
   * The label is prefixed rather than tabled. `humanise("mode")` alone would
   * read "Undo Mode" next to a geometry mode that is also a mode, and a table
   * of eight entries would need a ninth the day a dial is added.
   */
  const handleDrawInChange = useCallback(
    (patch: Partial<DrawInParams>) => {
      const key = Object.keys(patch)[0] ?? "drawIn"
      const next = { ...docRef.current.drawIn, ...patch }
      /* CLOUD-HANDFIX, finding 2: a draw-in change moves the base slots (the
       * tracks), so performed rows are re-stored with it, as the preset does. */
      const rebased = gateKnocked("clock-no-rebase-drawin") ? null : rebaseForClock({ drawIn: next })
      edit(`Draw-in ${humanise(key).toLowerCase()}`, null, rebased ? { drawIn: next, take: rebased } : { drawIn: next })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [edit],
  )

  const handleFlattenChange = useCallback(
    (patch: Partial<FlatState>) => {
      const key = Object.keys(patch)[0] ?? "flatten"
      edit(`Form ${humanise(key).toLowerCase()}`, null, {
        flatten: { ...docRef.current.flatten, ...patch },
      })
    },
    [edit],
  )

  const handleRevealEnvelopeChange = useCallback(
    (patch: Partial<RevealEnvelopeParams>, gesture?: string | null) => {
      const key = Object.keys(patch)[0] ?? "revealEnvelope"
      const cur = docRef.current.revealEnvelope
      const next = { ...cur, ...patch }
      const rebased = rebaseForClock({ revealEnvelope: next })
      edit(`Playback ${humanise(key).toLowerCase()}`, gesture ?? null, rebased ? { revealEnvelope: next, take: rebased } : { revealEnvelope: next })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [edit],
  )

  /* The take arrives whole, not as a patch: a row is added or dropped, and a
   * merge could not say "this stroke no longer has a row". */
  const handleTakeChange = useCallback(
    (next: StrokeTimingTake) => {
      edit("Stroke timing", null, { take: next })
    },
    [edit],
  )
  /* ANIM-1B · the strip and the stroke block write here. `key` names the
   * gesture: every move in one drag carries the same key, and the bars carry
   * `data-stroke-drag`, which the bracket below treats like a slider, so one
   * drag is one ⌘Z. */
  const commitTake = useCallback(
    (next: StrokeTimingTake, key: string | null) => {
      edit("Stroke timing", key, { take: next })
    },
    [edit],
  )
  /* ANIM-3B · the key lanes write here, through the take context. Refused
   * whole when `validateKeys` finds anything, and the reasons go back to the
   * caller to show: an invalid key never reaches the doc and is never dropped
   * quietly. `key` coalesces like `commitTake`, so one drag is one ⌘Z. */
  const setKeys = useCallback(
    (next: TakeKeys | undefined, key: string | null): string[] => {
      const bad = validateKeys(next)
      if (bad.length) return bad
      edit("Keys", key, { keys: compactKeys(next) })
      return []
    },
    [edit],
  )
  /* THE CLOCK (HAND-DRAW, 2026-09-26), pen-clock-on-slash-plan.md §3. One memo,
   * upstream of the viewport, the strip and the take provider, so every clock
   * reader on / gets the hand without being edited. `recorded` at rate 1 hands
   * back the SAME arrays, so the take is main's.
   *
   * `hand` STAMPS THE RAW TRACE AND CARRIES `t` THROUGH `processStroke`
   * (HAND-DRAW-3), the order Desk Doodles uses: `stampPenClock` on the recorded
   * points, then the same resample and smoothing the stroke was drawn with.
   * Stamping the resample instead moved `humanLiftsMs`' letter map, so the
   * longest lift fell between the two o's of "Doodles" rather than at the word
   * space. Only `t` is copied onto the stored processed points, so geometry
   * cannot move. A stroke whose stored resample no longer matches (the canvas
   * spacing changed after it was drawn) takes `t` by arc length instead and is
   * counted in `drift`. `dropSubNibStubs` stays off because the take is keyed
   * by stroke index. The nib is the base thickness, never the keyed width
   * track, or the clock would change under its own playback.
   *
   * `rate` then divides every `t`, whichever clock it is. DrawingCanvas keeps
   * the recorded arrays: the input canvas is the recording. */
  const clockNib = computeSolidEffectiveThicknessPx(solidParams.thickness)
  const clockMsRef = useRef(0)
  const clocked = useMemo(
    () => {
      const cs = { ...settingsRef.current }
      return { ...clockStrokesFor(rawStrokes, processedStrokes, revealEnvelope, clockNib, cs), cs }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawStrokes, processedStrokes, revealEnvelope.clock, revealEnvelope.rate, clockNib],
  )
  clockMsRef.current = clocked.ms
  clockCsRef.current = clocked.cs
  const takePenMs = useMemo(() => {
    const knock = typeof window !== "undefined" && (window as unknown as { __FS_GATE_MUTATE?: string }).__FS_GATE_MUTATE === "clock-strip-recorded"
    return penMsOf(knock ? rawStrokes : clocked.raw)
  }, [clocked.raw, rawStrokes])
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    const w = window as unknown as Record<string, unknown>
    w.__fsClock = {
      get: () => ({
        clock: revealEnvelope.clock,
        hand: clocked.hand,
        sameRef: clocked.processed === processedStrokes && clocked.raw === rawStrokes,
        nib: clockNib,
        takePenMs,
        memoMs: clockMsRef.current,
        rate: revealEnvelope.rate,
        drift: clocked.drift,
        recorded: processedStrokes.map((s) => s.points),
        clocked: clocked.processed.map((s) => s.points),
        rawRecorded: rawStrokes.map((s) => s.points),
        stamped: clocked.stamped?.map((s) => s.points) ?? null,
      }),
    }
    return () => { delete w.__fsClock }
  }, [clocked, processedStrokes, rawStrokes, revealEnvelope.clock, revealEnvelope.rate, clockNib, takePenMs])

  const handleRevealWindowChange = useCallback(
    (patch: Partial<RevealWindowParams>) => {
      const key = Object.keys(patch)[0] ?? "revealWindow"
      const next = { ...docRef.current.revealWindow, ...patch }
      /* CLOUD-HANDFIX, finding 2: Grow to Travel changes `liftsLandBetweenStrokes`
       * and with it the pace, so performed rows are re-stored with it. */
      const rebased = gateKnocked("clock-no-rebase-window") ? null : rebaseForClock({ revealWindow: next })
      edit(`Window ${humanise(key).toLowerCase()}`, null, rebased ? { revealWindow: next, take: rebased } : { revealWindow: next })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [edit],
  )

  /**
   * CLEAR — undoable, and it needs no confirmation dialog because of that.
   *
   * WHAT IT WAS: `setRawStrokes([])` with no snapshot, no confirm and no undo,
   * on a button sitting immediately beside Undo, and the persist effect wrote
   * `"[]"` through to `localStorage` on the very next tick. One mis-click
   * destroyed the drawing on disk with nothing to get it back from.
   *
   * WHAT IT IS NOW, and why not a confirm dialog. The HIG position is that a
   * reliable undo is better than a confirmation prompt — a prompt taxes every
   * correct use of the button to protect against the rare wrong one, and users
   * learn to dismiss it, which is worse than not having it. So Clear is a step
   * on the stack like any other and ⌘Z takes it back.
   *
   * THE TRASH SLOT IS THE PART A STACK CANNOT DO. History is in memory and does
   * not survive a reload (see `lib/doc-store.ts`), so "clear, then close the
   * tab" is the one path an undo stack cannot cover — and it is the exact path
   * that loses everything. The strokes are written to their own key first, and
   * offered back on the next boot.
   */
  const handleClearCanvas = useCallback(() => {
    const before = docRef.current.rawStrokes
    if (!before.length) return
    writeVersioned(trashSchema, before)
    edit("Clear canvas", null, { rawStrokes: [], processedStrokes: [] })
    toast("Canvas cleared", {
      description: `${before.length} stroke${before.length === 1 ? "" : "s"} removed. ⌘Z brings them back.`,
      action: { label: "Undo", onClick: () => doUndo() },
    })
  }, [doUndo, edit])

  /* ==================================================================== */
  /*  PERSISTENCE                                                          */
  /* ==================================================================== */

  /**
   * BOOT. One effect, three keys, in one place — the two that existed were
   * already two chances to get the write-before-restore ordering wrong, and the
   * session key would have been a third.
   *
   * Everything is read BEFORE anything is written (`hydratedRef` gates the save
   * effects below), because the classic failure here is an empty initial state
   * overwriting the saved document on every boot — a persistence feature that
   * looks like it was never built.
   */
  const hydratedRef = useRef(false)
  useEffect(() => {
    const notes: string[] = []
    const problems: { what: string; note: string }[] = []

    const session = readVersioned(sessionSchema)
    const strokes = readVersioned(strokesSchema)
    const fusions = readVersioned(fusionsSchema)

    for (const [what, r] of [
      ["Your styling", session],
      ["Your drawing", strokes],
      ["Your fusions", fusions],
    ] as const) {
      if (r.outcome === "corrupt" || r.outcome === "foreign" || r.outcome === "future" || r.outcome === "invalid") {
        problems.push({ what, note: r.note })
      }
      if (r.repairs.length) notes.push(`${what}: ${r.repairs.join("; ")}`)
      if (r.outcome === "migrated") notes.push(`${what}: ${r.note}`)
    }

    const s: SessionDoc = session.data ?? defaultSession()
    /* THE FUSION LIBRARY HAS EXACTLY ONE HOME, and it is its own key.
     *
     * `customFusions` is a field of `StyleState`, so the session blob would
     * carry a second copy of it — and two copies of one list is how they come
     * to disagree. `validateSession` empties the field on the way in and the
     * writer empties it on the way out; this line is the single point where the
     * library is joined back onto style state. */
    const style: StyleState = { ...s.styleState, customFusions: fusions.data ?? [] }

    const restoredStrokes = strokes.data ?? []
    const processed = restoredStrokes.map((r) =>
      processStroke(r, s.canvas.spacing, s.canvas.smoothing, s.canvas.preserveCorners),
    )

    applyPatch({
      rawStrokes: restoredStrokes,
      processedStrokes: processed,
      geometryMode: s.geometryMode,
      engineFamily: s.engineFamily,
      extrudeParams: s.extrudeParams,
      widthSlider: s.widthSlider,
      solidParams: s.solidParams,
      inflateParams: s.inflateParams,
      styleState: style,
      canvas: s.canvas,
      drawIn: s.drawIn,
      revealWindow: s.revealWindow,
      revealEnvelope: s.revealEnvelope,
      take: s.take,
      keys: s.keys,
      penTip: s.penTip,
      flatten: s.flatten,
    })
    /* The document was REPLACED, not edited. Any history against the previous
     * document would undo into a state the user never saw. */
    undo.reset()
    hydratedRef.current = true

    /* SAY WHAT HAPPENED. A repair nobody is told about is indistinguishable
     * from a bug, and a payload set aside in silence is the app quietly
     * deciding your work was bad. */
    for (const p of problems) {
      toast.error(`${p.what} could not be restored`, {
        description: `${p.note} You can keep working; nothing was deleted.`,
        duration: 12000,
      })
    }
    if (notes.length) {
      toast(notes.length === 1 ? "Restored with repairs" : `Restored with repairs`, {
        description: notes.join(" · "),
        duration: 10000,
      })
    }

    /* THE TRASH SLOT. The undo stack does not survive a reload (see
     * `lib/doc-store.ts` for why), so Clear-then-reload is the one hole it
     * cannot cover — and Clear is the most destructive button in the app. The
     * cleared drawing is kept under its own key and offered back exactly when
     * offering it back makes sense: the canvas is empty and something is in the
     * bin. */
    if (restoredStrokes.length === 0) {
      const trash = readVersioned(trashSchema)
      if (trash.data && trash.data.length) {
        const bin = trash.data
        toast("Your last drawing was cleared", {
          description: `${bin.length} stroke${bin.length === 1 ? "" : "s"} are still recoverable.`,
          duration: 15000,
          action: {
            label: "Restore",
            onClick: () => {
              const proc = bin.map((r) =>
                processStroke(
                  r,
                  settingsRef.current.spacing,
                  settingsRef.current.smoothing,
                  settingsRef.current.preserveCorners,
                ),
              )
              edit("Restore cleared drawing", null, { rawStrokes: bin, processedStrokes: proc })
            },
          },
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * A FAILED SAVE HAS TO SAY SO — ONCE.
   *
   * `localStorage` is ~5 MB per origin and a drawing is the big thing in it
   * (measured: 40 strokes × 120 points = 274 KB, so roughly 700 such strokes
   * fill it). When the quota is hit the write simply throws, and the old code —
   * and `writeVersioned`'s own `catch` — swallowed it. That is the quietest
   * data-loss path in the app: you keep drawing, every autosave fails, nothing
   * changes on screen, and the reload takes back everything after the ceiling.
   *
   * Once, not per write: the effect fires per stroke, and a toast per stroke
   * would be its own defect.
   */
  const quotaWarnedRef = useRef(false)
  const reportWrite = useCallback((outcome: ReturnType<typeof writeVersioned>, what: string) => {
    if (outcome !== "quota" || quotaWarnedRef.current) return
    quotaWarnedRef.current = true
    toast.error("This drawing is too large to save automatically", {
      description: `${what} could not be written to this browser's storage. Your work is safe in this tab, but it will NOT survive a reload. Export it before you close.`,
      duration: 20000,
    })
  }, [])

  /* PUSH THE TIP INTO THE MODULE. `lib/pen-reveal.ts` holds it as module state
   * with its own subscriber set, which is what the renderer reads, so React
   * state alone would show a pill selected and draw the old shape. ONE writer,
   * here, keyed on the document's value: hydration, a preset and a click all
   * arrive as the same state change and none of them needs to know about the
   * module. `setPenTipMode` is a no-op when the value is unchanged. */
  useEffect(() => {
    setPenTipMode(penTip)
  }, [penTip])

  /* SAVE. Keyed on the state, never called from the setters — `app/page.tsx`
   * already learned that a save call per mutation site is one chance per site
   * to miss one, and there are now far more than five. */
  useEffect(() => {
    if (!hydratedRef.current) return
    reportWrite(writeVersioned(strokesSchema, rawStrokes), "The drawing")
  }, [rawStrokes, reportWrite])

  useEffect(() => {
    if (!hydratedRef.current) return
    reportWrite(writeVersioned(fusionsSchema, styleState.customFusions), "Your fusions")
  }, [styleState.customFusions, reportWrite])

  useEffect(() => {
    if (!hydratedRef.current) return
    const outcome = writeVersioned(sessionSchema, {
      /* `customFusions` is stripped: the fusion key owns that list. */
      styleState: { ...styleState, customFusions: [] },
      geometryMode,
      engineFamily,
      extrudeParams,
      widthSlider,
      solidParams,
      inflateParams,
      canvas: canvasSettings,
      drawIn,
      revealWindow,
      revealEnvelope,
      take,
      /* Only when there are keys, so a doc with none saves byte for byte as it
       * did before keys existed. */
      ...(keys ? { keys } : {}),
      penTip,
      flatten,
    })
    reportWrite(outcome, "Your styling")
  }, [
    styleState,
    geometryMode,
    engineFamily,
    extrudeParams,
    widthSlider,
    solidParams,
    inflateParams,
    canvasSettings,
    drawIn,
    revealWindow,
    revealEnvelope,
    take,
    keys,
    penTip,
    flatten,
    reportWrite,
  ])

  /* ==================================================================== */
  /*  THE KEYS                                                             */
  /* ==================================================================== */

  /**
   * ⌘Z / ⇧⌘Z, at the window, over the WHOLE document.
   *
   * This listener used to live in `DrawingCanvas` and reached only the stroke
   * list — and it bailed on `e.shiftKey` before doing anything, which is why
   * there was no redo in the app at all. It is here now because the thing being
   * undone is the document, not the canvas.
   *
   * ⌘Y is bound as well: it is the Windows convention for redo and costs
   * nothing to honour.
   *
   * THE GUARD IS NARROWER THAN IT WAS, AND THE TEST IS "does this control have
   * a native undo of its own to defer to?"
   *
   * The old guard skipped every `INPUT` and every `SELECT`. That meant ⌘Z did
   * nothing at all while a SLIDER had focus — which is exactly the moment a
   * user reaches for it, having just dragged the dial too far — and nothing
   * while the layer-order dropdown had focus, which is where a stack edit
   * leaves it. Neither a range input nor a select has any native undo, so there
   * was nothing being deferred to: the keypress was simply eaten.
   *
   * A text field genuinely does have one, and stealing ⌘Z from a half-typed
   * fusion name would be the worse bug. So the skip list is text entry only.
   */
  useEffect(() => {
    const TEXT_ENTRY = new Set(["text", "search", "url", "tel", "email", "password", "number", "date", "time"])
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return
      const k = e.key.toLowerCase()
      const isUndo = k === "z" && !e.shiftKey
      const isRedo = (k === "z" && e.shiftKey) || (k === "y" && !e.shiftKey)
      if (!isUndo && !isRedo) return

      const t = e.target as HTMLElement | null
      if (t) {
        if (t.isContentEditable || t.tagName === "TEXTAREA") return
        if (t.tagName === "INPUT") {
          const type = (t as HTMLInputElement).type?.toLowerCase() ?? "text"
          if (TEXT_ENTRY.has(type)) return
        }
      }
      e.preventDefault()
      const moved = isRedo ? doRedo() : doUndo()
      if (!moved) {
        /* SAYING NOTHING IS THE WRONG ANSWER. A ⌘Z that silently does nothing
         * is indistinguishable from a ⌘Z that is not wired up, and this app
         * shipped exactly that for ⇧⌘Z. */
        toast(isRedo ? "Nothing to redo" : "Nothing to undo", { duration: 1400 })
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [doUndo, doRedo])

  // The Style panel's open family. Since L4 the panel is one of the dock
  // shell's six; whether it shows is the workspace's call and the rail's, so
  // the drawer's open flag and the summary strip's pill toggle went with them.
  const [activePanelId, setActivePanelId] = useState<StylePanelId>("material")

  /**
   * THE STYLE PANEL'S ONE WRITE PATH, RECORDED.
   *
   * `StylePanelScaffold` takes a single `setStyleState` prop and drives every
   * control in the product through it — every dial, the whole layer stack, the
   * fusion editor including its delete. So wrapping this one function is what
   * puts all of them on the undo stack, and it is why a control added to that
   * panel next week is undoable without anyone wiring it up.
   *
   * The functional form is applied HERE rather than handed to React, because
   * the BEFORE state has to be known at commit time. `docRef` is the authority
   * on what that is (see its comment) — reading the `styleState` closure
   * variable instead would record a stale document whenever two writes land in
   * one event.
   */
  /* K3 · THE KEY CLOCK, for the style setter below. `KeyedStyle` (inside the
   * transport's provider, which this component renders) points it at the
   * transport's playhead times the keyed length, the clock the frame samples
   * keys on. */
  const keyClockRef = useRef<() => number>(() => 0)
  const setStyleStateRecorded = useCallback(
    (action: StyleState | ((s: StyleState) => StyleState)) => {
      const prev = docRef.current.styleState
      const next = typeof action === "function" ? (action as (s: StyleState) => StyleState)(prev) : action
      if (next === prev) return
      const changed = changedStyleKeys(prev, next)
      if (changed.length === 0) {
        /* A new object holding identical values. Apply it (so React state and
         * the mirror stay in step) but do NOT record a step — an undo entry
         * that restores the same document is a ⌘Z that visibly does nothing. */
        applyPatch({ styleState: next })
        return
      }
      /* A change to ONLY the preset receipt fields is the tail of a step that
       * already recorded itself. */
      if (changed.every((k) => RECEIPT_FIELDS.has(k)) && labelOverrideRef.current === null) {
        applyPatch({ styleState: next })
        return
      }
      /* K3 · EDITING A KEYED VALUE WRITES A KEY AT THE PLAYHEAD, in the same
       * step as the edit, so one drag is one undo (`keyedStyleEdit`). */
      const keyed = keyedStyleEdit(prev, next, docRef.current.keys, keyClockRef.current())
      edit(
        styleChangeLabel(prev, next, changed),
        styleCoalesceKey(prev, next, changed),
        keyed ? { styleState: next, keys: keyed } : { styleState: next },
      )
    },
    [applyPatch, edit],
  )

  // Switch geometry mode. If the user has NOT explicitly pinned a material
  // (materialUserOverride === false), follow the per-mode default material so
  // each mode reads with a sensible surface out of the box. A user override
  // always wins. Geometry params are never touched here.
  //
  // Split into a PURE patch builder plus a recording wrapper: the builder is
  // reused by `applyGeometrySettings`, which needs the mode change folded into
  // the same single undo step as the dials it sets alongside it.
  const modeChangePatch = (mode: GeometryMode): Partial<DocSnapshot> => {
    const s = docRef.current.styleState
    return {
      geometryMode: mode,
      styleState: s.materialUserOverride ? s : { ...s, materialPreset: MODE_MATERIAL_DEFAULTS[mode] },
    }
  }

  const handleModeChange = (mode: GeometryMode) => {
    if (docRef.current.geometryMode === mode) return
    const label = GEOMETRY_MODES.find((m) => m.value === mode)?.label ?? mode
    edit(`${label} mode`, null, modeChangePatch(mode))
  }

  /* ==================================================================== */
  /*  THE TWO PRESET FAMILIES THAT DO NOT LIVE IN STYLE STATE              */
  /* -------------------------------------------------------------------- */
  /*  Every other family's patch is a `Partial<StyleState>` and is merged   */
  /*  by `applyPresetToStyleState`. Two are not:                            */
  /*                                                                        */
  /*    geometry  a MODE plus that mode's dials — five useState hooks in    */
  /*              THIS file, which a style merge can never reach.           */
  /*    view      camera framing and export — imperative calls into the     */
  /*              viewport, which is not state at all.                      */
  /*                                                                        */
  /*  `applyPresetToStyleState` REFUSES both families and returns the state  */
  /*  untouched, deliberately leaving no receipt, because it is not the      */
  /*  layer that can know whether the patch landed. This is that layer.      */
  /*                                                                        */
  /*  🚨 AND THIS IS WHY THE PILLS COULD NOT BE ENABLED FIRST. A preset      */
  /*  pill that is on the rail but cannot reach its state does not do        */
  /*  nothing — it runs the composition reset and applies nothing on top,    */
  /*  i.e. it WIPES the user's texture, dither, ASCII, stack and fusion and  */
  /*  then names itself in the summary chip. That exact shape has shipped    */
  /*  here twice. The routing goes in first; the rail follows it.            */
  /* ==================================================================== */

  /** The full geometry control surface as one plain object — mirrors
   *  `GeometrySettings` field for field. Read fresh at click time. */
  const currentGeometrySettings = (): GeometrySettings => {
    const d = docRef.current
    return {
      mode: d.geometryMode,
      extrudeWidthSlider: d.widthSlider,
      extrudeDepth: d.extrudeParams.depth,
      extrudeBevelEnabled: d.extrudeParams.bevelEnabled,
      extrudeSideWall: d.extrudeParams.sideWall,
      solidThickness: d.solidParams.thickness,
      solidDepth: d.solidParams.depth,
      inflateFusion: d.inflateParams.fusion,
      inflateBlend: d.inflateParams.blend,
      inflateResolution: d.inflateParams.resolution,
      inflateLoopEnds: d.inflateParams.loopEnds ?? DEFAULT_INFLATE_PARAMS.loopEnds ?? "wrapped",
    }
  }

  /** Writes a whole `GeometrySettings` back into the five hooks it mirrors.
   *  Used for BOTH applying a preset and undoing one, so undo cannot drift
   *  from apply — they are the same function called with different objects.
   *
   *  `width` is derived from the slider through `mapExtrudeWidthSlider`, never
   *  carried alongside it: the slider is the control the user has and the raw
   *  half-width is its image, and keeping both in the settings object is how
   *  the two come to disagree. */
  const geometrySettingsPatch = (g: GeometrySettings): Partial<DocSnapshot> => {
    const d = docRef.current
    const modePatch = d.geometryMode === g.mode ? {} : modeChangePatch(g.mode)
    return {
      ...modePatch,
      widthSlider: g.extrudeWidthSlider,
      extrudeParams: {
        ...d.extrudeParams,
        width: mapExtrudeWidthSlider(g.extrudeWidthSlider),
        depth: g.extrudeDepth,
        bevelEnabled: g.extrudeBevelEnabled,
        sideWall: g.extrudeSideWall,
      },
      solidParams: { ...d.solidParams, thickness: g.solidThickness, depth: g.solidDepth },
      inflateParams: {
        ...d.inflateParams,
        fusion: g.inflateFusion,
        blend: g.inflateBlend,
        resolution: g.inflateResolution,
        loopEnds: g.inflateLoopEnds,
      },
    }
  }

  const applyGeometrySettings = (g: GeometrySettings) => {
    /* ONE PATCH, so this is ONE undo step. It used to be five React setters in
     * a row; on the stack that would have been five entries, four of which land
     * the user in a geometry state that never existed on screen — half a preset
     * applied, which is a step nobody can recognise. */
    edit("Geometry preset", null, geometrySettingsPatch(g))
  }

  /* ⚠ THE ONE-SLOT PRESET UNDO IS GONE, AND THIS IS WHAT REPLACED IT.
   *
   * What was here: a `useRef` holding ONE snapshot, reachable ONLY by clicking
   * an action inside a toast before that toast dismissed, with no keyboard
   * binding — and covering the GEOMETRY and VIEW families only. The other
   * thirteen families had no undo at all, which is the wrong thirteen: a
   * composition preset RESETS every composition rail before applying its patch
   * (`applyPresetToStyleState`), so the families that wipe your work were
   * exactly the families you could not take back.
   *
   * Now every family — all fifteen — records through `edit`/`labelled` onto the
   * real stack, so ⌘Z reaches them whether or not a toast is still on screen.
   * The toast's Undo action stays, because it is good discoverability, but it
   * is no longer the mechanism: it just calls the same `doUndo` the keys do.
   *
   * `revertLastPreset` is kept as a named function because the dev capture
   * harness exposes it as `revertPreset` and `assert-preset-routing.mjs` drives
   * it. It is now a thin alias for the real undo. */
  const revertLastPreset = (): boolean => doUndo()

  /** The viewport's imperative camera/export surface. `null` until the
   *  dynamically-imported 3D chunk has mounted — a view preset clicked before
   *  then says so rather than failing silently. */
  const viewportApiRef = useRef<ViewportApi | null>(null)

  /* ==================================================================== */
  /*  THE CRASH LAW — `ViewportErrorBoundary` had no way to be reached     */
  /* -------------------------------------------------------------------- */
  /*  `ViewportErrorBoundary` (components/viewport-3d.tsx:5367) is a real   */
  /*  recovery surface — a "Rebuild the view" button, a second copy for a   */
  /*  repeat failure, a collapsed technical detail. NOTHING IN THIS REPO    */
  /*  COULD MAKE IT APPEAR. It has never been seen, never been screenshot,  */
  /*  and no gate has ever driven it, which puts it in exactly the category */
  /*  docs/README.md warns about: code that reads correct and has never     */
  /*  presented a frame.                                                    */
  /*                                                                        */
  /*  The law is the repo's own `readDevLaw` shape — a `window.__fs*` key    */
  /*  that is inert in production and inert unless explicitly set — but it   */
  /*  is read HERE rather than inside the viewport, because the boundary's   */
  /*  file belongs to another lane. The throw is delivered through the one   */
  /*  channel this file already owns: the `processedStrokes` prop. A getter  */
  /*  that throws fires the instant anything inside the boundary reads the   */
  /*  stroke, which is what a real scene-side crash looks like.              */
  /*                                                                        */
  /*  It is a PROP, not a mutation: flipping it back re-renders a clean      */
  /*  array, so the boundary's own "Rebuild the view" button is testable     */
  /*  rather than permanently re-throwing.                                   */
  const [crashViewport, setCrashViewport] = useState(false)
  const viewportStrokes = crashViewport
    ? ([
        {
          get points(): never {
            /* The reader's stack is published before the throw. It is what
             * settles WHERE the fault lands — a read during React's render
             * phase is catchable by a boundary; a read inside `useFrame` is a
             * rAF callback and no React boundary can ever see it. Measured
             * output is in the lane's return. */
            if (typeof window !== "undefined") {
              ;(window as unknown as Record<string, unknown>).__fsCrashReaderStack =
                new Error("reader").stack
            }
            throw new Error("dev law __fsCrashViewport: forced scene-side throw")
          },
        },
      ] as unknown as ProcessedStroke[])
    : clocked.processed

  const applyGeometryPresetById = (id: string): boolean => {
    const before = currentGeometrySettings()
    const next = applyGeometryPreset(before, id)
    /* Not a geometry preset, or one carrying no patch: change nothing and
     * record nothing. A no-op that is visibly a no-op is safe; a no-op that
     * leaves a receipt in the summary chip is the lie. */
    if (!next) return false
    const preset = findPreset(id)
    const movedMode = geometryPresetChangesMode(before.mode, id)
    /* ONE step, named after the preset. The geometry patch and the preset
     * receipt land inside the same transaction, so ⌘Z takes back the whole
     * click rather than the receipt and then the dials. */
    labelled(preset?.label ?? id, () => {
      applyGeometrySettings(next)
      const s = docRef.current.styleState
      applyPatch({
        styleState: {
          ...s,
          activePresetFamily: "geometry",
          activePresetId: id,
          lastAppliedPresetId: id,
        },
      })
    })
    toast(preset?.label ?? id, {
      description: movedMode
        ? `Switched to ${next.mode} and set its dials. Your other modes are untouched.`
        : `${next.mode} dials set. Everything stays editable.`,
      action: { label: "Undo", onClick: () => revertLastPreset() },
    })
    return true
  }

  /* THE TURNTABLE, TRACKED — because a fusion has to be able to ASK.
   *
   * `api.setSpin` is imperative and the viewport owns the number, so nothing
   * outside the 3D tree could tell whether the mark was turning. `orbit` is a
   * fusion SOURCE (`viewTurn`, and every "your hand on the object" combination
   * cell), and at the head-on angle it rests at EXACTLY zero — so a panel that
   * could not see the camera could not say why the relationship was silent, and
   * a wake that could not reach the camera could not cure it. One writer, so the
   * tracked value and the viewport cannot drift apart. */
  const [cameraSpin, setCameraSpin] = useState(0)
  /* A REF BESIDE THE STATE, and it is not belt-and-braces.
   *
   * `__styleHarness` is installed by an effect with an explicit dependency list,
   * so every getter on it closes over the values from the render that installed
   * it. `cameraSpin()` therefore reported the value from the LAST RENDER — and a
   * gate that set the spin and read it back in the same tick got the old number.
   * Caught by `assert-fusion-combo-ui.mjs` reading "spin 12 -> 12" and looking
   * like a broken fix rather than a stale read. The state drives React; the ref
   * is what anything asking OUT OF BAND has to read. */
  const cameraSpinRef = useRef(0)
  /* ═══ FRAME THE DRAWING, BECAUSE NOTHING DID ═══════════════════════════
   *
   * Measured 2026-09-04 by filming the beat and LOOKING at it. A three-stroke
   * mark drawn at the default camera plays like this: the first stroke draws
   * over the opening second, and the remaining three seconds are a static
   * first stroke while the rest of the drawing draws OFF-SCREEN to the right.
   * You can watch the second and third marks clip in at the frame edge and
   * never arrive. Twenty-four frames, and eighteen of them are the same
   * picture.
   *
   * One click of "Reset camera" before pressing play fixes it completely: same
   * code, same settings, and all three strokes draw inside the frame. So the
   * camera was always able to frame the mark. Nothing ever asked it to.
   *
   * WHY THE ANGLE IS WRITTEN OUT. `handleResetCamera` builds its direction as
   * `new THREE.Vector3(1, 1, 1).normalize()`, which is azimuth 45 and
   * elevation atan(1/sqrt(2)) = 35.264 degrees. The API exposes `orbitView`
   * and no reset, and adding one would mean editing the viewport while a lane
   * is in it, so the angle is reproduced here rather than shared. ⚠ If that
   * direction ever changes, this drifts silently. It is the kind of second
   * copy this repo keeps getting caught by.
   *
   * ONLY ON GROWTH, so it cannot fight you. `framedRadius` remembers what was
   * last framed and the refit is skipped unless the mark has outgrown it by
   * more than 2 percent. Draw inside what is already framed and the camera
   * holds still; orbit to an angle you like and it stays there until your
   * drawing no longer fits.
   *
   * ONCE THE CANVAS HAS SETTLED (CLOUD-REFIT). An orthographic camera's zoom is
   * the canvas's half-height over the framed half-height (`applyFraming`), read
   * at the moment of the refit, and it is kept through every later resize (F123
   * in components/viewport-3d.tsx says why the frame is not re-read per resize).
   * A refit on a fixed 450 ms timer read whatever height the canvas had then:
   * at 834x1112 the stacked canvas was still growing 188 to 217.72 px, and the
   * at-load zoom read 34.78, 34.68, 33.92, 33.92 over four loads. So after the
   * wait for the geometry, a ResizeObserver on the 3D canvas has to report no
   * change for REFIT_SETTLE_FRAMES animation frames in a row, and the refit
   * then runs ONCE. It is never re-run per resize: the observer and the frame
   * loop are torn down with the refit. `window.__fsRefitTimer = "fixed"`
   * (dev only, set before navigation) parks the fixed timer for the must-fail
   * arm of assert-refit-settles. */
  const framedRadiusRef = useRef(0)
  useEffect(() => {
    if (rawStrokes.length === 0) {
      framedRadiusRef.current = 0
      return
    }
    /* 6 frames in a row at one size; and a ceiling, so a canvas that never
     * holds still (a resize dragged for seconds) is still framed once. */
    const REFIT_SETTLE_FRAMES = 6
    const REFIT_MAX_FRAMES = 600
    const fixedTimer =
      process.env.NODE_ENV !== "production" &&
      typeof window !== "undefined" &&
      (window as unknown as { __fsRefitTimer?: string }).__fsRefitTimer === "fixed"
    let raf = 0
    let ro: ResizeObserver | null = null
    let stable = 0
    let frames = 0
    let last = ""
    /* The canvas's box and buffer, and the box of the div R3F measures. R3F
     * sizes the canvas from that div a render or more later, so a canvas that
     * has not caught up with its container is not settled either. */
    const sizeKey = (c: HTMLCanvasElement) => {
      const r = c.getBoundingClientRect()
      const p = c.parentElement?.getBoundingClientRect() ?? r
      return `${r.width}x${r.height}:${c.width}x${c.height}:${p.width}x${p.height}`
    }
    const caughtUp = (c: HTMLCanvasElement) => {
      const r = c.getBoundingClientRect()
      const p = c.parentElement?.getBoundingClientRect() ?? r
      return Math.abs(r.width - p.width) < 1 && Math.abs(r.height - p.height) < 1
    }
    const refit = () => {
      const api = viewportApiRef.current
      const b = api?.bounds()
      if (!api || !b || !(b.radius > 0)) return
      if (framedRadiusRef.current > 0 && b.radius <= framedRadiusRef.current * 1.02) return
      /* fillK 1.7, and the number was measured rather than picked. At the
       * default the mark's lowest ink sat at 0.998 of the visible viewport,
       * which is under the transport strip. Restarting the dev server between
       * each value, because it does not pick up edits (F83):
       *   1.0  span 0.697, bottom 0.998, clipped
       *   1.45 span 0.560, bottom 0.983, two thousandths of margin
       *   1.7  span 0.478, bottom 0.936
       *   2.5  span 0.324, too far out to read
       * The mark centres on the CANVAS while the transport covers the lower
       * quarter of it, so it always sits low and the extra distance is what
       * buys the margin back. */
      if (api.orbitView(45, 35.264, 1.7)) framedRadiusRef.current = b.radius
    }
    /* The geometry has to be BUILT before it has bounds, and the build is
     * debounced behind the stroke commit. This waits rather than reading a
     * null radius and giving up. Then the canvas has to hold one size: its
     * box and its drawing buffer, which R3F writes in the same resize as the
     * camera's half-height. */
    const t = setTimeout(() => {
      const canvas = viewportApiRef.current?.canvas() ?? null
      if (fixedTimer || !canvas) {
        refit()
        return
      }
      last = sizeKey(canvas)
      ro = new ResizeObserver(() => {
        stable = 0
      })
      ro.observe(canvas)
      if (canvas.parentElement) ro.observe(canvas.parentElement)
      const tick = () => {
        const k = sizeKey(canvas)
        if (k !== last || !caughtUp(canvas)) {
          last = k
          stable = 0
        } else stable++
        if (stable >= REFIT_SETTLE_FRAMES || ++frames >= REFIT_MAX_FRAMES) {
          ro?.disconnect()
          ro = null
          refit()
          return
        }
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, 450)
    return () => {
      clearTimeout(t)
      cancelAnimationFrame(raf)
      ro?.disconnect()
    }
  }, [rawStrokes])

  const applySpin = (degPerSecond: number) => {
    viewportApiRef.current?.setSpin(degPerSecond)
    cameraSpinRef.current = degPerSecond
    setCameraSpin(degPerSecond)
  }

  /* FAMILY 14 — THE TAKE. One `edit`, so the whole preset is ONE undo step
   * rather than three; a user who clicks Slow Gel and presses cmd-Z expects the
   * take they had, not the two-thirds of it the last patch happened to write.
   *
   * A patch is COMPLETE by construction (see GEOMETRY_ANIMATION_PRESET_DEFS),
   * so this spreads onto the DEFAULTS, not onto the live take. Spreading onto
   * the live take would let a dial the preset does not name survive from
   * whatever was clicked before it, which is the leak `railDefaults` was
   * written to close one storey down. */
  const applyMotionPresetById = (id: string): boolean => {
    const patch = resolveMotionPreset(id, docRef.current.styleState)
    if (!patch) return false
    const preset = findPresetIn(docRef.current.styleState, id)
    const envelope = { ...REVEAL_ENVELOPE_DEFAULTS, ...patch.envelope }
    const drawIn = { ...DRAW_IN_DEFAULTS, ...patch.drawIn }
    const revealWindow = { ...REVEAL_WINDOW_DEFAULTS, ...patch.revealWindow }
    const rebased = rebaseForClock({ drawIn, revealWindow, revealEnvelope: envelope })
    edit(`Preset ${preset?.label ?? id}`, null, {
      drawIn,
      revealWindow,
      revealEnvelope: envelope,
      ...(rebased ? { take: rebased } : {}),
      styleState: { ...docRef.current.styleState, activePresetFamily: "geometryAnimation", activePresetId: id },
    })
    return true
  }

  const applyViewPresetById = (id: string): boolean => {
    const patch = resolveViewPreset(id)
    if (!patch) return false
    const preset = findPreset(id)
    /* WHAT THIS MEMBER IS STILL WAITING ON, NAMED IN CODE. A member with
     * entries left must not half-run, because a preset that framed a still and
     * wrote nothing would look like it worked. ONE implementation, shared with
     * the pill that renders the same verdict — a rail that offers a preset the
     * router then refuses is a worse bug than either half.
     *
     * This used to call `viewPresetGaps`, a scaffold wrapper that stripped one
     * stale entry out of `viewPresetBlockers` by matching its text. The stale
     * entry is gone from the table itself, so the wrapper is gone too and this
     * reads the source directly. */
    const gaps = viewPresetBlockers(id)
    if (gaps.length) {
      toast.error(`${preset?.label ?? id} is not buildable yet`, { description: gaps[0] })
      return false
    }
    const api = viewportApiRef.current
    if (!api) {
      toast.error("The 3D viewport is still loading", {
        description: "Give it a moment and pick the view again.",
      })
      return false
    }
    const framed = api.orbitView(patch.camera.azimuthDeg, patch.camera.elevationDeg, patch.camera.fill)
    if (!framed) {
      toast.error("Nothing to frame", { description: "Draw a stroke on the canvas first." })
      return false
    }
    applySpin(patch.camera.spinDegPerSecond ?? 0)

    /* `cleanPreview` — show what the file actually carries.
     *
     * A GLB carries geometry and material metadata; texture, dither and ASCII
     * are screen-space shaders and are export v3 (PRD §12). So a preview still
     * wearing them is a preview of something the file will not contain. It is
     * applied REVERSIBLY through the same undo slot as a geometry preset,
     * because switching a user's composition off is precisely the destructive
     * move this file's guard exists to prevent — the difference between this
     * and that defect is that this one is asked for by name and is one click
     * back. */
    labelled(preset?.label ?? id, () => {
      const s = docRef.current.styleState
      edit(preset?.label ?? id, null, {
        styleState: {
          ...s,
          ...(patch.export?.cleanPreview
            ? {
                textureEnabled: false,
                ditherEnabled: false,
                asciiEnabled: false,
                fusionPreset: "none" as StyleState["fusionPreset"],
              }
            : null),
          activePresetFamily: "view",
          activePresetId: id,
          lastAppliedPresetId: id,
        },
      })
    })

    /* The export half. `handleExportGLB` / `handleExportPNG` / `handleExportVideo`
     * raise their own success and failure toasts, so this path stays quiet and
     * lets them speak — two toasts for one click reads as a stutter.
     *
     * ⚠ THE VIDEO BRANCH IS THE ONE THIS FUNCTION WAS MISSING, and it is worth
     * saying what it is NOT. `lib/export/` has shipped a WebCodecs WebM writer
     * with an APNG fallback since 2026-08-01 and the viewport has exposed
     * `exportVideo` beside `exportGLB`/`exportPNG` the whole time; the preset was
     * blocked on this one `else if` and a blocker sentence that described a
     * missing writer instead. So the correct fix is a line that reaches the ONE
     * export that already exists — not a second recorder wired to a preset.
     *
     * Everything a multi-second file-writing action needs is therefore inherited
     * rather than rebuilt, and each of the four lives in exactly one place:
     *   · it says what it will do first — the pill's own tooltip is the preset's
     *     `description` (lib/style-system.ts), and `handleExportVideo` opens a
     *     toast naming the wait before the first frame renders;
     *   · it shows progress — that same toast counts frames to 100 %;
     *   · it cannot be started twice — the re-entrancy guard at the top of
     *     `handleExportVideo`, which is where BOTH callers pass through;
     *   · it reports where the file went, and reports failure — the same toast
     *     becomes "Saved <name>.webm · <summary>" or the error.
     * Returning `true` here means the ROUTE ran, exactly as it does for glb and
     * png, both of which are also dispatched without being awaited. Whether the
     * render then started is the export's own business and the export says so
     * out loud; the number that settles it in a harness is
     * `window.__fsVideoExportRuns`. */
    if (patch.export?.target === "glb") void api.exportGLB()
    else if (patch.export?.target === "png") void api.exportPNG()
    else if (patch.export?.target === "video") void api.exportVideo()
    else {
      toast(preset?.label ?? id, {
        description:
          patch.camera.spinDegPerSecond
            ? `Framed at ${patch.camera.azimuthDeg}° / ${patch.camera.elevationDeg}°, turning at ${patch.camera.spinDegPerSecond}°/s.`
            : `Framed at ${patch.camera.azimuthDeg}° / ${patch.camera.elevationDeg}°. Drag to take the camera back.`,
        action: { label: "Undo", onClick: () => revertLastPreset() },
      })
    }
    return true
  }

  // Select a preset by id within the active family. Records the active/last-
  // applied preset and applies the preset's safe `applies` patch. The patch
  // only ever touches INERT style fields (material/texture/dither/ascii state
  // flags) — never geometry, animation, or export — so it is safe to apply for
  // both implemented (material) and not-yet-implemented presets. `implemented`
  // still governs whether a real renderer exists; unimplemented presets only
  // record their sibling state + are clearly labeled "renderer later".
  // The merge rule lives in lib/style-system.ts (`applyPresetToStyleState`) so
  // the UI and the verification harness cannot drift. It is NOT a shallow
  // spread: a composition preset resets the composition rails first, otherwise
  // every preset inherits whatever the last one left behind — see the doc there
  // for the two leaks that produced.
  const handleSelectPreset = (family: PresetFamily, id: string) => {
    if (family === "geometry") {
      applyGeometryPresetById(id)
      return
    }
    if (family === "view") {
      applyViewPresetById(id)
      return
    }
    if (family === "geometryAnimation") {
      applyMotionPresetById(id)
      return
    }
    /* THE THIRTEEN FAMILIES THAT HAD NO UNDO AT ALL.
     *
     * `applyPresetToStyleState` resets every composition rail before it merges
     * a composition preset's patch — which is correct (otherwise each preset
     * inherits whatever the last one left behind) and is precisely why these
     * are the DESTRUCTIVE families. Clicking "Terminal Stack" throws away the
     * texture, dither, ASCII, stack and fusion the user had composed.
     *
     * They are named after the preset, in one step, and ⌘Z takes them back. */
    const preset = findPresetIn(docRef.current.styleState, id)
    labelled(preset?.label ?? id, () => {
      setStyleStateRecorded((s) => applyPresetToStyleState(s, family, id))
    })
    /* A FUSION WAKES THE VIEW TOO, and this is the whole of Sebs's *"turntable
     * dont animate"*. `applyPresetToStyleState` already runs `fusionWakePatch`
     * so a relationship lands with its LAYERS on; the one system that wake
     * cannot reach is the camera, because the camera is not style state. Turn
     * Table reads `orbit`, which rests at exactly 0 head-on, so it shipped
     * unable to act in the state it is selected in. Additive: it starts the
     * turntable when a relationship needs it and never stops one you set. */
    if (family === "fusion") {
      const links = BUILTIN_LINK_FUSIONS[preset?.applies?.fusionPreset ?? id]
      if (links && fusionUsesView(links)) applySpin(FUSION_VIEW_SPIN_DEG)
    }
  }

  /* ── SELECTING A COMBINATION CELL ────────────────────────────────────────
   *
   * The 120 cells are not entries in `FUSION_PRESET_DEFS` (that file belongs to
   * another lane), so they cannot route through `applyPresetToStyleState` — its
   * `findPreset` would return undefined and its inertness guard would correctly
   * refuse to apply anything. This reproduces the SAME rule instead of a looser
   * one: reset every composition rail, apply the cell's own composition, then
   * let the derived wake add anything the links still need. Recorded as ONE undo
   * step, named after the cell, exactly like every other composition preset —
   * a cell resets your texture, dither, ASCII, stack and fusion, so it has to be
   * one press of Cmd-Z to get back. */
  const handleSelectCombo = (c: FusionCombo) => {
    labelled(c.name, () => {
      setStyleStateRecorded((s) => {
        const merged = { ...s, ...comboStylePatch(c, DEFAULT_STYLE_STATE) }
        const wake = fusionWakePatch(c, merged, resolveFusionDrive(merged))
        return { ...merged, ...wake.patch }
      })
    })
    if (fusionUsesView(c)) applySpin(FUSION_VIEW_SPIN_DEG)
  }

  // DEV-ONLY capture harness. Exposes a small imperative API on window so an
  // automated screenshot/video script can drive the full material × animation ×
  // intensity × mode matrix deterministically (instead of fragile DOM clicks).
  // Guarded to non-production; it only sets the same React state the UI sets, so
  // it can never reach geometry, the reveal clock, or export.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    const w = window as unknown as Record<string, unknown>
    w.__styleHarness = {
      setMode: (mode: GeometryMode) => handleModeChange(mode),
      setMaterial: (preset: string) =>
        setStyleStateRecorded((s) => ({
          ...s,
          materialPreset: preset as StyleState["materialPreset"],
          materialUserOverride: true,
        })),
      setAnimation: (
        type: string,
        opts?: { intensity?: number; speed?: number },
      ) =>
        setStyleStateRecorded((s) => ({
          ...s,
          materialAnimationType: type as StyleState["materialAnimationType"],
          materialAnimationEnabled: type !== "none",
          materialAnimationIntensity:
            opts?.intensity ?? s.materialAnimationIntensity,
          materialAnimationSpeed: opts?.speed ?? s.materialAnimationSpeed,
        })),
      setCustom: (patch: Record<string, unknown>) =>
        setStyleStateRecorded((s) => ({ ...s, customMaterial: { ...s.customMaterial, ...patch } })),
      // DEV capture: drive any style state field directly (texture/dither/ascii
      // params, motion mode, …) so verification captures can sweep the matrix
      // without DOM clicks. Same state path the UI uses.
      setStyle: (patch: Partial<StyleState>) => setStyleStateRecorded((s) => ({ ...s, ...patch })),

      /* DEV capture: the UNDO STACK, so an assertion can read what a gesture
       * actually recorded rather than inferring it from pixels. `labels` is the
       * one that matters — it is how "a forty-sample slider drag is ONE step"
       * gets settled, and it is unfakeable: a drag that recorded forty entries
       * returns forty strings. */
      undo: () => doUndo(),
      redo: () => doRedo(),
      undoLabels: () => undo.labels(),
      undoInfo: () => undo.getState(),
      /* So an assertion can prove the pointer bracket was actually OPEN during
       * the drag it is measuring, rather than inferring it from the count. */
      gestureOpen: () => undo.gestureOpen(),
      /* DEV capture: drive the destructive path the way the button does, trash
       * slot and all. */
      clearCanvas: () => handleClearCanvas(),
      // DEV capture: exercise the real preset-selection path (same function the
      // preset rail calls) so verification asserts what users actually get.
      selectPreset: (family: PresetFamily, id: string) => handleSelectPreset(family, id),
      /* DEV capture: the combination rail, through the SAME function the picker
       * calls — so a gate measures what a press produces, composition patch,
       * derived wake and turntable included. Returns false for an unknown key
       * rather than silently doing nothing: a probe has to be able to tell "the
       * route refused" from "the route ran and the pixels did not move". */
      selectFusionCombo: (key: string) => {
        const c = FUSION_COMBOS_BY_KEY[key]
        if (!c) return false
        handleSelectCombo(c)
        return true
      },
      fusionComboKeys: () => Object.keys(FUSION_COMBOS_BY_KEY),
      /* DEV capture: what the fusion rail is ACTUALLY on. There was no getter,
       * so a gate driving the real DOM could see a button light up and had no
       * way to check the state behind it — which is how a state-injection test
       * passes while the interface is unreachable. Reading the selection is what
       * lets `assert-fusion-combo-ui.mjs` require 120 DISTINCT values from 120
       * clicks instead of counting DOM nodes. */
      stylePreset: () => styleState.fusionPreset,
      cameraSpin: () => cameraSpinRef.current,
      setSpin: (deg: number) => applySpin(deg),
      /* DEV capture: the two families that route through THIS file rather than
       * through `applyPresetToStyleState`, plus the undo. Returned as booleans
       * — an assertion has to be able to tell "the routing refused" from "the
       * routing ran and the pixels did not move", and a void call cannot. */
      selectGeometryPreset: (id: string) => applyGeometryPresetById(id),
      selectViewPreset: (id: string) => applyViewPresetById(id),
      selectMotionPreset: (id: string) => applyMotionPresetById(id),
      revertPreset: () => revertLastPreset(),
      /* DEV capture: the geometry control surface as one object, in exactly the
       * shape `applyGeometryPreset` consumes — so an assertion can compare what
       * the app is ACTUALLY standing in against what the pure resolver said it
       * should be, rather than re-deriving it from five separate getters. */
      geometrySettings: () => currentGeometrySettings(),
      // DEV capture: inject a set of strokes deterministically (instead of
      // synthetic pointer events). Each entry is an array of {x,y} in canvas
      // pixel space; timestamps are baked sequentially so the draw-in reveal
      // replays them in order. Used by the automated video script.
      injectStrokes: (
        polylines: { x: number; y: number }[][],
        opts?: { msPerPoint?: number; gapMs?: number },
      ) => {
        const msPerPoint = opts?.msPerPoint ?? 16
        const gapMs = opts?.gapMs ?? 120
        let t = 0
        const raws: Stroke[] = []
        for (const poly of polylines) {
          if (poly.length < 2) continue
          const points: Point[] = poly.map((p) => {
            const pt: Point = { x: p.x, y: p.y, t, pressure: 0.6 }
            t += msPerPoint
            return pt
          })
          t += gapMs
          raws.push({ points })
        }
        const processed = raws.map((r) =>
          processStroke(r, settingsRef.current.spacing, settingsRef.current.smoothing, settingsRef.current.preserveCorners),
        )
        edit("Inject strokes", null, { rawStrokes: raws, processedStrokes: processed })
      },
      clearStrokes: () => {
        edit("Clear canvas", null, { rawStrokes: [], processedStrokes: [] })
      },
      // DEV capture: drive the Inflate fusion dials (same state the config
      // strip sets) so the verification scripts exercise the real control
      // path instead of a parallel one.
      setInflate: (patch: Partial<InflateParams>) =>
        edit("Inflate dials", null, { inflateParams: { ...docRef.current.inflateParams, ...patch } }),
      setSolidParams: (patch: Partial<SolidParams>) =>
        edit("Solid dials", null, { solidParams: { ...docRef.current.solidParams, ...patch } }),
      // DEV capture: drive the Extrude dials. Added so a rim script can
      // CALIBRATE the crease census against a known-bad rim (`bevelEnabled:
      // false` is a hard 90 degree die-cut edge by construction) instead of
      // trusting a metric that has never been shown to fail — and so the
      // `sideWall` draft dial is reachable from a capture without DOM clicks.
      setExtrude: (patch: Partial<ExtrudeParams>) =>
        edit("Extrude dials", null, { extrudeParams: { ...docRef.current.extrudeParams, ...patch } }),
      // DEV capture: flip the geometry ENGINE (Free Stroke's vs the ported
      // Desk Doodles one) without a DOM click, so an A/B capture can hold
      // everything else fixed and change only this.
      setEngine: (family: string) => {
        if (isEngineFamily(family)) edit("Geometry engine", null, { engineFamily: family })
      },
      /* DEV LAW: force a scene-side throw so `ViewportErrorBoundary` can be
       * driven, screenshot and gated. It had no trigger anywhere in the repo —
       * see the `crashViewport` block above for why the law lives in this file
       * and is delivered through the `processedStrokes` prop. Returns the flag
       * so an assertion can tell "the law was refused" from "the law ran and
       * the boundary did not appear". */
      crashViewport: (on = true) => {
        setCrashViewport(!!on)
        return !!on
      },
      /* DEV LAW: drive the storage-quota path the way a full disk does. The
       * write itself is `lib/storage.ts`'s (another lane's file, untouched) —
       * this only fills the origin until the real write throws, so the toast
       * under test is raised by the real `catch`, not by a mock. */
      fillStorage: () => {
        /* COARSE, THEN FINE. A 512 KB-only fill stops with up to 512 KB of
         * headroom left, which is plenty for the next real write to succeed —
         * so the quota branch never fires and the gate measuring it reads a
         * false green. Topping off with 32 KB and then 2 KB chunks leaves the
         * origin genuinely refusing. */
        let n = 0
        for (const kb of [512, 32, 2]) {
          const chunk = "x".repeat(kb * 1024)
          for (let i = 0; i < 4096; i++) {
            try {
              window.localStorage.setItem(`__fsBallast${n}`, chunk)
              n++
            } catch {
              break
            }
          }
        }
        return n
      },
      dropBallast: () => {
        for (const k of Object.keys(window.localStorage)) if (k.startsWith("__fsBallast")) window.localStorage.removeItem(k)
      },
      get: () => ({ geometryMode, engineFamily, styleState, inflateParams, solidParams, extrudeParams }),
    }
    return () => {
      delete w.__styleHarness
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometryMode, engineFamily, styleState, inflateParams, solidParams, extrudeParams])

  /* DEV-ONLY, beside `__styleHarness` and guarded the same way. `__fsSetKeys`
   * is the same `setKeys` the lanes call: it returns the refusal reasons, empty
   * when it committed. `__fsKeys` reads `docRef`, not a closed-over render
   * value, so a gate that sets keys and reads them back in one tick sees the
   * new ones. */
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    const w = window as unknown as Record<string, unknown>
    w.__fsSetKeys = (next: TakeKeys | undefined, gestureKey?: string | null) => setKeys(next, gestureKey ?? null)
    w.__fsKeys = () => docRef.current.keys
    return () => {
      delete w.__fsSetKeys
      delete w.__fsKeys
    }
  }, [setKeys])

  /* THE STATUS LINE, KEPT (L4). The style bar's pills said what each family
   * is set to ("Material Ink", "Layers 3 layers"); the bar went, the reading
   * did not: the Style panel's family list shows the same value under each
   * name. Built exactly as the pills were. */
  const styleSummary: Partial<Record<StylePanelId, string>> = (() => {
      const activePreset = findPresetIn(styleState, styleState.activePresetId)
      const presetEdited = presetEditedFields(styleState, activePreset).length > 0
      const summary: { id: StylePanelId; label: string; value: string; live: boolean }[] = [
        {
          id: "material",
          label: "Material",
          value: MATERIAL_PRESETS.find((p) => p.id === styleState.materialPreset)?.label ?? "Unknown",
          live: true,
        },
        {
          id: "texture",
          label: "Texture",
          value:
            styleState.textureEnabled && styleState.textureMode !== "none"
              ? `${TEXTURE_MODES.find((t) => t.id === styleState.textureMode)?.label ?? "On"}${
                  styleState.textureAnimated ? " · animated" : ""
                }`
              : "None",
          live: true,
        },
        {
          id: "dither",
          label: "Dither",
          value: styleState.ditherEnabled
            ? `${DITHER_PRESETS.find((d) => d.id === styleState.ditherType)?.label ?? "On"}${
                styleState.ditherAnimated ? " · animated" : ""
              }`
            : "Off",
          live: true,
        },
        {
          id: "ascii",
          label: "ASCII",
          value: styleState.asciiEnabled
            ? `${ASCII_PRESETS.find((a) => a.id === styleState.asciiCharset)?.label ?? "On"}${
                styleState.asciiAnimated ? " · animated" : ""
              }`
            : "Off",
          live: true,
        },
        {
          id: "animation",
          label: "Animation",
          value:
            styleState.materialAnimationEnabled && styleState.materialAnimationType !== "none"
              ? MATERIAL_ANIMATION_TYPES.find((a) => a.id === styleState.materialAnimationType)
                  ?.label ?? "Material"
              : styleState.motionMode === "off"
                ? "Static"
                : styleState.motionMode === "independent"
                  ? "Independent"
                  : "Sync to Draw",
          live: true,
        },
        // LAYERS BELONGS IN THE STRIP TOO, and it was the last one missing.
        //
        // The strip is the app's status line and its ONLY navigation into the
        // panels: a chip opens its panel, and there is no other way in. The
        // Layers panel was live, wired and reachable ONLY by opening some
        // OTHER panel first and then finding it in the panel's own tab row.
        // So the layer stack (group opacity, per-layer opacity, blend mode,
        // order) and the WHOLE of stack animation, eight behaviours plus
        // speed, direction and phase, sat behind a door with no handle on the
        // one screen that lists what is on. The PRD gives layering and stack
        // animation two families of their own (§6 Families 10 and 11); a
        // headline system with no entry in the status line reads as a system
        // that is not there.
        //
        // It says what is ON, in the strip's own grammar. Which layers are
        // participating is the composition question ("3 layers"), and the
        // group behaviour is the second half ("· Drift"), because a stack
        // that is animating and a stack that is sitting still are two
        // different states and the strip is where you learn which you are in.
        {
          id: "layers",
          label: "Layers",
          value: (() => {
            if (!styleState.layerStackEnabled) return "Off"
            const live = [
              styleState.textureEnabled && styleState.textureMode !== "none",
              styleState.ditherEnabled,
              styleState.asciiEnabled,
            ].filter(Boolean).length
            const stacked = live === 0 ? "Empty" : `${live} layer${live === 1 ? "" : "s"}`
            const anim =
              styleState.stackAnimationEnabled && styleState.stackAnimationType !== "none"
                ? ` · ${STACK_ANIMATION_LABELS[styleState.stackAnimationType] ?? "animated"}`
                : ""
            return stacked + anim
          })(),
          live: true,
        },
        // FUSION BELONGS IN THE STRIP, and it did not have a chip.
        //
        // The strip is the app's status line, the one place that says what
        // is currently on. Fusion is the loudest system in the product and
        // the only one a user can now AUTHOR, and it was the only live system
        // with no chip: you could make a fusion, name it, and then have no
        // way to see from the main screen that it was running or what it was
        // called. A named thing the user made has to be visible by name.
        {
          id: "fusion",
          label: "Fusion",
          value:
            styleState.fusionPreset === "none"
              ? "None"
              : (styleState.customFusions.find(
                  (f) => customFusionKey(f.id) === styleState.fusionPreset,
                )?.name ||
                FUSION_PRESETS.find((p) => p.id === styleState.fusionPreset)?.label ||
                /* A COMBINATION CELL IS A NAMED THING TOO. Without this the
                   status line read "On" for 120 of its options, the same
                   silence the chip was added to end for user fusions. */
                FUSION_COMBOS_BY_KEY[styleState.fusionPreset.replace(/^combo:/, "")]?.name ||
                "On"),
          live: true,
        },
        {
          id: "presets",
          label: "Preset",
          value: activePreset ? `${activePreset.label}${presetEdited ? ", edited" : ""}` : "None",
          live: true,
        },
      ]
    return Object.fromEntries(summary.map((i) => [i.id, i.value]))
  })()

  return (
    <StrokeTakeProvider take={take} commit={commitTake} keys={keys} setKeys={setKeys} mode={geometryMode} penMs={takePenMs} strokeCount={viewportStrokes.length}>
    {/* L2: play, the clock, the pace and the dock's flags, one store for the
        page. The viewport reads it today; L3's dock panels read the same one. */}
    <TakeTransportProvider>
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      {/* THE HEADER WAS THE ONE THING STILL FORCING THE PAGE SIDEWAYS.
          Measured at 390px after the columns were stacked
          (scripts/verify/_probe-lane28-overflow.mjs): the document's
          scrollWidth was 526 and the header's own right edge was 526 — the
          same number, so the header was the whole of it. Its four groups (the
          title, the four mode pills, the engine selector, the Hero-beat link)
          never wrap and it had no scroller, so they pushed the BODY wide and
          the entire page scrolled horizontally.

          `overflow-x-auto` + `shrink-0` on the groups is not a new idea here —
          it is exactly what the style summary strip one row below already
          does, and why that strip needs 905px at this width and costs the body
          nothing. Same pattern, same row of the shell. */}
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 overflow-x-auto border-b border-border px-4">
        <h1 className="shrink-0 text-sm font-semibold tracking-tight text-foreground">
          Free Stroke
        </h1>

        {/* Geometry mode selector.
            `role="radiogroup"` + `aria-checked`: these four buttons are a
            single-choice control, and without it a screen reader hears four
            identical unlabelled buttons with no way to tell which mode is
            active — on the most important control in the app. The pattern was
            already in this file (Bevel, side wall and Inflate fusion all set
            `aria-pressed`); the top-level selectors had simply been missed. */}
        <div
          role="radiogroup"
          aria-label="Geometry mode"
          className="flex shrink-0 items-center rounded-lg border border-border bg-muted/50 p-0.5"
        >
          {GEOMETRY_MODES.map((mode) => (
            <button
              key={mode.value}
              role="radio"
              aria-checked={geometryMode === mode.value}
              onClick={() => !mode.disabled && handleModeChange(mode.value)}
              disabled={mode.disabled}
              title={mode.tooltip}
              className={`fs-press relative select-none rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                geometryMode === mode.value
                  ? "bg-background text-foreground shadow-sm"
                  : mode.disabled
                    ? "cursor-not-allowed text-muted-foreground/40"
                    : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode.label}
              {mode.disabled && (
                <span className="ml-1 text-[9px] font-normal opacity-60">
                  soon
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Engine family selector — WHOSE geometry builds the form. This is a
            comparison control, not a style: the two engines disagree about
            joints, taper, contour smoothing and how a closed loop is filled,
            and the only way to settle which reads better per mode is to flip
            between them with everything else held still. */}
        <div className="flex shrink-0 items-center gap-2">
          <span className="select-none font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
            engine
          </span>
          <div
            role="radiogroup"
            aria-label="Geometry engine"
            className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5"
            data-engine-family={engineFamily}
          >
            {ENGINE_FAMILIES.map((fam) => (
              <button
                key={fam.value}
                role="radio"
                aria-checked={engineFamily === fam.value}
                data-engine-option={fam.value}
                onClick={() => edit("Geometry engine", null, { engineFamily: fam.value })}
                title={fam.tooltip}
                className={`fs-press relative select-none rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  engineFamily === fam.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {fam.label}
              </button>
            ))}
          </div>
        </div>

        {/* The hero-beat tuner lives on its own route: it drives the same 3D
            scene through the 2D-ink → 3D-object choreography with every beat,
            angle and curve on a dial, and can wear either visual register. */}
        <a
          href="/desk-doodles"
          title="Tune the 2D → 3D hero beat"
          className="fs-press shrink-0 select-none rounded-full border border-border px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Hero beat →
        </a>
      </header>

      {/* Extrude mode controls */}
      {geometryMode === "extrude" && (
        <div className="flex h-10 shrink-0 items-center gap-4 border-b border-border bg-muted/30 px-4">
          {/* Width — slider is a NORMALIZED t in [0, 1] mapped through a
              quadratic curve to the effective half-width. Mid-slider lands
              on the clean default; only the last ~25% of slider travel
              reaches widths that are known to be chunky/breaking. */}
          <label className="flex items-center gap-2 text-xs text-muted-foreground" title="How wide the ribbon is">
            <span className="select-none font-medium">Width</span>
            <input
              type="range"
              min={EXTRUDE_WIDTH_SLIDER_MIN}
              max={EXTRUDE_WIDTH_SLIDER_MAX}
              step={EXTRUDE_WIDTH_SLIDER_STEP}
              value={widthSlider}
              onChange={(e) => {
                const t = Number(e.target.value)
                edit("Extrude width", "geom:extrudeWidth", {
                  widthSlider: t,
                  extrudeParams: { ...docRef.current.extrudeParams, width: mapExtrudeWidthSlider(t) },
                })
              }}
              className="fs-slider w-24"
            />
            <span className="w-9 select-none text-[11px] tabular-nums">
              {Math.round(widthSlider * 100)}%
            </span>
          </label>

          <div className="h-4 w-px shrink-0 bg-border" />

          {/* Depth — slider value is a width-relative MULTIPLIER (effective
              depth = multiplier × width, clamped). See computeEffectiveExtrudeDepth. */}
          <label className="flex items-center gap-2 text-xs text-muted-foreground" title="Ribbon depth, relative to its width">
            <span className="select-none font-medium">Depth</span>
            <input
              type="range"
              min={EXTRUDE_DEPTH_MULTIPLIER_MIN}
              max={EXTRUDE_DEPTH_MULTIPLIER_MAX}
              step={EXTRUDE_DEPTH_MULTIPLIER_STEP}
              value={extrudeParams.depth}
              onChange={(e) => edit("Extrude depth", "geom:extrudeDepth", { extrudeParams: { ...docRef.current.extrudeParams, depth: Number(e.target.value) } })}
              className="fs-slider w-24"
            />
            <span className="w-10 select-none text-[11px] tabular-nums">
              {extrudeParams.depth.toFixed(2)}×
            </span>
          </label>

          <div className="h-4 w-px shrink-0 bg-border" />

          {/* Bevel toggle */}
          <button
            type="button"
            onClick={() => edit("Bevel", null, { extrudeParams: { ...docRef.current.extrudeParams, bevelEnabled: !docRef.current.extrudeParams.bevelEnabled } })}
            aria-pressed={extrudeParams.bevelEnabled}
            title="Soften the ribbon's edges"
            className={`fs-press select-none rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
              extrudeParams.bevelEnabled
                ? "border-foreground/20 bg-foreground text-background"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            Bevel
          </button>

          {/* Side wall — straight vs drafted (the ported moulded read).
              A DIAL, not a preset pill: it is a property of the same ribbon,
              like Bevel beside it. `applyDraftTaperAbout` needs the centre of
              the whole mark, which viewport-3d computes from the FULL strokes
              and threads in as `draftCentre` — see its comment for why a
              per-stroke centre would make a word read as five mouldings. */}
          <div className="flex items-center gap-1" title="Straight walls, or tapered toward the back face (pressed / moulded)">
            {(["straight", "drafted"] as const).map((sw) => (
              <button
                key={sw}
                type="button"
                onClick={() => edit("Side wall", null, { extrudeParams: { ...docRef.current.extrudeParams, sideWall: sw } })}
                aria-pressed={extrudeParams.sideWall === sw}
                className={`fs-press select-none rounded-full border px-3 py-1 text-[11px] font-medium capitalize transition-colors ${
                  extrudeParams.sideWall === sw
                    ? "border-foreground/20 bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {sw}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Solid mode controls */}
      {geometryMode === "solid" && (
        <div className="flex h-10 shrink-0 items-center gap-4 border-b border-border bg-muted/30 px-4">
          {/* Thickness — slider value is RAW px. The SolidEngine applies a
              nonlinear calibration (see computeSolidEffectiveThicknessPx)
              before feeding the value to canvas lineWidth + H3 walls, so
              the breaking territory lives in the upper end of the slider
              instead of the middle. */}
          <label className="flex items-center gap-2 text-xs text-muted-foreground" title="Line thickness of the drawn silhouette">
            <span className="select-none font-medium">Thickness</span>
            <input
              type="range"
              min={SOLID_THICKNESS_SLIDER_MIN}
              max={SOLID_THICKNESS_SLIDER_MAX}
              step={SOLID_THICKNESS_SLIDER_STEP}
              value={solidParams.thickness}
              onChange={(e) => edit("Thickness", "geom:solidThickness", { solidParams: { ...docRef.current.solidParams, thickness: Number(e.target.value) } })}
              className="fs-slider w-24"
            />
            <span className="w-10 select-none text-[11px] tabular-nums">
              {solidParams.thickness} px
            </span>
          </label>

          <div className="h-4 w-px shrink-0 bg-border" />

          {/* Depth — slider value is RAW world depth. Calibrated through
              computeSolidEffectiveDepth before being used as the H3 Z extent.
              The readout shows slider position as a %, not the raw world unit. */}
          <label className="flex items-center gap-2 text-xs text-muted-foreground" title="How far the slab extends into depth">
            <span className="select-none font-medium">Depth</span>
            <input
              type="range"
              min={SOLID_DEPTH_SLIDER_MIN}
              max={SOLID_DEPTH_SLIDER_MAX}
              step={SOLID_DEPTH_SLIDER_STEP}
              value={solidParams.depth}
              onChange={(e) => edit("Depth", "geom:solidDepth", { solidParams: { ...docRef.current.solidParams, depth: Number(e.target.value) } })}
              className="fs-slider w-24"
            />
            <span className="w-9 select-none text-[11px] tabular-nums">
              {Math.round(
                ((solidParams.depth - SOLID_DEPTH_SLIDER_MIN) /
                  (SOLID_DEPTH_SLIDER_MAX - SOLID_DEPTH_SLIDER_MIN)) *
                  100,
              )}
              %
            </span>
          </label>
        </div>
      )}

      {/* Inflate mode controls — soft inflated stroke (stroke-volume tube loft).
          Reuses the Solid Thickness + Depth state intentionally: Thickness sets
          the stroke's XY radius, and Depth ("Puff") sets cross-section fullness.
          Preview, animation, and GLB export all share one geometry path. */}
      {geometryMode === "inflate" && (
        <div className="flex h-10 shrink-0 items-center gap-4 border-b border-border bg-muted/30 px-4">
          <label className="flex items-center gap-2 text-xs text-muted-foreground" title="How thick the inflated stroke is">
            <span className="select-none font-medium">Thickness</span>
            <input
              type="range"
              min={SOLID_THICKNESS_SLIDER_MIN}
              max={SOLID_THICKNESS_SLIDER_MAX}
              step={SOLID_THICKNESS_SLIDER_STEP}
              value={solidParams.thickness}
              onChange={(e) => edit("Thickness", "geom:solidThickness", { solidParams: { ...docRef.current.solidParams, thickness: Number(e.target.value) } })}
              className="fs-slider w-24"
            />
            <span className="w-10 select-none text-[11px] tabular-nums">
              {solidParams.thickness} px
            </span>
          </label>

          <div className="h-4 w-px shrink-0 bg-border" />

          <label className="flex items-center gap-2 text-xs text-muted-foreground" title="How full the inflated cross-section is">
            <span className="select-none font-medium">Puff</span>
            <input
              type="range"
              min={SOLID_DEPTH_SLIDER_MIN}
              max={SOLID_DEPTH_SLIDER_MAX}
              step={SOLID_DEPTH_SLIDER_STEP}
              value={solidParams.depth}
              onChange={(e) => edit("Depth", "geom:solidDepth", { solidParams: { ...docRef.current.solidParams, depth: Number(e.target.value) } })}
              className="fs-slider w-24"
            />
            <span className="w-9 select-none text-[11px] tabular-nums">
              {Math.round(
                ((solidParams.depth - SOLID_DEPTH_SLIDER_MIN) /
                  (SOLID_DEPTH_SLIDER_MAX - SOLID_DEPTH_SLIDER_MIN)) *
                  100,
              )}
              %
            </span>
          </label>

          <div className="h-4 w-px shrink-0 bg-border" />

          {/* Fusion — surface strategy. "Loft" is one tube per stroke (fast,
              but crossings interpenetrate). "Implicit" is a signed-distance
              field polygonised with marching cubes: the whole drawing becomes
              one watertight surface and crossings genuinely merge with a
              fillet. "Auto" is the default and picks between them on the
              EMBEDDING TEST — a swept tube is a real surface only while the
              mark does not turn inside its own radius, and where it does the
              loft folds through itself no matter how finely it is sampled.
              See the fusion block comment in lib/geometry-engines.ts. */}
          <label
            className="flex items-center gap-2 text-xs text-muted-foreground"
            title="Auto: loft while the swept tube is a valid surface, field where it would fold through itself. Loft: one tube per stroke (fast, crossings overlap). Implicit: one merged surface (crossings fuse with a fillet)."
          >
            <span className="select-none font-medium">Fusion</span>
            <div className="flex items-center rounded-md border border-border bg-background p-0.5">
              {(["auto", "loft", "implicit"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => edit("Inflate fusion", null, { inflateParams: { ...docRef.current.inflateParams, fusion: f } })}
                  aria-pressed={inflateParams.fusion === f}
                  className={`fs-press select-none rounded px-2 py-0.5 text-[11px] font-medium capitalize transition-colors ${
                    inflateParams.fusion === f
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </label>

          {/* Blend — the smooth-minimum radius k, as a fraction of the stroke
              radius. 0 = hard union (fused but creased at the junction).
              Implicit-only; shown disabled on the loft so the dial does not
              disappear and reappear. */}
          <label
            className={`flex items-center gap-2 text-xs transition-opacity ${
              inflateParams.fusion !== "loft"
                ? "text-muted-foreground"
                : "pointer-events-none text-muted-foreground/40 opacity-50"
            }`}
            title="Fillet radius where SEPARATE RUNS merge: a different stroke, or the same stroke doubling back far from itself. A drawn corner is one run and hard-mins, so this dial cannot soften one (measured: b=0 and b=1 agree to 4dp at three of the square's four corners). Field path only; under Auto it applies to drawings the field actually builds."
          >
            <span className="select-none font-medium">Blend</span>
            <input
              type="range"
              min={INFLATE_BLEND_MIN}
              max={INFLATE_BLEND_MAX}
              step={INFLATE_BLEND_STEP}
              value={inflateParams.blend}
              disabled={inflateParams.fusion === "loft"}
              onChange={(e) =>
                edit("Inflate blend", "geom:inflateBlend", { inflateParams: { ...docRef.current.inflateParams, blend: Number(e.target.value) } })
              }
              className="fs-slider w-20"
            />
            <span className="w-9 select-none text-[11px] tabular-nums">
              {inflateParams.blend.toFixed(2)}×
            </span>
          </label>

          {/* Resolution — marching-cubes cells per stroke radius. */}
          <label
            className={`flex items-center gap-2 text-xs transition-opacity ${
              inflateParams.fusion !== "loft"
                ? "text-muted-foreground"
                : "pointer-events-none text-muted-foreground/40 opacity-50"
            }`}
            title="Marching-cubes cells per stroke radius. Higher is smoother and slower. Field path only; under Auto it applies to drawings the field actually builds."
          >
            <span className="select-none font-medium">Res</span>
            <input
              type="range"
              min={INFLATE_RESOLUTION_MIN}
              max={INFLATE_RESOLUTION_MAX}
              step={INFLATE_RESOLUTION_STEP}
              value={inflateParams.resolution}
              disabled={inflateParams.fusion === "loft"}
              onChange={(e) =>
                edit("Inflate resolution", "geom:inflateResolution", { inflateParams: { ...docRef.current.inflateParams, resolution: Number(e.target.value) } })
              }
              className="fs-slider w-20"
            />
            <span className="w-8 select-none text-[11px] tabular-nums">
              {inflateParams.resolution.toFixed(1)}
            </span>
          </label>
        </div>
      )}

      {/* THE STYLE BAR AND "SHOW PANEL" WENT IN L4 (BUILD-PLAN.md §2, §5 row L4).
          The eight summary pills opened the drawer below them; the drawer is
          the Style panel in the dock shell now, its family list does the
          pills' job, and the rail shows and hides it (components/dock-shell.tsx,
          components/workspace/rail.tsx). */}

      {/* ==================================================================
          THE TWO COLUMNS, AND THE ONE THING ABOUT THEM THAT WAS A DEFECT.

          MEASURED (scripts/verify/_probe-lane28-mobile.mjs), five widths, the
          Fusion panel open:

            width  docW  scrollW  H-OVERFLOW  canvasW  3D-W  <44px targets
            1500   1500  1500     no          750      750   63/63
            1280   1280  1280     no          640      640   63/63
             834    834   834     no          417      417   62/63
             390    390   526     YES         195      300   61/63
             360    360   526     YES         180      300   61/63

          Two hard `flex-1` columns split whatever they are given, and the 3D
          column stops shrinking at 300px — so below about 500px the pair no
          longer fits and THE PAGE BODY SCROLLS SIDEWAYS. That is a defect at
          any width, not a missing feature: horizontal body scroll is never the
          intended state, and it left the drawing surface — the thing this
          product IS — at 195px on a 390px phone.

          THE COLUMNS STACK BELOW `lg` AND THAT IS ALL THIS CHANGE DOES.
          `flex-col lg:flex-row` removes the overflow and gives the canvas the
          full width; the border follows the axis. No new component, no new
          state, no breakpoint-conditional behaviour.

          ⚠ THIS IS NOT "MOBILE SUPPORT", AND CALLING IT THAT WOULD BE THE
          HALF-ADD THIS PROJECT KEEPS BANNING. What is still NOT done, measured
          rather than guessed:
            · 61 of the 63 interactive targets are under the 44px touch
              minimum — at EVERY width, desktop included. That is the control
              ramp itself (11px pills, a 4px slider track with a 14px thumb),
              so raising it re-densities every desktop surface in the product.
              That is a design call, not a lane's.
            · The panel body is a fixed `max-h-[22rem]` scroller and is already
              clipped at 834px. On a phone it wants to be a sheet, which is
              PRD Layer H / Phase 26 ("iOS-style control panel v1") and is
              explicitly sequenced AFTER the visual systems (PRD §15: "build
              strictly in order").
            · The header's four control groups do not wrap.
          Cost of the real build, with those three as the scope: a layout mode
          plus a touch-size ramp plus a sheet — and the ramp has to be decided
          before either of the other two can be drawn.

          🔴 AND THE SECOND DEFECT IN THESE TWO COLUMNS: THEY RATCHETED WIDER
          AND NEVER CAME BACK. That is what `min-w-0` is for, and it is not a
          tidy-up.

          `flex-1` is `flex: 1 1 0%`, which leaves `min-width: auto`, so each
          column's floor is its own content's min-content width. The content is
          a `<canvas>`, and three.js writes an explicit CSS width onto it every
          time it sizes the buffer (`WebGLRenderer.setSize(w, h, updateStyle =
          true)` sets `canvas.style.width`). So the column's floor IS the
          canvas's current width, and the canvas's width is measured FROM the
          column. One-way ratchet: up only.

          Measured 2026-08-28, headless Chrome, no dev server involved:

            window 1500   columns 751/750   canvas 1499x1816
            window 1900   columns 951/950   canvas 1899x1816
            window 1500   columns 951/950   canvas 1899x1816   ← stuck
            window 1200   columns 951/950   canvas 1899x1816   ← stuck
            window 1024   columns 951/950   canvas 1899x1816   ← stuck

          Widen the window once and the layout never returns. `overflow-hidden`
          on this row hides it, so nothing looks broken: the right 900px of the
          app, the 3D viewport's whole right half and its export bar with it, is
          simply clipped off screen until the page is reloaded.

          At rest the margin was HALF A PIXEL. The column sits at 750 and the
          canvas's own CSS width is 749.5px, which is that column's `min-width:
          auto`. Any single frame that measured wider latched permanently. That
          is how a capture run came back with 108 of 120 cells at 2968x1816 and
          12 at 1499x1816 — one unstyled frame during a load, then the ratchet.
          `assert-fusion-combo-distinct` refused 554 of 3475 pairs off it.

          The known-bad is deliberate and repeatable: disable the page's
          stylesheets for one frame and re-enable them. Without `min-w-0` the
          columns come back at 1484/1484 and stay there. With it they return to
          751/750 and the canvas to 1499x1816.

          `app/desk-doodles/page.tsx` already carries `minWidth: 0` on its own
          stage flex item, so that surface was never exposed. This page was.
         ================================================================== */}
      {/* The two columns are two dockview panels now (L1, components/dock-shell.tsx).
          The classes above moved with them: `border-r` / `border-b` onto the
          drawing panel, `min-w-0` onto both, the `lg` stack into a panel move. */}
      <DockShell
        drawing={
          <DrawingCanvas
            rawStrokes={rawStrokes}
            processedStrokes={processedStrokes}
            settings={canvasSettings}
            onSettingsChange={handleCanvasSettingsChange}
            onStrokeComplete={handleStrokeComplete}
            onReprocessed={handleReprocessed}
            onUndo={doUndo}
            onRedo={doRedo}
            onClear={handleClearCanvas}
            canUndo={undoState.canUndo}
            canRedo={undoState.canRedo}
            undoLabel={undoState.undoLabel}
            redoLabel={undoState.redoLabel}
          />
        }
        view={
          <Viewport3DWrapper processedStrokes={viewportStrokes} rawStrokes={clocked.raw} geometryMode={geometryMode} extrudeParams={geometryMode === "extrude" ? extrudeParams : undefined} solidParams={geometryMode === "solid" || geometryMode === "inflate" ? solidParams : undefined} inflateParams={geometryMode === "inflate" ? inflateParams : undefined} styleState={styleState} engineFamily={engineFamily} drawIn={drawIn} onDrawInChange={handleDrawInChange} revealWindow={revealWindow} onRevealWindowChange={handleRevealWindowChange} revealEnvelope={revealEnvelope} onRevealEnvelopeChange={handleRevealEnvelopeChange} take={take} onTakeChange={handleTakeChange} flatten={flatten} onFlattenChange={handleFlattenChange} settingsRef={settingsRef} apiRef={viewportApiRef} />
        }
        style={
          <KeyedStyle styleState={styleState} clockRef={keyClockRef}>
            {(shown) => (
              <StylePanelScaffold
                docked
                summary={styleSummary}
                open
                activeId={activePanelId}
                styleState={shown}
                setStyleState={setStyleStateRecorded}
                onSelectPreset={handleSelectPreset}
                onOpenChange={() => {}}
                onActiveIdChange={setActivePanelId}
                cameraSpin={cameraSpin}
                onSpin={applySpin}
                onSelectCombo={handleSelectCombo}
                drawInTiming={{
                  drawIn,
                  patchDrawIn: handleDrawInChange,
                  drawInUnitCount: countDrawInUnits(
                    viewportStrokes,
                    drawIn.unit,
                    geometryMode === "solid" || geometryMode === "inflate" ? solidParams : undefined,
                  ),
                  strokeCount: viewportStrokes.length,
                  revealWindow,
                  patchWindow: handleRevealWindowChange,
                  envelope: revealEnvelope,
                  patchEnvelope: handleRevealEnvelopeChange,
                  flatten,
                  patchFlatten: handleFlattenChange,
                  flip: styleState.flip,
                  patchFlip: (flip) => setStyleStateRecorded((s) => (s.flip === flip || (flip === "off" && s.flip === undefined) ? s : { ...s, flip })),
                }}
              />
            )}
          </KeyedStyle>
        }
      />

      {/* EXPORT HAS TO BE ABLE TO SPEAK. `<Toaster />` shipped in this repo and
          was mounted nowhere, so every export outcome — success AND failure —
          was a `console.error` the user never sees, or nothing at all. Mounted
          here rather than in the layout because this is the app shell; the
          host-driven `/desk-doodles` beat owns its own chrome and raises no
          toasts. */}
      {/* ⚠ THE OFFSET IS LOAD-BEARING, AND IT WAS FOUND BY A POINTER TEST, NOT
          BY EYE. At the default offset a `bottom-center` toast lands ON TOP OF
          the canvas's own action bar (`bottom-3` in drawing-canvas.tsx):
          `document.elementFromPoint` over the Spacing slider returned sonner's
          `<li>`, not the input, so the drag in assert-data-safety §3.6b was
          hitting the toast.

          It is not a test artefact — it is the worst possible overlap in this
          particular app. Clear raises a toast that SAYS "⌘Z brings them back",
          and that toast was covering the Undo button. The message telling you
          what happened was sitting on the control that takes it back.

          88px clears the 34px control bar plus its 12px inset with room for the
          card's shadow.

          ⚠ 88 WAS NOT ENOUGH, AND THE SECOND BOTTOM BAR IS WHY. That number was
          calibrated against ONE bottom bar — the canvas's — and this app has
          two. Measured at 1500x1460 with the quota toast up
          (scripts/verify/_probe-lane28-toastbox.mjs):

            toast box                     top 1244  bottom 1372  height 128
            canvas action bar (Undo…)     top 1415  bottom 1443   →  17-45px up
            viewport transport (Play…)    top 1321  bottom 1349   → 111-139px up

          The canvas bar was cleared exactly as intended. The VIEWPORT's
          transport sits three times higher off the bottom edge, so a tall toast
          — and the quota toast is 128px because its description is four lines —
          reaches straight through it. `document.elementFromPoint` over the Play
          button returned sonner's `<li>`. Same defect as the Undo one, one
          column to the right, and it survived the first fix because the first
          fix only ever measured the bar it was written for.

          152px cleared the transport's 139px with 13px for the card's shadow.

          🔴 AND IT ROTTED, EXACTLY AS THIS COMMENT SAID IT WOULD, ON
          2026-09-04. The transport card moved from `bottom-12` to `bottom-16`
          because at `bottom-12` its bottom edge sat INSIDE the export row (card
          bottom 934, export row top 930 at 1512x982 — a 4px overlap and 3px of
          daylight, docs/verification/ui-audit-product). Sixteen pixels up, and
          re-measured the same way at 1500x1460 with a stroke down:

            viewport transport (Play…)   top 1291  bottom 1319  →  141-169px up

          169 > 152, so the quota toast reached through Play again and
          `assert-shell-states` §3 went 31 pass · 1 fail: "COVERED: Play". The
          gate did its job. **182 = the transport's new 169 plus the same 13px
          for the card's shadow**, so the arithmetic is the one this comment
          already argued for, applied to a number that moved.

          The constant CAN ROT AGAIN — the transport still belongs to another
          file — which is why it is not left to trust: `assert-shell-states.mjs`
          §3 drives every toast path and asks the document what is actually at
          the centre of every interactive element, so a bar that moves fails a
          gate instead of quietly covering a control again.

          🔴 L3 MOVED THE TRANSPORT AGAIN, AND THE CONSTANT WENT WITH IT. The
          transport left the 3D view for the dock's header, under both panels,
          and the dock folds and opens, so no fixed number clears it: 182
          over a dock opened to a third of the shell lands the toast on the
          strip. The dock publishes its own top edge as `--fs-toast-offset`
          (`components/dock-shell.tsx`, publishEdge): the edge plus the 88 px
          the drawing's action bar needs, since that bar now sits right on
          top of the dock. 182 is only the fallback for the frames before
          the dock has laid out. `assert-dock-panels.mjs` row T is the must-fail:
          the fixed 182 against the moved transport. */}
      <Toaster position="bottom-center" offset={{ bottom: "var(--fs-toast-offset, 182px)" }} richColors closeButton />
    </div>
    </TakeTransportProvider>
    </StrokeTakeProvider>
  )
}
