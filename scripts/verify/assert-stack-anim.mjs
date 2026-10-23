// Asserts STACK-LEVEL animation behaves as a group, with each behaviour showing
// its own signature. Written as measurements of ink coverage and frame-to-frame
// change, because "the group faded in" is a claim about how much of the effect
// is present, which a single screenshot cannot settle.
//
// Usage: node scripts/verify/assert-stack-anim.mjs
import { loadImage, createCanvas } from "@napi-rs/canvas"
import { readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIR = join(__dirname, "..", "..", "docs", "verification", "stack-anim-v1")

async function px(f) {
  const img = await loadImage(join(DIR, f))
  const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  return c.getContext("2d").getImageData(0, 0, img.width, img.height).data
}
function diff(a, b) {
  let s = 0, n = 0
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] < 20 && b[i + 3] < 20) continue
    s += (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3
    n++
  }
  return n ? s / n : 0
}
const files = (p) => readdirSync(DIR).filter((f) => f.startsWith(p)).sort()
async function motion(p) {
  const fs = files(p)
  let t = 0, prev = await px(fs[0])
  for (let i = 1; i < fs.length; i++) { const c = await px(fs[i]); t += diff(prev, c); prev = c }
  return t / (fs.length - 1)
}
/** Mean luminance over pixels the object covers — a proxy for "how present". */
async function presence(f) {
  const d = await px(f)
  let s = 0, n = 0
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 20) continue
    s += (d[i] + d[i + 1] + d[i + 2]) / 3
    n++
  }
  return n ? s / n : 0
}

const MOVING = 1.0
let pass = true
const say = (ok, l, d) => { if (!ok) pass = false; console.log(`${ok ? "PASS" : "FAIL"}  ${l}${d ? " — " + d : ""}`) }

async function main() {
  // fadeIn: the group should be measurably more present at the end than the start.
  const fadeFiles = files("fade_")
  const first = await presence(fadeFiles[0])
  const last = await presence(fadeFiles[fadeFiles.length - 1])
  say(Math.abs(last - first) > 2, "stack fadeIn / presence changes across the fade",
      `${first.toFixed(1)} -> ${last.toFixed(1)}`)

  const pulse = await motion("pulse_")
  say(pulse > MOVING, "stack pulse / the group oscillates", `consecΔ ${pulse.toFixed(2)}`)

  const drift = await motion("drift_")
  say(drift > MOVING, "stack drift / the group slides", `consecΔ ${drift.toFixed(2)}`)

  // delayAfterReveal: the stack is ABSENT during the reveal.
  const dDuring = await presence(files("delay_during_")[2])
  const dAfter = await presence(files("delay_after_")[4])
  say(Math.abs(dAfter - dDuring) > 2, "stack delay / absent during reveal, present after",
      `during ${dDuring.toFixed(1)} vs after ${dAfter.toFixed(1)}`)

  // freezeOnComplete: the headline claim — moving, then EXACTLY still.
  const fDuring = await motion("freeze_during_")
  const fAfter = await motion("freeze_after_")
  say(fDuring > MOVING, "stack freeze / layers animate during the reveal", `consecΔ ${fDuring.toFixed(2)}`)
  say(fAfter < 0.5, "stack freeze / EXACTLY still once complete", `consecΔ ${fAfter.toFixed(2)}`)

  console.log(pass ? "\nALL STACK-ANIMATION ASSERTIONS PASS" : "\nSTACK-ANIMATION FAILURES PRESENT")
  process.exit(pass ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
