/**
 * THE DRAW-IN AS A GLB ANIMATION: morph targets and their weights, from the
 * same frame plan the films use.
 *
 * Coverage row 92 (R#57, PLAN Export v5): "Animated GLB", MISSING until this
 * file (zero `AnimationClip` hits). The static GLB carries the finished
 * geometry; this carries how it arrived.
 *
 * ── WHAT A GLB CAN ANIMATE, AND WHICH ONE THIS USES ───────────────────────
 * glTF 2.0 animates node translation, rotation and scale, and a mesh's MORPH
 * TARGET WEIGHTS. It has no visibility channel (KHR_animation_pointer is not
 * written by three's GLTFExporter), and a scale step can only show a whole
 * stroke at once. A pen reveal happens INSIDE a stroke, so it is written as
 * morph targets:
 *
 *   The base pose is the FINISHED MARK, exactly the static export. A viewer
 *   that ignores animation shows what the GLB button saves.
 *
 *   A hidden vertex is moved onto its own point on the stroke's centreline
 *   (its nearest point, in the plane of the drawing). A triangle whose three
 *   corners are hidden then lies on the centreline and has no area, so it
 *   draws nothing. A triangle at the reveal front keeps its visible edge and
 *   narrows to the centreline, which reads as the tip of the line.
 *
 *   Each morph target is one reveal STATE: "these vertices hidden". The
 *   weights run on every frame of the plan, so the animation's keyframes ARE
 *   the film's frames, at the film's timestamps. A frame whose state is stored
 *   is exact; a frame between two stored states blends them, over the sequence
 *   of changes rather than over time, so a pause holds still. The first and
 *   last states are always stored.
 *
 *   States are chosen PER MESH, from the frames where that mesh's visible set
 *   changes, so a stroke's targets are spent inside its own part of the take
 *   (Rod exports one mesh per stroke; Inflate's fused mesh gets its states over
 *   the whole take). A byte budget caps the total.
 *
 * ── WHERE A VERTEX IS ON THE PEN'S PATH ──────────────────────────────────
 * Every engine maps the canvas to world units the same way (`strokeTo3D`:
 * long side = 3 units, y up) and then recentres the export on its bounding
 * box, whose centre this module is not told. So the offset is RECOVERED: it
 * starts from the two bounding boxes' centres and is refined by fitting
 * vertices to their nearest centreline (a translation-only ICP). A mesh named
 * `stroke_###` (Rod, and each part of it) is matched only to that stroke.
 *
 * The reveal itself is not re-derived here. The caller hands, per planned
 * frame, the visible arc spans of every stroke, from the app's own reveal
 * (`strokeSpansIn` over the window's parts, or `takeSpansIn` under a take),
 * exactly the spans Solid and Extrude cut their live geometry at.
 *
 * Pure: no three, no DOM, no app module. `./drawin-glb-three` is the adapter
 * that reads a three group and writes the GLB.
 */

export interface DrawinPoint {
  x: number
  y: number
}

export interface DrawinMeshInput {
  name: string
  /** xyz per vertex, in the export's own (recentred) space. */
  positions: Float32Array
  /** The stroke this mesh was built from, or -1 for a mesh fused from several. */
  strokeIndex: number
  /**
   * The positions are a triangle soup (every three vertices one triangle, no
   * sharing), so each triangle can be hidden WHOLE. The adapter un-indexes a
   * fused mesh for this; see "WHERE A HIDDEN VERTEX GOES" below.
   */
  triangles?: boolean
}

export interface DrawinFrame {
  /** Presentation time of the planned frame, ms. */
  timeMs: number
  /**
   * The visible parts of each stroke at this frame: one Float64Array per window
   * part, laid out `[f0, f1]` per stroke in the stroke's own 0..1 arc. A stroke
   * is visible where ANY part has `f0 <= u <= f1` with `f1 > f0`.
   */
  spans: Float64Array[]
}

export interface DrawinInput {
  meshes: DrawinMeshInput[]
  /** The strokes, in canvas px, in the order the spans index them. */
  strokes: DrawinPoint[][]
  canvasWidth: number
  canvasHeight: number
  frames: DrawinFrame[]
  /** Most morph targets one mesh may carry. */
  maxTargetsPerMesh?: number
  /** Most bytes all morph targets together may take. */
  maxMorphBytes?: number
}

