// Trace the Desk Doodles logo PNG into centerline polylines so the 3D
// inflate word matches the real logo shape (length + height) as closely as
// possible. Pipeline: alpha threshold -> Zhang-Suen thinning -> skeleton path
// tracing -> simplify. Output is written to scripts/capture/logo-strokes.json.
import { loadImage, createCanvas } from "@napi-rs/canvas"
import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const LOGO = join(ROOT, "public", "desk-doodles-logo.png")
const OUT = join(__dirname, "logo-strokes.json")

// Downscale factor for thinning (keeps it fast); coords scaled back after.
const MAX_W = 900

function buildBitmap(data, w, h) {
  // 1 = ink (dark/opaque), 0 = background
  const bmp = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3]
    const lum = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3
    bmp[i] = a > 40 && lum < 160 ? 1 : 0
  }
  return bmp
}

// Zhang-Suen thinning
function thin(bmp, w, h) {
  const idx = (x, y) => y * w + x
  let changed = true
  const px = (b, x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : b[idx(x, y)])
  while (changed) {
    changed = false
    for (let step = 0; step < 2; step++) {
      const toClear = []
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          if (!bmp[idx(x, y)]) continue
          const p2 = px(bmp, x, y - 1),
            p3 = px(bmp, x + 1, y - 1),
            p4 = px(bmp, x + 1, y),
            p5 = px(bmp, x + 1, y + 1),
            p6 = px(bmp, x, y + 1),
            p7 = px(bmp, x - 1, y + 1),
            p8 = px(bmp, x - 1, y),
            p9 = px(bmp, x - 1, y - 1)
          const neighbors = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9
          if (neighbors < 2 || neighbors > 6) continue
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2]
          let transitions = 0
          for (let k = 0; k < 8; k++) if (seq[k] === 0 && seq[k + 1] === 1) transitions++
          if (transitions !== 1) continue
          if (step === 0) {
            if (p2 * p4 * p6 !== 0) continue
            if (p4 * p6 * p8 !== 0) continue
          } else {
            if (p2 * p4 * p8 !== 0) continue
            if (p2 * p6 * p8 !== 0) continue
          }
          toClear.push(idx(x, y))
        }
      }
      if (toClear.length) {
        changed = true
        for (const i of toClear) bmp[i] = 0
      }
    }
  }
  return bmp
}

// Trace skeleton into polylines by walking from endpoints/junctions.
function tracePaths(bmp, w, h) {
  const idx = (x, y) => y * w + x
  const visited = new Uint8Array(w * h)
  const nbrs = (x, y) => {
    const out = []
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue
        const nx = x + dx,
          ny = y + dy
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && bmp[idx(nx, ny)]) out.push([nx, ny])
      }
    return out
  }
  const degree = (x, y) => nbrs(x, y).length
  const paths = []

  const walk = (sx, sy) => {
    const path = [[sx, sy]]
    visited[idx(sx, sy)] = 1
    let cx = sx,
      cy = sy
    while (true) {
      const options = nbrs(cx, cy).filter(([nx, ny]) => !visited[idx(nx, ny)])
      if (!options.length) break
      // prefer straight continuation: pick neighbor with lowest degree change
      options.sort((a, b) => degree(a[0], a[1]) - degree(b[0], b[1]))
      const [nx, ny] = options[0]
      visited[idx(nx, ny)] = 1
      path.push([nx, ny])
      cx = nx
      cy = ny
      if (degree(cx, cy) > 2) break // stop at junctions
    }
    return path
  }

  // start from endpoints (degree 1) first, then junctions, then leftovers
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (bmp[idx(x, y)] && !visited[idx(x, y)] && degree(x, y) === 1) {
        const p = walk(x, y)
        if (p.length > 2) paths.push(p)
      }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (bmp[idx(x, y)] && !visited[idx(x, y)]) {
        const p = walk(x, y)
        if (p.length > 2) paths.push(p)
      }
  return paths
}

// Ramer-Douglas-Peucker simplify
function simplify(points, eps) {
  if (points.length < 3) return points
  let maxD = 0,
    idx = 0
  const [ax, ay] = points[0]
  const [bx, by] = points[points.length - 1]
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i]
    const dx = bx - ax,
      dy = by - ay
    const len = Math.hypot(dx, dy) || 1
    const d = Math.abs((px - ax) * dy - (py - ay) * dx) / len
    if (d > maxD) {
      maxD = d
      idx = i
    }
  }
  if (maxD > eps) {
    const left = simplify(points.slice(0, idx + 1), eps)
    const right = simplify(points.slice(idx), eps)
    return left.slice(0, -1).concat(right)
  }
  return [points[0], points[points.length - 1]]
}

async function main() {
  const img = await loadImage(LOGO)
  const scale = Math.min(1, MAX_W / img.width)
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const c = createCanvas(w, h)
  const ctx = c.getContext("2d")
  ctx.drawImage(img, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h).data

  const bmp = buildBitmap(data, w, h)
  let ink = 0
  for (let i = 0; i < bmp.length; i++) ink += bmp[i]
  console.log(`[trace] downscaled ${w}x${h}, ink px=${ink}`)

  thin(bmp, w, h)
  let skel = 0
  for (let i = 0; i < bmp.length; i++) skel += bmp[i]
  console.log(`[trace] skeleton px=${skel}`)

  const paths = tracePaths(bmp, w, h)
  console.log(`[trace] raw paths=${paths.length}`)

  // simplify + scale back to original logo pixel coords + drop tiny specks
  const polylines = paths
    .map((p) => simplify(p, 1.2).map(([x, y]) => ({ x: x / scale, y: y / scale })))
    .filter((p) => p.length >= 2)

  // total path length filter (remove dust)
  const lenOf = (p) => {
    let L = 0
    for (let i = 1; i < p.length; i++) L += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y)
    return L
  }
  const kept = polylines.filter((p) => lenOf(p) > 18)
  console.log(`[trace] kept polylines=${kept.length} (dropped ${polylines.length - kept.length})`)

  writeFileSync(OUT, JSON.stringify({ width: img.width, height: img.height, polylines: kept }))
  console.log(`[trace] wrote ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
