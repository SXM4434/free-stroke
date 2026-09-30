// Trace the Desk Doodles logo PNG (public/desk-doodles-logo.png) into the pen strokes the hero
// draws, written to scripts/capture/logo-strokes.json.
//
// WHY IT WAS REWRITTEN, 2026-09-24 (F118). The first version thinned the ink, walked the skeleton
// pixel by pixel and joined pieces whose ends nearly touched. On this logo that gave 22 strokes for
// 11 letters: 9 of them shorter than the hero nib, the final "s" in four pieces (it rendered as a
// "<", a dash and a bottom bar, the "es." Sebs called god-awful), the Desk "s" in three, and both
// "e"s drawn backwards from the tail. The audit is docs/verification/trace-audit-2026-09-24/.
// The previous output is kept as logo-strokes.before-2026-09-24.json.
//
// THE PIPELINE NOW.
//   1. Ink mask at 1400 px wide (ink is about 14 px thick there, 11 units in the output).
//   2. Zhang-Suen thinning to a one-pixel skeleton.
//   3. The skeleton as a GRAPH: junction pixels (not exactly two neighbours) clustered into nodes,
//      the runs between them as edges. Junctions closer than one ink width are one junction, so
//      the "k" arm meeting the stem is one crossing and not two.
//   4. Spurs pruned: an edge with a free end shorter than SPUR is where the thinning split a
//      rounded pen tip or an overlap, not a stroke. Repeated until nothing changes.
//   5. At every junction the edges are PAIRED by straightest continuation, the way a pen carries
//      through a crossing without lifting. What is left unpaired ends a stroke there.
//   6. The pairs are chained into strokes, lightly smoothed (a 7 px moving average, ends fixed),
//      simplified and resampled at 3 units.
//   7. Each stroke goes to the letter its centroid sits in, and is given the start and direction
//      a hand uses for that letter (LETTERS below). That table is the one authored part: a trace
//      knows where ink is, not which end the pen started at.
import { loadImage, createCanvas } from "@napi-rs/canvas"
import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const LOGO = join(ROOT, "public", "desk-doodles-logo.png")
const OUT = process.argv[2] || join(__dirname, "logo-strokes.json")

const WORK_W = 1400 // px, the working resolution
const TARGET_W = 1100 // output units, what the page and every probe expect
const INK_PX = 14 // measured: median ink run at WORK_W (11.0 units, 56 px at full size)
const SPUR = 1.6 * INK_PX // free-ended edge shorter than this is a pen tip or an overlap
const JOIN = 1.5 * INK_PX // junctions closer than this are one crossing (the k arm meets its stem
// over about 1.2 ink widths)
const SMOOTH_R = 3 // px each side, moving average along the stroke
const HEADING = 2.2 * INK_PX // px along an edge that sets its heading at a junction
const HOLE = 150 // px; enclosed paper smaller than this is a pinhole in the ink
const LOOP = 4 * INK_PX // px; a junction-to-itself loop shorter than this is an artefact

/* HOW A HAND WRITES EACH LETTER. x ranges in output units, measured off the logo's ink components
 * (docs/verification/trace-audit-2026-09-24/components.mjs). `start` picks which end the pen
 * goes down at:
 *   top      the higher end (s: top of the curl; e: the crossbar's left end, above the tail)
 *   down     the end the stroke leaves heading downward (D stem, k stem, l)
 *   low      the lower end (d: the bowl's free end, then round and up the stem)
 *   topright the end nearer the top-right corner (k arm: in at the top, out at the bottom right)
 * A closed stroke (o) starts at its highest point and runs anticlockwise on screen.
 * Strokes inside a letter are ordered by `order` (k: stem, then arm). */
