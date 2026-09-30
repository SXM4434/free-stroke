// _probe-pair-sheet.mjs — PUT THE TWO PRESETS THAT COLLAPSED SIDE BY SIDE, BIG.
//
// `assert-screen-layers` decides the collapse with one number (mean |ΔL| over the
// macro crop). A number cannot say WHAT is the same, and re-authoring a look
// needs that: `woodgrain` and `scanlines` both draw a family of lines across the
// same axis, so the question is not "how far apart are they" but "which of the
// things that make timber read as timber are missing".
//
// So this writes a sheet at 6x nearest-neighbour — no smoothing, because the
// subject IS the lattice — with the pair, their per-pixel difference, and the
// gate's own Δ printed on it. Sheets are >= 1440 on the long edge.
//
//   node scripts/verify/_probe-pair-sheet.mjs --label=final --out=before \
//        --pairs=rod:texture:scanlines:woodgrain,rod:dither:hardThreshold:pixelSignal
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`))
  return h ? h.split("=")[1] : d
}
const LABEL = arg("label", "final")
/* TWO LABELS = ONE PRESET, BEFORE AND AFTER. With --labelB the left cell is read
 * from that capture and the right from --label, so `woodgrain:woodgrain` puts
 * the parked prior render beside the re-authored one on the same subject, at the
 * same framing, from the same instrument. That is the only comparison that can
 * settle "is this a different look" — a Δ between two DIFFERENT presets says
 * they are apart, never that either one moved. */
const LABEL_B = arg("labelB", "")
const OUTNAME = arg("out", LABEL)
const ZOOM = Number(arg("zoom", 6))
const PAIRS = arg(
  "pairs",
  "rod:texture:scanlines:woodgrain,rod:dither:hardThreshold:pixelSignal",
)
  .split(",")
  .map((s) => s.split(":"))
const SRC = join(ROOT, "docs", "verification", "screen-layers", LABEL)
const OUT = join(ROOT, "docs", "verification", "preset-pairs")

async function lumOf(path) {
  const img = await loadImage(path)
  const cv = createCanvas(img.width, img.height)
  const g = cv.getContext("2d")
  g.drawImage(img, 0, 0)
  const d = g.getImageData(0, 0, img.width, img.height).data
  const L = new Float32Array(img.width * img.height)
  for (let i = 0, q = 0; i < d.length; i += 4, q++) L[q] = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
  return { img, L, w: img.width, h: img.height }
}
const meanAbs = (a, b) => {
  let s = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i])
  return s / n
}

mkdirSync(OUT, { recursive: true })
const report = existsSync(join(SRC, "report.json")) ? JSON.parse(readFileSync(join(SRC, "report.json"), "utf8")) : []

const SRC_B = LABEL_B ? join(ROOT, "docs", "verification", "screen-layers", LABEL_B) : SRC
for (const [mode, rail, aId, bId] of PAIRS) {
  // With --labelB the LEFT cell is the prior capture, the right the current one.
  const pa = join(LABEL_B ? SRC_B : SRC, "crops", `${mode}_${rail}_${aId}_macro.png`)
  const pb = join(SRC, "crops", `${mode}_${rail}_${bId}_macro.png`)
  if (!existsSync(pa) || !existsSync(pb)) {
    console.log(`MISS  ${mode}/${rail}/${aId} vs ${bId} — no crops under ${LABEL_B || LABEL}/${LABEL}`)
    continue
  }
  const A = await lumOf(pa)
  const B = await lumOf(pb)
  const d = meanAbs(A.L, B.L)

  const cw = A.w * ZOOM
  const ch = A.h * ZOOM
  const pad = 24
  const head = 96
  const W = pad * 4 + cw * 3
  const H = head + ch + pad * 2 + 34
  const cv = createCanvas(W, H)
  const g = cv.getContext("2d")
  g.fillStyle = "#101012"
  g.fillRect(0, 0, W, H)
  g.imageSmoothingEnabled = false

  g.fillStyle = "#f4f4f5"
  g.font = "600 30px sans-serif"
  g.fillText(
    LABEL_B ? `${mode} · ${rail} — ${bId}: ${LABEL_B} (before) vs ${LABEL} (after)` : `${mode} · ${rail} — ${aId} vs ${bId}`,
    pad,
    44,
  )
  g.font = "400 21px sans-serif"
  g.fillStyle = LABEL_B ? "#9ad4ff" : d < 1 ? "#ff6b6b" : d < 6 ? "#ffd166" : "#7ee787"
  g.fillText(
    LABEL_B
      ? `the SAME preset, the same framing, the same instrument — mean |ΔL| between the two renders ${d.toFixed(3)}`
      : `assert-screen-layers Δ ${d.toFixed(3)} · same rail, so time cannot separate them · WARN under 6.0, SAME FRAME under 1.0`,
    pad,
    78,
  )

  const x0 = pad
  const x1 = pad * 2 + cw
  const x2 = pad * 3 + cw * 2
  g.drawImage(A.img, 0, 0, A.w, A.h, x0, head, cw, ch)
  g.drawImage(B.img, 0, 0, B.w, B.h, x1, head, cw, ch)

  // The difference, amplified 6x so a 4-unit gap is visible at all.
  const dc = createCanvas(A.w, A.h)
  const dg = dc.getContext("2d")
  const im = dg.createImageData(A.w, A.h)
  for (let i = 0; i < A.L.length; i++) {
    const v = Math.min(255, Math.abs(A.L[i] - B.L[i]) * 6)
    im.data[i * 4] = v
    im.data[i * 4 + 1] = v * 0.72
    im.data[i * 4 + 2] = v * 0.3
    im.data[i * 4 + 3] = 255
  }
  dg.putImageData(im, 0, 0)
  g.drawImage(dc, 0, 0, A.w, A.h, x2, head, cw, ch)

  g.fillStyle = "#a1a1aa"
  g.font = "400 20px sans-serif"
  const y = head + ch + 26
  g.fillText(LABEL_B ? `${aId} — BEFORE (${LABEL_B})` : aId, x0, y)
  g.fillText(LABEL_B ? `${bId} — AFTER (${LABEL})` : bId, x1, y)
  g.fillText("|Δ| x6 — where they differ at all", x2, y)

  const reportB = LABEL_B && existsSync(join(SRC_B, "report.json"))
    ? JSON.parse(readFileSync(join(SRC_B, "report.json"), "utf8"))
    : report
  const row = (id, rep) => (rep ?? report).find((r) => r.mode === mode && r.rail === rail && r.preset === id)
  const ra = row(aId, reportB)
  const rb = row(bId)
  if (ra && rb) {
    g.fillStyle = "#71717a"
    g.font = "400 18px sans-serif"
    g.fillText(`dOff ${ra.dOff} · levels ${ra.levels}`, x0, y + 24)
    g.fillText(`dOff ${rb.dOff} · levels ${rb.levels}`, x1, y + 24)
  }

  const file = join(OUT, `${OUTNAME}_${mode}_${rail}_${aId}-vs-${bId}.png`)
  writeFileSync(file, cv.toBuffer("image/png"))
  console.log(`${file.replace(ROOT + "/", "")}  ${W}x${H}  Δ ${d.toFixed(3)}`)
}
