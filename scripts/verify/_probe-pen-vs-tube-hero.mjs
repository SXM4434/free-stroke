// HOW MUCH SILHOUETTE DOES THE NIB LAW ACTUALLY BUY, ON THE REAL WORD?
//
// The boundary instrument is calibrated (`_calibrate-boundary.mjs`) and it
// fails on the shipped build (`assert-flat-silhouette.mjs --label=today`, 3/6,
// flat vs solid separated by 4.09 % of a radius against a 10 % floor). This
// probe answers the next question, which is the one the fix turns on: sweeping
// the nib's contrast from 1.0 (the monoline the register draws today) upward,
// where does the separation cross the floor, and what does each setting look
// like?
//
// Both halves matter. The number decides whether the law CAN carry the beat;
// the sheet decides whether the mark is still Sebs's mark, and that second one
// is his call, not a threshold's.
//
// Usage: node scripts/verify/_probe-pen-vs-tube-hero.mjs
import { writeFileSync, mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { loadTs } from "./_ts-load.mjs"
import { processedHeroStrokes, HERO_INK_WIDTH_PX } from "./_hero-word.mjs"
import { boundaryStats, compareBoundaries, maskFromRGBA } from "./lib/medial-width.mjs"

const require = createRequire(import.meta.url)
const { createCanvas } = require("@napi-rs/canvas")
const { makeFlatRenderer, NIB_ANGLE_RAD, PEN_TAPER_RADII, PEN_TIP_FRACTION, NIB_ASPECT_DEFAULT } =
  loadTs("lib/flat-ink.ts")

const OUT = "docs/verification/flat-silhouette/nib-sweep"
mkdirSync(OUT, { recursive: true })

/* The stage the beat actually plays on: the shipped capture is 1120x840 and the
 * mark measures 648 px wide in it (assert-hero-flatstate's own baseline line).
 * Rendering the sweep anywhere else would produce a half-width in different
 * units from every number already on the record. */
const W = 1120
const H = 630
const WORD_W = 648

const strokes = processedHeroStrokes()
const polylines = strokes.map((s) => s.points.map((p) => ({ x: p.x, y: p.y })))
const footprint = { w: WORD_W, cx: W / 2, cy: H / 2 }

function render(nib) {
  const c = createCanvas(W, H)
  const ctx = c.getContext("2d")
  ctx.fillStyle = "#fbfaf7"
  ctx.fillRect(0, 0, W, H)
  const r = makeFlatRenderer(polylines, footprint, strokes, nib)
  r.draw(ctx, 1, "#121110")
  const { data } = ctx.getImageData(0, 0, W, H)
  return { png: c.toBuffer("image/png"), mask: maskFromRGBA(data, W, H, { crop: false }).mask, lineWidth: r.lineWidth }
}

const mono = render(null)
const monoStats = boundaryStats(mono.mask, W, H)
writeFileSync(`${OUT}/aspect-1.0-monoline.png`, mono.png)

console.log(`\nthe hero word, ${strokes.length} strokes, at the shipped stage scale`)
console.log(`ink diameter ${mono.lineWidth.toFixed(2)} px  (page HERO_INK_WIDTH_PX ${HERO_INK_WIDTH_PX.toFixed(2)})`)
console.log(
  `nib angle ${((NIB_ANGLE_RAD * 180) / Math.PI).toFixed(0)} deg · taper ${PEN_TAPER_RADII} radii to ` +
    `tip ${PEN_TIP_FRACTION} · recommended aspect ${NIB_ASPECT_DEFAULT}\n`,
)
console.log(
  "  aspect   median    sd    rel-sd  BODY-relSd   p10    p90   term tRatio   ink px    vs MONOLINE",
)
console.log(
  "  ------   ------  ------  ------  ----------  -----  -----  ---- ------  --------  ------------",
)

const rows = []
for (const aspect of [1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4, 2.8, 3.2, 4.0, 5.0, 6.0]) {
  const nib =
    aspect <= 1.0001
      ? null
      : { aspect, angle: NIB_ANGLE_RAD, taperRadii: PEN_TAPER_RADII, tip: PEN_TIP_FRACTION }
  const r = render(nib)
  const s = boundaryStats(r.mask, W, H)
  const cmp = compareBoundaries(monoStats, s)
  rows.push({ aspect, s, cmp })
  writeFileSync(`${OUT}/aspect-${aspect.toFixed(1)}.png`, r.png)
  console.log(
    `  ${aspect.toFixed(1).padStart(5)}   ` +
      `${s.median.toFixed(3).padStart(6)}  ${s.sd.toFixed(3).padStart(6)}  ` +
      `${(s.sd / s.median).toFixed(3).padStart(6)}  ${s.bodyRelSd.toFixed(3).padStart(10)}  ` +
      `${s.p10.toFixed(2).padStart(5)}  ${s.p90.toFixed(2).padStart(5)}  ` +
      `${String(s.terminalCount).padStart(4)} ${s.terminalRatio.toFixed(3).padStart(6)}  ` +
      `${String(s.inkPx).padStart(8)}  ${(100 * cmp.emdRel).toFixed(2).padStart(7)}% of a radius`,
  )
}

/* ---- the taper on its own, so the two devices are not conflated ---------- */
const taperOnly = render({
  aspect: 1,
  angle: NIB_ANGLE_RAD,
  taperRadii: PEN_TAPER_RADII,
  tip: PEN_TIP_FRACTION,
})
const taperStats = boundaryStats(taperOnly.mask, W, H)
writeFileSync(`${OUT}/taper-only.png`, taperOnly.png)
const taperCmp = compareBoundaries(monoStats, taperStats)

console.log("")
console.log(
  `TERMINAL TAPER ALONE (aspect 1, taper ${PEN_TAPER_RADII} radii):  ` +
    `separation ${(100 * taperCmp.emdRel).toFixed(2)}% of a radius, ` +
    `terminal ratio ${monoStats.terminalRatio.toFixed(3)} -> ${taperStats.terminalRatio.toFixed(3)}`,
)
console.log(
  `   — the census said this device reaches 4 medial samples of ${monoStats.n}. ` +
    `This is that finding as a separation number.`,
)

console.log("")
const floor = rows.find((r) => r.cmp.emdRel >= 0.1)
console.log(
  floor
    ? `The separation crosses the instrument's 10% floor at aspect ${floor.aspect.toFixed(1)} ` +
        `(${(100 * floor.cmp.emdRel).toFixed(2)}%), and clears the 16.9% the calibration needed to ` +
        `separate a known pen from a known tube at aspect ` +
        `${(rows.find((r) => r.cmp.emdRel >= 0.169) ?? { aspect: NaN }).aspect}.`
    : "The separation never crosses the floor — the law does not carry the beat.",
)

writeFileSync(
  `${OUT}/sweep.json`,
  JSON.stringify(
    {
      stage: { W, H, WORD_W, inkDiameter: mono.lineWidth },
      nib: { angleDeg: (NIB_ANGLE_RAD * 180) / Math.PI, taperRadii: PEN_TAPER_RADII },
      monoline: pick(monoStats),
      taperOnly: { ...pick(taperStats), separationVsMonoline: taperCmp.emdRel },
      sweep: rows.map((r) => ({ aspect: r.aspect, ...pick(r.s), separationVsMonoline: r.cmp.emdRel })),
    },
    null,
    2,
  ),
)
console.log(`\n-> ${OUT}/  (one render per aspect + sweep.json)`)

function pick(s) {
  return {
    median: s.median,
    sd: s.sd,
    relSd: s.sd / s.median,
    bodyMedian: s.bodyMedian,
    bodySd: s.bodySd,
    bodyRelSd: s.bodyRelSd,
    bodyN: s.bodyN,
    junctionCount: s.junctionCount,
    p10: s.p10,
    p90: s.p90,
    inkPx: s.inkPx,
    terminalCount: s.terminalCount,
    terminalRatio: s.terminalRatio,
  }
}