const LETTERS = [
  { ch: "D", x: [0, 140], start: "down" },
  { ch: "e", x: [150, 256], start: "top" },
  { ch: "s", x: [256, 333], start: "top" },
  { ch: "k", x: [333, 470], start: "k" },
  { ch: "D", x: [480, 610], start: "down" },
  { ch: "o", x: [610, 712], start: "ccw" },
  { ch: "o", x: [712, 804], start: "ccw" },
  { ch: "d", x: [804, 874], start: "low" },
  { ch: "l", x: [874, 912], start: "down" },
  { ch: "e", x: [912, 1012], start: "top" },
  { ch: "s", x: [1012, 1101], start: "top" },
]

function inkMask(data, w, h) {
  const m = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) m[i] = data[i * 4] < 128 ? 1 : 0
  // Fill pinholes: paper enclosed by ink and smaller than HOLE px is the jagged edge of the
  // marker folding over, not a counter. Each one thins into a tiny ring and splits the stroke.
  // The smallest real counter (the eye of the Desk "e") is far above this.
  const lab = new Int32Array(w * h).fill(-1)
  let holes = 0
  for (let i = 0; i < w * h; i++) {
    if (m[i] || lab[i] >= 0) continue
    const st = [i], px = []
    lab[i] = i
    let border = false
    while (st.length) {
      const j = st.pop()
      px.push(j)
      const x = j % w, y = (j / w) | 0
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border = true
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy
        if (X < 0 || Y < 0 || X >= w || Y >= h) continue
        const k = Y * w + X
        if (!m[k] && lab[k] < 0) { lab[k] = i; st.push(k) }
      }
    }
    if (!border && px.length < HOLE) { for (const j of px) m[j] = 1; holes++ }
  }
  console.log(`[trace] filled ${holes} pinholes`)
  return m
}

// Zhang-Suen thinning, in place.
function thin(bmp, w, h) {
  const I = (x, y) => y * w + x
  let changed = true
  while (changed) {
    changed = false
    for (let step = 0; step < 2; step++) {
      const clear = []
      for (let y = 1; y < h - 1; y++)
        for (let x = 1; x < w - 1; x++) {
          if (!bmp[I(x, y)]) continue
          const p2 = bmp[I(x, y - 1)], p3 = bmp[I(x + 1, y - 1)], p4 = bmp[I(x + 1, y)], p5 = bmp[I(x + 1, y + 1)]
          const p6 = bmp[I(x, y + 1)], p7 = bmp[I(x - 1, y + 1)], p8 = bmp[I(x - 1, y)], p9 = bmp[I(x - 1, y - 1)]
          const n = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9
          if (n < 2 || n > 6) continue
          const s = [p2, p3, p4, p5, p6, p7, p8, p9, p2]
          let t = 0
          for (let k = 0; k < 8; k++) if (!s[k] && s[k + 1]) t++
          if (t !== 1) continue
          if (step === 0 ? p2 * p4 * p6 || p4 * p6 * p8 : p2 * p4 * p8 || p2 * p6 * p8) continue
          clear.push(I(x, y))
        }
      if (clear.length) {
        changed = true
        for (const i of clear) bmp[i] = 0
      }
    }
  }
}

const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]

