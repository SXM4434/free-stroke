// WHAT THE FAR-SIDE CLAUSE ACTUALLY SEES AT EVERY ADMITTED DISTINCT PAIR.
//
// `findHeroJunctions`'s guard admits 18->19, and 18->19 chops the top-right
// terminal off the final `s` of *Doodles* — 112 px adrift on the live page
// (`_probe-lane31-ofat.mjs`), photographed at 5x at
// `docs/verification/hero-k7/lane31/s1819-x5.png`. The break law's own two drop
// rules pass it honestly, so the question is what the SET's guard is looking at
// when it lets it through.
//
// ⚠ THIS IS A MIRROR OF `page.tsx`'s TEST AND IT IS A PROBE, NEVER A LAW. A
// second implementation that agrees with a bug is this repo's most expensive
// defect class, so the mirror is not trusted on its word: it recomputes the
// WHOLE junction set and refuses to print a diagnostic unless the set it
// produces is identical, pair for pair, to the one the page published. If the
// page's law changes and this drifts, the run fails loudly instead of reporting
// a confidently wrong number.
import { chromium } from "./lib/browser.mjs"
import { loadTs } from "./_ts-load.mjs"
import { HERO_URL } from "./lib/dev-server.mjs"

const flat = loadTs("lib/flat-ink.ts")
const { JOINT_BREAK_REACH_K, JOINT_BREAK_KEEP_K, carvedHalfWidth } = flat
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const CARVE = Number(arg("carve", "1"))

const arcLengths = (p) => {
  const a = [0]
  for (let i = 1; i < p.length; i++)
    a.push(a[i - 1] + Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y))
  return a
}
const segD = (px, py, ax, ay, bx, by) => {
  const vx = bx - ax
  const vy = by - ay
  const L = vx * vx + vy * vy
  const t = L > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / L)) : 0
  return Math.hypot(ax + t * vx - px, ay + t * vy - py)
}
const polyD = (P, x, y) => {
  if (P.length === 1) return Math.hypot(P[0].x - x, P[0].y - y)
  let b = Infinity
  for (let i = 0; i + 1 < P.length; i++) {
    const d = segD(x, y, P[i].x, P[i].y, P[i + 1].x, P[i + 1].y)
    if (d < b) b = d
  }
  return b
}
/**
 * `comesOut`, instrumented and RUN TO THE END OF THE STROKE.
 *
 * ⚠ `comesOut` short-circuits the moment `acc - left >= need`, so its own
 * `after` is never more than one segment past the bar and cannot separate a
 * junction that clears it by a hair from one that clears it by four times over.
 * `free` is the whole tail — from where the stroke leaves the band to where the
 * stroke ends — which is the length of the piece the break actually leaves
 * behind, and it is the number the picture is a picture of.
 */
function walk(A, i, B, outer, need, sign) {
  let left = null
  let acc = 0
  let k = i
  let ok = false
  for (;;) {
    const n = k + sign
    if (n < 0 || n >= A.length) break
    const seg = Math.hypot(A[n].x - A[k].x, A[n].y - A[k].y)
    const steps = Math.max(1, Math.ceil(seg / 0.5))
    for (let s = 1; s <= steps && left === null; s++) {
      const f = s / steps
      if (polyD(B, A[k].x + (A[n].x - A[k].x) * f, A[k].y + (A[n].y - A[k].y) * f) > outer)
        left = acc + seg * f
    }
    acc += seg
    k = n
    if (left !== null && acc - left >= need) ok = true
  }
  return { ok, left, free: left === null ? 0 : acc - left, acc }
}
/** Angle between the two tangents at the contact, degrees, folded to 0..90. */
function crossAngle(A, ai, B, bi) {
  const t = (P, i) => {
    const a = P[Math.max(0, i - 1)]
    const b = P[Math.min(P.length - 1, i + 1)]
    return Math.atan2(b.y - a.y, b.x - a.x)
  }
  let d = ((t(A, ai) - t(B, bi)) * 180) / Math.PI
  d = Math.abs(((d % 180) + 180) % 180)
  return d > 90 ? 180 - d : d
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1440 } })
const page = await ctx.newPage()
await page.addInitScript((c) => {
  window.__heroCarveAmount = c
}, CARVE)
await page.goto(HERO_URL, {
  waitUntil: "networkidle",
})
await page.waitForFunction(() => window.__captureHarness && window.__heroJunctions, null, {
  timeout: 90000,
})
await page.waitForTimeout(2500)
const data = await page.evaluate(() => ({
  inkWidth: window.__heroJunctions.inkWidth,
  breakK: window.__heroJunctions.breakK,
  law: window.__heroJunctions.law,
  carve: window.__heroJunctions.carve,
  list: window.__heroJunctions.list,
  strokes: window.__handFeelHarness.processed.map((st) => st.map((p) => ({ x: p[0], y: p[1] }))),
}))
await browser.close()

