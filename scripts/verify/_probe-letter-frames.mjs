// WHAT THE EYE ACTUALLY GETS OF ONE FLIP — every 30fps frame of it, printed.
//
// The complaint is "it flips so ugly and abrupt". A flip's ugliness is its
// SPACING: how many frames it is sampled over, how far the yaw moves between
// two of them, and whether the ink->solid swap happens where the letter is a
// sliver or where it is full width. All four are printable.
import { loadTs } from "./_ts-load.mjs"
const M = loadTs("lib/hero-motion.ts")
const { DEFAULT_HERO_MOTION, HERO_SHEETS, sampleLetters, sampleEmerge, cascadeSec, phaseOffsets } = M

const P = { ...DEFAULT_HERO_MOTION, shape: "letterByLetter", beats: HERO_SHEETS.letterByLetter }
const FPS = P.fps
const off = phaseOffsets(P)

function series(p, n, label) {
  const pp = { ...p, letterCount: n }
  const start = phaseOffsets(pp).emerge
  const total = Math.round(pp.beats.emerge * FPS)
  const rows = []
  for (let f = 0; f <= total; f++) rows.push({ f, ls: sampleLetters(pp, start + f / FPS) })
  console.log(`\n=== ${label} — ${n} letters, cascade ${cascadeSec(pp).toFixed(3)}s = ${(cascadeSec(pp) * FPS).toFixed(1)} fr, clip ${total} fr ${cascadeSec(pp) * FPS > total ? "❌ OVERRUNS" : "✓ fits"} ===`)
  for (let li = 0; li < n; li++) {
    const moving = rows.filter((r) => {
      const s = r.ls[li]
      return s && !(s.yaw === 0 && s.flat === 1) && !(s.flat === 0 && Math.abs(s.yaw - Math.max(0, pp.letterLandYaw) * Math.PI / 180) < 1e-9)
    })
    if (moving.length === 0) { console.log(`  L${li}: NO MOVING FRAME`); continue }
    const f0 = moving[0].f, f1 = moving[moving.length - 1].f
    const seq = []
    let prevYaw = null, maxStep = 0, minSx = 1, sxAtSwap = null, prevFlat = null
    for (let f = f0 - 1; f <= f1 + 1; f++) {
      const r = rows.find((x) => x.f === f); if (!r) continue
      const s = r.ls[li]; if (!s) continue
      const deg = (s.yaw * 180) / Math.PI
      const sx = Math.abs(Math.cos(s.yaw))
      if (prevYaw !== null) maxStep = Math.max(maxStep, Math.abs(deg - prevYaw))
      if (prevFlat !== null && prevFlat !== s.flat) sxAtSwap = Math.max(sx, Math.abs(Math.cos((prevYaw * Math.PI) / 180)))
      minSx = Math.min(minSx, sx)
      seq.push(`${deg.toFixed(0)}°/${s.flat}`)
      prevYaw = deg; prevFlat = s.flat
    }
    console.log(
      `  L${li}: fr ${String(f0).padStart(3)}-${String(f1).padStart(3)} (${f1 - f0 + 1} fr)` +
      `  maxStep ${maxStep.toFixed(1)}°  narrowest sx ${minSx.toFixed(3)}` +
      `  ink→solid at sx ${sxAtSwap === null ? "n/a" : sxAtSwap.toFixed(3)}`)
    console.log(`        ${seq.join(" ")}`)
  }
}

series(P, 6, "AS IT RENDERS TODAY (traced, processed)")
series(P, 8, "the model default on record")
series({ ...P, letterSilentAfter: 2 }, 10, "SPLIT: the hand's 10 units")

/* ---- and the whole-word turn, the thing that reads well -------------------- */
console.log(`\n=== THE WHOLE-WORD TURN, for comparison (standTurn's orbit) ===`)
const W = { ...DEFAULT_HERO_MOTION, shape: "turnLands", beats: HERO_SHEETS.standTurn }
const ws = phaseOffsets(W).emerge
const N = Math.round(W.beats.emerge * FPS) + Math.round(W.beats.solid * FPS) + Math.round(W.beats.orbit * FPS)
let prev = null, ms = 0, seq = []
for (let f = 0; f <= N; f++) {
  const s = sampleEmerge(W, ws + f / FPS)
  const deg = (s.yaw * 180) / Math.PI
  if (deg > 0.01 || (prev !== null && prev > 0.01)) {
    if (prev !== null) ms = Math.max(ms, Math.abs(deg - prev))
    seq.push(`${deg.toFixed(0)}°/${s.flat.toFixed(0)}`)
  }
  prev = deg
}
console.log(`  ${seq.length} frames, maxStep ${ms.toFixed(1)}°`)
console.log(`  ${seq.join(" ")}`)
