/**
 * WHERE THE SPIKE AND THE PINCH COME FROM — the TRACE side, before any pen.
 *
 * C2 · THE SPIKE AND THE PINCH, 2026-08-28. An independent Codex read of
 * `docs/verification/mark-2026-08-28/AB-stubs-Dstem.png`, with no idea what the
 * image was, named two things: *"a short spike still rises above the top
 * stroke"* and *"the stem narrows sharply where it leaves the crossing."*
 *
 * A cross-model finding is evidence, not a verdict, so this probe asks the
 * trace itself three questions before any render is looked at:
 *
 *   1 · IS THERE A TENTH STUB? `dropSubNibStubs` drops nine polylines shorter
 *       than one nib diameter. If a spike were a tap sitting just above the
 *       threshold this census would show it as a length between 1.0 and, say,
 *       1.5 nibs. `subNibStubCensus` reports the margin for exactly this.
 *
 *   2 · WHICH STROKES ARE THE `D`, and where do their raw endpoints sit?
 *
 *   3 · WHAT DOES `processStroke` DO TO THOSE ENDPOINTS? The hero runs
 *       `endpoint: "protrude"`, which lib/pen-reveal.ts's stub block says
 *       carries a 4.9-unit tap out to 46.7 units. The same protrusion applied
 *       to the `D`'s stem start would push ink ABOVE the top stroke with no
 *       tenth stub anywhere in the trace.
 *
 * Reads only. Writes JSON to docs/verification/spike-2026-08-28/.
 */
import { writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { ROOT, loadTs } from "./_ts-load.mjs"
import {
  heroPolylines,
  rawHeroStrokes,
  processedHeroStrokes,
  HERO_INK_WIDTH_PX,
  HERO_ENDPOINT,
  HERO_WOBBLE_PRESET,
} from "./_hero-word.mjs"

const PR = loadTs("lib/pen-reveal.ts")
const OUT = join(ROOT, "docs", "verification", "spike-2026-08-28")
mkdirSync(OUT, { recursive: true })

const polylines = heroPolylines()
const nib = HERO_INK_WIDTH_PX

/* ---- 1 · THE CENSUS, and the margin the threshold sits in ---------------- */
const census = PR.subNibStubCensus(polylines, nib)
const sortedNibs = census.lenNibs
  .map((n, i) => ({ i, nibs: n }))
  .sort((a, b) => a.nibs - b.nibs)

/* ---- 2 · WHICH STROKES ARE THE `D` -------------------------------------- */
const bboxOf = (pl) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of pl) {
    if (p.x < x0) x0 = p.x
    if (p.x > x1) x1 = p.x
    if (p.y < y0) y0 = p.y
    if (p.y > y1) y1 = p.y
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }
}
const raw = polylines.map((pl, i) => ({
  i,
  n: pl.length,
  lenNibs: +census.lenNibs[i].toFixed(3),
  dropped: census.droppedIdx.includes(i),
  bbox: bboxOf(pl),
  first: pl[0],
  last: pl[pl.length - 1],
}))

/* ---- 3 · WHAT PROTRUDE DOES TO THOSE ENDPOINTS -------------------------- */
const rawStrokes = rawHeroStrokes()
const proc = processedHeroStrokes()
const kept = census.keptIdx

const ends = proc.map((s, k) => {
  const srcIdx = kept[k]
  const r = polylines[srcIdx]
  const p = s.points ?? s
  const pb = bboxOf(p)
  const rb = bboxOf(r)
  return {
    procIdx: k,
    srcIdx,
    rawFirst: r[0],
    procFirst: p[0],
    startShift: Math.hypot(p[0].x - r[0].x, p[0].y - r[0].y),
    rawLast: r[r.length - 1],
    procLast: p[p.length - 1],
    endShift: Math.hypot(
      p[p.length - 1].x - r[r.length - 1].x,
      p[p.length - 1].y - r[r.length - 1].y,
    ),
    /** How far the processed ink rises ABOVE the raw ink's top. */
    riseAboveRawTop: +(rb.y0 - pb.y0).toFixed(3),
    rawTopY: +rb.y0.toFixed(3),
    procTopY: +pb.y0.toFixed(3),
  }
})

const report = {
  nibDiameter: nib,
  endpoint: HERO_ENDPOINT,
  wobblePreset: HERO_WOBBLE_PRESET,
  census: {
    kept: census.keptIdx.length,
    dropped: census.droppedIdx.length,
    droppedIdx: census.droppedIdx,
    longestDroppedNibs: +census.longestDropped.toFixed(4),
    shortestKeptNibs: +census.shortestKept.toFixed(4),
    travelFrac: +census.travelFrac.toFixed(5),
    /** every stroke, shortest first — a tenth stub would sit here. */
    ladder: sortedNibs.map((r) => ({ i: r.i, nibs: +r.nibs.toFixed(3) })),
  },
  raw,
  ends,
}
writeFileSync(join(OUT, "source-census.json"), JSON.stringify(report, null, 2))

console.log(`nib diameter ${nib.toFixed(3)} units`)
console.log(
  `census: ${census.keptIdx.length} kept / ${census.droppedIdx.length} dropped · ` +
    `longest dropped ${census.longestDropped.toFixed(3)} nib · ` +
    `shortest kept ${census.shortestKept.toFixed(3)} nib`,
)
console.log("ladder (shortest first, nib diameters):")
console.log("  " + sortedNibs.map((r) => `#${r.i}:${r.nibs.toFixed(2)}`).join("  "))
console.log("\nraw strokes, left-to-right by bbox x0:")
for (const r of [...raw].sort((a, b) => a.bbox.x0 - b.bbox.x0)) {
  console.log(
    `  #${String(r.i).padStart(2)} ${r.dropped ? "DROP" : "keep"} len ${r.lenNibs.toFixed(2)} nib  ` +
      `bbox x[${r.bbox.x0.toFixed(1)}..${r.bbox.x1.toFixed(1)}] y[${r.bbox.y0.toFixed(1)}..${r.bbox.y1.toFixed(1)}]  ` +
      `first(${r.first.x.toFixed(1)},${r.first.y.toFixed(1)}) last(${r.last.x.toFixed(1)},${r.last.y.toFixed(1)})`,
  )
}
console.log("\nprotrusion, processed vs raw:")
for (const e of ends) {
  console.log(
    `  proc#${String(e.procIdx).padStart(2)} (src #${String(e.srcIdx).padStart(2)})  ` +
      `startShift ${e.startShift.toFixed(2)}  endShift ${e.endShift.toFixed(2)}  ` +
      `rise above raw top ${e.riseAboveRawTop.toFixed(2)} units ` +
      `(${(e.riseAboveRawTop / nib).toFixed(2)} nib)`,
  )
}
console.log("\nwrote", join(OUT, "source-census.json"))
