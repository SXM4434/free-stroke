// _PROBE-DRAWIN-VANISH-READ — THE EYE HALF. His three frames, before and after.
//
// Two sheets, both from frames `_probe-drawin-vanish.mjs` wrote:
//
//   SHEET-his-frames   DRAW 61 / 69 / 75 % — the three he photographed — with
//                      the BEFORE build above the AFTER build at 9x, on the
//                      "Doodl" region his note is about.
//   SHEET-lost-ink     the mechanism itself: for each step, BLACK is ink that
//                      survives into the next step and RED is ink that DOES NOT.
//                      A pen leaves no red. Before, every step has some.
//
// Usage: node scripts/verify/_probe-drawin-vanish-read.mjs
//        [--a=repro] [--b=after] [--zoom=9]
import { readFileSync, writeFileSync, existsSync } from "node:fs"
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
const A = arg("a", "repro")
const B = arg("b", "after")
const ZOOM = parseInt(arg("zoom", "9"), 10)
const DIR = join(ROOT, "docs", "verification", "drawin-vanish")

/** Same paper-mode + 45 luma cut every reader in this repo uses. */
async function mask(p) {
  const img = await loadImage(p)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const w = img.width
  const h = img.height
  const hist = new Uint32Array(256)
  const luma = new Uint8Array(w * h)
  for (let i = 0, p2 = 0; i < data.length; i += 4, p2++) {
    const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) | 0
    luma[p2] = l
    hist[l]++
  }
  let paper = 0
  for (let l = 1; l < 256; l++) if (hist[l] > hist[paper]) paper = l
  const cut = Math.max(8, paper - 45)
  const m = new Uint8Array(w * h)
  for (let p2 = 0; p2 < m.length; p2++) m[p2] = luma[p2] < cut ? 1 : 0
  return { m, w, h, img }
}

const meta = (label) => JSON.parse(readFileSync(join(DIR, label, "vanish.json"), "utf8"))
const framePath = (label, pct) => {
  const j = meta(label)
  const row = j.rows.find((r) => Math.abs(r.pct * 100 - pct) < 0.01)
  if (!row) throw new Error(`${label}: no frame at ${pct} %`)
  return join(DIR, label, "frames", row.name)
}

/* His three, and the box. The box is the "Doodl" run — the second `o` and the
 * `d` that overlaps it, which is the pair his note names — plus the first `o`
 * so the whole claim is in one picture. Found from the frames' own connected
 * components at DRAW 75 %, not chosen by eye. */
const PCTS = [61, 69, 75]
const BOX = { x: 588, y: 420, w: 300, h: 160 }
/** Tighter, for the step sheet: the first `o` alone. */
const OBOX = { x: 662, y: 488, w: 100, h: 76 }

function opaque(cx, cv, name) {
  const { data } = cx.getImageData(0, 0, cv.width, cv.height)
  let clear = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) clear++
  console.log(`  ${clear === 0 ? "PASS" : "FAIL"}  ${name} is OPAQUE — ${clear} px below alpha 255`)
  return clear === 0
}

async function sheetHisFrames() {
  const Z = ZOOM
  const cw = BOX.w * Z
  const ch = BOX.h * Z
  const PAD = 10
  const HEAD = 46
  const LAB = 26
  const cv = createCanvas(PAD + 2 * (cw + PAD), HEAD + PCTS.length * (ch + LAB + PAD))
  const g = cv.getContext("2d")
  g.fillStyle = "#101014"
  g.fillRect(0, 0, cv.width, cv.height)
  g.imageSmoothingEnabled = false
  g.fillStyle = "#e8e8f0"
  g.font = "600 22px sans-serif"
  g.fillText(
    `HIS THREE FRAMES · DD engine · wobble 0 · endpoint clean · ${Z}x — left ${A} (BEFORE)   right ${B} (AFTER)`,
    PAD,
    30,
  )
  for (let i = 0; i < PCTS.length; i++) {
    const y = HEAD + i * (ch + LAB + PAD)
    for (const [j, label] of [A, B].entries()) {
      const img = await loadImage(framePath(label, PCTS[i]))
      const x = PAD + j * (cw + PAD)
      g.fillStyle = "#9aa0b4"
      g.font = "500 17px sans-serif"
      g.fillText(`DRAW ${PCTS[i]} % — ${label}`, x, y + 19)
      g.drawImage(img, BOX.x, BOX.y, BOX.w, BOX.h, x, y + LAB, cw, ch)
      g.strokeStyle = "#3a3a46"
      g.lineWidth = 2
      g.strokeRect(x, y + LAB, cw, ch)
    }
  }
  const ok = opaque(g, cv, "SHEET-his-frames")
  writeFileSync(join(DIR, `SHEET-his-frames-${Z}x.png`), cv.toBuffer("image/png"))
  return ok
}

