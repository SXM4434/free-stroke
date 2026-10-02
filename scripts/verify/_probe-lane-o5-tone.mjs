// IS "MUDDY" A TONE OR AN EVENT — measured off the film's own frames.
//
// Two different complaints hide behind one word. If the un-flipped letters are
// no longer the same black they were before the cascade started, the word is
// muddy in the TONE sense and the per-letter flat is not reproducing the global
// one. If they are identical and only the cascade's legibility changed, "muddy"
// was about the EVENT and the split is the whole fix.
//
// Sampled as the DARKEST DECILE of the mark's own pixels, which is the ink core
// — a mean over the stage would be measuring how much paper is in frame.
import { loadImage } from "@napi-rs/canvas"
import { createCanvas } from "@napi-rs/canvas"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const arg = (k, d) => { const h = process.argv.find((a) => a.startsWith(`--${k}=`)); return h ? h.split("=").slice(1).join("=") : d }

async function sample(label, heads) {
  const DIR = join(ROOT, "docs/verification/hero-beat-film", label)
  const t = JSON.parse(readFileSync(join(DIR, "trace.json"), "utf8"))
  const tr = t.trace, t0 = tr[0][0]
  const tape = tr.map((r) => (r[0] - t0) / 1000), head = tr.map((r) => r[1])
  const frameAt = (h) => {
    let best = null, bd = Infinity
    for (const m of t.manifest) {
      let hh = head[0]
      for (let i = 1; i < tape.length; i++) if (tape[i] >= m.tSec) { hh = head[i]; break }
      const d = Math.abs(hh - h)
      if (d < bd) { bd = d; best = m.i }
    }
    return best
  }
  const out = []
  for (const [name, h] of heads) {
    const i = frameAt(h)
    const img = await loadImage(join(DIR, "frames", `${String(i).padStart(4, "0")}.png`))
    const c = createCanvas(img.width, img.height)
    const cx = c.getContext("2d")
    cx.drawImage(img, 0, 0)
    const d = cx.getImageData(0, 0, img.width, img.height).data
    const lum = []
    for (let p = 0; p < d.length; p += 4) {
      const L = 0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2]
      if (L < 200) lum.push(L) // the mark, not the paper
    }
    lum.sort((a, b) => a - b)
    if (!lum.length) { out.push([name, i, NaN, NaN, 0]); continue }
    const core = lum.slice(0, Math.max(1, Math.round(lum.length * 0.1)))
    const med = lum[Math.floor(lum.length / 2)]
    out.push([name, i, core.reduce((a, b) => a + b, 0) / core.length, med, lum.length])
  }
  console.log(`\n=== ${label} ===`)
  console.log(`  moment                       frame   ink core   mark median   mark px`)
  for (const [n, i, c2, m, px] of out)
    console.log(`  ${n.padEnd(28)} ${String(i).padStart(5)}   ${c2.toFixed(1).padStart(8)}   ${m.toFixed(1).padStart(11)}   ${String(px).padStart(7)}`)
  return out
}

await sample("o5-before-traced", [
  ["flat hold, before the cascade", 5.9],
  ["mid-cascade, letters unflipped", 7.0],
  ["mid-cascade, half converted", 8.8],
  ["THE RANK HELD", 11.1],
  ["flat again, after the return", 13.6],
])
await sample("o5-after-split", [
  ["flat hold, before the cascade", 5.9],
  ["mid-cascade, letters unflipped", 7.0],
  ["mid-cascade, half converted", 9.2],
  ["THE RANK HELD", 12.4],
  ["flat again, after the return", 14.6],
])
await sample("opt-standturn", [
  ["flat hold", 5.9],
  ["the solid, whole word", 8.6],
])

/* THE FAIR A/B, AT THE RIGHT FRAMES. `turnLands` is the other DEAD-ON film —
 * same camera, same material, same flat ink — so a difference here is the
 * LANDING and not the lighting. Its `descend` payoff runs 9.35-9.38 and its held
 * landed pose is the `orbit` tail; `letterByLetter`'s rank is `solid`,
 * 11.43-13.63. Frames taken from each film's own stage crop, not a screenshot
 * with a panel in it. */
await sample("opt-turnlands", [
  ["flat hold, before the turn", 5.9],
  ["landed at 38 deg, held", 9.30],
  ["landed at 38 deg, held +", 9.36],
])
await sample("opt-standturn", [
  ["landed at 38 deg, descend", 10.2],
])
await sample("o5-after-split", [
  ["THE RANK, 16 deg, early", 11.6],
  ["THE RANK, 16 deg, mid", 12.5],
  ["THE RANK, 16 deg, late", 13.5],
])
