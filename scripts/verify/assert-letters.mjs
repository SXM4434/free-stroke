// ASSERT-LETTERS: letter by letter, one letter at a time, each landing dead on.
//
// HIS WORDS, 2026-09-26, on the hero beat: "Dead on, letter by letter, let's see if you fix it
// letter by letter. The lettering is still fucked up, bro." Before that: "they dont go letter by
// letter, some go multiple at a time", and the letters "overlap into the next letter".
//
// WHAT IT FILMS. /desk-doodles, film `letterByLetter`, the page's default engine. The page's own
// transport is scrubbed to every 30 fps frame, from 1 s before the cascade to the first frame of
// the return, and the stage is screenshotted each time. The scrub steps in 0.01 s, so frame f is
// sampled at f/30 rounded to 0.01 s; the model below is sampled at the same rounded time.
//
// HOW A LETTER IS FOUND IN THE PIXELS. Ink is any pixel more than 40 away from the paper in some
// channel. The letters touch at rest, so each one is found by its own turn: see `measure`.
//
// ROWS, each printing its denominator:
//   L1  at most one letter TURNS between two consecutive frames (its yaw changes; its own columns
//       change while the word is not moving as a whole), from the cascade's first frame to the
//       frame the whole word starts to turn. Model and pixels, each able to fail it alone (C7).
//   L2  no neighbour pair's ink boxes overlap by more than they do at rest, plus 1 px, and no
//       pair is joined that was apart at rest. A letter drawn as a solid is compared with the
//       same letter at rest as a solid, never with its flat ink (see L2 below).
//   L3  the word's ink width stays within 2 % of rest, on every frame where neither end letter
//       is mid-turn (an end letter turning about its own centre narrows the word by up to half its
//       own width, which is the turn and not a slide).
//   L4  every letter ends its own turn dead on: the model's yaw is 0 on the frame it lands, and
//       its ink box before the word turns is its rest box within 2 px per edge.
//   C*  the instrument: rest finds one piece per letter, and each row's must-fail arm fires.
//
// CORPUS. The traced "Desk Doodles" on /desk-doodles only. It does not see `/`, which has no
// letter-by-letter pill yet, and it does not see a hand-drawn word.
//
// Usage:
//   FS_HEADED=0 FS_PORT=3138 node scripts/verify/assert-letters.mjs --label=before
//   node scripts/verify/assert-letters.mjs --label=before --from-disk   (re-measure saved frames)
//   node scripts/verify/assert-letters.mjs --sheet=before,after
import { chromium } from "./lib/browser.mjs"
import { HERO_URL } from "./lib/dev-server.mjs"
import { loadTs } from "./_ts-load.mjs"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`))
  if (a) return a.slice(k.length + 3)
  return process.argv.includes(`--${k}`) ? true : d
}
const LABEL = arg("label", "current")
const BASE = path.join(ROOT, "docs/verification/letters")
const OUT = path.join(BASE, LABEL)
const FPS = 30
const INK_T = 40
const MIN_AREA = 12
const pageTime = (f) => Math.round((f / FPS) * 100) / 100

/* ---------------------------------------------------------------- filming */
async function film() {
  fs.mkdirSync(path.join(OUT, "frames"), { recursive: true })
  for (const f of fs.readdirSync(path.join(OUT, "frames"))) fs.unlinkSync(path.join(OUT, "frames", f))
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)))
  try {
    await page.goto(HERO_URL, { waitUntil: "networkidle" })
    await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
    await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 120000 })
    await page.waitForTimeout(2500)
    const pill = page.locator('[data-read-film="letterByLetter"]')
    if ((await pill.count()) !== 1) throw new Error('no [data-read-film="letterByLetter"] pill')
    await pill.click()
    await page.waitForTimeout(3000)
    const engine = await page.evaluate(
      () => document.querySelector("[data-engine-family]")?.getAttribute("data-engine-family") ?? null,
    )
    const seek = async (t) => {
      await page.evaluate((tt) => {
        const el = document.querySelector("[data-hero-scrub]")
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
        setter.call(el, String(tt))
        el.dispatchEvent(new Event("input", { bubbles: true }))
        el.dispatchEvent(new Event("change", { bubbles: true }))
      }, t)
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
      await page.waitForTimeout(120)
    }
    const phaseAt = () =>
      page.evaluate(() => document.querySelector("[data-hero-phase]")?.getAttribute("data-hero-phase") ?? null)
    const total = Number(await page.evaluate(() => document.querySelector("[data-hero-scrub]").getAttribute("max")))
    // The cascade and the return are found by NAME, and this pass is also the warm-up.
    let tE = null
    let tR = null
    for (let t = 0; t <= total + 1e-9; t += 0.1) {
      await seek(Math.round(t * 100) / 100)
      const ph = await phaseAt()
      if (ph === "emerge" && tE === null) tE = t
      if (ph === "returnTurn" && tE !== null && tR === null) tR = t
    }
    if (tE === null) throw new Error("no emerge phase on the transport")
    if (tR === null) tR = Math.min(total, tE + 9)
    const f0 = Math.max(0, Math.floor(tE * FPS) - 30)
    const f1 = Math.min(Math.floor(total * FPS), Math.ceil(tR * FPS) + 3)
    const stage = page.locator("[data-hero-stage]")
    const frames = []
    for (let f = f0; f <= f1; f++) {
      await seek(pageTime(f))
      const phase = await phaseAt()
      fs.writeFileSync(path.join(OUT, "frames", `f${String(f).padStart(4, "0")}.png`), await stage.screenshot())
      frames.push({ f, phase })
    }
    fs.writeFileSync(
      path.join(OUT, "film.json"),
      JSON.stringify({ url: HERO_URL, engine, total, tE, tR, f0, f1, errors, frames }, null, 1),
    )
    console.log(`filmed ${frames.length} frames (f${f0}..f${f1}), engine ${engine}, page errors ${errors.length}`)
  } finally {
    await context.close()
    await browser.close()
  }
}

/* ------------------------------------------------------------ measurement */
async function readRGBA(file) {
  const img = await loadImage(fs.readFileSync(file))
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  return { W: img.width, H: img.height, d: x.getImageData(0, 0, img.width, img.height).data, img }
}

function paperOf({ W, H, d }) {
  const acc = [0, 0, 0]
  let n = 0
  for (const [cx, cy] of [[4, 4], [W - 12, 4], [4, H - 12], [W - 12, H - 12]])
    for (let y = cy; y < cy + 8; y++)
      for (let x = cx; x < cx + 8; x++) {
        const i = (y * W + x) * 4
        acc[0] += d[i]; acc[1] += d[i + 1]; acc[2] += d[i + 2]; n++
      }
  return acc.map((v) => v / n)
}

function maskOf({ W, H, d }, paper) {
  const m = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) {
    const o = i * 4
    const dd = Math.max(Math.abs(d[o] - paper[0]), Math.abs(d[o + 1] - paper[1]), Math.abs(d[o + 2] - paper[2]))
    m[i] = dd > INK_T ? 1 : 0
  }
  return m
}

const bbox = (mask, roi, keep) => {
  let b = null
  for (let y = roi.y0; y < roi.y1; y++)
    for (let x = roi.x0; x < roi.x1; x++) {
      const i = y * roi.W + x
      if (!mask[i] || (keep && !keep(i))) continue
      if (!b) b = { x0: x, x1: x, y0: y, y1: y, area: 0 }
      b.area++
      if (x < b.x0) b.x0 = x
      if (x > b.x1) b.x1 = x
      if (y < b.y0) b.y0 = y
      if (y > b.y1) b.y1 = y
    }
  return b
}
// Specks under 6 px are anti-aliasing on a still letter's edge, not a letter.
function despeck(mask, roi) {
  const out = new Uint8Array(mask.length)
  const seen = new Uint8Array(mask.length)
  const st = []
  for (let y = roi.y0; y < roi.y1; y++)
    for (let x = roi.x0; x < roi.x1; x++) {
      const i0 = y * roi.W + x
      if (!mask[i0] || seen[i0]) continue
      const px = []
      seen[i0] = 1; st.push(i0)
      while (st.length) {
        const j = st.pop(); px.push(j)
        const jx = j % roi.W, jy = (j - jx) / roi.W
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = jx + dx, ny = jy + dy
          if (nx < roi.x0 || nx >= roi.x1 || ny < roi.y0 || ny >= roi.y1) continue
          const k = ny * roi.W + nx
          if (mask[k] && !seen[k]) { seen[k] = 1; st.push(k) }
        }
      }
      if (px.length >= 6) for (const j of px) out[j] = 1
    }
  return out
}
// Square dilation by r px inside the roi: separable max, rows then columns.
function dilate(mask, roi, r) {
  const { W } = roi
  const h = new Uint8Array(mask.length), out = new Uint8Array(mask.length)
  for (let y = roi.y0; y <= roi.y1; y++) for (let x = roi.x0; x <= roi.x1; x++) {
    let v = 0
    for (let d = -r; d <= r && !v; d++) { const xx = x + d; if (xx >= roi.x0 && xx <= roi.x1 && mask[y * W + xx]) v = 1 }
    h[y * W + x] = v
  }
  for (let y = roi.y0; y <= roi.y1; y++) for (let x = roi.x0; x <= roi.x1; x++) {
    let v = 0
    for (let d = -r; d <= r && !v; d++) { const yy = y + d; if (yy >= roi.y0 && yy <= roi.y1 && h[yy * W + x]) v = 1 }
    out[y * W + x] = v
  }
  return out
}
const ovS = (a, b) => (a && b ? Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) : -Infinity)
const same = (a, b) => Math.abs(a.yaw - b.yaw) < 1e-9 && a.flat === b.flat && Math.abs(a.depth - b.depth) < 1e-9 && Math.abs((a.settle ?? 0) - (b.settle ?? 0)) < 1e-9

// HOW A LETTER IS FOUND. The word's letters touch at rest (e-s-k, o-o-d-l-e), so connected
// pieces cannot separate them. The film separates them instead: while letter k turns, the model
// says no other letter moves, so the ink that disappears when k goes edge-on is k's own ink, and
// every other ink pixel on the frame before k starts is somebody else's. k's box on a frame of its
// own turn is the box of the ink that is not somebody else's. Ink k puts down over paper is
// counted; ink k puts down exactly on top of another letter's ink cannot be seen, so a slide reads
// short, never long.
async function measure() {
  const meta = JSON.parse(fs.readFileSync(path.join(OUT, "film.json"), "utf8"))
  // --model-rev=<commit> measures a film against the model it was filmed on,
  // so the before film is judged by before's timings, not today's.
  const rev = arg("model-rev", null)
  let M
  if (rev) {
    const tmp = `lib/_hero-motion-at-${rev}.tmp.ts`
    fs.writeFileSync(path.join(ROOT, tmp), execFileSync("git", ["show", `${rev}:lib/hero-motion.ts`], { cwd: ROOT, maxBuffer: 64 << 20 }))
    try { M = loadTs(tmp) } finally { fs.rmSync(path.join(ROOT, tmp)) }
  } else M = loadTs("lib/hero-motion.ts")
  const P0 = { ...M.DEFAULT_HERO_MOTION, shape: "letterByLetter", beats: M.HERO_SHEETS.letterByLetter }
  const N = Math.round(P0.letterCount)
  const frames = meta.frames
  const iE = frames.findIndex((r) => r.phase === "emerge")
  const iS = frames.findIndex((r) => r.phase === "solid")
  const iR = frames.findIndex((r) => r.phase === "returnTurn")
  let iRest = iE - 1
  for (let i = iE - 1; i >= 0; i--) if (frames[i].phase === "breath") { iRest = i; break }
  const end = iR < 0 ? frames.length : iR
  // The word's turn starts `letterWordHoldSec` after the letters' cascade,
  // inside the cascade's own clip since his three calls, 2026-09-26. It used to
  // start `letterWordHoldSec` into `solid`; reading it off `solid` now would grade 32
  // frames of the word turning as letters at rest.
  const tTurn = Number.isFinite(P0.letterWordHoldSec) ? M.phaseOffsets(P0).emerge + M.cascadeSec(P0) + P0.letterWordHoldSec : Infinity
  let iTurn = end
  for (let i = Math.max(0, iE); i < end; i++) if (pageTime(frames[i].f) >= tTurn - 1e-9) { iTurn = i; break }
  const file = (r) => path.join(OUT, "frames", `f${String(r.f).padStart(4, "0")}.png`)

  // The model, at the page's own rounded times.
  const offE = M.phaseOffsets(P0).emerge
  const drift = frames[iE].f / FPS - offE
  const startState = M.sampleLetters(P0, offE - 1e-6)
  const endState = M.sampleLetters(P0, offE + M.cascadeSec(P0) - 1e-6)
  const model = frames.map((r) => M.sampleLetters(P0, pageTime(r.f)) || [])
  const mid = model.map((ls) => ls.map((s, k) => !same(s, startState[k]) && !same(s, endState[k])))

  // Ink masks, all frames, one ROI found on the rest frame.
  const rest = await readRGBA(file(frames[iRest]))
  const paper = paperOf(rest)
  const W = rest.W
  const restMask = maskOf(rest, paper)
  const all = { W, x0: 4, y0: 4, x1: rest.W - 4, y1: rest.H - 4 }
  const wb0 = bbox(despeck(restMask, all), all)
  const pad = Math.round((wb0.x1 - wb0.x0) * 0.2)
  const roi = { W, x0: Math.max(2, wb0.x0 - pad), x1: Math.min(rest.W - 2, wb0.x1 + pad), y0: Math.max(2, wb0.y0 - pad), y1: Math.min(rest.H - 2, wb0.y1 + pad) }
  const ink = []
  for (let i = 0; i < frames.length; i++) ink.push(i < iRest ? null : despeck(maskOf(await readRGBA(file(frames[i])), paper), roi))
  const restW = (() => { const b = bbox(ink[iRest], roi); return b.x1 - b.x0 + 1 })()

  // Each letter's own turn, from the model: first and last mid-turn frame, and its edge frame.
  const letters = []
  for (let k = 0; k < N; k++) {
    const idx = []
    // Its OWN turn only: the first unbroken run. Once the word turns as one,
    // every letter is "mid" again, and folding those frames in stretched each
    // letter's window across every other letter's turn.
    for (let i = iE; i < end; i++) { if (mid[i][k]) idx.push(i); else if (idx.length) break }
    if (!idx.length) { letters.push(null); continue }
    const s = idx[0]
    const e = idx[idx.length - 1]
    let edge = s
    for (const i of idx) if (Math.abs(Math.sin(model[i][k].yaw)) > Math.abs(Math.sin(model[edge][k].yaw)) + 1e-9) edge = i
    // BEFORE = the last frame this letter is still at rest, INSIDE the letter
    // phase. For letter 1 the frame before its turn is the anticipation squash
    // (the word 313px, not 308), so differencing against it marked the whole
    // word as the D's own ink: a 312px "letter" whose box swallowed every other
    // letter's columns, which is what blinded C4 and C5. Its own first frame is
    // in the phase, and flip 1 has turned under a degree by then.
    // FLIP 1 has no such frame: the squash is still releasing through its
    // first 6 frames (313px at f182-186), so it takes the rest frame, the word
    // at 308px. The 2px margin below absorbs the release's stretch, which is
    // 1.5px at the e (95px from the word's centre, 5px over 308).
    const b = s - 1 >= iE ? s - 1 : iRest
    const before = ink[b]
    // OWN INK IS WHAT GOES TO PAPER ON ANY FRAME OF ITS OWN TURN, not only on
    // the edge frame. A solid seen edge-on still shows its depth side around its
    // pivot, and on the d that band covered the bowl: the edge frame kept the
    // bowl as "somebody else's", the d's box shrank to its 7px stem, and the
    // stem swinging in to the d's own pivot read as a 6px slide into the o
    // (f305-f307; seen at 4x in l2-crops-4x-instrument-before.png, clear paper
    // between the o and the d on every frame). Frames under the word's own
    // squash are left out: the other letters stretch then, and their edges would
    // read as this letter's ink. SWEEP is every pixel its turn changes, either
    // way, over the same frames: the undersize guard in C1 holds the box to it.
    const own = new Uint8Array(before.length)
    const edgeOwn = new Uint8Array(before.length)
    const sweep = new Uint8Array(before.length)
    const sqAt = (i) => { const h = M.sampleHeroMotion(P0, pageTime(frames[i].f)); return Math.max(Math.abs((h.squashX ?? 1) - 1), Math.abs((h.squashY ?? 1) - 1)) > 1e-3 }
    for (let j = 0; j < own.length; j++) edgeOwn[j] = before[j] && !ink[edge][j] ? 1 : 0
    // From rest to its edge frame only: in that half a letter can only narrow
    // on its pivot. After the edge the before film's letters landed at 30 deg
    // and slid, and a slide in the sweep made the l "22px wide".
    for (const i of idx) {
      if (i > edge) break
      if (i !== edge && sqAt(i)) continue
      const f = ink[i]
      for (let j = 0; j < own.length; j++) { if (before[j] && !f[j]) own[j] = 1; if (before[j] !== f[j]) sweep[j] = 1 }
    }
    const others = new Uint8Array(before.length)
    for (let j = 0; j < own.length; j++) others[j] = before[j] && !own[j] ? 1 : 0
    // EVERY LETTER BOX IS "ink more than 2px from any other letter's rest ink",
    // at rest and on every frame, so the rest box and the film box are the same
    // measurement. At 3px C4 read a 4px plant on the touching D|o pair as 1px,
    // so the margin is the most the must-fail arm allows, not the most the
    // stretch would like.
    const othersD = dilate(others, roi, 2)
    // The old measurement, kept as the undersize guard's must-fail arm.
    const edgeOthersD = dilate(before.map((v, j) => (v && !edgeOwn[j] ? 1 : 0)), roi, 2)
    letters.push({ s, e, edge, restBox: bbox(before, roi, (j) => !othersD[j]), edgeBox: bbox(before, roi, (j) => !edgeOthersD[j]), sweepBox: bbox(sweep, roi), own, others: othersD, b })
  }

  // OWNERSHIP, SECOND PASS. "Not my own" is not "somebody else's": a letter
  // turning on its own centre never uncovers the band around its pivot, so that
  // band read as another letter's ink and walled the d's bowl in between it and
  // the o (7px box out of 19 swept). Each pixel some turn takes to paper belongs
  // to that letter. Ink no turn uncovers is a pivot band: it goes to the letter
  // whose swept columns hold it and whose sweep centre is nearest, and otherwise
  // stays somebody else's. Then every box is again "ink more than 2px from any other
  // letter's ink", measured the same way at rest and on film.
  {
    const owner = new Int8Array(roi.W * (roi.y1 + 2)).fill(-1)
    letters.forEach((L, k) => { if (L) for (let j = 0; j < L.own.length; j++) if (L.own[j] && owner[j] < 0) owner[j] = k })
    // Nearest PIVOT, not nearest own pixel: the l is thin, its turn uncovers
    // 20 pixels, and "nearest own ink on the row" gave its whole stem to the d.
    // A pivot band sits at the middle of the columns its letter's turn sweeps.
    const near = (j, y) => {
      const x = j - y * roi.W
      let best = -1, bd = Infinity
      letters.forEach((L, k) => {
        const B = L && L.sweepBox
        if (!B || x < B.x0 - 2 || x > B.x1 + 2) return
        const d = Math.abs(x - (B.x0 + B.x1) / 2)
        if (d < bd) { bd = d; best = k }
      })
      return best
    }
    letters.forEach((L, k) => {
      if (!L) return
      const before = ink[L.b], others = new Uint8Array(before.length)
      for (let y = roi.y0; y < roi.y1; y++) for (let x = roi.x0; x < roi.x1; x++) {
        const j = y * roi.W + x
        if (!before[j]) continue
        const o = owner[j] >= 0 ? owner[j] : near(j, y)
        if (o !== k) others[j] = 1
      }
      // MINE: every pixel of this letter, its pivot band included. C4 moves this,
      // not own: moving own alone left the band behind, and a 4px plant read 2px.
      L.mine = new Uint8Array(before.length)
      for (let j = 0; j < before.length; j++) L.mine[j] = before[j] && !others[j] ? 1 : 0
      L.others = dilate(others, roi, 2)
      L.restBox = bbox(before, roi, (j) => !L.others[j])
    })
  }

  // Per frame, per letter: its box, and whether its own zone changed.
  const zones = letters.map((L, k) => {
    if (!L || !L.restBox) return null
    // THE MIDDLE HALF of the letter's own box, minus any column another
    // letter's box reaches. The whole box made only 1 of 11 letters zoned:
    // neighbours touch at rest (e-s-k, o-o-d-l-e), so a letter's edge columns
    // are shared, and a zone of shared columns cannot tell whose ink moved.
    // The middle half is where a letter turning on its own centre changes most.
    const q = (L.restBox.x1 - L.restBox.x0) / 4
    const segs = []
    for (let x = Math.ceil(L.restBox.x0 + q); x <= Math.floor(L.restBox.x1 - q); x++) {
      const shared = letters.some((O, q) => q !== k && O && O.restBox && x >= O.restBox.x0 && x <= O.restBox.x1)
      if (!shared) segs.push(x)
    }
    return segs.length ? new Set(segs) : null
  })
  const rows = []
  const cur = letters.map((L) => (L ? L.restBox : null))
  // THE WORD'S OWN SQUASH (anticipation, still releasing through flip 1:
  // squashY 0.955 at f184) moves every letter by up to 3px, past the 2px
  // margin, so letter boxes cannot be read off those frames. They keep the
  // last clean box and are counted; the model arms still judge them.
  const squashed = frames.map((r) => { const h = M.sampleHeroMotion(P0, pageTime(r.f)); return Math.max(Math.abs((h.squashX ?? 1) - 1), Math.abs((h.squashY ?? 1) - 1)) > 1e-3 })
  for (let i = iRest + 1; i < frames.length; i++) {
    for (let k = 0; k < N; k++) {
      if (squashed[i]) break
      const L = letters[k]
      if (!L || i < L.s || i > L.e + 2) continue
      cur[k] = bbox(ink[i], roi, (j) => !L.others[j])
    }
    const wbx = bbox(ink[i], roi)
    const moving = zones.map((Z) => {
      if (!Z) return false
      let n = 0
      for (let y = roi.y0; y < roi.y1; y++)
        for (const x of Z) { const j = y * W + x; if (ink[i][j] !== ink[i - 1][j]) n++ }
      return n >= 6
    })
    rows.push({ i, squashed: squashed[i], f: frames[i].f, phase: frames[i].phase, w: wbx ? wbx.x1 - wbx.x0 + 1 : 0, boxes: cur.map((b) => (b ? { ...b } : null)), moving, model: mid[i] })
  }
  const restBoxes = letters.map((L) => (L ? L.restBox : null))
  const restOv = restBoxes.slice(0, -1).map((b, k) => ovS(b, restBoxes[k + 1]))
  return { meta, N, letters, restBoxes, restW, restOv, roi, rows, iE, iS, iR, iTurn, iRest, drift, P0, M, file, frames, zones, model, mid, ink, W }
}

/* ------------------------------------------------------------------ gates */
function gate(m) {
  const out = []
  const say = (ok, label, detail) => { out.push({ ok, label, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " · " + detail : ""}`) }
  const { N, letters, rows, iE, iTurn, restW, restOv, restBoxes, M, P0 } = m
  const win = rows.filter((r) => r.i >= iE && r.i < iTurn)
  const bad = { L1: new Set(), L2: new Set(), L3: new Set() }
  const found = letters.filter((L) => L && L.restBox).length
  const zoned = m.zones.filter(Boolean).length

  // A box twice the average letter is not a letter. Before this clause C1 passed
  // with the D's box 312px wide, the whole word, and every row after it went blind.
  const maxLetter = (2 * restW) / N
  const wide = letters.map((L, k) => (L && L.restBox && L.restBox.x1 - L.restBox.x0 + 1 > maxLetter ? `L${k} ${L.restBox.x1 - L.restBox.x0 + 1}px` : null)).filter(Boolean)
  // AND NOT TOO NARROW. A box under half the columns its own turn sweeps has
  // lost part of the letter to "somebody else's ink". The d's edge-frame box
  // was its 7px stem out of 26 swept columns, and L2 read the stem swinging to
  // the pivot as a slide. The l is thin and sweeps thin, so the l passes.
  const wOfB = (b) => (b ? b.x1 - b.x0 + 1 : 0)
  const narrowOf = (boxOf) => letters.map((L, k) => (L && L.sweepBox && wOfB(boxOf(L)) < 0.5 * wOfB(L.sweepBox) ? `L${k} ${wOfB(boxOf(L))} of ${wOfB(L.sweepBox)}px` : null)).filter(Boolean)
  const narrow = narrowOf((L) => L.restBox)
  const narrowOld = narrowOf((L) => L.edgeBox)
  const cutThird = narrowOf((L) => (L.restBox ? { x0: L.restBox.x1 - Math.floor(wOfB(L.restBox) / 3) + 1, x1: L.restBox.x1 } : null))
  say(found === N && wide.length === 0 && narrow.length === 0 && zoned === N, "C1 every letter is found by its own turn, letter-sized, with columns of its own", `${found} of ${N} letters found, ${N - wide.length} of ${N} narrower than ${maxLetter.toFixed(0)}px (2x the average)${wide.length ? " [" + wide.join(", ") + "]" : ""}, ${N - narrow.length} of ${N} at least half the columns their own turn sweeps${narrow.length ? " [" + narrow.join(", ") + "]" : ""}, ${zoned} of ${N} with a middle-half column no neighbour shares; rest word ${restW}px, engine ${m.meta.engine}`)
  say(cutThird.length === found, "C6 C1's undersize arm: a box cut to its last third is caught", `${cutThird.length} of ${found} letters caught; the edge-frame measurement LETTERS-2 used flags ${narrowOld.length} of ${found}${narrowOld.length ? " [" + narrowOld.join(", ") + "]" : ""}`)
  say(win.length > 0 && Math.abs(m.drift * FPS) < 0.5, "C2 the letter phase is on film and the model lines up with the page", `${win.length} frames, f${m.frames[iE].f} to f${m.frames[iTurn - 1]?.f} (the word turns at ${iTurn < m.frames.length ? "f" + m.frames[iTurn].f : "no frame"}); model drift ${(m.drift * FPS).toFixed(2)} fr`)

  // L1
  // C5's denominator is the frames where the MODEL says a letter's outline
  // moves 2px or more (its |cos yaw| width, or the ink/solid swap). A mid-turn
  // frame in the ease's first or last frames moves it well under a pixel, and
  // a dwell frame not at all; counting those asked the pixels to see nothing.
  let worstPx = 0, worstModel = 0, worstYaw = 0, seen = 0, turning = 0, midFrames = 0, wholeFrames = 0
  const l1Frame = (px, yd, squashed = false) => { const whole = squashed || px >= N - 1; return { whole, bad: yd > 1 || (!whole && px > 1) } }
  const wOf = restBoxes.map((b) => (b ? b.x1 - b.x0 + 1 : 0))
  for (const r of win) {
    const px = r.moving.filter(Boolean).length
    const md = r.model.filter(Boolean).length
    worstPx = Math.max(worstPx, px); worstModel = Math.max(worstModel, md)
    const now = m.model[r.i], prev = m.model[r.i - 1] || now
    const vis = r.model.map((on, k) => on && (Math.abs(Math.abs(Math.cos(now[k].yaw)) - Math.abs(Math.cos(prev[k].yaw))) * wOf[k] >= 2 || now[k].flat !== prev[k].flat))
    if (md >= 1) midFrames++
    if (vis.some(Boolean)) { turning++; if (vis.some((v, k) => v && r.moving[k])) seen++ }
    // L1 COUNTS TURNING, NOT OUTLINE MOTION (LETTERS-3). The model arm counts
    // letters whose yaw changes from the frame before. The pixel arm counts
    // letters whose own middle-half columns changed, and abstains when every
    // letter but at most one changes together, or while the word's squash is
    // off 1 on this frame or the one before (the page draws a frame late, so
    // f186-f187 still change after the model's squash does): that is the word moving (the
    // anticipation's squash releasing through flip 1, f186-f191, model squashX
    // 1.018 to 1.009), which moves every column at once and turns nothing. A
    // partial set of 2 or more still fails, so two letters turning together are
    // caught by both arms. C7 plants exactly that through this same predicate.
    const yd = now.map((s, k) => Math.abs(s.yaw - prev[k].yaw) > 1e-6).filter(Boolean).length
    worstYaw = Math.max(worstYaw, yd)
    const pr = rows.find((q) => q.i === r.i - 1)
    const v = l1Frame(px, yd, r.squashed || !!(pr && pr.squashed))
    if (v.whole) wholeFrames++
    if (v.bad) bad.L1.add(r.f)
  }
  say(bad.L1.size === 0, "L1 one letter turns at a time", `${bad.L1.size} of ${win.length} frames with 2+ letters turning (model: letters whose yaw changed, worst ${worstYaw}; mid-turn incl. dwell, worst ${worstModel}; pixels: letters whose own columns changed, worst ${worstPx} of ${zoned}, abstaining on ${wholeFrames} frames where ${N - 1}+ change together or the word's squash is off 1 on that frame or the one before)${bad.L1.size ? "; first " + [...bad.L1].slice(0, 8).map((f) => "f" + f).join(" ") : ""}`)
  // C7: L1's must-fail through its own predicate on REAL rows. Two frames where
  // neighbours turn alone are merged into one frame: their pixel flags and yaw
  // changes both. Each alone must pass; merged they must fail.
  {
    const solo = (k) => win.find((r) => { const now = m.model[r.i], prev = m.model[r.i - 1] || now; return r.moving[k] && r.moving.filter(Boolean).length === 1 && Math.abs(now[k].yaw - prev[k].yaw) > 1e-6 })
    let tried = 0, caught = 0, ctlBad = 0
    for (let k = 0; k < N - 1; k++) {
      const A = solo(k), B = solo(k + 1)
      if (!A || !B) continue
      tried++
      const yawOf = (r) => { const now = m.model[r.i], prev = m.model[r.i - 1] || now; return now.map((q, j) => Math.abs(q.yaw - prev[j].yaw) > 1e-6) }
      const cnt = (a) => a.filter(Boolean).length
      const or = (a, b) => a.map((x, j) => !!(x || b[j]))
      const pA = A.moving.map(Boolean), pB = B.moving.map(Boolean), yA = yawOf(A), yB = yawOf(B)
      if (l1Frame(cnt(pA), cnt(yA)).bad || l1Frame(cnt(pB), cnt(yB)).bad) ctlBad++
      const both = l1Frame(cnt(or(pA, pB)), cnt(or(yA, yB))).bad, pxOnly = l1Frame(cnt(or(pA, pB)), cnt(yA)).bad, yawOnly = l1Frame(cnt(pA), cnt(or(yA, yB))).bad
      if (both && pxOnly && yawOnly) caught++
    }
    say(tried >= N - 3 && caught === tried && ctlBad === 0, "C7 L1's must-fail arm: two neighbours turning on one frame are caught, by either arm alone", `${caught} of ${tried} neighbour pairs with a solo-turn frame each caught when merged (pixels 2 and yaw 2, pixels only, yaw only); control, each frame alone: ${ctlBad} of ${tried} flagged`)
  }
  say(turning > 0 && seen / turning >= 0.9, "C5 L1's pixel arm can see a turning letter", `${seen} of ${turning} frames where the model moves a letter's outline 2px+ show change in that letter's middle-half columns (${midFrames} mid-turn frames in all; the other ${midFrames - turning} are ease tails under 2px and dwell frames); needs 90%`)

  // L2. One predicate, shared with C4, so the must-fail arm tests this code.
  // A LETTER THAT SLIDES ONTO ITS NEIGHBOUR HIDES ITS OWN LEADING EDGE: the
  // box keeps only ink clear of the neighbour's, so the part that overlaps is
  // exactly the part it cannot see. C4 caught this on D|o, a 4px plant read as
  // 1px. The trailing edge stays visible, so a letter that is not mid-turn is
  // given back the width the model says it has (rest width x |cos yaw|) from
  // whichever edge it can still see. A turning letter keeps its raw box.
  // REST REFERENCE, LIKE WITH LIKE (LETTERS-4, the controller's call). A letter
  // rests as flat ink and lands as a shaded solid, and the solid is up to 1px
  // fuller: 11 of 11 letters at f370. Against the flat rest box, o|o (the one
  // pair with both facing edges in view) read 2px on 75 frames: the gap went
  // from 3 columns to 1, the o's never touch, and o1's ink centre moves 0.25px
  // AWAY from o2. The tolerance stays 1px per pair, because the instrument
  // reads a slide up to 2px short (edges hide in the 2px margin) and at 2px a
  // 3px plant passed on 5 of 10 pairs. So a letter drawn as a solid (model
  // `flat` false) is measured against the SAME letter at rest AS A SOLID: its
  // box on the last window frame where every letter has landed at yaw 0 and
  // nothing is mid-turn or squashed. Each edge of that box may sit at most
  // SOLID_FULL px OUTSIDE the flat rest edge; anything further out, or inward,
  // is not the render swap, so it is not credited and still counts. A slide
  // moves both edges the same way, so its far edge earns no credit and its
  // leading edge reads the slide in full.
  // WHY NOT "GAP ABOVE 0 AND NO BOX SHIFT": 8 of 10 pairs touch at rest
  // (e-s-k, o-o-d-l-e), so a gap test speaks for 2 pairs, and a box shift is
  // read off the far edge, which for both o's is hidden in the neighbour's 2px
  // margin, so it reads a 3px slide as 1px. The solid reference keeps one
  // predicate and one tolerance for all 10 pairs, and C4 plants into it.
  // NO SILENT FALLBACK: with no landed-at-rest frame (the before film lands at
  // yaw 30) every letter keeps the flat reference, which reads MORE, never
  // less, and the row says so.
  const SOLID_FULL = 1
  // `flat` is 1 for flat ink and 0 for a solid; a state without it (C4's rest)
  // is flat.
  const isSolid = (s) => !!s && s.flat !== undefined && !s.flat
  let atRest = null
  for (let n = win.length - 1; n >= 0 && !atRest; n--) {
    const r = win[n], st = m.model[r.i]
    if (!r.squashed && st && st.length === N && st.every((s, q) => isSolid(s) && Math.abs(s.yaw) < 1e-6 && !r.model[q])) atRest = r
  }
  const solidSeen = { full: 0, flat: 0, out: 0, in: 0 }
  const solidRest = restBoxes.map((R, q) => {
    if (!R || !atRest) return R
    const b = bbox(m.ink[atRest.i], m.roi, (j) => !letters[q].others[j])
    if (!b) return R
    const grow = [R.x0 - b.x0, b.x1 - R.x1]
    for (const g of grow) solidSeen[g > SOLID_FULL ? "out" : g < 0 ? "in" : g > 0 ? "full" : "flat"]++
    const cred = (g) => Math.max(0, Math.min(SOLID_FULL, g))
    return { ...R, x0: R.x0 - cred(grow[0]), x1: R.x1 + cred(grow[1]) }
  })
  const refOf = (q, states) => (states && isSolid(states[q]) ? solidRest[q] : restBoxes[q])
  const widthOf = (b) => (b ? b.x1 - b.x0 + 1 : 0)
  const widen = (b, q, mids, states) => {
    if (!b || !mids || mids[q] || !states || !states[q]) return b
    const w = Math.round(widthOf(refOf(q, states)) * Math.abs(Math.cos(states[q].yaw)))
    return { ...b, x0: Math.min(b.x0, b.x1 - w + 1), x1: Math.max(b.x1, b.x0 + w - 1) }
  }
  const L2_TOL = 1
  const slidePast = (boxes, k, mids, states) => ovS(widen(boxes[k], k, mids, states), widen(boxes[k + 1], k + 1, mids, states)) - ovS(refOf(k, states), refOf(k + 1, states))
  let worstOv = -Infinity, pairFrames = 0
  const pairsHit = new Set()
  for (const r of win) for (let k = 0; k < N - 1; k++) {
    if (!r.boxes[k] || !r.boxes[k + 1] || !Number.isFinite(restOv[k])) continue
    pairFrames++
    const ex = slidePast(r.boxes, k, r.model, m.model[r.i])
    worstOv = Math.max(worstOv, ex)
    if (ex > L2_TOL) { bad.L2.add(r.f); pairsHit.add(`${k}|${k + 1}`) }
  }
  say(bad.L2.size === 0, "L2 no letter slides into its neighbour", `${bad.L2.size} of ${win.length} frames (${win.filter((r) => r.squashed).length} under the word's own squash, boxes held from the last clean frame), ${pairFrames} pair-frames over ${N - 1} pairs; worst overlap past rest ${worstOv}px${pairsHit.size ? "; pairs " + [...pairsHit].join(" ") : ""}; solid rest reference ${atRest ? `f${atRest.f}, ${2 * N} edges: ${solidSeen.full} fuller by ${SOLID_FULL}px, ${solidSeen.flat} on the flat edge, ${solidSeen.out} further out and ${solidSeen.in} inward (not credited)` : "NONE (no frame with every letter landed at yaw 0), every letter held to its flat rest box"}`)

  // L3
  const ends = win.filter((r) => !r.model[0] && !r.model[N - 1])
  let worstW = 0
  for (const r of ends) { const dv = Math.abs(r.w / restW - 1); worstW = Math.max(worstW, dv); if (dv > 0.02) bad.L3.add(r.f) }
  say(ends.length > 0 && bad.L3.size === 0, "L3 the word keeps its width until it turns", `${bad.L3.size} of ${ends.length} frames outside rest ±2% (${ends.length} of ${win.length} frames have no end letter mid-turn); worst ${(worstW * 100).toFixed(1)}% of ${restW}px`)

  // L4
  const offE = M.phaseOffsets(P0).emerge
  const landed = M.sampleLetters(P0, offE + M.cascadeSec(P0) - 1e-6)
  const yawDeg = landed.map((s) => (s.yaw * 180) / Math.PI)
  const deadOn = yawDeg.filter((y) => Math.abs(y) < 1e-6).length
  say(deadOn === N, "L4a every letter lands dead on (model)", `${deadOn} of ${N} letters at yaw 0 when the cascade ends; yaws ${[...new Set(yawDeg.map((y) => y.toFixed(1)))].join(",")} deg`)
  const last = win[win.length - 1]
  let home = 0
  const off = []
  if (last) restBoxes.forEach((R, k) => {
    const b = last.boxes[k]
    const ok = R && b && Math.abs(b.x0 - R.x0) <= 2 && Math.abs(b.x1 - R.x1) <= 2 && Math.abs(b.y0 - R.y0) <= 2 && Math.abs(b.y1 - R.y1) <= 2
    if (ok) home++
    else off.push(`L${k}${b && R ? ` x ${b.x0 - R.x0}/${b.x1 - R.x1} y ${b.y0 - R.y0}/${b.y1 - R.y1}` : " missing"}`)
  })
  say(home === N, "L4b every letter is back on its rest box before the word turns (pixels)", `${home} of ${N} letters within 2px per edge on ${last ? "f" + last.f : "no frame"}${off.length ? "; " + off.slice(0, 6).join("; ") : ""}`)

  // MUST-FAIL ARMS, run every time.
  const shortBeat = { ...P0, letterBeatSec: 6 / 30, letterLeadSec: 6 / 30 }
  const t0 = M.phaseOffsets(shortBeat).emerge
  const a0 = M.sampleLetters(shortBeat, t0 - 1e-6)
  const z0 = M.sampleLetters(shortBeat, t0 + M.cascadeSec(shortBeat) - 1e-6)
  let mf = 0
  for (let f = 0; f < 200; f++) {
    const s = M.sampleLetters(shortBeat, t0 + f / FPS) || []
    mf = Math.max(mf, s.filter((x, k) => !same(x, a0[k]) && !same(x, z0[k])).length)
  }
  say(mf > 1, "C3 L1's must-fail arm: a 6 fr beat turns letters together", `model worst ${mf} at once`)
  // C4, THROUGH THE PIXELS. For every pair: take the rest frame, move letter
  // k+1's own ink 4px left into letter k, and measure letter k+1's box the way
  // L2 does on film (its ink minus every other letter's rest ink), then run
  // L2's own predicate. Moving a box by arithmetic only tested ovS; this tests
  // the mask, the keep filter and the predicate together. The CONTROL is the
  // same pipeline on the unmoved frame, and it must flag nothing.
  // Run at 4px (the original plant) and 3px (the slide a looser tolerance
  // would miss), FLAT on each letter's rest frame against the flat reference,
  // and SOLID on the landed-at-rest frame against the solid reference, so
  // both references L2 uses on film have a must-fail of their own.
  const { roi, W } = m
  const PLANTS = [4, 3]
  const arm = { flat: { tried: 0, caught: 0, falsePos: 0, missed: [], at: { 4: [0, 0], 3: [0, 0] } }, solid: { tried: 0, caught: 0, falsePos: 0, missed: [], at: { 4: [0, 0], 3: [0, 0] } } }
  const shift = (base, own, px) => {
    const moved = new Uint8Array(base.length)
    for (let j = 0; j < base.length; j++) if (base[j] && !own[j]) moved[j] = 1
    for (let j = 0; j < base.length; j++) if (base[j] && own[j] && (j % W) - px >= roi.x0) moved[j - px] = 1
    return moved
  }
  for (let k = 0; k < N - 1; k++) {
    const A = letters[k], B = letters[k + 1]
    if (!A || !A.restBox || !B || !B.restBox) continue
    // FLAT: the frame letter k+1's own and others masks were cut from, so the
    // only difference between the control and the plant is the plant.
    const base = m.ink[B.b]
    const still = restBoxes.map(() => false), rest = restBoxes.map(() => ({ yaw: 0 }))
    const ctl = restBoxes.slice(); ctl[k + 1] = bbox(base, roi, (j) => !B.others[j])
    if (slidePast(ctl, k, still, rest) > L2_TOL) arm.flat.falsePos++
    for (const px of PLANTS) {
      arm.flat.tried++
      const hit = restBoxes.slice(); hit[k + 1] = bbox(shift(base, B.mine, px), roi, (j) => !B.others[j])
      const ex = slidePast(hit, k, still, rest)
      arm.flat.at[px][0]++
      if (ex > L2_TOL) { arm.flat.caught++; arm.flat.at[px][1]++ } else arm.flat.missed.push(`${k}|${k + 1} at ${px}px read ${ex}px`)
    }
    // SOLID: the landed-at-rest frame, the one the solid reference was read
    // from. Letter k+1's solid is its rest ink grown by SOLID_FULL, less any
    // pixel of another letter's rest ink. Both boxes are re-read from the
    // planted frame, the way L2 reads film.
    if (!atRest) continue
    const sb = m.ink[atRest.i], st = m.model[atRest.i], stillS = st.map(() => false)
    const grown = dilate(B.mine, roi, SOLID_FULL)
    const own = new Uint8Array(sb.length)
    for (let j = 0; j < sb.length; j++) if (grown[j] && !letters.some((L, q) => q !== k + 1 && L && L.mine[j])) own[j] = 1
    const read = (ink) => { const b = restBoxes.slice(); b[k] = bbox(ink, roi, (j) => !A.others[j]); b[k + 1] = bbox(ink, roi, (j) => !B.others[j]); return b }
    if (slidePast(read(sb), k, stillS, st) > L2_TOL) arm.solid.falsePos++
    for (const px of PLANTS) {
      arm.solid.tried++
      const ex = slidePast(read(shift(sb, own, px)), k, stillS, st)
      arm.solid.at[px][0]++
      if (ex > L2_TOL) { arm.solid.caught++; arm.solid.at[px][1]++ } else arm.solid.missed.push(`${k}|${k + 1} at ${px}px read ${ex}px`)
    }
  }
  /* GRADED AT 4px, THE ORIGINAL PLANT; 3px IS PRINTED AS THE ARM'S MEASURED RESOLUTION (the controller, 2026-09-26).
   * At 3px the flat arm read 1px on 1|2 and 6|7, the same on the code before LETTERS-4, so it is the mask's
   * resolution on flat ink where letters touch at rest, not a new blind spot. Grading it would keep C4 red forever;
   * dropping it would hide the limit. So it is measured every run and printed beside the verdict. */
  const n = N - 1
  const ok = (a) => a.at[4][0] === n && a.at[4][1] === n && a.falsePos === 0
  const flatOk = ok(arm.flat)
  const solidOk = atRest ? ok(arm.solid) : true
  const armLine = (name, a) => `${name}: ${a.caught} of ${a.tried} plants caught, control ${a.falsePos} of ${N - 1} pairs flagged${a.missed.length ? " [missed " + a.missed.join(", ") + "]" : ""}`
  say(flatOk && solidOk, "C4 L2's must-fail arm: a letter's whole ink moved 4px into its neighbour is caught, through L2's own pixels", `${N - 1} pairs graded at 4px; resolution at 3px: flat ${arm.flat.at[3][1]} of ${arm.flat.at[3][0]}, solid ${arm.solid.at[3][1]} of ${arm.solid.at[3][0]} (printed, not graded); ${armLine("flat, rest frame vs flat reference", arm.flat)}; ${atRest ? armLine(`solid, f${atRest.f} vs solid reference`, arm.solid) : "solid arm not run: no landed-at-rest frame, so L2 used no solid reference"}`)
  return { out, bad, win }
}

