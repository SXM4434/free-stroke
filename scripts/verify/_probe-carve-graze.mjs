// _PROBE-CARVE-GRAZE — THE ONE FRAME WHERE THE `s` STIPPLES WHITE.
//
// Found by the letter-by-letter lane: at ~7.36 s of the `letterByLetter` film
// the `s` comes apart into a white stipple for a single frame at grazing angle.
//
// ── THE FRAME IS LOCATED IN THE MODEL, NOT HUNTED FOR ──────────────────────
// `lib/hero-motion.ts` sampled at 30 fps over the whole 12.3667 s film reports
// exactly EIGHT frames in which any letter's `|cos yaw|` sits inside the carve
// fade's `smoothstep(0.28, 0.42)` band, and letter 2 at t 7.400 s is one of them
// (yaw 67.62°, face 0.3808, flat 1). So this probe seeks to a frame that was
// predicted rather than found, which is what makes a null result meaningful.
//
// ── OFAT, ONE PAGE SESSION ────────────────────────────────────────────────
// Two arms differing in ONE thing: the coverage ramp's divisor.
//   aa=1  `length(vec2(dFdx(sd), dFdy(sd)))`, shipped (PEN_CARVE_AA_FWIDTH);
//         `fwidth(sd)` until CARVE-AA, 2026-09-30. The `fwidth` names below
//         are the arm's old label, kept so older evidence reads the same.
//   aa=0  the screen size of one LOCAL UNIT — the parked prior, the defect
// Captured from the same page, the same seek and the same field, because an
// arm captured in a second session is not comparable to one captured in the
// first.
//
// Usage: node scripts/verify/_probe-carve-graze.mjs [--label=run] [--t=7.40]
//        [--film=letterByLetter] [--dsf=2]
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath, pathToFileURL } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"
import { HERO_URL } from "./lib/dev-server.mjs"
import { stageEvidence } from "./lib/evidence-swap.mjs"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "run")
const FILM = arg("film", "letterByLetter")
const DSF = parseFloat(arg("dsf", "2"))
const TS = (arg("t", "7.30,7.333,7.367,7.40,7.433,7.467") || "").split(",").map(Number)
const SWEEP = arg("sweep", null) ? arg("sweep").split(",").map(Number) : null
/* STAGED. `docs/verification/carve-graze/<label>`, and the label is an argument,
 * so the reach is the whole subtree: 39 tracked files. Both exit paths below
 * swap, because both are completed captures. lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", "carve-graze", LABEL)
const EV = stageEvidence(FINAL)
const OUT = EV.dir
const VIEW = { width: 1600, height: 1600 }

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

/**
 * WHITE SPECKLE INSIDE THE MARK — the statistic that names the defect.
 *
 * A stipple is not "less ink". It is PAPER-COLOURED PIXELS SCATTERED INSIDE the
 * letter's own body, which is what `alphaToCoverage` produces from a fractional
 * alpha. So: fill the letter's silhouette (a morphological closing of the ink
 * mask), and count the paper pixels that end up strictly inside it. A letter
 * that is simply thin scores zero; a stippled one scores its own area.
 */
