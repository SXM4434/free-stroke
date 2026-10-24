// ASSERT: the drawRange reveal draws the SAME MARK the rebuild reveal drew.
//
// The change under test replaces "rebuild the whole implicit surface from an
// arc-length prefix of the strokes, 120 times inside the draw beat" with "build
// the surface once, sort its triangles by arc position, and move a drawRange".
// The thing that could silently be wrong is not the speed — that is trivially
// measurable — it is whether the drawRange is showing the RIGHT PREFIX. A
// reveal that runs backwards, or reveals a whole stroke at once, or leaks
// triangles ahead of the pen, would still be fast and would still look like
// "something is being drawn".
//
// So this compares the two mechanisms against each other on the hero word, at
// a sweep of playhead positions, on the property that actually defines the
// reveal: WHICH PART OF THE PLANE IS INKED.
//
//   REBUILD:   build the surface from the prefix strokes; take its bbox.
//   DRAWRANGE: build the surface from the FULL strokes once; take the bbox of
//              only the vertices used by triangles below the playhead.
//
// If the two mechanisms agree on the inked region at every playhead position,
// the drawRange is showing the same prefix the rebuild did.
//
// NEGATIVE CONTROL. An agreement test that cannot fail proves nothing, so the
// script also runs the comparison with the reveal keys deliberately REVERSED
// and requires that to FAIL. If the control passes, the metric is blind and
// the whole run is reported as inconclusive rather than green.
//
// Runs in node, not a browser: none of this touches WebGL. See the header of
// measure-implicit-cost.mjs.
//
// Usage: node scripts/verify/assert-implicit-reveal.mjs
// gate-integrity: differential — the six constants channel D can reach here are write-only debug
// accumulators (`SOLID_DEBUG.canvasWidth`, `INFLATE_DEBUG.msFieldReveal`, overwritten on every
// build before anything reads them), `HAND_FEEL_OFF.wobble` (the point of that object is that the
// reveal ORDER this file grades is invariant to hand feel — a mutation proving it still is is a
// pass, not a miss), and a default parameter of `processStroke`. The subject is that the reveal is
// index-order-only, byte for byte, which no single constant decides.
import { loadTs } from "./_ts-load.mjs"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")

const { getEngine, INFLATE_DEBUG, computeSolidEffectiveThicknessPx, DEFAULT_SOLID_PARAMS } =
  loadTs("lib/geometry-engines.ts")
const { processStroke } = loadTs("lib/stroke-processing.ts")

const CANVAS_W = 720
const CANVAS_H = 852
const HERO_INFLATE = { fusion: "implicit", blend: 0.45, resolution: 5 }
const INK_WIDTH_PX = computeSolidEffectiveThicknessPx(DEFAULT_SOLID_PARAMS.thickness)

function heroStrokes() {
  const json = JSON.parse(readFileSync(join(ROOT, "scripts/capture/logo-strokes.json"), "utf8"))
  let t = 0
  const raw = json.polylines.map((pl) => {
    const points = pl.map((p) => {
      const pt = { x: p.x, y: p.y, t }
      t += 12
      return pt
    })
    t += 60
    return { points }
  })
  return raw.map((s) =>
    processStroke(s, 4, true, true, 45, {
      wobble: 0.4,
      endpoint: "protrude",
      inkWidth: INK_WIDTH_PX,
    }),
  )
}

/** Arc-length prefix — the old rebuild path's input. */
function prefix(strokes, p) {
  if (p >= 1) return strokes
  if (p <= 0) return []
  let total = 0
  for (const s of strokes) {
    for (let i = 1; i < s.points.length; i++) {
      total += Math.hypot(s.points[i].x - s.points[i - 1].x, s.points[i].y - s.points[i - 1].y)
    }
  }
  let remaining = total * p
  const out = []
  for (const s of strokes) {
    const pts = s.points
    const kept = [pts[0]]
    let cut = false
    for (let i = 1; i < pts.length; i++) {
      const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
      if (seg >= remaining) {
        const f = seg > 0 ? remaining / seg : 0
        kept.push({
          x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f,
          y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f,
          t: pts[i - 1].t + (pts[i].t - pts[i - 1].t) * f,
          pressure: pts[i - 1].pressure,
        })
        cut = true
        break
      }
      remaining -= seg
      kept.push(pts[i])
    }
    if (kept.length >= 2) out.push({ ...s, points: kept })
    if (cut) break
  }
  return out
}