/* ---------------------------------------------------------------- strips */
const TW = 300
async function strip(m, bad, win) {
  const { roi, rows, iE, file, frames } = m
  const pick = rows.filter((r) => r.i >= iE - 2)
  const sc = TW / (roi.x1 - roi.x0)
  const th = Math.round((roi.y1 - roi.y0) * sc)
  const cols = 10
  const cell = { w: TW + 6, h: th + 22 }
  const c = createCanvas(cols * cell.w + 8, Math.ceil(pick.length / cols) * cell.h + 8)
  const x = c.getContext("2d")
  x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height)
  x.font = "12px sans-serif"
  for (let n = 0; n < pick.length; n++) {
    const r = pick[n]
    const img = await loadImage(fs.readFileSync(file(frames[r.i])))
    const cx = 4 + (n % cols) * cell.w
    const cy = 4 + Math.floor(n / cols) * cell.h
    x.drawImage(img, roi.x0, roi.y0, roi.x1 - roi.x0, roi.y1 - roi.y0, cx, cy, TW, th)
    const flags = ["L1", "L2", "L3"].filter((g) => bad[g].has(r.f))
    x.strokeStyle = flags.length ? "#d22" : "#ccc"; x.lineWidth = flags.length ? 2 : 1
    x.strokeRect(cx + 0.5, cy + 0.5, TW - 1, th - 1)
    x.fillStyle = flags.length ? "#b00" : "#333"
    x.fillText(`f${r.f} ${r.phase ?? ""} moving ${r.moving.filter(Boolean).length} w ${r.w}${flags.length ? " " + flags.join(" ") : ""}`, cx + 2, cy + th + 14)
  }
  fs.writeFileSync(path.join(OUT, "strip.png"), c.toBuffer("image/png"))
  return { pick, sc, th }
}

