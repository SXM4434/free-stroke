// HOW THE LETTER COUNT MOVES WITH THE REACH — on all three words at once, with
// the groups printed, so the threshold is chosen against the picture and not
// against a round number.
import { loadTs, ROOT } from "./_ts-load.mjs"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { layoutWord } from "../capture/letters.mjs"
import { processedHeroStrokes, HERO_INK_WIDTH_PX } from "./_hero-word.mjs"
const { assignLetters, letterGapAfter } = loadTs("lib/hero-letters.ts")
const INK = HERO_INK_WIDTH_PX
const proc = processedHeroStrokes()
const raw = JSON.parse(readFileSync(join(ROOT, "scripts/capture/logo-strokes.json"), "utf8"))
  .polylines.map((pl) => ({ points: pl }))
const laid = layoutWord("Desk Doodles", { x: 0, y: 0, size: 120, tracking: 12 })
const k = 1100 / laid.width
const font = laid.polylines.map((pl) => ({ points: pl.map((p) => ({ x: p.x * k, y: 400 + p.y * k })) }))
const long = layoutWord("the quick brown fox jumps", { x: 0, y: 0, size: 120, tracking: 12 })
const lk = 1100 / long.width
const longS = long.polylines.map((pl) => ({ points: pl.map((p) => ({ x: p.x * lk, y: 400 + p.y * lk })) }))

const g = (m) => {
  const gr = new Map()
  m.of.forEach((li, si) => { if (!gr.has(li)) gr.set(li, []); gr.get(li).push(si) })
  return [...gr.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => `{${v.join(",")}}`).join("")
}
console.log(`nib diameter ${INK.toFixed(2)}px, radius ${(INK / 2).toFixed(2)}px`)
console.log(`\nreach/nib   px    PROC  RAW   FONT(bare)  FONT(seed)  LONG(seed, authored ${long.letterCount})`)
for (const f of [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.45, 0.4, 0.3, 0.2, 0.1]) {
  const d = INK * f
  const p = assignLetters(proc, d), r = assignLetters(raw, d)
  const fb = assignLetters(font, INK, undefined, f), fsd = assignLetters(font, INK, laid.letterOf, f)
  const ls = assignLetters(longS, INK, long.letterOf, f)
  const ok = fsd.count === laid.letterCount && fsd.of.every((v, i) => v === laid.letterOf[i])
  const lok = ls.count === long.letterCount && ls.of.every((v, i) => v === long.letterOf[i])
  console.log(
    `${f.toFixed(2)}    ${d.toFixed(1).padStart(5)}   ${String(p.count).padStart(2)}    ${String(r.count).padStart(2)}` +
    `    ${String(fb.count).padStart(2)}          ${String(fsd.count).padStart(2)}${ok ? " EXACT" : " ----- "}` +
    `      ${String(ls.count).padStart(2)}${lok ? " EXACT" : " -----"}`)
}
console.log(`\n--- groups, PROCESSED (what renders) ---`)
for (const f of [1.0, 0.7, 0.5, 0.4]) {
  const m = assignLetters(proc, INK, undefined, f)
  console.log(`reach ${f.toFixed(2)} nib -> ${m.count} letters, gap after ${letterGapAfter(proc, m)}: ${g(m)}`)
}
console.log(`\n--- groups, RAW ---`)
for (const f of [1.0, 0.7, 0.5, 0.4]) {
  const m = assignLetters(raw, INK, undefined, f)
  console.log(`reach ${f.toFixed(2)} nib -> ${m.count} letters, gap after ${letterGapAfter(raw, m)}: ${g(m)}`)
}
