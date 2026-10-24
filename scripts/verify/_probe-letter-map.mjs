// CALIBRATE THE LETTER LAW — against the one word that carries an authored map.
//
// `lib/hero-letters.ts` decides letters from the ink alone. The FONT path is the
// only place a ground truth exists (`layoutWord` returns `letterOf`), so the law
// is run over the font's own polylines and required to reproduce it exactly.
// Then the same law is run over Sebs's TRACED word, which has no labels, and the
// components it finds are printed for a human to read.
import { loadTs, ROOT } from "./_ts-load.mjs"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { layoutWord } from "../capture/letters.mjs"

const { assignLetters, letterGapAfter } = loadTs("lib/hero-letters.ts")
const { computeSolidEffectiveThicknessPx, DEFAULT_SOLID_PARAMS } = loadTs("lib/geometry-engines.ts")
const INK = computeSolidEffectiveThicknessPx(DEFAULT_SOLID_PARAMS.thickness)
console.log(`ink diameter in stroke coords: ${INK.toFixed(2)} px\n`)

/* ---- the font, which has an authored answer ------------------------------- */
const laid = layoutWord("Desk Doodles", { x: 0, y: 0, size: 120, tracking: 12 })
const FONT_TARGET_W = 1100
const k = FONT_TARGET_W / laid.width
const fontStrokes = laid.polylines.map((pl) => ({
  points: pl.map((p) => ({ x: p.x * k, y: 400 + p.y * k })),
}))
const got = assignLetters(fontStrokes, INK)
const want = laid.letterOf
const exact = got.count === laid.letterCount && got.of.every((v, i) => v === want[i])
console.log(`FONT   authored ${laid.letterCount} letters  ${want.join(",")}`)
console.log(`FONT   measured ${got.count} letters  ${got.of.join(",")}`)
console.log(`FONT   ${exact ? "EXACT MATCH" : "MISMATCH"}`)
console.log(`FONT   word gap after letter ${letterGapAfter(fontStrokes, got)}\n`)

/* ---- the traced word, which does not --------------------------------------- */
const traced = JSON.parse(readFileSync(join(ROOT, "scripts/capture/logo-strokes.json"), "utf8"))
const tStrokes = traced.polylines.map((pl) => ({ points: pl }))
for (const w of [INK * 0.5, INK, INK * 1.5]) {
  const t = assignLetters(tStrokes, w)
  const groups = new Map()
  t.of.forEach((li, si) => {
    if (!groups.has(li)) groups.set(li, [])
    groups.get(li).push(si)
  })
  console.log(
    `TRACED at reach ${w.toFixed(1)}px -> ${t.count} letters, gap after ${letterGapAfter(tStrokes, t)}: ` +
      [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([li, m]) => `${li}:{${m.join(",")}}`).join(" "),
  )
}
