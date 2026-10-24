// _PROBE-PENTIP-CROPS — the 7x before/after, cut from the frames on disk.
//
// The same crop the previous pass used to locate this defect
// (`docs/verification/drawin-sweep/run/tip/tip-vs-final-7x.png`), now with the
// arm that matters in it: FIVE rows from ONE box —
//
//   BEFORE      free-stroke, tip `off` — the parked prior, explainer 18's raw
//               per-triangle `setDrawRange` boundary
//   nib         free-stroke, the round ballpoint — the other shipped shape
//   AFTER       free-stroke, the shipped tip shape (`quill`)
//   REFERENCE   desk-doodles, which rebuilds from clipped strokes and therefore
//               has a real end — the engine Sebs calls better
//   FINISHED    the same box on the finished frame: the engine's OWN natural
//               terminus, which is what a mid-draw tip has to look like
//
// The box is the centroid of the pixels BEFORE and AFTER disagree on, so it is
// found rather than chosen, and it is identical across all four rows.
//
// Usage: node scripts/verify/_probe-pentip-crops.mjs [--label=run] [--zoom=7]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "run")
const DIR = join(ROOT, "docs", "verification", "pentip", LABEL)
const ZOOM = parseInt(arg("zoom", "7"), 10)
const CROP = parseInt(arg("crop", "150"), 10)
const CROP_H = Math.round(CROP * 0.8)
const ROWS = [
  { key: "free-stroke-off", label: "BEFORE — tip off (the parked prior) — pen score 0.444, a CUT", tint: "#ff9d7a" },
  { key: "free-stroke-nib", label: "nib — the round ballpoint — pen score 1.233", tint: "#ffe08a" },
  { key: "free-stroke", label: "AFTER — quill, the shipped tip — pen score 2.400", tint: "#9dffa0" },
  { key: "desk-doodles", label: "REFERENCE — desk-doodles engine — pen score 2.142", tint: "#7fd1ff" },
  { key: "__final", label: "FINISHED (same box) — the engine's own terminus", tint: "#cfcfe0" },
]

async function frame(engine, k) {
  return await loadImage(join(DIR, engine, `${String(k).padStart(3, "0")}.png`))
}
function mask(img) {
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const hist = new Uint32Array(256)
  const luma = new Uint8Array(img.width * img.height)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) | 0
    luma[p] = l
    hist[l]++
  }
  let paper = 0
  for (let l = 1; l < 256; l++) if (hist[l] > hist[paper]) paper = l
  const cut = Math.max(8, paper - 45)
  const m = new Uint8Array(luma.length)
  for (let p = 0; p < luma.length; p++) m[p] = luma[p] < cut ? 1 : 0
  return m
}

/* ⚠ THE SHEET MUST BE OPAQUE, AND IT IS ASSERTED RATHER THAN ASSUMED.
 *
 * A sibling lane lost a day to exactly this: it built a contact sheet, LOOKED
 * at it, and the sheet was fine — because ffmpeg had written it as RGBA with
 * 95.8 % of its pixels at alpha 0, and the viewer composited a near-black film
 * onto white. The verification tool had the same bug as the thing it was
 * verifying. A crop of a tip that is not actually there is indistinguishable
 * from a crop of a tip that is, once something else supplies the background. */
function assertOpaque(canvas, path) {
  const ctx = canvas.getContext("2d")
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  let clear = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) clear++
  const pct = (clear / (data.length / 4)) * 100
  console.log(
    `  ${clear === 0 ? "PASS" : "FAIL"}  the sheet is OPAQUE — ${clear} px below alpha 255 (${pct.toFixed(2)} %)`,
  )
  if (clear !== 0) {
    console.error(`the sheet at ${path} is not opaque; what it shows is composited, not measured`)
    process.exit(1)
  }
}

async function main() {
  if (!existsSync(join(DIR, "meta.json"))) {
    console.error(`no capture at ${DIR}`)
    process.exit(2)
  }
  const meta = JSON.parse(readFileSync(join(DIR, "meta.json"), "utf8"))
  const n = meta.engines["free-stroke"].length
  const FRAMES = (arg("frames", "") || [8, 14, 20, 26].join(",")).split(",").map(Number).filter((k) => k < n)
  const finalFS = await frame("free-stroke", n - 1)

  const cols = []
  for (const k of FRAMES) {
    const before = await frame("free-stroke-off", k)
    const after = await frame("free-stroke", k)
    const a = mask(before)
    const b = mask(after)
    let sx = 0
    let sy = 0
    let cnt = 0
    for (let y = 0; y < before.height; y++)
      for (let x = 0; x < before.width; x++) {
        const p = y * before.width + x
        if (a[p] !== b[p]) {
          sx += x
          sy += y
          cnt++
        }
      }
    if (!cnt) {
      console.log(`  f${k}: BEFORE and AFTER are identical — nothing to crop`)
      continue
    }
    const cx = Math.max(0, Math.min(before.width - CROP, Math.round(sx / cnt - CROP / 2)))
    const cy = Math.max(0, Math.min(before.height - CROP_H, Math.round(sy / cnt - CROP_H / 2)))
    console.log(`  f${k}: ${cnt} px differ · box ${cx},${cy}`)
    cols.push({
      k,
      cx,
      cy,
      imgs: {
        "free-stroke-off": before,
        "free-stroke": after,
        "free-stroke-nib": await frame("free-stroke-nib", k),
        "desk-doodles": await frame("desk-doodles", k),
        __final: finalFS,
      },
    })
  }
  if (!cols.length) {
    console.error("nothing differed anywhere — the fix is inert on these frames")
    process.exit(1)
  }

  const LABELH = 26
  const cellW = CROP * ZOOM
  const cellH = CROP_H * ZOOM
  const sheet = createCanvas(cellW * cols.length, (cellH + LABELH) * ROWS.length)
  const sc = sheet.getContext("2d")
  sc.fillStyle = "#0e0e12"
  sc.fillRect(0, 0, sheet.width, sheet.height)
  sc.imageSmoothingEnabled = false
  for (let ci = 0; ci < cols.length; ci++) {
    const col = cols[ci]
    for (let ri = 0; ri < ROWS.length; ri++) {
      const r = ROWS[ri]
      const y = ri * (cellH + LABELH)
      sc.drawImage(col.imgs[r.key], col.cx, col.cy, CROP, CROP_H, ci * cellW, y + LABELH, cellW, cellH)
      sc.strokeStyle = "#33333d"
      sc.lineWidth = 2
      sc.strokeRect(ci * cellW, y + LABELH, cellW, cellH)
      sc.fillStyle = r.tint
      sc.font = "16px monospace"
      sc.fillText(`${r.label}   ·   frame ${col.k}/${n - 1}`, ci * cellW + 8, y + 18)
    }
  }
  const OUT = join(DIR, "crops")
  mkdirSync(OUT, { recursive: true })
  const p = join(OUT, `before-after-${ZOOM}x.png`)
  assertOpaque(sheet, "sheet")
  writeFileSync(p, sheet.toBuffer("image/png"))
  writeFileSync(join(OUT, "crops.json"), JSON.stringify({ frames: FRAMES, cols: cols.map((c) => ({ k: c.k, box: [c.cx, c.cy, CROP, CROP_H] })) }, null, 2))
  console.log(`\nsheet: ${p}  (${sheet.width}x${sheet.height}, ${ZOOM}x)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
