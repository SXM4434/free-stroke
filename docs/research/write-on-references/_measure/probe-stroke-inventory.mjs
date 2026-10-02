// R1 probe — the SHIPPED hero word's stroke inventory, through the real
// builders. Research only: reads lib/, writes nothing, touches no repo code.
// Run from the repo root:  node docs/research/write-on-references/_measure/probe-stroke-inventory.mjs
import { processedHeroStrokes, HERO_INK_WIDTH_PX } from "../../../../scripts/verify/_hero-word.mjs"

const strokes = processedHeroStrokes("lognormal")
const nib = HERO_INK_WIDTH_PX
let tot = 0
const rows = strokes.map((s, i) => {
  const p = s.points
  let L = 0
  for (let j = 1; j < p.length; j++) L += Math.hypot(p[j].x - p[j - 1].x, p[j].y - p[j - 1].y)
  tot += L
  return { i, n: p.length, L, x0: Math.min(...p.map((q) => q.x)), x1: Math.max(...p.map((q) => q.x)),
           t0: p[0].t, t1: p[p.length - 1].t }
})
console.log(`nib diameter ${nib.toFixed(1)} units;  ${strokes.length} strokes;  total travel ${tot.toFixed(1)}`)
console.log("  #   pts      len   len/nib     x0     x1     dur_ms   gap_before_ms")
let prevEnd = null
for (const r of rows) {
  const gap = prevEnd === null ? NaN : r.t0 - prevEnd
  prevEnd = r.t1
  const flag = r.L < nib ? "  <- SHORTER THAN THE NIB IS WIDE" : ""
  console.log(
    `${String(r.i).padStart(3)} ${String(r.n).padStart(5)} ${r.L.toFixed(1).padStart(8)} ` +
    `${(r.L / nib).toFixed(2).padStart(9)} ${r.x0.toFixed(0).padStart(6)} ${r.x1.toFixed(0).padStart(6)} ` +
    `${(r.t1 - r.t0).toFixed(0).padStart(10)} ${(isNaN(gap) ? "-" : gap.toFixed(0)).padStart(14)}${flag}`,
  )
}
const micro = rows.filter((r) => r.L < nib)
console.log(`\n${micro.length} of ${rows.length} strokes are shorter than one nib width.`)
console.log(`They carry ${micro.reduce((a, r) => a + r.L, 0).toFixed(1)} of ${tot.toFixed(1)} units = ${(100 * micro.reduce((a, r) => a + r.L, 0) / tot).toFixed(2)}% of the pen travel,`)
console.log(`and ${micro.reduce((a, r) => a + (r.t1 - r.t0), 0).toFixed(0)} ms of the record.`)
let back = 0
for (let i = 1; i < rows.length; i++) if (rows[i].x0 < rows[i - 1].x0 - 1) back++
console.log(`\n${back} of ${rows.length - 1} strokes start LEFT of where the previous stroke started.`)
const gaps = rows.slice(1).map((r, i) => r.t0 - rows[i].t1).filter((g) => g > 0)
gaps.sort((a, b) => a - b)
console.log(`pen-up gaps: ${gaps.length} of ${rows.length - 1} are positive; median ${gaps[gaps.length >> 1]?.toFixed(0)} ms, range ${gaps[0]?.toFixed(0)}..${gaps[gaps.length - 1]?.toFixed(0)} ms`)
