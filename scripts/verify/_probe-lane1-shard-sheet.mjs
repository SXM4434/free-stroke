// _PROBE-LANE1-SHARD-SHEET — SIDE-BY-SIDE, AT 6x, WHERE THE TWO ARMS DISAGREE.
//
// `_probe-lane1-cascade-diff.mjs` says WHICH frames differ and by how much. A
// number cannot say whether what changed is a shard being removed or a shard
// being introduced, and this repo's whole record is that the sum could not see
// the letter come apart. So this crops the disagreeing REGIONS out of both arms
// at the same rectangle and magnifies them nearest-neighbour, PRIOR beside
// SHIPPED, one row per region.
//
// Registered crops: both tiles come from the SAME box, so a difference in the
// picture is a difference in the render and never a difference in framing.
//
// Opacity is asserted on the source frames and on the sheet this writes — a
// contact sheet in this repo has twice been read on the wrong background and
// twice produced a wrong verdict.
//
// Usage: node scripts/verify/_probe-lane1-shard-sheet.mjs \
//          --dir=docs/verification/letter-seam-picture/cascade --frame=127 \
//          --zoom=6 --out=docs/verification/letter-seam-picture/cascade/SHEET-127.png
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, isAbsolute } from "node:path"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const abs = (p) => (isAbsolute(p) ? p : join(ROOT, p))
const DIR = abs(arg("dir", ""))
const FRAME = arg("frame", "127")
const ZOOM = parseInt(arg("zoom", "6"), 10)
const PAD = parseInt(arg("pad", "16"), 10)
const MINPX = parseInt(arg("minpx", "20"), 10)
const OUTP = abs(arg("out", join(DIR, `SHEET-${FRAME}.png`)))
const A_DIR = arg("a", "prior")
const B_DIR = arg("b", "whole")

let pass = true
const say = (ok, l, d) => { if (!ok) pass = false; console.log(`${ok ? "PASS" : "FAIL"}  ${l}${d ? " — " + d : ""}`) }

async function read(p) {
  const img = await loadImage(p)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const id = x.getImageData(0, 0, img.width, img.height)
  let transparent = 0
  const hist = new Uint32Array(256)
  for (let i = 0; i < id.data.length; i += 4) {
    if (id.data[i + 3] < 255) transparent++
    hist[(0.2126 * id.data[i] + 0.7152 * id.data[i + 1] + 0.0722 * id.data[i + 2]) | 0]++
  }
  let paper = 0
  for (let l = 1; l < 256; l++) if (hist[l] > hist[paper]) paper = l
  return { id, w: img.width, h: img.height, transparent, paper, canvas: c }
}

async function main() {
  const A = await read(join(DIR, A_DIR, `${FRAME}.png`))
  const B = await read(join(DIR, B_DIR, `${FRAME}.png`))
  say(A.transparent === 0, `${A_DIR}/${FRAME} is OPAQUE`, `${A.transparent} px`)
  say(B.transparent === 0, `${B_DIR}/${FRAME} is OPAQUE`, `${B.transparent} px`)

  const m = new Uint8Array(A.w * A.h)
  let n = 0
  for (let i = 0, p = 0; i < A.id.data.length; i += 4, p++) {
    const d = Math.max(
      Math.abs(A.id.data[i] - B.id.data[i]),
      Math.abs(A.id.data[i + 1] - B.id.data[i + 1]),
      Math.abs(A.id.data[i + 2] - B.id.data[i + 2]),
    )
    if (d > 12) { m[p] = 1; n++ }
  }
  say(n > 0, "the two arms disagree on this frame at all", `${n} px`)

  const seen = new Uint8Array(m.length)
  const st = new Int32Array(m.length)
  const comps = []
  for (let p = 0; p < m.length; p++) {
    if (!m[p] || seen[p]) continue
    let sp = 0; st[sp++] = p; seen[p] = 1
    let c = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
    while (sp > 0) {
      const q = st[--sp]; const qx = q % A.w; const qy = (q / A.w) | 0
      c++
      if (qx < x0) x0 = qx; if (qx > x1) x1 = qx
      if (qy < y0) y0 = qy; if (qy > y1) y1 = qy
      for (let dy = -2; dy <= 2; dy++) {
        const ny = qy + dy; if (ny < 0 || ny >= A.h) continue
        for (let dx = -2; dx <= 2; dx++) {
          const nx = qx + dx; if (nx < 0 || nx >= A.w) continue
          const r = ny * A.w + nx
          if (m[r] && !seen[r]) { seen[r] = 1; st[sp++] = r }
        }
      }
    }
    if (c >= MINPX) comps.push({ c, x0, y0, x1, y1 })
  }
  comps.sort((a, b) => b.c - a.c)
  say(comps.length > 0, "…and the disagreement forms real regions", `${comps.length} region(s)`)

  const boxes = comps.map((o) => ({
    x0: Math.max(0, o.x0 - PAD), y0: Math.max(0, o.y0 - PAD),
    x1: Math.min(A.w - 1, o.x1 + PAD), y1: Math.min(A.h - 1, o.y1 + PAD),
    c: o.c,
  }))
  const tileW = Math.max(...boxes.map((b) => b.x1 - b.x0 + 1))
  const GUT = 16, CAP = 30, HDR = 34
  const rowH = Math.max(...boxes.map((b) => b.y1 - b.y0 + 1)) * ZOOM + CAP
  const sheet = createCanvas(tileW * ZOOM * 2 + GUT * 3, rowH * boxes.length + HDR + GUT)
  const sx = sheet.getContext("2d")
  sx.fillStyle = `rgb(${A.paper},${A.paper},${A.paper})`
  sx.fillRect(0, 0, sheet.width, sheet.height)
  sx.fillStyle = "#111"
  sx.font = "700 20px sans-serif"
  sx.fillText(`frame ${FRAME}   LEFT = ${A_DIR} (parked prior, per-vertex)      RIGHT = ${B_DIR} (shipped, whole triangles)      ${ZOOM}x`, GUT, 24)

  boxes.forEach((b, i) => {
    const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1
    const y = HDR + i * rowH
    sx.imageSmoothingEnabled = false
    sx.drawImage(A.canvas, b.x0, b.y0, bw, bh, GUT, y, bw * ZOOM, bh * ZOOM)
    sx.drawImage(B.canvas, b.x0, b.y0, bw, bh, GUT * 2 + tileW * ZOOM, y, bw * ZOOM, bh * ZOOM)
    sx.fillStyle = "#111"
    sx.font = "600 16px sans-serif"
    sx.fillText(`${b.c} px differ · box (${b.x0},${b.y0})-(${b.x1},${b.y1})`, GUT, y + bh * ZOOM + 20)
  })

  mkdirSync(dirname(OUTP), { recursive: true })
  writeFileSync(OUTP, sheet.toBuffer("image/png"))
  const chk = await read(OUTP)
  say(chk.transparent === 0, "the sheet this tool wrote is OPAQUE", `${chk.transparent} px`)
  console.log(`\n${OUTP}   ${sheet.width}x${sheet.height}`)
  process.exit(pass ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
