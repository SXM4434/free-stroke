// WHAT SHAPE CAN K7's NEWS ACTUALLY TAKE ON THIS WORD — measured before it is built.
//
// `_probe-hero-junctions.mjs` settled WHERE the news lives (22 stroke junctions,
// one true centreline crossing). It does not say what a break at one of them
// LOOKS like, and the renderer's mechanism depends entirely on that.
//
// THE LAW BEING MEASURED, and it is the one the shader ships:
//
//   Inside a disc of radius R about the junction, DISCARD every fragment whose
//   distance to the OVER stroke's centreline lies in (inner, outer], where
//   inner = the ink RADIUS and outer = inner + breakK x ink diameter.
//
//   * d <= inner  is the over stroke's own tube — KEPT, so the later stroke
//     passes through unbroken. This is the half that makes it an over/under
//     rather than a hole.
//   * d in (inner, outer]  is a band of paper hugging the over stroke — every
//     earlier stroke's ink in it is removed, and so is the implicit surface's
//     FILLET, which is the thing that was hiding the junction in the first
//     place.
//   * d > outer  is untouched, so the under stroke RESUMES. A break with ink on
//     both sides of it, which is what reads as a lift rather than as damage.
//
// The first draft of this probe measured the OPPOSITE band (keep the middle,
// cut outside) and reported cut-len 0.0 on 22 of 22 junctions. That was right,
// and it is why this file exists: a perpendicular band cannot separate the two
// strokes at a crossing, because at the crossing they occupy the same band. The
// separation has to come from the RADIAL distance to the stroke in front.
//
// Everything here is read off the page's OWN published data — the junction set
// (`window.__heroJunctions`) and the processed strokes
// (`window.__handFeelHarness.processed`). Nothing is re-derived.
//
// Usage: node scripts/verify/_probe-hero-breaks.mjs [--r=1.25] [--breakK=0.35]
import { chromium } from "./lib/browser.mjs"
import { HERO_URL } from "./lib/dev-server.mjs"

const URL = HERO_URL
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? Number(hit.split("=")[1]) : d
}
/** Disc radius, in ink diameters. The renderer's `BREAK_DISC_K`. */
const R_K = arg("r", 1.25)
const BREAK_K_OVERRIDE = arg("breakK", null)
/** Second half of the law: the cut must also lie ON the under stroke.
 *  `none` = the first draft (band only) · `inner` = inside the under tube ·
 *  `outer` = inside the under tube plus the same paper margin (catches the
 *  implicit surface's own fillet, which is what was hiding the junction). */
const UNDER_GATE = (process.argv.find((a) => a.startsWith("--under=")) ?? "--under=outer").split("=")[1]

function nearestIndex(pts, x, y) {
  let bi = 0
  let bd = Infinity
  for (let i = 0; i < pts.length; i++) {
    const d = (pts[i].x - x) ** 2 + (pts[i].y - y) ** 2
    if (d < bd) {
      bd = d
      bi = i
    }
  }
  return { i: bi, d: Math.sqrt(bd) }
}

function tangentAt(pts, i) {
  const a = pts[Math.max(0, i - 2)]
  const b = pts[Math.min(pts.length - 1, i + 2)]
  const dx = b.x - a.x
  const dy = b.y - a.y
  const L = Math.hypot(dx, dy) || 1
  return { x: dx / L, y: dy / L }
}

/** Arc-length walk out from index i, returning the point R units away. */
function walk(pts, i, dist, sign) {
  let acc = 0
  let k = i
  while (acc < dist) {
    const n = k + sign
    if (n < 0 || n >= pts.length) break
    acc += Math.hypot(pts[n].x - pts[k].x, pts[n].y - pts[k].y)
    k = n
  }
  return pts[k]
}

