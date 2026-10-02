import { createCanvas, loadImage } from "@napi-rs/canvas"
import { writeFileSync } from "node:fs"
const [out, cols, ...files] = process.argv.slice(2)
const ims = await Promise.all(files.map((f) => loadImage(f)))
const w = ims[0].width, h = ims[0].height, C = Number(cols), R = Math.ceil(ims.length / C)
const c = createCanvas(w * C, h * R); const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w * C, h * R)
ims.forEach((im, i) => { g.drawImage(im, (i % C) * w, Math.floor(i / C) * h); g.fillStyle = "#c00"; g.font = "20px sans-serif"; g.fillText(files[i].split("/").pop(), (i % C) * w + 6, Math.floor(i / C) * h + 22) })
writeFileSync(out, c.toBuffer("image/png")); console.log(w, h, out)
