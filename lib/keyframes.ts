/* ============================================================================
 * KEYFRAMES: keys and a curve on draw progress, width, depth, turn and camera,
 * on the one clock.
 *
 * His ruling, 2026-09-25 (`docs/rulings/2026-09-25-animation-comes-back.md`):
 * "Keys on draw progress, width, depth, turn and camera, with a curve he
 * shapes between the keys." This is phase 3 of
 * `docs/research-2026-09-25/animation-tools/DESIGN.md`: the model, no UI.
 * Width is phase 3b: a multiplier on the stroke width, 1 = shipped, kept inside
 * `WIDTH_MIN..WIDTH_MAX`. How each engine applies it is `lib/width-keys.ts`.
 *
 * THE ONE CLOCK. Every value is a pure function of the take's `clockMs`, the
 * number `sampleTake` in `lib/stroke-timing.ts` already reads. Nothing here
 * reads wall time, so export asks `sampleKeys(keys, clockMs)` frame by frame
 * and gets what the live view drew.
 *
 * THE CURVE. After Effects' model: a key's out handle and the next key's in
 * handle are the two inner points of one cubic bezier over the span, in the
 * span's own 0..1 box, read in Figma's `x1, y1, x2, y2` order. A new key gets
 * AE's Easy Ease (speed 0 at the key, influence 1/3 each side), which comes out
 * as exactly 3u^2 - 2u^3. `hold` keeps a key's value until the next key;
 * `linear` puts the handle on the diagonal. The bezier itself is
 * `cubicBezierEase` from `lib/hero-motion.ts`, the one the stroke timing uses.
 *
 * NO KEYS, NO CHANGE. A property with no keys samples as `undefined`, which
 * means "the shipped value": the viewport keeps the path it runs today.
 *
 * NEVER DROPPED. An unsorted track, a number that is not finite, or a handle x
 * outside 0..1 is rejected with its reason by `validateTrack`, and the samplers
 * throw on it instead of returning a value that looks right.
 *
 * KEYFRAME ANYTHING (K1, his ruling 2026-09-26, `docs/rulings/2026-09-26.md`).
 * Every numeric style value can hold keys too, named the way preset fields are
 * (`textureSpeed`, `customMaterial.roughness`). `KEYABLE_PATHS` is built by
 * walking `DEFAULT_STYLE_STATE`, and each path's range is its row in
 * `STYLE_RANGES`, the numbers its slider uses. A key outside the range, or a
 * curve that swings outside it between two keys, is refused with its reason,
 * never clamped. `acceptKeys` validates once when keys are written, so the
 * per-frame samplers skip the check for keys it accepted. `styleAt` returns the
 * style with each keyed value sampled and hands back the same object when no
 * style value is keyed. A looping motion keeps its own clock: its phase is
 * `loopPhaseAt`, the running sum of its keyed speed, so a speed key never
 * jumps the loop.
 * ========================================================================== */

import { cubicBezierEase } from "@/lib/hero-motion"
import {
  DEFAULT_STYLE_STATE,
  STYLE_RANGES,
  type StyleNumericPath,
  type StyleRange,
  type StyleState,
} from "@/lib/style-system"

/**
 * `drawProgress` overrides the reveal, 0..1 (see `revealClockMs`). `turn`,
 * `azimuth` and `elevation` are degrees. `depth` is `FlatState.depth`.
 * `distance` is `orbitView`'s third argument, `fillK`. `width` multiplies the
 * stroke width the engine ships, `WIDTH_MIN..WIDTH_MAX`, 1 = unchanged.
 */
export type KeyProperty = "drawProgress" | "depth" | "turn" | "azimuth" | "elevation" | "distance" | "width"

export const KEY_PROPERTIES: readonly KeyProperty[] = [
  "drawProgress",
  "depth",
  "turn",
  "azimuth",
  "elevation",
  "distance",
  "width",
]

/**
 * The width key's range, as a multiplier on the shipped stroke width. Half to
 * double: at the shipped defaults every engine reaches 0.5 inside its own
 * calibrated range, and 2 is where Solid's thickness ceiling sits (44 px
 * effective from 22.6 px, so 1.95); `lib/width-keys.ts` reports that clamp by
 * name instead of hiding it. A key outside this range is refused, never clamped.
 */
