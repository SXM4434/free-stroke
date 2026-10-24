// THE TONAL EVENT AT THE 2D→3D SWITCH, MEASURED FRAME BY FRAME.
//
// Sebs: *"MAYBE ITS MATERIAL LIGHTING IDK BUT ITS STILL SUPER SUBTLE WHEN IT
// SWITCHES TO 3D AND I HAVE A HARD TIME NOTICING AT TIMES ITS NOW 3D."*
//
// The silhouette half of that complaint is closed — flat-vs-solid silhouette
// went 4.09 % → 39.12 % of a stroke radius when the pen carve landed, so the
// SHAPE changes now. What this probe measures is the other half: the VALUE.
// At the edge `flat` runs 1 → 0 in one frame and hands the surface from a
// constant-value ink to the lit rig. If the lit material at that instant sits
// close in value to the flat ink, the beat is a silhouette event with nothing
// confirming it, which is exactly what "I have a hard time noticing" describes.
//
// WHAT IT PRINTS, PER FRAME, over the emerge window at high density:
//   flat/depth/yaw/shade  — the model's own channels, scraped off the page's
//                           `data-hero-*` readout, never inferred from the
//                           phase percentage. `flat` flips inside the DWELL,
//                           which the phase readout does not name.
//   mean                  — eroded interior mean luma (the value-wash gate's
//                           own statistic, so a number here is a number that
//                           gate sees)
//   p05 / med / p95       — the dark core, the median and the lit end, because
//                           §11.7.2 proved a MEAN cannot tell a wash from a
//                           rake and the same is true of a switch
//   sd / spread           — is there any tonal STRUCTURE at all, or one value
//   ink / w / cx          — the silhouette, so the shape event and the tonal
//                           event can be read against each other
//
// AND IT ASSERTS THE PAGE ACTUALLY BUILT BEFORE MEASURING ANYTHING. A page
// that never booted renders byte-identically to another page that never booted,
// so "no difference" taken that way is a green that cannot fail. Three
// independent channels have to agree the surface is live: the harnesses exist,
// rAF is ticking, and the canvas carries ink.
//
// Usage:
//   node scripts/verify/_probe-switch-tone.mjs --out=<label> [--frames=96]
//        [--carve=prior] [--tone=prior] [--save-frames]
// Output:
//   docs/verification/switch-tone/<label>/series.json
//   docs/verification/switch-tone/<label>/frames/*.png   (with --save-frames)
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { HERO_URL } from "./lib/dev-server.mjs"

const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const has = (k) => process.argv.includes(`--${k}`)

const LABEL = arg("out", "run")
const FRAMES = parseInt(arg("frames", "96"), 10)
const CARVE = arg("carve", null)
const TONE = arg("tone", null)
const SAVE = has("save-frames")
const URL = HERO_URL
const OUT = join(ROOT, "docs", "verification", "switch-tone", LABEL)
const FRAMEDIR = join(OUT, "frames")

/* The same two constants `assert-hero-transition.mjs` judges with. Restated
 * rather than imported so this probe is readable on its own, and checked
 * against that file's values whenever either moves: INK_MAX_LUMA 150, ERODE 3.
 * A probe that measures with a different threshold than the gate is a probe
 * whose numbers cannot be quoted at the gate. */
const INK_MAX_LUMA = 150
const ERODE = 3

function interiorOf(luma, W, H) {
  let cur = new Uint8Array(W * H)
  for (let p = 0; p < W * H; p++) cur[p] = luma[p] <= INK_MAX_LUMA ? 1 : 0
  for (let pass = 0; pass < ERODE; pass++) {
    const next = new Uint8Array(W * H)
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const p = y * W + x
        if (!cur[p]) continue
        if (
          cur[p - 1] && cur[p + 1] && cur[p - W] && cur[p + W] &&
          cur[p - W - 1] && cur[p - W + 1] && cur[p + W - 1] && cur[p + W + 1]
        ) next[p] = 1
      }
    }
    cur = next
  }
  return cur
}

