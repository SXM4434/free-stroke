// THE CAMERA PROGRAM, SAMPLED. A measurement tool, not a gate.
//
// Sebs: "i also dont full geth janky can angels once it turn 3d". Jank is a
// TIME-DOMAIN defect, so this reads the camera as a series rather than as a set
// of poses: per-frame velocity and acceleration on az / el / fill, the seam
// between every pair of phases, and the total path the camera walks against the
// net displacement it achieves.
//
// Usage:
//   node scripts/verify/_probe-hero-camera.mjs                 # shipped defaults
//   node scripts/verify/_probe-hero-camera.mjs --tiltLaw=prior
//   node scripts/verify/_probe-hero-camera.mjs --descendLaw=prior
//   node scripts/verify/_probe-hero-camera.mjs --tilt=0.7        # beats.tilt
import { loadTs } from "./_ts-load.mjs"

const M = loadTs("lib/hero-motion.ts")
const { DEFAULT_HERO_MOTION, sampleHeroMotion, phaseOffsets, HERO_PHASES, totalDuration } = M

function withArgs(P) {
  const p = { ...P, beats: { ...P.beats }, emerge: { ...P.emerge }, ret: { ...P.ret } }
  for (const a of process.argv.slice(2)) {
    const m = /^--([A-Za-z.]+)=(.+)$/.exec(a)
    if (!m) continue
    const [, k, v] = m
    const num = Number(v)
    if (k in p.beats) p.beats[k] = Number.isFinite(num) ? num : v
    else p[k] = Number.isFinite(num) && !/Curve|Park|mode|cadence|Law/.test(k) ? num : v
  }
  return p
}

const P = withArgs(DEFAULT_HERO_MOTION)
const fps = P.fps
const off = phaseOffsets(P)
const T = totalDuration(P)

/** One row per output frame, plus the derivatives the eye actually reads. */
export function series(p, rate = p.fps) {
  const n = Math.round(totalDuration(p) * rate)
  const rows = []
  for (let i = 0; i <= n; i++) {
    const t = Math.min(i / rate, totalDuration(p))
    const s = sampleHeroMotion(p, t)
    rows.push({ i, t, phase: s.phase, az: s.az, el: s.el, fill: s.fill })
  }
  const dt = 1 / rate
  for (let i = 0; i < rows.length; i++) {
    const a = rows[Math.max(0, i - 1)]
    const b = rows[i]
    rows[i].vaz = (b.az - a.az) / dt
    rows[i].vel = (b.el - a.el) / dt
    rows[i].vfill = (b.fill - a.fill) / dt
  }
  for (let i = 0; i < rows.length; i++) {
    const a = rows[Math.max(0, i - 1)]
    const b = rows[i]
    rows[i].aaz = (b.vaz - a.vaz) / dt
    rows[i].ael = (b.vel - a.vel) / dt
  }
  return rows
}

const rows = series(P)

/* ---- 1. the phase table -------------------------------------------------- */
console.log(`THE CAMERA PROGRAM — ${T.toFixed(4)}s, ${Math.round(T * fps)} frames at ${fps}fps`)
console.log(`  tiltLaw=${P.tiltLaw}  descendLaw=${P.descendLaw}  cameraPark=${P.cameraPark}  riseCurve=${P.riseCurve}\n`)
console.log("phase          start    dur   fr |    az           el          fill        | moves?")
for (const ph of HERO_PHASES) {
  const s0 = sampleHeroMotion(P, off[ph] + 1e-6)
  const s1 = sampleHeroMotion(P, off[ph] + P.beats[ph] - 1e-6)
  const moved =
    Math.abs(s1.az - s0.az) > 1e-6 || Math.abs(s1.el - s0.el) > 1e-6 || Math.abs(s1.fill - s0.fill) > 1e-6
  console.log(
    `${ph.padEnd(13)} ${off[ph].toFixed(3).padStart(6)} ${P.beats[ph].toFixed(3).padStart(6)} ` +
      `${String(Math.round(P.beats[ph] * fps)).padStart(4)} | ` +
      `${s0.az.toFixed(1).padStart(5)}->${s1.az.toFixed(1).padStart(5)}  ` +
      `${s0.el.toFixed(1).padStart(5)}->${s1.el.toFixed(1).padStart(5)}  ` +
      `${s0.fill.toFixed(3)}->${s1.fill.toFixed(3)} | ${moved ? "MOVES" : "parked"}`,
  )
}