export const WIDTH_MIN = 0.5
export const WIDTH_MAX = 2

/** A bezier handle in the span's box: x is time 0..1, y is value (may overshoot). */
export interface Handle {
  x: number
  y: number
}

/** `x1, y1` of the span this key starts. `hold` keeps this key's value to the next. */
export type EaseOut = Handle | "linear" | "hold"
/** `x2, y2` of the span this key ends. */
export type EaseIn = Handle | "linear"

export interface Key {
  tMs: number
  value: number
  easeOut: EaseOut
  easeIn: EaseIn
}

/** Strictly increasing in `tMs`: one key per time. */
export type Track = readonly Key[]

/** A numeric style value that can hold keys: `textureSpeed`, `customMaterial.roughness`. */
export type StyleKeyPath = StyleNumericPath

/** Any name a track can have: the seven take tracks or a numeric style value. */
export type KeyPath = KeyProperty | StyleKeyPath

/** The document field. An absent property has no keys. */
export type TakeKeys = Partial<Record<KeyPath, Track>>

export type KeySample = Record<KeyProperty, number | undefined>

/**
 * After Effects' Easy Ease: speed 0 at the key and influence 33.33% on each
 * side. Bodymovin writes AE's ease as a Lottie bezier with `o.x = influence /
 * 100` and `o.y = speed * influence / 100 * duration / delta`, so speed 0 gives
 * `(1/3, 0)` out and `(2/3, 1)` in.
 */
export const EASE_INFLUENCE = 1 / 3
export const EASY_EASE_OUT: Handle = { x: EASE_INFLUENCE, y: 0 }
export const EASY_EASE_IN: Handle = { x: 1 - EASE_INFLUENCE, y: 1 }
const LINEAR_OUT: Handle = { x: EASE_INFLUENCE, y: EASE_INFLUENCE }
const LINEAR_IN: Handle = { x: 1 - EASE_INFLUENCE, y: 1 - EASE_INFLUENCE }

/** A new key, eased the way AE's Easy Ease eases. The one place the default lives. */
export function makeKey(tMs: number, value: number): Key {
  return { tMs, value, easeOut: EASY_EASE_OUT, easeIn: EASY_EASE_IN }
}

/**
 * The handle the sampler uses for one side of a span, for the curve editor to
 * draw and drag. "linear" is its handle, the one `valueAt` uses. A hold has no
 * handle, so it gives null.
 */
export function handleOf(e: EaseOut | EaseIn, side: "out" | "in"): Handle | null {
  if (e === "hold") return null
  if (e === "linear") return side === "out" ? LINEAR_OUT : LINEAR_IN
  return e
}

/* ---- the key paths ------------------------------------------------------- */

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n)

/** A style value that can hold keys, with the range its slider allows. */
export interface KeyablePath extends StyleRange {
  path: StyleKeyPath
}

/** A style field that cannot hold keys, and why. */
export interface LeftOutPath {
  path: string
  reason: string
}

function walkStyle(): { keyable: KeyablePath[]; leftOut: LeftOutPath[] } {
  const keyable: KeyablePath[] = []
  const leftOut: LeftOutPath[] = []
  const ranges = STYLE_RANGES as Readonly<Record<string, StyleRange | undefined>>
  const seen = new Set<string>()
  const walk = (o: object, prefix: string) => {
    for (const [k, v] of Object.entries(o)) {
      const path = prefix + k
      if (typeof v === "number") {
        seen.add(path)
        const r = ranges[path]
        if (!r) leftOut.push({ path, reason: "a number with no row in STYLE_RANGES, so nothing says what a key may hold" })
        else if (!finite(r.min) || !finite(r.max) || !(r.min < r.max)) {
          leftOut.push({ path, reason: `its STYLE_RANGES row ${r.min}..${r.max} is not a range` })
        } else keyable.push({ path: path as StyleKeyPath, min: r.min, max: r.max, step: r.step })
      } else if (Array.isArray(v)) leftOut.push({ path, reason: "a list, and a list is not one value over time" })
      else if (v !== null && typeof v === "object") walk(v, path + ".")
      else leftOut.push({ path, reason: `a ${v === null ? "null" : typeof v}, not a number` })
    }
  }
  walk(DEFAULT_STYLE_STATE, "")
  for (const path of Object.keys(ranges)) {
    if (!seen.has(path)) leftOut.push({ path, reason: "has a STYLE_RANGES row but no number in DEFAULT_STYLE_STATE to key" })
  }
  return { keyable, leftOut }
}

