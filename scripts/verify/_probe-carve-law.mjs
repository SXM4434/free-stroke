// _PROBE-CARVE-LAW — what the carve actually removes, read off the REAL bake.
//
// The rendered evidence says `penCarve = 0.700` deletes 42-53 % of the mark and
// takes it from 6 connected components to 13. The closed form says it cannot:
// the pen half-width bottoms out at `R/aspect * tip` = 0.333 R, and
// `mix(tube, pen, 0.70)` puts the boundary at `d = 0.639 R` in the very worst
// case, which is a THINNING and not a deletion.
//
// One of those two is wrong, so this asks the bake itself rather than either
// argument: walk every centreline sample, march outward along the perpendicular
// through the ACTUAL baked field, and record where each channel changes sign.
//
//   halfTube   where channel g crosses 0   — the envelope at carve 0
//   halfCarve  where mix(g, r, c) crosses 0 — the silhouette at carve c
//   centre     the value of mix at the centreline itself; POSITIVE means the
//              stroke is deleted outright there, which is the only thing that
//              can put a hole in the middle of a drawn letter
//
// Usage: node scripts/verify/_probe-carve-law.mjs [--carve=0.7]
import { loadTs } from "./_ts-load.mjs"
import { processedHeroStrokes, HERO_INK_WIDTH_PX } from "./_hero-word.mjs"

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const CARVE = parseFloat(arg("carve", "0.7"))

const { buildPenField, penHalfWidth, PEN_NIB_DEFAULT, PEN_FIELD_TUBE_SLACK } =
  loadTs("lib/flat-ink.ts")

const strokes = processedHeroStrokes()
const INK = HERO_INK_WIDTH_PX
const R = INK / 2
console.log(`hero word: ${strokes.length} strokes, ink diameter ${INK.toFixed(2)}, R ${R.toFixed(2)}`)

const field = buildPenField(strokes, INK)
console.log(`field ${field.width}x${field.height}, box x[${field.minX.toFixed(1)}, ${field.maxX.toFixed(1)}] y[${field.minY.toFixed(1)}, ${field.maxY.toFixed(1)}]`)

/** BILINEAR, exactly as the GPU samples it — a nearest fetch here would be a
 *  second implementation of the thing under test. */
function sample(x, y) {
  const u = (x - field.minX) / field.unitsPerTexel - 0.5
  const v = (y - field.minY) / field.unitsPerTexel - 0.5
  const x0 = Math.floor(u)
  const y0 = Math.floor(v)
  const fx = u - x0
  const fy = v - y0
  const cl = (i, n) => (i < 0 ? 0 : i >= n ? n - 1 : i)
  let r = 0
  let g = 0
  for (let j = 0; j <= 1; j++) {
    for (let i = 0; i <= 1; i++) {
      const w = (i ? fx : 1 - fx) * (j ? fy : 1 - fy)
      const p = (cl(y0 + j, field.height) * field.width + cl(x0 + i, field.width)) * 2
      r += field.data[p] * w
      g += field.data[p + 1] * w
    }
  }
  return { r, g }
}
const sd = (x, y, c) => {
  const { r, g } = sample(x, y)
  return g + (r - g) * c
}

const STEP = 0.25
const MAXD = R * 3
let nSamples = 0
let nDeletedCentre = 0
const halfTube = []
const halfCarve = []
const centreVal = []
/** Worst offenders, so the sheet can be pointed at them. */
const worst = []

for (const s of strokes) {
  const pts = s.points
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    const th = Math.atan2(b.y - a.y, b.x - a.x)
    const nx = -Math.sin(th)
    const ny = Math.cos(th)
    const px = pts[i].x
    const py = pts[i].y
    nSamples++

    const c0 = sd(px, py, CARVE)
    centreVal.push(c0)
    if (c0 > 0) {
      nDeletedCentre++
      worst.push({ x: px, y: py, c0, theta: (th * 180) / Math.PI })
    }

    // March outward on BOTH sides; the half-width is the mean of the two.
    const march = (c) => {
      let hit = 0
      for (const sgn of [1, -1]) {
        let d = 0
        for (; d < MAXD; d += STEP) {
          if (sd(px + nx * sgn * d, py + ny * sgn * d, c) > 0) break
        }
        hit += d
      }
      return hit / 2
    }
    halfTube.push(march(0))
    halfCarve.push(march(CARVE))
  }
}

const stat = (arr) => {
  const a = [...arr].sort((x, y) => x - y)
  const q = (p) => a[Math.min(a.length - 1, Math.max(0, Math.round(p * (a.length - 1))))]
  return { min: a[0], p01: q(0.01), p05: q(0.05), med: q(0.5), p95: q(0.95), max: a[a.length - 1] }
}
const f = (o) =>
  `min ${o.min.toFixed(2)}  p01 ${o.p01.toFixed(2)}  p05 ${o.p05.toFixed(2)}  med ${o.med.toFixed(2)}  p95 ${o.p95.toFixed(2)}  max ${o.max.toFixed(2)}`

console.log(`\ncentreline samples: ${nSamples}`)
console.log(`half-width at carve 0.00 (the TUBE channel):  ${f(stat(halfTube))}`)
console.log(`half-width at carve ${CARVE.toFixed(2)} (what SHIPS):        ${f(stat(halfCarve))}`)
console.log(`signed distance AT THE CENTRELINE, carve ${CARVE.toFixed(2)}: ${f(stat(centreVal))}`)
console.log(
  `\ncentreline samples DELETED OUTRIGHT (sd > 0 on the centreline): ${nDeletedCentre} / ${nSamples} = ${((nDeletedCentre / nSamples) * 100).toFixed(1)} %`,
)
const gone = halfCarve.filter((h) => h <= 0.5).length
console.log(`samples whose carved half-width is <= 0.5 units:                ${gone} / ${nSamples} = ${((gone / nSamples) * 100).toFixed(1)} %`)

// What the CLOSED FORM says the same numbers should be, so the bake can be
// compared to the law rather than to itself.
let hpMin = Infinity
let hpMed = []
for (const s of strokes) {
  const pts = s.points
  if (pts.length < 2) continue
  const cum = [0]
  let L = 0
  for (let i = 1; i < pts.length; i++) {
    L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    cum.push(L)
  }
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    const th = Math.atan2(b.y - a.y, b.x - a.x)
    const h = penHalfWidth(th, Math.min(cum[i], L - cum[i]), R, PEN_NIB_DEFAULT)
    if (h < hpMin) hpMin = h
    hpMed.push(h)
  }
}
hpMed.sort((a, b) => a - b)
console.log(
  `\nCLOSED FORM penHalfWidth over the word: min ${hpMin.toFixed(2)}  med ${hpMed[hpMed.length >> 1].toFixed(2)}  (R = ${R.toFixed(2)}, tube channel at ${(R * PEN_FIELD_TUBE_SLACK).toFixed(2)})`,
)
console.log(
  `predicted carved half-width at the thinnest sample: ${(CARVE * hpMin + (1 - CARVE) * R * PEN_FIELD_TUBE_SLACK).toFixed(2)} units`,
)

if (worst.length) {
  worst.sort((a, b) => b.c0 - a.c0)
  console.log(`\nworst deleted centreline points (stroke units, sd, travel deg):`)
  for (const w of worst.slice(0, 10))
    console.log(`   (${w.x.toFixed(1)}, ${w.y.toFixed(1)})  sd ${w.c0.toFixed(2)}  theta ${w.theta.toFixed(0)}`)
}
