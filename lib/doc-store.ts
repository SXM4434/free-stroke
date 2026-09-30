/**
 * FREE STROKE'S DOCUMENT — what is persisted, what is validated, what migrates.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THE USER'S WORK ACTUALLY CONSISTS OF
 *
 * The PRD is unambiguous that the styling IS the product — §1: *"Draw something
 * by hand, turn it into an animated 3D ink/sculptural object, style it with
 * procedural visual layers like dither and ASCII, animate those layers"* — and
 * §2 lays out sixteen layers of which exactly ONE is the stroke.
 *
 * Before this file, the app persisted layer 1 and nothing else. The mark
 * survived a reload wearing nothing: every dial, the layer stack, the active
 * preset, the custom material, the geometry mode and all of its params were
 * `useState` and evaporated. A user who spent an hour on a Terminal Gel got
 * their polyline back.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THREE KEYS, THREE REASONS
 *
 *   freestroke.strokes.v1   the drawing. RAW strokes only — the processed
 *                           strokes are a pure function of the raw ones and the
 *                           three canvas settings, so storing them would be
 *                           storing a cache that can disagree with its source.
 *   freestroke.fusions.v1   the user's authored fusions. Kept separate because
 *                           they are the one thing in this app a user can MAKE
 *                           that is not the drawing, and because they outlive
 *                           any single session's style state.
 *   freestroke.session.v1   everything else on screen: style state, geometry
 *                           mode and params, the engine, the canvas settings.
 *
 * All three now carry `{v, kind, data, at}` — see `lib/storage.ts` for why the
 * version has to travel WITH the data and not in the key name.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ WHAT IS DELIBERATELY *NOT* PERSISTED, AND WHY
 *
 *   · PROCESSED STROKES — derived. Recomputed on load through the same
 *     `processStroke` the canvas uses. (Pre-existing decision, kept.)
 *
 *   · THE CAMERA — azimuth, elevation, zoom, spin. It is VIEW state, not
 *     document state, and the two are not the same thing: restoring a camera
 *     means the app opens on a framing the user last used for an export rather
 *     than on the framing that reads best. Every drawing tool in the reference
 *     set draws this line in the same place. It is also why the camera is not
 *     on the undo stack.
 *
 *   · WHICH PANEL WAS OPEN (`panelsOpen`, `activePanelId`). `app/page.tsx`
 *     states the intent in code: *"closed by default so the app opens
 *     canvas-first — the gesture is the product; the control surface is one
 *     click away."* Persisting a drawer open would quietly overwrite an
 *     authored first impression on every reload, to save one click.
 *
 *   · THE UNDO HISTORY. It is a stack of documents; persisting it would
 *     multiply the storage cost by the depth cap, and it would be the largest
 *     and most fragile migration surface in the app — a schema change would
 *     have to migrate not one document but a hundred. A reload is a session
 *     boundary, and history ending at a session boundary is what every tool
 *     with a history palette does. The hole this leaves — Clear, then reload —
 *     is closed by the trash slot below rather than by persisting the stack.
 *
 *   · `materialUserOverride` IS persisted even though it is a flag rather than
 *     a value, because without it a restored session silently re-applies the
 *     per-mode default material the first time the user touches the mode pills,
 *     throwing away a pinned material. A flag that guards user intent is user
 *     intent.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VALIDATE THE POINTS, NOT THE CONTAINER
 *
 * The old restore filter checked that `points` was an array with length > 1 and
 * never looked inside it. That is not a small gap, because of one line in
 * `lib/stroke-processing.ts:497`:
 *
 *     t: prev.t + (curr.t - prev.t) * ratio
 *
 * `resampleStroke` INTERPOLATES the timestamp. So a single point whose `t` is
 * missing does not break one point — `undefined - undefined` is NaN, and the
 * NaN is written into every resampled point downstream of it. From there
 * `penTimeDistanceFraction` (`lib/pen-reveal.ts:97`) does
 * `t0 = Math.min(t0, pts[0].t)`, gets NaN, fails its own `Number.isFinite`
 * guard and returns null — and the draw-in reveal, which is the product's
 * signature moment, silently stops being time-driven.
 *
 * So `validateStrokes` below inspects EVERY point. And the repair policy is
 * split deliberately:
 *
 *   x / y non-finite → DROP the point. There is no truth to recover; a
 *                      fabricated coordinate is a shape the user never drew.
 *                      If the stroke falls under two points it is dropped.
 *   t non-finite     → RE-DERIVE it. Timing is capture metadata, not authored
 *                      geometry, and the alternative is dropping the stroke —
 *                      which discards the shape, which IS what the user
 *                      authored. This is the opposite call from the one
 *                      `lib/style-fusion.ts:786` makes about a malformed
 *                      fusion link, and deliberately so: that link encodes a
 *                      RELATIONSHIP the user authored and guessing a
 *                      substitute would invent one. A timestamp encodes how
 *                      fast their hand moved, which is already gone.
 *   t out of order   → clamped to non-decreasing. `penTimeDistanceFraction`
 *                      accumulates revealed length by comparing `t` against a
 *                      moving cursor; unsorted timestamps make the reveal
 *                      appear in the wrong order rather than fail loudly.
 *
 * Every repair is COUNTED and returned. A silent repair is indistinguishable
 * from a bug.
 */

import type { Stroke, Point } from "@/lib/stroke-processing"
import {
  type StyleState,
  type StylePreset,
  type PresetFamily,
  DEFAULT_STYLE_STATE,
  PRESET_REGISTRY,
  MINE_PREFIX,
} from "@/lib/style-system"
import type { CustomFusion, FusionLink, FusionSourceId, FusionTargetId } from "@/lib/style-fusion"
import { DEFAULT_GLOW_COLOR } from "@/lib/style-fusion"
import {
  type GeometryMode,
  type ExtrudeParams,
  type SolidParams,
  type InflateParams,
  DEFAULT_EXTRUDE_PARAMS,
  DEFAULT_SOLID_PARAMS,
  DEFAULT_INFLATE_PARAMS,
  extrudeWidthToSlider,
} from "@/lib/geometry-engines"
import { DEFAULT_ENGINE_FAMILY, isEngineFamily, type EngineFamily } from "@/lib/engine-registry"
/* THE MOTION SETTINGS' TYPES AND DEFAULTS LIVE IN `lib/stroke-schedule.ts` AND
 * ARE IMPORTED, NEVER RESTATED. A second copy of `DRAW_IN_DEFAULTS` here would
 * be a second answer to "what does a fresh session play like", and the two
 * would disagree the first time either moved. The three label records come
 * along for the same reason: each is `Record<Union, string>`, so its key set IS
 * the union, checked by tsc at its own definition. `Object.keys` of one is the
 * allowed-value list with nothing to keep in sync. */