const WALKED = walkStyle()

/** Every numeric style value that can hold keys, walked from `DEFAULT_STYLE_STATE`. */
export const KEYABLE_PATHS: readonly KeyablePath[] = WALKED.keyable

/** Every style field the walk left out, each with its reason. */
export const STYLE_LEFT_OUT: readonly LeftOutPath[] = WALKED.leftOut

const STYLE_KEY_RANGE: ReadonlyMap<string, KeyablePath> = new Map(KEYABLE_PATHS.map((p) => [p.path, p]))

/** The range a style path's keys must stay in; undefined for the seven take tracks and unknown names. */
export function styleRangeOf(path: string): KeyablePath | undefined {
  return STYLE_KEY_RANGE.get(path)
}

export function isKeyPath(name: string): name is KeyPath {
  return (KEY_PROPERTIES as readonly string[]).includes(name) || STYLE_KEY_RANGE.has(name)
}

/** The speeds that drive a looping motion: every keyable style path named `...Speed`. */
export const LOOP_SPEED_PATHS: readonly StyleKeyPath[] = KEYABLE_PATHS.filter((p) => /Speed$/.test(p.path)).map((p) => p.path)

/**
 * THE KEYABLE PATHS A KEY DOES NOT DRIVE, EACH WITH ITS REASON (K2,
 * BUILD-PLAN.md §4 "How sampling feeds the style" and "Procedural loops").
 *
 * Each is a number with a range, so its keys pass `validateKeys` (K1's
 * contract). But the frame loop (components/viewport-3d.tsx) leaves them out
 * of `styleAt`, and the key button (K3) shows disabled with the reason as its
 * label. His ruling of 2026-09-26: keys drive a loop's speed, amount, contrast
 * and colour, never its phase; a key button that does nothing is a dead dial.
 *
 * Every other keyable path is read inside the frame, on the frame's sample
 * (checked when K2 was built: each path's reads in the viewport, the material
 * written from the frame's base every frame, `resolveStack` and
 * `evaluateFusion` called from the frame with the frame's style).
 */
export const KEY_DISABLED: Readonly<Record<string, string>> = {
  texturePhase: "a loop's phase is never keyed, only its speed, amount, contrast and colour",
  stackAnimationPhase: "a loop's phase is never keyed, only its speed, amount, contrast and colour",
  textureDelay: "a delay moves where the loop starts, so a keyed delay would jump it; key the amount instead",
  ditherDelay: "a delay moves where the loop starts, so a keyed delay would jump it; key the amount instead",
  asciiDelay: "a delay moves where the loop starts, so a keyed delay would jump it; key the amount instead",
  styleLoopSeconds: "the loop's length: a keyed length moves every looping layer to another point in its cycle, a jump",
  stackAnimationSpeed: "the stack's loop still runs as speed times time (lib/style-stack.ts), so a keyed speed would jump it",
  fusionAnimationSpeed: "fusion's drives still run as speed times time (lib/style-fusion.ts), so a keyed speed would jump them",
}

/** `keys` without the paths the frame does not drive (`KEY_DISABLED`); the same object when it has none. */
export function framedKeys(keys: TakeKeys | undefined): TakeKeys | undefined {
  if (!keys || !Object.keys(keys).some((p) => p in KEY_DISABLED)) return keys
  const out: Record<string, unknown> = {}
  for (const [p, t] of Object.entries(keys)) if (!(p in KEY_DISABLED)) out[p] = t
  return out as TakeKeys
}

/* ---- validation ---------------------------------------------------------- */

/**
 * The lowest and highest the span's curve reaches, as a fraction of the step
 * from one key's value to the next. 0 and 1 are the keys; a handle's y outside
 * 0..1 can swing the curve past them. `x(t)` is monotone for handles in 0..1,
 * so the curve's y over t is its y over time.
 */
