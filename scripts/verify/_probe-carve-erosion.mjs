// _PROBE-CARVE-EROSION — WHERE the carve removes ink, in half-widths.
//
// "38 % of the ink is gone" does not say whether the outline was eroded evenly
// (the mesh is simply fatter than the field's envelope) or whether holes were
// punched through the middle (the field is mis-registered). Those are different
// bugs. The distance transform separates them in one pass:
//
//   for every ink pixel of the CONTROL, its distance to the nearest paper pixel
//   — i.e. its depth inside the mark, which peaks at the mark's own half-width.
//
// Uniform erosion puts every removed pixel at SHALLOW depth. A hole puts them at
// DEEP depth. The control's max depth is the mesh's half-width in screen px,
// which is also the number the field's envelope has to clear.
//
// Usage: node scripts/verify/_probe-carve-erosion.mjs --label=sweep-fs --a=tubeonly --b=carve0
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
const LABEL = arg("label", "sweep-fs")
const A = arg("a", "tubeonly")
const B = arg("b", "carve0")
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
  return m
}

/** Exact Euclidean distance transform (Felzenszwalb-Huttenlocher, separable). */
function edt(mask, w, h) {
  const INF = 1e12
  const f = new Float64Array(Math.max(w, h))
  const d = new Float64Array(Math.max(w, h))
  const v = new Int32Array(Math.max(w, h))
  const z = new Float64Array(Math.max(w, h) + 1)
  const g = new Float64Array(w * h)
  for (let i = 0; i < w * h; i++) g[i] = mask[i] ? INF : 0
  const pass = (n, get, set) => {
    for (let i = 0; i < n; i++) f[i] = get(i)
    let k = 0
    v[0] = 0
    z[0] = -INF
    z[1] = INF
    for (let q = 1; q < n; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
      while (s <= z[k]) {
        k--
        s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
      }
      k++
      v[k] = q
      z[k] = s
      z[k + 1] = INF
    }
    k = 0
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++
      d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]
    }
    for (let i = 0; i < n; i++) set(i, d[i])
  }
  for (let x = 0; x < w; x++) pass(h, (y) => g[y * w + x], (y, val) => { g[y * w + x] = val })
  for (let y = 0; y < h; y++) pass(w, (x) => g[y * w + x], (x, val) => { g[y * w + x] = val })
  const out = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) out[i] = Math.sqrt(g[i])
  return out
}

const q = (arr, p) => {
  if (!arr.length) return 0
  const a = Float64Array.from(arr).sort()
  return a[Math.min(a.length - 1, Math.max(0, Math.round(p * (a.length - 1))))]
}

async function main() {
  const ia = await loadImage(join(DIR, `${A}.png`))
  const ib = await loadImage(join(DIR, `${B}.png`))
  const ma = maskOf(ia)
  const mb = maskOf(ib)
  const w = ib.width
  const h = ib.height
  const depth = edt(mb, w, h) // depth inside the CONTROL mark

  const removedD = []
  const keptD = []
  const allD = []
  for (let p = 0; p < mb.length; p++) {
    if (!mb[p]) continue
    allD.push(depth[p])
    if (ma[p]) keptD.push(depth[p])
    else removedD.push(depth[p])
  }
  const f = (a) =>
    `n ${String(a.length).padStart(6)}   p05 ${q(a, 0.05).toFixed(2)}  med ${q(a, 0.5).toFixed(2)}  p95 ${q(a, 0.95).toFixed(2)}  max ${q(a, 1).toFixed(2)}`
  console.log(`\ndepth inside the mark (screen px), control = ${B}\n`)
  console.log(`ALL control ink   ${f(allD)}`)
  console.log(`KEPT by ${A.padEnd(9)} ${f(keptD)}`)
  console.log(`REMOVED           ${f(removedD)}`)
  console.log(
    `\nthe control mark's MAX half-width is ${q(allD, 1).toFixed(2)} screen px; its median depth is ${q(allD, 0.5).toFixed(2)}`,
  )
  const deep = removedD.filter((d) => d > q(allD, 0.5)).length
  console.log(
    `removed pixels DEEPER than the control's median depth: ${deep} / ${removedD.length} = ${((deep / Math.max(1, removedD.length)) * 100).toFixed(1)} %`,
  )
  console.log(
    `  (uniform erosion of the OUTLINE would put this near 0 %; punching holes through the middle puts it high)`,
  )
}

main().catch((e) => { console.error(e); process.exit(1) })
