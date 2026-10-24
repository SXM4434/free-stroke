/**
 * LANDING MOTION · what a stroke does after it lands (PERSTROKE, 2026-10-02).
 *
 * Coverage item 9 (rows 54, 55, 58) and plan section 3d
 * (`docs/research-2026-09-26/animation-panel-and-sequences-plan.md`): settle,
 * wobble, a completion pulse, and Desk Doodles' landing spring, each a small
 * transform per stroke that starts when that stroke's ink is whole and ends
 * at rest. The prefix reveal cannot express any of them (the note above
 * `GEOMETRY_ANIMATION_PRESET_DEFS` in `lib/style-system.ts`), because a prefix
 * only decides WHICH triangles draw, never WHERE. This file is the math only,
 * no React and no three.js; `components/viewport-3d.tsx` reads it per frame
 * and writes the pose onto each stroke's group.
 *
 * NO NUMBER HERE IS RETYPED. Every curve and constant is imported from the
 * place the lab or the register already keeps it:
 *
 *   spring  `DESK_DOODLES.motion` (lib/registers.ts): `settleFrom`, `settleMs`,
 *           `staggerMs` and the `ease` string, parsed and run through
 *           `cubicBezierEase` (lib/flip-pose.ts), the evaluator the lab's flip
 *           curve already uses. The only two numbers that are not in the repo
 *           are dd-land's middle keyframe, 1.015 at 62 %, quoted by the plan
 *           from Desk Doodles' `DeskPage.tsx:2728-2737`; they are the two
 *           `DD_LAND_*` constants below and nowhere else.
 *   settle  the lab's pop-in (lib/hero-motion.ts, `popScale`, `popSettleSec`
 *           and `easeOutStrong`), pinned to the mark's contact as the lab pins
 *           its own, so the form settles ONTO the page.
 *   pulse   `pulseEnvelope` and its constants (lib/style-clock.ts), the one
 *           envelope both completion pulses already share.
 *   wobble  the only new curve: a sine under a squared decay, so it leaves the
 *           landing at rest and arrives at rest with no velocity.
 *
 * OFF IS THE ABSENCE OF ALL OF IT. `isLandingOn` is false for "off" and for a
 * zero amount, and the viewport never touches a group while it is false, so
 * the frame is the one main draws.
 */
import { clamp01, cubicBezierEase, DEG } from "./flip-pose"
import { DEFAULT_HERO_MOTION, easeOutStrong } from "./hero-motion"
import { pulseEnvelope, PULSE_ATTACK_SECONDS, PULSE_CUTOFF, PULSE_LIFETIME } from "./style-clock"
import { DESK_DOODLES } from "./registers"

/* ---- the parameters ------------------------------------------------------ */

export type LandingEffect = "off" | "spring" | "settle" | "wobble" | "pulse"
/** `stroke`: each stroke on its own landing. `mark`: the whole mark as one,
 *  when the last stroke lands, which is what "on completion" means. */
export type LandingScope = "stroke" | "mark"

export interface LandingParams {
  effect: LandingEffect
  scope: LandingScope
  /**
   * How far from rest, in the effect's own unit: spring, settle and pulse in
   * scale (0.08 = 8 %), wobble in degrees.
   */
  amount: number
  /** Seconds from the landing to rest. */
  durationSec: number
  /** Least gap between two units' starts, ms. Landings already further apart
   *  than this are not moved; landings closer together ripple out. */
  staggerMs: number
}

export const LANDING_EFFECTS: LandingEffect[] = ["off", "spring", "settle", "wobble", "pulse"]
export const LANDING_SCOPES: LandingScope[] = ["stroke", "mark"]

/**
 * DESK DOODLES' dd-land, the middle keyframe. Its first and last keyframes
 * (0.92 and 1) and its curve and length are `DESK_DOODLES.motion`; these two
 * are the overshoot the register does not carry.
 */
export const DD_LAND_PEAK = 1.015
export const DD_LAND_PEAK_AT = 0.62

/**
 * A CSS `cubic-bezier(x1, y1, x2, y2)` string as the curve it names, through
 * `cubicBezierEase`. The register stores its ease as the CSS string the Desk
 * Doodles app writes, so the spring reads that string rather than a copy of
 * its four numbers. Anything else is an error, not a guess.
 */