async function sheet(a, b) {
  const L = (lab) => JSON.parse(fs.readFileSync(path.join(BASE, lab, "sheet-input.json"), "utf8"))
  const A = L(a)
  const B = L(b)
  const cols = 8
  const tw = 240
  const n = Math.max(A.frames.length, B.frames.length)
  const thA = Math.round(A.h * (tw / A.w))
  const thB = Math.round(B.h * (tw / B.w))
  const block = 18 + thA + 18 + thB + 16
  const c = createCanvas(90 + cols * (tw + 4), Math.ceil(n / cols) * block + 40)
  const x = c.getContext("2d")
  x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height)
  x.font = "13px sans-serif"; x.fillStyle = "#111"
  x.fillText(`Letter by letter, every 30 fps frame from the cascade's first frame. Each pair of rows: ${a.toUpperCase()} above, ${b.toUpperCase()} below, same frame count from the start.`, 8, 18)
  for (let g = 0; g * cols < n; g++) {
    const y0 = 34 + g * block
    for (const [row, S, th, yy] of [[a, A, thA, y0], [b, B, thB, y0 + 18 + thA]]) {
      x.fillStyle = "#111"; x.font = "bold 12px sans-serif"; x.fillText(row.toUpperCase(), 6, yy + th / 2 + 14)
      for (let k = 0; k < cols; k++) {
        const fr = S.frames[g * cols + k]
        if (!fr) continue
        const img = await loadImage(fs.readFileSync(fr.file))
        const cx = 90 + k * (tw + 4)
        x.drawImage(img, S.roi.x0, S.roi.y0, S.w, S.h, cx, yy + 16, tw, th)
        x.strokeStyle = fr.flags.length ? "#d22" : "#ccc"; x.lineWidth = fr.flags.length ? 2 : 1
        x.strokeRect(cx + 0.5, yy + 16.5, tw - 1, th - 1)
        x.font = "11px sans-serif"; x.fillStyle = fr.flags.length ? "#b00" : "#444"
        x.fillText(`+${fr.n} ${fr.phase ?? ""}${fr.flags.length ? " " + fr.flags.join(" ") : ""}`, cx + 2, yy + 12)
      }
    }
  }
  const outFile = path.join(BASE, `sheet-${a}-above-${b}.png`)
  fs.writeFileSync(outFile, c.toBuffer("image/png"))
  console.log(outFile)
}

