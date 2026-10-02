// EXACT before/after proof, on the repo's own DETERMINISTIC capture.
//
// `film-hero-beat` records whatever the browser happened to paint, so two runs
// never sample the same playheads and a compare between them carries a 5%
// jitter floor — useless for proving "unchanged". `verify-hero-transition`
// instead DRIVES the playhead to fixed positions and waits for each, so frame N
// of one run is the same pose as frame N of another. That makes the comparison
// exact rather than statistical.
//
//   carve      = captured WITH the panel fix applied
//   carve-base = captured with page.tsx reverted to the shared checkout
//
// Same build otherwise, same session, same wall clock, same dev server.
import { readdirSync, existsSync } from "node:fs"
import { join } from "node:path"
import { createCanvas, loadImage } from "@napi-rs/canvas"

const ROOT = "docs/verification/hero-transition"
const A = process.argv[2] ?? "carve-base"
const B = process.argv[3] ?? "carve"

const read = async (p) => {
  const img = await loadImage(p)
  const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  return { d: c.getContext("2d").getImageData(0, 0, img.width, img.height).data, w: img.width, h: img.height }
}

let totalFrames = 0, identical = 0, worstPct = 0, worstName = "", maxChan = 0
for (const sub of ["scrub", "emerge"]) {
  const da = join(ROOT, A, sub), db = join(ROOT, B, sub)
  if (!existsSync(da) || !existsSync(db)) continue
  const files = readdirSync(da).filter((f) => f.endsWith(".png")).sort()
  for (const f of files) {
    if (!existsSync(join(db, f))) continue
    const ia = await read(join(da, f)), ib = await read(join(db, f))
    if (ia.w !== ib.w || ia.h !== ib.h) { console.log(`SIZE MISMATCH ${sub}/${f}`); continue }
    let diff = 0
    for (let p = 0; p < ia.d.length; p += 4) {
      const m = Math.max(Math.abs(ia.d[p] - ib.d[p]), Math.abs(ia.d[p + 1] - ib.d[p + 1]), Math.abs(ia.d[p + 2] - ib.d[p + 2]))
      if (m > 0) diff++
      if (m > maxChan) maxChan = m
    }
    totalFrames++
    if (diff === 0) identical++
    const pct = (diff / (ia.w * ia.h)) * 100
    if (pct > worstPct) { worstPct = pct; worstName = `${sub}/${f}` }
  }
}
console.log(`\ndeterministic capture compare — "${A}" (baseline) vs "${B}" (with the panel fix)`)
console.log(`  frames compared        ${totalFrames}`)
console.log(`  BYTE-IDENTICAL frames  ${identical} / ${totalFrames}`)
console.log(`  worst frame            ${worstPct.toFixed(4)}% of pixels differ  (${worstName || "-"})`)
console.log(`  max channel delta      ${maxChan}`)
console.log(
  identical === totalFrames && totalFrames > 0
    ? `\nVERDICT: every rendered frame is byte-identical. The fix changed no pixel.`
    : `\nVERDICT: ${totalFrames - identical} frame(s) moved — investigate.`,
)
