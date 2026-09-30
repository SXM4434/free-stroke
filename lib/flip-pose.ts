/**
 * THE FLIP'S POSE, moved out of hero-motion.ts on 2026-09-26 (lane FLIP-1) so
 * the viewport on `/` and the hero lab read one copy of the turn.
 * hero-motion.ts imports everything below back and re-exports the three names
 * it exported before, so no importer of hero-motion.ts changes.
 *
 * Moved verbatim, comments included: no number, curve or branch changed. The
 * only edits are `export` on each declaration and `turnPose`'s `e` typed as
 * `FlipLook`, the two fields of `HeroEmerge` it reads, so this file imports
 * nothing from hero-motion.ts. `scripts/verify/assert-flip-pose.mjs` holds the
 * move to a frozen copy of the old functions, exactly.
 */

/** The two fields of `HeroEmerge` the turn reads. `HeroEmerge` satisfies it. */
export interface FlipLook {
  turnShade: number
  edgeFloor: number
}

/* ---- curves --------------------------------------------------------------- */

export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t)
export const DEG = Math.PI / 180

/**
 * THE TURN'S EASING. Ported verbatim from
 * `docs/reference-original/compose.ORIGINAL-FLIP.mjs:40` (commit f9010da) —
 * the compositor that produced the flip this beat is rebuilt from. Its own
 * comment says why nothing stronger works, and it is worth keeping whole:
 *
 *   "The card's on-screen width is |cos(angle)|, which is already slow at the
 *    ends and fast in the middle. Easing the angle on top of that compounds:
 *    quart stacked on cos left ~0.25s of visually dead card at each end (reads
 *    draggy) and a 1-frame blink through edge-on. Cubic keeps the commit/settle
 *    readable while still whipping through edge-on."
 *
 * That compounding is the single thing most likely to be got wrong on a
 * rebuild, which is why the curve is ported rather than re-chosen.
 */
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/**
 * A CSS cubic-bezier timing function, evaluated. Exists so Desk Doodles' own
 * flip curve can be used as the number it is rather than eyeballed into the
 * nearest closed-form ease.
 *
 * Newton-Raphson on x with a bisection fallback, which is what browsers do.
 */
export function cubicBezierEase(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (t: number) => number {
  const A = (a: number, b: number) => 1 - 3 * b + 3 * a
  const B = (a: number, b: number) => 3 * b - 6 * a
  const C = (a: number) => 3 * a
  const calc = (t: number, a: number, b: number) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t
  const slope = (t: number, a: number, b: number) =>
    3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a)

  return (t: number) => {
    const x = clamp01(t)
    if (x === 0 || x === 1) return x
    let guess = x
    for (let i = 0; i < 8; i++) {
      const d = slope(guess, x1, x2)
      if (d === 0) break
      guess -= (calc(guess, x1, x2) - x) / d
    }
    // Bisection safety net for the flat regions Newton walks off.
    if (guess < 0 || guess > 1) {
      let lo = 0
      let hi = 1
      guess = x
      for (let i = 0; i < 20; i++) {
        const v = calc(guess, x1, x2)
        if (Math.abs(v - x) < 1e-5) break
        if (v > x) hi = guess
        else lo = guess
        guess = (lo + hi) / 2
      }
    }
    return calc(guess, y1, y2)
  }
}

/**
 * DESK DOODLES' OWN FLIP CURVE, ported verbatim.
 *
 *   `animation: dd-cardflip ${FLIP_MS}ms cubic-bezier(0.45, 0, 0.2, 1) both`
 *   — DeskDoodlesHome.tsx:672
 *
 * Their flip is a CSS `scaleX` card-turn that HARD-SWAPS the 2D and 3D faces at
 * the edge-on midpoint, specifically so the two never co-exist on screen: their
 * own comment says overlapping them "looked like a double-image + pop". The
 * mechanism is therefore not something to copy — hiding the handoff is the
 * opposite of showing it. The curve is. It is the shape they settled on for
 * exactly this gesture, and it comes across whole.
 */
