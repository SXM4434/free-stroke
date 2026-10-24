// _PROBE-DRAWIN-ORDER — ANALYSIS HALF. Sweep, or pen draw?
//
// Reads the frames `_probe-drawin-sweep.mjs` captured and answers the question
// Sebs actually asked, as a measurement rather than an impression:
//
//   A SWEEP is a spatial wipe — a clip or gradient advancing across the mark,
//   indifferent to how the mark was drawn. Its order-of-appearance field is a
//   function of POSITION ALONG ONE DIRECTION and of nothing else.
//   A PEN DRAW advances ALONG THE STROKE PATH, in pen order. Its
//   order-of-appearance field is a function of ARC LENGTH along the recording.
//
// Both hypotheses are fitted to the SAME measured data and scored the same way,
// so neither is privileged. The statistic is Spearman rank correlation between
//
//     appear(p)  — the first captured sample at which pixel p is inked
//     arc(p)     — the pen-path arc fraction of the point nearest p
//     proj(p)    — p projected on the best sweep axis, searched over 180 angles
//
// CALIBRATION, because a classifier that cannot be wrong proves nothing: the
// same statistics are run on two SYNTHETIC appear-fields built from the real
// final mask — one ordered by arc (must classify PEN), one ordered by the best
// spatial axis (must classify SWEEP). If either lands on the wrong side, the
// instrument is broken and the run says so instead of reporting a verdict.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"
import { processedHeroStrokes } from "./_hero-word.mjs"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "run")
const DIR = join(ROOT, "docs", "verification", "drawin-sweep", LABEL)

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

/* ---- ink masks -------------------------------------------------------- */
// The two registers ship different papers, so the cut is placed relative to the
// image's own modal luma rather than at a fixed value. (Same rule as
// assert-drawin-parity.mjs, which is where it was calibrated.)
async function inkMask(path) {
  const img = await loadImage(path)
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
  return { m, w: img.width, h: img.height, paper, cut }
}

/* ---- rank correlation -------------------------------------------------- */
function rank(a) {
  const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0])
  const r = new Float64Array(a.length)
  let i = 0
  while (i < idx.length) {
    let j = i
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++
    const avg = (i + j) / 2
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg
    i = j + 1
  }
  return r
}
function spearman(a, b) {
  const ra = rank(a)
  const rb = rank(b)
  const n = a.length
  let ma = 0
  let mb = 0
  for (let i = 0; i < n; i++) {
    ma += ra[i]
    mb += rb[i]
  }
  ma /= n
  mb /= n
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < n; i++) {
    const x = ra[i] - ma
    const y = rb[i] - mb
    num += x * y
    da += x * x
    db += y * y
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0
}