export function speckle(img, box) {
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const W = box.w
  const H = box.h
  const ink = new Uint8Array(W * H)
  let inkN = 0
  for (let yy = 0; yy < H; yy++) {
    for (let xx = 0; xx < W; xx++) {
      const p = ((box.y + yy) * img.width + (box.x + xx)) * 4
      const l = 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]
      const v = l < 150 ? 1 : 0
      ink[yy * W + xx] = v
      inkN += v
    }
  }
  // Dilate then erode by r — a closing. r = 3 px closes a sample-mask stipple
  // (which is at most 1 px of hole per 4x MSAA sample) and does not close a
  // counter, which on this word is tens of pixels across.
  const r = 3
  const dil = new Uint8Array(W * H)
  for (let yy = 0; yy < H; yy++)
    for (let xx = 0; xx < W; xx++) {
      let on = 0
      for (let dy = -r; dy <= r && !on; dy++)
        for (let dx = -r; dx <= r && !on; dx++) {
          const ny = yy + dy
          const nx = xx + dx
          if (ny < 0 || ny >= H || nx < 0 || nx >= W) continue
          if (ink[ny * W + nx]) on = 1
        }
      dil[yy * W + xx] = on
    }
  const closed = new Uint8Array(W * H)
  for (let yy = 0; yy < H; yy++)
    for (let xx = 0; xx < W; xx++) {
      let all = 1
      for (let dy = -r; dy <= r && all; dy++)
        for (let dx = -r; dx <= r && all; dx++) {
          const ny = yy + dy
          const nx = xx + dx
          if (ny < 0 || ny >= H || nx < 0 || nx >= W) { all = 0; break }
          if (!dil[ny * W + nx]) all = 0
        }
      closed[yy * W + xx] = all
    }
  let holes = 0
  for (let i = 0; i < closed.length; i++) if (closed[i] && !ink[i]) holes++
  return { ink: inkN, holes }
}

/** Pixels where the two arms disagree by more than one 8-bit step. */
export function armDiff(a, b) {
  const ca = createCanvas(a.width, a.height)
  const xa = ca.getContext("2d")
  xa.drawImage(a, 0, 0)
  const da = xa.getImageData(0, 0, a.width, a.height).data
  const cb = createCanvas(b.width, b.height)
  const xb = cb.getContext("2d")
  xb.drawImage(b, 0, 0)
  const db = xb.getImageData(0, 0, b.width, b.height).data
  let n = 0
  for (let i = 0; i < da.length; i += 4) {
    if (Math.abs(da[i] - db[i]) > 1 || Math.abs(da[i + 1] - db[i + 1]) > 1 || Math.abs(da[i + 2] - db[i + 2]) > 1) n++
  }
  return n
}