export const ddFlipEase = cubicBezierEase(0.45, 0, 0.2, 1)

/* ---- the turn's law, shared by both turns ---------------------------------
 * Factored out rather than copied, because the return IS the same turn: same
 * `|cos|` width law, same shade term, same authored dwell, same one centre.
 * Two copies of a law is how a rebuild loses one of them.
 *
 * The expressions are byte-for-byte what `sampleEmerge` computed inline before
 * the return existed, in the same order, so the ported numbers are unchanged —
 * `assert-hero-turn.mjs` reads them off `sampleEmerge` and is the check on
 * that. */

/**
 * Where in the turn `local` falls, with the DWELL spliced in at the midpoint
 * rather than eased into the curve. See `sampleEmerge`'s long note: the
 * original's two-frame dwell is a property of its 26-frame sampling, and this
 * beat runs on a continuous scrubbable clock where `u` never lands on 0.5, so
 * the dwell has to be an authored duration or the moment silently does not
 * exist. It measurably did not.
 */
export function turnPhase(local: number, beatSec: number, dwellSec: number) {
  const dwell = Math.max(0, dwellSec)
  const turnSec = Math.max(1e-6, beatSec - dwell)
  const halfTurn = turnSec / 2
  let u: number
  let inDwell = false
  if (local < halfTurn) {
    u = local / turnSec
  } else if (local < halfTurn + dwell) {
    u = 0.5
    inDwell = true
  } else {
    u = (local - dwell) / turnSec
  }
  return { u: clamp01(u), inDwell, turnSec, halfTurn, dwell }
}

/**
 * The pose at turn progress `u`. Ported whole from
 * `compose.ORIGINAL-FLIP.mjs:195-200`:
 *
 *   const t     = easeInOutCubic(i / flipN)
 *   const angle = t * Math.PI                                   // 0..180deg
 *   const sx    = Math.max(Math.abs(Math.cos(angle)), 0.035)
 *   const shade = 0.35 * (1 - sx)
 *
 * `yaw` is the one thing that cannot be a literal port — see `sampleEmerge`.
 */
export function turnPose(u: number, e: FlipLook, landYawRad = 0, reverse = false) {
  const angle = easeInOutCubic(u) * Math.PI
  const half = Math.PI / 2

  /* ---- landYaw 0 IS THE PORTED LAW, EVALUATED THE PORTED WAY ---------------
   * Not a special case for tidiness — a special case for BYTE-IDENTITY.
   * `assert-hero-turn.mjs`'s width-law row compares this sampler against a
   * re-computation of `compose.ORIGINAL-FLIP.mjs:195-200` and passes at
   * `max |delta| 3.22e-15`, i.e. it is asserting the FLOATING-POINT result.
   * `cos(pi - a)` and `-cos(a)` are equal in mathematics and differ by an ULP
   * in doubles, so routing the shipped turn through the general expression
   * below would move that number for no reason at all. The general branch is
   * exercised only when a shape actually asks for a landing. */
  if (!(landYawRad > 0)) {
    const sx = Math.max(Math.abs(Math.cos(angle)), e.edgeFloor)
    return { angle, sx, shade: e.turnShade * (1 - sx), yaw: angle <= half ? angle : Math.PI - angle }
  }

  /* ---- A TURN THAT LANDS SHORT ---------------------------------------------
   * The shipped turn is symmetric: out to the edge, back to head-on. O1 keeps
   * the OUT half exactly — that is where B1's 87 % wind-up breakdown was
   * measured and it must not move — and remaps only the half after the dwell,
   * so the mark comes back to `landYaw` instead of to 0.
   *
   * On the RETURN the two halves swap roles: the mark starts at `landYaw`,
   * turns out to its edge, and comes home to 0. So `reverse` runs the same two
   * segments in the other order, and the return's cushion sits on the outside
   * of the turn on both sides exactly as the out-turn's does.
   *
   * The width law follows the yaw rather than the angle, which it already did
   * everywhere the two agreed: at landYaw 0 the second half has
   * `yaw = pi - angle` and `|cos|` of the two is the same number. The visible
   * consequence is the point of the whole option — the beat settles at
   * `cos 38 deg = 0.788` of full width, a 21 % silhouette change against the
   * shipped landing's zero. */
  const outward = angle <= half
  const t = outward ? angle / half : (angle - half) / half
  const yaw = reverse
    ? outward
      ? landYawRad + (half - landYawRad) * t // landYaw -> edge
      : half - half * t //                      edge -> head-on
    : outward
      ? half * t //                             head-on -> edge
      : half - (half - landYawRad) * t //       edge -> landYaw

  const sx = Math.max(Math.abs(Math.cos(yaw)), e.edgeFloor)
  return { angle, sx, shade: e.turnShade * (1 - sx), yaw }
}

