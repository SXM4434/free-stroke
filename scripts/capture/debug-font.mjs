import { createCanvas } from "@napi-rs/canvas"
import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { layoutWord } from "./letters.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const { polylines, width } = layoutWord("Desk Doodles", { x: 40, y: 160, size: 120, tracking: 12 })

const W = Math.ceil(width + 80)
const H = 260
const c = createCanvas(W, H)
const x = c.getContext("2d")
x.fillStyle = "#fff"
x.fillRect(0, 0, W, H)
x.strokeStyle = "#111"
x.lineWidth = 16
x.lineCap = "round"
x.lineJoin = "round"
for (const pl of polylines) {
  x.beginPath()
  pl.forEach((p, i) => (i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y)))
  x.stroke()
}
writeFileSync(join(__dirname, "font-debug.png"), c.toBuffer("image/png"))
console.log(`wrote font-debug.png ${W}x${H}, polylines=${polylines.length}, wordWidth=${Math.round(width)}`)
