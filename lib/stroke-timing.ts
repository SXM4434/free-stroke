/* ============================================================================
 * STROKE TIMING: per-stroke delay, speed, ease and hold back, on the one clock.
 *
 * His ruling, 2026-09-25 (`docs/rulings/2026-09-25-animation-comes-back.md`):
 * "Each stroke gets its own speed, ease and delay, and any stroke can be held
 * back to land last." This is phase 1a of
 * `docs/research-2026-09-25/animation-tools/DESIGN.md`: the model and the bake,
 * no UI. Phase 1b gives it a timeline you can drag.
 *
 * WHAT IT CHANGES. The schedule (`lib/stroke-schedule.ts`) keys each triangle
 * by WHERE on the beat it lands. A timed take keys it by WHEN it arrives, as a
 * fraction of the take's length `takeMs`. The drawn set is still
 * `{ key <= clock }`, still a prefix of a sorted array, still one binary
 * search per frame, because the key stays monotone inside every stroke. The
 * bake runs on a dial change and never per frame. Under a timed take the
 * viewport hands the reveal `clock` itself, since the pace now lives in the
 * keys.
 *
 * THE ONE CLOCK. Everything here is a pure function of `clock * takeMs`.
 * Export asks for `sampleTake(timed, clockMs)` frame by frame and gets the same
 * drawn spans the live keys give (gated in `assert-stroke-timing.mjs`, row
 * CLOCK). No second timeline exists.
 *
 * NO ROWS, NO CHANGE. `buildTimedSchedule` returns null when the take has no
 * rows, and every consumer then runs the chain it always ran, byte for byte.
 *
 * ── THE SLOTS ──────────────────────────────────────────────────────────────
 *
 * Stroke i's base slot, in ms, is where today's chain already puts it:
 * `B0 = pace.beatToLanding(start_i) * baseMs`, its first ink, and
 * `B1 = pace.beatToClock(end_i) * baseMs`, its pen-up. A row moves it:
 *
 *     t0 = B0 + carry + delayMs        (never below 0)
 *     t1 = t0 + (B1 - B0) / speed
 *
 * `carry` is 0 with "Ripple later strokes" off (the default, which is After
 * Effects layers: every other stroke stays put). With it on, `carry` is how far
 * the previous stroke's END moved, so a later stroke follows the change.
 * "Later" means a later base start. A held-back stroke leaves the sequence:
 * it starts when the last of the others ends (plus its own delay), and when two
 * are held they land one after another in base order. Holding a stroke back
 * does not ripple the strokes after it.
 *
 * Inside the slot the stroke keeps its own pace. `w` is how far through its
 * base slot the unmodified stroke reaches arc `a`, so his hesitations stretch
 * with the stroke instead of staying behind on the beat. The ease then bends
 * time inside the slot: the stroke reaches `w` at slot fraction `ease^-1(w)`.
 * The ends stay put, because every ease maps 0 to 0 and 1 to 1.
 * ========================================================================== */

import {
  scheduleArc,
  windowParts,
  type RevealEase,
  type RevealEasePreset,
  type RevealCurve,
  type RevealWindow,
  type StrokeSchedule,
} from "@/lib/stroke-schedule"

/* ==========================================================================
 * §1 · THE ROWS
 * ======================================================================== */

export type StrokeEase =
  | { kind: "preset"; id: RevealEasePreset }
  | { kind: "bezier"; x1: number; y1: number; x2: number; y2: number }

/** One row per stroke, only for strokes he has touched. */
export interface StrokeTiming {
  /** Shift of the stroke's slot from where the schedule put it, ms. */
  delayMs: number
  /** 1 is the pace it was drawn at; 2 draws it in half the screen time. */
  speed: number
  /** Over this stroke's own progress. */
  ease: StrokeEase
  /** Lands last, after every other stroke has finished. */
  holdBack: boolean
  /**
   * A performed pace (ANIM-2, Perform). The stroke's own arc drawn, 0..1, at
   * evenly spaced fractions of its slot: first 0, last 1, never decreasing. A
   * flat run is a pause he held with the pen down. Present, it replaces the
   * stroke's recorded pace and its ease inside the slot; `delayMs` and `speed`
   * still place the slot. Absent on every row the strip writes.
   */
  performed?: number[]
}

export const STROKE_TIMING_NEUTRAL: StrokeTiming = {
  delayMs: 0,
  speed: 1,
  ease: { kind: "preset", id: "linear" },
  holdBack: false,
}

export interface StrokeTimingTake {
  /** Keyed by stroke index. An empty record means the take is not timed. */
  strokes: Record<number, StrokeTiming>
  /** "Ripple later strokes". Off keeps every other stroke where it was. */
  ripple: boolean
}

export const STROKE_TIMING_TAKE_DEFAULTS: StrokeTimingTake = { strokes: {}, ripple: false }

/**
 * Today's time-to-beat curve and its inverse, both 0..1 to 0..1 and increasing.
 * The viewport passes the pair it already uses for the strip's seconds axis;
 * the default is a constant-speed sweep.
 */
export interface TimingPace {
  /** The FIRST clock the curve reaches `beat`. At a pen lift's held beat that
   * is the lift's start, where the stroke before it ends. */
  beatToClock: (beat: number) => number
  /** The LAST clock the curve is still on `beat`. At a pen lift's held beat
   * that is the landing, where the next stroke's first ink goes down, so a
   * slot starts here (F120). Where the curve rises it equals `beatToClock`. */
  beatToLanding: (beat: number) => number
  clockToBeat: (clock: number) => number
}

const LINEAR_PACE: TimingPace = { beatToClock: (b) => b, beatToLanding: (b) => b, clockToBeat: (c) => c }

