/* ============================================================================
 * WIDTH KEYS: how a sampled `width` key reaches each engine's geometry.
 *
 * Phase 3b of `docs/research-2026-09-25/animation-tools/DESIGN.md`. A width key
 * (`lib/keyframes.ts`) is a multiplier on the stroke width the engine ships,
 * `WIDTH_MIN..WIDTH_MAX`, 1 = unchanged. This file turns that number into the
 * one input each engine already has for width. It adds no engine code.
 *
 *   Rod      PER FRAME, no rebuild. A Rod tube is a `THREE.TubeGeometry`, whose
 *            every vertex is `centre + TUBE_RADIUS * normal`, so moving each
 *            vertex `(w - 1) * TUBE_RADIUS` along its own normal IS the tube at
 *            radius `w * TUBE_RADIUS`. Cap and joint spheres scale by `w` about
 *            their centres. The viewport can do this on the CPU from a kept copy
 *            (`widenAlongNormals`) or as a vertex-shader uniform, same formula.
 *   Inflate  REBUILD with `nibWeight * w`. The nib map already multiplies the
 *            field radius on both axes and leaves Z alone (`inflateResolveNib`).
 *   Extrude  REBUILD with `width * w`, kept inside the slider's own range
 *            (`EXTRUDE_WIDTH_MIN..MAX`), and `depth / w`, because Extrude's
 *            depth is a multiple of its width: without it a width key would
 *            also deepen the mark, which is the depth key's job.
 *   Solid    REBUILD with the thickness slider value whose calibrated px is
 *            `w` times today's, found on `computeSolidEffectiveThicknessPx`
 *            itself (no copy of its curve). Its ceiling is 44 px effective, so
 *            from the default 38 (22.6 px) it reaches 1.95, and says so.
 *
 * WIDTH 1 IS TODAY. `w === 1` and "no width keys" both return the caller's own
 * params object, untouched, and `widenAlongNormals` copies bits at offset 0
 * (adding 0 would turn a -0 into +0). `assert-width-keys.mjs` proves the build
 * is byte-identical to shipped on all four engines, 120 hero frames each.
 *
 * NEVER SILENT. A width the engine cannot reach comes back with `reached` (the
 * multiplier it did reach) and `clamp` (why), never as a quietly smaller mark.
 *
 * THE ONE CLOCK. Every value here is a function of the take's `clockMs`. The
 * rebuild throttle is a step on that clock, not on wall time, so export asks the
 * same questions frame by frame and gets the frames the live view drew.
 * ========================================================================== */

import {
  computeSolidEffectiveThicknessPx,
  EXTRUDE_WIDTH_MAX,
  EXTRUDE_WIDTH_MIN,
  INFLATE_NIB_WEIGHT_DEFAULT,
  SOLID_THICKNESS_SLIDER_MAX,
  SOLID_THICKNESS_SLIDER_MIN,
  TUBE_RADIUS,
  type ExtrudeParams,
  type GeometryMode,
  type InflateParams,
  type PreviewParams,
  type SolidParams,
} from "@/lib/geometry-engines"
import { sampleTrack, WIDTH_MAX, WIDTH_MIN, type TakeKeys, type Track } from "@/lib/keyframes"

/* ---- the sampled value --------------------------------------------------- */

/**
 * The width multiplier at `clockMs`, or `undefined` with no width keys (the
 * shipped path). Clamped to `WIDTH_MIN..WIDTH_MAX` because a handle's y may
 * overshoot between two keys that are each in range. Throws, with the reason,
 * on a track `validateTrack` rejects.
 */
export function widthAt(keys: TakeKeys | undefined, clockMs: number): number | undefined {
  const w = sampleTrack(keys?.width, clockMs, "width")
  if (w === undefined) return undefined
  return w < WIDTH_MIN ? WIDTH_MIN : w > WIDTH_MAX ? WIDTH_MAX : w
}

/* ---- the rebuild throttle ------------------------------------------------ */

/** Which engines follow width every frame and which rebuild for it. */
export const WIDTH_APPLY: Readonly<Record<GeometryMode, "per-frame" | "rebuild">> = {
  rod: "per-frame",
  inflate: "rebuild",
  extrude: "rebuild",
  solid: "rebuild",
}

