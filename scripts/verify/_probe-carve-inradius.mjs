// _PROBE-CARVE-INRADIUS — how many nib radii wide the MESH actually is.
//
// `PEN_FIELD_TUBE_SLACK = 1.35` claims to be an envelope of the rendered form:
// *"a field baked at exactly R would bite into the form the moment it was
// switched on at zero strength"*, 1.35 chosen to clear that. Measured on the
// page, the carve at 0.001 — the tube channel with none of the pen in it —
// removes 38.3 % of the ink. So the claim is false and the question is by how
// much.
//
// It is answerable from the sweep frames alone, with no scene access, because
// two of the arms have KNOWN boundaries:
//
//   carve 1.000  the boundary is the PEN outline, whose semi-major axis is
//                pinned to R by construction (`penHalfWidth`: "a = R"), so the
//                largest disc that fits inside that mask is exactly R px.
//   carve 0.000  no test runs at all, so the mask is the MESH's own silhouette
//                and the largest disc inside it is the mesh's max half-width.
//   carve 0.001  the boundary is `bestD = 1.35 R`, so its inradius reads 1.35 R
//                wherever the mesh is fat enough to contain that disc — which
//                is the calibration that proves the other two are being read in
//                the same units.
//
// The ratio of the first two IS the slack the envelope needs.
//
// Usage: node scripts/verify/_probe-carve-inradius.mjs [--label=sweep-fs]
import { readdirSync } from "node:fs"
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
  return { m, w: img.width, h: img.height }
}

/** Exact Euclidean distance transform, separable (Felzenszwalb-Huttenlocher). */
function edt(mask, w, h) {
  const INF = 1e12
  const n = Math.max(w, h)
  const f = new Float64Array(n)
  const d = new Float64Array(n)
  const v = new Int32Array(n)
  const z = new Float64Array(n + 1)
  const g = new Float64Array(w * h)
  for (let i = 0; i < w * h; i++) g[i] = mask[i] ? INF : 0
  const pass = (len, get, set) => {
    for (let i = 0; i < len; i++) f[i] = get(i)
    let k = 0
    v[0] = 0
    z[0] = -INF
    z[1] = INF
    for (let q2 = 1; q2 < len; q2++) {
      let s = (f[q2] + q2 * q2 - (f[v[k]] + v[k] * v[k])) / (2 * q2 - 2 * v[k])
      while (s <= z[k]) {
        k--
        s = (f[q2] + q2 * q2 - (f[v[k]] + v[k] * v[k])) / (2 * q2 - 2 * v[k])
      }
      k++
      v[k] = q2
      z[k] = s
      z[k + 1] = INF
    }
    k = 0
    for (let q2 = 0; q2 < len; q2++) {
      while (z[k + 1] < q2) k++
      d[q2] = (q2 - v[k]) * (q2 - v[k]) + f[v[k]]
    }
    for (let i = 0; i < len; i++) set(i, d[i])
  }
  for (let x = 0; x < w; x++) pass(h, (y) => g[y * w + x], (y, val) => { g[y * w + x] = val })
  for (let y = 0; y < h; y++) pass(w, (x) => g[y * w + x], (x, val) => { g[y * w + x] = val })
  const out = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) out[i] = Math.sqrt(g[i])
  return out
}

async function inradius(file) {
  const img = await loadImage(join(DIR, file))
  const { m, w, h } = maskOf(img)
  const d = edt(m, w, h)
  const vals = []
  for (let i = 0; i < m.length; i++) if (m[i]) vals.push(d[i])
  vals.sort((a, b) => a - b)
  const q = (p) => vals[Math.min(vals.length - 1, Math.round(p * (vals.length - 1)))]
  return { max: q(1), p999: q(0.999), p99: q(0.99), p95: q(0.95), med: q(0.5), ink: vals.length }
}

async function main() {
  const files = readdirSync(DIR)
    .filter((f) => /^carve-[0-9p.]+\.png$/.test(f))
    .sort((a, b) => parseFloat(a.slice(6).replace("p", ".")) - parseFloat(b.slice(6).replace("p", ".")))
  const out = []
  for (const f of files) {
    const r = await inradius(f)
    out.push({ f, carve: parseFloat(f.slice(6).replace(".png", "").replace("p", ".")), ...r })
  }
  console.log(`\n${LABEL} — largest disc that fits inside the mask, screen px\n`)
  console.log("carve     max   p99.9    p99    p95    med       ink")
  for (const r of out)
    console.log(
      `${r.carve.toFixed(3).padStart(5)}  ${r.max.toFixed(2).padStart(6)}  ${r.p999.toFixed(2).padStart(6)}  ${r.p99.toFixed(2).padStart(5)}  ${r.p95.toFixed(2).padStart(5)}  ${r.med.toFixed(2).padStart(5)}  ${String(r.ink).padStart(8)}`,
    )
  const mesh = out.find((r) => r.carve === 0)
  const pen = out.find((r) => r.carve === 1)
  const tube = out.find((r) => r.carve === 0.001)
  if (mesh && pen) {
    console.log(`\nR (the nib semi-major, from the carve 1.000 arm)   ${pen.max.toFixed(2)} px`)
    console.log(`the MESH's max half-width (carve 0.000 arm)        ${mesh.max.toFixed(2)} px`)
    if (tube) {
      console.log(
        `the 1.35 R envelope, as rendered (carve 0.001 arm) ${tube.max.toFixed(2)} px  — predicted ${(pen.max * 1.35).toFixed(2)} px, ratio ${(tube.max / pen.max).toFixed(2)} R`,
      )
    }
    console.log(
      `\nSLACK THE ENVELOPE ACTUALLY NEEDS: ${(mesh.max / pen.max).toFixed(2)} R   (shipped constant: 1.35 R)`,
    )
    console.log(
      `                       at p99.9:   ${(mesh.p999 / pen.max).toFixed(2)} R`,
    )
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
