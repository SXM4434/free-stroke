// THE 620-DEGREE INSTRUMENT, REPRODUCED — not cited.
//
// `scripts/verify/lib/elbow-geom.mjs`'s header records that the FIRST version of
// the corner probe reported a 620 degree turn and an 8.4r fillet on a synthetic
// whose fillet is ZERO BY CONSTRUCTION, identically to four decimal places on
// all four synthetics. That claim was inherited from a lane that died, and a
// citation is not evidence — it is a claim that evidence exists. So the old
// method is REBUILT here, verbatim to its description, and run against the same
// closed-form synthetics the current instrument is calibrated on.
//
// A 620 degree turn on a 90 degree corner is not a measurement error. It is a
// broken formula, and this file names which part of it is broken by measuring
// each part separately:
//
//   1. THE FRAME IS POLAR, AND POLAR DIVERGES HERE. The armpit of a 90 degree
//      elbow is bounded by two walls PARALLEL to the legs, so about the drawn
//      corner
//                 rho(phi) = sqrt(2) r / (cos phi -/+ sin phi)
//      which is 1.414r on the bisector and -> infinity as phi -> +/-45 deg.
//      Past |phi| ~ 24 deg the launch point at a FIXED 3.2r is INSIDE the solid,
//      so the "first surface met coming inward" is a wall on the far side of the
//      corner and `start - t` goes NEGATIVE. The reconstructed contour then
//      teleports across the corner and back.
//   2. THE TURN IS UNSIGNED. `acos(dot)` cannot cancel. Facet noise on a
//      straight wall ACCUMULATES, so the error is monotonically positive: an
//      unsigned turn integral can only ever inflate the answer.
//
// Both are measured below, and the ARTEFACT IS SHOWN TO BE SET BY THE LEGS
// RATHER THAN BY THE CORNER — which is why all four rows agreed to four
// decimals, and why the reading did not move when the thing it measures moved by
// half a tube radius.
//
// Pure Node, no renderer. Run: node scripts/verify/_probe-elbow-turnwidth.mjs
import { syntheticElbow, SYNTH_FRAME, castRay, analyseCorner } from "./lib/elbow-geom.mjs"

const R = 0.06
const DEG = 180 / Math.PI

/**
 * THE OLD PROBE, rebuilt from its description.
 *
 * Sample rho(theta) over +/- `spanDeg` of the inward bisector, each ray cast
 * inward from a launch CIRCLE of radius `startR` * r. Reconstruct the contour in
 * cartesian, accumulate UNSIGNED turning, and take the width as the shortest
 * contiguous arc-length window carrying `frac` of that turn.
 */
function turnWidthPolar(segs, c, bis, r, { spanDeg = 40, startR = 3.2, n = 401, frac = 0.8 } = {}) {
  const theta0 = Math.atan2(bis.y, bis.x)
  const start = r * startR
  const pts = []
  let negatives = 0
  let misses = 0
  let rhoMax = 0
  for (let i = 0; i < n; i++) {
    const phi = ((-spanDeg + (2 * spanDeg * i) / (n - 1)) * Math.PI) / 180
    const th = theta0 + phi
    const dx = Math.cos(th)
    const dy = Math.sin(th)
    const t = castRay(segs, c.x + dx * start, c.y + dy * start, -dx, -dy)
    if (!Number.isFinite(t)) {
      misses++
      continue
    }
    const rho = start - t
    if (rho < 0) negatives++
    if (Math.abs(rho) > rhoMax) rhoMax = Math.abs(rho)
    pts.push([c.x + dx * rho, c.y + dy * rho])
  }
  // Unsigned turning — the second defect, on its own.
  let total = 0
  const turn = new Float64Array(pts.length)
  const arc = new Float64Array(pts.length)
  for (let i = 1; i < pts.length; i++) {
    arc[i] = arc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  }
  for (let i = 1; i < pts.length - 1; i++) {
    const ax = pts[i][0] - pts[i - 1][0]
    const ay = pts[i][1] - pts[i - 1][1]
    const bx = pts[i + 1][0] - pts[i][0]
    const by = pts[i + 1][1] - pts[i][1]
    const la = Math.hypot(ax, ay)
    const lb = Math.hypot(bx, by)
    if (la < 1e-14 || lb < 1e-14) continue
    const d = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)))
    turn[i] = Math.acos(d) // UNSIGNED — the defect
    total += turn[i]
  }
  // Greedy shortest window carrying `frac` of the (unsigned) turn.
  let best = Infinity
  let lo = 0
  let acc = 0
  for (let hi = 0; hi < pts.length; hi++) {
    acc += turn[hi]
    while (acc - turn[lo] >= frac * total && lo < hi) {
      acc -= turn[lo]
      lo++
    }
    if (acc >= frac * total) best = Math.min(best, arc[hi] - arc[lo])
  }
  const width = Number.isFinite(best) ? best : 0
  return {
    totalTurnDeg: total * DEG,
    width,
    filletOverR: total > 1e-12 ? width / (frac * total) / r : 0,
    negatives,
    misses,
    rhoMaxOverR: rhoMax / r,
    samples: pts.length,
  }
}

