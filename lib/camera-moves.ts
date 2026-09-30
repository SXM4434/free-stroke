/* ============================================================================
 * CAMERA MOVES: named presets that write ordinary camera keys, each tied to a
 * moment in the drawing.
 *
 * His ruling, 2026-09-25 (`docs/rulings/2026-09-25-animation-comes-back.md`):
 * camera moves come back "eased and for a reason". His four asks behind it,
 * all angry: "what the point of these cameer angels we get randomly", and
 * "TEH CAMERA ANGLES CHNAGE ARE ADRUPT AND DONT HAVE ANY EASING". Phase 5 of
 * `docs/research-2026-09-25/animation-tools/DESIGN.md`.
 *
 * ONE SYSTEM. A move is not a second camera. It is a function that returns
 * keys on the `azimuth`, `elevation` and `distance` tracks of `lib/keyframes.ts`,
 * which `KeyCamera` in the viewport already samples from the one clock. Once
 * written they are his keys like any other, to drag and re-ease.
 *
 * A REASON OR NOTHING. Every key lands on a moment the timed schedule names:
 * a pen lift, the last stroke landing, a pause in the draw progress. None is
 * placed by the clock alone. A move that finds no such moment refuses with the
 * reason instead of placing keys somewhere plausible.
 *
 * ALWAYS EASED, NEVER A JUMP. Every key is Easy Ease (`makeKey`). No camera key
 * is `hold` or `linear`, so editing one value later eases instead of snapping.
 * A still stretch is two keys at the same value, which samples exactly flat.
 *
 * THE CLOCK. Slots are take time. With drawProgress keys the reveal reads a
 * remapped clock (`revealClockMs`), so a stroke lands on the clock when the
 * reveal first reaches its slot end, not at the slot's own number. Every
 * moment below goes through that mapping.
 * ========================================================================== */

import {
  makeKey,
  revealClockMs,
  sampleTrack,
  validateKeys,
  validateTrack,
  EASY_EASE_IN,
  EASY_EASE_OUT,
  type Key,
  type TakeKeys,
  type Track,
} from "@/lib/keyframes"

export type CameraTrack = "azimuth" | "elevation" | "distance"

/** Degrees, degrees, and `orbitView`'s fill multiplier (1 fits the form, smaller is closer). */
export interface CameraPose {
  azimuth: number
  elevation: number
  distance: number
}

/** C-A in `docs/hero-animation-options-board.md`: the page facing you. */
export const FRONT: CameraPose = { azimuth: 0, elevation: 0, distance: 1 }
/** C-B in the same board: a person looking at their own notebook, az 20, el 30. */
export const DESK: CameraPose = { azimuth: 20, elevation: 30, distance: 1 }

/** What a move reads. `TimedSchedule` has `slots` and `takeMs`; pass the take's own keys beside them. */
export interface CameraTake {
  /** `[t0, t1]` per stroke, ms, take time: `TimedSchedule.slots`. */
  slots: ArrayLike<number>
  /** `TimedSchedule.takeMs`. */
  takeMs: number
  /** The take's keys. Only `drawProgress` is read: its pauses, and its remap of the clock. */
  keys?: TakeKeys
}

export interface CameraMoveOpts {
  /** Where the move starts. Each move has its own default. */
  from?: Partial<CameraPose>
  /** Degrees the move turns. */
  turnDeg?: number
  /** A pen lift shorter than this is too short to turn in, ms. */
  minLiftMs?: number
  /** Settle to front runs at least this long, ms. */
  minMoveMs?: number
  /** Still time before the depth turn starts, ms. */
  holdMs?: number
  /** Length of each turn in the depth turn, ms. */
  moveMs?: number
  /** Still time at the far end of the depth turn, ms. */
  dwellMs?: number
  /** The depth turn comes back to where it started. */
  returns?: boolean
  /** Lean in multiplies distance by this. */
  leanK?: number
  /** Lean in adds this to elevation, degrees. */
  leanDeg?: number
}

export interface CameraMove {
  id: string
  label: string
  /** The line the picker shows beside the move. */
  reason: string
  tracks: readonly CameraTrack[]
  /** Keys on `tracks` only. Throws with the reason when the take has no moment for it. */
  keys: (take: CameraTake | null | undefined, opts?: CameraMoveOpts) => TakeKeys
}

/* ---- the take on the clock ------------------------------------------------ */

/** A still stretch becomes two keys at one value; every key is Easy Ease. */
const key = (tMs: number, value: number): Key => makeKey(tMs, value)

function refuse(label: string, why: string): never {
  throw new Error(`${label}: ${why}`)
}

