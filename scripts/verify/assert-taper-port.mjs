/**
 * THE TAPER ZONE BELONGS TO THE PEN, NOT TO HOW LONG THE STROKE IS.
 *
 * F71, 2026-08-28. Both engine families run the same ink profile with the same
 * tip fraction (0.035/0.22 = 0.159, ported deliberately by the adapter) and the
 * same exponent (0.8). Only the SPAN differed. Free Stroke bounds the end zone
 * at `INFLATE_TAPER_SPAN_DIAMETERS`; the Desk Doodles port ran `sin(pi*u)^exp`
 * over the WHOLE stroke, so how much of a mark is thin is a function of how
 * long the mark happens to be.
 *
 * Measured on the hero `D` before this landed: **65.1 % of the stroke under
 * 90 % of full width on the port, against 3.7 % on Free Stroke.** On the render
 * that was a stem leaving the crossing at 6 px against an 18 px plateau, and a
 * cold Codex read of the shipped AB named it without being told what to look
 * for: *"the stem narrows sharply where it leaves the crossing, so the joint
 * still feels pinched."*
 *
 * ── WHAT THIS GATE ASSERTS, AND WHAT IT REFUSES TO ────────────────────────
 *
 * It is NOT "the ink got thicker". Thicker ink is what a wider radius does too.
 * The rows below are the things that are true of a BOUNDED taper and false of
 * a heavier pen:
 *
 *   A. THE TAPER ZONE IS FIXED, NOT PROPORTIONAL. The same pen over a stroke
 *      twice as long must leave the same ABSOLUTE length thin. Under the
 *      unbounded sine that length doubles, which is the defect in one row.
 *   B. THE TWO FAMILIES AGREE. The port's under-90 % fraction must land on
 *      Free Stroke's, computed from Free Stroke's own profile over the same
 *      centreline. Neither number is typed here.
 *   C. A CLOSED LOOP HAS NO END TAPER. Every ring at full width.
 *   D. KNOWN-BAD: the shipped port, `taperSpanDiameters` omitted. Its
 *      under-90 % fraction must be far outside the bound, and its taper length
 *      must scale with the stroke. If that arm ever comes back bounded, this
 *      gate is measuring nothing.
 *   E. THE DEFAULT IS STILL THE PORT. With no options the profile must be
 *      bit-identical to `sin(pi*u)^exp`, so nothing that imports
 *      `buildInflateGeometry` outside this repo's adapter moved.
 *
 * `buildInflateGeometry` returns its own `ringRadii`, so every row reads the
 * geometry the engine actually built. No browser: this is arithmetic over the
 * real builder.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { ROOT, loadTs } from "./_ts-load.mjs"

const S3 = loadTs("lib/dd-engine/strokeTo3d.ts")
const GE = loadTs("lib/geometry-engines.ts")
const THREE = (await import("three")).default ?? (await import("three"))

const fails = []
const ok = (name, cond, detail) => {
  console.log(`${cond ? "  PASS" : "  FAIL"}  ${name}${detail ? " — " + detail : ""}`)
  if (!cond) fails.push(name)
}

const BASE = S3.INFLATE_BASE_RADIUS
const SPAN = GE.INFLATE_TAPER_SPAN_DIAMETERS
const EXP = GE.INFLATE_PROFILE_EXP

/** A straight run of `len` world units, sampled every 0.02 — the simplest
 *  centreline that isolates the profile from curvature and pressure. */
const straight = (len) => {
  const n = Math.max(4, Math.round(len / 0.02))
  return Array.from({ length: n + 1 }, (_, i) => new THREE.Vector3((i / n) * len, 0, 0))
}

/** Fraction of the built rings sitting under 90 % of the stroke's own maximum,
 *  and the ABSOLUTE arc length that fraction covers. */
const thinProfile = (len, opts) => {
  const res = S3.buildInflateGeometry(straight(len), { pressureInfluence: 0, ...opts })
  if (res.kind !== "inflate") return null
  const r = res.ringRadii
  const max = Math.max(...r)
  const under = r.filter((v) => v < max * 0.9).length
  return { frac: under / r.length, absolute: (under / r.length) * len, rings: r.length, max }
}

console.log("A. THE TAPER ZONE IS FIXED, NOT PROPORTIONAL")
const bounded = { baseRadius: BASE, taperSpanDiameters: SPAN }
const short = thinProfile(2, bounded)
const long = thinProfile(4, bounded)
ok("the builder returned inflate geometry on both lengths", !!short && !!long, `${short?.rings} and ${long?.rings} rings`)
ok(
  "doubling the stroke leaves the SAME absolute length thin",
  Math.abs(short.absolute - long.absolute) < 0.06,
  `${short.absolute.toFixed(3)} vs ${long.absolute.toFixed(3)} world units (taper zone ${(BASE * 2 * SPAN).toFixed(3)} per end)`,
)
ok(
  "…so the FRACTION halves rather than staying put",
  long.frac < short.frac * 0.62,
  `${(short.frac * 100).toFixed(1)} % over 2u, ${(long.frac * 100).toFixed(1)} % over 4u`,
)