import {
  type DrawInParams,
  type RevealWindowParams,
  type RevealEnvelopeParams,
  type RevealEase,
  type RevealEasePreset,
  type RevealCurve,
  type RevealPace,
  type ScheduleAlign,
  type ScheduleUnitMode,
  DRAW_IN_DEFAULTS,
  REVEAL_WINDOW_DEFAULTS,
  REVEAL_ENVELOPE_DEFAULTS,
  ORDER_LABELS,
  REVERSE_LABELS,
  WINDOW_LABELS,
  REVEAL_CLOCK_LABELS,
  REVEAL_RATE_MIN,
  REVEAL_RATE_MAX,
  DURATION_MIN_SECONDS,
  DURATION_MAX_SECONDS,
} from "@/lib/stroke-schedule"
import {
  type StrokeTiming,
  type StrokeTimingTake,
  STROKE_TIMING_TAKE_DEFAULTS,
  curveProblem,
} from "@/lib/stroke-timing"
/* The pen's tip. `pen-reveal.ts` imports nothing from here, so this direction
 * is the only one. The shapes and the live setter both live there; this file
 * only needs to know the name is one of six. */
import { PEN_TIP_SHAPES, readPenTipMode, type PenTipMode } from "@/lib/pen-reveal"
import { SOLID_STATE, type FlatState } from "@/lib/flat-ink"
import { KEY_PROPERTIES, compactKeys, validateTrack, type KeyProperty, type TakeKeys, type Track } from "@/lib/keyframes"
import type { SchemaSpec } from "@/lib/storage"

/* ========================================================================== */
/*  KEYS                                                                      */
/* ========================================================================== */

export const STROKES_KEY = "freestroke.strokes.v1"
export const FUSIONS_KEY = "freestroke.fusions.v1"
export const SESSION_KEY = "freestroke.session.v1"
/** Where Clear puts the drawing it removed. See `trashSchema`. */
export const TRASH_KEY = "freestroke.trash.v1"

/* ========================================================================== */
/*  STROKES                                                                   */
/* ========================================================================== */

export interface StrokeValidation {
  strokes: Stroke[]
  repairs: string[]
}

const isFiniteNumber = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n)

/**
 * THE POINT VALIDATOR. Every point, every field.
 *
 * Returns the cleaned strokes plus a plain-language list of what had to be
 * repaired, so the caller can surface it rather than swallow it.
 */
export function validateStrokes(input: unknown): StrokeValidation | null {
  if (!Array.isArray(input)) return null

  const repairs: string[] = []
  let droppedPoints = 0
  let restampedPoints = 0
  let reorderedPoints = 0
  let droppedStrokes = 0
  let droppedPressure = 0

  const out: Stroke[] = []
  for (const s of input) {
    if (!s || typeof s !== "object" || !Array.isArray((s as Stroke).points)) {
      droppedStrokes++
      continue
    }
    const src = (s as Stroke).points as unknown[]

    /* PASS 1 — geometry. A point with no recoverable position is not a point. */
    const kept: { x: number; y: number; t: number | null; pressure: number | undefined }[] = []
    for (const p of src) {
      if (!p || typeof p !== "object") {
        droppedPoints++
        continue
      }
      const q = p as Partial<Point>
      if (!isFiniteNumber(q.x) || !isFiniteNumber(q.y)) {
        droppedPoints++
        continue
      }
      let pressure: number | undefined = undefined
      if (q.pressure !== undefined) {
        if (isFiniteNumber(q.pressure)) pressure = Math.max(0, Math.min(1, q.pressure))
        else droppedPressure++
      }
      kept.push({ x: q.x, y: q.y, t: isFiniteNumber(q.t) ? q.t : null, pressure })
    }

    if (kept.length < 2) {
      droppedStrokes++
      continue
    }

    /* PASS 2 — timing.
     *
     * A stroke with SOME good timestamps is interpolated between them, so the
     * repaired points sit on the cadence the hand actually had. A stroke with
     * NONE is given an even 16 ms grid, which is one pointer sample at 60 Hz —
     * the same cadence `injectStrokes` uses for its synthetic marks, so a fully
     * restamped stroke replays exactly like a synthesised one rather than like
     * a broken one. */
    const anyT = kept.some((p) => p.t !== null)
    if (!anyT) {
      for (let i = 0; i < kept.length; i++) {
        kept[i].t = i * 16
        restampedPoints++
      }
    } else {
      /* Forward-fill from the first known, then back-fill the head. */
      let lastKnown = -1
      for (let i = 0; i < kept.length; i++) {
        if (kept[i].t !== null) {
          if (lastKnown >= 0 && i - lastKnown > 1) {
            /* Interpolate the run between two knowns. */
            const a = kept[lastKnown].t as number
            const b = kept[i].t as number
            for (let j = lastKnown + 1; j < i; j++) {
              kept[j].t = a + ((b - a) * (j - lastKnown)) / (i - lastKnown)
              restampedPoints++
            }
          }
          lastKnown = i
        }
      }
      /* Head: no known timestamp before the first one — walk backwards at the
       * stroke's own mean cadence rather than inventing a constant. */
      const firstKnown = kept.findIndex((p) => p.t !== null)
      const lastKnownIdx = (() => {
        for (let i = kept.length - 1; i >= 0; i--) if (kept[i].t !== null) return i
        return -1
      })()
      const span =
        lastKnownIdx > firstKnown
          ? ((kept[lastKnownIdx].t as number) - (kept[firstKnown].t as number)) /
            (lastKnownIdx - firstKnown)
          : 16
      const step = Number.isFinite(span) && span > 0 ? span : 16
      for (let i = firstKnown - 1; i >= 0; i--) {
        kept[i].t = (kept[i + 1].t as number) - step
        restampedPoints++
      }
      for (let i = lastKnownIdx + 1; i < kept.length; i++) {
        kept[i].t = (kept[i - 1].t as number) + step
        restampedPoints++
      }
    }

    /* PASS 3 — monotonicity. `penTimeDistanceFraction` walks segments against a
     * moving time cursor; a timestamp that goes backwards makes the reveal
     * paint out of order, which looks like a rendering bug and is a data bug.
     *
     * ⚠ CLAMPING ALONE IS NOT ENOUGH, and the assertion caught it. A stroke
     * whose timestamps run fully BACKWARDS (90, 40, 10) clamps to a CONSTANT
     * (90, 90, 90) — every point non-decreasing, every point identical. That
     * passes a monotonic check and then fails one line later, because
     * `penTimeDistanceFraction` requires `t1 - t0 > 0` and returns null on a
     * zero span. The reveal stops being time-driven, which is the exact defect
     * this validator exists to prevent, re-introduced by its own repair.
     *
     * So: clamp first (which preserves genuine timing wherever it survives),
     * then check the SPAN. A stroke left with no span at all has no recoverable
     * timing, and the authored information that IS still intact is the POINT
     * ORDER — the polyline is stored in the order it was drawn. Re-deriving `t`
     * from the index keeps that and discards only the corrupt numbers. */
    for (let i = 1; i < kept.length; i++) {
      const prev = kept[i - 1].t as number
      const cur = kept[i].t as number
      if (cur < prev) {
        kept[i].t = prev
        reorderedPoints++
      }
    }
    const span = (kept[kept.length - 1].t as number) - (kept[0].t as number)
    if (!(span > 0)) {
      for (let i = 0; i < kept.length; i++) {
        kept[i].t = i * 16
        restampedPoints++
      }
    }

    out.push({
      points: kept.map<Point>((p) => ({
        x: p.x,
        y: p.y,
        t: p.t as number,
        ...(p.pressure !== undefined ? { pressure: p.pressure } : null),
      })),
    })
  }

  if (droppedStrokes) repairs.push(`${droppedStrokes} stroke(s) had no usable points and were dropped`)
  if (droppedPoints) repairs.push(`${droppedPoints} point(s) had no finite position and were dropped`)
  if (restampedPoints) repairs.push(`${restampedPoints} point(s) had no usable timestamp and were re-derived`)
  if (reorderedPoints) repairs.push(`${reorderedPoints} timestamp(s) ran backwards and were clamped`)
  if (droppedPressure) repairs.push(`${droppedPressure} pressure value(s) were not finite and were dropped`)

  return { strokes: out, repairs }
}