interface OnClock {
  /** `[c0, c1]` per stroke on the clock: when the reveal reaches its slot start, and its slot end. */
  windows: [number, number][]
  /** When the last stroke lands on the clock. */
  landingMs: number
}

/**
 * The first clock at which the reveal reaches take time `t`, or null when the
 * draw progress never gets there. Scans 1 ms steps against the running max,
 * then bisects the crossing, so it lands within 1e-9 ms.
 */
function clockFinder(keys: TakeKeys | undefined, takeMs: number): (t: number) => number | null {
  const dp = keys?.drawProgress
  if (!dp || dp.length === 0) return (t) => t
  const endMs = Math.max(0, Math.ceil(dp[dp.length - 1].tMs))
  const reveal = (c: number) => revealClockMs(keys, c, takeMs)
  const runMax = new Float64Array(endMs + 1)
  let m = -Infinity
  for (let c = 0; c <= endMs; c++) runMax[c] = m = Math.max(m, reveal(c))
  return (t) => {
    const want = t - 1e-9
    if (!(runMax[endMs] >= want)) return null
    let lo = 0
    let hi = endMs
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (runMax[mid] >= want) hi = mid
      else lo = mid + 1
    }
    if (lo === 0) return 0
    let a = lo - 1
    let b = lo
    for (let i = 0; i < 48; i++) {
      const mid = (a + b) / 2
      if (reveal(mid) >= want) b = mid
      else a = mid
    }
    return b
  }
}

function onClock(label: string, take: CameraTake | null | undefined): OnClock {
  if (!take) refuse(label, "there is no timed schedule to tie the move to")
  const s = take.slots
  const n = s ? Math.floor(s.length / 2) : 0
  if (!s || n === 0 || s.length % 2 !== 0) refuse(label, "the take has no strokes, so nothing lands for the camera to move with")
  if (!(Number.isFinite(take.takeMs) && take.takeMs > 0)) refuse(label, `the take is ${take.takeMs} ms long, so nothing lands`)
  const bad = validateKeys(take.keys)
  if (bad.length) refuse(label, `the take's keys cannot be read: ${bad.join("; ")}`)
  const clockOf = clockFinder(take.keys, take.takeMs)
  const windows: [number, number][] = []
  let landingMs = -Infinity
  for (let i = 0; i < n; i++) {
    const t0 = s[2 * i]
    const t1 = s[2 * i + 1]
    if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 < t0) refuse(label, `stroke ${i} has slot [${t0}, ${t1}], not a span`)
    const c0 = clockOf(t0)
    const c1 = clockOf(t1)
    if (c0 === null || c1 === null) {
      refuse(label, `the draw progress keys never reach stroke ${i}'s end at ${t1.toFixed(1)} ms, so it never lands`)
    }
    windows.push([c0, c1])
    landingMs = Math.max(landingMs, c1)
  }
  return { windows, landingMs }
}

/** Gaps between the draw windows, merged over every stroke, so an overlapping stroke is never inside a lift. */
function liftsOf(windows: readonly [number, number][]): [number, number][] {
  const w = windows.map((x) => [x[0], x[1]] as [number, number]).sort((a, b) => a[0] - b[0])
  const out: [number, number][] = []
  let end = w[0][1]
  for (let i = 1; i < w.length; i++) {
    if (w[i][0] > end) out.push([end, w[i][0]])
    end = Math.max(end, w[i][1])
  }
  return out
}

function poseOf(opts: CameraMoveOpts | undefined, dflt: CameraPose): CameraPose {
  return { ...dflt, ...(opts?.from ?? {}) }
}

/** Pushes a key, merging it into the last one when both sit at the same time and value. */
function pushKey(track: Key[], tMs: number, value: number) {
  const last = track[track.length - 1]
  if (last && Math.abs(last.tMs - tMs) < 1e-6 && last.value === value) return
  track.push(key(tMs, value))
}

/* ---- the moves ------------------------------------------------------------ */

const ORBIT_LIFTS: CameraMove = {
  id: "orbit-lifts",
  label: "Turn in the lifts",
  reason: "Turns only while the pen is up and holds dead still while each stroke draws, so the depth shows and the line never slides.",
  tracks: ["azimuth"],
  keys(take, opts) {
    const L = ORBIT_LIFTS.label
    const { windows } = onClock(L, take)
    const minLift = opts?.minLiftMs ?? 120
    const lifts = liftsOf(windows).filter(([a, b]) => b - a >= minLift)
    if (lifts.length === 0) {
      refuse(L, `the pen never lifts for ${minLift} ms or more in this take. Each stroke starts as the one before it ends, so there is no still moment to turn in. Open a gap on the strip first`)
    }
    const turn = opts?.turnDeg ?? 30
    const total = lifts.reduce((a, [x, y]) => a + (y - x), 0)
    let cur = poseOf(opts, DESK).azimuth
    const az: Key[] = []
    for (const [a, b] of lifts) {
      pushKey(az, a, cur)
      // In proportion to the lift's length, so every lift turns at the same peak speed.
      cur += (turn * (b - a)) / total
      pushKey(az, b, cur)
    }
    return { azimuth: az }
  },
}