/**
 * A rebuilding engine builds width at most once per this many ms of the take's
 * clock. 1000 / 30: DESIGN.md's "at twos" on a 60 Hz display. The numbers
 * behind it are in the F118 ANIM-3C-W note in `docs/RUN-QUEUE.md`.
 */
export const WIDTH_REBUILD_STEP_MS = 1000 / 30

/**
 * Per engine, from the ANIM-3C-W2 bench (hero, mean / p95 ms): Extrude 0.8 / 1.6 and Solid 3.6 / 7.7
 * fit a 16.7 ms frame, so they build at twos. Inflate is 88 to 107 / 174 to 217 and already builds in
 * a worker (`lib/implicit-defer.ts`), so its step is one worker build, or rebuilds would queue.
 * Rod never rebuilds: its width is applied per frame on the built tube.
 */
export const WIDTH_REBUILD_STEP_BY_MODE: Record<Exclude<GeometryMode, "rod">, number> = {
  extrude: WIDTH_REBUILD_STEP_MS,
  solid: WIDTH_REBUILD_STEP_MS,
  inflate: 250,
}

/**
 * The clock whose width a rebuilding engine builds at `clockMs`: the last step
 * boundary at or before it, or the last width key at or before it if that is
 * later. Snapping to keys is what makes the throttle unable to skip a key's
 * value, and the final one above all: at or after the last key the build clock
 * is at or after that key, where the track holds its last value.
 */
export function widthBuildClockMs(track: Track | undefined, clockMs: number, stepMs = WIDTH_REBUILD_STEP_MS): number {
  let c = Math.floor(clockMs / stepMs) * stepMs
  if (track) {
    for (const k of track) {
      if (k.tMs > clockMs) break
      if (k.tMs > c) c = k.tMs
    }
  }
  return c
}

/**
 * The width `mode` should show at `clockMs`: every frame for Rod, on the
 * throttle's build clock for the three that rebuild. `undefined` with no width
 * keys. A rebuilding engine rebuilds only when this differs from the width it
 * last built, so a hold between two equal keys, and everything after the last
 * key, costs no rebuild at all.
 */
export function widthForFrame(mode: GeometryMode, keys: TakeKeys | undefined, clockMs: number): number | undefined {
  if (WIDTH_APPLY[mode] === "per-frame") return widthAt(keys, clockMs)
  const step = WIDTH_REBUILD_STEP_BY_MODE[mode as Exclude<GeometryMode, "rod">] ?? WIDTH_REBUILD_STEP_MS
  return widthAt(keys, widthBuildClockMs(keys?.width, clockMs, step))
}

/* ---- the rebuilding engines ---------------------------------------------- */

/** An engine's params at a width, what it reached, and why if that is short. */
export interface AtWidth<P> {
  params: P
  /** The multiplier the engine will draw, 1 = shipped. Equals `w` unless clamped. */
  reached: number
  /** Why `reached` is not `w`, or `null` when it is. */
  clamp: string | null
}

const same = <P>(params: P): AtWidth<P> => ({ params, reached: 1, clamp: null })

/** Inflate: the field radius, as the nib's overall weight. No ceiling. */
export function inflateParamsAtWidth(p: InflateParams, w: number | undefined): AtWidth<InflateParams> {
  if (w === undefined || w === 1) return same(p)
  return { params: { ...p, nibWeight: (p.nibWeight ?? INFLATE_NIB_WEIGHT_DEFAULT) * w }, reached: w, clamp: null }
}

/** Extrude: the ribbon half-width inside the slider's range, world depth held. */
export function extrudeParamsAtWidth(p: ExtrudeParams, w: number | undefined): AtWidth<ExtrudeParams> {
  if (w === undefined || w === 1) return same(p)
  const want = p.width * w
  const width = want < EXTRUDE_WIDTH_MIN ? EXTRUDE_WIDTH_MIN : want > EXTRUDE_WIDTH_MAX ? EXTRUDE_WIDTH_MAX : want
  const reached = width / p.width
  const clamp =
    width === want
      ? null
      : `Extrude half-width ${want.toFixed(4)} is outside the slider's ${EXTRUDE_WIDTH_MIN}..${EXTRUDE_WIDTH_MAX}; drawn at ${width} (${reached.toFixed(3)}x)`
  return { params: { ...p, width, depth: p.depth / reached }, reached, clamp }
}