export const strokesSchema: SchemaSpec<Stroke[]> = {
  key: STROKES_KEY,
  kind: "freestroke.strokes",
  version: 1,
  migrations: {
    /* v0 is the bare `Stroke[]` this app has been writing since strokes were
     * first persisted. It is on disk on every machine that has opened Free
     * Stroke, so this step is the load-bearing one, not a courtesy. */
    0: (data) => (Array.isArray(data) ? data : null),
  },
  validate: (data) => {
    const v = validateStrokes(data)
    if (!v) return null
    return { value: v.strokes, repairs: v.repairs }
  },
}

/** The trash slot Clear writes to. Same schema, different key — so a cleared
 *  drawing survives a reload and can be offered back. */
export const trashSchema: SchemaSpec<Stroke[]> = {
  ...strokesSchema,
  key: TRASH_KEY,
  kind: "freestroke.trash",
  /* No v0: nothing has ever been written here without an envelope. A bare array
   * found under this key is a hand-edit or a collision, and is quarantined. */
  migrations: {},
}

/* ========================================================================== */
/*  FUSIONS                                                                   */
/* ========================================================================== */

const FUSION_SOURCE_IDS: ReadonlySet<string> = new Set<FusionSourceId>([
  "breath",
  "asciiField",
  "ditherField",
  "textureField",
  "reveal",
  "completion",
  "event",
])

const FUSION_TARGET_IDS: ReadonlySet<string> = new Set<FusionTargetId>([
  "ditherThreshold",
  "ditherCell",
  "ditherAmount",
  "asciiDensity",
  "asciiFlow",
  "textureAmount",
  "textureScale",
  "textureFlow",
  "gloss",
  "glow",
  "wet",
  "sheen",
  "shineBand",
])

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/**
 * THE FUSION VALIDATOR — the storage-side half of the NaN defence.
 *
 * `lib/style-fusion.ts:786` guards the evaluator: an unresolvable `link.source`
 * is skipped so it cannot reach `f.ditherScaleMul *= NaN`. That guard is right
 * and it stays. But it is the LAST line of defence, and it can only skip — it
 * cannot tell the user their fusion has a dead link, and it runs once per link
 * per frame forever.
 *
 * Rejecting the link HERE, once, at the boundary, means the panel and the
 * evaluator both see a fusion whose links are all real. Note the asymmetry with
 * strokes: a bad link is DROPPED, never repaired, because a link is a
 * relationship the user authored and substituting a source would invent one.
 */
/**
 * HIS SAVED PRESETS, checked at the boundary (ANIM-4, 2026-09-26). Each element
 * must be a `StylePreset` of his: a `mine:` id, a name, a family this build has,
 * and an `applies` whose every key is a style field of the same type. A key that
 * fails is DROPPED and named; a value is never invented to fill it, because the
 * preset is something he authored.
 */
export function validateCustomPresets(input: unknown): { presets: StylePreset[]; repairs: string[] } | null {
  if (!Array.isArray(input)) return null
  const repairs: string[] = []
  const out: StylePreset[] = []
  const seen = new Set<string>()
  const defaults = DEFAULT_STYLE_STATE as unknown as Record<string, unknown>
  for (const raw of input) {
    const r = raw as Record<string, unknown> | null
    const ok =
      r && typeof r === "object" &&
      typeof r.id === "string" && r.id.startsWith(MINE_PREFIX) && !seen.has(r.id) &&
      typeof r.label === "string" && r.label.trim() !== "" &&
      typeof r.family === "string" && r.family in PRESET_REGISTRY &&
      r.applies && typeof r.applies === "object" && !Array.isArray(r.applies)
    if (!ok) {
      repairs.push("a saved preset was not readable and was dropped")
      continue
    }
    const applies: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(r.applies as Record<string, unknown>)) {
      const d = defaults[k]
      const fits =
        k in defaults && k !== "customPresets" && k !== "customFusions" &&
        (d === null || v === null || typeof v === typeof d)
      if (fits) applies[k] = v
      else repairs.push(`saved preset "${r.label}" lost field "${k}", which this build does not have`)
    }
    /* A draw-in preset of his carries `motion` (MOTION-CUSTOM): each part's
     * keys must be ones the take has, with the same type, or they drop and are
     * named, the same rule `applies` follows. */
    let motion: Record<string, Record<string, unknown>> | undefined
    if (r.motion && typeof r.motion === "object" && !Array.isArray(r.motion)) {
      motion = {}
      const parts: [string, Record<string, unknown>][] = [
        ["drawIn", DRAW_IN_DEFAULTS as unknown as Record<string, unknown>],
        ["revealWindow", REVEAL_WINDOW_DEFAULTS as unknown as Record<string, unknown>],
        ["envelope", REVEAL_ENVELOPE_DEFAULTS as unknown as Record<string, unknown>],
      ]
      for (const [part, d] of parts) {
        const src = (r.motion as Record<string, unknown>)[part]
        if (!src || typeof src !== "object") continue
        const kept: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
          if (k in d && typeof v === typeof d[k]) kept[k] = v
          else repairs.push(`saved preset "${r.label}" lost motion field "${part}.${k}", which this build does not have`)
        }
        motion[part] = kept
      }
    }
    seen.add(r.id as string)
    out.push({
      id: r.id as string,
      label: (r.label as string).trim(),
      family: r.family as PresetFamily,
      description: typeof r.description === "string" ? r.description : undefined,
      enabled: true,
      implemented: r.implemented !== false,
      applies: applies as Partial<StyleState>,
      ...(motion ? { motion: motion as StylePreset["motion"] } : {}),
    })
  }
  return { presets: out, repairs }
}