function spanReach(o: Handle, n: Handle): [number, number] {
  const y = (t: number) => 3 * (1 - t) * (1 - t) * t * o.y + 3 * (1 - t) * t * t * n.y + t * t * t
  let lo = 0
  let hi = 1
  // dy/dt / 3 = a t^2 + b t + c
  const a = o.y - 2 * (n.y - o.y) + (1 - n.y)
  const b = 2 * (n.y - o.y) - 2 * o.y
  const c = o.y
  const roots: number[] = []
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) roots.push(-c / b)
  } else {
    const d = b * b - 4 * a * c
    if (d >= 0) roots.push((-b + Math.sqrt(d)) / (2 * a), (-b - Math.sqrt(d)) / (2 * a))
  }
  for (const t of roots) {
    if (t > 0 && t < 1) {
      lo = Math.min(lo, y(t))
      hi = Math.max(hi, y(t))
    }
  }
  return [lo, hi]
}

/** Why a style track's curve leaves its range between two keys, one reason per span. */
function reachReasons(track: readonly Key[], r: KeyablePath): string[] {
  const out: string[] = []
  for (let i = 0; i + 1 < track.length; i++) {
    const k0 = track[i]
    const k1 = track[i + 1]
    if (k0.easeOut === "hold") continue
    const [lo, hi] = spanReach(k0.easeOut === "linear" ? LINEAR_OUT : k0.easeOut, k1.easeIn === "linear" ? LINEAR_IN : k1.easeIn)
    const a = k0.value + (k1.value - k0.value) * lo
    const b = k0.value + (k1.value - k0.value) * hi
    const low = Math.min(a, b)
    const high = Math.max(a, b)
    const eps = 1e-9 * (r.max - r.min)
    if (low < r.min - eps || high > r.max + eps) {
      const v = low < r.min - eps ? low : high
      out.push(`key ${i} to key ${i + 1}: the curve swings to ${+v.toFixed(4)} between them, outside ${r.min}..${r.max}. Pull its handles in`)
    }
  }
  return out
}

function easeReason(e: unknown, side: "easeOut" | "easeIn", at: string): string | null {
  if (e === "linear") return null
  if (e === "hold") return side === "easeOut" ? null : `${at} easeIn is "hold": a hold belongs on the key it leaves`
  if (!e || typeof e !== "object") return `${at} ${side} is ${String(e)}, not a handle, "linear" or "hold"`
  const { x, y } = e as Handle
  if (!finite(x) || !finite(y)) return `${at} ${side} handle (${x}, ${y}) is not finite`
  if (x < 0 || x > 1) return `${at} ${side} handle x ${x} is outside 0..1: the curve would run back in time`
  return null
}

/** Every reason the track cannot be sampled. Empty means it can. */
export function validateTrack(track: unknown, property?: KeyPath): string[] {
  if (!Array.isArray(track)) return [`track is ${String(track)}, not a list of keys`]
  const range = property === undefined ? undefined : STYLE_KEY_RANGE.get(property)
  const out: string[] = []
  let prevMs = -Infinity
  for (let i = 0; i < track.length; i++) {
    const k = track[i] as Partial<Key> | null
    const at = `key ${i}`
    if (!k || typeof k !== "object") {
      out.push(`${at} is ${String(k)}, not a key`)
      continue
    }
    if (!finite(k.tMs)) out.push(`${at} tMs ${k.tMs} is not a finite number`)
    else {
      if (!(k.tMs > prevMs)) out.push(`${at} at ${k.tMs} ms is not after the key before it at ${prevMs} ms: unsorted`)
      prevMs = k.tMs
    }
    if (!finite(k.value)) out.push(`${at} value ${k.value} is not a finite number`)
    else if (property === "drawProgress" && (k.value < 0 || k.value > 1)) {
      out.push(`${at} drawProgress ${k.value} is outside 0..1`)
    } else if (property === "width" && (k.value < WIDTH_MIN || k.value > WIDTH_MAX)) {
      out.push(`${at} width ${k.value} is outside ${WIDTH_MIN}..${WIDTH_MAX}, a multiplier on the shipped stroke width`)
    } else if (range && (k.value < range.min || k.value > range.max)) {
      out.push(`${at} ${property} ${k.value} is outside ${range.min}..${range.max}, the range its slider allows`)
    }
    for (const r of [easeReason(k.easeOut, "easeOut", at), easeReason(k.easeIn, "easeIn", at)]) if (r) out.push(r)
  }
  if (range && out.length === 0) out.push(...reachReasons(track as readonly Key[], range))
  return out
}

