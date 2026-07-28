// Asserts the layer stack's controls actually DO something.
//
// A control that renders identically whatever you set it to is worse than a
// missing control — it implies capability that isn't there. So each of order,
// blend and opacity must produce a measurably different image from the same
// layers, and every stack preset must differ from every other.
//
// Usage: node scripts/verify/assert-stack.mjs
import { loadImage, createCanvas } from "@napi-rs/canvas"
import { readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIR = join(__dirname, "..", "..", "docs", "verification", "stack-v1")

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
const d = async (a, b) => diff(await px(a), await px(b))

const DIFFERENT = 2.0 // mean channel difference that counts as a visible change
let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

async function main() {
  // Progressive layering: each added layer must change the image.
  const t = await d("1_none.png", "2_texture_only.png")
  const td = await d("2_texture_only.png", "3_texture_dither.png")
  const tda = await d("3_texture_dither.png", "4_all_three.png")
  say(t > DIFFERENT, "layering / texture changes the base", `Δ ${t.toFixed(2)}`)
  say(td > DIFFERENT, "layering / dither changes texture-only", `Δ ${td.toFixed(2)}`)
  say(tda > DIFFERENT, "layering / ascii changes texture+dither", `Δ ${tda.toFixed(2)}`)

  // ORDER: identical layers, swapped order, must render differently.
  const order = await d("5_order_ditherFirst.png", "6_order_asciiFirst.png")
  say(order > DIFFERENT, "stack order / dither-first differs from ascii-first", `Δ ${order.toFixed(2)}`)

  // BLEND: each mode must differ from the others.
  const nm = await d("7_blend_normal.png", "8_blend_multiply.png")
  const ns = await d("7_blend_normal.png", "9_blend_screen.png")
  const ms = await d("8_blend_multiply.png", "9_blend_screen.png")
  say(nm > DIFFERENT, "blend / normal differs from multiply", `Δ ${nm.toFixed(2)}`)
  say(ns > DIFFERENT, "blend / normal differs from screen", `Δ ${ns.toFixed(2)}`)
  say(ms > DIFFERENT, "blend / multiply differs from screen", `Δ ${ms.toFixed(2)}`)

  // OPACITY: dialing a layer down must visibly reduce it.
  const op = await d("10_opacity_full.png", "11_opacity_low.png")
  say(op > DIFFERENT, "stack opacity / dialing ASCII down changes the image", `Δ ${op.toFixed(2)}`)

  // PRESETS: every stack preset must differ from every other.
  const presets = readdirSync(DIR).filter((f) => f.startsWith("preset_")).sort()
  let worst = { pair: "", v: Infinity }
  for (let i = 0; i < presets.length; i++) {
    for (let j = i + 1; j < presets.length; j++) {
      const v = await d(presets[i], presets[j])
      if (v < worst.v) {
        worst = { pair: `${presets[i].replace("preset_", "").replace(".png", "")} vs ${presets[j].replace("preset_", "").replace(".png", "")}`, v }
      }
    }
  }
  say(
    worst.v > DIFFERENT,
    "stack presets / all five are distinct compositions",
    `closest: ${worst.pair} Δ ${worst.v.toFixed(2)}`,
  )

  console.log(pass ? "\nALL STACK ASSERTIONS PASS" : "\nSTACK FAILURES PRESENT")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
