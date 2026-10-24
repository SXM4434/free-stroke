/**
 * JOB 3'S EXPERIMENT, AND JOB 2'S PICTURE — one probe, because they are one
 * question asked at two dial settings.
 *
 * N8, 2026-08-28. The controller's hypothesis, stated as a hypothesis:
 *
 *   *"A stub swept by any nib renders as the nib's own footprint, so a bigger
 *   nib makes a bigger blob, and blobs are what fill counters. So the counter
 *   closure at aspect 5 may be caused by the STUBS rather than by the aspect.
 *   After the filter, re-run the contrast gate at aspect 5 and see whether the
 *   counters survive."*
 *
 * This renders the word's solid silhouette off the SAME instrument the gate
 * uses (`_nib-measure.mjs`), so the picture and the number cannot disagree, and
 * writes a stacked sheet at whatever aspects are asked for. The stub filter is
 * flipped with the loader's own mutation hook rather than by an env flag, so the
 * "before" arm is the shipped code with one expression replaced and nothing on
 * disk changes:
 *
 *   node scripts/verify/_probe-stub-aspect.mjs <outName> <aspect,aspect,…>
 *   GATE_MUTATE_FILE=<json> node …            ← the same run, filter OFF
 *
 * Usage note: the mask is BLACK ON WHITE already (buildMask fills white then
 * fills the triangles black), so there is no transparent-png trap here — that
 * one belongs to `__captureHarness.grab()`.
 */
import { buildMask } from "./_nib-measure.mjs"
import { createRequire } from "node:module"
import { mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
const require = createRequire(import.meta.url)
const sharp = require("sharp")

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const OUT = join(ROOT, "docs", "verification", "mark-2026-08-28")
const name = process.argv[2] ?? "sheet"
const aspects = (process.argv[3] ?? "1.8").split(",").map(Number)
const family = process.argv[4] ?? "free-stroke"

mkdirSync(OUT, { recursive: true })

/** Enclosed background regions, flooded from the border — the counters. */
function counterAreas(mask, W, H, floor) {
  const out = new Uint8Array(W * H)
  const st = []
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    const i = y * W + x
    if (out[i] || mask[i]) return
    out[i] = 1
    st.push(i)
  }
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1) }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y) }
  while (st.length) { const i = st.pop(); const x = i % W; const y = (i / W) | 0
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1) }
  const seen = new Uint8Array(W * H)
  const areas = []
  for (let i = 0; i < W * H; i++) {
    if (mask[i] || out[i] || seen[i]) continue
    let a = 0; seen[i] = 1; const s2 = [i]
    while (s2.length) { const j = s2.pop(); a++
      const x = j % W; const y = (j / W) | 0
      for (const k of [x + 1 < W ? j + 1 : -1, x - 1 >= 0 ? j - 1 : -1, y + 1 < H ? j + W : -1, y - 1 >= 0 ? j - W : -1]) {
        if (k < 0 || seen[k] || mask[k] || out[k]) continue
        seen[k] = 1; s2.push(k) } }
    if (a >= floor) areas.push(a)
  }
  return areas.sort((p, q) => q - p)
}

const tiles = []
let W0 = 0
for (const aspect of aspects) {
  const m = buildMask({ nibAspect: aspect }, false, family)
  const rgb = Buffer.alloc(m.W * m.H * 3)
  for (let i = 0; i < m.W * m.H; i++) {
    const v = m.mask[i] ? 20 : 255
    rgb[i * 3] = v; rgb[i * 3 + 1] = v; rgb[i * 3 + 2] = v
  }
  const areas = counterAreas(m.mask, m.W, m.H, 400)
  console.log(
    `${family} aspect ${aspect}: ink ${m.ink}  ${areas.length} counters ≥400  total ${areas.reduce((a, b) => a + b, 0)}  [${areas.join(", ")}]`,
  )
  const scale = 1400 / m.W
  const buf = await sharp(rgb, { raw: { width: m.W, height: m.H, channels: 3 } })
    .resize({ width: 1400 })
    .png()
    .toBuffer()
  tiles.push({ buf, h: Math.round(m.H * scale) })
  W0 = 1400
}
const gap = 10
const H = tiles.reduce((a, t) => a + t.h, 0) + gap * (tiles.length - 1)
let top = 0
const comp = tiles.map((t) => { const c = { input: t.buf, top, left: 0 }; top += t.h + gap; return c })
const file = join(OUT, `${name}.png`)
await sharp({ create: { width: W0, height: H, channels: 3, background: "#c8c8c8" } })
  .composite(comp).png().toFile(file)
console.log("wrote", file)