/** Every reason the document field cannot be sampled, each prefixed by its property. */
export function validateKeys(keys: unknown): string[] {
  if (keys === undefined) return []
  if (!keys || typeof keys !== "object" || Array.isArray(keys)) return [`keys is ${String(keys)}, not a record of tracks`]
  const out: string[] = []
  for (const name of Object.keys(keys)) {
    if (!isKeyPath(name)) {
      out.push(`${name}: not a keyable property. Keys go on the seven take tracks (${KEY_PROPERTIES.join(", ")}) or on one of the ${KEYABLE_PATHS.length} numeric style values, such as textureSpeed or customMaterial.roughness`)
      continue
    }
    for (const r of validateTrack((keys as Record<string, unknown>)[name], name)) out.push(`${name}: ${r}`)
  }
  return out
}

/**
 * The field with its empty tracks taken out, and `undefined` when nothing is
 * left, so a doc whose last key was deleted saves as a doc with no keys, never
 * as `keys: {}`. An empty track and an absent one both sample as `undefined`,
 * so nothing a key would do is lost. It only removes empties and never judges a
 * track: run `validateKeys` first, which names anything wrong.
 */
export function compactKeys(keys: TakeKeys | undefined): TakeKeys | undefined {
  if (!keys) return undefined
  const out: Record<string, Track> = {}
  let kept = 0
  for (const [name, track] of Object.entries(keys)) {
    if (track === undefined || (Array.isArray(track) && track.length === 0)) continue
    out[name] = track
    kept++
  }
  return kept ? (out as TakeKeys) : undefined
}

function refuse(bad: string[]): never {
  throw new Error(`keyframes rejected: ${bad.join("; ")}`)
}

/** Key fields `acceptKeys` checked and froze. The samplers trust these and skip the check. */
const ACCEPTED = new WeakSet<object>()

const frozenEase = <E extends EaseOut | EaseIn>(e: E): E => (typeof e === "object" ? (Object.freeze({ x: e.x, y: e.y }) as E) : e)

/**
 * VALIDATE ONCE, ON WRITE. Checks the whole field and throws every reason when
 * anything is wrong, so a bad key is refused where it is written. Returns a
 * frozen copy with empty tracks taken out, `undefined` when nothing is left.
 * Writing into the copy throws, so it can never drift away from what was checked.
 */
export function acceptKeys(keys: unknown): TakeKeys | undefined {
  const bad = validateKeys(keys)
  if (bad.length) refuse(bad)
  const compact = compactKeys(keys as TakeKeys | undefined)
  if (!compact) return undefined
  const out: Record<string, Track> = {}
  for (const [name, track] of Object.entries(compact)) {
    out[name] = Object.freeze(track!.map((k) => Object.freeze({ ...k, easeOut: frozenEase(k.easeOut), easeIn: frozenEase(k.easeIn) })))
  }
  Object.freeze(out)
  ACCEPTED.add(out)
  return out as TakeKeys
}

/** True when `acceptKeys` produced this field. */
export function isAccepted(keys: TakeKeys | undefined): boolean {
  return !!keys && ACCEPTED.has(keys)
}

function checkUnlessAccepted(keys: TakeKeys | undefined) {
  if (keys && ACCEPTED.has(keys)) return
  const bad = validateKeys(keys)
  if (bad.length) refuse(bad)
}

/* ---- sampling ------------------------------------------------------------ */

function valueAt(track: Track, clockMs: number): number | undefined {
  if (track.length === 0) return undefined
  const first = track[0]
  const last = track[track.length - 1]
  if (clockMs <= first.tMs) return first.value
  if (clockMs >= last.tMs) return last.value
  // The last key at or before the clock. At a key's own time u is 0 and the
  // value is that key's, exactly, even straight after a hold.
  let lo = 0
  let hi = track.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (track[mid].tMs <= clockMs) lo = mid
    else hi = mid
  }
  const k0 = track[lo]
  const k1 = track[hi]
  if (k0.easeOut === "hold") return k0.value
  const o = k0.easeOut === "linear" ? LINEAR_OUT : k0.easeOut
  const n = k1.easeIn === "linear" ? LINEAR_IN : k1.easeIn
  const u = (clockMs - k0.tMs) / (k1.tMs - k0.tMs)
  return k0.value + (k1.value - k0.value) * cubicBezierEase(o.x, o.y, n.x, n.y)(u)
}