export interface DrawinMeshOutput {
  name: string
  /** Relative position deltas, one Float32Array (xyz per vertex) per target. */
  targets: Float32Array[]
  /** `frames * targets.length` weights, frame-major. */
  weights: Float32Array
  /** Frame indices each target was taken from. */
  stateFrames: number[]
  /** Per vertex: the stroke it was matched to. */
  vertexStroke: Int32Array
  /** Per vertex: its arc fraction on that stroke. */
  vertexU: Float64Array
}

export interface DrawinResult {
  /** Keyframe times, seconds: one per planned frame. */
  times: Float32Array
  meshes: DrawinMeshOutput[]
  /** Export-space offset the canvas centreline was fitted with. */
  offset: { x: number; y: number }
  /** Mean distance, export units, from a vertex to its matched centreline. */
  fitMeanDistance: number
  morphBytes: number
}

export const DRAWIN_MAX_TARGETS = 24
export const DRAWIN_MAX_MORPH_BYTES = 48 * 1024 * 1024

/** The keyframe times: every planned frame, in seconds. */
export function drawinTimes(frames: readonly DrawinFrame[]): Float32Array {
  return Float32Array.from(frames, (f) => f.timeMs / 1000)
}

interface Centreline {
  /** Export-space xy, before the offset. */
  xs: Float64Array
  ys: Float64Array
  /** Arc fraction at each point, canvas px arc as the reveal measures it. */
  u: Float64Array
}

function centrelines(strokes: DrawinPoint[][], w: number, h: number): Centreline[] {
  const k = 3 / Math.max(w, h)
  return strokes.map((pts) => {
    const n = pts.length
    const xs = new Float64Array(n)
    const ys = new Float64Array(n)
    const u = new Float64Array(n)
    let total = 0
    for (let i = 0; i < n; i++) {
      xs[i] = (pts[i].x - w / 2) * k
      ys[i] = -(pts[i].y - h / 2) * k
      if (i > 0) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
      u[i] = total
    }
    if (total > 0) for (let i = 0; i < n; i++) u[i] /= total
    return { xs, ys, u }
  })
}

/** Nearest point on one polyline: squared distance, arc fraction, point. */
function nearestOn(c: Centreline, ox: number, oy: number, px: number, py: number) {
  const n = c.xs.length
  let best = Infinity
  let bu = 0
  let bx = 0
  let by = 0
  if (n === 1) {
    const dx = px - (c.xs[0] + ox)
    const dy = py - (c.ys[0] + oy)
    return { d2: dx * dx + dy * dy, u: 0, x: c.xs[0] + ox, y: c.ys[0] + oy }
  }
  for (let i = 1; i < n; i++) {
    const ax = c.xs[i - 1] + ox
    const ay = c.ys[i - 1] + oy
    const vx = c.xs[i] + ox - ax
    const vy = c.ys[i] + oy - ay
    const len2 = vx * vx + vy * vy
    let t = len2 > 0 ? ((px - ax) * vx + (py - ay) * vy) / len2 : 0
    if (t < 0) t = 0
    else if (t > 1) t = 1
    const qx = ax + t * vx
    const qy = ay + t * vy
    const d2 = (px - qx) * (px - qx) + (py - qy) * (py - qy)
    if (d2 < best) {
      best = d2
      bu = c.u[i - 1] + t * (c.u[i] - c.u[i - 1])
      bx = qx
      by = qy
    }
  }
  return { d2: best, u: bu, x: bx, y: by }
}

/**
 * A uniform grid of centreline segments, for the fused-mesh case where every
 * vertex could belong to any stroke.
 */