export function validateFusions(input: unknown): { fusions: CustomFusion[]; repairs: string[] } | null {
  if (!Array.isArray(input)) return null
  const repairs: string[] = []
  let droppedFusions = 0
  let droppedLinks = 0
  let fixedColors = 0
  let clampedAmounts = 0

  const out: CustomFusion[] = []
  const seenIds = new Set<string>()
  for (const f of input) {
    if (!f || typeof f !== "object") {
      droppedFusions++
      continue
    }
    const c = f as Partial<CustomFusion>
    if (typeof c.id !== "string" || !c.id || typeof c.name !== "string" || !Array.isArray(c.links)) {
      droppedFusions++
      continue
    }
    /* A duplicate id makes `customFusionKey` ambiguous — two pills would select
     * the same state value and the panel could not tell which one is armed. */
    if (seenIds.has(c.id)) {
      droppedFusions++
      continue
    }
    seenIds.add(c.id)

    const links: FusionLink[] = []
    for (const l of c.links as unknown[]) {
      if (!l || typeof l !== "object") {
        droppedLinks++
        continue
      }
      const k = l as Partial<FusionLink>
      if (typeof k.source !== "string" || !FUSION_SOURCE_IDS.has(k.source)) {
        droppedLinks++
        continue
      }
      if (typeof k.target !== "string" || !FUSION_TARGET_IDS.has(k.target)) {
        droppedLinks++
        continue
      }
      let amount = 0
      if (isFiniteNumber(k.amount)) {
        amount = Math.max(-1, Math.min(1, k.amount))
        if (amount !== k.amount) clampedAmounts++
      } else {
        clampedAmounts++
      }
      links.push({
        id: typeof k.id === "string" && k.id ? k.id : `l${Math.random().toString(36).slice(2, 9)}`,
        source: k.source as FusionSourceId,
        target: k.target as FusionTargetId,
        amount,
      })
    }

    /* `glowColor` reaches `THREE.Color.set()` in viewport-3d.tsx. A non-string
     * or a malformed hex gets a console warning and an unpredictable colour;
     * the editor's own default is the same answer the user would get making the
     * fusion today. */
    let glowColor = c.glowColor
    if (typeof glowColor !== "string" || !HEX.test(glowColor)) {
      glowColor = DEFAULT_GLOW_COLOR
      fixedColors++
    }

    out.push({ id: c.id, name: c.name, links, glowColor })
  }

  if (droppedFusions) repairs.push(`${droppedFusions} fusion(s) were malformed and were dropped`)
  if (droppedLinks) repairs.push(`${droppedLinks} link(s) named a source or target this build does not have`)
  if (clampedAmounts) repairs.push(`${clampedAmounts} link amount(s) were out of range and were clamped`)
  if (fixedColors) repairs.push(`${fixedColors} fusion(s) had no usable glow colour`)

  return { fusions: out, repairs }
}

export const fusionsSchema: SchemaSpec<CustomFusion[]> = {
  key: FUSIONS_KEY,
  kind: "freestroke.fusions",
  version: 1,
  migrations: {
    /* v0 is the bare `CustomFusion[]` currently on disk. */
    0: (data) => (Array.isArray(data) ? data : null),
  },
  validate: (data) => {
    const v = validateFusions(data)
    if (!v) return null
    return { value: v.fusions, repairs: v.repairs }
  },
}

/* ========================================================================== */
/*  SESSION — the styling, which the PRD says IS the product                  */
/* ========================================================================== */

/** Canvas processing settings. They live in `DrawingCanvas` but they reshape
 *  the mark, so they are the user's work and they belong in the document. */
export interface CanvasSettings {
  spacing: number
  smoothing: boolean
  preserveCorners: boolean
}

export const DEFAULT_CANVAS_SETTINGS: CanvasSettings = {
  spacing: 4,
  smoothing: true,
  preserveCorners: true,
}