/* ---- 2. the seams -------------------------------------------------------- */
// Velocity is read one frame INSIDE each phase so the boundary frame itself is
// not what is being differenced. A discontinuity here is a change of speed the
// eye reads as a kick.
console.log("\nSEAMS — velocity either side of every phase boundary (deg/s, fill/s)")
console.log("                              v_az        v_el        v_fill   |  jump |v|")
const seams = []
for (let k = 1; k < HERO_PHASES.length; k++) {
  const prev = HERO_PHASES[k - 1]
  const next = HERO_PHASES[k]
  const b = off[next]
  const dt = 1 / fps
  const before = {
    az: (sampleHeroMotion(P, b - dt * 0.001).az - sampleHeroMotion(P, b - dt * 1.001).az) / dt,
    el: (sampleHeroMotion(P, b - dt * 0.001).el - sampleHeroMotion(P, b - dt * 1.001).el) / dt,
    fill: (sampleHeroMotion(P, b - dt * 0.001).fill - sampleHeroMotion(P, b - dt * 1.001).fill) / dt,
  }
  const after = {
    az: (sampleHeroMotion(P, b + dt * 1.001).az - sampleHeroMotion(P, b + dt * 0.001).az) / dt,
    el: (sampleHeroMotion(P, b + dt * 1.001).el - sampleHeroMotion(P, b + dt * 0.001).el) / dt,
    fill: (sampleHeroMotion(P, b + dt * 1.001).fill - sampleHeroMotion(P, b + dt * 0.001).fill) / dt,
  }
  const jump = Math.hypot(after.az - before.az, after.el - before.el, 100 * (after.fill - before.fill))
  seams.push({ prev, next, before, after, jump })
  console.log(
    `${(prev + " -> " + next).padEnd(26)} ` +
      `${before.az.toFixed(1).padStart(6)}|${after.az.toFixed(1).padStart(6)} ` +
      `${before.el.toFixed(1).padStart(6)}|${after.el.toFixed(1).padStart(6)} ` +
      `${before.fill.toFixed(3).padStart(6)}|${after.fill.toFixed(3).padStart(6)} ` +
      `| ${jump.toFixed(1).padStart(7)}`,
  )
}
const worst = seams.slice().sort((a, b) => b.jump - a.jump)
console.log(`\n  WORST SEAMS: ` + worst.slice(0, 3).map((s) => `${s.prev}->${s.next} ${s.jump.toFixed(1)}`).join("  ·  "))

/* ---- 3. path vs net ------------------------------------------------------ */
// A camera that walks a long way to end up somewhere near where it started is
// spending the audience's attention on travel rather than on the subject.
console.log("\nPATH vs NET — how much of the camera's travel is round-tripping")
for (const ch of ["az", "el"]) {
  let path = 0
  for (let i = 1; i < rows.length; i++) path += Math.abs(rows[i][ch] - rows[i - 1][ch])
  const net = Math.abs(rows[rows.length - 1][ch] - rows[0][ch])
  const extremes = [Math.min(...rows.map((r) => r[ch])), Math.max(...rows.map((r) => r[ch]))]
  console.log(
    `  ${ch}: path ${path.toFixed(1)}deg   net ${net.toFixed(1)}deg   ` +
      `range ${extremes[0].toFixed(1)}..${extremes[1].toFixed(1)}   ` +
      `efficiency ${((100 * net) / (path || 1)).toFixed(1)}%`,
  )
}

/* ---- 4. every camera move, spaced -------------------------------------- */
// The same three properties assert-hero-rise.mjs reads off the rise, applied to
// every phase whose camera actually moves.
console.log("\nEVERY MOVE — spacing, against reference-film-mechanics §6.1 / §6.3")
console.log("phase        dur   fr | dominant  peak@   rise/decay  | in the 292 / 433-467ms band?")
for (const ph of HERO_PHASES) {
  const n = Math.round(P.beats[ph] * fps)
  if (n < 2) continue
  const sub = []
  for (let i = 0; i <= n; i++) sub.push(sampleHeroMotion(P, off[ph] + i / fps - (i === n ? 1e-6 : 0)))
  const chans = { az: 0, el: 0, fill: 0 }
  for (const c of Object.keys(chans)) chans[c] = Math.abs(sub[n][c] - sub[0][c])
  const dom = chans.el >= chans.az ? "el" : "az"
  if (Math.max(chans.az, chans.el) < 1e-6) continue
  const v = []
  for (let i = 1; i <= n; i++) v.push(Math.abs(sub[i][dom] - sub[i - 1][dom]))
  let pk = 0
  for (let i = 1; i < v.length; i++) if (v[i] > v[pk]) pk = i
  const riseFr = pk + 1
  const decayFr = n - riseFr
  const ms = P.beats[ph] * 1000
  const inBand = (ms >= 282 && ms <= 302) || (ms >= 423 && ms <= 477)
  console.log(
    `${ph.padEnd(12)} ${P.beats[ph].toFixed(3)} ${String(n).padStart(4)} | ` +
      `${dom.padEnd(8)} ${((100 * riseFr) / n).toFixed(0).padStart(4)}%  ` +
      `${String(riseFr).padStart(2)}/${String(decayFr).padStart(2)} = ${(decayFr / riseFr).toFixed(2)}x  | ` +
      `${ms.toFixed(0)}ms ${inBand ? "YES" : "NO"}`,
  )
}