// The skeleton as a graph. Returns { nodes: [{x,y}], edges: [{a,b,px:[[x,y]...]}] } where px runs
// from node a's centre to node b's centre. Closed runs with no junction come back with a = b = -1.
function skeletonGraph(bmp, w, h) {
  const I = (x, y) => y * w + x
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && bmp[I(x, y)]
  const nb = (x, y) => N8.map(([dx, dy]) => [x + dx, y + dy]).filter(([X, Y]) => on(X, Y))
  const isNode = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (bmp[I(x, y)] && nb(x, y).length !== 2) isNode[I(x, y)] = 1
  // cluster node pixels
  const nodeOf = new Int32Array(w * h).fill(-1)
  const nodes = []
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!isNode[I(x, y)] || nodeOf[I(x, y)] >= 0) continue
      const id = nodes.length, st = [[x, y]], px = []
      nodeOf[I(x, y)] = id
      while (st.length) {
        const [cx, cy] = st.pop()
        px.push([cx, cy])
        for (const [X, Y] of nb(cx, cy)) if (isNode[I(X, Y)] && nodeOf[I(X, Y)] < 0) { nodeOf[I(X, Y)] = id; st.push([X, Y]) }
      }
      const mx = px.reduce((a, p) => a + p[0], 0) / px.length, my = px.reduce((a, p) => a + p[1], 0) / px.length
      nodes.push({ x: mx, y: my, px })
    }
  const seen = new Uint8Array(w * h)
  const edges = []
  for (const [id, n] of nodes.entries())
    for (const [sx, sy] of n.px)
      for (const [X, Y] of nb(sx, sy)) {
        if (isNode[I(X, Y)] || seen[I(X, Y)]) continue
        const run = [[n.x, n.y], [X, Y]]
        seen[I(X, Y)] = 1
        let px = [sx, sy], cur = [X, Y], end = -1
        for (;;) {
          const next = nb(cur[0], cur[1]).filter(([a, b]) => !(a === px[0] && b === px[1]))
          const hitNode = next.find(([a, b]) => isNode[I(a, b)] && !(nodeOf[I(a, b)] === id && run.length < 3))
          const free = next.filter(([a, b]) => !isNode[I(a, b)] && !seen[I(a, b)])
          if (free.length) {
            px = cur
            cur = free[0]
            seen[I(cur[0], cur[1])] = 1
            run.push(cur)
            continue
          }
          const back = hitNode || next.find(([a, b]) => isNode[I(a, b)])
          end = back ? nodeOf[I(back[0], back[1])] : -1
          break
        }
        if (end >= 0) run.push([nodes[end].x, nodes[end].y])
        edges.push({ a: id, b: end, px: run })
      }
  // closed runs with no junction at all (an o drawn as a clean ring)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!bmp[I(x, y)] || isNode[I(x, y)] || seen[I(x, y)]) continue
      const run = [[x, y]]
      seen[I(x, y)] = 1
      let cur = [x, y]
      for (;;) {
        const f = nb(cur[0], cur[1]).find(([a, b]) => !seen[I(a, b)])
        if (!f) break
        seen[I(f[0], f[1])] = 1
        run.push(f)
        cur = f
      }
      run.push(run[0])
      edges.push({ a: -1, b: -1, px: run, ring: true })
    }
  return { nodes, edges }
}

const plen = (px) => px.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - px[i - 1][0], p[1] - px[i - 1][1]) : 0), 0)
const degree = (edges, id) => edges.reduce((a, e) => a + (e.a === id) + (e.b === id), 0)

function prune(g) {
  let edges = g.edges.filter((e) => e.px.length > 1)
  // an edge that does not reach another node is free-ended at b; normalise so the free end is b
  for (let changed = true; changed; ) {
    changed = false
    // a loop from a junction back to itself shorter than LOOP is a staircase or a pinhole, never
    // a counter (the smallest counter, the Desk "e" eye, is about 150 px round)
    const tiny = edges.find((e) => !e.ring && e.a === e.b && plen(e.px) < LOOP)
    if (tiny) {
      edges = edges.filter((f) => f !== tiny)
      changed = true
      continue
    }
    for (const e of edges) {
      const freeA = e.a >= 0 && degree(edges, e.a) === 1
      const freeB = e.b < 0 || degree(edges, e.b) === 1
      if (e.ring || e.a === e.b) continue
      const otherDeg = freeB ? (e.a >= 0 ? degree(edges, e.a) : 0) : e.b >= 0 ? degree(edges, e.b) : 0
      if ((freeA || freeB) && otherDeg >= 3 && plen(e.px) < SPUR) {
        edges = edges.filter((f) => f !== e)
        changed = true
        break
      }
    }
    if (changed) continue
    // two junctions closer than one ink width are one crossing: contract the edge between them
    for (const e of edges) {
      if (e.ring || e.a < 0 || e.b < 0 || e.a === e.b) continue
      if (degree(edges, e.a) >= 3 && degree(edges, e.b) >= 3 && plen(e.px) < JOIN) {
        const keep = e.a, gone = e.b
        const na = g.nodes[keep], nbn = g.nodes[gone]
        na.x = (na.x + nbn.x) / 2
        na.y = (na.y + nbn.y) / 2
        edges = edges.filter((f) => f !== e)
        for (const f of edges) {
          if (f.a === gone) f.a = keep
          if (f.b === gone) f.b = keep
          if (f.a === keep) f.px[0] = [na.x, na.y]
          if (f.b === keep) f.px[f.px.length - 1] = [na.x, na.y]
        }
        changed = true
        break
      }
    }
  }
  return edges
}