export interface SessionDoc {
  styleState: StyleState
  geometryMode: GeometryMode
  engineFamily: EngineFamily
  extrudeParams: ExtrudeParams
  widthSlider: number
  solidParams: SolidParams
  inflateParams: InflateParams
  canvas: CanvasSettings
  /**
   * HOW THE MARK DRAWS ITSELF IN — order · overlap · align · unit · reverse.
   *
   * It is here because a take is work. A user who picks `byLength` at `overlap
   * 0.4`, aligned to the end, has authored the moment the product is named
   * after, and before this field the whole thing was `useState` inside the
   * viewport: reload, and the take was gone while the ink and every style dial
   * came back. That is the same defect this file was written to close, one
   * layer up from the dials.
   *
   * NOT bumped a version for. `coerceAgainst` walks the DEFAULTS' keys and
   * skips any the stored object lacks, so a session written before this field
   * existed reads back with `DRAW_IN_DEFAULTS` — which is the identity take,
   * i.e. exactly what such a session played like when it was written.
   */
  drawIn: DrawInParams
  /** WHICH STRETCH OF THE BEAT IS ON THE PAGE — grow / travel / vanish /
   *  shrink, plus the travelling window's length. Same reasoning as `drawIn`,
   *  same additive read. `REVEAL_WINDOW_DEFAULTS` is the prefix the app shipped
   *  with, so an older document is unchanged by getting it. */
  revealWindow: RevealWindowParams
  /** HOW THE BEAT RUNS — ease, delay, loop, reverse. The last part of the take
   *  a reload still threw away, and only because the four dials were loose
   *  `useState` inside `components/viewport-3d.tsx` with no name the page could
   *  pass or the document could hold. Same additive read as the two above:
   *  `REVEAL_ENVELOPE_DEFAULTS` is the behaviour that shipped before the
   *  controls existed, so an older document plays exactly as it did. */
  revealEnvelope: RevealEnvelopeParams
  /** PER-STROKE TIMING (ANIM-1A3): delay, speed, ease and hold back, one row
   *  per stroke he touched. An older document has no rows, which is the take
   *  that shipped, so it plays exactly as it did. `readTake` below. */
  take: StrokeTimingTake
  /** KEYS ON DRAW PROGRESS, DEPTH, TURN AND CAMERA (ANIM-3B), sampled from the
   *  take's clock by `lib/keyframes.ts`. Absent means no keys, which is the
   *  motion that shipped, so an older document plays exactly as it did and a
   *  document with no keys never gains a `keys` field on save. `readKeys` below. */
  keys?: TakeKeys
  /** WHAT THE MOVING END OF THE LINE LOOKS LIKE. Four shipped shapes sit at
   *  `nose: 1` and differ only in how far the mark's edges lag its centre:
   *  nib 0, chisel 0.85, reed 1.6, quill 2.7. `reed` is the module default and
   *  is what the product used before there was any way to change it, so an
   *  older document reading back as `reed` renders exactly as it did.
   *
   *  🔴 NOTHING RENDERS THIS YET, MEASURED 2026-09-04, and that is why no pill
   *  offers it. Every one of the six shapes draws the same pixels: on `/` in
   *  all four geometry modes and on `/desk-doodles`, nib against quill is 0
   *  differing pixels, against a positive control of 8,761 px (same tip, two
   *  playheads) and a noise floor of 0. Measured in Inflate mid-reveal with the
   *  app's own probe confirming the gate open at `components/viewport-3d.tsx`
   *  `const wants = mode !== "off" && revealFrac !== null && !winNow.whole` —
   *  `frac 0.446`, `whole false` — and `__inflateProbe.drawDiag().tip` came
   *  back NULL, so the tip's uniform block does not exist on that path.
   *
   *  The field is here and correct because the defect is on the render side,
   *  not the storage side. It stays INVISIBLE until the render is fixed: a
   *  picker for six shapes that draw one shape is a control that lies, which is
   *  the exact class `applyPresetToStyleState`'s `inert` guard exists for. */
  penTip: PenTipMode
  /** HOW THE MARK PRESENTS WHEN IT ARRIVES: flat ink or a lit object, and how
   *  far it has turned. `SOLID_STATE` is the lit form the product has always
   *  shown, so an older document reading back as that renders exactly as it
   *  did. This is the channel the hero beat animates, and until 2026-09-04 the
   *  product route had no value to give it. */
  flatten: FlatState
}

const GEOMETRY_MODES: ReadonlySet<string> = new Set<GeometryMode>(["rod", "extrude", "solid", "inflate"])

/* ── THE ALLOWED VALUES FOR EVERY STRING UNION IN THE TWO MOTION OBJECTS ────
 *
 * ⚠ `coerceAgainst` accepts ANY string where the default is a string, because
 * every string field it had to handle before this was free text (a hex colour,
 * a preset id). `DrawInParams` is the first thing in the document that is
 * mostly string UNIONS, and `"banana"` reaching `drawIn.order` is not a typing
 * error the coercion can see — it is a value no branch in
 * `buildStrokeSchedule` handles, so the schedule falls through to its `asDrawn`
 * arm and the user gets a take they did not pick, silently.
 *
 * `geometryMode` and `engineFamily` already refuse a non-member by name; these
 * are the same rule, declared per key so the generic walker can apply it.
 *
 * THREE OF THE FIVE COST NOTHING TO KEEP HONEST: `ORDER_LABELS`,
 * `REVERSE_LABELS` and `WINDOW_LABELS` are `Record<Union, string>` in
 * `stroke-schedule.ts`, so tsc already forces their keys to BE the union and
 * `Object.keys` is that union at runtime.
 *
 * `align` and `unit` have no label record to borrow, so they are written out —
 * as `Record<Union, true>`, which is the same exhaustiveness contract rather
 * than a bare `Set<string>`: add a third `ScheduleAlign` member and this object
 * literal stops compiling, instead of silently rejecting the new value at
 * runtime and handing every stored document the default. */
const ALIGN_VALUES: Record<ScheduleAlign, true> = { start: true, end: true }
const UNIT_VALUES: Record<ScheduleUnitMode, true> = { group: true, stroke: true }

const DRAW_IN_UNIONS: Record<string, ReadonlySet<string>> = {
  order: new Set(Object.keys(ORDER_LABELS)),
  reverse: new Set(Object.keys(REVERSE_LABELS)),
  align: new Set(Object.keys(ALIGN_VALUES)),
  unit: new Set(Object.keys(UNIT_VALUES)),
}
const REVEAL_WINDOW_UNIONS: Record<string, ReadonlySet<string>> = {
  mode: new Set(Object.keys(WINDOW_LABELS)),
}
/* `RevealEase` has no label record in `stroke-schedule.ts` to borrow — the one
 * that exists, `REVEAL_EASES`, is in `components/viewport-3d.tsx`, and lib
 * importing a component would be the wrong direction. Written out as
 * `Record<Union, true>` for the same reason `ALIGN_VALUES` is: add a fifth ease
 * and this literal stops compiling, rather than silently rejecting it at
 * runtime and handing every stored document `linear`. */
const EASE_VALUES: Record<RevealEasePreset, true> = { linear: true, in: true, out: true, inOut: true }
const PACE_VALUES: Record<RevealPace, true> = { hybrid: true, raw: true }
/* Borrowed rather than restated: `PEN_TIP_SHAPES` is `Record<PenTipMode,
 * PenTipShape>`, so tsc already forces its keys to BE the union and
 * `Object.keys` is that union at runtime. Same trick as the three label
 * records above, and it costs nothing to keep honest. */
const PEN_TIP_VALUES: ReadonlySet<string> = new Set(Object.keys(PEN_TIP_SHAPES))
const REVEAL_ENVELOPE_UNIONS: Record<string, ReadonlySet<string>> = {
  ease: new Set(Object.keys(EASE_VALUES)),
  /* `smooth` is a real `RevealMode` and is REFUSED here on purpose: it is a
   * debug pill and a compare phase, never a take. A document carrying it reads
   * back as `hybrid` with a repair, which is the honest outcome. */
  mode: new Set(Object.keys(PACE_VALUES)),
  /* A document from before HAND-DRAW has no `clock`, and `coerceAgainst` keeps
   * the default for a missing key, so it opens on `recorded`, unchanged. */
  clock: new Set(Object.keys(REVEAL_CLOCK_LABELS)),
}