/**
 * Solid: the slider value whose calibrated px is `w` times today's. The curve
 * is monotonic on the slider's range, so bisection on the engine's own
 * `computeSolidEffectiveThicknessPx` finds it to 1e-9 px in 60 steps.
 */
export function solidParamsAtWidth(p: SolidParams, w: number | undefined): AtWidth<SolidParams> {
  if (w === undefined || w === 1) return same(p)
  const px = computeSolidEffectiveThicknessPx
  const base = px(p.thickness)
  const lo = px(SOLID_THICKNESS_SLIDER_MIN)
  const hi = px(SOLID_THICKNESS_SLIDER_MAX)
  const want = base * w
  const target = want < lo ? lo : want > hi ? hi : want
  let a = SOLID_THICKNESS_SLIDER_MIN
  let b = SOLID_THICKNESS_SLIDER_MAX
  for (let i = 0; i < 60 && b - a > 1e-12; i++) {
    const m = (a + b) / 2
    if (px(m) < target) a = m
    else b = m
  }
  const thickness = target === hi ? SOLID_THICKNESS_SLIDER_MAX : target === lo ? SOLID_THICKNESS_SLIDER_MIN : (a + b) / 2
  const reached = px(thickness) / base
  const clamp =
    target === want
      ? null
      : `Solid thickness ${want.toFixed(2)} px is past its calibrated ${lo}..${hi} px, where counters collapse; drawn at ${px(thickness).toFixed(2)} px (${reached.toFixed(3)}x)`
  return { params: { ...p, thickness }, reached, clamp }
}

/**
 * The params `mode` builds with at width `w`. Rod's come back untouched: its
 * width is applied per frame on the built tube, never by a rebuild.
 */
function assertWidthInRange(w: number, where: string): void {
  if (!(w >= WIDTH_MIN && w <= WIDTH_MAX)) throw new Error(`${where}: width ${w} is outside ${WIDTH_MIN}..${WIDTH_MAX}`)
}

export function previewParamsAtWidth(mode: GeometryMode, params: PreviewParams, w: number | undefined): AtWidth<PreviewParams> {
  if (w !== undefined) assertWidthInRange(w, "previewParamsAtWidth")
  if (w === undefined || w === 1 || mode === "rod") return same(params)
  if (mode === "inflate") {
    const r = inflateParamsAtWidth(params.inflateParams ?? ({} as InflateParams), w)
    return { params: { ...params, inflateParams: r.params }, reached: r.reached, clamp: r.clamp }
  }
  if (mode === "extrude") {
    if (!params.extrudeParams) throw new Error("previewParamsAtWidth: Extrude has no extrudeParams to widen")
    const r = extrudeParamsAtWidth(params.extrudeParams, w)
    return { params: { ...params, extrudeParams: r.params }, reached: r.reached, clamp: r.clamp }
  }
  if (!params.solidParams) throw new Error("previewParamsAtWidth: Solid has no solidParams to widen")
  const r = solidParamsAtWidth(params.solidParams, w)
  return { params: { ...params, solidParams: r.params }, reached: r.reached, clamp: r.clamp }
}

/* ---- Rod, per frame ------------------------------------------------------ */

/** How far each Rod tube vertex moves along its normal at width `w`. */
export function rodNormalOffset(w: number | undefined): number {
  if (w !== undefined) assertWidthInRange(w, "rodNormalOffset")
  return w === undefined || w === 1 ? 0 : (w - 1) * TUBE_RADIUS
}

/**
 * `out = base + offset * normal`, per vertex, allocation-free. `base` is the
 * position buffer as built, kept once per built geometry. At offset 0 it copies
 * bits, so width 1 is the built tube exactly. Cost is one pass over the
 * vertices plus the position upload; the F118 note has the hero numbers.
 */
export function widenAlongNormals(base: Float32Array, normal: ArrayLike<number>, offset: number, out: Float32Array): Float32Array {
  if (base.length !== normal.length || out.length !== base.length) {
    throw new Error(`widenAlongNormals: ${base.length} positions, ${normal.length} normals, ${out.length} out: they must match`)
  }
  if (offset === 0) {
    if (out !== base) out.set(base)
    return out
  }
  for (let i = 0; i < base.length; i++) out[i] = base[i] + offset * normal[i]
  return out
}