// Pair the edge-ends at every junction by straightest continuation and chain them into strokes.
function chain(g, edges) {
  const ends = new Map() // node -> [{e, atStart}]
  edges.forEach((e, k) => {
    if (e.ring) return
    for (const atStart of [true, false]) {
      const id = atStart ? e.a : e.b
      if (id < 0) continue
      if (!ends.has(id)) ends.set(id, [])
      ends.get(id).push({ k, atStart })
    }
  })
  const dirOut = ({ k, atStart }) => {
    const px = atStart ? edges[k].px : edges[k].px.slice().reverse()
    const o = px[0]
    let q = px[px.length - 1]
    let L = 0
    for (let i = 1; i < px.length; i++) {
      L += Math.hypot(px[i][0] - px[i - 1][0], px[i][1] - px[i - 1][1])
      if (L >= HEADING) { q = px[i]; break }
    }
    const l = Math.hypot(q[0] - o[0], q[1] - o[1]) || 1
    return [(q[0] - o[0]) / l, (q[1] - o[1]) / l]
  }
  const key = (x) => `${x.k}:${x.atStart}`
  const mate = new Map()
  for (const list of ends.values()) {
    if (list.length < 2) continue
    const rest = list.slice()
    while (rest.length >= 2) {
      let best = null, bestDot = Infinity
      for (let i = 0; i < rest.length; i++)
        for (let j = i + 1; j < rest.length; j++) {
          if (rest[i].k === rest[j].k && list.length > 2) continue
          const a = dirOut(rest[i]), b = dirOut(rest[j])
          const d = a[0] * b[0] + a[1] * b[1]
          if (d < bestDot) { bestDot = d; best = [i, j] }
        }
      if (!best) break
      // a third edge only ends a stroke; a fourth pairs with it (the k's chevron)
      if (rest.length === 3 && list.length === 3 && bestDot > -0.2) break
      const [i, j] = best
      mate.set(key(rest[i]), rest[j])
      mate.set(key(rest[j]), rest[i])
      rest.splice(j, 1)
      rest.splice(i, 1)
    }
  }
  const used = new Set()
  const strokes = []
  const walkFrom = (start) => {
    let cur = start
    const out = []
    for (;;) {
      if (used.has(cur.k)) break
      used.add(cur.k)
      const px = cur.atStart ? edges[cur.k].px : edges[cur.k].px.slice().reverse()
      out.push(...(out.length ? px.slice(1) : px))
      const farEnd = { k: cur.k, atStart: !cur.atStart }
      const m = mate.get(key(farEnd))
      if (!m) break
      cur = m
    }
    return out
  }
  // open strokes first: from every unpaired end
  edges.forEach((e, k) => {
    if (e.ring) return
    for (const atStart of [true, false]) {
      if (used.has(k)) continue
      const id = atStart ? e.a : e.b
      if (id >= 0 && mate.has(key({ k, atStart }))) continue
      strokes.push({ px: walkFrom({ k, atStart }), closed: false })
    }
  })
  // what is left is closed
  edges.forEach((e, k) => {
    if (used.has(k)) return
    if (e.ring) { used.add(k); strokes.push({ px: e.px, closed: true }); return }
    strokes.push({ px: walkFrom({ k, atStart: true }), closed: true })
  })
  return strokes
}

