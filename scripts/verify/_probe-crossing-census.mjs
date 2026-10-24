// EVERY PLACE THIS WORD ACTUALLY CROSSES ITSELF — the whole population, before
// any guard, so the ceiling on K7's news is measured rather than assumed.
//
// ── WHY THE POPULATION AND NOT THE SET ─────────────────────────────────────
// `findHeroJunctions` reports ONE junction PER PAIR of strokes, at their closest
// approach, and excludes same-stroke contacts outright. Both exclusions are
// stated in its docstring and only one of them is sound:
//
//   • one per pair — sound for a pair that RUNS TOGETHER (the eye reads that
//     once), unsound for a pair that crosses in TWO PLACES. Two crossings are
//     two pieces of news and the second one is currently invisible.
//   • no self-contacts — the stated reason is that a stroke passing near itself
//     *"has no 'later' stroke to be in front, so there is no pen order to show"*.
//     That is false. Within one stroke the pen order is the ARC: the later arc
//     was drawn later and is in front, by exactly the record the whole mechanism
//     rests on. Cursive is made of loops, and every loop closes on itself.
//
// So this enumerates contact RUNS — maximal intervals of overlapping ink —
// between every ordered pair INCLUDING a stroke with itself, and reports each
// with the crossing angle and whether the under arc passes behind and comes out.
//
// Ink overlap is the union-of-stamps test `buildPenField` bakes,
// `|p_i − p_j| <= w_i + w_j` with `w` from `carvedHalfWidth` — not the tube's
// diameter, because this is a question about the mark the return actually shows.
//
// ── WHAT IT FOUND, and it is where K7's missing news is (2026-08-01) ───────
// 45 contact runs on this word at carve 1.00. Of those, SEVEN are a stroke
// crossing ITSELF — the cursive loops of `D`, `s`, `D`, `o`, `o`, `d`, `e` — and
// they are the only steep crossings on the word besides 7->8:
//
//     0-0   76°     10-10  82°     13-13  54°
//     3-3   83°     12-12  66°     14-14  67°  (the law drops this one)
//    16-16  88°
//
// Six of the seven survive `buildJointBreaks` at carve 1.00 — 85.5 units of
// centreline against 7->8's 16.1, i.e. FIVE TIMES what the entire distinct-pair
// set carries — and applied to the carved raster they open 651 px of paper
// against `assert-hero-k7-news`'s 200 px floor (`--self --news --raster`).
//
// ⚠ AND THEY ARE NOT A FREE WIN, WHICH IS THE OTHER HALF OF THE FINDING.
// Applied raw they take the mark from 6 connected components to 8. They need the
// same crossing test the distinct pairs get, and on the split-halves
// representation (the only one they are expressible in) only two of the six pass
// it — 3-3 and 16-16, worth 250 px, still 6 -> 7. Some of that is the split's own
// artefact: cutting the stroke in two gives each half a terminal AT the crossing,
// so the "the stroke in front is not a cap" clause fires on a boundary the mark
// does not have. Sizing that clause off the WHOLE stroke rather than off the half
// is the first thing to try.
//
// ── WHY THIS LANE COULD NOT LAND IT ────────────────────────────────────────
// `HeroJunctionInput` (lib/flat-ink.ts) carries two STROKE INDICES, and
// `buildJointBreaks` resolves both samples with `nearestIndex` on those strokes
// from ONE published point. With `under === over` both resolve to the same
// index, `dOver` is 0 everywhere, the cut is 0 and the junction is dropped — a
// self-crossing is not expressible, it degrades silently to nothing. The fix is
// to key the two samples on ARC rather than on stroke index, which is
// `lib/flat-ink.ts` and not this lane's file. The SHADER needs no change: it
// consumes the three-point samples and the radii, never the indices.
//
// Usage:
//   node scripts/verify/_probe-crossing-census.mjs [--carve=1] [--self] [--news]
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { loadTs } from "./_ts-load.mjs"
import { processedHeroStrokes } from "./_hero-word.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const OUT = join(ROOT, "docs", "verification", "hero-k7", "break-carve")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const has = (k) => process.argv.includes(`--${k}`)

