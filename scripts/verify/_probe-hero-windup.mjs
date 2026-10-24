// PROBE — the wind-up's release against the turn's onset. Read-only, no browser.
//
// Reproduces the handed measurement (squashY 0.9550 -> 1.0000 in one 30fps
// frame while yaw is still 0.00 deg) and measures how many frames of the turn
// are VISUALLY static, which is the window a release has to live inside.
//
// Usage: node scripts/verify/_probe-hero-windup.mjs [--releaseLaw=prior]
import { loadTs } from "./_ts-load.mjs"

const { DEFAULT_HERO_MOTION, sampleHeroMotion, phaseOffsets, sampleEmerge } =
  loadTs("lib/hero-motion.ts")

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v = "true"] = a.replace(/^--/, "").split("=")
    return [k, v]
  }),
)

const P = { ...DEFAULT_HERO_MOTION, ...args }
const off = phaseOffsets(P)
const fps = P.fps

console.log(
  `phases: breath ${off.breath.toFixed(3)}  anticipation ${off.anticipation.toFixed(3)}  ` +
    `emerge ${off.emerge.toFixed(3)}  land ${off.land.toFixed(3)}`,
)
console.log(`releaseLaw="${P.releaseLaw ?? "(absent)"}"  releaseSec=${P.anticipation.releaseSec ?? "(absent)"}\n`)

// --- the boundary, frame by frame at the timeline's own rate ---------------
console.log("t        phase          squashX  squashY   yaw deg    sx")
const t0 = off.anticipation - 3 / fps
for (let i = 0; i <= 24; i++) {
  const t = t0 + i / fps
  // Read yaw/sx OFF THE SAMPLE, not off a second raw-time call to sampleEmerge:
  // the beat runs on twos, and a probe that reads one channel quantised and
  // another unquantised is comparing two different films. The first version of
  // this file did exactly that and made the release look four times finer than
  // it renders.
  const s = sampleHeroMotion(P, t)
  console.log(
    `${t.toFixed(3)}  ${s.phase.padEnd(13)}  ${s.squashX.toFixed(4)}   ${s.squashY.toFixed(4)}   ` +
      `${((s.yaw * 180) / Math.PI).toFixed(2).padStart(6)}    ${s.sx.toFixed(4)}`,
  )
}

// --- how long is the turn visually static? ---------------------------------
// The settled word measures 648 px across in the turn3 capture
// (storyboard 11.1.1). One pixel of width change is the smallest thing the
// capture can register, so that is the visibility floor used here.
const SETTLED_PX = 648
console.log(`\nthe turn's silent leading window (visibility floor = 1 px on a ${SETTLED_PX} px word)`)
let firstVisible = null
let firstYawFrame = null
for (let i = 0; i < 20; i++) {
  const t = off.emerge + i / fps
  const e = sampleEmerge(P, t)
  const wpx = SETTLED_PX * e.sx
  const deltaPx = SETTLED_PX - wpx
  const yawDeg = (e.yaw * 180) / Math.PI
  if (firstVisible === null && deltaPx >= 1) firstVisible = i
  if (firstYawFrame === null && yawDeg >= 0.005) firstYawFrame = i
  if (i <= 10)
    console.log(
      `  f${String(i).padStart(2)}  yaw ${yawDeg.toFixed(3).padStart(7)} deg   sx ${e.sx.toFixed(5)}   ` +
        `w ${wpx.toFixed(1).padStart(6)} px   narrowed ${deltaPx.toFixed(2)} px`,
    )
}
console.log(
  `\n  yaw first exceeds 0.005 deg at frame ${firstYawFrame}` +
    `\n  width first narrows by >= 1 px at frame ${firstVisible}  (= ${(firstVisible / fps).toFixed(3)} s into the turn)`,
)

// --- the original's own silent window, for the same number off real pixels --
// traced.tsv f140-146 hold w 409; f147 reads 403. 13-frame authored half-turn.
console.log(
  `\n  the original flip, measured (storyboard 10.2 C5): w 409 held f140-f146,\n` +
    `  first change at f147 = frame 7 of a 13-frame half-turn = 53.8% silent`,
)