function smooth(px, closed, pinned) {
  const n = px.length
  if (n < 5) return px
  const out = []
  for (let i = 0; i < n; i++) {
    if (!closed && (i === 0 || i === n - 1)) { out.push(px[i]); continue }
    // a junction the pen turned or crossed at stays where the skeleton put it: averaging through
    // it rounds the k's chevron off the stem and the D's foot off its point
    if (pinned.has(`${px[i][0]},${px[i][1]}`)) { out.push(px[i]); continue }
    let sx = 0, sy = 0, c = 0
    for (let k = -SMOOTH_R; k <= SMOOTH_R; k++) {
      let j = i + k
      if (closed) j = (j + n - 1) % (n - 1)
      else j = Math.max(0, Math.min(n - 1, j))
      sx += px[j][0]; sy += px[j][1]; c++
    }
    out.push([sx / c, sy / c])
  }
  return out
}

function simplify(points, eps) {
  if (points.length < 3) return points
  let maxD = 0, idx = 0
  const [ax, ay] = points[0], [bx, by] = points[points.length - 1]
  const len = Math.hypot(bx - ax, by - ay)
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i]
    const d = len > 1e-9 ? Math.abs((px - ax) * (by - ay) - (py - ay) * (bx - ax)) / len : Math.hypot(px - ax, py - ay)
    if (d > maxD) { maxD = d; idx = i }
  }
  if (maxD <= eps) return [points[0], points[points.length - 1]]
  return simplify(points.slice(0, idx + 1), eps).slice(0, -1).concat(simplify(points.slice(idx), eps))
}

function densify(p, step) {
  const out = [p[0]]
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i]
    const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / step))
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n })
  }
  return out
}

// Give a stroke the start and direction a hand uses for its letter.
function orient(pts, closed, rule) {
  const head = (p) => {
    const a = p[0]
    let b = p[p.length - 1]
    for (const q of p) if (Math.hypot(q.x - a.x, q.y - a.y) > 15) { b = q; break }
    return [b.x - a.x, b.y - a.y]
  }
  if (closed) {
    // open the ring at a chosen point
    const ring = pts.slice(0, -1)
    let at = 0
    if (rule === "down") {
      // D: where the stem begins, the top-left of the ring
      ring.forEach((q, i) => { if (q.x + q.y < ring[at].x + ring[at].y) at = i })
    } else {
      ring.forEach((q, i) => { if (q.y < ring[at].y) at = i })
    }
    let p = ring.slice(at).concat(ring.slice(0, at + 1))
    // area sign: on screen (y down) anticlockwise has negative shoelace sum
    let A = 0
    for (let i = 1; i < p.length; i++) A += p[i - 1].x * p[i].y - p[i].x * p[i - 1].y
    if (rule === "down") { if (head(p)[1] < head(p.slice().reverse())[1]) p = p.reverse() }
    else if (A > 0) p = p.reverse()
    return p
  }
  const a = pts[0], b = pts[pts.length - 1]
  let flip = false
  if (rule === "top") flip = b.y < a.y
  else if (rule === "low") flip = b.y > a.y
  else if (rule === "down") flip = head(pts.slice().reverse())[1] > head(pts)[1]
  else if (rule === "topright") flip = b.y - b.x < a.y - a.x
  return flip ? pts.slice().reverse() : pts
}

