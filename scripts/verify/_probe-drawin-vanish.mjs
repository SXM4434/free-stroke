// _PROBE-DRAWIN-VANISH — DOES ALREADY-DRAWN INK DISAPPEAR AS THE REVEAL ADVANCES?
//
// Sebs, 2026-08-04, three stepped screenshots of `/desk-doodles` on the DESK
// DOODLES engine at DRAW 61 / 69 / 75 %:
//   *"there like artifacts that appear ahead of where the stroke is animating,
//    and if a letter covers another like the d over the o it leaves part of the
//    o just like erased — the o should still be fully drawn but its edge doesnt
//    get drawn on that side."*
//
// A reveal is monotone BY DEFINITION: the inked set at t must contain the inked
// set at t-dt. This walks the draw phase in fine steps, masks every frame, and
// reports every pixel that was ink at step k and is paper at step k+1, labelled
// into connected components with their boxes. It draws nothing and decides
// nothing — `assert-drawin-monotone.mjs` is the gate. This is the microscope.
//
// His state is ASSERTED off the live DOM, not assumed (same four channels as
// `_probe-drawin-holes.mjs`): engine DESK DOODLES, wobble 0, endpoint CLEAN.
//
// ── THE STATE IS FOUR CHANNELS, AND TWO MORE WERE ADDED 2026-08-04 ────────
//
// `--word=` and `--dsf=` exist because "it does not reproduce" is only as wide
// as the states it was driven in, and the two this probe could not reach are
// exactly the two most likely to hide a COVERAGE defect: the FONT word (a
// different letter map, different junctions, and the only path "Any text" takes)
// and deviceScaleFactor 2 (Sebs's own retina raster — this repo has already had
// one speck claim that only reproduced at `--dsf=1`, so resolution is a channel,
// not a detail).
//
// Usage: node scripts/verify/_probe-drawin-vanish.mjs --label=repro
//        [--engine=desk-doodles] [--from=0] [--to=100] [--steps=101]
//        [--word=traced|font] [--dsf=1]
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync, existsSync, readdirSync, renameSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { stageEvidence } from "./lib/evidence-swap.mjs"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")
let FFMPEG = require("ffmpeg-static")
if (!FFMPEG || !existsSync(FFMPEG)) FFMPEG = "ffmpeg"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "repro")
const ENGINE = arg("engine", "desk-doodles")
const FROM = parseFloat(arg("from", "0")) / 100
const TO = parseFloat(arg("to", "100")) / 100
const STEPS = parseInt(arg("steps", "101"), 10)
const WORD = arg("word", "traced")
const DSF = parseInt(arg("dsf", "1"), 10)
const PORT = process.env.FS_PORT || "3000"
/* STAGED, because this wipe can reach committed evidence. It empties
 * `docs/verification/drawin-vanish/<label>`, and the label is an argument, so the reach is the
 * whole subtree, 803 tracked files.
 * The capture now writes to a sibling `.<name>.staging` and the stored set is
 * replaced only when the run completes, so a run that dies partway leaves every
 * committed frame alone. The same wipe on `hero-windup`, killed 14 s in, deleted
 * all 102 of its tracked files. lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", "drawin-vanish", LABEL)
const EV = stageEvidence(FINAL)
const OUT = EV.dir
const VIEW = { width: 1600, height: 1600 }

/* ---- masking: the same paper-mode + 45 luma cut `_probe-drawin-holes-read`
 * uses, so a pixel called ink here is a pixel called ink there. ---- */