/** The slider position `app/page.tsx` initialises to. Derived from the engine's
 *  own default half-width so the two cannot drift. */
const DEFAULT_WIDTH_SLIDER = extrudeWidthToSlider(DEFAULT_EXTRUDE_PARAMS.width)

/**
 * COERCE A STORED OBJECT AGAINST A DEFAULT, KEY BY KEY.
 *
 * This is the part that makes an older OR a newer payload safe without either
 * a hand-written field list or a blind spread:
 *
 *   · A key the default has and the payload does not → the default. That is a
 *     payload written before the field existed, handled.
 *   · A key the payload has and the default does not → DROPPED. That is a
 *     payload from a newer build, or an injected field, and letting it through
 *     is how foreign data ends up in state.
 *   · A key present in both but of the wrong TYPE → the default. `"0.5"` is not
 *     `0.5` and a string reaching a shader uniform is a silent wrong picture.
 *   · Numbers must additionally be FINITE. `NaN` is `typeof "number"`, and NaN
 *     in a uniform is the exact failure this project already documented.
 *
 * Nested plain objects recurse (this is what `customMaterial` needs). Arrays
 * are NOT walked — every array in this document needs its own element
 * validator, and a generic one would be a validator that validates nothing.
 *
 * ⚠ AND A STRING WHOSE DEFAULT IS A STRING USED TO MEAN "ANY STRING".
 * That is right for free text and wrong for a UNION, and the document had no
 * union inside a coerced object until `drawIn` arrived. `unions` names the keys
 * that have a fixed vocabulary; a value outside it keeps the default and is
 * REPORTED through `rejected` rather than swallowed, because a take quietly
 * replaced is the same class of silence as a repair nobody is told about.
 * Omitted, every existing call behaves exactly as it did.
 */
function coerceAgainst<T>(
  defaults: T,
  candidate: unknown,
  arrayKeys: Set<string> = new Set(),
  unions: Record<string, ReadonlySet<string>> = {},
  rejected?: string[],
): T {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return defaults
  const src = candidate as Record<string, unknown>
  const out = { ...(defaults as Record<string, unknown>) }
  for (const key of Object.keys(out)) {
    if (!(key in src)) continue
    if (arrayKeys.has(key)) continue
    const d = out[key]
    const v = src[key]
    if (typeof d === "number") {
      if (isFiniteNumber(v)) out[key] = v
    } else if (typeof d === "boolean") {
      if (typeof v === "boolean") out[key] = v
    } else if (typeof d === "string") {
      const allowed = unions[key]
      if (typeof v !== "string") continue
      if (allowed && !allowed.has(v)) {
        /* Phrased so it needs no article. `a order` and `a align` are what a
         * `"is not a ${key}"` template produces, and a repair note the user
         * reads is copy. */
        rejected?.push(`${key} "${v}" is not one this build has`)
        continue
      }
      out[key] = v
    } else if (d === null) {
      /* A nullable field — `activePresetId` and friends. Accept null or a
       * string; anything else keeps the default. */
      if (v === null || typeof v === "string") out[key] = v
    } else if (Array.isArray(d)) {
      /* Unreachable for the keys we hand in, but explicit: an array without a
       * declared element validator keeps the default rather than being trusted. */
      continue
    } else if (d && typeof d === "object") {
      out[key] = coerceAgainst(d, v)
    }
  }
  return out as T
}