console.log("\nB. THE TWO FAMILIES AGREE, and neither number is typed here")
/* Free Stroke's own profile over the same centreline. `inflateInkWidthProfile`
 * is module-private, so this reads the engine's public Inflate the same way the
 * page does: same tip fraction, same exponent, same span. Expressed as the
 * same under-90 % fraction. */
const fsFrac = (len) => {
  const pts = straight(len).map((v) => ({ x: v.x, y: v.y }))
  const s = [0]
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  const total = s[s.length - 1]
  const taperLen = Math.min(BASE * 2 * SPAN, total * 0.45)
  const tip = GE.INFLATE_TIP_FRACTION
  const r = s.map((si) => {
    const d = Math.min(si, total - si)
    const x = taperLen > 0 ? Math.min(1, d / taperLen) : 1
    return tip + (1 - tip) * Math.pow(Math.sin((Math.PI / 2) * x), EXP)
  })
  const max = Math.max(...r)
  return r.filter((v) => v < max * 0.9).length / r.length
}
for (const len of [2, 4]) {
  const dd = thinProfile(len, bounded).frac
  const fs = fsFrac(len)
  ok(
    `over ${len}u the port's thin fraction lands on Free Stroke's`,
    Math.abs(dd - fs) < 0.05,
    `port ${(dd * 100).toFixed(1)} % vs free-stroke ${(fs * 100).toFixed(1)} %`,
  )
}

console.log("\nC. A CLOSED LOOP HAS NO END TAPER")
const loop = thinProfile(4, { ...bounded, closed: true })
ok("every ring is at full width", loop.frac === 0, `${(loop.frac * 100).toFixed(1)} % under 90 %`)

console.log("\nD. KNOWN-BAD — the shipped port, and it must be REJECTED")
const badShort = thinProfile(2, { baseRadius: BASE })
const badLong = thinProfile(4, { baseRadius: BASE })
ok(
  "with no span, most of EVERY stroke is thin",
  badShort.frac > 0.5 && badLong.frac > 0.5,
  `${(badShort.frac * 100).toFixed(1)} % over 2u, ${(badLong.frac * 100).toFixed(1)} % over 4u`,
)
ok(
  "…and the thin LENGTH scales with the stroke, which is the defect itself",
  badLong.absolute > badShort.absolute * 1.8,
  `${badShort.absolute.toFixed(3)} vs ${badLong.absolute.toFixed(3)} world units`,
)
ok(
  "…and the bounded arm is genuinely different from it, so row A is not free",
  short.frac < badShort.frac * 0.6,
  `bounded ${(short.frac * 100).toFixed(1)} % vs shipped ${(badShort.frac * 100).toFixed(1)} %`,
)

console.log("\nE. THE DEFAULT IS STILL THE PORT")
const res = S3.buildInflateGeometry(straight(3), { baseRadius: BASE, pressureInfluence: 0 })
const tipR = S3.INFLATE_TIP_RADIUS
const segments = res.rings - 1
let worst = 0
for (let i = 0; i < res.rings; i++) {
  const u = i / segments
  const want = Math.max(tipR + (BASE - tipR) * Math.pow(Math.sin(Math.PI * u), EXP), tipR * 0.5)
  worst = Math.max(worst, Math.abs(res.ringRadii[i] - want))
}
ok("no options = sin(pi*u)^exp, bit for bit", worst === 0, `worst |delta| ${worst}`)

console.log("\nF. WHAT THE ADAPTER ACTUALLY SHIPS, PINNED")
/* The span is BUILT and gated, and it is NOT adopted. Measured 2026-08-28: it
 * adds 24.8 % ink to this family and `assert-nib-contrast`'s per-counter row
 * goes red on desk-doodles — the `e` of "Doodles" drops from 33.0 % to 4.1 % of
 * what the round pen keeps, 775 texels to 32. Free Stroke survives the same
 * change at 48.7 % because its Inflate fuses strokes into one implicit field
 * and this engine fuses nothing. Two families sharing a taper span is a LOOK
 * call with a legibility cost attached, and it is Sebs's, not a lane's.
 *
 * So this row PINS the shipped choice. Adopting the span is a deliberate edit
 * that turns this red and makes somebody read the number before taking it. */
const adapterSrc = readFileSync(join(ROOT, "lib/dd-engine/adapter.ts"), "utf8")
ok(
  "the adapter passes `closed` and does NOT pass `taperSpanDiameters`",
  /closed:\s*isClosedStroke\(simplified\)/.test(adapterSrc) &&
    !/^\s*taperSpanDiameters:/m.test(adapterSrc),
  /^\s*taperSpanDiameters:/m.test(adapterSrc)
    ? "the span IS being passed — read the counter cost in this file's header before taking this green"
    : "closed shipped, span parked (assert-nib-contrast desk-doodles/counterWorst 33.0 % -> 4.1 %)",
)

console.log(fails.length ? `\nFAILURES — ${fails.join(" · ")}` : "\nTHE TAPER BELONGS TO THE PEN — all rows hold")
process.exit(fails.length ? 1 : 0)
