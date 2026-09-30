// A WELD OR A GRAZE — the second number the ink-contact test never asks for.
//
// `polylineDistance` returns ONE number: how close two strokes ever come. It
// cannot tell a `D`'s bowl running alongside its own stem for 90 px from an `e`
// whose protruded tail grazes the `s` next to it at a single point. Both come
// back "they touch", and the union-find fuses both.
//
// So this measures CONTACT LENGTH as well: the arc of stroke A that lies within
// one nib of stroke B. Two strokes of ONE letter share a long contact. Two
// letters that merely abut share a short one. If those two populations separate,
// the law has a second term and the `esk` cluster can be split without cutting
// through anything a viewer reads as one mass.
import { loadTs, ROOT } from "./_ts-load.mjs"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { layoutWord } from "../capture/letters.mjs"
import { processedHeroStrokes, HERO_INK_WIDTH_PX } from "./_hero-word.mjs"

const { assignLetters } = loadTs("lib/hero-letters.ts")
const INK = HERO_INK_WIDTH_PX

function segDist2(p, a, b) {
  const vx = b.x - a.x, vy = b.y - a.y
  const dd = vx * vx + vy * vy
  let t = dd > 1e-12 ? ((p.x - a.x) * vx + (p.y - a.y) * vy) / dd : 0
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const qx = a.x + t * vx - p.x, qy = a.y + t * vy - p.y
  return qx * qx + qy * qy
}
function distToPoly(p, b) {
  let best = Infinity
  for (let j = 1; j < b.length; j++) best = Math.min(best, segDist2(p, b[j - 1], b[j]))
  if (b.length === 1) best = Math.min(best, (p.x - b[0].x) ** 2 + (p.y - b[0].y) ** 2)
  return Math.sqrt(best)
}
function minDist(a, b) {
  let best = Infinity
  for (const p of a) best = Math.min(best, distToPoly(p, b))
  for (const p of b) best = Math.min(best, distToPoly(p, a))
  return best
}
/** Arc length of A within `reach` of B, plus the same for B within reach of A —
 *  the SMALLER of the two, because a long stroke brushing a short one shares
 *  only as much ink as the short one has. */
function contactLen(a, b, reach) {
  const run = (u, v) => {
    let L = 0
    for (let i = 1; i < u.length; i++) {
      const da = distToPoly(u[i - 1], v), db = distToPoly(u[i], v)
      if (da <= reach && db <= reach) L += Math.hypot(u[i].x - u[i - 1].x, u[i].y - u[i - 1].y)
    }
    return L
  }
  return Math.min(run(a, b), run(b, a))
}
/** Where along each stroke the contact sits: 0 = at the very start, 1 = the end,
 *  0.5 = the middle. An END contact is a hand-off between letters; a MIDDLE one
 *  is a crossing inside one. */
function contactWhere(a, b) {
  let best = Infinity, bi = 0
  for (let i = 0; i < a.length; i++) {
    const d = distToPoly(a[i], b)
    if (d < best) { best = d; bi = i }
  }
  return a.length < 2 ? 0 : bi / (a.length - 1)
}

function report(label, strokes) {
  const map = assignLetters(strokes, INK)  // at LETTER_REACH_FRAC, the shipped law
  console.log(`\n=== ${label} — ${map.count} letters ===`)
  const groups = new Map()
  map.of.forEach((li, si) => {
    if (!groups.has(li)) groups.set(li, [])
    groups.get(li).push(si)
  })
  for (const [li, members] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    if (members.length < 2) { console.log(`  L${li}: {${members}}  single`); continue }
    console.log(`  L${li}: {${members}}`)
    const rows = []
    for (let i = 0; i < members.length; i++)
      for (let j = i + 1; j < members.length; j++) {
        const A = strokes[members[i]].points, B = strokes[members[j]].points
        const d = minDist(A, B)
        if (d > INK) continue
        rows.push([members[i], members[j], d, contactLen(A, B, INK), contactWhere(A, B), contactWhere(B, A)])
      }
    rows.sort((x, y) => y[3] - x[3])
    for (const [a, b, d, L, wa, wb] of rows)
      console.log(
        `      ${String(a).padStart(2)}–${String(b).padStart(2)}` +
          `  d ${d.toFixed(1).padStart(5)}px` +
          `  contact ${L.toFixed(1).padStart(6)}px = ${(L / INK).toFixed(2).padStart(5)} nib` +
          `  at ${wa.toFixed(2)}/${wb.toFixed(2)}`,
      )
  }
}

const traced = processedHeroStrokes()
report("TRACED processed — WHAT RENDERS", traced)
const raw = JSON.parse(readFileSync(join(ROOT, "scripts/capture/logo-strokes.json"), "utf8"))
report("TRACED raw", raw.polylines.map((pl) => ({ points: pl })))
const laid = layoutWord("Desk Doodles", { x: 0, y: 0, size: 120, tracking: 12 })
const k = 1100 / laid.width
const font = laid.polylines.map((pl) => ({ points: pl.map((p) => ({ x: p.x * k, y: 400 + p.y * k })) }))
report("FONT (authored 11)", font)

/* ---- and the same-letter / different-letter populations, on the FONT, where
 *      the truth is known -------------------------------------------------- */
console.log(`\n=== FONT: contact length by whether the pair is REALLY one letter ===`)
const same = [], diff = []
for (let i = 0; i < font.length; i++)
  for (let j = i + 1; j < font.length; j++) {
    const d = minDist(font[i].points, font[j].points)
    if (d > INK) continue
    const L = contactLen(font[i].points, font[j].points, INK)
    ;(laid.letterOf[i] === laid.letterOf[j] ? same : diff).push([i, j, d, L])
  }
const fmt = (r) => r.map(([i, j, d, L]) => `${i}-${j}(d${d.toFixed(1)},L${L.toFixed(1)})`).join(" ")
console.log(`  SAME letter, within a nib (${same.length}): ${fmt(same)}`)
console.log(`  DIFFERENT letters, within a nib (${diff.length}): ${fmt(diff)}`)