class SegmentGrid {
  private cells = new Map<number, number[]>()
  private segStroke: number[] = []
  private segIndex: number[] = []
  readonly size: number
  private minX: number
  private minY: number
  constructor(private readonly lines: Centreline[], ox: number, oy: number) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    let segs = 0
    for (const c of lines) {
      for (let i = 0; i < c.xs.length; i++) {
        x0 = Math.min(x0, c.xs[i] + ox)
        x1 = Math.max(x1, c.xs[i] + ox)
        y0 = Math.min(y0, c.ys[i] + oy)
        y1 = Math.max(y1, c.ys[i] + oy)
      }
      segs += Math.max(1, c.xs.length - 1)
    }
    const span = Math.max(x1 - x0, y1 - y0, 1e-6)
    /* A floor on the cell, or a one-tap drawing (every point in one place)
     * makes cells 1e-7 wide and `nearest` walks thousands of empty rings. */
    this.size = Math.max(1e-3, span / Math.max(8, Math.min(256, Math.round(Math.sqrt(segs) * 2))))
    this.minX = x0
    this.minY = y0
    lines.forEach((c, s) => {
      const n = c.xs.length
      for (let i = n === 1 ? 0 : 1; i < n; i++) {
        const a = Math.max(0, i - 1)
        const cx0 = this.cellOf(Math.min(c.xs[a], c.xs[i]) + ox, true)
        const cx1 = this.cellOf(Math.max(c.xs[a], c.xs[i]) + ox, true)
        const cy0 = this.cellOf(Math.min(c.ys[a], c.ys[i]) + oy, false)
        const cy1 = this.cellOf(Math.max(c.ys[a], c.ys[i]) + oy, false)
        const id = this.segStroke.length
        this.segStroke.push(s)
        this.segIndex.push(i)
        for (let gx = cx0; gx <= cx1; gx++) {
          for (let gy = cy0; gy <= cy1; gy++) {
            const key = gx * 100003 + gy
            let list = this.cells.get(key)
            if (!list) this.cells.set(key, (list = []))
            list.push(id)
          }
        }
      }
    })
  }
  private cellOf(v: number, isX: boolean) {
    return Math.floor((v - (isX ? this.minX : this.minY)) / this.size)
  }
  /** Per stroke, the nearest point within `radius`: stroke, distance, arc fraction. */
  within(px: number, py: number, ox: number, oy: number, radius: number) {
    const gx = this.cellOf(px, true)
    const gy = this.cellOf(py, false)
    const reach = Math.ceil(radius / this.size) + 1
    const best = new Map<number, { d: number; u: number }>()
    for (let dx = -reach; dx <= reach; dx++) {
      for (let dy = -reach; dy <= reach; dy++) {
        const list = this.cells.get((gx + dx) * 100003 + (gy + dy))
        if (!list) continue
        for (const id of list) {
          const s = this.segStroke[id]
          const i = this.segIndex[id]
          const c = this.lines[s]
          const a = Math.max(0, i - 1)
          const sub: Centreline = { xs: c.xs.subarray(a, i + 1), ys: c.ys.subarray(a, i + 1), u: c.u.subarray(a, i + 1) }
          const hit = nearestOn(sub, ox, oy, px, py)
          const d = Math.sqrt(hit.d2)
          if (d <= radius && (!best.has(s) || d < best.get(s)!.d)) best.set(s, { d, u: hit.u })
        }
      }
    }
    return best
  }

  /** Nearest segment over all strokes: stroke index, arc fraction, point. */
  nearest(px: number, py: number, ox: number, oy: number) {
    const gx = this.cellOf(px, true)
    const gy = this.cellOf(py, false)
    let best = { d2: Infinity, u: 0, x: px, y: py, s: -1 }
    for (let r = 0; r < 4096; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
          const list = this.cells.get((gx + dx) * 100003 + (gy + dy))
          if (!list) continue
          for (const id of list) {
            const s = this.segStroke[id]
            const i = this.segIndex[id]
            const c = this.lines[s]
            const a = Math.max(0, i - 1)
            const sub: Centreline = { xs: c.xs.subarray(a, i + 1), ys: c.ys.subarray(a, i + 1), u: c.u.subarray(a, i + 1) }
            const hit = nearestOn(sub, ox, oy, px, py)
            if (hit.d2 < best.d2) best = { ...hit, s }
          }
        }
      }
      /* Every point outside the rings searched is at least r cells away. */
      if (best.s >= 0 && Math.sqrt(best.d2) <= r * this.size) break
      if (r > 0 && this.cells.size > 0 && r * this.size > 1e3) break
    }
    return best
  }
}

/** The centreline point at arc fraction `u`, offset applied. */
function pointAt(c: Centreline, u: number, ox: number, oy: number): [number, number] {
  const n = c.xs.length
  if (n === 1 || u <= 0) return [c.xs[0] + ox, c.ys[0] + oy]
  if (u >= 1) return [c.xs[n - 1] + ox, c.ys[n - 1] + oy]
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (c.u[mid] <= u) lo = mid
    else hi = mid
  }
  const span = c.u[hi] - c.u[lo]
  const t = span > 0 ? (u - c.u[lo]) / span : 0
  return [c.xs[lo] + t * (c.xs[hi] - c.xs[lo]) + ox, c.ys[lo] + t * (c.ys[hi] - c.ys[lo]) + oy]
}

