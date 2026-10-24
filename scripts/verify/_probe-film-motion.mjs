// WHAT MOVES, WHEN, AND BY HOW MUCH — read off the FILM, frame to frame.
//
// A contact sheet shows poses; it cannot show which frames are doing work. This
// walks the real-time film and reports, per painted frame, how much of the
// picture changed since the frame before it — then rolls that up per phase and
// flags stretches where nothing changed at all.
//
// It exists because the film's timing report found a 0.250s stretch in
// `standup` with no painted frame at all, and there are two very different
// explanations: the beat is genuinely still there (dead air at the end of its
// largest gesture), or the change was below the compositor's damage threshold.
// The first is a craft defect and the second is not, and only the pixels can
// say which.
//
//   node scripts/verify/_probe-film-motion.mjs --label=shipped

import { readFileSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createCanvas, loadImage } from "@napi-rs/canvas"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "shipped")
const BASE = join(ROOT, "docs", "verification", "hero-beat-film", LABEL)

const d = JSON.parse(readFileSync(join(BASE, "trace.json"), "utf8"))
const files = readdirSync(join(BASE, "frames")).filter((f) => f.endsWith(".png")).sort()

const play = (() => {
  const i0 = d.trace.findIndex((r) => r[1] > 0.001)
  return i0 >= 0 ? d.trace.slice(i0) : d.trace
})()
const t0 = play[0][0]
const atTape = (s) => {
  let b = play[0]
  for (const r of play) if (Math.abs((r[0] - t0) / 1000 - s) < Math.abs((b[0] - t0) / 1000 - s)) b = r
  return b
}

async function grey(file) {
  const img = await loadImage(join(BASE, "frames", file))
  // Downsample to a fixed width: the question is "did the picture change",
  // not "did one antialiased pixel flicker", and a full-res diff at 1120px
  // makes every frame look busy because of the ink's own edge ramp.
  const W = 280
  const H = Math.round((img.height / img.width) * W)
  const c = createCanvas(W, H)
  const ctx = c.getContext("2d")
  ctx.drawImage(img, 0, 0, W, H)
  const { data } = ctx.getImageData(0, 0, W, H)
  const g = new Float32Array(W * H)
  for (let p = 0; p < W * H; p++) {
    const i = p * 4
    g[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
  }
  return { g, W, H }
}

let prev = null
const rows = []
for (let i = 0; i < files.length; i++) {
  const cur = await grey(files[i])
  if (prev) {
    /* ⚠ THE FIRST VERSION OF THIS PROBE CALLED THE DRAW-IN DEAD AIR — and it was
     * wrong, and it was caught by LOOKING at the frames rather than by reading
     * the number. A pen tip advancing a few pixels changes about 12 cells of a
     * 280x210 grid, i.e. 0.02 % — under the 0.05 % "still" threshold that is
     * right for a camera move. So the roll-up reported 459 of 462 draw frames
     * still and a 3.49s frozen run, on a phase where the word is visibly
     * writing itself in a hand.
     *
     * A percentage of the FRAME is the wrong denominator for a thin line. The
     * count of changed cells is kept for the camera phases, where it is the
     * right question, and `changed` (absolute) is what the stillness verdict
     * reads — one changed cell is one changed cell whether the mark is a
     * hairline or a solid. */
    let changed = 0
    let sum = 0
    for (let p = 0; p < cur.g.length; p++) {
      const dd = Math.abs(cur.g[p] - prev.g[p])
      sum += dd
      if (dd > 6) changed++
    }
    var changedCells = changed
    const tr = atTape(d.manifest[i].tSec)
    rows.push({
      i,
      tape: d.manifest[i].tSec,
      t: tr[1],
      phase: tr[2],
      pct: (100 * changed) / cur.g.length,
      cells: changedCells,
      mad: sum / cur.g.length,
      dt: d.manifest[i].tSec - d.manifest[i - 1].tSec,
    })
  }
  prev = cur
}

// Per-phase roll-up.
const byPhase = {}
for (const r of rows) (byPhase[r.phase ?? "-"] ??= []).push(r)
console.log(`\n=== FRAME-TO-FRAME MOTION — ${LABEL} ===`)
console.log(`phase          frames  mean cells  max cells   still(<8 cells)  longest still run`)
for (const [p, a] of Object.entries(byPhase)) {
  // STILL = fewer than 8 changed cells out of 58,800. A pen tip moving one
  // step changes about 12; a parked camera changes 0-2.
  const dead = a.filter((r) => r.cells < 8)
  let run = 0
  let best = 0
  let bestAt = null
  for (const r of a) {
    if (r.cells < 8) {
      run += r.dt
      if (run > best) {
        best = run
        bestAt = r
      }
    } else run = 0
  }
  console.log(
    `  ${p.padEnd(13)} ${String(a.length).padStart(5)}  ${(a.reduce((x, y) => x + y.cells, 0) / a.length).toFixed(0).padStart(9)}  ${Math.max(...a.map((r) => r.cells)).toFixed(0).padStart(9)}   ${String(dead.length).padStart(5)}/${String(a.length).padEnd(5)}   ${best.toFixed(3)}s${bestAt ? ` ending t=${bestAt.t.toFixed(2)}` : ""}`,
  )
}

// The stretches with no painted frame at all, and what the picture did across
// them — a long gap with a big diff is a DROPPED move; a long gap with a tiny
// diff is a genuinely still picture.
console.log(`\n=== PAINT GAPS > 60 ms — what the picture did across each ===`)
console.log(`  gap     ends t=     phase        change across the gap`)
for (const r of rows.filter((x) => x.dt > 0.06).sort((a, b) => b.dt - a.dt).slice(0, 12)) {
  console.log(
    `  ${r.dt.toFixed(3)}s  ${r.t.toFixed(2).padStart(6)}s   ${(r.phase ?? "-").padEnd(12)} ${r.cells} cells (${r.pct.toFixed(2)}%), mean |Δ| ${r.mad.toFixed(2)} luma`,
  )
}

// The whole series, coarse, so the arc is readable in one screen.
console.log(`\n=== THE ARC — one line per 0.1s of tape (bar = % of pixels changed) ===`)
let bucket = []
let bt = 0
const flush = () => {
  if (!bucket.length) return
  const pct = Math.max(...bucket.map((r) => r.pct))
  const cells = Math.max(...bucket.map((r) => r.cells))
  const r = bucket[bucket.length - 1]
  const bar = "#".repeat(Math.min(60, Math.round(pct * 2)))
  console.log(
    `  ${bt.toFixed(1).padStart(5)}s  t=${r.t.toFixed(2).padStart(5)}  ${(r.phase ?? "-").padEnd(13)} ${String(cells).padStart(5)} cells ${bar}`,
  )
  bucket = []
}
for (const r of rows) {
  if (r.tape >= bt + 0.1) {
    flush()
    bt = Math.floor(r.tape * 10) / 10
  }
  bucket.push(r)
}
flush()