async function sheetLostInk() {
  const Z = 12
  const from = 56
  const to = 63
  const cw = OBOX.w * Z
  const ch = OBOX.h * Z
  const PAD = 8
  const HEAD = 46
  const LAB = 24
  const n = to - from + 1
  const cv = createCanvas(PAD + 2 * (cw + PAD), HEAD + n * (ch + LAB + PAD))
  const g = cv.getContext("2d")
  g.fillStyle = "#101014"
  g.fillRect(0, 0, cv.width, cv.height)
  g.fillStyle = "#e8e8f0"
  g.font = "600 22px sans-serif"
  g.fillText(
    `THE FIRST o OF "Doodles" · ${Z}x · BLACK = ink that survives the next 1 % step, RED = ink the next step TAKES OFF` +
      `   —   left ${A} (BEFORE)   right ${B} (AFTER)`,
    PAD,
    30,
  )
  let beforeRed = 0
  let afterRed = 0
  for (let k = from; k <= to; k++) {
    const y = HEAD + (k - from) * (ch + LAB + PAD)
    for (const [j, label] of [A, B].entries()) {
      const M = await mask(framePath(label, k))
      const N = await mask(framePath(label, k + 1))
      const x = PAD + j * (cw + PAD)
      let red = 0
      for (let yy = 0; yy < OBOX.h; yy++) {
        for (let xx = 0; xx < OBOX.w; xx++) {
          const p = (OBOX.y + yy) * M.w + (OBOX.x + xx)
          const a = M.m[p]
          const b = N.m[p]
          let col = "#fafafa"
          if (a && b) col = "#111111"
          else if (a && !b) {
            col = "#e02020"
            red++
          }
          g.fillStyle = col
          g.fillRect(x + xx * Z, y + LAB + yy * Z, Z, Z)
        }
      }
      if (j === 0) beforeRed += red
      else afterRed += red
      g.fillStyle = red > 0 ? "#ff8080" : "#7ad07a"
      g.font = "500 17px sans-serif"
      g.fillText(`DRAW ${k} → ${k + 1} % — ${label} — ${red} px taken off`, x, y + 18)
      g.strokeStyle = "#3a3a46"
      g.lineWidth = 2
      g.strokeRect(x, y + LAB, cw, ch)
    }
  }
  const ok = opaque(g, cv, "SHEET-lost-ink")
  writeFileSync(join(DIR, `SHEET-lost-ink-${Z}x.png`), cv.toBuffer("image/png"))
  console.log(`  ink taken off the first o over ${from}–${to + 1} %:  ${A} ${beforeRed} px   ${B} ${afterRed} px`)
  return ok
}

async function main() {
  for (const l of [A, B]) {
    if (!existsSync(join(DIR, l, "vanish.json"))) {
      console.error(`missing docs/verification/drawin-vanish/${l}/vanish.json — run _probe-drawin-vanish.mjs --label=${l}`)
      process.exit(1)
    }
  }
  const a = await sheetHisFrames()
  const b = await sheetLostInk()
  for (const l of [A, B]) {
    const j = meta(l)
    const lossy = j.report.filter((r) => r.lost > 0).length
    const total = j.report.reduce((s, r) => s + r.lost, 0)
    console.log(`  ${l.padEnd(8)} ${lossy} of ${j.report.length} steps take ink off the standing mark · ${total} px in total`)
  }
  console.log(`\nsheets: ${DIR}`)
  process.exit(a && b ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
