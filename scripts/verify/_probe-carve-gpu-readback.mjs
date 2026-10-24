// _PROBE-CARVE-GPU-READBACK — the CPU and the GPU disagree; read the GPU's own
// numbers rather than reasoning about the gap.
//
// THE CONTRADICTION. `_probe-carve-render.mjs` rasterises
// `mix(envelope, pen, c) <= 0` straight off the real bake, on the CPU, and at
// carve 0.700 it reads a complete, solid "Desk Doodles". The GPU, at the same
// amplitude, off the same field (1152x294, R 11.29, both paths call
// `buildPenField` with `PEN_NIB_DEFAULT`), renders fragments. Registration, the
// nib argument, the worker-vs-sync bake, the field dimensions and stroke
// identity are all already ruled out with evidence.
//
// So this prints, per pixel, what the shader actually had in its hands:
//   fsPq (the flatten-group local position it tested)
//   fsPuv (where that landed in the field)
//   fsPf.r / fsPf.g (what the texture fetch returned)
//   fsSdU (the mixed distance, stroke units)
//   fsPpx (the screen derivative, stroke units per pixel)
//   fsPenCov (the coverage that became a sample mask)
// and compares each against the SAME arithmetic on the CPU at the position the
// GPU says it used. See `PenCarveUniforms.dbg` in components/viewport-3d.tsx.
//
// Usage:
//   node scripts/verify/_probe-carve-gpu-readback.mjs [--label=x]
//        [--engine=free-stroke|desk-doodles] [--phase=breath|draw] [--pct=80]
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"
import { loadTs } from "./_ts-load.mjs"
import { rawHeroStrokes, HERO_INK_WIDTH_PX, PROCESS_SETTINGS } from "./_hero-word.mjs"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
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
const LABEL = arg("label", "gpu")
const ENGINE = arg("engine", "free-stroke")
const PHASE = arg("phase", "breath")
const PCT = parseFloat(arg("pct", "80")) / 100
/** `off` parks the prior: the `DataTexture` object is reused across a size
 *  change, which three r175's immutable `texStorage2D` cannot carry. */
const REALLOC = arg("realloc", "on")
/* STAGED, because this wipe can reach committed evidence. It empties
 * `docs/verification/drawin-holes/<label>`, and the label is an argument, so the reach is the
 * whole subtree, 618 tracked files.
 * The capture now writes to a sibling `.<name>.staging` and the stored set is
 * replaced only when the run completes, so a run that dies partway leaves every
 * committed frame alone. The same wipe on `hero-windup`, killed 14 s in, deleted
 * all 102 of its tracked files. lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", "drawin-holes", LABEL)
const EV = stageEvidence(FINAL)
const OUT = EV.dir
const VIEW = { width: 1600, height: 1600 }

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

/* ---- THE CPU SIDE: the same bake, the same law ------------------------- */
const { processStroke } = loadTs("lib/stroke-processing.ts")
const { buildPenField, PEN_FIELD_TUBE_SLACK } = loadTs("lib/flat-ink.ts")
const HF = { wobble: 0, endpoint: "clean", inkWidth: HERO_INK_WIDTH_PX }
const cpuStrokes = rawHeroStrokes().map((s) =>
  processStroke(s, PROCESS_SETTINGS.spacing, PROCESS_SETTINGS.smoothing, PROCESS_SETTINGS.preserveCorners, 45, HF),
)
const field = buildPenField(cpuStrokes, HERO_INK_WIDTH_PX)
const R_CPU = HERO_INK_WIDTH_PX / 2

/** Bilinear, exactly as `_probe-carve-render.mjs` does it. */
const sampleAt = (x, y) => {
  const u = (x - field.minX) / field.unitsPerTexel - 0.5
  const v = (y - field.minY) / field.unitsPerTexel - 0.5
  const x0 = Math.floor(u), y0 = Math.floor(v)
  const fx = u - x0, fy = v - y0
  const cl = (i, n) => (i < 0 ? 0 : i >= n ? n - 1 : i)
  let r = 0, g = 0
  for (let j = 0; j <= 1; j++)
    for (let i = 0; i <= 1; i++) {
      const w = (i ? fx : 1 - fx) * (j ? fy : 1 - fy)
      const p = (cl(y0 + j, field.height) * field.width + cl(x0 + i, field.width)) * 2
      r += field.data[p] * w
      g += field.data[p + 1] * w
    }
  return [r, g]
}