/**
 * F118 · the lit solid's depth at `yaw` on either whole-word turn. Full depth at
 * the landing pose, `flatDepth` edge-on, `cos(yaw)^2` between (normalised to the
 * landing, so a turn that lands at 38 deg still reaches 1 there). Stems are round
 * tubes that keep their width while the letter spacing shrinks by cos(yaw), so a
 * full-depth word turned to 75 deg stacks into one black sliver; thinning the
 * body with the turn is what stops that.
 */
export function solidDepthAt(yaw: number, landRad: number, flatDepth: number): number {
  const c = Math.cos(yaw)
  const cl = Math.cos(landRad)
  const w = Math.min(1, (c * c) / (cl * cl))
  // Near the edge the solid keeps SOLID_EDGE_DEPTH, so the edge is a sliver and
  // not a blank page. sin(yaw)^8 is under the cos^2 law below about 50 deg, so
  // the mid-turn still thins and the letters still do not stack.
  const s2 = Math.sin(yaw) ** 2
  const edge = SOLID_EDGE_DEPTH * s2 * s2 * s2 * s2
  return flatDepth + (1 - flatDepth) * Math.max(w, edge)
}

/**
 * F118, 2026-09-25 · the lit solid's depth exactly edge-on, as a fraction of full.
 * With both dwells at `flatDepth` the edge was a 0.004-deep card seen side-on, so
 * about 3 painted frames on each turn showed a blank page where the sliver should
 * be. Only the SOLID carries it: the emerge dwell is already the solid, and the
 * return dwell is made the solid too (flat 0, no carve, no breaks), because the
 * carve cutting a thick body is the white ghost outline he rejected.
 */
export const SOLID_EDGE_DEPTH = 0.5

/**
 * F118, 2026-09-25 · the lit solid's shade, darkened as it thins. The depth
 * squash flattens the tube's normals toward the face normal, so a thin solid
 * shades as one plate, and on the turn-in that plate read lighter than the
 * settled solid (assert-hero-transition's wash row, dark core 39 against 33).
 * `(1 - depth)^4` reaches only the thinnest frames: it is 0 at the landing, so
 * the settled solid is unchanged, and about 0.02 on the edge sliver.
 */
export const THIN_SOLID_SHADE = 0.28
export function solidShade(shade: number, depth: number): number {
  const t = 1 - depth
  return shade + THIN_SOLID_SHADE * t * t * t * t
}

/* ---- the flip, as one call -------------------------------------------------
 * `flipPoseAt` is the flat-to-solid turn and its return, composed from the law
 * above exactly the way `sampleEmerge` and `sampleReturn` compose it in
 * hero-motion.ts for the turn shapes ("shipped", "turnLands", "solidFirst"),
 * same expressions in the same order, so the viewport on `/` and the lab get
 * the same numbers. `assert-flip-pose.mjs` holds the two to exact equality.
 *
 * Seconds, not milliseconds: the law runs in seconds, and converting at this
 * boundary would move results by a rounding step against the lab. A caller on a
 * millisecond clock divides once at the call site. */

