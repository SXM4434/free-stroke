// _PROBE-DRAWIN-HOLES-READ — the EYE half. Crops at 5-10x, side by side.
//
// The boxes are FOUND, not chosen: the ink that `shipped` is missing relative to
// the control arm is labelled into connected components, and the largest ones
// become the crop boxes. So the sheet cannot be accused of framing the one place
// that happens to look bad.
//
// Usage: node scripts/verify/_probe-drawin-holes-read.mjs --label=repro
//        [--a=shipped] [--b=carve0] [--zoom=8] [--boxes=4]
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "repro")
const A = arg("a", "shipped")
const B = arg("b", "carve0")
const ZOOM = parseInt(arg("zoom", "8"), 10)
const NBOX = parseInt(arg("boxes", "4"), 10)
const DIR = join(ROOT, "docs", "verification", "drawin-holes", LABEL)

function maskOf(img) {
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const hist = new Uint32Array(256)
  const luma = new Uint8Array(img.width * img.height)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) | 0
    luma[p] = l
    hist[l]++
  }
  let paper = 0
  for (let l = 1; l < 256; l++) if (hist[l] > hist[paper]) paper = l
  const cut = Math.max(8, paper - 45)
  const m = new Uint8Array(luma.length)
  for (let p = 0; p < luma.length; p++) m[p] = luma[p] < cut ? 1 : 0
  return { m, w: img.width, h: img.height, paper, cut }
}

/** Connected components of a mask, 8-connected, returned biggest first. */
function components(m, w, h, minPx) {
  const seen = new Uint8Array(m.length)
  const out = []
  const stack = new Int32Array(m.length)
  for (let p = 0; p < m.length; p++) {
    if (!m[p] || seen[p]) continue
    let sp = 0
    stack[sp++] = p
    seen[p] = 1
    let n = 0
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
    while (sp > 0) {
      const q = stack[--sp]
      const qx = q % w
      const qy = (q / w) | 0
      n++
      if (qx < x0) x0 = qx
      if (qx > x1) x1 = qx
      if (qy < y0) y0 = qy
      if (qy > y1) y1 = qy
      for (let dy = -1; dy <= 1; dy++) {
        const ny = qy + dy
        if (ny < 0 || ny >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          const nx = qx + dx
          if (nx < 0 || nx >= w) continue
          const r = ny * w + nx
          if (m[r] && !seen[r]) { seen[r] = 1; stack[sp++] = r }
        }
      }
    }
    if (n >= minPx) out.push({ n, x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 })
  }
  out.sort((a, b) => b.n - a.n)
  return out
}

async function main() {
  const pa = join(DIR, `${A}.png`)
  const pb = join(DIR, `${B}.png`)
  for (const p of [pa, pb]) if (!existsSync(p)) { console.error(`missing ${p}`); process.exit(1) }
  const ia = await loadImage(pa)
  const ib = await loadImage(pb)
  const ma = maskOf(ia)
  const mb = maskOf(ib)
  if (ma.w !== mb.w || ma.h !== mb.h) { console.error("size mismatch"); process.exit(1) }

  let inkA = 0, inkB = 0, removed = 0, added = 0
  const rem = new Uint8Array(ma.m.length)
  for (let p = 0; p < ma.m.length; p++) {
    inkA += ma.m[p]
    inkB += mb.m[p]
    if (mb.m[p] && !ma.m[p]) { removed++; rem[p] = 1 }
    if (ma.m[p] && !mb.m[p]) added++
  }
  console.log(`ink  ${B} (control) ${inkB} px   ${A} ${inkA} px`)
  console.log(`${B} has ${removed} px that ${A} does not (${((removed / inkB) * 100).toFixed(1)} % of the control's ink)`)
  console.log(`${A} has ${added} px that ${B} does not (${((added / Math.max(1, inkB)) * 100).toFixed(2)} %)`)

  /* CONNECTED COMPONENTS OF THE MARK ITSELF — the number that says "it came
   * apart" rather than "it got thinner". A pen writes ONE continuous run per
   * stroke; a shredded mark is many. */
  const compA = components(ma.m, ma.w, ma.h, 6)
  const compB = components(mb.m, mb.w, mb.h, 6)
  console.log(`components >=6 px:  ${B} ${compB.length}   ${A} ${compA.length}`)
  const specksA = compA.filter((c) => c.n < 200).length
  const specksB = compB.filter((c) => c.n < 200).length
  console.log(`components < 200 px (loose specks):  ${B} ${specksB}   ${A} ${specksA}`)

  const boxes = components(rem, ma.w, ma.h, 40).slice(0, NBOX)
  console.log(`largest removed regions: ${boxes.map((b) => b.n).join(", ")}`)

  /* ---- THE SHEET ------------------------------------------------------- */
  const PAD = 14
  const CW = 150
  const CH = 110
  const cellW = CW * ZOOM
  const cellH = CH * ZOOM
  const HEAD = 46
  const ROWH = 26
  const sheetW = PAD * 2 + cellW * 2 + PAD
  const sheetH = HEAD + boxes.length * (cellH + ROWH + PAD)
  const cv = createCanvas(sheetW, sheetH)
  const cx = cv.getContext("2d")
  cx.fillStyle = "#101014"
  cx.fillRect(0, 0, sheetW, sheetH)
  cx.imageSmoothingEnabled = false
  cx.font = "600 20px sans-serif"
  cx.fillStyle = "#e8e8f0"
  cx.fillText(`${LABEL} — DRAW 80 % — ${ZOOM}x — left: ${B} (control)   right: ${A}`, PAD, 30)

  boxes.forEach((b, i) => {
    const sx = Math.max(0, Math.min(ma.w - CW, Math.round(b.cx - CW / 2)))
    const sy = Math.max(0, Math.min(ma.h - CH, Math.round(b.cy - CH / 2)))
    const y = HEAD + i * (cellH + ROWH + PAD)
    cx.fillStyle = "#9aa0b4"
    cx.font = "500 16px sans-serif"
    cx.fillText(`box ${i + 1} @ (${sx},${sy}) ${CW}x${CH} — ${b.n} px removed`, PAD, y + 18)
    cx.drawImage(ib, sx, sy, CW, CH, PAD, y + ROWH, cellW, cellH)
    cx.drawImage(ia, sx, sy, CW, CH, PAD + cellW + PAD, y + ROWH, cellW, cellH)
    cx.strokeStyle = "#3a3a46"
    cx.lineWidth = 2
    cx.strokeRect(PAD, y + ROWH, cellW, cellH)
    cx.strokeRect(PAD + cellW + PAD, y + ROWH, cellW, cellH)
  })

  /* THE SHEET MUST BE OPAQUE — a sibling lane lost a day to an RGBA sheet that
   * composited onto white and looked correct. */
  {
    const { data } = cx.getImageData(0, 0, cv.width, cv.height)
    let clear = 0
    for (let i = 3; i < data.length; i += 4) if (data[i] < 255) clear++
    console.log(`  ${clear === 0 ? "PASS" : "FAIL"}  the sheet is OPAQUE — ${clear} px below alpha 255`)
    if (clear !== 0) process.exit(1)
  }

  const out = join(DIR, `SHEET-${A}-vs-${B}-${ZOOM}x.png`)
  writeFileSync(out, cv.toBuffer("image/png"))
  console.log(`\nsheet: ${out}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