const flat = loadTs("lib/flat-ink.ts")
const { carvedHalfWidth, buildJointBreaks, JOINT_BREAK_KEEP_K, PEN_NIB_DEFAULT } = flat

const strokes = processedHeroStrokes().map((s) => s.points)
const live = JSON.parse(readFileSync(join(OUT, "live-junctions.json"), "utf8"))
const ink = live.inkWidth
const R = ink / 2
const carve = Number(arg("carve", "1"))
const breakK = Number(arg("breakK", String(live.breakK)))
const tubeKeep = (JOINT_BREAK_KEEP_K * ink) / 2
const sized = (pts, i) =>
  tubeKeep + (carvedHalfWidth(pts, i, R, PEN_NIB_DEFAULT) - tubeKeep) * carve

const W = strokes.map((pts) => pts.map((_, i) => sized(pts, i)))
const ARC = strokes.map((pts) => {
  const a = [0]
  for (let i = 1; i < pts.length; i++)
    a.push(a[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  return a
})
const tangent = (pts, i) => {
  const a = pts[Math.max(0, i - 1)]
  const b = pts[Math.min(pts.length - 1, i + 1)]
  const L = Math.hypot(b.x - a.x, b.y - a.y) || 1
  return { x: (b.x - a.x) / L, y: (b.y - a.y) / L }
}
const angleAt = (A, i, B, k) => {
  const t = tangent(A, i)
  const u = tangent(B, k)
  return (Math.acos(Math.max(0, Math.min(1, Math.abs(t.x * u.x + t.y * u.y)))) * 180) / Math.PI
}

/**
 * Maximal runs of overlapping ink between two strokes, each reduced to its
 * closest-approach sample. `minArcApart` separates a genuine second crossing
 * from the same crossing seen from two neighbouring samples: two contacts closer
 * than one ink diameter along BOTH strokes are one event.
 */
function runs(a, b) {
  const A = strokes[a]
  const B = strokes[b]
  const hits = []
  for (let i = 0; i < A.length; i++) {
    for (let k = 0; k < B.length; k++) {
      // Same stroke: only the ordered half of the matrix (an unordered contact
      // reported twice is one crossing counted twice), and far enough apart in
      // ARC that it is a loop closing rather than two neighbouring samples.
      if (a === b && (k <= i || ARC[a][k] - ARC[a][i] <= 2 * ink)) continue
      const d = Math.hypot(A[i].x - B[k].x, A[i].y - B[k].y) - W[a][i] - W[b][k]
      if (d <= 0) hits.push({ i, k, d })
    }
  }
  if (!hits.length) return []
  hits.sort((p, q) => p.d - q.d)
  const out = []
  for (const h of hits) {
    if (
      out.some(
        (o) =>
          Math.abs(ARC[a][o.i] - ARC[a][h.i]) <= ink && Math.abs(ARC[b][o.k] - ARC[b][h.k]) <= ink,
      )
    )
      continue
    out.push(h)
  }
  return out
}

const rows = []
for (let a = 0; a < strokes.length; a++) {
  const from = has("self") ? a : a + 1
  for (let b = from; b < strokes.length; b++) {
    if (strokes[a].length < 2 || strokes[b].length < 2) continue
    for (const h of runs(a, b)) {
      const under = a === b ? (ARC[a][h.i] < ARC[a][h.k] ? h.i : h.k) : h.i
      const over = a === b ? (ARC[a][h.i] < ARC[a][h.k] ? h.k : h.i) : h.k
      rows.push({
        a,
        b,
        ui: under,
        oi: over,
        x: strokes[a][under].x,
        y: strokes[a][under].y,
        ang: angleAt(strokes[a], under, strokes[b], over),
        sep: h.d,
      })
    }
  }
}

console.log(
  `carve ${carve.toFixed(2)} · ink ${ink.toFixed(2)} · ${rows.length} contact RUNS ` +
    `(${has("self") ? "including" : "excluding"} same-stroke)\n`,
)
const self = rows.filter((r) => r.a === r.b)
const pairs = rows.filter((r) => r.a !== r.b)
const multi = new Map()
for (const r of pairs) multi.set(`${r.a}-${r.b}`, (multi.get(`${r.a}-${r.b}`) ?? 0) + 1)
console.log(
  `  ${pairs.length} between distinct strokes over ${multi.size} pairs — ` +
    `${[...multi.values()].filter((v) => v > 1).length} pair(s) touch in more than one place`,
)
console.log(`  ${self.length} where a stroke crosses ITSELF\n`)

/* ── THE CROSSING TEST, as `findHeroJunctions` runs it ─────────────────────
 * Restated here because `page.tsx` is a React module and `_ts-load.mjs` cannot
 * execute it — the same limitation `_hero-word.mjs` documents, and the same
 * answer: `assertMirrorsGuard` greps the real file and throws if the clauses
 * moved, so a restatement cannot silently drift from its source. It runs on
 * import; there is no way to use this file without it. */
function assertMirrorsGuard() {
  const src = readFileSync(join(ROOT, "app/desk-doodles/page.tsx"), "utf8")
  const want = [
    ["if (!(bEnd > keepOver)) continue", "the over-stroke-is-a-stroke clause"],
    ["const need = 2 * sized(A, ai)", "the far side's bar — the under stroke's own DIAMETER"],
    [
      "comesOut(A, ai, B, outer, need, 1) && comesOut(A, ai, B, outer, need, -1)",
      "the both-sides requirement",
    ],
    ["const outer = keepOver + band", "the band the far side has to clear"],
    ["keep + (carvedHalfWidth(pts, i, R) - keep) * c", "the carve-sized radius"],
  ]
  for (const [needle, what] of want) {
    if (!src.includes(needle))
      throw new Error(
        `_probe-crossing-census: ${what} no longer matches findHeroJunctions ` +
          `(looked for \`${needle}\`). Update this probe; do NOT adjust the measurement.`,
      )
  }
}
assertMirrorsGuard()
function segDist(qx, qy, ax, ay, bx, by) {
  const vx = bx - ax
  const vy = by - ay
  const L = vx * vx + vy * vy
  const t = L > 0 ? Math.max(0, Math.min(1, ((qx - ax) * vx + (qy - ay) * vy) / L)) : 0
  return Math.hypot(ax + t * vx - qx, ay + t * vy - qy)
}
function polylineDist(pts, lo, hi, qx, qy) {
  let best = Infinity
  for (let i = lo; i < hi; i++) {
    const d = segDist(qx, qy, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)
    if (d < best) best = d
  }
  return best
}
/** Does the under stroke leave the band with a stroke's worth of itself left? */
function comesOut(A, ai, B, bLo, bHi, outer, need, sign) {
  let left = null
  let acc = 0
  let k = ai
  for (;;) {
    const n = k + sign
    if (n < 0 || n >= A.length) break
    const seg = Math.hypot(A[n].x - A[k].x, A[n].y - A[k].y)
    const steps = Math.max(1, Math.ceil(seg / 0.5))
    for (let s = 1; s <= steps; s++) {
      const f = s / steps
      const qx = A[k].x + (A[n].x - A[k].x) * f
      const qy = A[k].y + (A[n].y - A[k].y) * f
      if (left === null && polylineDist(B, bLo, bHi, qx, qy) > outer) left = acc + seg * f
    }
    acc += seg
    k = n
    if (left !== null && acc - left >= need) return { out: true, at: left, run: acc - left }
  }
  return { out: false, at: left, run: left === null ? 0 : acc - left }
}
function crossingTest(r) {
  const A = strokes[r.a]
  const B = strokes[r.b]
  const keepUnder = W[r.a][r.ui]
  const keepOver = W[r.b][r.oi]
  const outer = keepOver + Math.max(0, breakK) * ink
  const bEnd = Math.min(ARC[r.b][r.oi], ARC[r.b][ARC[r.b].length - 1] - ARC[r.b][r.oi])
  const cap = !(bEnd > keepOver)
  const p = comesOut(A, r.ui, B, 0, B.length - 1, outer, 2 * keepUnder, 1)
  const m = comesOut(A, r.ui, B, 0, B.length - 1, outer, 2 * keepUnder, -1)
  return { cap, p, m, ok: !cap && p.out && m.out }
}

console.log("   pair    underArc  overArc   angle   sep      comesOut(+/-)   VERDICT")
for (const r of rows) {
  const t = r.a === r.b ? null : crossingTest(r)
  r.verdict = t
  console.log(
    `   ${String(r.a).padStart(2)}-${String(r.b).padEnd(2)}  ` +
      `${ARC[r.a][r.ui].toFixed(1).padStart(8)} ${ARC[r.b][r.oi].toFixed(1).padStart(8)}  ` +
      `${r.ang.toFixed(1).padStart(5)}°  ${r.sep.toFixed(1).padStart(5)}u  ` +
      (t
        ? `${(t.p.out ? t.p.run.toFixed(0) : "—").padStart(5)}/${(t.m.out ? t.m.run.toFixed(0) : "—").padEnd(5)}  ` +
          `${t.ok ? "ADMIT " : "reject"}${t.cap ? " cap" : ""}` +
          `${!t.p.out || !t.m.out ? " no far side" : ""}`
        : "  (self — not expressible through HeroJunctionInput)") +
      `${multi.get(`${r.a}-${r.b}`) > 1 ? "   [2nd contact on this pair]" : ""}`,
  )
}
console.log(
  `\nthe crossing test admits: [` +
    rows
      .filter((r) => r.verdict?.ok)
      .map((r) => `${r.a}-${r.b}`)
      .join(" ") +
    `]`,
)

/* ── AND WHAT IT IS WORTH ON THE PICTURE ───────────────────────────────────
 * The same model `_probe-break-carve.mjs` calibrates against the live gate: the
 * mark rastered from `buildPenField` at the shipped stage scale, the break law
 * intersected with it, the removed set dilated by one pixel to stand in for the
 * shader's coverage. Calibrated there at 6 components UNBROKEN, which is what
 * the live gate reads at K1.
 *
 * The FIELD is built from the real 22 strokes — splitting a stroke is a
 * representational device for the BREAK, not a change to the mark, so the
 * silhouette it cuts is the shipped one. */
const PPU = Number(arg("ppu", "0.5303"))
const MIN_COMPONENT_PX = 40
function rasterAndBreak(breaks) {
  const { buildPenField, samplePenField } = flat
  const field = buildPenField(
    strokes.map((p) => ({ points: p })),
    ink,
  )
  const x0 = field.minX
  const y0 = field.minY
  const Wp = Math.ceil((field.maxX - field.minX) * PPU)
  const Hp = Math.ceil((field.maxY - field.minY) * PPU)
  const base = new Uint8Array(Wp * Hp)
  for (let y = 0; y < Hp; y++)
    for (let x = 0; x < Wp; x++) {
      const f = samplePenField(field, x0 + (x + 0.5) / PPU, y0 + (y + 0.5) / PPU)
      base[y * Wp + x] = f.tube + (f.pen - f.tube) * carve <= 0 ? 1 : 0
    }
  const near = (qx, qy, p) => {
    let best = null
    for (let s = 0; s < 2; s++) {
      const a = p[s]
      const b = p[s + 1]
      const vx = b.x - a.x
      const vy = b.y - a.y
      const L = vx * vx + vy * vy
      const raw = L > 0 ? ((qx - a.x) * vx + (qy - a.y) * vy) / L : 0
      const t = Math.max(0, Math.min(1, raw))
      const px = a.x + t * vx
      const py = a.y + t * vy
      const d = Math.hypot(px - qx, py - qy)
      if (!best || d < best.d) {
        const len = Math.sqrt(L)
        const over = s === 0 ? Math.max(0, -raw) * len : Math.max(0, raw - 1) * len
        best = { x: px, y: py, d, arc: (s === 0 ? (1 - t) * len : t * len) + over }
      }
    }
    return best
  }
  const cut = Uint8Array.from(base)
  for (let y = 0; y < Hp; y++)
    for (let x = 0; x < Wp; x++) {
      const p = y * Wp + x
      if (!cut[p]) continue
      const qx = x0 + (x + 0.5) / PPU
      const qy = y0 + (y + 0.5) / PPU
      for (const b of breaks) {
        const n = near(qx, qy, b.under)
        if (n.d > b.keepUnder || n.arc > b.reach) continue
        const dOver = Math.min(
          segDist(n.x, n.y, b.over[0].x, b.over[0].y, b.over[1].x, b.over[1].y),
          segDist(n.x, n.y, b.over[1].x, b.over[1].y, b.over[2].x, b.over[2].y),
        )
        if (dOver <= b.keepOver || dOver > b.outer) continue
        cut[p] = 0
        break
      }
    }
  // The one-pixel dilation of the REMOVED set — `dilateRemoved`'s calibration.
  const out = Uint8Array.from(cut)
  for (let y = 0; y < Hp; y++)
    for (let x = 0; x < Wp; x++) {
      const p = y * Wp + x
      if (!cut[p] || !base[p]) continue
      for (let dy = -1; dy <= 1 && out[p]; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= Wp || ny >= Hp) continue
          const q = ny * Wp + nx
          if (base[q] && !cut[q]) {
            out[p] = 0
            break
          }
        }
    }
  const comps = (m) => {
    const seen = new Uint8Array(Wp * Hp)
    const st = new Int32Array(Wp * Hp)
    const sizes = []
    for (let s = 0; s < Wp * Hp; s++) {
      if (!m[s] || seen[s]) continue
      let sp = 0
      st[sp++] = s
      seen[s] = 1
      let n = 0
      while (sp > 0) {
        const q = st[--sp]
        n++
        const x = q % Wp
        const y = (q / Wp) | 0
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= Wp || ny >= Hp) continue
            const r = ny * Wp + nx
            if (!m[r] || seen[r]) continue
            seen[r] = 1
            st[sp++] = r
          }
      }
      sizes.push(n)
    }
    sizes.sort((a, b) => b - a)
    return { real: sizes.filter((n) => n >= MIN_COMPONENT_PX), crumbs: sizes.filter((n) => n < MIN_COMPONENT_PX).length }
  }
  let removed = 0
  for (let p = 0; p < base.length; p++) if (base[p] && !out[p]) removed++
  return { before: comps(base), after: comps(out), removed }
}

