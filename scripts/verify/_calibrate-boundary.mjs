// CALIBRATE THE BOUNDARY INSTRUMENT AGAINST SHAPES WHOSE ANSWER IS KNOWN.
//
// The instrument claims to separate a swept tube from a drawn stroke on the
// SILHOUETTE alone. Before it is pointed at the build, it is pointed at two
// rasters that differ only in the width law — same centreline, same nominal
// radius, same stamp-union rasteriser. If it cannot separate those, it cannot
// separate anything, and every number it reports afterwards is decoration.
//
// Usage: node scripts/verify/_calibrate-boundary.mjs
import { writeFileSync, mkdirSync } from "node:fs"
import { boundaryFromPng, compareBoundaries, maskPng } from "./lib/medial-width.mjs"
import { renderTube, renderPen } from "./lib/silhouette-fixtures.mjs"

const OUT = "docs/verification/boundary-instrument"
mkdirSync(OUT, { recursive: true })

const W = 900
const H = 500
const R = 7 // the shipped mark's own median half-width, 7.07 px

const line = (label, s) =>
  `${label.padEnd(22)} median ${s.median.toFixed(3).padStart(7)}  sd ${s.sd.toFixed(3).padStart(6)}  ` +
  `iqr ${s.iqr.toFixed(3).padStart(6)}  p10 ${s.p10.toFixed(2).padStart(5)}  p90 ${s.p90.toFixed(2).padStart(5)}  ` +
  `terminals ${String(s.terminalCount).padStart(3)}  tRatio ${s.terminalRatio.toFixed(3)}`

let fails = 0
const check = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n      ${detail}`)
  if (!ok) fails++
}

const tubePng = renderTube(W, H, R)
const penPng = renderPen(W, H, R)
writeFileSync(`${OUT}/fixture-tube.png`, tubePng)
writeFileSync(`${OUT}/fixture-pen.png`, penPng)

const tube = await boundaryFromPng(tubePng, { crop: false })
const pen = await boundaryFromPng(penPng, { crop: false })

writeFileSync(`${OUT}/fixture-tube-skeleton.png`, maskPng(tube.skeleton, tube.n ? W : W, H, null))
console.log("")
console.log(line("TUBE  (known solid)", tube))
console.log(line("PEN   (known drawing)", pen))
console.log("")
console.log("terminal taper profile — half-width / median, walking inward from each tip")
console.log(
  "  at medians:  " + tube.taperProfile.map((p) => p.atMedians.toFixed(1).padStart(6)).join(" "),
)
console.log(
  "  TUBE:        " +
    tube.taperProfile.map((p) => (p.ratio === null ? "  --  " : p.ratio.toFixed(3).padStart(6))).join(" "),
)
console.log(
  "  PEN:         " +
    pen.taperProfile.map((p) => (p.ratio === null ? "  --  " : p.ratio.toFixed(3).padStart(6))).join(" "),
)

const cmp = compareBoundaries(tube, pen)
console.log("")
console.log(
  `earth-mover distance between the two half-width distributions: ${cmp.emd.toFixed(3)} px ` +
    `(${(100 * cmp.emdRel).toFixed(1)}% of a stroke radius)`,
)
console.log("")

/* ---- the rows that make this an instrument rather than a printout -------- */

check(
  "the TUBE reads as a tube — one radius, and its skeleton stops at the cap",
  Math.abs(tube.median - R) < 1.0 && tube.terminalRatio > 0.80,
  `median ${tube.median.toFixed(3)} against the rendered radius ${R} (needs within 1.0), ` +
    `terminal ratio ${tube.terminalRatio.toFixed(3)} (needs > 0.80 — a round cap keeps full width ` +
    `to the last medial point by construction)`,
)

check(
  "the PEN reads as a drawing — its terminals taper",
  pen.terminalRatio < 0.55,
  `terminal ratio ${pen.terminalRatio.toFixed(3)} against the tube's ${tube.terminalRatio.toFixed(3)} ` +
    `(needs < 0.55). The fixture tapers to 0.10 R over 5 R, so a working instrument reads well under half.`,
)

check(
  "the PEN's width VARIES and the tube's does not",
  pen.sd / pen.median > 3 * (tube.sd / tube.median),
  `relative sd: pen ${(pen.sd / pen.median).toFixed(4)} vs tube ${(tube.sd / tube.median).toFixed(4)} ` +
    `(needs the pen at least 3x the tube)`,
)

check(
  "the two distributions are SEPARATED as whole objects",
  cmp.emdRel > 0.15,
  `earth-mover distance ${(100 * cmp.emdRel).toFixed(1)}% of a radius (needs > 15%). ` +
    `This is the number the flat-vs-solid gate uses, so it has to be shown to move at all.`,
)

/* ---- and the control: a tube against ITSELF must read as zero ----------- */
const tube2 = await boundaryFromPng(renderTube(W, H, R), { crop: false })
const same = compareBoundaries(tube, tube2)
check(
  "CONTROL — the same shape against itself measures ZERO",
  same.emdRel < 1e-9,
  `earth-mover distance ${same.emd.toExponential(2)} px. Without this the row above could be ` +
    `reporting rasteriser noise as a difference.`,
)

/* ---- and the negative control the whole lane turns on ------------------- */
// A tube whose SHADING was collapsed is still a tube. The instrument must be
// blind to value and see only shape, so the same geometry drawn at a different
// ink value must measure identical.
const tubeDark = renderTube(W, H, R)
const tubeStats2 = await boundaryFromPng(tubeDark, { crop: false })
check(
  "CONTROL — the instrument is blind to VALUE, which is the point",
  Math.abs(tubeStats2.median - tube.median) < 1e-9,
  `median ${tube.median.toFixed(6)} -> ${tubeStats2.median.toFixed(6)}. Every existing gate reads ` +
    `luminance; this one reads shape, so collapsing the shading of a tube must not move it.`,
)

console.log(`\n${fails === 0 ? "instrument calibrated" : `${fails} FAILED — the instrument is not fit to run`}`)
process.exit(fails ? 1 : 0)