/* Decode the 16-bit packing `applyPenCarve`'s readback writes. */
const dec = (r, g) => (r * 256 + g) / 65535
const DECODE = {
  1: (t) => (t - 0.5) * 6,
  2: (t) => (t - 0.5) * 6,
  3: (t) => (t - 0.5) * 80,
  4: (t) => (t - 0.5) * 80,
  5: (t) => (t - 0.5) * 80,
  6: (t) => t * 32,
  7: (t) => t,
  8: (t) => t,
  9: (t) => t,
  99: (t) => t,
}

async function main() {
  EV.open()
  console.log(`CPU bake: ${cpuStrokes.length} strokes  R ${R_CPU.toFixed(3)}  field ${field.width}x${field.height}`)

  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)))

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 120000 })
  await page.waitForTimeout(2500)

  /* THE ARM IS SET BEFORE ANY RE-BAKE. The defect is a property of the SECOND
   * upload into an allocation sized by the FIRST, so an arm applied after the
   * dials have moved would measure the fixed path either way. */
  const wantRealloc = REALLOC !== "off"
  {
    const ok = await page.evaluate((v) => window.__captureHarness.setFieldRealloc(v), wantRealloc)
    if (!ok) { console.error("setFieldRealloc refused"); process.exit(1) }
    const live = await page.evaluate(() => window.__captureHarness.fieldRealloc())
    say(live === wantRealloc, `the realloc arm (${wantRealloc ? "FIXED" : "PRIOR"}) actually took`, String(live))
  }

  await page.click(`[data-engine-option="${ENGINE}"]`)
  await page.waitForTimeout(3500)
  await page.evaluate(() => {
    for (const inp of document.querySelectorAll('input[type="range"]')) {
      const row = inp.closest("div")?.parentElement
      if (((row?.textContent ?? "").toLowerCase()).includes("wobble")) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
        setter.call(inp, "0")
        inp.dispatchEvent(new Event("input", { bubbles: true }))
        inp.dispatchEvent(new Event("change", { bubbles: true }))
        break
      }
    }
  })
  await page.waitForTimeout(2000)
  await page.evaluate(() => {
    for (const b of document.querySelectorAll("button")) {
      if ((b.textContent ?? "").trim().toLowerCase() === "clean") { b.click(); break }
    }
  })
  await page.waitForTimeout(2000)

  const state = await page.evaluate(() => {
    let wobble = null
    for (const inp of document.querySelectorAll('input[type="range"]')) {
      const row = inp.closest("div")?.parentElement
      if (((row?.textContent ?? "").toLowerCase()).includes("wobble")) { wobble = Number(inp.value); break }
    }
    const LABELS = { clean: "clean", protrude: "protrude", long: "long-overshoot", kink: "kink" }
    let endpoint = null
    for (const b of document.querySelectorAll("button")) {
      const key = LABELS[(b.textContent ?? "").trim().toLowerCase()]
      if (!key) continue
      const bg = getComputedStyle(b).backgroundColor
      if (!(bg === "rgba(0, 0, 0, 0)" || bg === "transparent")) endpoint = key
    }
    return {
      wobble,
      endpoint,
      engineFamily: document.querySelector("[data-engine-family]")?.getAttribute("data-engine-family") ?? null,
    }
  })
  say(state.engineFamily === ENGINE, `engine is ${ENGINE}`, String(state.engineFamily))
  say(state.wobble === 0, "wobble is 0", String(state.wobble))
  say(state.endpoint === "clean", "endpoint is CLEAN", String(state.endpoint))

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

  /* HIS FRAME. `--phase=draw` is the first screenshot (DRAW 80 %), `breath` is
   * the correction: the draw is COMPLETE and the held mark is still broken. */
  const span = await page.evaluate(() =>
    JSON.parse(document.querySelector("[data-hero-draw-span]").getAttribute("data-hero-draw-span")),
  )
  let T
  if (PHASE === "draw") T = span.at + span.duration * PCT
  else {
    /* BREATH IS FOUND BY SCANNING, not by a hardcoded second. The beat is
     * 12.3667 s / twelve phases and the storyboard has moved its edges twice;
     * a literal here is the drift class docs/README.md §sixth bug pattern
     * names. The scrub input owns the duration, so read it off that. */
    const dur = await page.evaluate(() => Number(document.querySelector("[data-hero-scrub]").max))
    const hits = []
    for (let k = 0; k <= 96; k++) {
      const t = (dur * k) / 96
      await seek(t)
      const nm = await page.evaluate(() => document.querySelector("[data-hero-phase]")?.getAttribute("data-hero-phase"))
      if (String(nm).toLowerCase().includes("breath")) hits.push(t)
    }
    if (hits.length === 0) { console.error("no BREATH phase found in the scan"); process.exit(1) }
    T = hits[0] + (hits[hits.length - 1] - hits[0]) * 0.83
    console.log(`BREATH scanned: ${hits[0].toFixed(3)}..${hits[hits.length - 1].toFixed(3)} s (${hits.length} samples)`)
  }
  await seek(T)
  const ph = await page.evaluate(() => {
    const el = document.querySelector("[data-hero-phase]")
    return {
      phase: el?.getAttribute("data-hero-phase"),
      phaseT: Number(el?.getAttribute("data-hero-phase-t")),
      carve: Number(el?.getAttribute("data-hero-carve")),
    }
  })
  console.log(`frame: t=${T.toFixed(3)}s  phase=${ph.phase} ${(ph.phaseT * 100).toFixed(1)}%  penCarve=${ph.carve}`)
  say(ph.carve > 0.5, "the carve is ON at this frame", String(ph.carve))

  const globals = await page.evaluate(() => window.__heroPenField ?? null)
  writeFileSync(join(OUT, "globals.json"), JSON.stringify(globals, null, 2))
  console.log("penField:", JSON.stringify(globals))
  say(globals.width === field.width && globals.height === field.height,
    "the GPU's field has the CPU bake's dimensions",
    `gpu ${globals.width}x${globals.height} vs cpu ${field.width}x${field.height}`)
  say(Math.abs(globals.radius - R_CPU) < 1e-6, "same R", `${globals.radius} vs ${R_CPU}`)
  /* THE ALLOCATION vs THE BAKE — the eraser, as one number. `fsPuv`'s 0..1
   * spans texW x texH, not width x height. */
  console.log(`TEXTURE: allocated ${globals.texW}x${globals.texH}   field ${globals.width}x${globals.height}   realloc=${globals.fieldRealloc}`)
  say(globals.texW === globals.width && globals.texH === globals.height,
    "the GL storage is the size of the field in it",
    `alloc ${globals.texW}x${globals.texH} vs field ${globals.width}x${globals.height}`)

  const canvas = page.locator("[data-hero-stage] canvas").first()
  const shotTo = async (name) => {
    const buf = await canvas.screenshot()
    writeFileSync(join(OUT, `${name}.png`), buf)
    return join(OUT, `${name}.png`)
  }

  /* ---- ARM 0: the shipped render, and the CPU probe's own law on the GPU */
  await page.evaluate(() => window.__captureHarness.setCarveHard(false))
  await page.evaluate(() => window.__captureHarness.setCarveDebug(0))
  await page.waitForTimeout(300)
  await shotTo("arm-shipped")

  await page.evaluate(() => window.__captureHarness.setCarveHard(true))
  await page.waitForTimeout(300)
  const hardOn = await page.evaluate(() => window.__captureHarness.carveDebug())
  say(hardOn.hard === 1, "the HARD arm actually took", JSON.stringify(hardOn))
  await shotTo("arm-hard")
  await page.evaluate(() => window.__captureHarness.setCarveHard(false))

  /* Carve 0, same frame, as the "nothing removed" reference. */
  await page.evaluate(() => window.__captureHarness.setFlatten({ penCarve: 0 }))
  await page.waitForTimeout(300)
  await shotTo("arm-carve0")
  await page.evaluate(() => window.__captureHarness.setFlatten(null))
  await page.waitForTimeout(300)

  /* ---- THE READBACK ---------------------------------------------------- */
  const modes = [99, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  const files = {}
  for (const m of modes) {
    const ok = await page.evaluate((mm) => window.__captureHarness.setCarveDebug(mm), m)
    if (!ok) { console.error(`setCarveDebug(${m}) refused`); process.exit(1) }
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(260)
    files[m] = await shotTo(`dbg-${m}`)
  }
  await page.evaluate(() => window.__captureHarness.setCarveDebug(0))

  say(errors.length === 0, "no page errors", errors.join(" | ") || "0")
  await context.close()
  await browser.close()

  /* ---- READ THE PACKED FRAMES ------------------------------------------ */
  const imgs = {}
  for (const m of modes) {
    const im = await loadImage(files[m])
    const cv = createCanvas(im.width, im.height)
    const cx = cv.getContext("2d")
    cx.drawImage(im, 0, 0)
    imgs[m] = { d: cx.getImageData(0, 0, im.width, im.height).data, w: im.width, h: im.height }
  }
  const W = imgs[99].w, H = imgs[99].h
  console.log(`\ncanvas ${W}x${H}`)

  /* THE CONTROL. Mode 99 emits a constant; if the screenshot path did not carry
   * the bytes intact then nothing below is a measurement. Only where the mark
   * is — outside it the background is the page, not the shader. */
  let ctlN = 0, ctlBad = 0, ctlMin = 1, ctlMax = 0
  const isShader = new Uint8Array(W * H)
  {
    const d = imgs[99].d
    for (let p = 0; p < W * H; p++) {
      const r = d[p * 4], g = d[p * 4 + 1], b = d[p * 4 + 2]
      // The packing always writes B = 0; the paper background does not.
      if (b !== 0) continue
      const v = dec(r, g)
      if (Math.abs(v - 0.375) < 0.002) { isShader[p] = 1; ctlN++; if (v < ctlMin) ctlMin = v; if (v > ctlMax) ctlMax = v }
      else if (Math.abs(v - 0.375) < 0.08) { ctlBad++ }
    }
  }
  say(ctlN > 20000, "the CONTROL mode reaches the file intact", `${ctlN} px at 0.375 (min ${ctlMin.toFixed(5)} max ${ctlMax.toFixed(5)}), ${ctlBad} px near-but-not`)

  /* ---- COMPARE, PIXEL BY PIXEL ----------------------------------------- */
  const rd = (m, p) => DECODE[m](dec(imgs[m].d[p * 4], imgs[m].d[p * 4 + 1]))
  const rows = []
  let n = 0
  let sumAbsR = 0, sumAbsG = 0, maxAbsR = 0, maxAbsG = 0
  let ppxs = [], covs = [], sdGpu = [], sdCpu = []
  const spanX = field.maxX - field.minX
  const spanY = field.maxY - field.minY
  const CARVE = ph.carve
  const slack = Math.max(0, (globals.envelopeR - PEN_FIELD_TUBE_SLACK) * globals.radius)
  for (let p = 0; p < W * H; p++) {
    if (!isShader[p]) continue
    const uvx = rd(8, p), uvy = rd(9, p)
    if (uvx <= 0 || uvx >= 1 || uvy <= 0 || uvy >= 1) continue
    const sx = field.minX + uvx * spanX
    const sy = field.minY + uvy * spanY
    const [cr, cg] = sampleAt(sx, sy)
    const gr = rd(3, p), gg = rd(4, p)
    const dr = gr - cr, dg = gg - cg
    sumAbsR += Math.abs(dr); sumAbsG += Math.abs(dg)
    if (Math.abs(dr) > maxAbsR) maxAbsR = Math.abs(dr)
    if (Math.abs(dg) > maxAbsG) maxAbsG = Math.abs(dg)
    const cpuSd = (cg - slack) + (cr - (cg - slack)) * CARVE
    sdGpu.push(rd(5, p)); sdCpu.push(cpuSd)
    ppxs.push(rd(6, p)); covs.push(rd(7, p))
    n++
    if (rows.length < 24 && p % 977 === 0) {
      rows.push({ p, x: p % W, y: (p / W) | 0, uvx, uvy, sx, sy, gpuR: gr, cpuR: cr, gpuG: gg, cpuG: cg, gpuSd: rd(5, p), cpuSd, ppx: rd(6, p), cov: rd(7, p) })
    }
  }
  const q = (a, f) => { const s = a.slice().sort((x, y) => x - y); return s[Math.round(f * (s.length - 1))] }
  console.log(`\nfragments read: ${n}`)
  if (n > 0) {
    console.log(`\nFIELD FETCH — GPU texture2D vs CPU bilinear at the GPU's OWN uv, stroke units`)
    console.log(`  pen  channel: mean |err| ${(sumAbsR / n).toFixed(4)}   max ${maxAbsR.toFixed(4)}`)
    console.log(`  tube channel: mean |err| ${(sumAbsG / n).toFixed(4)}   max ${maxAbsG.toFixed(4)}`)
    const dsd = sdGpu.map((v, i) => v - sdCpu[i])
    console.log(`\nMIXED DISTANCE  fsSdU (stroke units)`)
    console.log(`  GPU: p05 ${q(sdGpu, .05).toFixed(2)}  med ${q(sdGpu, .5).toFixed(2)}  p95 ${q(sdGpu, .95).toFixed(2)}`)
    console.log(`  CPU: p05 ${q(sdCpu, .05).toFixed(2)}  med ${q(sdCpu, .5).toFixed(2)}  p95 ${q(sdCpu, .95).toFixed(2)}`)
    console.log(`  |GPU-CPU|: med ${q(dsd.map(Math.abs), .5).toFixed(4)}  p99 ${q(dsd.map(Math.abs), .99).toFixed(4)}`)
    console.log(`\nDERIVATIVE  fsPpx (stroke units per screen px) — the term the CPU probe does NOT have`)
    console.log(`  p05 ${q(ppxs, .05).toFixed(3)}  med ${q(ppxs, .5).toFixed(3)}  p75 ${q(ppxs, .75).toFixed(3)}  p95 ${q(ppxs, .95).toFixed(3)}  p99 ${q(ppxs, .99).toFixed(3)}  max ${q(ppxs, 1).toFixed(3)}`)
    console.log(`\nCOVERAGE  fsPenCov`)
    const c0 = covs.filter((v) => v <= 0.002).length
    const c1 = covs.filter((v) => v >= 0.998).length
    console.log(`  = 0 : ${c0} (${(100 * c0 / n).toFixed(1)} %)   = 1 : ${c1} (${(100 * c1 / n).toFixed(1)} %)   ambiguous: ${n - c0 - c1} (${(100 * (n - c0 - c1) / n).toFixed(1)} %)`)
    console.log(`\nWHAT THE TWO LAWS DISAGREE ON, on the SAME fragments:`)
    const cpuKeep = sdCpu.filter((v) => v <= 0).length
    const gpuKeep = c1
    console.log(`  CPU law (sd <= 0) keeps ${cpuKeep} (${(100 * cpuKeep / n).toFixed(1)} %)`)
    console.log(`  GPU law keeps fully   ${gpuKeep} (${(100 * gpuKeep / n).toFixed(1)} %)`)
    console.log(`\nsamples:`)
    for (const r of rows)
      console.log(`  (${r.x},${r.y}) uv ${r.uvx.toFixed(4)},${r.uvy.toFixed(4)}  stroke ${r.sx.toFixed(1)},${r.sy.toFixed(1)}  pen g/c ${r.gpuR.toFixed(2)}/${r.cpuR.toFixed(2)}  tube g/c ${r.gpuG.toFixed(2)}/${r.cpuG.toFixed(2)}  sd g/c ${r.gpuSd.toFixed(2)}/${r.cpuSd.toFixed(2)}  ppx ${r.ppx.toFixed(2)}  cov ${r.cov.toFixed(3)}`)
  }

  writeFileSync(join(OUT, "readback.json"), JSON.stringify({ state, T, ph, globals, n, rows }, null, 2))
  /* THE SWAP, on completion and not on the pass flag. lib/evidence-swap.mjs */
  EV.commit()
  console.log(`\nframes: ${FINAL}`)
  console.log(pass ? "\nPROBE CLEAN" : "\nPROBE PROBLEMS ABOVE")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