export function easeOfCss(css: string): (t: number) => number {
  const m = /^\s*cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)\s*$/.exec(css)
  if (!m) throw new Error(`easeOfCss: not a cubic-bezier: ${css}`)
  const [x1, y1, x2, y2] = m.slice(1, 5).map(Number)
  return cubicBezierEase(x1, y1, x2, y2)
}

/** dd-land's curve, applied per keyframe segment as CSS applies it. */
export const ddLandEase = easeOfCss(DESK_DOODLES.motion.ease)

/** How many full swings the wobble makes before it dies out. */
export const WOBBLE_CYCLES = 2

/** What each effect starts from when it is picked. `off` has none. */
export const LANDING_EFFECT_DEFAULTS: Record<Exclude<LandingEffect, "off">, Pick<LandingParams, "amount" | "durationSec" | "staggerMs">> = {
  spring: {
    amount: 1 - DESK_DOODLES.motion.settleFrom,
    durationSec: DESK_DOODLES.motion.settleMs / 1000,
    staggerMs: DESK_DOODLES.motion.staggerMs,
  },
  settle: {
    amount: 1 - DEFAULT_HERO_MOTION.popScale,
    durationSec: DEFAULT_HERO_MOTION.popSettleSec,
    staggerMs: 0,
  },
  wobble: { amount: 4, durationSec: 0.8, staggerMs: 0 },
  pulse: { amount: 0.06, durationSec: PULSE_LIFETIME, staggerMs: 0 },
}

export const LANDING_DEFAULTS: LandingParams = {
  effect: "off",
  scope: "stroke",
  ...LANDING_EFFECT_DEFAULTS.spring,
}

/** The params an effect pick writes: the effect, its own defaults, the scope kept. */
export function landingFor(effect: LandingEffect, scope: LandingScope = "stroke"): LandingParams {
  if (effect === "off") return { ...LANDING_DEFAULTS, scope }
  return { effect, scope, ...LANDING_EFFECT_DEFAULTS[effect] }
}

/** Ranges the controls offer and the session validator holds. */
export const LANDING_LIMITS = {
  amount: { spring: [0, 0.3], settle: [0, 0.4], wobble: [0, 20], pulse: [0, 0.4] },
  durationSec: [0.1, 3],
  staggerMs: [0, 200],
} as const

/** A stored value, read back to a whole `LandingParams`, or null for Off. */
export function resolveLanding(v: Partial<LandingParams> | null | undefined): LandingParams | null {
  if (!v || typeof v !== "object") return null
  const effect = LANDING_EFFECTS.includes(v.effect as LandingEffect) ? (v.effect as LandingEffect) : "off"
  if (effect === "off") return null
  const d = LANDING_EFFECT_DEFAULTS[effect]
  const num = (x: unknown, lo: number, hi: number, dflt: number) =>
    typeof x === "number" && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : dflt
  const [aLo, aHi] = LANDING_LIMITS.amount[effect]
  return {
    effect,
    scope: v.scope === "mark" ? "mark" : "stroke",
    amount: num(v.amount, aLo, aHi, d.amount),
    durationSec: num(v.durationSec, LANDING_LIMITS.durationSec[0], LANDING_LIMITS.durationSec[1], d.durationSec),
    staggerMs: num(v.staggerMs, LANDING_LIMITS.staggerMs[0], LANDING_LIMITS.staggerMs[1], d.staggerMs),
  }
}

export function isLandingOn(p: LandingParams | null | undefined): p is LandingParams {
  return !!p && p.effect !== "off" && p.amount > 0 && p.durationSec > 0
}

/* ---- the pose ------------------------------------------------------------ */

/** Where a pose turns and scales about: the unit's centre, or the middle of
 *  its lowest edge (the lab's contact, `c.y = box.min.y`). */
export type LandingPivot = "centre" | "contact"

export interface LandingPose {
  /** Uniform scale. */
  scale: number
  /** Turn about the view axis, radians. */
  rotZ: number
  pivot: LandingPivot
}

