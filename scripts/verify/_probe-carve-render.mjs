// _PROBE-CARVE-RENDER — what the FIELD says the silhouette is, with no GPU.
//
// The envelope fix (`PEN_CARVE_ENVELOPE_R`) takes the carve at 0.001 from
// 61.7 % of the ink to 91.2 % and holds the component count at 7. At the shipped
// 0.700 the mark still comes apart, and at 1.000 — where the boundary IS the pen
// outline by definition — "Doodles" collapses to fragments.
//
// That is either the nib law or the shader, and they are separable without a
// browser: this rasterises `mix(envelope, pen, c) <= 0` straight off the real
// bake, at the same amplitudes the live sweep drives. If these sheets shred the
// same way the render does, the law is the subject and the shader is innocent.
//
// Usage: node scripts/verify/_probe-carve-render.mjs [--envelope=2.6] [--scale=0.62]
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"
import { loadTs } from "./_ts-load.mjs"
import { rawHeroStrokes, HERO_INK_WIDTH_PX, PROCESS_SETTINGS } from "./_hero-word.mjs"
const require = createRequire(import.meta.url)
const { createCanvas } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const ENVELOPE = parseFloat(arg("envelope", "2.6"))
/* Screen px per stroke unit on the real capture, measured off the sweep's own
 * carve-1.000 arm: the pen outline's semi-major axis is R by construction and
 * that mask's largest inscribed disc reads 9.00 px, against R = 11.29 stroke
 * units. So 9.00 / 11.29. Quoted rather than guessed so these sheets are at the
 * SAME scale as the frames they are being compared with. */
const SCALE = parseFloat(arg("scale", String(9.0 / 11.290141859013586)))
const OUT = join(ROOT, "docs", "verification", "drawin-holes", "field-render")

const { processStroke } = loadTs("lib/stroke-processing.ts")
const { buildPenField, penHalfWidth, PEN_NIB_DEFAULT, PEN_FIELD_TUBE_SLACK } =
  loadTs("lib/flat-ink.ts")

/* HIS STATE: wobble 0, endpoint CLEAN — not the page defaults. `processStroke`
 * only runs the kinematic pass when hand-feel is engaged (`wobble > 0 ||
 * endpoint !== "clean"`), so this arm is the one where it is OFF, exactly as on
 * the page in the screenshots. */
const HF = { wobble: 0, endpoint: "clean", inkWidth: HERO_INK_WIDTH_PX }
const strokes = rawHeroStrokes().map((s) =>
  processStroke(
    s,
    PROCESS_SETTINGS.spacing,
    PROCESS_SETTINGS.smoothing,
    PROCESS_SETTINGS.preserveCorners,
    45,
    HF,
  ),
)
const INK = HERO_INK_WIDTH_PX
const R = INK / 2
const field = buildPenField(strokes, INK)
console.log(`strokes ${strokes.length}  R ${R.toFixed(2)}  field ${field.width}x${field.height}`)

const sampleAt = (x, y) => {
  const u = (x - field.minX) / field.unitsPerTexel - 0.5
  const v = (y - field.minY) / field.unitsPerTexel - 0.5
  const x0 = Math.floor(u), y0 = Math.floor(v)
  const fx = u - x0, fy = v - y0
  const cl = (i, n) => (i < 0 ? 0 : i >= n ? n - 1 : i)
  let r = 0, g = 0
  for (let j = 0; j <= 1; j++)
    for (let i = 0; i <= 1; i++) {
      const w = (i ? fx : 1 - fx) * (j ? fy : 1 - fy)
      const p = (cl(y0 + j, field.height) * field.width + cl(x0 + i, field.width)) * 2
      r += field.data[p] * w
      g += field.data[p + 1] * w
    }
  return [r, g]
}

mkdirSync(OUT, { recursive: true })
const W = Math.round((field.maxX - field.minX) * SCALE)
const H = Math.round((field.maxY - field.minY) * SCALE)
const AMPS = [0, 0.001, 0.3, 0.5, 0.7, 0.85, 1.0]
const extraSlack = Math.max(0, (ENVELOPE - PEN_FIELD_TUBE_SLACK) * R)

