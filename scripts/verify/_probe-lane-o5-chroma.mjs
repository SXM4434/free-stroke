// WARM MUD OR NEUTRAL GRAPHITE — the half of "muddy" that luma cannot see.
import { loadImage, createCanvas } from "@napi-rs/canvas"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
async function at(label, h) {
  const DIR = join(ROOT, "docs/verification/hero-beat-film", label)
  const t = JSON.parse(readFileSync(join(DIR, "trace.json"), "utf8"))
  const tr = t.trace, t0 = tr[0][0]
  const tape = tr.map((r) => (r[0] - t0) / 1000), head = tr.map((r) => r[1])
  const headOf = (s) => { for (let i = 1; i < tape.length; i++) if (tape[i] >= s) return head[i]; return head[head.length - 1] }
  let best = 0, bd = Infinity
  for (const m of t.manifest) { const d = Math.abs(headOf(m.tSec) - h); if (d < bd) { bd = d; best = m.i } }
  const img = await loadImage(join(DIR, "frames", `${String(best).padStart(4, "0")}.png`))
  const c = createCanvas(img.width, img.height); const cx = c.getContext("2d"); cx.drawImage(img, 0, 0)
  const d = cx.getImageData(0, 0, img.width, img.height).data
  let n = 0, sat = 0, warm = 0, lum = 0
  for (let q = 0; q < d.length; q += 4) {
    const L = 0.2126 * d[q] + 0.7152 * d[q + 1] + 0.0722 * d[q + 2]
    if (L >= 200) continue
    n++; sat += Math.max(d[q], d[q + 1], d[q + 2]) - Math.min(d[q], d[q + 1], d[q + 2]); warm += d[q] - d[q + 2]; lum += L
  }
  console.log(`  ${label.padEnd(20)} ${h.toFixed(2)}s  frame ${String(best).padStart(4)}  mean luma ${(lum / n).toFixed(1).padStart(5)}  chroma ${(sat / n).toFixed(2).padStart(6)}  warm(r-b) ${(warm / n).toFixed(2).padStart(6)}`)
}
console.log("THE RANK HELD, both films:")
await at("o5-before-traced", 11.50)
await at("o5-after-split", 12.40)
await at("o5-after", 12.40)
console.log("\nTHE FLAT INK, both films — the control: if this moved too, the MATERIAL moved:")
await at("o5-before-traced", 5.95)
await at("o5-after-split", 5.95)
await at("o5-after", 5.95)
console.log("\nAND THE OTHER FILMS' SOLIDS, shot before this session touched anything:")
await at("opt-turnlands", 9.30)
await at("opt-standturn", 10.20)
