/**
 * WHICH STROKES OF THE HERO WORD ARE CLOSED LOOPS, and by WHOSE test.
 *
 * D1 · THE CLOSED LOOP, 2026-08-28. C2 proved that `endpoint: "protrude"` opens
 * three loops the trace had closed, and that `HandFeelSettings.closed` — already
 * declared, already read at `lib/stroke-processing.ts:324`, already implemented
 * in `applyEndpointBehavior` — is written by nothing. Before setting it from a
 * predicate, the predicate itself has to be chosen on evidence rather than on
 * which one is easiest to import.
 *
 * Two candidates, both engine-owned, neither invented here:
 *
 *   LOOSE  `isClosedStroke` (lib/dd-engine/strokeTo3d.ts:451) —
 *          gap < max(24px, 8% of the stroke's bbox diagonal). What the DD
 *          adapter already calls on these very strokes.
 *   TIGHT  the Inflate law (lib/geometry-engines.ts:1041 `inflateChainIsClosed`) —
 *          gap <= 0.75 * radius AND arc >= 4 * radius. The one C2's 8.47 px
 *          threshold came from. Module-private, so it is RE-STATED here for
 *          measurement only and asserted against its own source text below.
 *
 * The question this answers is not "do both close the three loops" — C2 already
 * showed they do — but "what ELSE does each one close", because a predicate that
 * also closes the `e` would take the hand off every open letter in the word.
 *
 * Reads only. Writes docs/verification/closedloop-2026-08-28/predicate.json.
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { ROOT, loadTs } from "./_ts-load.mjs"
import {
  heroPolylines,
  rawHeroStrokes,
  HERO_INK_WIDTH_PX,
  HERO_ENDPOINT,
  HERO_WOBBLE_PRESET,
  PROCESS_SETTINGS,
} from "./_hero-word.mjs"

const { processStroke } = loadTs("lib/stroke-processing.ts")
const { WOBBLE_PRESETS } = loadTs("lib/hand-feel.ts")
const S3 = loadTs("lib/dd-engine/strokeTo3d.ts")

const OUT = join(ROOT, "docs", "verification", "closedloop-2026-08-28")
mkdirSync(OUT, { recursive: true })

/* THE TIGHT LAW, RE-STATED FOR MEASUREMENT AND CHECKED AGAINST ITS SOURCE.
 * `inflateChainIsClosed` is module-private and lib/geometry-engines.ts is not
 * this lane's to edit, so the two constants are read out of the file text. A
 * restated constant that drifts is the defect class this repo keeps finding. */
const GE = readFileSync(join(ROOT, "lib/geometry-engines.ts"), "utf8")
const readConst = (name) => {
  const m = GE.match(new RegExp(`const ${name} = ([0-9.]+)`))
  if (!m) throw new Error(`_probe-closure-predicate: ${name} not found in lib/geometry-engines.ts`)
  return Number(m[1])
}
const EPS_HW = readConst("INFLATE_CLOSE_EPS_HALFWIDTHS")
const MIN_ARC_HW = readConst("INFLATE_CLOSE_MIN_ARC_HALFWIDTHS")

const geom = (pts) => {
  let arc = 0
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    if (i) arc += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y)
    if (p.x < x0) x0 = p.x
    if (p.x > x1) x1 = p.x
    if (p.y < y0) y0 = p.y
    if (p.y > y1) y1 = p.y
  }
  const gap = Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y)
  return { arc, gap, diag: Math.hypot(x1 - x0, y1 - y0), bbox: { x0, y0, x1, y1 } }
}

const R = HERO_INK_WIDTH_PX / 2
const tightClosed = (pts) => {
  if (pts.length < 4 || !(R > 0)) return false
  const g = geom(pts)
  return g.gap <= R * EPS_HW && g.arc >= R * MIN_ARC_HW
}

const raws = rawHeroStrokes()
const hfBase = {
  wobble: WOBBLE_PRESETS[HERO_WOBBLE_PRESET],
  endpoint: HERO_ENDPOINT,
  inkWidth: HERO_INK_WIDTH_PX,
}
const run = (s, closed) =>
  processStroke(s, PROCESS_SETTINGS.spacing, PROCESS_SETTINGS.smoothing, PROCESS_SETTINGS.preserveCorners, 45, {
    ...hfBase,
    ...(closed === undefined ? {} : { closed }),
  })

const rows = raws.map((s, i) => {
  const g = geom(s.points)
  const loose = S3.isClosedStroke(s.points.map((p) => [p.x, p.y]))
  const tight = tightClosed(s.points)
  const shipped = geom(run(s, undefined).points)
  const withClosed = geom(run(s, true).points)
  return {
    i,
    n: s.points.length,
    rawGap: +g.gap.toFixed(2),
    rawArc: +g.arc.toFixed(1),
    bboxDiag: +g.diag.toFixed(1),
    looseThreshold: +Math.max(24, g.diag * 0.08).toFixed(2),
    tightThreshold: +(R * EPS_HW).toFixed(2),
    loose,
    tight,
    shippedGap: +shipped.gap.toFixed(2),
    closedTrueGap: +withClosed.gap.toFixed(2),
    bbox: { x0: +g.bbox.x0.toFixed(1), y0: +g.bbox.y0.toFixed(1), x1: +g.bbox.x1.toFixed(1), y1: +g.bbox.y1.toFixed(1) },
  }
})

const out = {
  what: "hero word, per raw kept stroke: which closure predicate fires and what protrude does",
  inkWidthPx: +HERO_INK_WIDTH_PX.toFixed(4),
  radius: +R.toFixed(4),
  tightLaw: { EPS_HW, MIN_ARC_HW, gapThreshold: +(R * EPS_HW).toFixed(3), arcFloor: +(R * MIN_ARC_HW).toFixed(3) },
  strokes: rows.length,
  looseFires: rows.filter((r) => r.loose).map((r) => r.i),
  tightFires: rows.filter((r) => r.tight).map((r) => r.i),
  disagree: rows.filter((r) => r.loose !== r.tight).map((r) => r.i),
  rows,
}
writeFileSync(join(OUT, "predicate.json"), JSON.stringify(out, null, 2))

console.log(`nib ${HERO_INK_WIDTH_PX.toFixed(3)} px  radius ${R.toFixed(3)}`)
console.log(`TIGHT law: gap <= ${(R * EPS_HW).toFixed(2)}  arc >= ${(R * MIN_ARC_HW).toFixed(2)}`)
console.log(`kept strokes: ${rows.length}`)
console.log("  i    rawGap  looseThr  tightThr  loose  tight   shippedGap  closed:true")
for (const r of rows) {
  console.log(
    `  ${String(r.i).padStart(2)}  ${String(r.rawGap).padStart(7)}  ${String(r.looseThreshold).padStart(8)}  ${String(r.tightThreshold).padStart(8)}  ${String(r.loose).padStart(5)}  ${String(r.tight).padStart(5)}   ${String(r.shippedGap).padStart(9)}  ${String(r.closedTrueGap).padStart(10)}`,
  )
}
console.log(`LOOSE fires on: [${out.looseFires}]`)
console.log(`TIGHT fires on: [${out.tightFires}]`)
console.log(`DISAGREE: [${out.disagree}]`)
console.log("out:", join(OUT, "predicate.json"))