function distToPolyline(q, poly) {
  let best = Infinity
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1]
    const b = poly[i]
    const vx = b.x - a.x
    const vy = b.y - a.y
    const L = vx * vx + vy * vy
    const t = L > 0 ? Math.max(0, Math.min(1, ((q.x - a.x) * vx + (q.y - a.y) * vy) / L)) : 0
    const d = Math.hypot(a.x + t * vx - q.x, a.y + t * vy - q.y)
    if (d < best) best = d
  }
  return best
}

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 1440 } })
  const page = await context.newPage()
  await page.goto(URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__heroJunctions && window.__handFeelHarness, null, {
    timeout: 90000,
  })
  const data = await page.evaluate(() => ({
    j: window.__heroJunctions,
    processed: window.__handFeelHarness.processed,
  }))
  await browser.close()

  const ink = data.j.inkWidth
  const breakK = BREAK_K_OVERRIDE ?? data.j.breakK
  const list = data.j.list
  const strokes = data.processed.map((s) => s.map(([x, y]) => ({ x, y })))

  const R = R_K * ink
  const inner = ink / 2
  const outer = inner + breakK * ink

  console.log(
    `ink ${ink.toFixed(2)} units · ${strokes.length} strokes · ${list.length} junctions · ` +
      `breakK ${breakK} · R ${R.toFixed(2)} (${R_K} ink) · band (${inner.toFixed(2)}, ${outer.toFixed(2)}] · under-gate ${UNDER_GATE}`,
  )
  console.log(`paper gap either side of the stroke in front: ${(outer - inner).toFixed(2)} units\n`)

  let empty = 0
  let laterHit = 0
  const rows = []
  for (const jn of list) {
    const A = strokes[jn.under]
    const B = strokes[jn.over]
    const ai = nearestIndex(A, jn.x, jn.y)
    const bi = nearestIndex(B, jn.x, jn.y)
    const ta = tangentAt(A, ai.i)
    const tb = tangentAt(B, bi.i)
    const angle = (Math.acos(Math.min(1, Math.abs(ta.x * tb.x + ta.y * tb.y))) * 180) / Math.PI

    // The 3-point over-stroke sample the shader gets, spanning +/- R.
    const centre = B[bi.i]
    const poly = [walk(B, bi.i, R, -1), centre, walk(B, bi.i, R, +1)]

    // How much of the UNDER stroke's centreline falls in the cut band. Walked at
    // 0.5-unit steps so a short crossing is not missed by point spacing.
    // The UNDER stroke's own 3-point sample — the second half of the law.
    const underPoly = [walk(A, ai.i, R, -1), A[ai.i], walk(A, ai.i, R, +1)]
    const sample = (pts, from) => {
      let cut = 0
      let inDisc = 0
      for (let i = 1; i < pts.length; i++) {
        const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
        const n = Math.max(1, Math.ceil(seg / 0.5))
        for (let k = 0; k < n; k++) {
          const f = (k + 0.5) / n
          const q = {
            x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f,
            y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f,
          }
          if (Math.hypot(q.x - centre.x, q.y - centre.y) >= R) continue
          inDisc += seg / n
          const d = distToPolyline(q, poly)
          if (!(d > inner && d <= outer)) continue
          if (UNDER_GATE !== "none") {
            const du = distToPolyline(q, underPoly)
            if (du > (UNDER_GATE === "inner" ? inner : outer)) continue
          }
          cut += seg / n
        }
      }
      return { cut, inDisc, from }
    }

    const self = sample(A, jn.under)
    // SAFETY: does this junction's band also cut a stroke drawn AFTER the one in
    // front? That would put an earlier stroke over a later one, which is the
    // exact claim the news makes and would be a lie.
    let later = 0
    for (let s = jn.over + 1; s < strokes.length; s++) later += sample(strokes[s], s).cut
    if (self.cut <= 0.01) empty++
    if (later > 0.5) laterHit++
    rows.push({ ...jn, angle, cut: self.cut, inDisc: self.inDisc, later })
  }

  rows.sort((a, b) => a.cut - b.cut)
  console.log("under over    gap   angle°   in-disc    cut-len   later-cut")
  for (const r of rows) {
    console.log(
      `${String(r.under).padStart(5)}${String(r.over).padStart(5)}` +
        `${r.gap.toFixed(2).padStart(8)}${r.angle.toFixed(1).padStart(9)}` +
        `${r.inDisc.toFixed(1).padStart(10)}${r.cut.toFixed(1).padStart(11)}` +
        `${r.later.toFixed(1).padStart(12)}`,
    )
  }
  const cuts = rows.map((r) => r.cut)
  const med = [...cuts].sort((a, b) => a - b)[cuts.length >> 1]
  console.log(
    `\ncut length on the under stroke: min ${Math.min(...cuts).toFixed(1)} · median ${med.toFixed(1)} · max ${Math.max(...cuts).toFixed(1)} units` +
      `  (ink diameter ${ink.toFixed(1)})`,
  )
  console.log(`junctions that open NOTHING:            ${empty} of ${rows.length}`)
  console.log(`junctions whose band cuts a LATER stroke: ${laterHit} of ${rows.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