export type FlipDirection = "flatToSolid" | "solidToFlat"

export interface FlipOpts extends FlipLook {
  /** Off returns null, so the caller keeps its own pose. */
  on: boolean
  direction: FlipDirection
  /** Clock time the turn starts at, seconds. */
  startSec: number
  /** The whole turn, out-turn plus dwell plus in-turn, seconds. The value hm
   *  passes as `beats.emerge` (flat to solid) or `beats.returnTurn` (back). */
  beatSec: number
  /** The edge-on hold spliced in at the midpoint, seconds. hm: `emerge.dwellSec`. */
  dwellSec: number
  /** Landing angle in degrees. 0 comes back head-on, which is the shipped turn. */
  landYaw: number
  /** Thickness of the flat card, 0..1. hm: `emerge.flatDepth`. */
  flatDepth: number
}

export interface FlipPose {
  /** 1 while the mark is flat ink, 0 once it is the lit solid. hm calls it `flat`. */
  ink: number
  depth: number
  /** Radians. */
  yaw: number
  shade: number
  /** On-screen width as a fraction of full. */
  sx: number
  /** True on the edge-on hold. */
  inDwell: boolean
}

export function flipPoseAt(clockSec: number, o: FlipOpts): FlipPose | null {
  if (!o.on) return null
  const landRad = Math.max(0, o.landYaw) * DEG
  const local = clockSec - o.startSec
  const beat = o.beatSec

  if (o.direction === "flatToSolid") {
    // sampleEmerge: before the beat, the drawing.
    if (local <= 0) return { ink: 1, depth: o.flatDepth, yaw: 0, shade: 0, sx: 1, inDwell: false }
    // sampleEmerge: `landedPose(p)`.
    if (local >= beat) return { ink: 0, depth: 1, yaw: landRad, shade: 0, sx: Math.abs(Math.cos(landRad)), inDwell: false }
    const { u, inDwell } = turnPhase(local, beat, o.dwellSec)
    const { sx, shade, yaw } = turnPose(u, o, landRad)
    const flat = u < 0.5 ? 1 : 0
    const depth = flat ? o.flatDepth : solidDepthAt(yaw, landRad, o.flatDepth)
    if (inDwell) {
      const edgeDepth = solidDepthAt(Math.PI / 2, landRad, o.flatDepth)
      return { ink: 0, depth: edgeDepth, yaw: Math.PI / 2, shade: solidShade(o.turnShade * (1 - o.edgeFloor), edgeDepth), sx: o.edgeFloor, inDwell: true }
    }
    return { ink: flat, depth, yaw, shade: flat ? shade : solidShade(shade, depth), sx, inDwell: false }
  }

  // sampleReturn: before the beat, `solidBefore(p)`, the landed solid.
  if (local <= 0) return { ink: 0, depth: 1, yaw: landRad, shade: 0, sx: Math.abs(Math.cos(landRad)), inDwell: false }
  // sampleReturn: after it, the drawing.
  if (local >= beat) return { ink: 1, depth: o.flatDepth, yaw: 0, shade: 0, sx: 1, inDwell: false }
  const { u, inDwell } = turnPhase(local, beat, o.dwellSec)
  const { sx, shade, yaw } = turnPose(u, o, landRad, true)
  if (inDwell) {
    const edgeDepth = solidDepthAt(Math.PI / 2, landRad, o.flatDepth)
    return { ink: 0, depth: edgeDepth, yaw: Math.PI / 2, shade: solidShade(o.turnShade * (1 - o.edgeFloor), edgeDepth), sx: o.edgeFloor, inDwell: true }
  }
  const past = u >= 0.5
  const depth = past ? o.flatDepth : solidDepthAt(yaw, landRad, o.flatDepth)
  return { ink: past ? 1 : 0, depth, yaw, shade: past ? shade : solidShade(shade, depth), sx, inDwell: false }
}
