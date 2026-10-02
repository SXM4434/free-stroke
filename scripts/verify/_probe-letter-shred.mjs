// FIND THE FRAMES WHERE A LETTER COMES APART — over a whole film, not by eye.
//
// The defect: one frame before each letter's edge, the carve was removing the
// tube's SIDE WALL (whose rest positions lie outside the nib's 2D outline) and
// the letter rendered as gouges. It is one or two frames per flip in a
// 1500-frame film, which is exactly the kind of thing an eye pass finds by luck
// and a sum misses entirely — so this is the instrument that finds it every
// time, and its known-bad arm is a film that HAS the defect.
//
// The signal is INTERIOR MID-LUMA. A flat drawn letter is one value inside a
// hard silhouette (the beat's own gate 1) and a lit letter is smooth shading;
// either way, pixels that are neither ink nor paper only occur on edges. A
// stipple from a 50 %-coverage sample mask puts them THROUGH the letter. So:
// count mid-luma pixels that are surrounded by ink, per frame.
//
//   node scripts/verify/_probe-letter-shred.mjs --labels=o5-letters-02,o5-letters-03
import { loadImage } from "@napi-rs/canvas"
import { createCanvas } from "@napi-rs/canvas"
import { readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`))
  return h ? h.split("=").slice(1).join("=") : d
}
const LABELS = arg("labels", "o5-letters-02,o5-letters-03").split(",")
const TOP = parseInt(arg("top", "8"), 10)

async function scan(label) {
  const dir = join(ROOT, "docs/verification/hero-beat-film", label, "frames")
  const files = readdirSync(dir).filter((f) => f.endsWith(".png")).sort()
  const out = []
  for (const f of files) {
    const img = await loadImage(join(dir, f))
    const c = createCanvas(img.width, img.height)
    const ctx = c.getContext("2d")
    ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(0, 0, img.width, img.height).data
    const W = img.width
    const H = img.height
    let shred = 0
    let ink = 0
    // Sample every other pixel: the stipple is a 2x2 sample mask, so it survives
    // a 2x decimation, and a full walk of 1500 x 940k pixels is not a probe.
    for (let y = 2; y < H - 2; y += 2) {
      for (let x = 2; x < W - 2; x += 2) {
        const i = (y * W + x) * 4
        const l = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000
        if (l < 70) {
          ink++
          continue
        }
        if (l > 205) continue
        // Mid-luma. Is it INSIDE the mark? Four probes two pixels out; if three
        // or more are ink, this is interior, not a silhouette edge.
        let dark = 0
        for (const [dx, dy] of [[-4, 0], [4, 0], [0, -4], [0, 4]]) {
          const j = ((y + dy) * W + (x + dx)) * 4
          const m = (d[j] * 299 + d[j + 1] * 587 + d[j + 2] * 114) / 1000
          if (m < 70) dark++
        }
        if (dark >= 3) shred++
      }
    }
    out.push({ f: parseInt(f, 10), shred, ink })
  }
  return out
}

for (const label of LABELS) {
  const rows = await scan(label)
  const sorted = [...rows].sort((a, b) => b.shred - a.shred)
  const total = rows.reduce((a, r) => a + r.shred, 0)
  const bad = rows.filter((r) => r.shred >= 20).length
  console.log(
    `\n${label}: ${rows.length} frames · interior mid-luma total ${total} · ` +
      `${bad} frames over 20 (a torn frame)`,
  )
  console.log(`  worst ${TOP}: ${sorted.slice(0, TOP).map((r) => `f${r.f}=${r.shred}`).join(" ")}`)
}
