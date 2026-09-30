// WHERE THE FUSED LETTERS ACTUALLY TOUCH — the neck, measured, not asserted.
//
// `lib/hero-letters.ts` USED TO union two strokes when their centrelines came
// within one ink DIAMETER, which is the tangency distance: at exactly that
// number two round nibs share a single point and nothing more. This probe is
// what asked the question the union-find never did — HOW HARD do they touch —
// because "the ink is joined and splitting it would tear" is a claim about the
// WIDTH of the join, and that width has a closed form. Its answer is why
// `LETTER_REACH_FRAC` exists and is 0.5.
//
// Two nibs of radius r whose centrelines pass at distance d overlap in a lens
// whose half-width is `sqrt(r^2 - (d/2)^2)` measured across the join. So:
//
//   d = 2r  (tangent)   neck 0      — they graze, nothing is shared
//   d = r               neck 1.73r  — a real weld
//   d = 0               neck 2r     — the same stroke twice
//
// Printed per pair inside every fused group, on the traced word and on the font,
// so the split-or-not decision is taken against the picture's own numbers.
import { loadTs, ROOT } from "./_ts-load.mjs"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { layoutWord } from "../capture/letters.mjs"
import { processedHeroStrokes, HERO_INK_WIDTH_PX } from "./_hero-word.mjs"

const { assignLetters, LETTER_REACH_FRAC } = loadTs("lib/hero-letters.ts")
const REACH = LETTER_REACH_FRAC
const INK = HERO_INK_WIDTH_PX
const R = INK / 2

function segDist2(p, a, b) {
  const vx = b.x - a.x
  const vy = b.y - a.y
  const dd = vx * vx + vy * vy
  let t = dd > 1e-12 ? ((p.x - a.x) * vx + (p.y - a.y) * vy) / dd : 0
  if (t < 0) t = 0
  else if (t > 1) t = 1
  const qx = a.x + t * vx - p.x
  const qy = a.y + t * vy - p.y
  return qx * qx + qy * qy
}
function polyDist(a, b) {
  let best = Infinity
  for (const p of a) for (let j = 1; j < b.length; j++) best = Math.min(best, segDist2(p, b[j - 1], b[j]))
  for (const p of b) for (let j = 1; j < a.length; j++) best = Math.min(best, segDist2(p, a[j - 1], a[j]))
  return Math.sqrt(best)
}
const neckOf = (d) => (d >= 2 * R ? 0 : 2 * Math.sqrt(Math.max(0, R * R - (d / 2) * (d / 2))))

function report(label, strokes, seed) {
  const map = assignLetters(strokes, INK, seed)
  console.log(`\n=== ${label} — ${map.count} letters at reach ${(INK * REACH).toFixed(2)} = ${REACH} nib (r ${R.toFixed(2)}) ===`)
  const groups = new Map()
  map.of.forEach((li, si) => {
    if (!groups.has(li)) groups.set(li, [])
    groups.get(li).push(si)
  })
  for (const [li, members] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    if (members.length < 2) {
      console.log(`  letter ${li}: {${members}}  single stroke`)
      continue
    }
    // Every pair that is actually within reach — the edges that built this group.
    const edges = []
    for (let i = 0; i < members.length; i++)
      for (let j = i + 1; j < members.length; j++) {
        const d = polyDist(strokes[members[i]].points, strokes[members[j]].points)
        if (d <= INK) edges.push([members[i], members[j], d])
      }
    edges.sort((a, b) => a[2] - b[2])
    console.log(`  letter ${li}: {${members}}`)
    for (const [a, b, d] of edges) {
      const nk = neckOf(d)
      console.log(
        `      ${String(a).padStart(2)}–${String(b).padStart(2)}  d ${d.toFixed(2).padStart(6)}px` +
          `  = ${(d / INK).toFixed(3)} nib  neck ${nk.toFixed(2).padStart(6)}px = ${(nk / INK).toFixed(3)} nib`,
      )
    }
  }
}

/* ---- the traced word, as the page processes it ---------------------------- */
const traced = processedHeroStrokes()
report("TRACED (processed, as rendered)", traced)

/* ---- the raw trace, for comparison ---------------------------------------- */
const raw = JSON.parse(readFileSync(join(ROOT, "scripts/capture/logo-strokes.json"), "utf8"))
report("TRACED (raw polylines)", raw.polylines.map((pl) => ({ points: pl })))

/* ---- the font, which carries the authored answer -------------------------- */
const laid = layoutWord("Desk Doodles", { x: 0, y: 0, size: 120, tracking: 12 })
const k = 1100 / laid.width
const fontStrokes = laid.polylines.map((pl) => ({ points: pl.map((p) => ({ x: p.x * k, y: 400 + p.y * k })) }))
report("FONT (no seed — the calibration)", fontStrokes)

/* ---- how the count moves with a NECK threshold ----------------------------- */
console.log(`\n=== count vs NECK threshold (fraction of one nib) ===`)
console.log(`neck    traced  font(no seed)  font(seeded)`)
for (const f of [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]) {
  // neck f·INK  <->  d = 2·sqrt(r^2 - (f·INK/2)^2)
  const half = (f * INK) / 2
  const d = 2 * Math.sqrt(Math.max(0, R * R - half * half))
  // `d` is an absolute distance, so it is handed in as the reach FRACTION of one
  // nib — `assignLetters` multiplies. Passing it as `inkWidth` would silently
  // halve every row of this table.
  const t = assignLetters(traced, INK, undefined, d / INK)
  const fo = assignLetters(fontStrokes, INK, undefined, d / INK)
  const fs = assignLetters(fontStrokes, INK, laid.letterOf, d / INK)
  console.log(
    `${f.toFixed(2)}   d ${d.toFixed(2).padStart(6)}   ${String(t.count).padStart(2)}` +
      `        ${String(fo.count).padStart(2)}` +
      `            ${String(fs.count).padStart(2)}${fs.count === laid.letterCount && fs.of.every((v, i) => v === laid.letterOf[i]) ? "  EXACT" : ""}`,
  )
}