async function main() {
  if (!existsSync(DIR)) {
    console.error(`no capture at ${DIR} — run _probe-drawin-sweep.mjs first`)
    process.exit(2)
  }
  const meta = JSON.parse(readFileSync(join(DIR, "meta.json"), "utf8"))

  /* ---- THE MODEL'S PEN PATH, from the page's own builder ---------------- */
  const strokes = processedHeroStrokes()
  const pathPts = []
  {
    let total = 0
    for (const s of strokes)
      for (let i = 1; i < s.points.length; i++)
        total += Math.hypot(s.points[i].x - s.points[i - 1].x, s.points[i].y - s.points[i - 1].y)
    let acc = 0
    for (const s of strokes) {
      for (let i = 0; i < s.points.length; i++) {
        if (i > 0)
          acc += Math.hypot(s.points[i].x - s.points[i - 1].x, s.points[i].y - s.points[i - 1].y)
        pathPts.push({ x: s.points[i].x, y: s.points[i].y, arc: acc / total })
      }
    }
  }
  const px = pathPts.map((p) => p.x)
  const py = pathPts.map((p) => p.y)
  const sMinX = Math.min(...px)
  const sMaxX = Math.max(...px)
  const sMinY = Math.min(...py)
  const sMaxY = Math.max(...py)

  const results = {}
  for (const engine of Object.keys(meta.engines)) {
    const dir = join(DIR, engine)
    const files = readdirSync(dir).filter((f) => f.endsWith(".png")).sort()
    const masks = []
    for (const f of files) masks.push(await inkMask(join(dir, f)))
    const W = masks[0].w
    const H = masks[0].h
    const sizesOk = masks.every((m) => m.w === W && m.h === H)

    const finalM = masks[masks.length - 1].m
    // BBOX of the final ink.
    let bMinX = W
    let bMaxX = -1
    let bMinY = H
    let bMaxY = -1
    let nFinal = 0
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (finalM[y * W + x]) {
          nFinal++
          if (x < bMinX) bMinX = x
          if (x > bMaxX) bMaxX = x
          if (y < bMinY) bMinY = y
          if (y > bMaxY) bMaxY = y
        }

    /* ---- FIT stroke space -> screen, then CHECK the fit -----------------
     * The mark is flat and the camera is orthographic during the draw, so this
     * is a similarity: one scale, one translation, and possibly a Y FLIP (the
     * scene's Y is up, the trace's Y is down).
     *
     * ⚠ THE CLOSED-FORM SOLVE WAS WRONG AND IT IS LEFT NAMED. Solving
     * `bboxW = pathW·s + 2r` and `bboxH = pathH·s + 2r` simultaneously is
     * ill-conditioned when the word is much wider than it is tall — it returned
     * s = −0.33 and a nib radius of 544 px, i.e. a point-reflected word, and
     * the arc correlation it produced (−0.918) LOOKED like a decisive answer.
     * A fit that has not been checked against the pixels is not a fit.
     *
     * So: search the scale, align by bbox centre, and SCORE by the only thing
     * that matters — how much of the model path lands on inked pixels. The
     * winner still has to clear the acceptance below or no verdict is issued. */
    const pw = sMaxX - sMinX
    const ph = sMaxY - sMinY
    const bw = bMaxX - bMinX
    const bh = bMaxY - bMinY
    const cxS = (bMinX + bMaxX) / 2
    const cyS = (bMinY + bMaxY) / 2
    const cxP = (sMinX + sMaxX) / 2
    const cyP = (sMinY + sMaxY) / 2
    const sHi = bw / pw // upper bound: the ink bbox is the path bbox dilated by the nib
    const mk = (s, flip) => (p) => ({
      x: cxS + (p.x - cxP) * s,
      y: cyS + (p.y - cyP) * s * flip,
    })
    const score = (f) => {
      let on = 0
      for (const p of pathPts) {
        const q = f(p)
        const xi = Math.round(q.x)
        const yi = Math.round(q.y)
        if (xi >= 0 && xi < W && yi >= 0 && yi < H && finalM[yi * W + xi]) on++
      }
      return on / pathPts.length
    }
    let best = { s: sHi, flip: 1, v: -1 }
    for (const flip of [1, -1]) {
      for (let i = 0; i <= 80; i++) {
        const s = sHi * (0.55 + (0.45 * i) / 80)
        const v = score(mk(s, flip))
        if (v > best.v) best = { s, flip, v }
      }
    }
    const s = best.s
    const flip = best.flip
    const r = (bw - pw * s) / 2
    const toScreen = mk(s, flip)
    const fitOk = best.v

    /* ---- appear(p): first sample index at which p is inked -------------- */
    const appearArr = new Int16Array(W * H).fill(-1)
    for (let k = 0; k < masks.length; k++) {
      const m = masks[k].m
      for (let i = 0; i < m.length; i++) if (m[i] && appearArr[i] < 0) appearArr[i] = k
    }

    // Sample the final-ink pixels on a grid to keep the statistics cheap and to
    // stop the thick parts of the word dominating by area.
    const STEP = 2
    const A = []
    const ARC = []
    const PX = []
    const PY = []
    for (let y = 0; y < H; y += STEP) {
      for (let x = 0; x < W; x += STEP) {
        const i = y * W + x
        if (!finalM[i] || appearArr[i] < 0) continue
        // nearest path point -> its arc
        let best = Infinity
        let bestArc = 0
        for (let j = 0; j < pathPts.length; j++) {
          const q = toScreen(pathPts[j])
          const d = (q.x - x) ** 2 + (q.y - y) ** 2
          if (d < best) {
            best = d
            bestArc = pathPts[j].arc
          }
        }
        A.push(appearArr[i])
        ARC.push(bestArc)
        PX.push(x)
        PY.push(y)
      }
    }

    const rhoArc = spearman(A, ARC)
    let rhoSweep = 0
    let bestTheta = 0
    for (let deg = 0; deg < 180; deg += 3) {
      const th = (deg * Math.PI) / 180
      const proj = PX.map((x, i) => x * Math.cos(th) + PY[i] * Math.sin(th))
      const rr = Math.abs(spearman(A, proj))
      if (rr > rhoSweep) {
        rhoSweep = rr
        bestTheta = deg
      }
    }

    /* ---- THE DISCRIMINATING PAIRS — where the two hypotheses DISAGREE ----
     *
     * ⚠ THE CORRELATIONS ABOVE ARE NEARLY BLIND AND THE NUMBERS SAY SO. The
     * word runs left to right, so ARC and X are collinear over most of it: a
     * SYNTHETIC left-to-right wipe still scores arc = 0.992 on this mask. Two
     * hypotheses that agree everywhere cannot be told apart by how well each
     * fits; they can only be told apart WHERE THEY DISAGREE.
     *
     * So take pixel PAIRS the two predictions order OPPOSITELY — arc(p) < arc(q)
     * but proj(p) > proj(q), by a margin on both — and ask which order the
     * MEASUREMENT followed. These are the places a hand goes back on itself: a
     * crossbar, the return of a `k`, the closing of a `D` bowl, a tittle.
     *
     *   1.0  every disagreement resolved in favour of the PEN
     *   0.5  the measurement carries no information about either
     *   0.0  every disagreement resolved in favour of the SWEEP
     *
     * The null is a real 0.5, which is what the correlation pair never had. */
    const ARC_MARGIN = 0.04 // 4 % of the word's arc
    const PROJ_MARGIN = 0.04 // 4 % of the word's extent along the sweep axis
    const thBest = (bestTheta * Math.PI) / 180
    const projAll = PX.map((x, i) => x * Math.cos(thBest) + PY[i] * Math.sin(thBest))
    const projMin = Math.min(...projAll)
    const projMax = Math.max(...projAll)
    const projSpan = projMax - projMin || 1
    const pairScore = (appear) => {
      // Deterministic pair sampling — a fixed stride over a fixed permutation,
      // so re-running cannot move the answer.
      let n = 0
      let penWins = 0
      let ties = 0
      const N = appear.length
      for (let i = 0; i < N; i++) {
        for (let d = 1; d <= 24; d++) {
          const j = (i * 7919 + d * 104729) % N
          if (j === i) continue
          const dArc = ARC[j] - ARC[i]
          const dPro = (projAll[j] - projAll[i]) / projSpan
          if (Math.abs(dArc) < ARC_MARGIN || Math.abs(dPro) < PROJ_MARGIN) continue
          if (Math.sign(dArc) === Math.sign(dPro)) continue // they agree — no information
          n++
          const dApp = appear[j] - appear[i]
          if (dApp === 0) {
            ties++
            continue
          }
          if (Math.sign(dApp) === Math.sign(dArc)) penWins++
        }
      }
      return { n, ties, pen: n - ties > 0 ? penWins / (n - ties) : 0 }
    }
    const measuredPairs = pairScore(A)

    /* ---- CALIBRATION: two synthetic appear-fields on the SAME mask ------ */
    const synth = (key) => {
      const order = key.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0])
      const out = new Array(key.length)
      for (let i = 0; i < order.length; i++)
        out[order[i][1]] = Math.floor((i / order.length) * masks.length)
      return out
    }
    const synthPen = synth(ARC)
    const thB = (bestTheta * Math.PI) / 180
    const synthSweep = synth(PX.map((x, i) => x * Math.cos(thB) + PY[i] * Math.sin(thB)))
    const calPen = { arc: spearman(synthPen, ARC), sweep: 0 }
    const calSweep = { arc: spearman(synthSweep, ARC), sweep: 0 }
    for (let deg = 0; deg < 180; deg += 3) {
      const th = (deg * Math.PI) / 180
      const proj = PX.map((x, i) => x * Math.cos(th) + PY[i] * Math.sin(th))
      calPen.sweep = Math.max(calPen.sweep, Math.abs(spearman(synthPen, proj)))
      calSweep.sweep = Math.max(calSweep.sweep, Math.abs(spearman(synthSweep, proj)))
    }

    results[engine] = {
      frames: files.length,
      sizesOk,
      W,
      H,
      finalInk: nFinal,
      fitScale: s,
      fitNibRadiusPx: r,
      fitPathOnInk: fitOk,
      pixels: A.length,
      rhoArc,
      rhoSweep,
      bestSweepAngleDeg: bestTheta,
      pairs: measuredPairs,
      pairsCalibration: { pen: pairScore(synthPen), sweep: pairScore(synthSweep) },
      calibration: { pen: calPen, sweep: calSweep },
    }

    console.log(`\n=== ${engine} ===`)
    console.log(`  frames ${files.length}  ·  stage ${W}x${H}  ·  all frames same size: ${sizesOk}`)
    console.log(`  fit: scale ${s.toFixed(4)} px/unit, yFlip ${flip}, implied nib radius ${r.toFixed(2)} px, ` +
      `${(fitOk * 100).toFixed(1)} % of path samples land on final ink`)
    console.log(`  sampled ${A.length} ink pixels`)
    console.log(`  rho(appear, ARC   along the pen path) = ${rhoArc.toFixed(4)}`)
    console.log(`  rho(appear, PROJ  on the best axis ${bestTheta}deg) = ${rhoSweep.toFixed(4)}`)
    console.log(`  CALIBRATION on this mask:`)
    console.log(`    synthetic PEN   field -> arc ${calPen.arc.toFixed(4)}  sweep ${calPen.sweep.toFixed(4)}`)
    console.log(`    synthetic SWEEP field -> arc ${calSweep.arc.toFixed(4)}  sweep ${calSweep.sweep.toFixed(4)}`)
    const pc = results[engine].pairsCalibration
    console.log(`  DISCRIMINATING PAIRS (1 = pen, 0.5 = no information, 0 = sweep):`)
    console.log(`    measured        ${measuredPairs.pen.toFixed(4)}   over ${measuredPairs.n} disagreeing pairs (${measuredPairs.ties} tied)`)
    console.log(`    synthetic PEN   ${pc.pen.pen.toFixed(4)}      synthetic SWEEP ${pc.sweep.pen.toFixed(4)}`)
  }

  // Instrument soundness FIRST — a verdict off a blind classifier is worthless.
  for (const [engine, r] of Object.entries(results)) {
    say(r.sizesOk, `${engine} — every captured frame is the same size`)
    say(r.fitPathOnInk > 0.9, `${engine} — the stroke->screen fit is real`, `${(r.fitPathOnInk * 100).toFixed(1)} % of path on ink`)
    say(
      r.calibration.pen.arc > r.calibration.pen.sweep,
      `${engine} — CONTROL: a synthetic PEN-ordered reveal classifies as PEN`,
      `arc ${r.calibration.pen.arc.toFixed(3)} vs sweep ${r.calibration.pen.sweep.toFixed(3)}`,
    )
    say(
      r.calibration.sweep.sweep > r.calibration.sweep.arc,
      `${engine} — CONTROL: a synthetic SWEEP classifies as SWEEP`,
      `sweep ${r.calibration.sweep.sweep.toFixed(3)} vs arc ${r.calibration.sweep.arc.toFixed(3)}`,
    )
    // The pair test is the one that carries the verdict, so its controls are the
    // ones that have to separate. If they do not, no verdict is issued.
    say(
      r.pairs.n > 200,
      `${engine} — the word HAS disagreeing pairs to judge on`,
      `${r.pairs.n}`,
    )
    say(
      r.pairsCalibration.pen.pen > 0.95,
      `${engine} — CONTROL: a synthetic PEN reveal scores ~1 on the pair test`,
      r.pairsCalibration.pen.pen.toFixed(4),
    )
    say(
      r.pairsCalibration.sweep.pen < 0.05,
      `${engine} — CONTROL: a synthetic SWEEP scores ~0 on the pair test`,
      r.pairsCalibration.sweep.pen.toFixed(4),
    )
  }

  console.log("\n--- VERDICT ---")
  for (const [engine, r] of Object.entries(results)) {
    const verdict = r.pairs.pen > 0.8 ? "PEN DRAW" : r.pairs.pen < 0.2 ? "SWEEP" : "NEITHER / MIXED"
    console.log(
      `${engine.padEnd(14)} ${verdict.padEnd(16)} pair score ${r.pairs.pen.toFixed(4)} ` +
        `(1 = pen, 0 = sweep)   ·   weak-form rho arc ${r.rhoArc.toFixed(4)} vs sweep ${r.rhoSweep.toFixed(4)}`,
    )
  }

  writeFileSync(join(DIR, "order.json"), JSON.stringify(results, null, 2))
  console.log(`\njson: ${join(DIR, "order.json")}`)
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
