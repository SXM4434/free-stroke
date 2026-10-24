// F117 item 4. Why frame k=61 finds no tip window on `t160-aaprior`.
//
// `assert-pentip-specks.mjs` builds a tip window from the pixels that are ink in
// frame k and were NOT ink in frame k-1 (`tipWindow`, the `!m[p] || prev[p]`
// skip). No such pixel, no window, and the frame leaves the arm's `body`. This
// probe repeats that mask rule exactly (paper = modal luma, ink = luma <
// max(8, paper - 45)) on frames around k=61 of both t160 arms, counts new and
// lost ink per frame, says whether a frame is byte-identical to the one before,
// and writes 4x crops around the pen so the frames can be looked at.
//
// Read-only on the frames. Writes only under --out (default: the scratchpad the
// caller names, never the repo unless asked).
//
//   node scripts/verify/_probe-f117-k61.mjs --dir=docs/verification/pentip/ship-dsf1 --out=/tmp/x
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs"
import { createHash } from "node:crypto"
import { join, dirname, isAbsolute } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`))
  return h ? h.slice(k.length + 3) : d
}
const dirArg = arg("dir", "docs/verification/pentip/ship-dsf1")
const DIR = isAbsolute(dirArg) ? dirArg : join(ROOT, dirArg)
const OUT = arg("out", null)
const ARMS = arg("arms", "t160,t160-aaprior").split(",")
const FROM = Number(arg("from", "57"))
const TO = Number(arg("to", "65"))

async function mask(p) {
  const buf = readFileSync(p)
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const W = img.width
  const H = img.height
  const hist = new Uint32Array(256)
  const luma = new Uint8Array(W * H)
  for (let i = 0, q = 0; i < data.length; i += 4, q++) {
    const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) | 0
    luma[q] = l
    hist[l]++
  }
  let paper = 0
  for (let l = 1; l < 256; l++) if (hist[l] > hist[paper]) paper = l
  const cut = Math.max(8, paper - 45)
  const m = new Uint8Array(W * H)
  let ink = 0
  for (let q = 0; q < luma.length; q++) if (luma[q] < cut) (m[q] = 1), ink++
  return { m, W, H, paper, cut, ink, img, sha: createHash("sha1").update(buf).digest("hex").slice(0, 10) }
}

const report = {}
for (const arm of ARMS) {
  let prev = null
  report[arm] = []
  for (let k = FROM; k <= TO; k++) {
    const p = join(DIR, arm, `${String(k).padStart(3, "0")}.png`)
    if (!existsSync(p)) continue
    const f = await mask(p)
    let add = 0
    let lost = 0
    let bx0 = f.W, bx1 = -1, by0 = f.H, by1 = -1
    if (prev) {
      for (let q = 0; q < f.m.length; q++) {
        if (f.m[q] && !prev.m[q]) {
          add++
          const y = (q / f.W) | 0
          const x = q - y * f.W
          if (x < bx0) bx0 = x
          if (x > bx1) bx1 = x
          if (y < by0) by0 = y
          if (y > by1) by1 = y
        }
        if (!f.m[q] && prev.m[q]) lost++
      }
    }
    const row = {
      k,
      sha: f.sha,
      sameBytesAsPrev: prev ? prev.sha === f.sha : null,
      paper: f.paper,
      cut: f.cut,
      ink: f.ink,
      newInk: prev ? add : null,
      lostInk: prev ? lost : null,
      newInkBox: add ? [bx0, by0, bx1, by1] : null,
    }
    report[arm].push(row)
    console.log(`${arm.padEnd(13)} k=${k} sha ${row.sha}${row.sameBytesAsPrev ? " (SAME BYTES as k-1)" : ""}  paper ${f.paper} cut ${f.cut}  ink ${f.ink}  new ${row.newInk}  lost ${row.lostInk}  box ${JSON.stringify(row.newInkBox)}`)
    prev = f
  }
}

/* Crops: centred on where t160 (the arm that DOES find a window) puts new ink
 * at k=61, so every arm is looked at in the same place. */
if (OUT) {
  mkdirSync(OUT, { recursive: true })
  const ref = report[ARMS[0]].find((r) => r.k === 61)?.newInkBox
  if (ref) {
    const cx = (ref[0] + ref[2]) / 2
    const cy = (ref[1] + ref[3]) / 2
    const S = 60
    const Z = 5
    const tiles = []
    for (const arm of ARMS)
      for (const k of [60, 61, 62]) tiles.push({ arm, k })
    const cw = S * 2 * Z
    const can = createCanvas(cw * 3, cw * ARMS.length)
    const g = can.getContext("2d")
    g.imageSmoothingEnabled = false
    let i = 0
    for (const t of tiles) {
      const img = await loadImage(readFileSync(join(DIR, t.arm, `${String(t.k).padStart(3, "0")}.png`)))
      const col = i % 3
      const rowI = (i / 3) | 0
      g.drawImage(img, cx - S, cy - S, S * 2, S * 2, col * cw, rowI * cw, cw, cw)
      g.fillStyle = "red"
      g.font = "20px sans-serif"
      g.fillText(`${t.arm} k=${t.k}`, col * cw + 6, rowI * cw + 24)
      i++
    }
    writeFileSync(join(OUT, "k61-crops.png"), can.toBuffer("image/png"))
    console.log(`crops centred on (${cx.toFixed(0)}, ${cy.toFixed(0)}), ${S * 2} px square at ${Z}x -> ${join(OUT, "k61-crops.png")}`)
  }
  writeFileSync(join(OUT, "k61.json"), JSON.stringify({ dir: DIR, report }, null, 2))
}