/* ------------------------------------------------------------------- main */
async function main() {
  const sh = arg("sheet", null)
  if (sh) { const [a, b] = sh.split(","); await sheet(a, b); return }
  if (!arg("from-disk", false)) await film()
  const m = await measure()
  const { out, bad, win } = gate(m)
  await strip(m, bad, win)
  const pick = m.rows.filter((r) => r.i >= m.iE - 2)
  fs.writeFileSync(path.join(OUT, "sheet-input.json"), JSON.stringify({
    roi: m.roi, w: m.roi.x1 - m.roi.x0, h: m.roi.y1 - m.roi.y0,
    frames: pick.map((r) => ({ file: m.file(m.frames[r.i]), n: r.f - m.frames[m.iE].f, phase: r.phase, flags: ["L1", "L2", "L3"].filter((g) => bad[g].has(r.f)) })),
  }))
  fs.writeFileSync(path.join(OUT, "measure.json"), JSON.stringify({
    letters: m.restBoxes, restW: m.restW, restOv: m.restOv, roi: m.roi,
    rows: m.rows.map((r) => ({ f: r.f, phase: r.phase, w: r.w, moving: r.moving.map(Number).join(""), model: r.model.map(Number).join(""), boxes: r.boxes.map((b) => (b ? [b.x0, b.x1, b.y0, b.y1, b.area] : null)) })),
  }))
  const fails = out.filter((o) => !o.ok).length
  const txt = out.map((o) => `${o.ok ? "PASS" : "FAIL"}  ${o.label} · ${o.detail}`).join("\n") + `\n\n${out.length} rows · ${fails ? fails + " FAIL" : "all pass"}\n`
  fs.writeFileSync(path.join(OUT, "REPORT.txt"), txt)
  console.log(`\n${out.length} rows · ${fails ? fails + " FAIL" : "all pass"} · ${path.relative(ROOT, OUT)}`)
  process.exit(fails ? 1 : 0)
}

main().catch((e) => { console.error("FAIL  assert-letters crashed · " + (e?.stack || e)); process.exit(2) })
