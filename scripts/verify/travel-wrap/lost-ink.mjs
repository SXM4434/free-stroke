// Which ink one film frame has that the next one lost (red), gained (blue), both (grey), against
// clean.png at film-loop THR 24. Usage: lost-ink.mjs <clean.png> <a.png> <b.png> <out.png>
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { writeFileSync } from "node:fs"
const [clean, a, b, out] = process.argv.slice(2)
const L = async (f) => { const im = await loadImage(f); const c = createCanvas(im.width, im.height); const g = c.getContext("2d"); g.drawImage(im, 0, 0); return { w: im.width, h: im.height, d: g.getImageData(0, 0, im.width, im.height).data } }
const [C, A, B] = await Promise.all([clean, a, b].map(L))
const ink = (X, i) => Math.abs(((X.d[i]*77+X.d[i+1]*150+X.d[i+2]*29)>>8) - ((C.d[i]*77+C.d[i+1]*150+C.d[i+2]*29)>>8)) > 24
const c = createCanvas(C.w, C.h); const g = c.getContext("2d"); const o = g.createImageData(C.w, C.h)
let lost = 0, gained = 0, bb = [1e9, 1e9, -1, -1]
for (let i = 0; i < C.d.length; i += 4) { const ia = ink(A, i), ib = ink(B, i), p = i / 4, x = p % C.w, y = (p / C.w) | 0
  let col = [255, 255, 255]; if (ia && ib) col = [200, 200, 200]; else if (ia) { col = [220, 0, 0]; lost++; bb = [Math.min(bb[0], x), Math.min(bb[1], y), Math.max(bb[2], x), Math.max(bb[3], y)] } else if (ib) { col = [0, 120, 255]; gained++ }
  o.data.set([...col, 255], i) }
g.putImageData(o, 0, 0); writeFileSync(out, c.toBuffer("image/png")); console.log(JSON.stringify({ lost, gained, lostBox: bb }))
