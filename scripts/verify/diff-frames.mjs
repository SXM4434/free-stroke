// Quantifies how much a style change actually altered the render.
// For each still_<mode>_<pattern>.png it computes, over pixels where either
// frame has ink (alpha > 20), the mean absolute RGB difference vs
// still_<mode>_off.png. This turns "does the texture read?" into a number so a
// mode can't silently no-op.
//
// Usage: node scripts/verify/diff-frames.mjs --pass=texture-v1
import { loadImage, createCanvas } from "@napi-rs/canvas"
import { readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=")[1] : d
}
const DIR = join(ROOT, "docs", "verification", arg("pass", "unnamed"))

async function pixels(file) {
  const img = await loadImage(join(DIR, file))
  const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  return { d: c.getContext("2d").getImageData(0, 0, img.width, img.height).data, w: img.width, h: img.height }
}

function compare(a, b) {
  let sum = 0
  let n = 0
  let maxD = 0
  for (let i = 0; i < a.d.length; i += 4) {
    if (a.d[i + 3] < 20 && b.d[i + 3] < 20) continue
    const dr = Math.abs(a.d[i] - b.d[i])
    const dg = Math.abs(a.d[i + 1] - b.d[i + 1])
    const db = Math.abs(a.d[i + 2] - b.d[i + 2])
    const d = (dr + dg + db) / 3
    sum += d
    if (d > maxD) maxD = d
    n++
  }
  return { mean: n ? sum / n : 0, max: maxD, px: n }
}

// Distinctness check: every variant within a mode must differ from every OTHER
// variant, not just from the off baseline. This catches the "all the presets
// look the same" failure that hit the material system — a set of options can
// each register a big change versus off while being near-identical to each
// other, which is useless to the user.
async function distinctnessReport() {
  const files = readdirSync(DIR).filter((f) => f.startsWith("still_") && f.endsWith(".png"))
  if (!files.length) return
  const modes = [...new Set(files.map((f) => f.split("_")[1]))]
  console.log("\npairwise distinctness (within mode, excludes off)")
  for (const mode of modes) {
    const variants = files
      .filter((f) => f.startsWith(`still_${mode}_`) && !f.endsWith("_off.png"))
      .sort()
    let worst = { pair: "", mean: Infinity }
    const loaded = {}
    for (const f of variants) loaded[f] = await pixels(f)
    for (let i = 0; i < variants.length; i++) {
      for (let j = i + 1; j < variants.length; j++) {
        const r = compare(loaded[variants[i]], loaded[variants[j]])
        if (r.mean < worst.mean) {
          worst = {
            pair: `${variants[i].split("_").pop().replace(".png", "")} vs ${variants[j]
              .split("_")
              .pop()
              .replace(".png", "")}`,
            mean: r.mean,
          }
        }
      }
    }
    const verdict = worst.mean < 3 ? "TOO SIMILAR" : worst.mean < 8 ? "close" : "distinct"
    console.log(
      `${mode.padEnd(10)} closest pair: ${worst.pair.padEnd(26)} ${worst.mean.toFixed(2).padStart(6)}   ${verdict}`,
    )
  }
}

// Motion check: consecutive frames of an animated cell must differ from each
// other (proves the pattern travels) AND the first/last must differ a lot
// (proves it travels somewhere, not just jitters in place).
async function motionReport() {
  const files = readdirSync(DIR).filter((f) => f.startsWith("motion_") && f.endsWith(".png"))
  if (!files.length) return
  const cells = [...new Set(files.map((f) => f.replace(/_\d+\.png$/, "")))]
  console.log("\nmotion cell               consecΔ  spanΔ   verdict")
  for (const cell of cells) {
    const frames = files.filter((f) => f.startsWith(cell + "_")).sort()
    let consec = 0
    let prev = await pixels(frames[0])
    for (let i = 1; i < frames.length; i++) {
      const cur = await pixels(frames[i])
      consec += compare(prev, cur).mean
      prev = cur
    }
    consec /= frames.length - 1
    const span = compare(await pixels(frames[0]), await pixels(frames[frames.length - 1])).mean
    const verdict = consec < 0.5 ? "STATIC (not animating)" : span < 1 ? "jitters in place" : "travels"
    console.log(
      `${cell.replace("motion_", "").padEnd(24)} ${consec.toFixed(2).padStart(6)} ${span
        .toFixed(2)
        .padStart(6)}   ${verdict}`,
    )
  }
}

async function main() {
  const files = readdirSync(DIR).filter((f) => f.startsWith("still_") && f.endsWith(".png"))
  const modes = [...new Set(files.map((f) => f.split("_")[1]))]
  console.log("mode/pattern            meanΔ   maxΔ   verdict")
  for (const mode of modes) {
    const base = await pixels(`still_${mode}_off.png`)
    for (const f of files.filter((f) => f.startsWith(`still_${mode}_`) && !f.endsWith("_off.png"))) {
      const pat = f.replace(`still_${mode}_`, "").replace(".png", "")
      const r = compare(base, await pixels(f))
      // meanΔ < 2 on an 0-255 scale is below the perceptual floor on a dark
      // surface — that's a pattern that technically ran but reads as nothing.
      const verdict = r.mean < 2 ? "TOO SUBTLE" : r.mean < 5 ? "faint" : "reads"
      console.log(
        `${(mode + "/" + pat).padEnd(22)} ${r.mean.toFixed(2).padStart(6)} ${String(r.max).padStart(6)}   ${verdict}`,
      )
    }
  }
  await distinctnessReport()
  await motionReport()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