/** The visible edge of stroke `s` nearest to `u`, or null when none shows. */
function nearestEdge(spans: Float64Array[], s: number, u: number): number | null {
  let best: number | null = null
  for (const part of spans) {
    const f0 = s * 2 < part.length ? part[s * 2] : 0
    const f1 = s * 2 + 1 < part.length ? part[s * 2 + 1] : 1
    if (!(f1 > f0)) continue
    for (const e of [f0, f1]) if (best === null || Math.abs(e - u) < Math.abs(best - u)) best = e
  }
  return best
}

/** Visible when any part holds `u`. */
function visibleAt(spans: Float64Array[], s: number, u: number): boolean {
  for (const part of spans) {
    const f0 = s * 2 < part.length ? part[s * 2] : 0
    const f1 = s * 2 + 1 < part.length ? part[s * 2 + 1] : 1
    if (f1 > f0 && u >= f0 - 1e-9 && u <= f1 + 1e-9) return true
  }
  return false
}

/* ── THE OFFSET: bounding-box centres, then a translation-only fit ───── */
function fitOffset(meshes: DrawinMeshInput[], lines: Centreline[], usable: boolean[]): { ox: number; oy: number } {
  const matchStroke = (m: DrawinMeshInput) => (m.strokeIndex >= 0 && m.strokeIndex < lines.length && usable[m.strokeIndex] ? m.strokeIndex : -1)
  let gx0 = Infinity, gy0 = Infinity, gx1 = -Infinity, gy1 = -Infinity
  for (const m of meshes) {
    const p = m.positions
    for (let i = 0; i + 2 < p.length; i += 3) {
      if (p[i] < gx0) gx0 = p[i]
      if (p[i] > gx1) gx1 = p[i]
      if (p[i + 1] < gy0) gy0 = p[i + 1]
      if (p[i + 1] > gy1) gy1 = p[i + 1]
    }
  }
  let cx0 = Infinity, cy0 = Infinity, cx1 = -Infinity, cy1 = -Infinity
  for (const c of lines) {
    for (let i = 0; i < c.xs.length; i++) {
      if (c.xs[i] < cx0) cx0 = c.xs[i]
      if (c.xs[i] > cx1) cx1 = c.xs[i]
      if (c.ys[i] < cy0) cy0 = c.ys[i]
      if (c.ys[i] > cy1) cy1 = c.ys[i]
    }
  }
  let ox = (gx0 + gx1) / 2 - (cx0 + cx1) / 2
  let oy = (gy0 + gy1) / 2 - (cy0 + cy1) / 2
  if (!Number.isFinite(ox)) ox = 0
  if (!Number.isFinite(oy)) oy = 0

  const sample: { x: number; y: number; s: number }[] = []
  {
    let total = 0
    for (const m of meshes) total += m.positions.length / 3
    const stride = Math.max(1, Math.floor(total / 3000))
    let k = 0
    for (const m of meshes) {
      const s = matchStroke(m)
      for (let i = 0; i + 2 < m.positions.length; i += 3, k++) if (k % stride === 0) sample.push({ x: m.positions[i], y: m.positions[i + 1], s })
    }
  }
  for (let iter = 0; iter < 6; iter++) {
    const grid = new SegmentGrid(lines, ox, oy)
    let rx = 0
    let ry = 0
    for (const v of sample) {
      const hit = v.s >= 0 ? { ...nearestOn(lines[v.s], ox, oy, v.x, v.y) } : grid.nearest(v.x, v.y, ox, oy)
      rx += v.x - hit.x
      ry += v.y - hit.y
    }
    if (sample.length === 0) break
    rx /= sample.length
    ry /= sample.length
    ox += rx
    oy += ry
    if (Math.hypot(rx, ry) < 1e-7) break
  }
  return { ox, oy }
}

/**
 * Which stroke each mesh really is, for a mesh whose NAME does not say: the
 * stroke most of its vertices lie nearest, and what share of them do. The
 * adapter uses it to treat a per-stroke mesh named like a fused one
 * (Inflate's `inflate_000`, one per stroke) as the per-stroke mesh it is.
 */