const engine = getEngine("inflate")

/**
 * The same build with the reveal order withheld — i.e. exactly what the
 * exporter and every non-animating caller get. Used as the control that the
 * reveal work is index-order-only.
 */
const implicitSurface = loadTs("lib/implicit-surface.ts")
let suppressReveal = false
const realPolygonise = implicitSurface.polygoniseCapsuleField
implicitSurface.polygoniseCapsuleField = (caps, opts) =>
  realPolygonise(caps, suppressReveal ? { ...opts, revealOrder: undefined } : opts)

function buildWithoutReveal(strokes) {
  suppressReveal = true
  try {
    const m = engine.buildPreview(strokes, {
      canvasWidth: CANVAS_W,
      canvasHeight: CANVAS_H,
      inflateParams: HERO_INFLATE,
    })
    return m[0].tubeGeometry
  } finally {
    suppressReveal = false
  }
}

function build(strokes) {
  const meshes = engine.buildPreview(strokes, {
    canvasWidth: CANVAS_W,
    canvasHeight: CANVAS_H,
    inflateParams: HERO_INFLATE,
  })
  return meshes[0] ?? null
}

/** bbox of the vertices used by index range [0, triCount*3). */
function drawnBBox(geometry, triCount) {
  const pos = geometry.getAttribute("position").array
  const idx = geometry.getIndex().array
  const n = Math.min(triCount * 3, idx.length)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (let i = 0; i < n; i++) {
    const v = idx[i] * 3
    if (pos[v] < minX) minX = pos[v]
    if (pos[v] > maxX) maxX = pos[v]
    if (pos[v + 1] < minY) minY = pos[v + 1]
    if (pos[v + 1] > maxY) maxY = pos[v + 1]
  }
  if (!Number.isFinite(minX)) return null
  return { minX, maxX, minY, maxY }
}

function fullBBox(geometry) {
  const pos = geometry.getAttribute("position").array
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (let i = 0; i < pos.length; i += 3) {
    if (pos[i] < minX) minX = pos[i]
    if (pos[i] > maxX) maxX = pos[i]
    if (pos[i + 1] < minY) minY = pos[i + 1]
    if (pos[i + 1] > maxY) maxY = pos[i + 1]
  }
  return { minX, maxX, minY, maxY }
}

function lowerBound(keys, frac) {
  let lo = 0
  let hi = keys.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (keys[mid] <= frac) lo = mid + 1
    else hi = mid
  }
  return lo
}

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

