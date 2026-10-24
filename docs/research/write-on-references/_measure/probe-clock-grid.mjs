// R1 probe — is the shipped pen clock quantised? Research only, writes nothing.
import { processedHeroStrokes, rawHeroStrokes } from "../../../../scripts/verify/_hero-word.mjs"
const S = processedHeroStrokes("lognormal")
const durs = S.map((s) => s.points[s.points.length - 1].t - s.points[0].t)
const uniq = [...new Set(durs.map((d) => +d.toFixed(3)))].sort((a, b) => a - b)
console.log(`22 strokes, ${uniq.length} DISTINCT durations:`, uniq.map((d) => d.toFixed(1)).join("  "))
const g = uniq[0]
console.log(`\nevery duration / the smallest (${g.toFixed(2)} ms):`)
console.log("  " + uniq.map((d) => (d / g).toFixed(3)).join("  "))
const half = g / 2
console.log(`\nevery duration / half the smallest (${half.toFixed(2)} ms):`)
console.log("  " + uniq.map((d) => (d / half).toFixed(3)).join("  "))
// all inter-point dt across the word
const dts = []
for (const s of S) for (let i = 1; i < s.points.length; i++) dts.push(s.points[i].t - s.points[i - 1].t)
const u2 = [...new Set(dts.map((d) => +d.toFixed(4)))].sort((a, b) => a - b)
console.log(`\n${dts.length} inter-point steps, ${u2.length} distinct values.`)
console.log("  smallest 8:", u2.slice(0, 8).map((x) => x.toFixed(3)).join(" "))
console.log("  largest 8:", u2.slice(-8).map((x) => x.toFixed(3)).join(" "))
// stroke START x (first point), which is what ductus order means
const sx = S.map((s) => s.points[0].x)
let back = 0
const where = []
for (let i = 1; i < sx.length; i++) if (sx[i] < sx[i - 1] - 1) { back++; where.push(`${i}(${sx[i].toFixed(0)} after ${sx[i - 1].toFixed(0)})`) }
console.log(`\nstroke START x, in draw order: ${sx.map((x) => x.toFixed(0)).join(" ")}`)
console.log(`strokes whose pen-down point is LEFT of the previous stroke's pen-down point: ${back} of ${sx.length - 1}`)
console.log("  " + where.join("  "))
