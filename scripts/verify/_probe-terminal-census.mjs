// HOW MANY FREE STROKE ENDS DOES THIS WORD ACTUALLY HAVE, and how much of the
// outline can a terminal treatment therefore reach?
//
// The first run of `assert-flat-silhouette.mjs` found only FOUR medial-axis
// terminals in the whole word at a 3-radius spur filter. If that is the real
// number then tapering terminals changes four places out of a word 648 px wide,
// and it cannot on its own be the answer to *"IT'S HARD TO TELL IT WENT FROM 2D
// TO 3D"*. So this counts them properly before anything is built on top.
//
// Usage: node scripts/verify/_probe-terminal-census.mjs
import { readFileSync } from "node:fs"
import { boundaryFromPng } from "./lib/medial-width.mjs"

const png = readFileSync("docs/verification/flat-silhouette/today/flat.png")

console.log("terminal census on the shipped flat state, by spur filter:\n")
console.log("  spur filter   terminals   median tRatio   (branch must exceed spurK x median half-width)")
for (const spurK of [0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 6.0]) {
  const s = await boundaryFromPng(png, { spurK })
  console.log(
    `  ${spurK.toFixed(1).padStart(6)} x R   ${String(s.terminalCount).padStart(6)}      ` +
      `${s.terminalRatio.toFixed(3)}          median half-width ${s.median.toFixed(3)}`,
  )
}

const s = await boundaryFromPng(png, { spurK: 3.0 })
console.log(`\nhalf-width distribution over the whole medial axis (${s.n} samples):`)
const sorted = Float64Array.from(s.widths).sort()
const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
for (const p of [0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 1.0])
  console.log(`  p${String(Math.round(p * 100)).padStart(3)}  ${q(p).toFixed(3)} px`)

console.log(
  `\nSo the outline this word presents is ${s.inkPx} ink px with ${s.n} medial samples, and a\n` +
    `terminal device reaches ${s.terminalCount} of them. Everything else is stroke BODY and\n` +
    `fusion boundary — which is where a width law and a fillet law act, and a terminal law cannot.`,
)