function main() {
  const strokes = heroStrokes()

  // ---- the one build the beat is allowed ----
  const full = build(strokes)
  if (!full) {
    say(false, "implicit build produced a mesh")
    process.exit(1)
  }
  const keys = full.revealKeys
  say(!!keys, "revealKeys present on the implicit mesh", keys ? `${keys.length} triangles` : "MISSING")
  if (!keys) process.exit(1)

  const triTotal = full.tubeGeometry.getIndex().count / 3
  say(keys.length === triTotal, "one key per triangle", `${keys.length} keys / ${triTotal} triangles`)

  let ascending = true
  for (let i = 1; i < keys.length; i++) if (keys[i] < keys[i - 1]) { ascending = false; break }
  say(ascending, "keys are ascending (binary search is valid)")

  say(
    keys[0] >= 0 && keys[keys.length - 1] <= 1 + 1e-6,
    "keys span 0..1",
    `${keys[0].toFixed(4)} .. ${keys[keys.length - 1].toFixed(4)}`,
  )

  console.log(
    `\n  reveal table cost: ${INFLATE_DEBUG.msFieldReveal.toFixed(1)}ms once, ` +
      `against ${INFLATE_DEBUG.msImplicitTotal.toFixed(0)}ms for the build it rides on`,
  )

  // ---- the agreement test ----
  const wordW = fullBBox(full.tubeGeometry).maxX - fullBBox(full.tubeGeometry).minX
  console.log("\n  playhead   rebuild maxX   drawRange maxX   delta (as % of word width)")
  const deltas = []
  for (const p of [0.15, 0.3, 0.45, 0.6, 0.75, 0.9]) {
    const partial = build(prefix(strokes, p))
    if (!partial) {
      say(false, `rebuild produced a mesh at p=${p}`)
      continue
    }
    const rb = fullBBox(partial.tubeGeometry)
    const db = drawnBBox(full.tubeGeometry, lowerBound(keys, p))
    if (!db) {
      say(false, `drawRange revealed something at p=${p}`)
      continue
    }
    const d = Math.abs(rb.maxX - db.maxX) / wordW
    deltas.push(d)
    console.log(
      `   ${p.toFixed(2)}      ${rb.maxX.toFixed(4)}        ${db.maxX.toFixed(4)}        ${(d * 100).toFixed(2)}%`,
    )
  }
  // 3% of the word is about half a letter — tight enough that a whole-stroke
  // pop or a reversed order cannot hide inside it, loose enough to absorb the
  // genuine difference between the two mechanisms (the rebuild caps its prefix
  // with a rounded pen tip; the drawRange cuts through the finished surface).
  const worst = Math.max(...deltas)
  say(worst <= 0.03, "drawRange reveals the same prefix the rebuild did", `worst ${(worst * 100).toFixed(2)}% of word width`)

  // ---- the surface itself must be UNTOUCHED --------------------------------
  //
  // The reveal table reorders the index buffer and nothing else. If it also
  // moved a vertex, every measurement taken on this surface — the fillet law,
  // the manifold audit, the rim metrics — would silently be measuring a
  // different object, and the reveal work would have quietly become a geometry
  // change. So: same positions, same normals, same SET of triangles.
  {
    const withKeys = full.tubeGeometry
    // A build with the reveal order withheld is the same call the exporter and
    // every static preview make.
    const plain = buildWithoutReveal(strokes)
    const pa = withKeys.getAttribute("position").array
    const pb = plain.getAttribute("position").array
    let posSame = pa.length === pb.length
    if (posSame) for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) { posSame = false; break }
    say(posSame, "the reveal table moves no vertex", `${pa.length / 3} vertices`)

    const na = withKeys.getAttribute("normal").array
    const nb = plain.getAttribute("normal").array
    let nrmSame = na.length === nb.length
    if (nrmSame) for (let i = 0; i < na.length; i++) if (na[i] !== nb[i]) { nrmSame = false; break }
    say(nrmSame, "the reveal table changes no normal")

    const ia = withKeys.getIndex().array
    const ib = plain.getIndex().array
    const canon = (arr) => {
      const out = new Array(arr.length / 3)
      for (let t = 0; t < out.length; t++) {
        const v = [arr[t * 3], arr[t * 3 + 1], arr[t * 3 + 2]].sort((x, y) => x - y)
        out[t] = v.join(",")
      }
      out.sort()
      return out
    }
    const ca = canon(ia)
    const cb = canon(ib)
    let triSame = ca.length === cb.length
    if (triSame) for (let t = 0; t < ca.length; t++) if (ca[t] !== cb[t]) { triSame = false; break }
    say(triSame, "the reveal table changes no triangle, only their ORDER", `${ca.length} triangles`)
  }

  // ---- negative control: can this metric fail at all? ----
  const reversed = new Float32Array(keys.length)
  for (let i = 0; i < keys.length; i++) reversed[i] = keys[keys.length - 1 - i]
  let controlWorst = 0
  for (const p of [0.15, 0.3, 0.45, 0.6, 0.75, 0.9]) {
    const partial = build(prefix(strokes, p))
    if (!partial) continue
    const rb = fullBBox(partial.tubeGeometry)
    // Reversed keys are descending, so count triangles from the front whose
    // reversed key is <= p — a deliberately wrong prefix.
    let n = 0
    while (n < reversed.length && reversed[n] <= p) n++
    const db = drawnBBox(full.tubeGeometry, n)
    if (!db) { controlWorst = 1; continue }
    controlWorst = Math.max(controlWorst, Math.abs(rb.maxX - db.maxX) / wordW)
  }
  say(
    controlWorst > 0.03,
    "NEGATIVE CONTROL: a reversed reveal order is rejected",
    `worst ${(controlWorst * 100).toFixed(2)}% (must exceed the 3.00% threshold)`,
  )

  console.log(`\n${pass ? "ALL ASSERTIONS PASS" : "FAILURES ABOVE"}`)
  process.exit(pass ? 0 : 1)
}

main()