export function validateSession(input: unknown): { session: SessionDoc; repairs: string[] } | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null
  const src = input as Record<string, unknown>
  const repairs: string[] = []

  /* `customFusions` is an ARRAY OF OBJECTS and gets the real element validator,
   * never the generic coercion. It is also the field that reaches the
   * multiplicative accumulator. */
  const styleCandidate = src.styleState
  const style = coerceAgainst(DEFAULT_STYLE_STATE, styleCandidate, new Set(["customFusions", "customPresets"]))
  /* FLIP-3 · `flip` is optional, so DEFAULT_STYLE_STATE has no value for the
   * coerce above to check it against. It is one of the three names, or gone. */
  const flipRaw =
    styleCandidate && typeof styleCandidate === "object" ? (styleCandidate as Record<string, unknown>).flip : undefined
  delete style.flip
  if (flipRaw === "flatToSolid" || flipRaw === "solidToFlat") style.flip = flipRaw
  else if (flipRaw !== undefined && flipRaw !== "off")
    repairs.push(`the session's flip "${String(flipRaw)}" is not a choice, so the flip was turned off`)
  const presetsRaw =
    styleCandidate && typeof styleCandidate === "object"
      ? (styleCandidate as Record<string, unknown>).customPresets
      : undefined
  if (presetsRaw !== undefined) {
    const vp = validateCustomPresets(presetsRaw)
    style.customPresets = vp ? vp.presets : []
    repairs.push(...(vp ? vp.repairs : ["the session's saved preset list was not an array and was reset"]))
  }
  const fusionsRaw =
    styleCandidate && typeof styleCandidate === "object"
      ? (styleCandidate as Record<string, unknown>).customFusions
      : undefined
  if (fusionsRaw !== undefined) {
    const vf = validateFusions(fusionsRaw)
    if (vf) {
      style.customFusions = vf.fusions
      repairs.push(...vf.repairs)
    } else {
      style.customFusions = []
      repairs.push("the session's fusion list was not an array and was reset")
    }
  }

  const mode =
    typeof src.geometryMode === "string" && GEOMETRY_MODES.has(src.geometryMode)
      ? (src.geometryMode as GeometryMode)
      : "rod"
  if (src.geometryMode !== undefined && mode !== src.geometryMode) {
    repairs.push(`geometry mode "${String(src.geometryMode)}" is not a mode this build has`)
  }

  const engine = typeof src.engineFamily === "string" && isEngineFamily(src.engineFamily)
    ? (src.engineFamily as EngineFamily)
    : DEFAULT_ENGINE_FAMILY

  const widthSlider = isFiniteNumber(src.widthSlider)
    ? Math.max(0, Math.min(1, src.widthSlider))
    : DEFAULT_WIDTH_SLIDER

  /* THE TAKE. Coerced exactly like `inflateParams` — same walker, same "a key
   * the defaults have and the payload does not keeps the default" — with the
   * union vocabularies declared so a stored `order: "banana"` cannot become the
   * order. The two continuous dials are clamped here rather than left to
   * `buildStrokeSchedule` and `windowAt`, which both clamp their own reads:
   * those keep the RENDER right and would still leave a slider sitting at 5000%
   * and `describeDrawIn` printing "overlap 500000%" at the user.
   *
   * ⚠ THE CLAMPS BUILD A NEW OBJECT RATHER THAN WRITING INTO THE COERCED ONE.
   * `coerceAgainst` returns the DEFAULTS BY REFERENCE when the payload has no
   * such key — which is the common case here, every session written before this
   * field existed — so `drawIn.overlap = …` would assign into the module-level
   * `DRAW_IN_DEFAULTS` that `stroke-schedule.ts` hands to every other consumer.
   * It is a no-op today only because the default is already in range. */
  const unit01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)
  const drawInRead = coerceAgainst(DRAW_IN_DEFAULTS, src.drawIn, new Set(), DRAW_IN_UNIONS, repairs)
  const drawIn: DrawInParams = { ...drawInRead, overlap: unit01(drawInRead.overlap) }
  const windowRead = coerceAgainst(
    REVEAL_WINDOW_DEFAULTS,
    src.revealWindow,
    new Set(),
    REVEAL_WINDOW_UNIONS,
    repairs,
  )
  const revealWindow: RevealWindowParams = { ...windowRead, length: unit01(windowRead.length) }
  /* DRAWIN-CURVE: `ease` is a preset id OR the curve he shaped. The union
   * check below only knows the ids, so a curve is lifted out first, checked
   * here, and put back; a bad one is repaired to linear and SAYS so. */
  const envSrc = src.revealEnvelope as Record<string, unknown> | undefined
  let envCurve: RevealCurve | null = null
  let envelopeSrc: unknown = envSrc
  if (envSrc && typeof envSrc === "object" && envSrc.ease && typeof envSrc.ease === "object") {
    const e = envSrc.ease as Record<string, unknown>
    const c = { x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2 } as RevealCurve
    const ok = ["x1", "y1", "x2", "y2"].every((k) => typeof (c as unknown as Record<string, unknown>)[k] === "number")
    if (ok && curveProblem(c) === null) envCurve = c
    else repairs.push("revealEnvelope.ease: unreadable curve, now linear")
    envelopeSrc = { ...envSrc, ease: "linear" }
  }
  const envelopeRead = coerceAgainst(
    REVEAL_ENVELOPE_DEFAULTS,
    envelopeSrc,
    new Set(),
    REVEAL_ENVELOPE_UNIONS,
    repairs,
  )
  /* A NEW OBJECT, never a write into `envelopeRead` — see the clamp note above.
   * The slider's own range is 0..3; a stored negative would run the delay branch
   * backwards, so it is floored rather than trusted. */
  const revealEnvelope: RevealEnvelopeParams = {
    ...envelopeRead,
    ...(envCurve ? { ease: envCurve } : {}),
    delaySeconds: Number.isFinite(envelopeRead.delaySeconds)
      ? Math.max(0, envelopeRead.delaySeconds)
      : REVEAL_ENVELOPE_DEFAULTS.delaySeconds,
  }
  /* A document from before HAND-DRAW-3 has no `rate` and `coerceAgainst` keeps
   * the default, 1, which is main. A stored rate outside the dial's range would
   * run the clock at a speed nothing can set, so it reads back as 1 with a
   * repair rather than being trusted or clamped quietly. */
  if (!(Number.isFinite(revealEnvelope.rate) && revealEnvelope.rate >= REVEAL_RATE_MIN && revealEnvelope.rate <= REVEAL_RATE_MAX)) {
    repairs.push(`revealEnvelope.rate ${JSON.stringify(revealEnvelope.rate)} is outside ${REVEAL_RATE_MIN} to ${REVEAL_RATE_MAX}, read as 1`)
    revealEnvelope.rate = REVEAL_ENVELOPE_DEFAULTS.rate
  }
  /* DRAWIN-EXTRAS · the tip highlight's slider runs 0..1. A document from
   * before it has none and reads 0, off, which is main. Out of range is
   * clamped and said. */
  if (!(revealEnvelope.tipHighlight >= 0 && revealEnvelope.tipHighlight <= 1)) {
    const v = revealEnvelope.tipHighlight
    revealEnvelope.tipHighlight = v > 1 ? 1 : 0
    repairs.push(`revealEnvelope.tipHighlight ${JSON.stringify(v)} is outside 0 to 1, read as ${revealEnvelope.tipHighlight}`)
  }
  if (!(revealEnvelope.pressureReveal >= 0 && revealEnvelope.pressureReveal <= 1)) {
    const v = revealEnvelope.pressureReveal
    revealEnvelope.pressureReveal = v > 1 ? 1 : 0
    repairs.push(`revealEnvelope.pressureReveal ${JSON.stringify(v)} is outside 0 to 1, read as ${revealEnvelope.pressureReveal}`)
  }
  /* 0 is off. Anything else outside the slider's range would play the drawing
   * at a length nothing can set, so it reads back as off, and says so. */
  const dur = revealEnvelope.durationSeconds
  if (!(dur === 0 || (dur >= DURATION_MIN_SECONDS && dur <= DURATION_MAX_SECONDS))) {
    repairs.push(`revealEnvelope.durationSeconds ${JSON.stringify(dur)} is outside ${DURATION_MIN_SECONDS} to ${DURATION_MAX_SECONDS}, read as off`)
    revealEnvelope.durationSeconds = 0
  }
  /* GATE ONLY. assert-hand-clock.mjs sets this in a must-fail pass to drop the
   * clock on read, so its save-and-reload row can be seen to fail. */
  if (typeof window !== "undefined" && (window as unknown as { __FS_GATE_MUTATE?: string }).__FS_GATE_MUTATE === "clock-not-persisted") {
    revealEnvelope.clock = REVEAL_ENVELOPE_DEFAULTS.clock
  }

  /* A scalar, so it does not go through `coerceAgainst` — that walks an
   * object's keys. Read, checked against the union, and defaulted loudly
   * enough to be repaired rather than silently swallowed. */
  const storedTip = (src as { penTip?: unknown }).penTip
  let penTip: PenTipMode = readPenTipMode()
  if (typeof storedTip === "string" && PEN_TIP_VALUES.has(storedTip)) {
    penTip = storedTip as PenTipMode
  } else if (storedTip !== undefined) {
    repairs.push(`penTip: ${JSON.stringify(storedTip)} is not a pen tip, kept ${penTip}`)
  }

  const flatten: FlatState = coerceAgainst(SOLID_STATE, (src as { flatten?: unknown }).flatten)
  const take = readTake((src as { take?: unknown }).take, repairs)
  const keys = readKeys((src as { keys?: unknown }).keys, repairs)

  const session: SessionDoc = {
    styleState: style,
    geometryMode: mode,
    engineFamily: engine,
    extrudeParams: coerceAgainst(DEFAULT_EXTRUDE_PARAMS, src.extrudeParams),
    widthSlider,
    solidParams: coerceAgainst(DEFAULT_SOLID_PARAMS, src.solidParams),
    inflateParams: coerceAgainst(DEFAULT_INFLATE_PARAMS, src.inflateParams),
    canvas: coerceAgainst(DEFAULT_CANVAS_SETTINGS, src.canvas),
    drawIn,
    revealWindow,
    revealEnvelope,
    take,
    ...(keys ? { keys } : {}),
    penTip,
    flatten,
  }
  return { session, repairs }
}