export function meshStrokeShares(
  meshes: DrawinMeshInput[],
  strokes: DrawinPoint[][],
  canvasWidth: number,
  canvasHeight: number,
): { stroke: number; share: number }[] {
  const lines = centrelines(strokes, canvasWidth, canvasHeight)
  const usable = lines.map((c) => c.xs.length > 0)
  if (!usable.some(Boolean)) return meshes.map(() => ({ stroke: -1, share: 0 }))
  const { ox, oy } = fitOffset(meshes, lines, usable)
  const grid = new SegmentGrid(lines, ox, oy)
  return meshes.map((m) => {
    const n = m.positions.length / 3
    const stride = Math.max(1, Math.floor(n / 2000))
    const count = new Map<number, number>()
    let seen = 0
    for (let v = 0; v < n; v += stride) {
      const hit = grid.nearest(m.positions[v * 3], m.positions[v * 3 + 1], ox, oy)
      count.set(hit.s, (count.get(hit.s) ?? 0) + 1)
      seen++
    }
    let stroke = -1
    let best = 0
    for (const [st, c] of count) if (c > best) [stroke, best] = [st, c]
    return { stroke, share: seen ? best / seen : 0 }
  })
}

export function buildDrawinAnimation(input: DrawinInput): DrawinResult {
  const { meshes, strokes, canvasWidth, canvasHeight, frames } = input
  if (frames.length === 0) throw new Error("drawin-glb: the plan has no frames")
  const maxTargets = Math.max(1, Math.floor(input.maxTargetsPerMesh ?? DRAWIN_MAX_TARGETS))
  const maxBytes = input.maxMorphBytes ?? DRAWIN_MAX_MORPH_BYTES
  const lines = centrelines(strokes, canvasWidth, canvasHeight)
  const usable = lines.map((c) => c.xs.length > 0)

  const { ox, oy } = fitOffset(meshes, lines, usable)
  const matchStroke = (m: DrawinMeshInput) => (m.strokeIndex >= 0 && m.strokeIndex < lines.length && usable[m.strokeIndex] ? m.strokeIndex : -1)
  const grid = new SegmentGrid(lines, ox, oy)

  /* ── PER VERTEX: stroke, arc fraction, the collapse vector ───────────── */
  let fitSum = 0
  let fitN = 0
  const perMesh = meshes.map((m) => {
    const n = m.positions.length / 3
    const vs = new Int32Array(n)
    const vu = new Float64Array(n)
    const collapse = new Float32Array(n * 3)
    const vd = new Float64Array(n)
    let tri: {
      off: Int32Array
      cs: Int32Array
      cu: Float64Array
      fold: Float32Array
      foldS: Int32Array
      foldU: Float64Array
      longest: Float32Array
    } | null = null
    const s0 = matchStroke(m)
    if (m.triangles && s0 < 0) {
      /* A TRIANGLE SOUP, matched corner by corner. Each corner keeps its
       * nearest stroke (for the fold) and, in `cands`, every stroke close
       * enough to cover it (for visibility); each triangle keeps the fold
       * point of its centroid and its longest edge. */
      for (let v = 0; v < n; v++) {
        const px = m.positions[v * 3]
        const py = m.positions[v * 3 + 1]
        const hit = grid.nearest(px, py, ox, oy)
        vs[v] = hit.s
        vu[v] = hit.u
        collapse[v * 3] = hit.x - px
        collapse[v * 3 + 1] = hit.y - py
        collapse[v * 3 + 2] = -m.positions[v * 3 + 2]
        vd[v] = Math.sqrt(hit.d2)
        fitSum += vd[v]
        fitN++
      }
      /* COVER: a corner is shown when ANY stroke that could have drawn it is
       * shown there. Where two strokes cross, the corners near the crossing
       * sit on both; matched to the nearest alone, a crossing still to come
       * cut a notch out of the stroke already drawn (rendered and looked at,
       * on Inflate and Solid). "Could have drawn it" = within the corner's own
       * distance to its nearest centreline plus the mesh's typical half-width
       * (the median of those distances). */
      const sorted = Float64Array.from(vd).sort()
      const H = sorted.length ? sorted[sorted.length >> 1] : 0
      const off = new Int32Array(n + 1)
      const cs: number[] = []
      const cu: number[] = []
      for (let v = 0; v < n; v++) {
        off[v] = cs.length
        const near = grid.within(m.positions[v * 3], m.positions[v * 3 + 1], ox, oy, vd[v] + H + 1e-9)
        if (near.size === 0) {
          cs.push(vs[v])
          cu.push(vu[v])
        }
        for (const [st, hit] of near) {
          cs.push(st)
          cu.push(hit.u)
        }
      }
      off[n] = cs.length
      /* Per triangle: where it folds when it hides whole (its centroid's
       * centreline point) and how far a corner may travel to the reveal edge
       * without leaving the triangle's own reach (its longest edge). */
      const nt = Math.floor(n / 3)
      const fold = new Float32Array(nt * 2)
      const foldS = new Int32Array(nt)
      const foldU = new Float64Array(nt)
      const longest = new Float32Array(nt)
      for (let t = 0; t < nt; t++) {
        const P = m.positions
        const cx = (P[t * 9] + P[t * 9 + 3] + P[t * 9 + 6]) / 3
        const cy = (P[t * 9 + 1] + P[t * 9 + 4] + P[t * 9 + 7]) / 3
        const hit = grid.nearest(cx, cy, ox, oy)
        fold[t * 2] = hit.x
        fold[t * 2 + 1] = hit.y
        foldS[t] = hit.s
        foldU[t] = hit.u
        let L = 0
        for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
          L = Math.max(L, Math.hypot(P[t * 9 + a * 3] - P[t * 9 + b * 3], P[t * 9 + a * 3 + 1] - P[t * 9 + b * 3 + 1], P[t * 9 + a * 3 + 2] - P[t * 9 + b * 3 + 2]))
        }
        longest[t] = L
      }
      tri = { off, cs: Int32Array.from(cs), cu: Float64Array.from(cu), fold, foldS, foldU, longest }
    } else {
      for (let v = 0; v < n; v++) {
        const px = m.positions[v * 3]
        const py = m.positions[v * 3 + 1]
        const pz = m.positions[v * 3 + 2]
        const hit = s0 >= 0 ? { ...nearestOn(lines[s0], ox, oy, px, py), s: s0 } : grid.nearest(px, py, ox, oy)
        vs[v] = hit.s
        vu[v] = hit.u
        collapse[v * 3] = hit.x - px
        collapse[v * 3 + 1] = hit.y - py
        /* Onto the drawing's plane too, so a tall wall folds to the line and
         * not to a fin standing on it. */
        collapse[v * 3 + 2] = -pz
        fitSum += Math.sqrt(hit.d2)
        fitN++
      }
    }
    return { vs, vu, collapse, n, tri }
  })

  /* ── PER MESH: hidden sets per frame, the states kept, the weights ───── */
  const F = frames.length
  const hiddenAt = (mi: number, f: number): Uint8Array => {
    const { vs, vu, n, tri } = perMesh[mi]
    const hidden = new Uint8Array(n)
    const spans = frames[f].spans
    if (tri) {
      for (let v = 0; v < n; v++) {
        let shown = false
        for (let k = tri.off[v]; k < tri.off[v + 1] && !shown; k++) shown = tri.cs[k] >= 0 && visibleAt(spans, tri.cs[k], tri.cu[k])
        hidden[v] = shown ? 0 : 1
      }
      return hidden
    }
    for (let v = 0; v < n; v++) hidden[v] = vs[v] < 0 ? 0 : visibleAt(spans, vs[v], vu[v]) ? 0 : 1
    return hidden
  }
  /* Pass one keeps only a signature per frame (count and hash of the hidden
   * set), so a fused mesh of a few hundred thousand vertices does not hold a
   * hidden set for every frame of a long take. */
  const plans = meshes.map((m, mi) => {
    const n = perMesh[mi].n
    const sig: string[] = new Array(F)
    for (let f = 0; f < F; f++) {
      const hidden = hiddenAt(mi, f)
      let count = 0
      let hash = 2166136261
      for (let v = 0; v < n; v++) {
        if (hidden[v]) {
          count++
          hash = Math.imul(hash ^ v, 16777619) >>> 0
        }
      }
      sig[f] = `${count}:${hash}`
    }
    /* The first frame and every frame where the hidden set changes. Every
     * frame then SHOWS the state of the latest change at or before it:
     * `changeOf[f]` is that change's index. */
    const changes: number[] = [0]
    for (let f = 1; f < F; f++) if (sig[f] !== sig[f - 1]) changes.push(f)
    const changeOf = new Int32Array(F)
    for (let f = 0, j = 0; f < F; f++) {
      while (j + 1 < changes.length && changes[j + 1] <= f) j++
      changeOf[f] = j
    }
    return { changes, changeOf, n }
  })

  /* THE BUDGET: one cap for every mesh, scaled down together until the
   * (dense) bytes fit. A fused mesh does not need more states than a
   * one-stroke mesh: its blends grow out of the pen's front (see the fold). */
  const capOf = (_mi: number, scale: number) => Math.max(2, Math.floor(maxTargets * scale))
  let scale = 1
  const bytesAt = (sc: number) => plans.reduce((acc, p, mi) => acc + Math.min(capOf(mi, sc), p.changes.length) * p.n * 12, 0)
  while (scale > 0.02 && bytesAt(scale) > maxBytes) scale *= 0.9

  let morphBytes = 0
  const outMeshes: DrawinMeshOutput[] = meshes.map((m, mi) => {
    const p = plans[mi]
    const { collapse, n, vs, vu, tri } = perMesh[mi]
    /* Pick the states, as CHANGE indices: every change if they fit, else
     * evenly among them, the first and the last change always. */
    const cap = capOf(mi, scale)
    let pickedJ: number[]
    if (p.changes.length <= cap) pickedJ = p.changes.map((_, j) => j)
    else {
      const set = new Set<number>()
      for (let j = 0; j < cap; j++) set.add(Math.round((j * (p.changes.length - 1)) / (cap - 1)))
      pickedJ = [...set].sort((a, b) => a - b)
    }
    const picked = pickedJ.map((j) => p.changes[j])
    /* A state with nothing hidden is the base pose: no target is stored for
     * it, and its weight is simply zero. */
    const targets: Float32Array[] = []
    const targetOf = new Map<number, number>()
    const pos = meshes[mi].positions
    const perStroke = matchStroke(meshes[mi]) >= 0
    for (const f of picked) {
      const hidden = hiddenAt(mi, f)
      let hiddenCount = 0
      for (let v = 0; v < n; v++) hiddenCount += hidden[v]
      if (hiddenCount === 0) continue
      const t = new Float32Array(n * 3)
      /* WHERE A HIDDEN VERTEX GOES, three cases, all measured (the first build
       * sent every hidden vertex to its own centreline point: a fully hidden
       * mark still drew 2.1e-4 of its area in slivers where the polyline
       * bends, `assert-export-glb-anim.mjs`, and on a real Solid export the
       * not-yet-drawn stroke showed as a hairline wedge, rendered and looked
       * at, because its long cap triangles folded to lines, not points):
       *
       *   the whole mesh hidden   every vertex to ONE point, the start of the
       *                           earliest stroke it holds: exactly no area.
       *   one stroke's mesh       every hidden vertex to the visible edge
       *                           nearest it: the hidden part has no area and
       *                           the front narrows to a tip at the pen.
       *   a fused mesh            un-indexed by the adapter, so every triangle
       *                           owns its corners. Hidden whole: all three to
       *                           its centroid's centreline point, no area.
       *                           Across the reveal front: its hidden corners
       *                           to the visible edge nearest them, as one
       *                           stroke's mesh does, but only when that edge
       *                           point is within the triangle's longest edge;
       *                           farther means the edge is across a junction,
       *                           a spike, so the triangle hides whole. */
      if (hiddenCount === n) {
        let s0 = -1
        for (let v = 0; v < n; v++) if (vs[v] >= 0 && (s0 < 0 || vs[v] < s0)) s0 = vs[v]
        const [qx, qy] = s0 >= 0 ? pointAt(lines[s0], 0, ox, oy) : [0, 0]
        for (let v = 0; v < n; v++) {
          t[v * 3] = qx - pos[v * 3]
          t[v * 3 + 1] = qy - pos[v * 3 + 1]
          t[v * 3 + 2] = -pos[v * 3 + 2]
        }
      } else if (tri) {
        const spans = frames[f].spans
        for (let tIdx = 0; tIdx < Math.floor(n / 3); tIdx++) {
          const a = tIdx * 3
          const h = hidden[a] + hidden[a + 1] + hidden[a + 2]
          if (h === 0) continue
          let whole = h === 3
          const moves: [number, number, number][] = []
          if (!whole) {
            for (let v = a; v < a + 3; v++) {
              if (!hidden[v]) continue
              const edge = nearestEdge(spans, vs[v], vu[v])
              if (edge === null) {
                whole = true
                break
              }
              const [qx, qy] = pointAt(lines[vs[v]], edge, ox, oy)
              if (Math.hypot(qx - pos[v * 3], qy - pos[v * 3 + 1], pos[v * 3 + 2]) > tri.longest[tIdx]) {
                whole = true
                break
              }
              moves.push([v, qx, qy])
            }
          }
          if (whole) {
            /* To the pen's front on the triangle's own stroke (the visible
             * edge nearest its centroid, or the stroke's start before it has
             * one), so a blend between two stored states grows the mark out
             * of the front. Folded to its own centroid instead, every triangle
             * between two states shrank in place and the blend drew a lattice
             * (rendered and looked at, Solid). Only when the stroke is unknown
             * does it fold where it stands. */
            let fx = tri.fold[tIdx * 2]
            let fy = tri.fold[tIdx * 2 + 1]
            const fs = tri.foldS[tIdx]
            if (fs >= 0) {
              const e = nearestEdge(spans, fs, tri.foldU[tIdx])
              ;[fx, fy] = pointAt(lines[fs], e ?? 0, ox, oy)
            }
            for (let v = a; v < a + 3; v++) {
              t[v * 3] = fx - pos[v * 3]
              t[v * 3 + 1] = fy - pos[v * 3 + 1]
              t[v * 3 + 2] = -pos[v * 3 + 2]
            }
          } else {
            for (const [v, qx, qy] of moves) {
              t[v * 3] = qx - pos[v * 3]
              t[v * 3 + 1] = qy - pos[v * 3 + 1]
              t[v * 3 + 2] = -pos[v * 3 + 2]
            }
          }
        }
      } else {
        for (let v = 0; v < n; v++) {
          if (!hidden[v]) continue
          const edge = perStroke ? nearestEdge(frames[f].spans, vs[v], vu[v]) : null
          if (edge !== null) {
            const [qx, qy] = pointAt(lines[vs[v]], edge, ox, oy)
            t[v * 3] = qx - pos[v * 3]
            t[v * 3 + 1] = qy - pos[v * 3 + 1]
            t[v * 3 + 2] = -pos[v * 3 + 2]
          } else {
            t[v * 3] = collapse[v * 3]
            t[v * 3 + 1] = collapse[v * 3 + 1]
            t[v * 3 + 2] = collapse[v * 3 + 2]
          }
        }
      }
      targetOf.set(f, targets.length)
      targets.push(t)
    }
    morphBytes += targets.length * n * 12
    const K = targets.length
    const weights = new Float32Array(F * K)
    if (K > 0) {
      for (let f = 0; f < F; f++) {
        /* BLENDED OVER THE CHANGES, NOT OVER THE FRAMES. A frame shows the
         * state of the latest change at or before it, so a pause in the take
         * (a pen lift, the hold) holds its weights exactly as the live reveal
         * holds its ink; only a change between two stored states is a blend.
         * The first build blended by frame index, and the mark kept creeping
         * through a 23 s pen lift the live view sat still for. */
        const jf = p.changeOf[f]
        let ia = 0
        let ib = pickedJ.length - 1
        for (let i = 0; i < pickedJ.length; i++) {
          if (pickedJ[i] <= jf) ia = i
          if (pickedJ[i] >= jf) {
            ib = i
            break
          }
        }
        const ja = pickedJ[ia]
        const jb = pickedJ[ib]
        const put = (state: number, w: number) => {
          const k = targetOf.get(state)
          if (k !== undefined && w !== 0) weights[f * K + k] += w
        }
        if (ja === jb || jf <= ja) put(picked[ia], 1)
        else if (jf >= jb) put(picked[ib], 1)
        else {
          const w = (jf - ja) / (jb - ja)
          put(picked[ia], 1 - w)
          put(picked[ib], w)
        }
      }
    }
    return { name: m.name, targets, weights, stateFrames: [...targetOf.keys()], vertexStroke: vs, vertexU: vu }
  })

  return {
    times: drawinTimes(frames),
    meshes: outMeshes,
    offset: { x: ox, y: oy },
    fitMeanDistance: fitN ? fitSum / fitN : 0,
    morphBytes,
  }
}