const SETTLE_FRONT: CameraMove = {
  id: "settle-front",
  label: "Settle to front",
  reason: "Starts at the desk angle and eases square to the page as the last stroke lands, so the finished word ends facing you.",
  tracks: ["azimuth", "elevation"],
  keys(take, opts) {
    const L = SETTLE_FRONT.label
    const { windows, landingMs } = onClock(L, take)
    const from = poseOf(opts, DESK)
    if (from.azimuth === FRONT.azimuth && from.elevation === FRONT.elevation) {
      refuse(L, "the camera already starts face-on, so there is nothing to settle")
    }
    const minMove = opts?.minMoveMs ?? 700
    // The latest stroke start that leaves the move its minimum length, else the first stroke's start.
    const starts = windows.map((w) => w[0])
    const early = starts.filter((c) => landingMs - c >= minMove)
    const startMs = early.length ? Math.max(...early) : Math.min(...starts)
    if (!(landingMs > startMs)) refuse(L, "the drawing lands the instant it starts, so there is no time to settle")
    return {
      azimuth: [key(startMs, from.azimuth), key(landingMs, FRONT.azimuth)],
      elevation: [key(startMs, from.elevation), key(landingMs, FRONT.elevation)],
    }
  },
}

const DEPTH_TURN: CameraMove = {
  id: "depth-turn",
  label: "Depth turn",
  reason: "Holds on the finished word, turns it to show its depth, holds, then turns back, so it ends the way it was drawn.",
  tracks: ["azimuth"],
  keys(take, opts) {
    const L = DEPTH_TURN.label
    const { landingMs } = onClock(L, take)
    const a0 = poseOf(opts, FRONT).azimuth
    const turn = opts?.turnDeg ?? 40
    const hold = opts?.holdMs ?? 400
    const move = opts?.moveMs ?? 1000
    const dwell = opts?.dwellMs ?? 600
    if (!(hold >= 0 && move > 0 && dwell >= 0)) refuse(L, `hold ${hold}, move ${move} and dwell ${dwell} ms cannot place a turn`)
    const az: Key[] = []
    pushKey(az, landingMs, a0)
    pushKey(az, landingMs + hold, a0)
    pushKey(az, landingMs + hold + move, a0 + turn)
    if (opts?.returns ?? true) {
      pushKey(az, landingMs + hold + move + dwell, a0 + turn)
      pushKey(az, landingMs + hold + move + dwell + move, a0)
    }
    return { azimuth: az }
  },
}

/** Spans where the draw progress stands still: two keys at one value, or a key that holds. */
function pausesOf(keys: TakeKeys | undefined): [number, number][] {
  const dp = keys?.drawProgress ?? []
  const out: [number, number][] = []
  for (let i = 0; i + 1 < dp.length; i++) {
    if (dp[i].easeOut === "hold" || dp[i].value === dp[i + 1].value) out.push([dp[i].tMs, dp[i + 1].tMs])
  }
  return out
}

const LEAN_IN: CameraMove = {
  id: "lean-in",
  label: "Lean in on the pause",
  reason: "Comes closer and looks down a little while the drawing pauses, so the pause reads as a closer look. The tilt keeps it from reading as a zoom.",
  tracks: ["distance", "elevation"],
  keys(take, opts) {
    const L = LEAN_IN.label
    onClock(L, take)
    const pauses = pausesOf(take!.keys).filter(([a, b]) => b - a >= 200)
    if (pauses.length === 0) {
      refuse(L, "the drawing never pauses for 200 ms or more in this take. Add two draw progress keys at the same value to hold it")
    }
    // The longest pause, the earliest on a tie.
    let p = pauses[0]
    for (const q of pauses) if (q[1] - q[0] > p[1] - p[0]) p = q
    const from = poseOf(opts, DESK)
    const k = opts?.leanK ?? 0.8
    if (!(k > 0)) refuse(L, `lean ${k} is not a positive distance multiplier`)
    return {
      distance: [key(p[0], from.distance), key(p[1], from.distance * k)],
      elevation: [key(p[0], from.elevation), key(p[1], from.elevation + (opts?.leanDeg ?? 8))],
    }
  },
}

export const CAMERA_MOVES: readonly CameraMove[] = [ORBIT_LIFTS, SETTLE_FRONT, DEPTH_TURN, LEAN_IN]