/**
 * A pace from any increasing clock-to-beat curve, sampled once into a table.
 * The viewport hands it the chain it already runs per frame (whole-take ease,
 * then the hand's time-to-travel curve), so a take with only neutral rows lands
 * every triangle on the frame it landed on before. Flat stretches (a pen lift)
 * invert to their first clock, which is when the ink got there.
 *
 * Each flat's two ends go into the table at their exact clocks (ANIM-1C6). The
 * uniform samples land up to one sample (12.8 ms on a 13 s word) inside a lift,
 * so a table of samples alone ramps across a landing the curve holds flat, and
 * `sampleTake` gave the next stroke a sliver of arc before its first ink (Solid
 * 4). With the lift start and the landing found by bisection on the curve
 * itself, keys (`beatToClock`) and samples (`clockToBeat`) read one table and
 * both are exact at every lift the samples can see. A flat is found by two
 * equal samples, so one that holds fewer than two (shorter than two sample
 * steps, 25.6 ms on that word, 117 ms on a 60 s drawing) is not refined and
 * still ramps across its landing, as every lift did before.
 *
 * A slot starts at `beatToLanding` and ends at `beatToClock` (F120). One beat
 * is both a lift's start and its landing, so one inverse cannot give both.
 * On the hero, strokes 1 to 10 start 1 to 5 float steps above their held beat
 * and stroke 11 starts on it, so with `beatToClock` for starts stroke 11
 * opened 72 ms early, at the lift's start. `beatToLanding` gives the landing
 * at the held beat and at any float step above it.
 */
export function paceFromCurve(clockToBeat: (clock: number) => number, n = 1024): TimingPace {
  const beats = new Float64Array(n + 1)
  let prev = 0
  for (let k = 0; k <= n; k++) {
    const b = k === 0 ? 0 : k === n ? 1 : clockToBeat(k / n)
    prev = b > prev ? b : prev
    beats[k] = prev
  }
  /* Narrows [lo, hi] to adjacent doubles, `above(lo)` false and `above(hi)` true. */
  const bisect = (lo: number, hi: number, above: (c: number) => boolean) => {
    for (let it = 0; it < 64; it++) {
      const mid = (lo + hi) / 2
      if (mid <= lo || mid >= hi) break
      if (above(mid)) hi = mid
      else lo = mid
    }
    return [lo, hi]
  }
  const cs: number[] = [0]
  const bs: number[] = [beats[0]]
  for (let k = 1; k <= n; k++) {
    const c0 = (k - 1) / n
    const c1 = k / n
    if (beats[k] > beats[k - 1]) {
      /* Sample k-1 ends a flat: the landing is the last clock still on it. */
      if (k >= 2 && beats[k - 2] === beats[k - 1]) {
        const held = beats[k - 1]
        const land = bisect(c0, c1, (c) => clockToBeat(c) > held)[0]
        if (land > c0) {
          cs.push(land)
          bs.push(held)
        }
      }
      /* Sample k starts a flat: the lift starts at the first clock on it. */
      if (k < n && beats[k + 1] === beats[k]) {
        const held = beats[k]
        const lift = bisect(cs[cs.length - 1], c1, (c) => clockToBeat(c) >= held)[1]
        if (lift < c1) {
          cs.push(lift)
          bs.push(held)
        }
      }
    }
    cs.push(c1)
    bs.push(beats[k])
  }
  const last = cs.length - 1
  const c2b = (c: number) => {
    const x = c < 0 ? 0 : c > 1 ? 1 : c
    let lo = 0
    let hi = last
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (cs[mid] <= x) lo = mid
      else hi = mid
    }
    const span = cs[hi] - cs[lo]
    return span > 0 ? bs[lo] + (bs[hi] - bs[lo]) * ((x - cs[lo]) / span) : bs[hi]
  }
  const b2c = (b: number) => {
    if (!(b > 0)) return 0
    if (b >= 1) return 1
    let lo = 0
    let hi = last
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (bs[mid] < b) lo = mid + 1
      else hi = mid
    }
    if (lo === 0) return 0
    const b0 = bs[lo - 1]
    const b1 = bs[lo]
    return cs[lo - 1] + (cs[lo] - cs[lo - 1]) * (b1 > b0 ? (b - b0) / (b1 - b0) : 1)
  }
  /* The first entry above `b`; the one before it is the last entry still on
   * `b` or below, which at a held beat is the landing entry. */
  const b2land = (b: number) => {
    if (!(b >= 0)) return 0
    if (b >= 1) return 1
    let lo = 0
    let hi = last
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (bs[mid] <= b) lo = mid + 1
      else hi = mid
    }
    const b0 = bs[lo - 1]
    return cs[lo - 1] + (cs[lo] - cs[lo - 1]) * ((b - b0) / (bs[lo] - b0))
  }
  return { beatToClock: b2c, beatToLanding: b2land, clockToBeat: c2b }
}

/* ==========================================================================
 * §2 · EASES
 * ======================================================================== */

/**
 * The whole-take envelope and the per-stroke presets are one curve family, so
 * they live in one function. Moved here from `components/viewport-3d.tsx`
 * (ANIM-1A2); the viewport imports it back.
 *
 * Cubic envelope, and MONOTONIC on purpose: the scrubber has to be able to go
 * the other way. `easeReveal` maps wall-clock 0..1 to playhead 0..1, and
 * `unEaseReveal` recovers the clock from a playhead the user dragged to. A
 * non-monotonic curve (an overshoot, a bounce) would make that inverse
 * ambiguous and the scrubber would jump, which is why the four here are the
 * four that stay monotonic rather than an arbitrary easing menu.
 */
export function easeReveal(t: number, ease: RevealEase): number {
  const u = t < 0 ? 0 : t > 1 ? 1 : t
  if (typeof ease === "object") return revealCurveAt(ease, u)
  switch (ease) {
    case "in":
      return u * u * u
    case "out":
      return 1 - Math.pow(1 - u, 3)
    case "inOut":
      return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
    default:
      return u
  }
}

/* ==========================================================================
 * DRAWIN-CURVE · THE CURVE HE SHAPES
 *
 * Custom opens on the preset's own curve. Three of the four presets ARE cubic
 * beziers with the x handles at thirds, so the seed is exact: `in` is u³ =
 * (⅓, 0, ⅔, 0), `out` is 1 − (1 − u)³ = (⅓, 1, ⅔, 1), linear is (⅓, ⅓, ⅔, ⅔).
 * `inOut` is two cubics joined at the middle and no single bezier is it, so
 * its seed is the closest one, (0.66, 0, 0.34, 1), off by at most 0.0085.
 * Picking Custom writes nothing for that reason: the ease stays the preset
 * until the first drag, and the seed only has to be what he starts from.
 * ======================================================================== */