async function main() {
  EV.open()

  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)))

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 120000 })
  await page.waitForTimeout(2500)

  /* THE FILM PILL, CLICKED — the only honest way to film an option is to click
   * the control a person clicks. Same rule `film-hero-beat.mjs` states. */
  const pill = page.locator(`[data-read-film="${FILM}"]`)
  if ((await pill.count()) !== 1) throw new Error(`no [data-read-film="${FILM}"] pill`)
  await pill.click()
  await page.waitForTimeout(2500)
  const live = await page.evaluate(() => ({
    aa: window.__captureHarness?.carveAA?.() ?? null,
    tip: window.__captureHarness?.penTip?.() ?? null,
  }))
  say(live.aa === true, "the shipped divisor is the aa=1 arm, |grad sd|", String(live.aa))

  const seek = async (t) => {
    await page.evaluate((tt) => {
      const el = document.querySelector("[data-hero-scrub]")
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      s.call(el, String(tt))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, t)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(200)
  }

  const shot = async (name) => {
    const buf = await page.locator("[data-hero-stage]").screenshot()
    writeFileSync(join(OUT, `${name}.png`), buf)
    return loadImage(buf)
  }

  /* ---- THE SWEEP, IF ASKED ------------------------------------------------
   * Seeking to a model-predicted instant is the right first move and it found
   * nothing, which is a result and not an answer: the fade's band is 8 frames
   * of a 371-frame film and a stipple that lasts ONE frame can sit between two
   * seeks. So the fallback is exhaustive over the window the cascade occupies,
   * on BOTH arms, and it reports two independent things — how much white
   * speckle each frame carries, and whether the two divisors differ AT ALL. */
  if (SWEEP) {
    const [a0, a1, step] = SWEEP
    const shots = { prior: [], fwidth: [] }
    for (const arm of [false, true]) {
      const okA = await page.evaluate((v) => window.__captureHarness.setCarveAA(v), arm)
      if (!okA) { console.error(`setCarveAA(${arm}) refused`); process.exit(1) }
      const back = await page.evaluate(() => window.__captureHarness.carveAA())
      say(back === arm, `sweep arm aa=${arm ? 1 : 0} actually TOOK`, String(back))
      for (let t = a0; t <= a1 + 1e-9; t += step) {
        await seek(t)
        const buf = await page.locator("[data-hero-stage]").screenshot()
        shots[arm ? "fwidth" : "prior"].push({ t: +t.toFixed(3), buf })
      }
    }
    say(errors.length === 0, "no page errors", errors.join(" | ") || "0")
    await context.close()
    await browser.close()
    const out = []
    let worstSpeck = { holes: -1 }
    let worstDiff = { n: -1 }
    for (let i = 0; i < shots.prior.length; i++) {
      const pi = await loadImage(shots.prior[i].buf)
      const fi = await loadImage(shots.fwidth[i].buf)
      const box = { x: 0, y: 0, w: pi.width, h: pi.height }
      const sp = speckle(pi, box)
      const sf = speckle(fi, box)
      const d = armDiff(pi, fi)
      const row = { t: shots.prior[i].t, priorHoles: sp.holes, fwidthHoles: sf.holes, ink: sf.ink, diffPx: d }
      out.push(row)
      if (sp.holes > worstSpeck.holes) worstSpeck = { ...row, holes: sp.holes }
      if (d > worstDiff.n) worstDiff = { ...row, n: d }
      console.log(`  t ${row.t.toFixed(3)}  ink ${String(row.ink).padStart(7)}  white speckle  prior ${String(sp.holes).padStart(6)}  fwidth ${String(sf.holes).padStart(6)}  |arms differ| ${String(d).padStart(7)} px`)
    }
    writeFileSync(join(OUT, "sweep.json"), JSON.stringify({ film: FILM, dsf: DSF, window: SWEEP, rows: out }, null, 2))
    console.log(`\nworst white speckle on the PRIOR arm: ${worstSpeck.holes} px at t ${worstSpeck.t}`)
    console.log(`worst disagreement between the two divisors: ${worstDiff.n} px at t ${worstDiff.t}`)
    for (const [name, r] of [["speck", worstSpeck], ["diff", worstDiff]]) {
      const i = out.findIndex((x) => x.t === r.t)
      if (i < 0) continue
      writeFileSync(join(OUT, `worst-${name}-prior.png`), shots.prior[i].buf)
      writeFileSync(join(OUT, `worst-${name}-fwidth.png`), shots.fwidth[i].buf)
    }
    EV.commit()
    console.log(`\nframes: ${FINAL}`)
    process.exit(pass ? 0 : 1)
  }

  const rows = []
  for (const arm of [false, true]) {
    const ok = await page.evaluate((v) => window.__captureHarness.setCarveAA(v), arm)
    if (!ok) { console.error(`setCarveAA(${arm}) refused`); process.exit(1) }
    const back = await page.evaluate(() => window.__captureHarness.carveAA())
    say(back === arm, `the arm aa=${arm ? 1 : 0} actually TOOK`, String(back))
    for (const t of TS) {
      await seek(t)
      const img = await shot(`${arm ? "fwidth" : "prior"}_t${t.toFixed(3)}`)
      rows.push({ arm: arm ? "fwidth" : "prior", t, img })
    }
  }

  say(errors.length === 0, "no page errors", errors.join(" | ") || "0")
  await context.close()
  await browser.close()

  /* THE BOX IS THE WHOLE WORD, and the statistic is scale-free, so nothing here
   * depends on framing the `s` by hand. */
  const first = rows[0].img
  const box = { x: 0, y: 0, w: first.width, h: first.height }
  const out = []
  for (const r of rows) {
    const s = speckle(r.img, box)
    out.push({ arm: r.arm, t: r.t, ink: s.ink, holes: s.holes, frac: s.ink ? s.holes / s.ink : 0 })
    console.log(`  ${r.arm.padEnd(7)} t ${r.t.toFixed(3)}  ink ${String(s.ink).padStart(7)}  white speckle inside the mark ${String(s.holes).padStart(6)}  (${((s.ink ? s.holes / s.ink : 0) * 100).toFixed(2)} % of its ink)`)
  }
  writeFileSync(join(OUT, "graze.json"), JSON.stringify({ film: FILM, dsf: DSF, ts: TS, rows: out }, null, 2))

  /* ---- THE SHEET, at 8x on the worst frame the PRIOR produced -------------- */
  const priorRows = out.filter((r) => r.arm === "prior")
  const worst = priorRows.reduce((a, b) => (b.holes > a.holes ? b : a), priorRows[0])
  const Z = 8
  const CW = 210
  const CH = 150
  const pr = rows.find((r) => r.arm === "prior" && r.t === worst.t)
  const fw = rows.find((r) => r.arm === "fwidth" && r.t === worst.t)
  // Centre the crop on the prior arm's speckle, found rather than chosen.
  let cx = 0
  let cy = 0
  let n = 0
  {
    const c = createCanvas(pr.img.width, pr.img.height)
    const x = c.getContext("2d")
    x.drawImage(pr.img, 0, 0)
    const { data } = x.getImageData(0, 0, pr.img.width, pr.img.height)
    for (let yy = 1; yy < pr.img.height - 1; yy++)
      for (let xx = 1; xx < pr.img.width - 1; xx++) {
        const p = (yy * pr.img.width + xx) * 4
        const l = 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]
        if (l < 150) { cx += xx; cy += yy; n++ }
      }
  }
  if (n) { cx /= n; cy /= n } else { cx = pr.img.width / 2; cy = pr.img.height / 2 }
  const sx = Math.max(0, Math.min(pr.img.width - CW, Math.round(cx - CW / 2)))
  const sy = Math.max(0, Math.min(pr.img.height - CH, Math.round(cy - CH / 2)))
  const PAD = 12
  const HEAD = 44
  const LAB = 24
  const cv = createCanvas(PAD * 3 + CW * Z * 2, HEAD + CH * Z + LAB)
  const g = cv.getContext("2d")
  g.fillStyle = "#101014"
  g.fillRect(0, 0, cv.width, cv.height)
  g.imageSmoothingEnabled = false
  g.fillStyle = "#e8e8f0"
  g.font = "600 22px sans-serif"
  g.fillText(`${FILM} · t ${worst.t.toFixed(3)} s · dsf ${DSF} · ${Z}x — the carve's coverage divisor`, PAD, 30)
  ;[[pr, `prior, one LOCAL UNIT (${worst.holes} white px inside the mark)`], [fw, `|grad sd|, shipped (${out.find((r) => r.arm === "fwidth" && r.t === worst.t).holes} white px)`]].forEach(([r, lab], i) => {
    const x = PAD + i * (CW * Z + PAD)
    g.fillStyle = "#9aa0b4"
    g.font = "500 16px sans-serif"
    g.fillText(lab, x, HEAD - 6)
    g.drawImage(r.img, sx, sy, CW, CH, x, HEAD, CW * Z, CH * Z)
    g.strokeStyle = "#3a3a46"
    g.lineWidth = 2
    g.strokeRect(x, HEAD, CW * Z, CH * Z)
  })
  {
    const { data } = g.getImageData(0, 0, cv.width, cv.height)
    let clear = 0
    for (let i = 3; i < data.length; i += 4) if (data[i] < 255) clear++
    say(clear === 0, "the sheet is OPAQUE", `${clear} px below alpha 255`)
  }
  writeFileSync(join(OUT, `SHEET-graze-${Z}x.png`), cv.toBuffer("image/png"))

  EV.commit()
  console.log(`\nsheet + frames: ${FINAL}`)
  process.exit(pass ? 0 : 1)
}

/* RUN ONLY WHEN INVOKED DIRECTLY. `speckle` and `armDiff` are the statistic and
 * the arm comparison `assert-carve-graze.mjs` grades with, and it IMPORTS them
 * rather than restating them — a parallel implementation of one idea is this
 * repo's most expensive recurring defect, and a speckle count that drifted
 * between the probe and its gate would make the two describe different
 * pictures. Without this guard the import would run the whole probe. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