/* ── WHAT THE LAW WOULD OPEN AT EACH, IF IT COULD BE EXPRESSED ─────────────
 * A self-crossing is not expressible through `HeroJunctionInput`: it carries
 * two STROKE indices and `buildJointBreaks` resolves both samples with
 * `nearestIndex` on those strokes, so `under === over` collapses to one point
 * and the law removes nothing. Modelled here by SPLITTING the stroke at the
 * midpoint between the two arcs, which is what a real fix would have to do
 * somewhere — `lib/flat-ink.ts` and `components/viewport-3d.tsx`, neither of
 * them this lane's file. The number is what says whether that fix is worth
 * dispatching. */
if (has("news")) {
  console.log("\nwhat the law opens, per contact run (carve %s):", carve.toFixed(2))
  const opened = []
  for (const r of rows) {
    let sset = strokes.map((p) => ({ points: p }))
    let u = r.a
    let o = r.b
    void 0
    if (r.a === r.b) {
      const cutAt = Math.floor((r.ui + r.oi) / 2)
      const lo = Math.min(r.ui, r.oi)
      const half1 = strokes[r.a].slice(0, cutAt + 1)
      const half2 = strokes[r.a].slice(cutAt)
      if (half1.length < 2 || half2.length < 2) continue
      sset = [...sset, { points: half1 }, { points: half2 }]
      const earlyIsFirst = lo === r.ui
      u = earlyIsFirst ? sset.length - 2 : sset.length - 1
      o = earlyIsFirst ? sset.length - 1 : sset.length - 2
    }
    const built = buildJointBreaks(
      sset,
      [{ under: u, over: o, x: r.x, y: r.y, gap: Math.max(0, r.sep) }],
      ink,
      breakK,
      carve,
    )
    const b = built.breaks[0]
    /* THE SAME CROSSING TEST, ON THE SPLIT HALVES. A self-crossing is only
     * expressible as two strokes, so it is only TESTABLE as two strokes — and
     * running the shipped guard on that representation is what says whether the
     * lever is worth dispatching or is another 18->20. */
    let pass = true
    if (r.a === r.b && b) {
      const A = sset[u].points
      const B = sset[o].points
      let ai = 0
      let bd = Infinity
      for (let i = 0; i < A.length; i++) {
        const d = (A[i].x - r.x) ** 2 + (A[i].y - r.y) ** 2
        if (d < bd) {
          bd = d
          ai = i
        }
      }
      const keepOver = W[r.b][r.oi]
      const keepUnder = W[r.a][r.ui]
      const outer = keepOver + Math.max(0, breakK) * ink
      const arcB = []
      let acc = 0
      for (let i = 0; i < B.length; i++) {
        if (i) acc += Math.hypot(B[i].x - B[i - 1].x, B[i].y - B[i - 1].y)
        arcB.push(acc)
      }
      let bi = 0
      bd = Infinity
      for (let i = 0; i < B.length; i++) {
        const d = (B[i].x - r.x) ** 2 + (B[i].y - r.y) ** 2
        if (d < bd) {
          bd = d
          bi = i
        }
      }
      const bEnd = Math.min(arcB[bi], acc - arcB[bi])
      const need = 2 * keepUnder
      pass =
        bEnd > keepOver &&
        comesOut(A, ai, B, 0, B.length - 1, outer, need, 1).out &&
        comesOut(A, ai, B, 0, B.length - 1, outer, need, -1).out
    }
    if (b && pass) opened.push({ r, b: { ...b, reach: built.reach } })
    if (b && !pass) r.guardRejected = true
    console.log(
      `   ${String(r.a).padStart(2)}-${String(r.b).padEnd(2)}${r.a === r.b ? " SELF" : "     "} ` +
        `${r.ang.toFixed(0).padStart(3)}°  ` +
        (b
          ? `cut ${b.cut.toFixed(1).padStart(5)}u  behind ${b.behind.toFixed(1).padStart(5)}u  ` +
            `ratio ${((b.cut * b.keepOver) / Math.max(1e-6, b.behind * built.gap)).toFixed(2)}`
          : "dropped by the law") +
        (r.guardRejected ? "   ← the crossing test REJECTS it" : ""),
    )
  }
  if (has("raster")) {
    /* THE SELF-CROSSINGS ALONE, ON THE PICTURE. Not the whole population — the
     * distinct-pair set is already decided by `findHeroJunctions`; this is the
     * lever that is currently unreachable, priced on its own so it can be
     * dispatched or dropped on its own. */
    const self = opened.filter((o) => o.r.a === o.r.b).map((o) => o.b)
    const one = rasterAndBreak(self)
    console.log(
      `\nSELF-CROSSINGS ON THE CARVED MARK (${self.length} breaks, ` +
        `${self.reduce((a, b) => a + b.cut, 0).toFixed(1)}u of centreline):\n` +
        `   components ${one.before.real.length} -> ${one.after.real.length}` +
        `${one.after.real.length === one.before.real.length ? "  ✓ assembled" : "  ✗ DAMAGE"}` +
        `  · crumbs ${one.before.crumbs} -> ${one.after.crumbs}` +
        `  · ${one.removed} px of paper opened\n` +
        `   [${one.after.real.join(", ")}]`,
    )
    const seven = opened
      .filter((o) => o.r.a === 7 && o.r.b === 8)
      .map((o) => o.b)
    const both = rasterAndBreak([...self, ...seven])
    console.log(
      `\nSELF-CROSSINGS + 7->8, i.e. what K7 could carry:\n` +
        `   components ${both.before.real.length} -> ${both.after.real.length}` +
        `${both.after.real.length === both.before.real.length ? "  ✓ assembled" : "  ✗ DAMAGE"}` +
        `  · crumbs ${both.before.crumbs} -> ${both.after.crumbs}` +
        `  · ${both.removed} px of paper opened, against the gate's 200 px floor`,
    )
  }
}