async function main() {
  const img = await loadImage(LOGO)
  const s = WORK_W / img.width
  const w = WORK_W, h = Math.round(img.height * s)
  const c = createCanvas(w, h)
  const ctx = c.getContext("2d")
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  const bmp = inkMask(ctx.getImageData(0, 0, w, h).data, w, h)
  thin(bmp, w, h)
  const g = skeletonGraph(bmp, w, h)
  const edges = prune(g)
  const raw = chain(g, edges)
  console.log(`[trace] skeleton: ${g.nodes.length} nodes, ${g.edges.length} edges; after pruning ${edges.length} edges; ${raw.length} strokes`)

  const k = TARGET_W / w
  const pinned = new Set(g.nodes.filter((n, id) => degree(edges, id) >= 3).map((n) => `${n.x},${n.y}`))
  const strokes = raw
    .map(({ px, closed }) => {
      const sm = smooth(px, closed, pinned)
      const simp = simplify(sm, 0.9)
      const pts = densify(simp.map(([x, y]) => ({ x: x * k, y: y * k })), 3)
      return { pts, closed }
    })
    .filter(({ pts }) => pts.length >= 2)

  const cx = (p) => p.reduce((a, q) => a + q.x, 0) / p.length
  const len = (p) => p.reduce((a, q, i) => (i ? a + Math.hypot(q.x - p[i - 1].x, q.y - p[i - 1].y) : 0), 0)
  const out = []
  for (const L of LETTERS) {
    const mine = strokes.filter(({ pts }) => cx(pts) >= L.x[0] && cx(pts) < L.x[1])
    let placed
    if (L.start === "k") {
      // stem first (the tallest), then the arm in at its top-right end
      mine.sort((a, b) => (Math.max(...b.pts.map((q) => q.y)) - Math.min(...b.pts.map((q) => q.y))) - (Math.max(...a.pts.map((q) => q.y)) - Math.min(...a.pts.map((q) => q.y))))
      placed = mine.map((m, i) => orient(m.pts, m.closed, i === 0 ? "down" : "topright"))
    } else {
      mine.sort((a, b) => len(b.pts) - len(a.pts))
      placed = mine.map((m) => orient(m.pts, m.closed, L.start === "ccw" ? "ccw" : L.start))
    }
    console.log(`[trace] ${L.ch}: ${placed.length} stroke(s) ${placed.map((p) => len(p).toFixed(0)).join(", ")}`)
    out.push(...placed)
  }
  // A stroke that ends INSIDE another letter's ink (the Desk "s" curl runs into the "k" stem: the
  // two are one ink blob in the logo) is cut back to where its own ink meets the other stroke's,
  // one ink width off that stroke's centreline, which is where the logo's curl ends.
  const INK_U = INK_PX * k
  const letterIdx = (p) => LETTERS.findIndex((L) => cx(p) >= L.x[0] && cx(p) < L.x[1])
  const near = (q, p) => Math.min(...p.map((r) => Math.hypot(r.x - q.x, r.y - q.y)))
  let trims = 0
  for (let i = 0; i < out.length; i++) {
    const others = out.filter((p, j) => j !== i && letterIdx(p) !== letterIdx(out[i]))
    for (const atEnd of [false, true]) {
      let p = atEnd ? out[i].slice().reverse() : out[i]
      const dOf = (q) => Math.min(...others.map((o) => near(q, o)))
      if (!others.length || dOf(p[0]) > 2) continue
      let c = 0
      while (c < p.length - 2 && dOf(p[c]) < INK_U) c++
      p = p.slice(c)
      out[i] = atEnd ? p.reverse() : p
      trims++
    }
  }
  console.log(`[trace] cut back ${trims} stroke end(s) that ran into another letter`)
  const orphans = strokes.filter(({ pts }) => !LETTERS.some((L) => cx(pts) >= L.x[0] && cx(pts) < L.x[1]))
  if (orphans.length) throw new Error(`${orphans.length} stroke(s) fall in no letter`)
  const round = (p) => p.map((q) => ({ x: +q.x.toFixed(2), y: +q.y.toFixed(2) }))
  writeFileSync(OUT, JSON.stringify({ width: TARGET_W, height: Math.round(h * k), polylines: out.map(round) }))
  console.log(`[trace] wrote ${out.length} strokes to ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
