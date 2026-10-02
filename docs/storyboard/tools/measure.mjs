// Per-frame ink measurement over the composited ochre frames.
// Reports: ink pixel count, bbox (x0,y0,x1,y1), width, height, centre, mean ink luminance.
import sharp from "/Users/sebs/Desktop/Projects/free-stroke/node_modules/sharp/lib/index.js"
import { readdirSync } from "node:fs"
import { join } from "node:path"

const dir = process.argv[2]
const THRESH = Number(process.argv[3] ?? 150) // ink = luminance below this (paper ochre ~ 190)
const files = readdirSync(dir).filter((f) => f.endsWith(".jpg")).sort()

const rows = []
for (let i = 0; i < files.length; i++) {
  const { data, info } = await sharp(join(dir, files[i]))
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const w = info.width, h = info.height
  let n = 0, sum = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = data[y * w + x]
      if (v < THRESH) {
        n++; sum += v
        if (x < x0) x0 = x; if (x > x1) x1 = x
        if (y < y0) y0 = y; if (y > y1) y1 = y
      }
    }
  }
  rows.push({
    f: i,
    n,
    x0: n ? x0 : 0, y0: n ? y0 : 0, x1: n ? x1 : 0, y1: n ? y1 : 0,
    w: n ? x1 - x0 + 1 : 0,
    h: n ? y1 - y0 + 1 : 0,
    cx: n ? (x0 + x1) / 2 : 0,
    cy: n ? (y0 + y1) / 2 : 0,
    mean: n ? +(sum / n).toFixed(1) : 0,
  })
}
console.log("frame\tt(s)\tink\tbbox_w\tbbox_h\tcx\tcy\ty0\ty1\tmeanL")
for (const r of rows) {
  console.log(
    [r.f, (r.f / 30).toFixed(2), r.n, r.w, r.h, r.cx.toFixed(1), r.cy.toFixed(1), r.y0, r.y1, r.mean].join("\t"),
  )
}
