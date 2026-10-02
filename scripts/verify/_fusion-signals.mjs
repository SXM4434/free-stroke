// THE ONE DERIVATION OF "what signals does the viewport hand `evaluateFusion`
// this frame" — extracted, because there were three copies of it.
//
// ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
// `assert-fusion-rail.mjs` already carried this warning, verbatim, above its
// own private copy:
//
//   > Two copies of one derivation is a duplicate worth naming: if a third
//   > appears, it moves into lib/.
//
// A third appeared — `assert-fusion-combos.mjs` needs the same traveller with
// two extra freedoms (a camera it can hold still, and a playhead it can run) —
// so this is that move. `assert-fusion-newborn.mjs:205-214` holds the original
// `worstExcursion` derivation this is descended from.
//
// ── ⚠ A WRONG-SHAPED SIGNAL MANUFACTURES A RED, AND DID ────────────────────
// The first version of the rail gate passed `{ orbitAzimuth, strokeCount }`,
// which is not `FusionSignals` at all — so `orbit`, `stackTime` and every layer
// phase resolved to 0 and stayed there, and it reported viewTurn, slowWeather
// and formation as dead. All three are link-authored built-ins whose drivers
// are exactly those fields. **The instrument was the dead thing, not the
// presets.** That is why the shape is derived here from `FusionSignals`'s own
// field list and nowhere else.
//
// ── AND WHY THE PHASES COME OFF THE STATE'S OWN DIALS ──────────────────────
// A layer this state does not animate contributes a PINNED phase. That is not
// an oversight to be assumed away — it is the exact condition the ORIGINAL
// fusion defect lived in (`phaseTriangle(0) = 0`, so the relationship
// multiplies by exactly nothing), and it has to stay reproducible or no gate
// here can carry a known-bad.

/** Degrees per second -> radians per second. `orbit` is in RADIANS
 *  (`FusionSignals.orbit`), and `FUSION_VIEW_SPIN_DEG` is in degrees, so this
 *  is the only place the two units meet. */
export const spinRad = (degPerSec) => (degPerSec * Math.PI) / 180

/**
 * The signals the viewport would be writing at time `t` for this state.
 *
 * @param st      a StyleState
 * @param t       seconds since armed
 * @param orbit   camera azimuth in RADIANS at `t`. A function so a caller can
 *                HOLD the camera (`() => 0`) — which is where the page actually
 *                sits — or run the turntable the wake starts.
 */
export function signalsAt(st, t, orbit = (u) => 0.6 + u * 0.05) {
  const cellRate = st.asciiScrollSpeed * 1.6
  const sig = {
    asciiTime: 0,
    ditherTime: 0,
    textureTime: 0,
    stackTime: 0,
    stackAmount: 1,
    orbit: orbit(t),
  }
  if (st.asciiAnimated && st.asciiAnimationType !== "none") sig.asciiTime = t * cellRate
  if (st.ditherAnimated) sig.ditherTime = t * st.ditherSpeed * 6
  if (st.textureAnimated) sig.textureTime = t * st.textureSpeed * 1.2
  if (st.layerStackEnabled && st.stackAnimationEnabled && st.stackAnimationType !== "none")
    sig.stackTime = t * 0.5
  return sig
}

/**
 * How far each numeric field of the `FusionFrame` travels over one window.
 *
 * @returns `[[field, span], …]` sorted loudest first, `[]` for a relationship
 *          that never moves, and `null` when `evaluateFusion` returned null at
 *          any sample (the preset did not take) — which is a DIFFERENT verdict
 *          from "still" and callers must keep them apart.
 *
 * `reveal` defaults to a FINISHED mark, because that is where a viewer sits.
 * Pass `(t, seconds) => t / seconds` for the draw arm — the only state in which
 * a `reveal` link can move at all.
 *
 * `sinceCompletion` follows the clock's own sentinel rule
 * (`lib/style-clock.ts`): `Infinity` means "has not happened", so a running
 * draw leaves every completion-driven branch silent instead of firing it at
 * t = 0. Getting this wrong would make a `completion` link look alive during a
 * draw it cannot have heard yet.
 */
export function travelOf(F, state, opt = {}) {
  const seconds = opt.seconds ?? 12
  const samples = opt.samples ?? 48
  const eps = opt.eps ?? 0.002
  const orbit = opt.orbit ?? ((t) => 0.6 + t * 0.05)
  const reveal = opt.reveal ?? (() => 1)

  const frames = []
  for (let i = 0; i < samples; i++) {
    const t = (i / (samples - 1)) * seconds
    const rv = Math.max(0, Math.min(1, reveal(t, seconds)))
    const clock = { elapsed: t, reveal: rv, sinceCompletion: rv >= 1 ? t : Infinity }
    frames.push(F.evaluateFusion(state, clock, signalsAt(state, t, orbit), t))
  }
  if (frames.some((f) => f === null)) return null

  const keys = Object.keys(frames[0]).filter((k) => typeof frames[0][k] === "number")
  const out = []
  for (const k of keys) {
    const vals = frames.map((f) => f[k])
    const d = Math.max(...vals) - Math.min(...vals)
    if (d > eps) out.push([k, d])
  }
  return out.sort((a, b) => b[1] - a[1])
}