export const LANDING_REST: LandingPose = { scale: 1, rotZ: 0, pivot: "centre" }

/**
 * THE POSE `tSec` after a unit lands. Before the landing (`tSec < 0`) it is the
 * landing pose, held, so a stroke that will spring draws at the spring's first
 * frame and nothing jumps when its ink closes. At and after `durationSec` it
 * is exactly rest. Reduced motion is rest throughout: dd-land keeps its fade
 * and drops its scale under reduced motion, and a stroke has no fade to keep.
 */
export function landingPose(p: LandingParams, tSec: number, reduced = false): LandingPose {
  if (!isLandingOn(p) || reduced || Number.isNaN(tSec)) return LANDING_REST
  const dur = p.durationSec
  if (tSec >= dur) return p.effect === "settle" ? { ...LANDING_REST, pivot: "contact" } : LANDING_REST
  const u = clamp01(tSec / dur)
  const a = p.amount
  switch (p.effect) {
    case "spring": {
      // The keyframes 0 % / 62 % / 100 %, each segment on dd-land's own curve,
      // the way a CSS animation-timing-function runs per keyframe interval.
      // The overshoot scales with the amount, so the default is dd-land exactly.
      const from = 1 - a
      const peak = 1 + (DD_LAND_PEAK - 1) * (a / LANDING_EFFECT_DEFAULTS.spring.amount)
      const scale =
        u < DD_LAND_PEAK_AT
          ? from + (peak - from) * ddLandEase(u / DD_LAND_PEAK_AT)
          : peak + (1 - peak) * ddLandEase((u - DD_LAND_PEAK_AT) / (1 - DD_LAND_PEAK_AT))
      return { scale, rotZ: 0, pivot: "centre" }
    }
    case "settle":
      // The lab's pop-in: `popScale + (1 - popScale) * easeOutStrong(u)`.
      return { scale: 1 - a * (1 - easeOutStrong(u)), rotZ: 0, pivot: "contact" }
    case "wobble": {
      const v = 1 - u
      return { scale: 1, rotZ: a * DEG * Math.sin(2 * Math.PI * WOBBLE_CYCLES * u) * v * v, pivot: "centre" }
    }
    case "pulse": {
      // The shared envelope run over `durationSec` instead of its own lifetime,
      // and lifted off its cutoff so the swell meets rest at the end instead of
      // dropping the last 4 % in one frame.
      const env = pulseEnvelope(u * PULSE_LIFETIME)
      return { scale: 1 + a * Math.max(0, (env - PULSE_CUTOFF) / (1 - PULSE_CUTOFF)), rotZ: 0, pivot: "centre" }
    }
  }
  return LANDING_REST
}

/** Seconds after the landing where the effect is furthest from rest, as stated
 *  for each: spring at dd-land's 62 % keyframe, pulse at the envelope's attack,
 *  settle at the landing itself. The wobble's is in its first quarter swing. */
export function landingPeakSec(p: LandingParams): number {
  switch (p.effect) {
    case "spring":
      return DD_LAND_PEAK_AT * p.durationSec
    case "pulse":
      return (PULSE_ATTACK_SECONDS / PULSE_LIFETIME) * p.durationSec
    case "wobble":
      return p.durationSec / (4 * WOBBLE_CYCLES)
    default:
      return 0
  }
}

export function isRestPose(q: LandingPose): boolean {
  return q.scale === 1 && q.rotZ === 0
}

/* ---- the pose as a transform ---------------------------------------------- */

