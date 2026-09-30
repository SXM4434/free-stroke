// THE INK-BLACK POLICY, CHECKED ON THE ARRIVAL'S ARMS.
//
// `STUDIO_ENV`'s ratified colour policy (3d-mode-controls-spec footer, Sebs
// 2026-06-12, quoted verbatim in components/studio-rig.tsx) bans broad warm-TAN
// area bands at every orbit angle, and it names the measurement that convicted
// the last violation: *"round-7 verifier measured rgb(142,118,91) on a Glossy
// Extrude slab — reproduced by the battery at rgb(146,122,96), Δr−b 50."*
//
// Turning the environment up on the lit form is exactly the channel that
// produced that failure — *"specular reflection bypasses albedo, so any hue
// here lands on the object at full strength regardless of the ink-black base"*.
// So the arrival cannot be picked on luma alone: every arm has to be read for
// Δr−b as well, or a brighter form is bought with the one thing this register
// forbids.
//
// Usage: node scripts/verify/_probe-lit-hue.mjs [--dir=sweep]
import { readdirSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const DIR = join(ROOT, "docs", "verification", "switch-tone", arg("dir", "sweep"))

const INK_MAX_LUMA = 150
const ERODE = 3

async function hue(file) {
  const img = await loadImage(file)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const W = img.width
  const H = Math.floor(img.height * 0.75)
  const luma = new Float32Array(W * H)
  for (let p = 0; p < W * H; p++) {
    const i = p * 4
    luma[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
  }
  let cur = new Uint8Array(W * H)
  for (let p = 0; p < W * H; p++) cur[p] = luma[p] <= INK_MAX_LUMA ? 1 : 0
  for (let pass = 0; pass < ERODE; pass++) {
    const next = new Uint8Array(W * H)
    for (let y = 1; y < H - 1; y++)
      for (let px = 1; px < W - 1; px++) {
        const p = y * W + px
        if (!cur[p]) continue
        if (
          cur[p - 1] && cur[p + 1] && cur[p - W] && cur[p + W] &&
          cur[p - W - 1] && cur[p - W + 1] && cur[p + W - 1] && cur[p + W + 1]
        ) next[p] = 1
      }
    cur = next
  }
  let n = 0, sr = 0, sg = 0, sb = 0
  const drb = []
  /* THE BRIGHTEST DECILE separately, because the ban is on a broad warm BAND —
   * a tan flood shows up where the light lands, not in the shadow core, and an
   * average over the whole form dilutes exactly the pixels the policy is about. */
  const bright = []
  for (let p = 0; p < W * H; p++) {
    if (!cur[p]) continue
    const i = p * 4
    n++
    sr += data[i]; sg += data[i + 1]; sb += data[i + 2]
    drb.push(data[i] - data[i + 2])
    bright.push({ l: luma[p], r: data[i], g: data[i + 1], b: data[i + 2] })
  }
  bright.sort((a, b) => b.l - a.l)
  const top = bright.slice(0, Math.max(1, Math.floor(bright.length * 0.1)))
  const tr = top.reduce((a, v) => a + v.r, 0) / top.length
  const tg = top.reduce((a, v) => a + v.g, 0) / top.length
  const tb = top.reduce((a, v) => a + v.b, 0) / top.length
  drb.sort((a, b) => a - b)
  return {
    n,
    mean: [sr / n, sg / n, sb / n],
    meanDrb: sr / n - sb / n,
    p95Drb: drb[Math.floor(drb.length * 0.95)],
    top: [tr, tg, tb],
    topDrb: tr - tb,
  }
}

async function main() {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".png")).sort()
  console.log("RATIFIED BAN: broad warm-tan bands. The convicted sample was rgb(142,118,91), Δr−b 50.")
  console.log("(studio-rig.tsx STUDIO_ENV, ratified colour policy, Sebs 2026-06-12)\n")
  console.log("arm".padEnd(46) + "  mean rgb          Δr−b   p95Δ | brightest decile rgb   Δr−b")
  for (const f of files) {
    const h = await hue(join(DIR, f))
    const fm = (a) => `${a.map((v) => Math.round(v)).join(",")}`.padEnd(14)
    console.log(
      f.replace(".png", "").padEnd(46) +
        "  " + fm(h.mean) +
        h.meanDrb.toFixed(1).padStart(6) +
        String(h.p95Drb).padStart(7) +
        " | " + fm(h.top) +
        h.topDrb.toFixed(1).padStart(7) +
        (h.topDrb >= 50 ? "   *** TAN — BANNED ***" : h.topDrb >= 30 ? "   <- watch" : ""),
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