/** 8-connected component count and ink area of a boolean raster. */
function stats(m, w, h) {
  const seen = new Uint8Array(m.length)
  const st = new Int32Array(m.length)
  let comps = 0, specks = 0, ink = 0
  for (let p = 0; p < m.length; p++) ink += m[p]
  for (let p = 0; p < m.length; p++) {
    if (!m[p] || seen[p]) continue
    let sp = 0
    st[sp++] = p
    seen[p] = 1
    let n = 0
    while (sp > 0) {
      const q = st[--sp]
      const qx = q % w, qy = (q / w) | 0
      n++
      for (let dy = -1; dy <= 1; dy++) {
        const ny = qy + dy
        if (ny < 0 || ny >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          const nx = qx + dx
          if (nx < 0 || nx >= w) continue
          const r2 = ny * w + nx
          if (m[r2] && !seen[r2]) { seen[r2] = 1; st[sp++] = r2 }
        }
      }
    }
    if (n >= 6) { comps++; if (n < 200) specks++ }
  }
  return { ink, comps, specks }
}

console.log(`\nenvelope ${ENVELOPE.toFixed(2)} R  (extra slack ${extraSlack.toFixed(2)} stroke units)\n`)
console.log("carve      ink   kept %   components   specks")
let base = null
for (const c of AMPS) {
  const m = new Uint8Array(W * H)
  const cv = createCanvas(W, H)
  const cx = cv.getContext("2d")
  cx.fillStyle = "#f8f8f7"
  cx.fillRect(0, 0, W, H)
  const img = cx.getImageData(0, 0, W, H)
  for (let py = 0; py < H; py++) {
    const sy = field.minY + (py + 0.5) / SCALE
    for (let px = 0; px < W; px++) {
      const sx = field.minX + (px + 0.5) / SCALE
      const [r, g] = sampleAt(sx, sy)
      const sd = c <= 0 ? -1 : (g - extraSlack) + (r - (g - extraSlack)) * c
      if (sd <= 0) {
        m[py * W + px] = 1
        const i = (py * W + px) * 4
        img.data[i] = 26
        img.data[i + 1] = 25
        img.data[i + 2] = 22
      }
    }
  }
  cx.putImageData(img, 0, 0)
  const s = stats(m, W, H)
  if (c === 0) base = s
  console.log(
    `${c.toFixed(3).padStart(5)}  ${String(s.ink).padStart(7)}  ${((s.ink / base.ink) * 100).toFixed(1).padStart(6)}  ${String(s.comps).padStart(10)}  ${String(s.specks).padStart(7)}`,
  )
  writeFileSync(join(OUT, `env${ENVELOPE.toFixed(2)}-carve-${String(c).replace(".", "p")}.png`), cv.toBuffer("image/png"))
}

/* THE LAW, PRINTED — because if the sheets shred, this is the reason and it
 * should not have to be inferred from them. */
let hmin = Infinity, hs = []
for (const s of strokes) {
  const pts = s.points
  if (pts.length < 2) continue
  const cum = [0]
  let L = 0
  for (let i = 1; i < pts.length; i++) {
    L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    cum.push(L)
  }
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]
    const th = Math.atan2(b.y - a.y, b.x - a.x)
    const h = penHalfWidth(th, Math.min(cum[i], L - cum[i]), R, PEN_NIB_DEFAULT)
    if (h < hmin) hmin = h
    hs.push(h)
  }
}
hs.sort((a, b) => a - b)
const qq = (p) => hs[Math.round(p * (hs.length - 1))]
console.log(
  `\npenHalfWidth over the word, stroke units:  min ${hmin.toFixed(2)}  p05 ${qq(0.05).toFixed(2)}  med ${qq(0.5).toFixed(2)}  max ${qq(1).toFixed(2)}   (R ${R.toFixed(2)})`,
)
console.log(`in SCREEN px at this scale:              min ${(hmin * SCALE).toFixed(2)}  p05 ${(qq(0.05) * SCALE).toFixed(2)}  med ${(qq(0.5) * SCALE).toFixed(2)}  max ${(qq(1) * SCALE).toFixed(2)}`)
console.log(`\nsheets: ${OUT}`)