export const REVEAL_EASE_SEEDS: Record<RevealEasePreset, RevealCurve> = {
  linear: { x1: 1 / 3, y1: 1 / 3, x2: 2 / 3, y2: 2 / 3 },
  in: { x1: 1 / 3, y1: 0, x2: 2 / 3, y2: 0 },
  out: { x1: 1 / 3, y1: 1, x2: 2 / 3, y2: 1 },
  inOut: { x1: 0.66, y1: 0, x2: 0.34, y2: 1 },
}

const bz = (a: number, b: number, s: number) => {
  const r = 1 - s
  return 3 * r * r * s * a + 3 * r * s * s * b + s * s * s
}

/** The curve's parameter where its x reaches `u`. x is increasing because
 *  x1 and x2 sit in 0..1, so bisection always lands. */
function curveParamAt(c: RevealCurve, u: number): number {
  let lo = 0
  let hi = 1
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2
    if (bz(c.x1, c.x2, mid) < u) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/**
 * The reveal a shaped curve gives at clock `u`. An overshoot handle takes y
 * past 1: the reveal CLAMPS there, because past 1 there is no ink left to
 * draw, and passing 1 then settling back would un-draw the last stroke's
 * tail. Below 0 it clamps the same way, a held start. Where the curve turns
 * back down inside the band the reveal holds at its highest point so far,
 * never retracting: the pen pauses instead of erasing. That keeps it
 * increasing, which the scrubber's inverse (`unEaseReveal`) needs.
 */
export function revealCurveAt(c: RevealCurve, u: number): number {
  if (!(u > 0)) return 0
  if (u >= 1) return 1
  const s = curveParamAt(c, u)
  let y = bz(c.y1, c.y2, s)
  /* y'(s)/3 = a s² + b s + c0. A local maximum of y before `s` beats y(s)
   * only where the curve turned back down. */
  const a = 3 * c.y1 - 3 * c.y2 + 1
  const b = -4 * c.y1 + 2 * c.y2
  const c0 = c.y1
  const roots: number[] = []
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) roots.push(-c0 / b)
  } else {
    const d = b * b - 4 * a * c0
    if (d >= 0) {
      const q = Math.sqrt(d)
      roots.push((-b - q) / (2 * a), (-b + q) / (2 * a))
    }
  }
  for (const r of roots) if (r > 0 && r < s) y = Math.max(y, bz(c.y1, c.y2, r))
  return y < 0 ? 0 : y > 1 ? 1 : y
}

/** The curve to seed the editor from: his, or the preset's own. */
export function curveOfEase(e: RevealEase | StrokeEase): RevealCurve {
  if (typeof e === "string") return REVEAL_EASE_SEEDS[e]
  if ("kind" in e) return e.kind === "preset" ? REVEAL_EASE_SEEDS[e.id] : { x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2 }
  return e
}

/** A handle set a curve may hold: x in 0..1, y finite and within a sane
 *  overshoot. Null when it is fine, else the reason. */
export function curveProblem(c: RevealCurve): string | null {
  for (const k of ["x1", "x2"] as const) if (!(c[k] >= 0 && c[k] <= 1)) return `${k} runs 0 to 1, so time only goes forward.`
  for (const k of ["y1", "y2"] as const) if (!(c[k] >= -1 && c[k] <= 2)) return `${k} runs -1 to 2.`
  return null
}

/** Null means linear, which every consumer short-circuits. */
type EaseFn = ((u: number) => number) | null

function easeFnOf(e: StrokeEase | undefined): EaseFn {
  if (!e) return null
  if (e.kind === "preset") {
    if (e.id === "linear") return null
    const id = e.id
    return (u) => easeReveal(u, id)
  }
  const c: RevealCurve = { x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2 }
  return (u) => revealCurveAt(c, u)
}

