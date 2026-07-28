// Turns the timing captures into pass/fail assertions.
//
// A mode "moves" if consecutive frames differ. The point of this script is that
// each mode must move in its OWN pattern — a delayed layer that animates during
// the reveal is broken even though it animates, and a pulse that never stops is
// broken even though it bursts.
//
// Usage: node scripts/verify/assert-timing.mjs
import { loadImage, createCanvas } from "@napi-rs/canvas"
import { readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIR = join(__dirname, "..", "..", "docs", "verification", "timing-v1")

async function px(f) {
  const img = await loadImage(join(DIR, f))
  const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  return c.getContext("2d").getImageData(0, 0, img.width, img.height).data
}
function diff(a, b) {
  let sum = 0
  let n = 0
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] < 20 && b[i + 3] < 20) continue
    sum += (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3
    n++
  }
  return n ? sum / n : 0
}
/** Mean consecutive-frame change across a named group of frames. */
async function motion(prefix) {
  const files = readdirSync(DIR).filter((f) => f.startsWith(prefix)).sort()
  if (files.length < 2) throw new Error(`not enough frames for ${prefix}`)
  let total = 0
  let prev = await px(files[0])
  for (let i = 1; i < files.length; i++) {
    const cur = await px(files[i])
    total += diff(prev, cur)
    prev = cur
  }
  return total / (files.length - 1)
}

const MOVING = 1.0 // mean consecutive change above this = the layer is animating
let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

async function main() {
  const indep = await motion("A_independent_")
  say(indep > MOVING, "independent / animates freely", `consecΔ ${indep.toFixed(2)}`)

  const loop = await motion("A_loopSynced_")
  say(loop > MOVING, "loopSynced / animates", `consecΔ ${loop.toFixed(2)}`)

  const delayedDuring = await motion("B_delayed_during_")
  const delayedAfter = await motion("B_delayed_after_")
  say(
    delayedDuring < MOVING,
    "delayedAfterReveal / STILL while the reveal runs",
    `consecΔ ${delayedDuring.toFixed(2)}`,
  )
  say(
    delayedAfter > MOVING,
    "delayedAfterReveal / animates once the reveal ends",
    `consecΔ ${delayedAfter.toFixed(2)}`,
  )
  say(
    delayedAfter > delayedDuring * 3,
    "delayedAfterReveal / after is clearly livelier than during",
    `${delayedAfter.toFixed(2)} vs ${delayedDuring.toFixed(2)}`,
  )

  const pulseBefore = await motion("C_pulse_before_")
  const pulseBurst = await motion("C_pulse_burst_")
  const pulseSettled = await motion("C_pulse_settled_")
  say(pulseBefore < MOVING, "completionPulse / silent before completion", `consecΔ ${pulseBefore.toFixed(2)}`)
  say(pulseBurst > MOVING, "completionPulse / bursts at completion", `consecΔ ${pulseBurst.toFixed(2)}`)
  say(
    pulseSettled < MOVING,
    "completionPulse / decays back to still (it is ONE-SHOT)",
    `consecΔ ${pulseSettled.toFixed(2)}`,
  )

  const revealHeld = await motion("D_reveal_held_")
  const revealScrub = await motion("D_reveal_scrub_")
  say(
    revealHeld < MOVING,
    "revealSynced / static when the playhead is static",
    `consecΔ ${revealHeld.toFixed(2)}`,
  )
  say(
    revealScrub > MOVING,
    "revealSynced / driven by scrubbing the reveal",
    `consecΔ ${revealScrub.toFixed(2)}`,
  )

  console.log(pass ? "\nALL TIMING ASSERTIONS PASS" : "\nTIMING FAILURES PRESENT")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
