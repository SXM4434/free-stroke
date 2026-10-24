// RE-CUTTING THE CASCADE'S BUDGET, against the whole-word turn as the bar.
//
// The whole-word turn reads well and is 13 turn frames + a 2-frame dwell, with a
// largest single-frame step of 29.8deg. A letter's quick flip is 8.75 frames —
// NOT AN INTEGER — minus a 1-frame pin, and its largest step runs to 50.9deg.
// Worse, 8.75 and an interval of 13.8 frames mean every letter's flip is sampled
// at a DIFFERENT sub-frame phase, so the same event has a different shape each
// time it happens. That is a budget fact, printed here so the re-cut is chosen
// rather than tuned.
import { loadTs } from "./_ts-load.mjs"
const { DEFAULT_HERO_MOTION, HERO_SHEETS, sampleLetters, cascadeSec, phaseOffsets } = loadTs("lib/hero-motion.ts")
const FPS = DEFAULT_HERO_MOTION.fps

function flipShape(p, li, n) {
  const pp = { ...p, letterCount: n }
  const start = phaseOffsets(pp).emerge
  const total = Math.round(pp.beats.emerge * FPS) + 200
  const land = Math.max(0, pp.letterLandYaw) * Math.PI / 180
  const seq = []
  for (let f = 0; f <= total; f++) {
    const s = sampleLetters(pp, start + f / FPS)?.[li]
    if (!s) continue
    const rest = s.yaw === 0 && s.flat === 1
    const done = s.flat === 0 && Math.abs(s.yaw - land) < 1e-9
    seq.push({ f, deg: (s.yaw * 180) / Math.PI, flat: s.flat, sx: Math.abs(Math.cos(s.yaw)), rest, done })
  }
  const i0 = seq.findIndex((r) => !r.rest)
  let i1 = i0
  while (i1 < seq.length - 1 && !seq[i1].done) i1++
  const win = seq.slice(Math.max(0, i0 - 1), i1 + 1)
  let maxStep = 0, swapSx = null, minSx = 1
  for (let i = 1; i < win.length; i++) {
    maxStep = Math.max(maxStep, Math.abs(win[i].deg - win[i - 1].deg))
    if (win[i].flat !== win[i - 1].flat) swapSx = Math.max(win[i].sx, win[i - 1].sx)
    minSx = Math.min(minSx, win[i].sx)
  }
  return { frames: win.length, maxStep, swapSx, minSx, seq: win.map((r) => `${r.deg.toFixed(0)}/${r.flat}`).join(" ") }
}

const N = 10
console.log(`flipFr  intFr  cascade(fr)  maxStep(worst)  swapSx(worst)  shapes identical across letters?`)
for (const flipFr of [9, 10, 11, 12, 13, 14]) {
  for (const intFr of [14, 15, 16, 17, 18]) {
    if (flipFr / intFr > 0.85) continue
    const p = {
      ...DEFAULT_HERO_MOTION, shape: "letterByLetter", beats: HERO_SHEETS.letterByLetter,
      letterCount: N, letterSilentAfter: 2, letterPairFrom: -1,
      letterQuickSec: flipFr / FPS, letterBeatSec: intFr / FPS, letterLeadSec: 20 / FPS,
    }
    const shapes = []
    for (let li = 1; li < N; li++) shapes.push(flipShape(p, li, N))
    const worstStep = Math.max(...shapes.map((s) => s.maxStep))
    const worstSwap = Math.max(...shapes.map((s) => s.swapSx ?? 0))
    const same = new Set(shapes.map((s) => s.seq)).size === 1
    console.log(
      `  ${String(flipFr).padStart(2)}     ${String(intFr).padStart(2)}      ${cascadeSec(p) * FPS >= 1 ? (cascadeSec(p) * FPS).toFixed(0).padStart(4) : "  -"}` +
      `        ${worstStep.toFixed(1).padStart(5)}°         ${worstSwap.toFixed(3)}        ${same ? "YES" : `no (${new Set(shapes.map((s) => s.seq)).size} variants)`}`)
  }
}

console.log(`\n--- the one flip, spelled out, at the shortlisted cuts ---`)
for (const [flipFr, intFr] of [[9, 14], [10, 14], [11, 16], [12, 16], [13, 18]]) {
  const p = {
    ...DEFAULT_HERO_MOTION, shape: "letterByLetter", beats: HERO_SHEETS.letterByLetter,
    letterCount: N, letterSilentAfter: 2, letterPairFrom: -1,
    letterQuickSec: flipFr / FPS, letterBeatSec: intFr / FPS, letterLeadSec: 20 / FPS,
  }
  const s = flipShape(p, 3, N)
  console.log(`flip ${flipFr}fr / int ${intFr}fr  maxStep ${s.maxStep.toFixed(1)}°  swapSx ${s.swapSx?.toFixed(3)}  narrowest ${s.minSx.toFixed(3)}`)
  console.log(`   ${s.seq}`)
}
console.log(`\nthe whole-word turn, the bar: 13 turn fr + 2 dwell, maxStep 29.8°`)