/** `ease^-1(w)` by bisection. Every ease offered here is increasing on 0..1. */
function easeInverse(f: (u: number) => number, w: number): number {
  if (!(w > 0)) return 0
  if (w >= 1) return 1
  let lo = 0
  let hi = 1
  for (let k = 0; k < 48; k++) {
    const mid = (lo + hi) / 2
    if (f(mid) < w) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/* ==========================================================================
 * §3 · THE TIMED SCHEDULE
 * ======================================================================== */

export interface TimedSchedule {
  base: StrokeSchedule
  /** The take's length before any row, ms: the pen duration today. */
  baseMs: number
  /** The take's length with the rows applied: `max(t1)`. Export uses this. */
  takeMs: number
  /** `[B0, B1]` per stroke, ms. Where today's chain puts the stroke. */
  baseSlots: Float64Array
  /** `[t0, t1]` per stroke, ms. Where the rows put it. */
  slots: Float64Array
  eases: EaseFn[]
  /** Per stroke, the validated performed pace, or null. */
  performed: (Float64Array | null)[]
  pace: TimingPace
  ripple: boolean
  /**
   * Rows that were given and not used, each with the reason. Shown, not
   * swallowed: a row for stroke 40 of a 12-stroke word, or a speed of 0, is a
   * control that moves nothing, and that must be visible.
   */
  rejected: string[]
  sig: string
  /**
   * TRUE when the rows moved nothing: every slot is its base slot, no stroke
   * carries an ease, and the take is the pen's length. Computed from the
   * result, never from the rows, so a row that happens to cancel out counts.
   * The scene draws an identity take through the shipped path (ANIM-1A6):
   * the timed keys read the pace through a 1024-step table and the tip field
   * interpolates clock times per segment, so a timed draw of an identity take
   * lands within 0.006 of the shipped one on Inflate, measured, and not on it.
   */
  identity: boolean
}

/** True when the take carries at least one row. */
export function isTimedTake(take: StrokeTimingTake | null | undefined): boolean {
  if (!take || !take.strokes) return false
  // Own keys only, the same set buildTimedSchedule reads (Codex crosscheck
  // 2026-09-25: `for...in` also saw inherited rows, so a take with none read as timed).
  return Object.keys(take.strokes).length > 0
}

/**
 * Build the timed schedule, or null when the take has no rows. Null is the
 * shipped path: the caller keeps `remapRevealKeys` and `scheduleArcCoeffs`.
 */
/** Every stroke's on-screen `[t0, t1]`, ms, from its row and its base slot: the
 *  walk `buildTimedSchedule` places slots with, and `rebasePerformed` reads the
 *  old clock with, so the two can never disagree. Rows are already read clean. */
export function placeSlots(rows: readonly StrokeTiming[], baseSlots: ArrayLike<number>, ripple: boolean): Float64Array {
  const n = baseSlots.length / 2
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => baseSlots[a * 2] - baseSlots[b * 2] || a - b,
  )
  const slots = new Float64Array(n * 2)
  let carry = 0
  let lastEnd = 0
  for (const i of order) {
    const row = rows[i]
    if (row.holdBack) continue
    const B0 = baseSlots[i * 2]
    const B1 = baseSlots[i * 2 + 1]
    const t0 = Math.max(0, B0 + (ripple ? carry : 0) + row.delayMs)
    const t1 = t0 + (B1 - B0) / row.speed
    slots[i * 2] = t0
    slots[i * 2 + 1] = t1
    if (ripple) carry = t1 - B1
    if (t1 > lastEnd) lastEnd = t1
  }
  for (const i of order) {
    const row = rows[i]
    if (!row.holdBack) continue
    const dur = (baseSlots[i * 2 + 1] - baseSlots[i * 2]) / row.speed
    const t0 = Math.max(0, lastEnd + row.delayMs)
    slots[i * 2] = t0
    slots[i * 2 + 1] = t0 + dur
    lastEnd = Math.max(lastEnd, t0 + dur)
  }
  return slots
}

export function buildTimedSchedule(
  base: StrokeSchedule,
  take: StrokeTimingTake | null | undefined,
  opts: { baseMs: number; pace?: TimingPace },
): TimedSchedule | null {
  if (!isTimedTake(take)) return null
  const t = take!
  const pace = opts.pace ?? LINEAR_PACE
  const baseMs = opts.baseMs > 0 ? opts.baseMs : 1
  const tr = base.tracks
  const n = tr.length
  const rejected: string[] = []

  const rows: StrokeTiming[] = new Array(n).fill(STROKE_TIMING_NEUTRAL)
  for (const key of Object.keys(t.strokes)) {
    const i = Number(key)
    const r = t.strokes[i as number]
    if (!Number.isInteger(i) || i < 0 || i >= n) {
      rejected.push(`stroke ${key}: no such stroke (0..${n - 1})`)
      continue
    }
    let speed = r.speed
    if (!(Number.isFinite(speed) && speed > 0)) {
      rejected.push(`stroke ${i}: speed ${speed} is not a positive number, read as 1`)
      speed = 1
    }
    const delayMs = Number.isFinite(r.delayMs) ? r.delayMs : 0
    if (delayMs !== r.delayMs) rejected.push(`stroke ${i}: delay ${r.delayMs} read as 0`)
    rows[i] = { delayMs, speed, ease: r.ease, holdBack: !!r.holdBack }
    if (r.performed !== undefined) {
      const why = performedFault(r.performed)
      if (why) rejected.push(`stroke ${i}: performed pace ${why}, played at its own pace`)
      else rows[i].performed = r.performed
    }
  }

  const baseSlots = new Float64Array(n * 2)
  for (let i = 0; i < n; i++) {
    baseSlots[i * 2] = pace.beatToLanding(tr[i].start) * baseMs
    baseSlots[i * 2 + 1] = pace.beatToClock(tr[i].end) * baseMs
  }

  const slots = placeSlots(rows, baseSlots, t.ripple)

  let takeMs = 0
  for (let i = 0; i < n; i++) if (slots[i * 2 + 1] > takeMs) takeMs = slots[i * 2 + 1]
  if (!(takeMs > 0)) takeMs = baseMs

  const performed = rows.map((r) => (r.performed ? Float64Array.from(r.performed) : null))
  const eases = rows.map((r, i) => (performed[i] ? null : easeFnOf(r.ease)))
  let sig = `${base.sig}|ms${baseMs}|r${t.ripple ? 1 : 0}`
  for (let i = 0; i < n; i++) {
    if (rows[i] === STROKE_TIMING_NEUTRAL) continue
    sig += `|${i}:${rows[i].delayMs},${rows[i].speed},${JSON.stringify(rows[i].ease)},${rows[i].holdBack ? 1 : 0}`
    if (rows[i].performed) sig += `,p${rows[i].performed!.join(" ")}`
  }
  let identity = takeMs === baseMs
  for (let i = 0; identity && i < n; i++) {
    if (eases[i] || performed[i] || slots[i * 2] !== baseSlots[i * 2] || slots[i * 2 + 1] !== baseSlots[i * 2 + 1]) identity = false
  }
  return { base, baseMs, takeMs, baseSlots, slots, eases, performed, pace, ripple: t.ripple, rejected, sig, identity }
}

/* ==========================================================================
 * §4 · READING IT: arc to arrival time, and time back to arc
 * ======================================================================== */

/**
 * Which stroke a global arc belongs to. The same lower bound on `to` that
 * `scheduleArc` uses, so a key and its stroke never disagree at a boundary.
 */
export function strokeOfArc(sched: StrokeSchedule, a: number): number {
  const tr = sched.tracks
  let lo = 0
  let hi = tr.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (tr[mid].to < a) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * The arrival time of global arc `a` inside stroke `i`, in ms on the take's
 * clock. Values of `a` above 1 are the tip field's "never reached" sentinel and
 * pass through unchanged, as `scheduleArc` does.
 */
export function timedArcMsIn(ts: TimedSchedule, i: number, a: number): number {
  const S = scheduleArc(ts.base, a)
  const pf = ts.performed[i]
  if (pf) {
    const tr = ts.base.tracks[i]
    const slot = tr.end - tr.start
    const r = slot > 0 ? (S - tr.start) / slot : 1
    return ts.slots[i * 2] + (ts.slots[i * 2 + 1] - ts.slots[i * 2]) * performedInverse(pf, r)
  }
  const B0 = ts.baseSlots[i * 2]
  const B1 = ts.baseSlots[i * 2 + 1]
  const t0 = ts.slots[i * 2]
  const t1 = ts.slots[i * 2 + 1]
  const span = B1 - B0
  let w = span > 0 ? (ts.pace.beatToClock(S) * ts.baseMs - B0) / span : 1
  w = w < 0 ? 0 : w > 1 ? 1 : w
  const e = ts.eases[i]
  const u = e ? easeInverse(e, w) : w
  return t0 + (t1 - t0) * u
}

/** `timedArcMsIn` as a fraction of `takeMs`: the key a triangle is sorted by. */
export function timedArc(ts: TimedSchedule, a: number): number {
  if (a > 1) return a
  return timedArcMsIn(ts, strokeOfArc(ts.base, a), a) / ts.takeMs
}

/**
 * The per-triangle reveal keys under a timed take. With `ts` null this IS
 * `remapRevealKeys`' arithmetic, called the same way, so the no-rows path is
 * the shipped path.
 */
export function timedRevealKeys(
  baseKeys: Float32Array,
  sched: StrokeSchedule,
  ts: TimedSchedule | null,
): Float32Array {
  const dst = new Float32Array(baseKeys.length)
  if (!ts) {
    for (let t = 0; t < baseKeys.length; t++) dst[t] = scheduleArc(sched, baseKeys[t])
    return dst
  }
  for (let t = 0; t < baseKeys.length; t++) dst[t] = timedArc(ts, baseKeys[t])
  return dst
}

/**
 * The map `buildTipField` bakes through under a timed take. It replaces the
 * affine `scheduleArcCoeffs`, because speed and ease make the map curve inside
 * a stroke. The bake reads it at every segment end, never per texel.
 */
export function timedTipMap(ts: TimedSchedule): { arcAt: (stroke: number, a: number) => number } {
  return { arcAt: (i, a) => timedArcMsIn(ts, i, a) / ts.takeMs }
}

/* ==========================================================================
 * §5 · SAMPLING: the export path, forward from the clock
 * ======================================================================== */

/** Stroke i's drawn part of its OWN arc at take time `tMs`, as one number 0..1. */
function reachedAt(ts: TimedSchedule, i: number, tMs: number): number {
  const t0 = ts.slots[i * 2]
  const t1 = ts.slots[i * 2 + 1]
  let u = t1 > t0 ? (tMs - t0) / (t1 - t0) : tMs >= t0 ? 1 : 0
  u = u < 0 ? 0 : u > 1 ? 1 : u
  const pf = ts.performed[i]
  if (pf) return performedAt(pf, u)
  const e = ts.eases[i]
  const w = e ? e(u) : u
  const B0 = ts.baseSlots[i * 2]
  const B1 = ts.baseSlots[i * 2 + 1]
  const S = ts.pace.clockToBeat((B0 + (B1 - B0) * w) / ts.baseMs)
  const tr = ts.base.tracks[i]
  const slot = tr.end - tr.start
  let r = slot > 0 ? (S - tr.start) / slot : w >= 1 ? 1 : 0
  r = r < 0 ? 0 : r > 1 ? 1 : r
  return r
}

/**
 * THE CULL'S FRONT UNDER A TIMED TAKE, as a fraction of `takeMs`: the latest
 * key a triangle may carry and still be submitted at take time `tMs`.
 *
 * The shipped cull is `beat + margin`, one number, because the beat moves at
 * one rate for the whole word. Under a take the keys are clock times and the
 * clock a margin of arc costs depends on how fast that stroke is drawn there,
 * so one word-wide slope cannot stand in for it. ANIM-1A5 used `slopeMax`, the
 * steepest slope in the word, and measured on the hero it submitted the D's
 * stem-top triangles about 400 ms early under twelve neutral rows; the tip
 * field marks those texels inked by the D's first pass, so they showed. So the
 * margin is walked in ARC, per stroke, and each end mapped through its own
 * stroke's time: a stroke that has started puts its front at the arrival of
 * `reached + marginArc`, spilling into the stroke drawn next when that stroke
 * sits where the base chain put it relative to this one (a row that moved it
 * owns its own start). With every row neutral this is the shipped `beat +
 * margin`, read back through the pace table.
 */
export function timedFront(ts: TimedSchedule, tMs: number, marginArc: number): number {
  const tr = ts.base.tracks
  const n = tr.length
  let front = tMs / ts.takeMs
  if (!(marginArc > 0)) return front
  /* The stroke drawn after each one in the base chain, by base slot start. */
  const order = Array.from({ length: n }, (_, i) => i).sort((x, y) => ts.baseSlots[x * 2] - ts.baseSlots[y * 2])
  const nextOf = new Int32Array(n).fill(-1)
  for (let k = 0; k + 1 < n; k++) nextOf[order[k]] = order[k + 1]
  const entry = (j: number) => (tr[j].reverse ? tr[j].to : tr[j].from)
  for (let i = 0; i < n; i++) {
    if (tMs < ts.slots[i * 2]) continue
    const t = tr[i]
    const r = reachedAt(ts, i, tMs)
    const span = t.to - t.from
    let at = t.reverse ? t.to - r * span : t.from + r * span
    let left = marginArc
    let j = i
    for (let guard = 0; guard <= n; guard++) {
      const tj = tr[j]
      const room = tj.reverse ? at - tj.from : tj.to - at
      const step = left < room ? left : room > 0 ? room : 0
      at = tj.reverse ? at - step : at + step
      left -= step
      const f = timedArcMsIn(ts, j, at) / ts.takeMs
      if (f > front) front = f
      if (!(left > 0)) break
      const k = nextOf[j]
      if (k < 0) break
      if (ts.slots[k * 2] - ts.slots[j * 2 + 1] !== ts.baseSlots[k * 2] - ts.baseSlots[j * 2 + 1]) break
      j = k
      at = entry(k)
    }
  }
  return front > 1 ? 1 : front
}

export interface TakeSample {
  clockMs: number
  /** `[f0, f1]` per stroke in its own 0..1 arc, like `strokeSpansIn`. */
  spans: Float64Array
}

/**
 * The drawn part of every stroke at `clockMs`, computed forward from time
 * rather than read off the keys. `win` is the window's `[lo, hi]` as fractions
 * of the take (grow is `[0, clock]`). This is the path export asks for; the
 * gate holds it to the live keys.
 */
export function sampleTake(
  ts: TimedSchedule,
  clockMs: number,
  win?: { lo: number; hi: number },
): TakeSample {
  const n = ts.base.tracks.length
  const spans = new Float64Array(n * 2)
  const loMs = win ? win.lo * ts.takeMs : 0
  const hiMs = win ? win.hi * ts.takeMs : clockMs
  for (let i = 0; i < n; i++) {
    const rLo = win && win.lo > 0 ? reachedAt(ts, i, loMs) : 0
    const rHi = reachedAt(ts, i, hiMs)
    if (ts.base.tracks[i].reverse) {
      spans[i * 2] = 1 - rHi
      spans[i * 2 + 1] = 1 - rLo
    } else {
      spans[i * 2] = rLo
      spans[i * 2 + 1] = rHi
    }
  }
  return { clockMs, spans }
}

/* ==========================================================================
 * §6 · FOR THE STRIP: reading and writing one row (ANIM-1B)
 * ======================================================================== */

/** The row a stroke plays with: its own, or the neutral one. */
export function rowOf(take: StrokeTimingTake, i: number): StrokeTiming {
  return take.strokes[i] ?? STROKE_TIMING_NEUTRAL
}

/** The take with stroke `i`'s row patched. Every other row is the same object. */
export function withRow(take: StrokeTimingTake, i: number, patch: Partial<StrokeTiming>): StrokeTimingTake {
  return { ...take, strokes: { ...take.strokes, [i]: { ...rowOf(take, i), ...patch } } }
}

/** The take with stroke `i` back on the schedule: its row is dropped, not zeroed. */
export function withoutRow(take: StrokeTimingTake, i: number): StrokeTimingTake {
  if (!(i in take.strokes)) return take
  const strokes = { ...take.strokes }
  delete strokes[i]
  return { ...take, strokes }
}

/**
 * The pen's own length in ms, the `baseMs` the viewport builds the timed
 * schedule with (`useTimeline(rawStrokes)` in `viewport-3d.tsx`: first point
 * to last, at least 1). The strip needs it while a take is timed, when the
 * viewport's `totalDuration` has become `takeMs`. `assert-stroke-strip.mjs`
 * holds the strip's slots to `__fsTake.get().slots`, so a drift here fails.
 */
/** True when any row in the take carries a performed pace (Perform). */
export function takeHasPerformed(take: StrokeTimingTake | null | undefined): boolean {
  if (!take) return false
  return Object.values(take.strokes).some((r) => Array.isArray(r?.performed) && r.performed.length > 0)
}

/**
 * HAND-DRAW-P2, the plan's PEN-7. A performed row is stored against the base
 * slots of the clock it was performed on (`withPerformed`: delay from B0, speed
 * from B1 - B0), so a new clock under it would move and stretch the stroke he
 * performed. This re-stores the take for `newBaseSlots`: each performed row is
 * read as its on-screen `[t0, t1]` on `oldBaseSlots` (the build's own walk,
 * `placeSlots`) and written back against the new slots by `withPerformed`, so
 * it keeps its start and its length. Every other row keeps its delay and speed,
 * so those strokes follow the new clock. The row's ease is kept, since
 * `withPerformed` resets it. A held-back performed row is solved on the second
 * walk, where the build places held-back rows after the last stroke.
 */
export function rebasePerformed(
  take: StrokeTimingTake,
  oldBaseSlots: ArrayLike<number>,
  newBaseSlots: ArrayLike<number>,
): StrokeTimingTake {
  if (!takeHasPerformed(take)) return take
  if (oldBaseSlots.length !== newBaseSlots.length || oldBaseSlots.length % 2 !== 0) {
    throw new Error(`rebasePerformed: ${oldBaseSlots.length / 2} strokes on the old clock, ${newBaseSlots.length / 2} on the new one`)
  }
  const n = oldBaseSlots.length / 2
  const clean = (t: StrokeTimingTake): StrokeTiming[] => {
    const rows: StrokeTiming[] = new Array(n).fill(STROKE_TIMING_NEUTRAL)
    for (const key of Object.keys(t.strokes)) {
      const i = Number(key)
      const r = t.strokes[i]
      if (!Number.isInteger(i) || i < 0 || i >= n || !r) continue
      const speed = Number.isFinite(r.speed) && r.speed > 0 ? r.speed : 1
      rows[i] = { delayMs: Number.isFinite(r.delayMs) ? r.delayMs : 0, speed, ease: r.ease, holdBack: !!r.holdBack }
    }
    return rows
  }
  const old = placeSlots(clean(take), oldBaseSlots, take.ripple)
  const isPerformed = (i: number) => {
    const r = take.strokes[i]
    return !!r && Array.isArray(r.performed) && r.performed.length > 0 && !performedFault(r.performed)
  }
  const fits = new Map<number, { t0: number; t1: number; performed: number[] }>()
  const heldBack: number[] = []
  for (let i = 0; i < n; i++) {
    if (!isPerformed(i)) continue
    if (take.strokes[i].holdBack) heldBack.push(i)
    else fits.set(i, { t0: old[i * 2], t1: old[i * 2 + 1], performed: take.strokes[i].performed! })
  }
  const out = fits.size ? withPerformed(take, newBaseSlots, fits) : { ...take, strokes: { ...take.strokes } }
  for (const i of fits.keys()) out.strokes[i] = { ...out.strokes[i], ease: take.strokes[i].ease }
  // Held-back rows land in base order after the last stroke, each after the one before it,
  // so fixing them in that order never moves one already fixed.
  heldBack.sort((a, b) => newBaseSlots[a * 2] - newBaseSlots[b * 2] || a - b)
  for (const i of heldBack) {
    const now = placeSlots(clean(out), newBaseSlots, out.ripple)
    const r = out.strokes[i]
    const len = old[i * 2 + 1] - old[i * 2]
    out.strokes[i] = {
      ...r,
      delayMs: r.delayMs + old[i * 2] - now[i * 2],
      speed: len > 0 ? (newBaseSlots[i * 2 + 1] - newBaseSlots[i * 2]) / len : r.speed,
    }
  }
  return out
}

/** The pair a performed take is stored against: the clock AND the rate, since
 *  either one moves the base slots (HAND-DRAW-3). */
export function clockKeyOf(env: { clock: string; rate: number }): string {
  return `${env.clock}|${env.rate}`
}

/** Carry `t` from `src` onto `dst` by arc-length fraction, geometry untouched.
 *  The clock memo's fallback for a stroke whose stored resample no longer has
 *  the point count a fresh `processStroke` gives (the canvas spacing changed
 *  after it was drawn). The memo counts every use, so it is never silent. */
export function carryTimeByArc<P extends { x: number; y: number; t: number }>(dst: P[], src: { x: number; y: number; t: number }[]): P[] {
  if (dst.length < 2 || src.length < 2) return dst.map((p, j) => ({ ...p, t: src[Math.min(j, src.length - 1)]?.t ?? p.t }))
  const cum = (q: { x: number; y: number }[]) => { const c = [0]; for (let j = 1; j < q.length; j++) c.push(c[j - 1] + Math.hypot(q[j].x - q[j - 1].x, q[j].y - q[j - 1].y)); return c }
  const sc = cum(src), dc = cum(dst), sT = sc[sc.length - 1], dT = dc[dc.length - 1]
  let k = 1
  return dst.map((p, j) => {
    const want = dT > 0 && sT > 0 ? (dc[j] / dT) * sT : 0
    while (k < sc.length - 1 && sc[k] < want) k++
    const a = sc[k - 1], b = sc[k], f = b > a ? Math.min(1, Math.max(0, (want - a) / (b - a))) : 0
    return { ...p, t: src[k - 1].t + f * (src[k].t - src[k - 1].t) }
  })
}

/** Divide every `t` by `rate` about the earliest one, so the clock starts where
 *  it did and runs `rate` times as fast. 1 hands back the SAME array. */
export function rateScaled<S extends { points: { t: number }[] }>(strokes: S[], rate: number): S[] {
  if (rate === 1 || !(rate > 0) || strokes.length === 0) return strokes
  let lo = Infinity
  for (const s of strokes) for (const p of s.points) if (p.t < lo) lo = p.t
  return strokes.map((s) => ({ ...s, points: s.points.map((p) => ({ ...p, t: lo + (p.t - lo) / rate })) }))
}

export function penMsOf(strokes: { points: { t: number }[] }[]): number {
  if (strokes.length === 0) return 0
  let lo = Infinity
  let hi = -Infinity
  for (const s of strokes) {
    for (const p of s.points) {
      if (p.t < lo) lo = p.t
      if (p.t > hi) hi = p.t
    }
  }
  return Math.max(hi - lo, 1)
}

/**
 * ANIM-1C · THE SPANS A REBUILD ENGINE CUTS AT UNDER A TIMED TAKE, one array
 * per window part, for `filterStrokesBySpans`. The window is `windowAt` of the
 * playhead, which under a timed take is the clock as a fraction of `takeMs`
 * (the frame loop reads it the same way). Each part goes through `sampleTake`,
 * so a stroke's reach comes from its own slot, speed and ease, never from the
 * beat. A wrapped Travel gives two parts, read through `windowParts`.
 */
export function takeSpansIn(ts: TimedSchedule, win: RevealWindow): Float64Array[] {
  return windowParts(win).map(([lo, hi]) => sampleTake(ts, hi * ts.takeMs, { lo, hi }).spans)
}

/* ==========================================================================
 * §7 · PERFORM (ANIM-2): a performed motion into take rows
 *
 * He drags along a stroke and the page records `(tMs, p)`: when, on the take's
 * clock, the stroke's own arc reached `p`. These helpers turn that into the
 * row's slot (`delayMs`, `speed`) and its `performed` pace. Nothing here keeps
 * time of its own: the row lands in the same take, through the same commit.
 * ======================================================================== */

/** Why a performed pace cannot be played, or null when it can. */
export function performedFault(pf: unknown): string | null {
  if (!Array.isArray(pf) || pf.length < 2) return "needs at least two samples"
  let prev = 0
  for (let k = 0; k < pf.length; k++) {
    const v = pf[k]
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) return `sample ${k} is ${v}, not in 0..1`
    if (v < prev) return `falls back at sample ${k}`
    prev = v
  }
  if (pf[0] !== 0 || pf[pf.length - 1] !== 1) return "must start at 0 and end at 1"
  return null
}

/** The performed pace at slot fraction u, by linear interpolation. */
export function performedAt(pf: ArrayLike<number>, u: number): number {
  const m = pf.length - 1
  const x = (u <= 0 ? 0 : u >= 1 ? 1 : u) * m
  const k = Math.min(Math.floor(x), m - 1)
  return pf[k] + (pf[k + 1] - pf[k]) * (x - k)
}

/** The first slot fraction at which the pace reaches r. A pause returns its start. */
export function performedInverse(pf: ArrayLike<number>, r: number): number {
  if (!(r > 0)) return 0
  if (r >= 1) {
    for (let k = 0; k < pf.length; k++) if (pf[k] >= 1) return pf.length > 1 ? k / (pf.length - 1) : 1
    return 1
  }
  const m = pf.length - 1
  for (let k = 1; k <= m; k++) {
    if (pf[k] >= r) {
      const d = pf[k] - pf[k - 1]
      return (k - 1 + (d > 0 ? (r - pf[k - 1]) / d : 0)) / m
    }
  }
  return 1
}

export interface PerformSample {
  /** Take time, ms: real time since the take began, times the capture speed. */
  tMs: number
  /** The stroke's own arc reached, 0..1. */
  p: number
}

/** The capture speeds offered. 0.5 runs the take's clock at half speed while he performs. */
export const CAPTURE_SPEEDS = [0.5, 1, 2] as const

/** Smoothing 1 averages the pace over this much take time. */
export const SMOOTH_MS_MAX = 240

/**
 * One stroke's samples into its slot and pace. The slot opens at the last
 * sample before the ink moves and closes at the first sample that reaches the
 * end, so a pause before the first move is delay, and a pause inside is pace.
 * Smoothing is a centred moving average over `smoothing * SMOOTH_MS_MAX` of
 * take time; an average of a rising sequence still rises, and the ends are
 * pinned to 0 and 1. Null when the stroke never reached its end.
 */
export function fitPerformed(
  samples: PerformSample[],
  smoothing: number,
): { t0: number; t1: number; performed: number[] } | null {
  let a = -1
  let b = -1
  for (let k = 0; k < samples.length; k++) {
    if (samples[k].p <= 0) a = k
    else if (a < 0) a = k
    if (samples[k].p >= 1) {
      b = k
      break
    }
  }
  if (a < 0 || b <= a) return null
  const t0 = samples[a].tMs
  const t1 = samples[b].tMs
  const dur = t1 - t0
  if (!(dur > 0)) return null
  // 5 ms bins, so a pause edge lands within a third of a 60 Hz frame (ANIM-2B:
  // 20 ms bins let a 1 s dwell play up to 40 ms short). Full resolution to 8 s.
  const n = Math.max(8, Math.min(1600, Math.ceil(dur / 5)))
  const raw = new Float64Array(n + 1)
  let j = a
  for (let k = 0; k <= n; k++) {
    const t = t0 + (dur * k) / n
    while (j < b && samples[j + 1].tMs < t) j++
    const s0 = samples[j]
    const s1 = samples[Math.min(j + 1, b)]
    const span = s1.tMs - s0.tMs
    raw[k] = span > 0 ? s0.p + (s1.p - s0.p) * Math.min(1, Math.max(0, (t - s0.tMs) / span)) : s1.p
  }
  const half = Math.round(((Math.min(1, Math.max(0, smoothing)) * SMOOTH_MS_MAX) / 2) * (n / dur))
  const out: number[] = new Array(n + 1)
  let prev = 0
  for (let k = 0; k <= n; k++) {
    let sum = 0
    for (let d = -half; d <= half; d++) {
      const q = k + d
      sum += q < 0 ? 0 : q > n ? 1 : raw[q]
    }
    let v = k === 0 ? 0 : k === n ? 1 : sum / (2 * half + 1)
    v = Math.min(1, Math.max(prev, v))
    out[k] = Math.round(v * 1e4) / 1e4
    prev = out[k]
  }
  return { t0, t1, performed: out }
}

/**
 * The pen time Rod is handed for performed stroke i at slot fraction u: the
 * base pace's time at which the stroke's own arc reaches the performed
 * fraction. Rod keeps its own per-stroke clock under a timed take and is only
 * handed a time (ANIM-1A5), so a performed row has to arrive as that time.
 * `[B0, B1] = pace.beatToClock([start, end]) * baseMs`, so u = 0 is B0 and
 * u = 1 is B1, and a flat run in the pace holds the time still.
 */
export function performedPenMs(ts: TimedSchedule, i: number, u: number): number {
  const pf = ts.performed[i]
  const tr = ts.base.tracks[i]
  const r = pf ? performedAt(pf, u) : u < 0 ? 0 : u > 1 ? 1 : u
  // F120: at r = 0 the stroke is on its held beat, which is both a lift's start and
  // its landing; the slot opens at the landing (B0), so read that one.
  if (r <= 0) return ts.pace.beatToLanding(tr.start) * ts.baseMs
  return ts.pace.beatToClock(tr.start + (tr.end - tr.start) * r) * ts.baseMs
}

/** One place a performed stroke stands still: ms on the take's clock, and the global arc. */
export interface PerformedHold {
  stroke: number
  t0: number
  t1: number
  arc: number
}

/**
 * F121 · WHERE AND WHEN EACH PERFORMED STROKE STANDS STILL. One entry per run of
 * equal samples in a stroke's `performed` pace, samples k to j of m:
 * `[t0, t1] = slot0 + slotLen * [k/m, j/m]`, the interval over which
 * `performedPenMs` returns one time, and `arc` is the global arc the pen stands
 * on, walked as `timedFront` walks it. The tip bake turns `arc` into the pen
 * point, so the ink around a stopped pen stops with it. Strokes with no
 * performed pace give none, and a take with none gives an empty list.
 */
/** A pause at least this long is held still on Inflate; shorter flat runs are jitter. */
export const PERFORMED_HOLD_MIN_MS = 50

export function performedHolds(ts: TimedSchedule): PerformedHold[] {
  const out: PerformedHold[] = []
  for (let i = 0; i < ts.performed.length; i++) {
    const pf = ts.performed[i]
    if (!pf || pf.length < 2) continue
    const m = pf.length - 1
    const s0 = ts.slots[i * 2]
    const len = ts.slots[i * 2 + 1] - s0
    const tr = ts.base.tracks[i]
    const span = tr.to - tr.from
    let k = 0
    for (let j = 1; j <= m + 1; j++) {
      if (j <= m && pf[j] === pf[k]) continue
      // A flat run shorter than PERFORMED_HOLD_MIN_MS is hand jitter, not a pause: a stepped pointer
      // leaves dozens of 15 to 30 ms stalls that would crowd the shader's 8 holds (controller, F121-C).
      if (j - 1 > k && (len * (j - 1 - k)) / m >= PERFORMED_HOLD_MIN_MS) {
        const r = pf[k]
        out.push({
          stroke: i,
          t0: s0 + (len * k) / m,
          t1: s0 + (len * (j - 1)) / m,
          arc: tr.reverse ? tr.to - r * span : tr.from + r * span,
        })
      }
      k = j
    }
  }
  return out
}

/**
 * The take with each performed stroke's row written. A re-take of a stroke
 * replaces its row whole: delay, speed and pace, with the ease reset and hold
 * back off. `baseSlots` are the pace's `[B0, B1]` per stroke, ms. Under Ripple
 * the delay subtracts the carry the earlier strokes leave, walked in base
 * order, so each slot opens where he performed it.
 */
export function withPerformed(
  take: StrokeTimingTake,
  baseSlots: ArrayLike<number>,
  fits: Map<number, { t0: number; t1: number; performed: number[] }>,
): StrokeTimingTake {
  const n = baseSlots.length / 2
  const strokes = { ...take.strokes }
  const order = Array.from({ length: n }, (_, i) => i).sort((x, y) => baseSlots[x * 2] - baseSlots[y * 2] || x - y)
  let carry = 0
  for (const i of order) {
    const B0 = baseSlots[i * 2]
    const B1 = baseSlots[i * 2 + 1]
    const f = fits.get(i)
    if (f && B1 > B0) {
      strokes[i] = {
        delayMs: f.t0 - B0 - (take.ripple ? carry : 0),
        speed: (B1 - B0) / (f.t1 - f.t0),
        ease: { kind: "preset", id: "linear" },
        holdBack: false,
        performed: f.performed,
      }
    }
    if (!take.ripple) continue
    const r = strokes[i]
    if (!r || r.holdBack) continue
    const t0 = Math.max(0, B0 + carry + r.delayMs)
    carry = t0 + (B1 - B0) / r.speed - B1
  }
  return { ...take, strokes }
}