const S = data.strokes
const inkD = data.inkWidth
const reach = JOINT_BREAK_REACH_K * inkD
const keep = (JOINT_BREAK_KEEP_K * inkD) / 2
const c = Math.max(0, Math.min(1, data.carve))
const R = inkD / 2
const band = Math.max(0, data.breakK) * inkD
const sized = (pts, i) => keep + (carvedHalfWidth(pts, i, R) - keep) * c

const rows = []
const mine = []
for (let a = 0; a < S.length; a++)
  for (let b = a + 1; b < S.length; b++) {
    const A = S[a]
    const B = S[b]
    let best = Infinity
    let bx = 0
    let by = 0
    let ai = 0
    let bk = 0
    let bt = 0
    for (let i = 0; i < A.length; i++)
      for (let k = 0; k + 1 < B.length || (B.length === 1 && k === 0); k++) {
        let d
        let t = 0
        if (B.length === 1) d = Math.hypot(A[i].x - B[0].x, A[i].y - B[0].y)
        else {
          const vx = B[k + 1].x - B[k].x
          const vy = B[k + 1].y - B[k].y
          const L = vx * vx + vy * vy
          t = L > 0 ? Math.max(0, Math.min(1, ((A[i].x - B[k].x) * vx + (A[i].y - B[k].y) * vy) / L)) : 0
          d = Math.hypot(B[k].x + t * vx - A[i].x, B[k].y + t * vy - A[i].y)
        }
        if (d < best) {
          best = d
          bx = A[i].x
          by = A[i].y
          ai = i
          bk = k
          bt = t
        }
        if (B.length === 1) break
      }
    if (!(best < inkD)) continue
    const aa = arcLengths(A)
    const ba = arcLengths(B)
    const aLen = aa[aa.length - 1]
    const bLen = ba[ba.length - 1]
    const aAt = aa[ai]
    const bAt = B.length > 1 ? ba[bk] + bt * (ba[bk + 1] - ba[bk]) : 0
    const bEnd = Math.min(bAt, bLen - bAt)
    let bi = 0
    let bd = Infinity
    for (let i = 0; i < B.length; i++) {
      const d = (B[i].x - bx) ** 2 + (B[i].y - by) ** 2
      if (d < bd) {
        bd = d
        bi = i
      }
    }
    const keepOver = sized(B, bi)
    const outer = keepOver + band
    const capOk = bEnd > keepOver
    const need = 2 * sized(A, ai)
    const fwd = walk(A, ai, B, outer, need, 1)
    const bwd = walk(A, ai, B, outer, need, -1)
    const admitted = capOk && fwd.ok && bwd.ok
    if (admitted) mine.push(`${a}-${b}`)
    rows.push({
      a, b, best, aAt, aLen, bAt, bLen, bEnd, keepOver, outer, need, capOk, fwd, bwd, admitted,
      ang: crossAngle(A, ai, B, bi),
    })
  }

const pagePairs = data.list.filter((j) => j.under !== j.over).map((j) => `${j.under}-${j.over}`)
const same =
  pagePairs.length === mine.length && pagePairs.every((p, i) => p === mine[i])
console.log(`law ${data.law} · carve ${data.carve} · ink ${inkD.toFixed(2)} · reach ${reach.toFixed(1)} · band ${band.toFixed(1)}`)
console.log(`page distinct pairs: ${pagePairs.join(" ")}`)
console.log(`mirror            : ${mine.join(" ")}`)
if (!same) {
  console.error("MIRROR DISAGREES WITH THE PAGE — refusing to print a diagnostic.")
  process.exit(2)
}
console.log("mirror reproduces the page's distinct-pair set exactly.\n")
console.log(
  "pair    gap   ang   aAt/aLen      bEnd  keepOver  need   reach   " +
    "fwd free   bwd free   admitted",
)
for (const r of rows) {
  const f = (w) => `${w.ok ? " " : "x"}${w.free.toFixed(1).padStart(7)}`
  console.log(
    `${`${r.a}-${r.b}`.padEnd(7)}${r.best.toFixed(1).padStart(5)}` +
      `${r.ang.toFixed(0).padStart(5)}°  ` +
      `${r.aAt.toFixed(0).padStart(4)}/${r.aLen.toFixed(0).padEnd(5)}` +
      `${r.bEnd.toFixed(1).padStart(7)}${r.keepOver.toFixed(1).padStart(9)}` +
      `${r.need.toFixed(1).padStart(7)}${reach.toFixed(1).padStart(8)}   ` +
      `${f(r.fwd)}   ${f(r.bwd)}    ` +
      `${r.admitted ? "YES" : r.capOk ? "no(farside)" : "no(cap)"}`,
  )
}