export function cameraMove(id: string): CameraMove | undefined {
  return CAMERA_MOVES.find((m) => m.id === id)
}

/** For the picker: the keys, or the reason the move cannot run on this take. */
export function tryCameraMove(
  move: CameraMove,
  take: CameraTake | null | undefined,
  opts?: CameraMoveOpts,
): { keys: TakeKeys; refused?: undefined } | { keys?: undefined; refused: string } {
  try {
    return { keys: move.keys(take, opts) }
  } catch (e) {
    return { refused: String(e instanceof Error ? e.message : e) }
  }
}

/* ---- thinning: Apple Motion's "Peaks Only" -------------------------------- */

export interface ThinSample {
  tMs: number
  value: number
}

/**
 * A recorded camera path, one sample per frame, reduced to a few eased keys
 * that stay within `tolerance` (the track's own units) of every sample.
 *
 * Apple Motion records a key on every frame and thins it with Keyframe
 * Thinning; this is its "Peaks Only". Keys go first on the turning points,
 * where the path reverses by more than the tolerance, each at rest (Easy
 * Ease), so a turn eases in and out. Then any span that misses a sample by
 * more than the tolerance gets a key at its worst sample, with a handle that
 * carries the path's speed through, so a key in the middle of a pan does not
 * stop it. A hold comes out as a flat span between two keys.
 */
export function thinKeys(samples: readonly ThinSample[], tolerance: number): Track {
  const bad: string[] = []
  if (!Array.isArray(samples) || samples.length === 0) bad.push("no samples to thin")
  if (!(Number.isFinite(tolerance) && tolerance > 0)) bad.push(`tolerance ${tolerance} is not a positive number`)
  else {
    const asKeys = samples.map((s) => key(s?.tMs, s?.value))
    for (const r of validateTrack(asKeys)) bad.push(r.replace(/^key /, "sample "))
  }
  if (bad.length) throw new Error(`Thin keys: ${bad.join("; ")}`)
  const n = samples.length
  const t = samples.map((s) => s.tMs)
  const v = samples.map((s) => s.value)
  if (n === 1) return [key(t[0], v[0])]

  // Turning points with hysteresis: a reversal counts once it passes the tolerance.
  const keep = new Set<number>([0, n - 1])
  const atRest = new Set<number>([0, n - 1])
  let dir = 0
  let ext = 0
  for (let i = 1; i < n; i++) {
    if (dir === 0) {
      if (Math.abs(v[i] - v[0]) > tolerance) {
        dir = Math.sign(v[i] - v[0])
        ext = i
      }
    } else if ((v[i] - v[ext]) * dir > 0) ext = i
    else if ((v[ext] - v[i]) * dir > tolerance) {
      keep.add(ext)
      atRest.add(ext)
      dir = -dir
      ext = i
    }
  }

  // The path's speed at a sample: the harmonic mean of the two secants 3 samples out, 0 where they disagree.
  const slopeAt = (i: number) => {
    if (atRest.has(i)) return 0
    const a = Math.max(0, i - 3)
    const b = Math.min(n - 1, i + 3)
    const sl = (v[i] - v[a]) / (t[i] - t[a])
    const sr = (v[b] - v[i]) / (t[b] - t[i])
    return sl * sr <= 0 ? 0 : 2 / (1 / sl + 1 / sr)
  }
  const build = (idx: number[]): Key[] =>
    idx.map((i, j) => {
      const out: Key = { tMs: t[i], value: v[i], easeOut: EASY_EASE_OUT, easeIn: EASY_EASE_IN }
      const s = slopeAt(i)
      const nx = idx[j + 1]
      const pv = idx[j - 1]
      if (nx !== undefined && v[nx] !== v[i]) out.easeOut = { x: 1 / 3, y: (s * (t[nx] - t[i])) / (v[nx] - v[i]) / 3 }
      if (pv !== undefined && v[pv] !== v[i]) out.easeIn = { x: 2 / 3, y: 1 - (s * (t[i] - t[pv])) / (v[i] - v[pv]) / 3 }
      return out
    })

  for (;;) {
    const idx = [...keep].sort((a, b) => a - b)
    const track = build(idx)
    let added = false
    for (let j = 0; j + 1 < idx.length; j++) {
      let worst = -1
      let worstErr = tolerance
      for (let i = idx[j] + 1; i < idx[j + 1]; i++) {
        const err = Math.abs(sampleTrack(track, t[i])! - v[i])
        if (err > worstErr) {
          worstErr = err
          worst = i
        }
      }
      if (worst >= 0) {
        keep.add(worst)
        added = true
      }
    }
    if (!added) return track
  }
}
