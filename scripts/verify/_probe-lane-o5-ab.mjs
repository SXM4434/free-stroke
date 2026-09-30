// BEFORE AND AFTER, THE SAME MOMENTS, SIDE BY SIDE — the visual loop.
//
// Two films, one column each, sampled at matched fractions of their own cascade
// so the comparison is "what is the word doing a third of the way through the
// run" rather than "what is on the same wall-clock second of two clips of
// different lengths".
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const arg = (k, d) => { const h = process.argv.find((a) => a.startsWith(`--${k}=`)); return h ? h.split("=").slice(1).join("=") : d }
const A = arg("a", "o5-before-traced"), B = arg("b", "o5-after")
const AWIN = arg("awin", "6.07,10.44").split(",").map(Number)
const BWIN = arg("bwin", "6.07,11.40").split(",").map(Number)
const N = parseInt(arg("n", "10"), 10)

function loader(label) {
  const DIR = join(ROOT, "docs/verification/hero-beat-film", label)
  const t = JSON.parse(readFileSync(join(DIR, "trace.json"), "utf8"))
  const tr = t.trace, t0 = tr[0][0]
  const tape = tr.map((r) => (r[0] - t0) / 1000), head = tr.map((r) => r[1])
  const headOf = (s) => {
    for (let i = 1; i < tape.length; i++) if (tape[i] >= s) return head[i]
    return head[head.length - 1]
  }
  return { DIR, frameAt: (h) => { let best = 0, bd = Infinity; for (const m of t.manifest) { const d = Math.abs(headOf(m.tSec) - h); if (d < bd) { bd = d; best = m.i } } return best } }
}
const la = loader(A), lb = loader(B)
const W = 560, H = 150, Z = 1.5, LBL = 18
const c = createCanvas(W * Z * 2 + 8, N * (H * Z + LBL))
const cx = c.getContext("2d")
cx.fillStyle = "#0d0d0d"; cx.fillRect(0, 0, c.width, c.height)
for (let k = 0; k < N; k++) {
  const f = k / (N - 1)
  const ha = AWIN[0] + f * (AWIN[1] - AWIN[0]), hb = BWIN[0] + f * (BWIN[1] - BWIN[0])
  const ia = la.frameAt(ha), ib = lb.frameAt(hb)
  const ima = await loadImage(join(la.DIR, "frames", `${String(ia).padStart(4, "0")}.png`))
  const imb = await loadImage(join(lb.DIR, "frames", `${String(ib).padStart(4, "0")}.png`))
  const y = k * (H * Z + LBL)
  const sx = Math.round(ima.width * 0.5 - W / 2), sy = Math.round(ima.height * 0.5 - H / 2)
  cx.drawImage(ima, sx, sy, W, H, 0, y, W * Z, H * Z)
  cx.drawImage(imb, sx, sy, W, H, W * Z + 8, y, W * Z, H * Z)
  cx.fillStyle = "#ddd"; cx.font = "13px monospace"
  cx.fillText(`BEFORE ${ha.toFixed(2)}s`, 6, y + H * Z + 14)
  cx.fillText(`AFTER ${hb.toFixed(2)}s`, W * Z + 14, y + H * Z + 14)
}
mkdirSync(join(ROOT, "docs/verification/hero-beat-film", B, "strips"), { recursive: true })
const out = join(ROOT, "docs/verification/hero-beat-film", B, "strips", "before-after.png")
writeFileSync(out, c.toBuffer("image/png"))
console.log(out)
