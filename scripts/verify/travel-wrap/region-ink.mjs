// Ink count (grey diff > 24 against clean.png, film-loop's THR) split at a row: above = the 3D
// scene, below = the take panel inside the same crop. Usage: region-ink.mjs <filmdir> <splitRow> <frame...>
import { createCanvas, loadImage } from "@napi-rs/canvas"
const [dir, split, ...names] = process.argv.slice(2)
const grey = async (f) => { const i = await loadImage(f); const c = createCanvas(i.width, i.height); const g = c.getContext("2d"); g.drawImage(i, 0, 0); const d = g.getImageData(0, 0, i.width, i.height).data; const a = new Uint8Array(i.width * i.height); for (let k = 0; k < a.length; k++) a[k] = (d[4 * k] * 77 + d[4 * k + 1] * 150 + d[4 * k + 2] * 29) >> 8; return { a, w: i.width } }
const clean = await grey(`${dir}/clean.png`)
for (const n of names) {
  const f = await grey(`${dir}/frames/${n}`); let up = 0, lo = 0
  for (let k = 0; k < f.a.length; k++) if (Math.abs(f.a[k] - clean.a[k]) > 24) (Math.floor(k / f.w) < Number(split) ? up++ : lo++)
  console.log(`${n} scene ${up} panel ${lo}`)
}
