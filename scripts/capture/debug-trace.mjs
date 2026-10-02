import { createCanvas } from "@napi-rs/canvas"
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const data = JSON.parse(readFileSync(join(__dirname, "logo-strokes.json")))
const { width, height, polylines } = data

const c = createCanvas(width, height)
const ctx = c.getContext("2d")
ctx.fillStyle = "#ffffff"
ctx.fillRect(0, 0, width, height)
ctx.lineWidth = 6
ctx.lineCap = "round"
ctx.lineJoin = "round"
let i = 0
for (const p of polylines) {
  // color each polyline differently to inspect fragmentation
  const hue = (i * 47) % 360
  ctx.strokeStyle = `hsl(${hue},80%,45%)`
  ctx.beginPath()
  ctx.moveTo(p[0].x, p[0].y)
  for (let k = 1; k < p.length; k++) ctx.lineTo(p[k].x, p[k].y)
  ctx.stroke()
  i++
}
writeFileSync(join(__dirname, "trace-debug.png"), c.toBuffer("image/png"))
console.log("wrote trace-debug.png", width + "x" + height, "polylines=" + polylines.length)