export interface LandingBox {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

export function pivotPoint(box: LandingBox, kind: LandingPivot): [number, number, number] {
  const cx = (box.minX + box.maxX) / 2
  const cz = (box.minZ + box.maxZ) / 2
  return [cx, kind === "contact" ? box.minY : (box.minY + box.maxY) / 2, cz]
}

/**
 * The translation that makes `T * Rz * S` hold `pivot` still, which is what
 * an Object3D's position has to be for its scale and turn to happen about that
 * point rather than about the origin. Rest gives exactly 0.
 */
export function poseOffset(q: LandingPose, pivot: readonly [number, number, number]): [number, number, number] {
  if (isRestPose(q)) return [0, 0, 0]
  const c = Math.cos(q.rotZ)
  const s = Math.sin(q.rotZ)
  const [px, py, pz] = pivot
  return [
    px - q.scale * (c * px - s * py),
    py - q.scale * (s * px + c * py),
    pz - q.scale * pz,
  ]
}

/* ---- when each unit starts -------------------------------------------------- */

/**
 * Each unit's start, ms, from its landing. Units are taken in landing order
 * (ties by index) and none starts sooner than `staggerMs` after the one before,
 * Desk Doodles' 40 to 60 ms ripple. Landings already further apart are not
 * moved, so a drawing that lands stroke by stroke keeps its own rhythm.
 */
export function landingStarts(landMs: ArrayLike<number>, staggerMs: number): Float64Array {
  const n = landMs.length
  const out = new Float64Array(n)
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => landMs[a] - landMs[b] || a - b)
  let prev = -Infinity
  for (const i of order) {
    const s = Math.max(landMs[i], prev + Math.max(0, staggerMs))
    out[i] = s
    prev = s
  }
  return out
}

/**
 * How far past the take the transport has to run so the last unit reaches
 * rest. Conservative: it assumes every unit lands at the take's end and
 * ripples, so it never cuts a spring short. 0 when off.
 */
export function landingTailMs(p: LandingParams | null | undefined, unitCount: number): number {
  if (!isLandingOn(p)) return 0
  const units = p.scope === "mark" ? 1 : Math.max(1, unitCount)
  return p.durationSec * 1000 + Math.max(0, p.staggerMs) * (units - 1)
}

/**
 * The smallest `p` in [0, 1] where a non-decreasing `f` reaches `target`, by
 * bisection. The viewport's reveal is a function of the playhead with flats in
 * it (a pen lift holds the reveal still), and the landing is the FIRST moment
 * the stroke's end is reached, not anywhere on the flat after it.
 */
export function firstReach(f: (p: number) => number, target: number, iters = 40): number {
  if (f(0) >= target) return 0
  if (!(f(1) >= target)) return 1
  let lo = 0
  let hi = 1
  for (let i = 0; i < iters; i++) {
    const mid = (lo + hi) / 2
    if (f(mid) >= target) hi = mid
    else lo = mid
  }
  return hi
}

/* ---- which stroke a mesh is ---------------------------------------------- */

/** A mesh built from the whole mark at once. */
const FUSED_KEY = /^(?:solid-|dd-solid-|inflate-implicit-|inflate-fallback-)/
/** A mesh built from one stroke, with that stroke's index in the list the
 *  engine was handed: Rod and Extrude `stroke-<i>-`, Inflate's loft
 *  `inflate-svfi-<i>-`, Desk Doodles `dd-<mode>-<i>-`. */
const STROKE_KEY = /^(?:stroke|inflate-svfi|dd-[a-z]+)-(\d+)-/

/** The per-stroke index a mesh key carries, or null for a fused mesh. */
export function meshStrokeOf(key: string): number | null {
  if (FUSED_KEY.test(key)) return null
  const m = STROKE_KEY.exec(key)
  return m ? Number(m[1]) : null
}

/** `meshUnits` value for a mesh that is the whole mark. */
export const UNIT_MARK = -1
/** `meshUnits` value for a mesh that cannot be placed; it is left at rest. */
export const UNIT_NONE = -2

/**
 * The stroke each mesh draws. `pieces` maps the engine's own list back to the
 * strokes when the engine was handed a clipped list (Solid, Extrude and the
 * Inflate loft rebuild from the strokes the reveal has reached, in as-drawn
 * order); null means it was handed every stroke.
 */
export function meshUnits(keys: readonly string[], strokeCount: number, pieces: ArrayLike<number> | null): Int32Array {
  const out = new Int32Array(keys.length)
  for (let mi = 0; mi < keys.length; mi++) {
    const k = meshStrokeOf(keys[mi])
    if (k === null) {
      out[mi] = UNIT_MARK
      continue
    }
    const s = pieces ? (k < pieces.length ? pieces[k] : -1) : k
    out[mi] = s >= 0 && s < strokeCount ? s : UNIT_NONE
  }
  return out
}