async function maskOf(png) {
  const img = await loadImage(png)
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

function components(m, w, h, minPx) {
  const seen = new Uint8Array(m.length)
  const out = []
  const stack = new Int32Array(m.length)
  for (let p = 0; p < m.length; p++) {
    if (!m[p] || seen[p]) continue
    let sp = 0
    stack[sp++] = p
    seen[p] = 1
    let n = 0
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
    while (sp > 0) {
      const q = stack[--sp]
      const qx = q % w
      const qy = (q / w) | 0
      n++
      if (qx < x0) x0 = qx
      if (qx > x1) x1 = qx
      if (qy < y0) y0 = qy
      if (qy > y1) y1 = qy
      for (let dy = -1; dy <= 1; dy++) {
        const ny = qy + dy
        if (ny < 0 || ny >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          const nx = qx + dx
          if (nx < 0 || nx >= w) continue
          const r = ny * w + nx
          if (m[r] && !seen[r]) { seen[r] = 1; stack[sp++] = r }
        }
      }
    }
    if (n >= minPx) out.push({ n, x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 })
  }
  out.sort((a, b) => b.n - a.n)
  return out
}

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

async function main() {
  EV.open()
  mkdirSync(join(OUT, "frames"), { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)))

  await page.goto(`http://localhost:${PORT}/desk-doodles`, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, {
    timeout: 120000,
  })
  await page.waitForTimeout(2500)

  await page.click(`[data-engine-option="${ENGINE}"]`)
  await page.waitForTimeout(3500)

  // THE WORD, through the real pill — the page opens on `traced`, so a font run
  // has to click and then be READ BACK, or a sweep silently measures the traced
  // word twice under two labels.
  if (WORD !== "traced") {
    await page.click(`[data-word-source="${WORD}"]`)
    await page.waitForTimeout(4000)
  }

  await page.evaluate(() => {
    for (const inp of document.querySelectorAll('input[type="range"]')) {
      const row = inp.closest("div")?.parentElement
      const t = (row?.textContent ?? "").toLowerCase()
      if (t.includes("wobble")) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
        setter.call(inp, "0")
        inp.dispatchEvent(new Event("input", { bubbles: true }))
        inp.dispatchEvent(new Event("change", { bubbles: true }))
        break
      }
    }
  })
  await page.waitForTimeout(2500)
  await page.evaluate(() => {
    for (const b of document.querySelectorAll("button")) {
      if ((b.textContent ?? "").trim().toLowerCase() === "clean") { b.click(); break }
    }
  })
  await page.waitForTimeout(2500)

  const state = await page.evaluate(() => {
    let wobble = null
    for (const inp of document.querySelectorAll('input[type="range"]')) {
      const row = inp.closest("div")?.parentElement
      const t = (row?.textContent ?? "").toLowerCase()
      if (t.includes("wobble")) { wobble = Number(inp.value); break }
    }
    const LABELS = { clean: "clean", protrude: "protrude", long: "long-overshoot", kink: "kink" }
    let endpoint = null
    for (const b of document.querySelectorAll("button")) {
      const key = LABELS[(b.textContent ?? "").trim().toLowerCase()]
      if (!key) continue
      const bg = getComputedStyle(b).backgroundColor
      if (!(bg === "rgba(0, 0, 0, 0)" || bg === "transparent")) endpoint = key
    }
    let word = null
    for (const b of document.querySelectorAll("[data-word-source]")) {
      const bg = getComputedStyle(b).backgroundColor
      if (!(bg === "rgba(0, 0, 0, 0)" || bg === "transparent")) word = b.getAttribute("data-word-source")
    }
    return {
      wobble,
      endpoint,
      word,
      engineFamily: document.querySelector("[data-engine-family]")?.getAttribute("data-engine-family") ?? null,
      penTip: window.__captureHarness?.penTip?.() ?? null,
    }
  })
  console.log("live state:", JSON.stringify(state))
  say(state.engineFamily === ENGINE, `engine is ${ENGINE}`, String(state.engineFamily))
  say(state.word === WORD, `word is ${WORD}`, String(state.word))
  say(state.wobble === 0, "wobble is 0", String(state.wobble))
  say(state.endpoint === "clean", "endpoint is CLEAN", String(state.endpoint))

  const span = await page.evaluate(() =>
    JSON.parse(document.querySelector("[data-hero-draw-span]").getAttribute("data-hero-draw-span")),
  )
  console.log(`draw phase: at ${span.at.toFixed(3)}s, ${span.duration.toFixed(3)}s long`)

  const seek = async (t) => {
    await page.evaluate((tt) => {
      const el = document.querySelector("[data-hero-scrub]")
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      setter.call(el, String(tt))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, t)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(240)
  }

  /* ---- the sweep, with the scene's own mesh census beside each frame ----- */
  const rows = []
  for (let k = 0; k < STEPS; k++) {
    const pct = FROM + ((TO - FROM) * k) / Math.max(1, STEPS - 1)
    await seek(span.at + span.duration * pct)
    const buf = await page.locator("[data-hero-stage]").screenshot()
    const name = `${String(k).padStart(3, "0")}.png`
    writeFileSync(join(OUT, "frames", name), buf)
    const census = await page.evaluate(() => {
      const s = window.__inflateProbe?.stats?.() ?? null
      const el = document.querySelector("[data-hero-phase]")
      return {
        stats: s,
        phase: el?.getAttribute("data-hero-phase") ?? null,
        phaseT: Number(el?.getAttribute("data-hero-phase-t")),
      }
    })
    rows.push({ k, pct, name, ...census })
  }

  say(errors.length === 0, "no page errors", errors.join(" | ") || "0")
  await context.close()
  await browser.close()

  /* ---- THE ARITHMETIC: what vanished between consecutive frames --------- */
  const masks = []
  for (const r of rows) masks.push(await maskOf(join(OUT, "frames", r.name)))

  const report = []
  let worst = { lost: -1 }
  for (let k = 1; k < masks.length; k++) {
    const a = masks[k - 1].m
    const b = masks[k].m
    const lostMask = new Uint8Array(a.length)
    let lost = 0
    let inkA = 0
    let inkB = 0
    for (let p = 0; p < a.length; p++) {
      inkA += a[p]
      inkB += b[p]
      if (a[p] && !b[p]) { lostMask[p] = 1; lost++ }
    }
    const comps = components(lostMask, masks[k].w, masks[k].h, 25)
    const row = {
      k,
      pctA: +(rows[k - 1].pct * 100).toFixed(2),
      pctB: +(rows[k].pct * 100).toFixed(2),
      inkA,
      inkB,
      lost,
      lostFrac: +(lost / Math.max(1, inkA)).toFixed(5),
      comps: comps.slice(0, 6).map((c) => ({ n: c.n, x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 })),
      meshes: rows[k].stats?.meshCount ?? null,
      tris: rows[k].stats?.triangles ?? null,
    }
    report.push(row)
    if (lost > worst.lost) worst = { ...row, lost }
    console.log(
      `${String(row.pctA).padStart(6)} -> ${String(row.pctB).padStart(6)} %   ink ${String(inkA).padStart(7)} -> ${String(inkB).padStart(7)}   LOST ${String(lost).padStart(6)}   biggest ${comps.slice(0, 3).map((c) => `${c.n}@(${c.x0},${c.y0})-(${c.x1},${c.y1})`).join("  ") || "-"}`,
    )
  }

  writeFileSync(join(OUT, "vanish.json"), JSON.stringify({ state, span, rows, report }, null, 2))

  try {
    execFileSync(
      FFMPEG,
      ["-y", "-framerate", "12", "-i", join(OUT, "frames", "%03d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", join(OUT, "sweep.mp4")],
      { stdio: "ignore" },
    )
  } catch (e) {
    console.warn("ffmpeg failed:", e.message)
  }

  console.log(`\nworst single step: ${worst.lost} px lost at ${worst.pctA} -> ${worst.pctB} %`)
  /* THE SWAP, on completion and not on the pass flag. lib/evidence-swap.mjs */
  EV.commit()
  console.log(`frames + json: ${FINAL}`)
  process.exit(pass ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