/**
 * One property's value at `clockMs`. Before the first key it holds the first,
 * after the last it holds the last, and with no keys it is `undefined`: the
 * shipped value. Throws on a track `validateTrack` rejects.
 */
export function sampleTrack(track: Track | undefined, clockMs: number, property?: KeyProperty): number | undefined {
  if (!finite(clockMs)) refuse([`clockMs ${clockMs} is not a finite number`])
  if (track === undefined) return undefined
  const bad = validateTrack(track, property)
  if (bad.length) refuse(bad)
  return valueAt(track, clockMs)
}

/** Every property's value at `clockMs`. Throws on a field `validateKeys` rejects. */
export function sampleKeys(keys: TakeKeys | undefined, clockMs: number): KeySample {
  if (!finite(clockMs)) refuse([`clockMs ${clockMs} is not a finite number`])
  checkUnlessAccepted(keys)
  const out = {} as KeySample
  for (const p of KEY_PROPERTIES) out[p] = keys?.[p] ? valueAt(keys[p]!, clockMs) : undefined
  return out
}

/* ---- keyed style ----------------------------------------------------------- */

function readLeaf(state: StyleState, path: string): number {
  let o: unknown = state
  for (const part of path.split(".")) o = (o as Record<string, unknown>)[part]
  return o as number
}

/**
 * The style at `clockMs`: each keyed style value replaced by its sample, every
 * other value untouched. With no style value keyed it returns `state` itself,
 * so the frame reads exactly what it reads today. Nested objects are copied
 * only where a value inside them is keyed; `state` is never written.
 */
export function styleAt(state: StyleState, keys: TakeKeys | undefined, clockMs: number): StyleState {
  if (!finite(clockMs)) refuse([`clockMs ${clockMs} is not a finite number`])
  if (!keys) return state
  checkUnlessAccepted(keys)
  let out: Record<string, unknown> | null = null
  for (const kp of KEYABLE_PATHS) {
    const track = keys[kp.path]
    if (!track || track.length === 0) continue
    out ??= { ...state }
    const parts = kp.path.split(".")
    let into = out
    let from: Record<string, unknown> = state as unknown as Record<string, unknown>
    for (let i = 0; i < parts.length - 1; i++) {
      const next = from[parts[i]] as Record<string, unknown>
      if (into[parts[i]] === next) into[parts[i]] = { ...next }
      into = into[parts[i]] as Record<string, unknown>
      from = next
    }
    into[parts[parts.length - 1]] = valueAt(track, clockMs)
  }
  return (out as StyleState | null) ?? state
}

/** Simpson's rule over [a, b] of one span's curve, on a fixed 64 steps so a part span meets the whole one exactly. */
function spanArea(track: Track, i: number, a: number, b: number): number {
  const k0 = track[i]
  if (k0.easeOut === "hold") return k0.value * (b - a)
  const N = 64
  const h = (b - a) / N
  let sum = valueAt(track, a)! + valueAt(track, b)!
  for (let j = 1; j < N; j++) sum += (j % 2 ? 4 : 2) * valueAt(track, a + j * h)!
  return (sum * h) / 3
}

/** The area under a track from its first key to `t`, `t` at or after the first key. */
function areaFromFirst(track: Track, t: number): number {
  let area = 0
  for (let i = 0; i + 1 < track.length; i++) {
    const a = track[i].tMs
    const b = track[i + 1].tMs
    if (t <= a) break
    area += spanArea(track, i, a, Math.min(t, b))
  }
  const last = track[track.length - 1]
  if (t > last.tMs) area += last.value * (t - last.tMs)
  return area
}

/**
 * A looping motion's phase at `clockMs`, in seconds at 1x: the running sum of
 * its speed from clock 0. Unkeyed, that is the speed times the time, the
 * number the loop runs on today. Keyed, it is the area under the speed curve,
 * so a speed key changes how fast the loop turns and never where it is: no
 * frame jumps. Before the first key the speed holds the first key's value.
 */