console.log("\nTHE OLD POLAR PROBE, ON SYNTHETICS WHOSE ANSWER IS KNOWN IN CLOSED FORM")
console.log("(inner armpit fillet q/r is the INPUT; a working probe returns it)\n")
console.log("   q/r    OLD turn(deg)   OLD fillet/r    rho_max/r   rho<0 samples   NEW fillet/r")
const oldRows = []
for (const q of [0, 0.1, 0.25, 0.5]) {
  const segs = syntheticElbow(R, q, 1)
  const old = turnWidthPolar(segs, SYNTH_FRAME.c, SYNTH_FRAME.bis, R)
  const now = analyseCorner(segs, SYNTH_FRAME.c, SYNTH_FRAME.bis, SYNTH_FRAME.legs, R)
  oldRows.push({ q, ...old, nowFillet: now.innerFilletOverR })
  console.log(
    `   ${q.toFixed(2)}   ${old.totalTurnDeg.toFixed(4).padStart(10)}   ${old.filletOverR
      .toFixed(4)
      .padStart(10)}      ${old.rhoMaxOverR.toFixed(2).padStart(7)}      ${String(old.negatives).padStart(6)}        ${now.innerFilletOverR.toFixed(4)}`,
  )
}

const spread = Math.max(...oldRows.map((r) => r.totalTurnDeg)) - Math.min(...oldRows.map((r) => r.totalTurnDeg))
const filletSpread = Math.max(...oldRows.map((r) => r.filletOverR)) - Math.min(...oldRows.map((r) => r.filletOverR))
console.log(
  `\n   OLD reading spread across a 0 -> 0.5r change in the thing being measured:` +
    ` turn ${spread.toFixed(4)} deg, fillet ${filletSpread.toFixed(4)} r`,
)
console.log(
  `   NEW reading spread across the same inputs:` +
    ` fillet ${(Math.max(...oldRows.map((r) => r.nowFillet)) - Math.min(...oldRows.map((r) => r.nowFillet))).toFixed(4)} r`,
)

/* ---- WHERE THE EXTRA ~530 DEGREES COME FROM --------------------------------
 * Split the two defects apart. The polar sampling is the first; the unsigned
 * accumulation is the second. Measured on the HARD corner (q = 0), whose true
 * armpit turn is exactly 90 degrees. */
console.log("\nDEFECT 1 — the polar window, isolated by shrinking it below the divergence")
console.log("   span(deg)   turn(deg)   rho<0   rho_max/r   (true answer: 90)")
for (const span of [40, 30, 24, 20, 10]) {
  const segs = syntheticElbow(R, 0, 1)
  const m = turnWidthPolar(segs, SYNTH_FRAME.c, SYNTH_FRAME.bis, R, { spanDeg: span })
  console.log(
    `   ${String(span).padStart(6)}      ${m.totalTurnDeg.toFixed(2).padStart(8)}   ${String(m.negatives).padStart(5)}     ${m.rhoMaxOverR.toFixed(2).padStart(7)}`,
  )
}

console.log("\nDEFECT 2 — the artefact is set by the LEGS, not by the corner")
console.log("   the same window on a STRAIGHT wall (no corner at all: true turn = 0)")
{
  // A straight strip, sampled with the identical polar window about a point on
  // its surface. Any turn reported here is pure artefact.
  const L = R * 8
  const strip = []
  const P = [
    [-L, -R],
    [L, -R],
    [L, R],
    [-L, R],
  ]
  for (let i = 0; i < 4; i++) {
    const a = P[i]
    const b = P[(i + 1) % 4]
    strip.push([a[0], a[1], b[0], b[1]])
  }
  const m = turnWidthPolar(strip, { x: 0, y: 0 }, { x: 0, y: 1 }, R)
  console.log(
    `   turn ${m.totalTurnDeg.toFixed(2)} deg, rho<0 on ${m.negatives}/${m.samples} samples, rho_max ${m.rhoMaxOverR.toFixed(2)}r`,
  )
}

console.log("\nTHE CLOSED FORM THE WINDOW WALKS OFF THE END OF")
console.log("   phi(deg)   rho/r = sqrt(2)/(cos phi - sin phi)   launch at 3.2r is...")
for (const phi of [0, 10, 20, 24, 30, 40]) {
  const p = (phi * Math.PI) / 180
  const rho = Math.SQRT2 / (Math.cos(p) - Math.sin(p))
  console.log(
    `   ${String(phi).padStart(6)}     ${rho.toFixed(3).padStart(10)}                        ${rho > 3.2 ? "INSIDE the solid" : "outside"}`,
  )
}
console.log("")
