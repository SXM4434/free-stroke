// PROBE — how fast the hand actually writes, at a given `beats.draw`.
//
// Measured THROUGH THE LIVE CHAIN, not by arc-length share: the playhead is
// warped by `drawEase(t, drawLinearBlend)` and then mapped onto the pen's own
// recorded timing by `revealDistanceFraction(..., "hybrid", 0.4)` — the shipped
// defaults, read off `components/viewport-3d.tsx:4187-4188`. An arc-length share
// would describe a beat nobody renders.
//
// Strokes come from `_hero-word.mjs`, which calls the page's own
// `stampPenClock` + `processStroke` and throws if the page's settings move.
//
// Usage: node scripts/verify/_probe-hero-drawspeed.mjs [seconds ...]
import { loadTs } from "./_ts-load.mjs"
import { processedHeroStrokes } from "./_hero-word.mjs"

const { DEFAULT_HERO_MOTION, drawEase, sampleHeroMotion, totalDuration, phaseOffsets } =
  loadTs("lib/hero-motion.ts")
const { revealDistanceFraction } = loadTs("lib/pen-reveal.ts")

const MODE = "hybrid"
const BLEND = 0.4
const strokes = processedHeroStrokes()

/** Cumulative arc length, per stroke, as a fraction of the whole word. */
function strokeSpans(ss) {
  const lens = ss.map((s) => {
    let L = 0
    for (let i = 1; i < s.points.length; i++) {
      const a = s.points[i - 1]
      const b = s.points[i]
      L += Math.hypot(b.x - a.x, b.y - a.y)
    }
    return L
  })
  const total = lens.reduce((a, b) => a + b, 0)
  const spans = []
  let acc = 0
  for (const L of lens) {
    spans.push({ from: acc / total, to: (acc + L) / total, lenFrac: L / total })
    acc += L
  }
  return { spans, total }
}

const { spans, total } = strokeSpans(strokes)

/* ---- THE RECORD, as distinct from what renders ----------------------------
 * Two different medians are in circulation for this beat and they are both
 * real. This is the first one: the pen's OWN recorded stroke durations, scaled
 * by the speed-up the beat asks for. It answers *"how much faster than the real
 * hand"*. It is NOT what appears on screen, because the shipped reveal is
 * `hybrid` at 0.4 — 40% of the mapping is constant speed, which lengthens the
 * strokes the hand rushed and shortens the ones it laboured over. */
const recorded = strokes.map((s) => {
  const ts = s.points.map((p) => p.t).filter((t) => typeof t === "number")
  return ts.length > 1 ? ts[ts.length - 1] - ts[0] : 0
})
const recordedTotal = Math.max(
  ...strokes.map((s) => s.points[s.points.length - 1]?.t ?? 0),
) - Math.min(...strokes.map((s) => s.points[0]?.t ?? 0))

function medianOf(a) {
  const s = [...a].sort((x, y) => x - y)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

/** The playhead at which the reveal reaches a given distance fraction. */
function timeAtDistance(P, target, drawSec) {
  const N = 20000
  let lo = 0
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const d = revealDistanceFraction(strokes, drawEase(t, P.drawLinearBlend), MODE, BLEND)
    if (d >= target) return lo + ((t - lo) / 2)
    lo = t
  }
  return 1
}

function table(drawSec) {
  const P = { ...DEFAULT_HERO_MOTION, beats: { ...DEFAULT_HERO_MOTION.beats, draw: drawSec } }
  const durs = spans.map((s) => {
    const t0 = timeAtDistance(P, s.from, drawSec)
    const t1 = timeAtDistance(P, s.to, drawSec)
    return (t1 - t0) * drawSec * 1000
  })
  const sorted = [...durs].sort((a, b) => a - b)
  const median =
    sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2

  // Read stillness, off the model, the way `assert-hero-ledger` reads it.
  const KEYS = ["az","el","fill","flat","depth","yaw","shade","shadow","jointBreak","reveal","squashX","squashY"]
  const sig = (s) => KEYS.map((k) => s[k]).join("|")
  const fps = P.fps
  const n = Math.round(totalDuration(P) * fps)
  const rows = []
  for (let i = 0; i < n; i++) rows.push(sampleHeroMotion(P, i / fps))
  let repeats = 0
  for (let i = 1; i < rows.length; i++) if (sig(rows[i]) === sig(rows[i - 1])) repeats++

  const scale = recordedTotal > 0 ? drawSec / recordedTotal : 0
  return {
    drawSec,
    frames: Math.round(drawSec * fps),
    shortest: sorted[0],
    median,
    longest: sorted[sorted.length - 1],
    under100: durs.filter((d) => d < 100).length,
    recMedian: medianOf(recorded) * scale * 1000,
    recShortest: Math.min(...recorded) * scale * 1000,
    beat: totalDuration(P),
    stillPct: (100 * repeats) / n,
    repeats,
    n,
  }
}

const args = process.argv.slice(2).map(Number).filter((n) => n > 0)
const CASES = args.length ? args : [64 / 30, 4.6667, 6.97, 140 / 30]

console.log(
  `${strokes.length} strokes, ${total.toFixed(0)} units of arc length, ` +
    `reveal "${MODE}" blend ${BLEND}, drawLinearBlend ${DEFAULT_HERO_MOTION.drawLinearBlend}\n`,
)
console.log(
  // `Point.t` is stamped in MILLISECONDS by `stampPenClock`.
  `  the pen's own recording is ${(recordedTotal / 1000).toFixed(3)}s long; its median stroke is ` +
    `${medianOf(recorded).toFixed(1)}ms and its shortest ${Math.min(...recorded).toFixed(1)}ms\n`,
)
console.log(
  "  beats.draw   fr   ON SCREEN: shortest  median  longest  under100 |  RECORD x speedup: shortest  median  |  beat     read still",
)
for (const s of CASES) {
  const r = table(s)
  console.log(
    `  ${r.drawSec.toFixed(3)}s     ${String(r.frames).padStart(3)}   ` +
      `${r.shortest.toFixed(1).padStart(15)}ms ${r.median.toFixed(1).padStart(7)}ms ` +
      `${r.longest.toFixed(0).padStart(6)}ms  ${String(r.under100).padStart(2)} of ${strokes.length} | ` +
      `${r.recShortest.toFixed(1).padStart(21)}ms ${r.recMedian.toFixed(1).padStart(7)}ms  | ` +
      `${r.beat.toFixed(2)}s   ${r.stillPct.toFixed(1)}%  (${r.repeats}/${r.n})`,
  )
}
console.log(
  `\n  TWO MEDIANS, BOTH REAL, AND THEY ARE NOT THE SAME CLAIM.` +
    `\n  ON SCREEN is what draws: the playhead through \`drawEase\` and then through` +
    `\n  \`revealDistanceFraction(..., "hybrid", 0.4)\`. RECORD x SPEEDUP is the pen's own` +
    `\n  timing scaled by the speed-up the beat asks for, which answers "how much faster than` +
    `\n  the real hand" and NOT "what is on screen". The shipped reveal blends 40% toward` +
    `\n  constant speed, so it lengthens the strokes the hand rushed — which is why the` +
    `\n  on-screen median runs well above the record's.` +
    `\n\n  "read still" counts frames identical to the frame before them over the WHOLE beat —` +
    `\n  the same signature \`assert-hero-ledger\` uses, minus its authored-hold accounting, so it` +
    `\n  is a floor rather than that file's figure. Take the ledger's number as the verdict.`,
)
