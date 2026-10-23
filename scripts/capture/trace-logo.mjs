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

  // Walk THROUGH junctions by picking the straightest continuation (highest
  // dot product with the recent heading). Stopping at junctions is what
  // shredded the word into dozens of fragments before — a pen stroke crosses
  // junctions (loops, crossbars) without lifting.
  const walk = (sx, sy) => {
    const path = [[sx, sy]]
    visited[idx(sx, sy)] = 1
    let cx = sx,
      cy = sy
    while (true) {
      const options = nbrs(cx, cy).filter(([nx, ny]) => !visited[idx(nx, ny)])
      if (!options.length) break
      // heading = direction over the last few skeleton pixels (smooths staircase)
      const back = path[Math.max(0, path.length - 5)]
      let hx = cx - back[0],
        hy = cy - back[1]
      const hl = Math.hypot(hx, hy)
      let best = options[0]
      if (hl > 0) {
        hx /= hl
        hy /= hl
        let bestDot = -Infinity
        for (const [nx, ny] of options) {
          const dx = nx - cx,
            dy = ny - cy
          const dl = Math.hypot(dx, dy)
          const dot = (dx * hx + dy * hy) / dl
          if (dot > bestDot) {
            bestDot = dot
            best = [nx, ny]
          }
        }
      }
      const [nx, ny] = best
      visited[idx(nx, ny)] = 1
      path.push([nx, ny])
      cx = nx
      cy = ny
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

// Greedy endpoint-joining of skeleton fragments. Two fragments merge when a
// pair of their endpoints is within maxGap px AND the jump direction roughly
// continues the tail heading of the fragment being extended (or the gap is
// tiny). Repeats until no more merges apply.
function mergePaths(paths, maxGap) {
  const pts = paths.map((p) => p.slice())

  const tailDir = (p) => {
    const a = p[Math.max(0, p.length - 6)]
    const b = p[p.length - 1]
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]
  }
  const rev = (p) => p.slice().reverse()

  let merged = true
  while (merged) {
    merged = false
    outer: for (let i = 0; i < pts.length; i++) {
      for (let j = 0; j < pts.length; j++) {
        if (i === j) continue
        const a = pts[i]
        // candidate orientations of b: as-is (head joins a's tail) or reversed
        for (const b of [pts[j], rev(pts[j])]) {
          const ae = a[a.length - 1]
          const bs = b[0]
          const gap = Math.hypot(bs[0] - ae[0], bs[1] - ae[1])
          if (gap > maxGap) continue
          const [tx, ty] = tailDir(a)
          const gx = gap > 0 ? (bs[0] - ae[0]) / gap : tx
          const gy = gap > 0 ? (bs[1] - ae[1]) / gap : ty
          const cont = tx * gx + ty * gy
          if (gap > 2 && cont < 0.2) continue // must continue, not double back
          pts[i] = a.concat(gap > 0 ? b : b.slice(1))
          pts.splice(j, 1)
          merged = true
          break outer
        }
      }
    }
  }
  return pts
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

  const paths0 = tracePaths(bmp, w, h)
  console.log(`[trace] raw paths=${paths0.length}`)

  // Merge fragments whose endpoints nearly touch (thinning dropouts + walks
  // that consumed a junction pixel another branch needed). The gap vector must
  // roughly continue the fragment's tail direction so we never bridge between
  // neighbouring letters.
  const paths = mergePaths(paths0, 6)
  console.log(`[trace] merged paths=${paths.length}`)

  // Normalize into a compact target coordinate space (~TARGET_W wide). The
  // inflate rasterizer uses a fixed ~22px lineWidth, so a smaller span makes
  // each tube proportionally bolder and lets neighbouring skeleton fragments
  // merge into continuous strokes (matching the logo's solid weight).
  const TARGET_W = 1100
  const norm = TARGET_W / (w / scale) // strokes are in downscaled space here
  const polylines0 = paths
    .map((p) => simplify(p, 1.2).map(([x, y]) => ({ x: (x / scale) * norm, y: (y / scale) * norm })))
    .filter((p) => p.length >= 2)

  const lenOf = (p) => {
    let L = 0
    for (let i = 1; i < p.length; i++) L += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y)
    return L
  }

  // Densify: resample each polyline at ~3px steps so the tube surface stays
  // smooth and the draw-in reveal advances evenly along the path.
  const STEP = 3
  const densify = (p) => {
    if (p.length < 2) return p
    const out = [p[0]]
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1],
        b = p[i]
      const d = Math.hypot(b.x - a.x, b.y - a.y)
      const n = Math.max(1, Math.round(d / STEP))
      for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n })
    }
    return out
  }

  const kept = polylines0.filter((p) => lenOf(p) > 18 * norm).map(densify)
  console.log(`[trace] kept polylines=${kept.length} (dropped ${polylines0.length - kept.length}), target width=${TARGET_W}`)

  // Draw-in order: left to right, like writing the word.
  const minX = (p) => p.reduce((m, q) => Math.min(m, q.x), Infinity)
  kept.sort((a, b) => minX(a) - minX(b))

  writeFileSync(OUT, JSON.stringify({ width: TARGET_W, height: Math.round((h / scale) * norm), polylines: kept }))
  console.log(`[trace] wrote ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
