// Segments a measured TSV into MOVING vs STILL runs, so the film's actual
// beat structure falls out of the pixels instead of the source.
import { readFileSync } from "node:fs"

const file = process.argv[2]
const lines = readFileSync(file, "utf8").trim().split("\n").slice(1)
const R = lines.map((l) => {
  const [f, t, n, w, h, cx, cy, y0, y1, mean] = l.split("\t").map(Number)
  return { f, t, n, w, h, cx, cy, mean }
})

// A frame is "moving" if any measured quantity changed meaningfully vs prev.
const moving = R.map((r, i) => {
  if (i === 0) return true
  const p = R[i - 1]
  return (
    Math.abs(r.n - p.n) > Math.max(40, p.n * 0.004) ||
    Math.abs(r.w - p.w) > 1 ||
    Math.abs(r.h - p.h) > 1 ||
    Math.abs(r.cx - p.cx) > 0.6 ||
    Math.abs(r.mean - p.mean) > 0.25
  )
})

const runs = []
let start = 0
for (let i = 1; i <= R.length; i++) {
  if (i === R.length || moving[i] !== moving[start]) {
    runs.push({ moving: moving[start], a: R[start], b: R[i - 1], frames: i - start })
    start = i
  }
}
console.log(`${file}   ${R.length} frames / ${(R.length / 30).toFixed(2)}s`)
console.log("state   frames  t_start t_end   dur    ink        bbox         cx           meanL")
for (const r of runs) {
  if (r.frames < 2 && !r.moving) continue
  console.log(
    [
      r.moving ? "MOVE" : "STILL",
      String(r.frames).padStart(5),
      r.a.t.toFixed(2).padStart(7),
      r.b.t.toFixed(2).padStart(6),
      (r.frames / 30).toFixed(2).padStart(6),
      `${r.a.n}→${r.b.n}`.padStart(14),
      `${r.a.w}x${r.a.h}→${r.b.w}x${r.b.h}`.padStart(18),
      `${r.a.cx.toFixed(1)}→${r.b.cx.toFixed(1)}`.padStart(14),
      `${r.a.mean}→${r.b.mean}`.padStart(12),
    ].join(" "),
  )
}