/* ---- 4b. how HARD each move starts and stops ---------------------------- */
// A one-frame finite difference cannot tell a true velocity STEP from a smooth
// move sampled at 30fps. This can: on a move that leaves a parked camera, the
// question is what share of the move's own peak per-frame step its FIRST frame
// carries. Babbu's dolly (§6.2) reads 3 of a 21 peak = 14%. An instant start
// reads 100%.
console.log("\nHOW HARD EACH MOVE STARTS — first frame as a share of the move's own peak step")
console.log("phase        chan | first    peak   first/peak | last    last/peak  (reference: 14% start)")
for (const ph of HERO_PHASES) {
  const n = Math.round(P.beats[ph] * fps)
  if (n < 2) continue
  const sub = []
  for (let i = 0; i <= n; i++) sub.push(sampleHeroMotion(P, off[ph] + i / fps - (i === n ? 1e-6 : 0)))
  const chans = { az: Math.abs(sub[n].az - sub[0].az), el: Math.abs(sub[n].el - sub[0].el) }
  if (Math.max(chans.az, chans.el) < 1e-6) continue
  const c = chans.el >= chans.az ? "el" : "az"
  const steps = []
  for (let i = 1; i <= n; i++) steps.push(Math.abs(sub[i][c] - sub[i - 1][c]))
  const pk = Math.max(...steps)
  console.log(
    `${ph.padEnd(12)} ${c.padEnd(4)} | ${steps[0].toFixed(2).padStart(5)} ${pk.toFixed(2).padStart(7)}  ` +
      `${((100 * steps[0]) / pk).toFixed(0).padStart(6)}%    | ` +
      `${steps[steps.length - 1].toFixed(2).padStart(5)}  ${((100 * steps[steps.length - 1]) / pk).toFixed(0).padStart(5)}%`,
  )
}

/* ---- 5. legibility ------------------------------------------------------- */
// The mark lies in the ground plane, so its on-screen height goes as cos(el).
// The board's own number: at el 65 the bbox collapses 99 -> 47px.
console.log("\nLEGIBILITY — on-screen height of the mark as cos(el), per frame")
let below = 0
let worstEl = 0
for (const r of rows) {
  const h = Math.cos((r.el * Math.PI) / 180)
  if (h < 0.6) below++
  if (r.el > worstEl) worstEl = r.el
}
console.log(
  `  max elevation ${worstEl.toFixed(1)}deg -> height ${(100 * Math.cos((worstEl * Math.PI) / 180)).toFixed(0)}% of full`,
)
console.log(
  `  frames below 60% height: ${below} of ${rows.length} = ${((100 * below) / rows.length).toFixed(1)}% of the beat ` +
    `(${(below / fps).toFixed(2)}s)`,
)

/* ---- 6. the raw series ---------------------------------------------------- */
function dump(label, t0, t1, chan) {
  console.log(`\n${label}`)
  for (let t = t0; t <= t1 + 1e-9; t += 1 / fps) {
    const tc = Math.min(t, t1 - 1e-6)
    const s = sampleHeroMotion(P, tc)
    const sp = sampleHeroMotion(P, Math.max(0, tc - 1 / fps))
    const fr = Math.round((t - t0) * fps)
    const d = s[chan] - sp[chan]
    console.log(
      `  f${String(fr).padStart(3)} t${t.toFixed(3)}  ${s.phase.padEnd(11)} ` +
        `el ${s.el.toFixed(2).padStart(6)} az ${s.az.toFixed(2).padStart(6)} fill ${s.fill.toFixed(3)}  ` +
        `d${chan} ${d.toFixed(2).padStart(6)}  ${"#".repeat(Math.max(0, Math.round(Math.abs(d) * 2)))}`,
    )
  }
}
dump("THE TILT AND THE RISE, FRAME BY FRAME (el, and its per-frame step)", off.tilt, off.orbit, "el")
dump("THE HOLD AND THE DESCEND (az, and its per-frame step)", off.descend - 4 / fps, off.returnTurn, "az")