export function loopPhaseAt(state: StyleState, keys: TakeKeys | undefined, speedPath: StyleKeyPath, clockMs: number): number {
  if (!finite(clockMs)) refuse([`clockMs ${clockMs} is not a finite number`])
  if (!LOOP_SPEED_PATHS.includes(speedPath)) refuse([`${speedPath} is not a loop speed (${LOOP_SPEED_PATHS.join(", ")})`])
  checkUnlessAccepted(keys)
  const track = keys?.[speedPath]
  if (!track || track.length === 0) return (readLeaf(state, speedPath) * clockMs) / 1000
  // F(t) is the signed area from the first key to t; before the first key the
  // speed holds the first value. The phase is the area from 0 to the clock.
  const first = track[0]
  const F = (t: number) => (t >= first.tMs ? areaFromFirst(track, t) : first.value * (t - first.tMs))
  return (F(clockMs) - F(0)) / 1000
}

/**
 * The longest step of the key clock, in ms, that a frame's loop speed is read
 * as the mean over: a quarter second covers a slow frame at 4x. A longer step
 * is a scrub or a seek, not a frame, and reads the speed at its end.
 */
export const LOOP_STEP_MAX_MS = 250

/**
 * THE SPEED A LOOP RUNS AT OVER ONE FRAME, READ THROUGH `loopPhaseAt`. The key
 * clock moved from `fromMs` to `toMs` this frame; the loop advances by this
 * speed times its own clock's step. It is the mean of the keyed speed over the
 * key clock's step, `(loopPhaseAt(to) - loopPhaseAt(from)) / step`, so the loop
 * travels exactly the area under its speed curve however the frames fall: a
 * held speed that steps from 1 to 3 inside a frame moves the loop by 1 for the
 * part before the step and 3 for the part after, never by 3 for the whole
 * frame. Paused, scrubbed back, wrapped or seeked (a step that is not forward
 * or longer than `LOOP_STEP_MAX_MS`), it is the speed at `toMs`. Unkeyed it is
 * the doc's speed, exactly.
 */
export function loopSpeedOver(
  state: StyleState,
  keys: TakeKeys | undefined,
  speedPath: StyleKeyPath,
  fromMs: number,
  toMs: number,
): number {
  const track = keys?.[speedPath]
  if (!track || track.length === 0) return readLeaf(state, speedPath)
  const step = toMs - fromMs
  if (!(step > 0) || step > LOOP_STEP_MAX_MS || !finite(fromMs)) return valueAt(track, toMs)!
  return ((loopPhaseAt(state, keys, speedPath, toMs) - loopPhaseAt(state, keys, speedPath, fromMs)) * 1000) / step
}

/* ---- how drawProgress meets the stroke timing ---------------------------- */

/**
 * THE RULE: a `drawProgress` key REMAPS the take's clock. It does not multiply
 * the reveal.
 *
 * With the key at `p`, the reveal reads the take at `p * takeMs`, the frame the
 * take would show at that fraction of its length, per-stroke delays, speeds,
 * eases and hold back included. This is After Effects' Time Remapping. Two keys
 * at 0.4 hold that frame for as long as they span, then the next key finishes
 * it. Multiplying could not: the reveal under the key keeps growing through
 * the hold, so `0.4 * reveal(clock)` keeps drawing, and it cuts every stroke to
 * 40% at once instead of showing the drawing at 40%.
 *
 * `p` is clamped to 0..1 because a handle's y may overshoot and a drawing
 * cannot be more than whole. No drawProgress keys returns `clockMs` itself, so
 * the take's own mapping runs unchanged. Camera, depth and turn keep reading
 * `clockMs`, so the camera can move while the drawing holds.
 */
export function revealClockMs(keys: TakeKeys | undefined, clockMs: number, takeMs: number): number {
  const p = sampleTrack(keys?.drawProgress, clockMs, "drawProgress")
  if (p === undefined) return clockMs
  return (p < 0 ? 0 : p > 1 ? 1 : p) * takeMs
}

/**
 * The last key's time on any track, style tracks included, 0 with none. The timeline and export run
 * `max(takeMs, keysEndMs(keys))`, or a hold that pushes the finish past the
 * pen's end never plays its finish.
 */
export function keysEndMs(keys: TakeKeys | undefined): number {
  let end = 0
  if (keys) {
    for (const t of Object.values(keys)) {
      if (t && t.length) end = Math.max(end, t[t.length - 1].tMs)
    }
  }
  return end
}