async function measureBuffer(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  const ctx = c.getContext("2d")
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, img.width, img.height)
  const W = img.width
  const H = Math.floor(img.height * 0.75)
  const luma = new Float32Array(W * H)
  for (let p = 0; p < W * H; p++) {
    const i = p * 4
    luma[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, inkFull = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (luma[y * W + x] > INK_MAX_LUMA) continue
      inkFull++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (!Number.isFinite(minX)) return null
  const cur = interiorOf(luma, W, H)
  const vals = []
  for (let p = 0; p < W * H; p++) if (cur[p]) vals.push(luma[p])
  if (vals.length === 0) {
    return { inkFull, w: maxX - minX + 1, h: maxY - minY + 1, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, n: 0 }
  }
  const sorted = vals.slice().sort((a, b) => a - b)
  const pc = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / vals.length)
  return {
    inkFull,
    n: vals.length,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    mean,
    sd,
    p05: pc(0.05),
    med: pc(0.5),
    p95: pc(0.95),
    spread: sorted[sorted.length - 1] - sorted[0],
  }
}

async function main() {
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })
  if (SAVE) mkdirSync(FRAMEDIR, { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 1440 } })
  const page = await context.newPage()
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 240))
  })
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 240)))

  if (CARVE) await page.addInitScript((v) => { window.__heroCarveLaw = v }, CARVE)
  if (TONE) await page.addInitScript((v) => { window.__heroToneLaw = v }, TONE)

  await page.goto(URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, {
    timeout: 90000,
  })

  /* ---- THE BUILD ASSERTION, three independent channels -------------------
   * Vite/Next will not serve a symlinked public dir and fails SILENTLY; a page
   * that never booted renders byte-identically to another page that never
   * booted. Every "no difference" claim taken on such a page is a green that
   * cannot fail. So: harnesses (done above), a TICKING rAF loop, and actual ink
   * on the canvas. Any one of the three alone is satisfiable by a corpse. */
  const ticks = await page.evaluate(
    () =>
      new Promise((res) => {
        let n = 0
        const t0 = performance.now()
        const step = () => {
          n++
          if (performance.now() - t0 < 500) requestAnimationFrame(step)
          else res(n)
        }
        requestAnimationFrame(step)
      }),
  )
  if (ticks < 10) throw new Error(`rAF is not running: ${ticks} ticks in 500 ms. Refusing to measure a frozen page.`)

  const renderer = await page.evaluate(() => {
    const c = document.createElement("canvas")
    const gl = c.getContext("webgl2") || c.getContext("webgl")
    if (!gl) return "none"
    const ext = gl.getExtension("WEBGL_debug_renderer_info")
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unknown"
  })
  if (/swiftshader|software/i.test(String(renderer))) {
    throw new Error(`SwiftShader fallback (${renderer}) — --use-angle=metal did not take.`)
  }

  await page.waitForTimeout(3500)

  const scrubber = page.locator("[data-hero-scrub]")
  const canvas = page.locator("[data-hero-stage]")
  const setPlayhead = async (t) => {
    await scrubber.evaluate((el, value) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      setter.call(el, String(value))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, t)
  }
  const total = await scrubber.evaluate((el) => parseFloat(el.max))

  const readForm = () =>
    page.evaluate(() => {
      const el = document.querySelector("[data-hero-phase]")
      if (!el) return null
      const g = (k) => {
        const v = el.getAttribute(k)
        return v === null ? null : Number(v)
      }
      return {
        phase: el.getAttribute("data-hero-phase"),
        phaseT: g("data-hero-phase-t"),
        flat: g("data-hero-flat"),
        depth: g("data-hero-depth"),
        shade: g("data-hero-shade"),
        yaw: g("data-hero-yaw"),
        carve: g("data-hero-carve"),
        carveLaw: el.getAttribute("data-hero-carve-law"),
      }
    })

  /* THE THIRD BUILD CHANNEL — ink on the canvas. Measured through the same
   * pipeline everything below uses, so a blank stage cannot pass as "a frame
   * with no tonal event in it".
   *
   * Taken at the END of the timeline and NOT at t=0. t=0 is the first instant
   * of `draw`, where the reveal is genuinely zero and the page correctly shows
   * an empty sheet — a boot check there fails on a page that built perfectly.
   * The settled frame is the one that must always carry the whole word. */
  await setPlayhead(total)
  await page.waitForTimeout(900)
  const bootShot = await canvas.screenshot()
  const bootM = await measureBuffer(bootShot)
  if (!bootM || bootM.inkFull < 2000) {
    throw new Error(`the stage carries no mark at the settled frame (ink ${bootM ? bootM.inkFull : 0} px). The page did not build.`)
  }
  console.log(`[switch-tone] BUILT: settled frame carries ${bootM.inkFull} ink px, w ${bootM.w}`)

  /* ---- THE WINDOW, derived from the model's own phases ------------------
   * Never a hardcoded second — every hardcoded time in this beat's tooling has
   * been wrong at least once (storyboard §11.8). Walk the timeline coarsely,
   * find where `emerge` starts and where whatever follows it starts, and open
   * one coarse step either side so the last flat frame and the first settled
   * one are both inside. */
  const COARSE = 160
  const coarse = []
  for (let i = 0; i < COARSE; i++) {
    const t = (i / (COARSE - 1)) * total
    await setPlayhead(t)
    await page.waitForTimeout(18)
    const r = await readForm()
    coarse.push({ t, ...r })
  }
  const e0 = coarse.findIndex((m) => m.phase === "emerge")
  const e1 = coarse.findIndex((m, i) => i > e0 && m.phase !== "emerge")
  if (e0 <= 0) throw new Error("no `emerge` phase found on the timeline")
  const w0 = Math.max(0, coarse[e0 - 1].t)
  const w1 = e1 > 0 ? coarse[Math.min(coarse.length - 1, e1 + 1)].t : Math.min(total, w0 + 2)
  if (!(w1 > w0)) throw new Error(`window is not forwards: ${w0}..${w1}`)

  const rows = []
  for (let i = 0; i < FRAMES; i++) {
    const t = w0 + ((w1 - w0) * i) / (FRAMES - 1)
    await setPlayhead(t)
    await page.waitForTimeout(70)
    const form = await readForm()
    const buf = await canvas.screenshot()
    if (SAVE) writeFileSync(join(FRAMEDIR, String(i).padStart(4, "0") + ".png"), buf)
    const m = await measureBuffer(buf)
    rows.push({ i, t: Number(t.toFixed(4)), ...form, ...(m ?? {}) })
  }

  const meta = { label: LABEL, url: URL, total, w0, w1, frames: FRAMES, renderer, ticks, errors, carveArm: CARVE, toneArm: TONE }
  writeFileSync(join(OUT, "series.json"), JSON.stringify({ meta, rows }, null, 2))

  /* ---- the read-out ---------------------------------------------------- */
  console.log(`\n[switch-tone] ${LABEL}  renderer=${renderer}  rAF=${ticks}/500ms  errors=${errors.length}`)
  console.log(`[switch-tone] window ${w0.toFixed(3)}s..${w1.toFixed(3)}s over ${FRAMES} frames  (timeline ${total.toFixed(3)}s)`)
  console.log("\n  f     t      phase  flat  depth   yaw   shade |   ink    w    cx |  mean    sd   p05   med   p95 spread")
  for (const r of rows) {
    const f = (v, d = 2, w = 5) => (v === null || v === undefined || Number.isNaN(v) ? "-" : v.toFixed(d)).padStart(w)
    console.log(
      String(r.i).padStart(3),
      f(r.t, 3, 6),
      String(r.phase ?? "-").padStart(11),
      f(r.flat, 2, 5),
      f(r.depth, 3, 6),
      f(r.yaw, 3, 6),
      f(r.shade, 3, 6),
      "|",
      String(r.inkFull ?? 0).padStart(6),
      String(r.w ?? 0).padStart(4),
      f(r.cx, 1, 6),
      "|",
      f(r.mean, 1, 5),
      f(r.sd, 1, 5),
      f(r.p05, 1, 5),
      f(r.med, 1, 5),
      f(r.p95, 1, 5),
      f(r.spread, 1, 6),
    )
  }

  /* ---- THE SWITCH, isolated -------------------------------------------- */
  const lastFlat = [...rows].reverse().find((r) => r.flat !== null && r.flat >= 0.5 && r.i < rows.length - 1)
  const firstSolid = rows.find((r) => r.flat !== null && r.flat < 0.5)
  console.log("\n---- THE SWITCH ----")
  if (lastFlat && firstSolid) {
    const a = rows.find((r) => r.i === firstSolid.i - 1) ?? lastFlat
    console.log(`  last DRAWING frame  f${a.i}  t ${a.t.toFixed(3)}  flat ${a.flat}  w ${a.w}  mean ${a.mean?.toFixed(1)}  p05 ${a.p05?.toFixed(1)}  med ${a.med?.toFixed(1)}  p95 ${a.p95?.toFixed(1)}  sd ${a.sd?.toFixed(2)}`)
    console.log(`  first OBJECT frame  f${firstSolid.i}  t ${firstSolid.t.toFixed(3)}  flat ${firstSolid.flat}  w ${firstSolid.w}  mean ${firstSolid.mean?.toFixed(1)}  p05 ${firstSolid.p05?.toFixed(1)}  med ${firstSolid.med?.toFixed(1)}  p95 ${firstSolid.p95?.toFixed(1)}  sd ${firstSolid.sd?.toFixed(2)}`)
    const d = (k) => (firstSolid[k] ?? 0) - (a[k] ?? 0)
    console.log(`  Δ across the switch  mean ${d("mean").toFixed(2)}  p05 ${d("p05").toFixed(2)}  med ${d("med").toFixed(2)}  p95 ${d("p95").toFixed(2)}  sd ${d("sd").toFixed(2)}`)
  }

  /* THE READABLE COMPARISON — not the two sliver frames either side of the
   * dwell (both are 24 px of edge-on thickness and neither is what a viewer
   * calls "the drawing" or "the object"), but the last frame the mark is
   * legibly a DRAWING against the first frame it is legibly an OBJECT. Legible
   * = the silhouette is back to at least 40 % of its settled width, which is
   * the fidelity plateau §11.5 measures. That is the pair Sebs is comparing
   * when he says he cannot tell it switched. */
  const settledW = rows[rows.length - 1].w ?? 0
  const legible = (r) => (r.w ?? 0) >= 0.4 * settledW
  const lastLegibleFlat = [...rows].reverse().find((r) => r.flat >= 0.5 && legible(r))
  const firstLegibleSolid = rows.find((r) => r.flat < 0.5 && legible(r) && r.i > (lastLegibleFlat?.i ?? -1))
  console.log("\n---- THE READABLE PAIR (silhouette >= 40 % of settled, either side of the edge) ----")
  if (lastLegibleFlat && firstLegibleSolid) {
    const A = lastLegibleFlat
    const B = firstLegibleSolid
    console.log(`  DRAWING  f${A.i} t ${A.t.toFixed(3)}  w ${A.w}  mean ${A.mean.toFixed(1)}  p05 ${A.p05.toFixed(1)}  med ${A.med.toFixed(1)}  p95 ${A.p95.toFixed(1)}  sd ${A.sd.toFixed(2)}  spread ${A.spread.toFixed(1)}`)
    console.log(`  OBJECT   f${B.i} t ${B.t.toFixed(3)}  w ${B.w}  mean ${B.mean.toFixed(1)}  p05 ${B.p05.toFixed(1)}  med ${B.med.toFixed(1)}  p95 ${B.p95.toFixed(1)}  sd ${B.sd.toFixed(2)}  spread ${B.spread.toFixed(1)}`)
    console.log(`  Δ        mean ${(B.mean - A.mean).toFixed(2)}  med ${(B.med - A.med).toFixed(2)}  p95 ${(B.p95 - A.p95).toFixed(2)}  sd ${(B.sd - A.sd).toFixed(2)}  spread ${(B.spread - A.spread).toFixed(1)}`)
    console.log(`  frames apart: ${B.i - A.i}  (dt ${(B.t - A.t).toFixed(3)} s)`)
  }

  /* ---- THE END STATES, which is the number the fix has to move ----------
   * The flat mark at rest against the settled solid. If those two are close in
   * value, no amount of timing makes the switch read: the beat is asking a
   * viewer to notice a change between two things that look the same. */
  const flatRest = rows.find((r) => r.flat >= 0.999)
  const settled = rows[rows.length - 1]
  console.log("\n---- THE TWO END STATES ----")
  if (flatRest && settled) {
    console.log(`  FLAT at rest    mean ${flatRest.mean.toFixed(1)}  p05 ${flatRest.p05.toFixed(1)}  med ${flatRest.med.toFixed(1)}  p95 ${flatRest.p95.toFixed(1)}  sd ${flatRest.sd.toFixed(2)}  spread ${flatRest.spread.toFixed(1)}  ink ${flatRest.inkFull}`)
    console.log(`  SETTLED solid   mean ${settled.mean.toFixed(1)}  p05 ${settled.p05.toFixed(1)}  med ${settled.med.toFixed(1)}  p95 ${settled.p95.toFixed(1)}  sd ${settled.sd.toFixed(2)}  spread ${settled.spread.toFixed(1)}  ink ${settled.inkFull}`)
    console.log(`  Δ end to end    mean ${(settled.mean - flatRest.mean).toFixed(2)}  med ${(settled.med - flatRest.med).toFixed(2)}  p95 ${(settled.p95 - flatRest.p95).toFixed(2)}  sd ${(settled.sd - flatRest.sd).toFixed(2)}  spread ${(settled.spread - flatRest.spread).toFixed(1)}`)
  }
  if (errors.length) console.log("\nCONSOLE ERRORS:", errors.slice(0, 5))

  await context.close()
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