/**
 * The take's rows, read ROW BY ROW. A row that cannot be read is dropped and
 * named in `repairs`, never coerced into a neutral row: a neutral row is still
 * a row, it turns the timed path on, and it would say "he set this" about a
 * value nobody set. A field that is merely out of range is repaired in place.
 */
const TAKE_EASE_PRESETS = new Set(["linear", "in", "out", "inOut"])
function readTake(raw: unknown, repairs: string[]): StrokeTimingTake {
  if (raw === undefined) return STROKE_TIMING_TAKE_DEFAULTS
  if (!raw || typeof raw !== "object") {
    repairs.push(`take: ${JSON.stringify(raw)} is not a take, read as no rows`)
    return STROKE_TIMING_TAKE_DEFAULTS
  }
  const o = raw as { strokes?: unknown; ripple?: unknown }
  const ripple = o.ripple === true
  if (o.ripple !== undefined && typeof o.ripple !== "boolean") {
    repairs.push(`take.ripple: ${JSON.stringify(o.ripple)} read as off`)
  }
  const strokes: Record<number, StrokeTiming> = {}
  const src = o.strokes && typeof o.strokes === "object" ? (o.strokes as Record<string, unknown>) : {}
  if (o.strokes !== undefined && src !== o.strokes) repairs.push("take.strokes: not an object, no rows")
  for (const key of Object.keys(src)) {
    const i = Number(key)
    const r = src[key] as Record<string, unknown> | null
    if (!Number.isInteger(i) || i < 0 || !r || typeof r !== "object") {
      repairs.push(`take.strokes.${key}: unreadable row, dropped`)
      continue
    }
    const e = r.ease as Record<string, unknown> | undefined
    let ease: StrokeTiming["ease"] | null = null
    if (e && e.kind === "preset" && TAKE_EASE_PRESETS.has(e.id as string)) {
      ease = { kind: "preset", id: e.id as "linear" }
    } else if (e && e.kind === "bezier" && ["x1", "y1", "x2", "y2"].every((k) => Number.isFinite(e[k]))) {
      const c = (n: unknown) => Math.max(0, Math.min(1, n as number))
      ease = { kind: "bezier", x1: c(e.x1), y1: e.y1 as number, x2: c(e.x2), y2: e.y2 as number }
    }
    const speed = r.speed as number
    if (!ease || !(Number.isFinite(speed) && speed > 0) || typeof r.holdBack !== "boolean") {
      repairs.push(`take.strokes.${key}: ${JSON.stringify(r)} is not a timing row, dropped`)
      continue
    }
    let delayMs = r.delayMs as number
    if (!Number.isFinite(delayMs)) {
      repairs.push(`take.strokes.${key}.delayMs: ${JSON.stringify(r.delayMs)} read as 0`)
      delayMs = 0
    }
    strokes[i] = { delayMs, speed, ease, holdBack: r.holdBack }
  }
  return { strokes, ripple }
}

/**
 * The keys, read TRACK BY TRACK. A track `validateTrack` rejects is dropped and
 * every reason it gave goes to `repairs`, named by its property: an unsorted or
 * non-finite track cannot be sampled, and a repaired one would play motion he
 * never keyed. A name that is not a keyable property is named and dropped too.
 * No field is no keys, with nothing to report. What survives is compacted, so
 * a field that ends up empty reads as no keys rather than `{}`.
 */
export function readKeys(raw: unknown, repairs: string[]): TakeKeys | undefined {
  if (raw === undefined) return undefined
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    repairs.push(`keys: ${JSON.stringify(raw)} is not a record of tracks, read as no keys`)
    return undefined
  }
  const kept: TakeKeys = {}
  for (const [name, track] of Object.entries(raw as Record<string, unknown>)) {
    if (!(KEY_PROPERTIES as readonly string[]).includes(name)) {
      repairs.push(`keys.${name}: not a keyable property (${KEY_PROPERTIES.join(", ")}), dropped`)
      continue
    }
    const bad = validateTrack(track, name as KeyProperty)
    if (bad.length) {
      for (const r of bad) repairs.push(`keys.${name} dropped: ${r}`)
      continue
    }
    kept[name as KeyProperty] = track as Track
  }
  return compactKeys(kept)
}

export const sessionSchema: SchemaSpec<SessionDoc> = {
  key: SESSION_KEY,
  kind: "freestroke.session",
  version: 1,
  /* No v0. Nothing has ever been written under this key — the session was never
   * persisted at all, which is the defect this key exists to fix. A bare
   * payload found here did not come from us and is quarantined rather than
   * coerced. */
  migrations: {},
  validate: (data) => {
    const v = validateSession(data)
    if (!v) return null
    return { value: v.session, repairs: v.repairs }
  },
}

export function defaultSession(): SessionDoc {
  return {
    styleState: DEFAULT_STYLE_STATE,
    geometryMode: "rod",
    engineFamily: DEFAULT_ENGINE_FAMILY,
    extrudeParams: DEFAULT_EXTRUDE_PARAMS,
    widthSlider: DEFAULT_WIDTH_SLIDER,
    solidParams: DEFAULT_SOLID_PARAMS,
    inflateParams: DEFAULT_INFLATE_PARAMS,
    canvas: DEFAULT_CANVAS_SETTINGS,
    drawIn: DRAW_IN_DEFAULTS,
    revealWindow: REVEAL_WINDOW_DEFAULTS,
    revealEnvelope: REVEAL_ENVELOPE_DEFAULTS,
    take: STROKE_TIMING_TAKE_DEFAULTS,
    penTip: readPenTipMode(),
    flatten: SOLID_STATE,
  }
}
