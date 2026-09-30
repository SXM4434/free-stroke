// WHERE THE BROWN LIVES — Δr−b and CIELAB chroma across the lit form, BY DECILE.
//
// Sebs, 2026-08-04: *"the 3d version is also too brown, should still feel
// black."* That is a law violation, not a preference. `lib/registers.ts` states
// the Desk Doodles register as *"One pencil. Matte ink, value from light —
// never hue, never gloss."* A form that reads brown is taking its value from
// HUE.
//
// ── WHY A DECILE TABLE AND NOT ONE NUMBER ─────────────────────────────────
// The gate that owns the claim (`assert-hero-switch.mjs` row 6) reads Δr−b of
// the BRIGHTEST DECILE ONLY, against a bar of 50 inherited from the ratified
// tan conviction (`rgb(142,118,91)`, Δr−b 50 — studio-rig.tsx). It measured
// 21.9 on the build Sebs calls brown, i.e. it passed with 28 points of margin
// on a picture his eye rejects. A single statistic at one end of the
// distribution cannot say whether the hue is a highlight artefact or the whole
// form, and "the whole form" is what "should still feel black" is about.
//
// So: the eroded interior is split into ten equal luma deciles and each one is
// reported with its own mean rgb, Δr−b, and CIELAB C* / hue angle. Δr−b is the
// ratified statistic and is kept for continuity; C* is added because Δr−b is
// scale-dependent — it grows with exposure at FIXED hue, so a form can be
// de-warmed and still read as more chromatic. C* is measured in a perceptual
// space where a shadow and a highlight of the same pigment sit at the same
// chroma, which is the question actually being asked.
//
// ── OPACITY ────────────────────────────────────────────────────────────────
// Asserted, not assumed. A prior contact sheet in this repo was written RGBA
// with 95.8% of its pixels at alpha 0 and read on black. Every capture here
// reports its transparent-pixel count and the probe refuses to measure a frame
// that is mostly transparent.
//
// Usage: node scripts/verify/_probe-brown-decile.mjs --label=<name> [--law=prior]
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
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
const LABEL = arg("label", null)
if (!LABEL) {
  console.error("--label=<name> is required. Every capture in this repo is named.")
  process.exit(1)
}
const LAW = arg("law", null)
/* `--rig=prior` parks the whole pre-2026-08-04 look — the warm studio rig AND
 * the warm ink — through the one documented global both files read. */
const RIG = arg("rig", null)
const OUT = join(ROOT, "docs", "verification", "brown-hunt", LABEL)

/* The gate's own two constants (assert-hero-switch.mjs / assert-hero-transition
 * gate 1). A probe that measures with a different threshold than the gate is a
 * probe whose numbers cannot be quoted at the gate. */
const INK_MAX_LUMA = 150
const ERODE = 3

/* ---- sRGB -> CIELAB (D65) ------------------------------------------------
 * The screenshot is sRGB-encoded. Δr−b is computed on those code values
 * because that is what the ratified conviction was measured in; C* needs the
 * real linear light, so it is decoded first. */
const srgbToLinear = (c) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const WHITE = [0.95047, 1.0, 1.08883]
function lab(r, g, b) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b)
  const X = 0.4124564 * R + 0.3575761 * G + 0.1804375 * B
  const Y = 0.2126729 * R + 0.7151522 * G + 0.0721750 * B
  const Z = 0.0193339 * R + 0.1191920 * G + 0.9503041 * B
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27) * t / 116 + 16 / 116)
  const fx = f(X / WHITE[0]), fy = f(Y / WHITE[1]), fz = f(Z / WHITE[2])
  const L = 116 * fy - 16
  const a = 500 * (fx - fy)
  const bb = 200 * (fy - fz)
  return { L, a, b: bb, C: Math.hypot(a, bb), h: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360 }
}

function interiorOf(luma, W, H) {
  let cur = new Uint8Array(W * H)
  for (let p = 0; p < W * H; p++) cur[p] = luma[p] <= INK_MAX_LUMA ? 1 : 0
  for (let pass = 0; pass < ERODE; pass++) {
    const next = new Uint8Array(W * H)
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const p = y * W + x
        if (!cur[p]) continue
        if (
          cur[p - 1] && cur[p + 1] && cur[p - W] && cur[p + W] &&
          cur[p - W - 1] && cur[p - W + 1] && cur[p + W - 1] && cur[p + W + 1]
        ) next[p] = 1
      }
    cur = next
  }
  return cur
}

export async function measureBuf(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const W = img.width
  const Hfull = img.height
  /* The lab viewport draws HTML transport chrome over the lower quarter of the
   * stage; it is not the render and must not enter the statistics. Same crop
   * the two gates use. */
  const H = Math.floor(Hfull * 0.75)

  let transparent = 0
  for (let p = 0; p < W * Hfull; p++) if (data[p * 4 + 3] < 255) transparent++

  const luma = new Float32Array(W * H)
  for (let p = 0; p < W * H; p++) {
    const i = p * 4
    luma[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
  }
  const cur = interiorOf(luma, W, H)
  const px = []
  for (let p = 0; p < W * H; p++) {
    if (!cur[p]) continue
    const i = p * 4
    px.push([luma[p], data[i], data[i + 1], data[i + 2]])
  }
  if (!px.length) {
    return { W, H: Hfull, transparent, n: 0, deciles: [], all: null }
  }
  px.sort((a, b) => a[0] - b[0])
  const deciles = []
  for (let d = 0; d < 10; d++) {
    const lo = Math.floor((d * px.length) / 10)
    const hi = Math.floor(((d + 1) * px.length) / 10)
    const slice = px.slice(lo, hi)
    if (!slice.length) continue
    const n = slice.length
    const m = slice.reduce(
      (a, v) => [a[0] + v[0], a[1] + v[1], a[2] + v[2], a[3] + v[3]],
      [0, 0, 0, 0],
    ).map((v) => v / n)
    const L = lab(m[1], m[2], m[3])
    deciles.push({
      d: d + 1,
      n,
      luma: m[0],
      rgb: [m[1], m[2], m[3]],
      drb: m[1] - m[3],
      C: L.C,
      hue: L.h,
      Lstar: L.L,
    })
  }
  const n = px.length
  const m = px.reduce((a, v) => [a[0] + v[0], a[1] + v[1], a[2] + v[2], a[3] + v[3]], [0, 0, 0, 0]).map((v) => v / n)
  const L = lab(m[1], m[2], m[3])
  const med = px[Math.floor(n * 0.5)][0]
  /* PER-PIXEL C*, then averaged — NOT the C* of the mean colour. The two differ
   * whenever chroma varies across the form, and the per-pixel mean is the one
   * that cannot be gamed by a form whose warm and cool halves average neutral. */
  let cSum = 0
  let cHi = 0
  const cs = []
  for (const v of px) {
    const q = lab(v[1], v[2], v[3])
    cSum += q.C
    cs.push(q.C)
  }
  cs.sort((a, b) => a - b)
  cHi = cs[Math.floor(cs.length * 0.9)]
  return {
    W,
    H: Hfull,
    transparent,
    n,
    med,
    mean: m[0],
    rgb: [m[1], m[2], m[3]],
    drb: m[1] - m[3],
    C: L.C,
    hue: L.h,
    pxC: cSum / n,
    p90C: cHi,
    deciles,
  }
}

function table(name, s) {
  const lines = []
  lines.push(
    `\n${name}   ${s.W}x${s.H}px · ${s.n} interior px · transparent ${s.transparent}` +
      (s.n ? ` · interior median luma ${s.med.toFixed(1)}` : ""),
  )
  if (!s.n) {
    lines.push("  NO INTERIOR — nothing to measure")
    return lines.join("\n")
  }
  lines.push("  decile   n      luma     r,g,b            Δr−b     C*     hue°")
  for (const d of s.deciles) {
    lines.push(
      `  ${String(d.d).padStart(2)}    ${String(d.n).padStart(6)}  ` +
        d.luma.toFixed(1).padStart(6) + "   " +
        d.rgb.map((v) => v.toFixed(0).padStart(3)).join(",").padEnd(14) +
        d.drb.toFixed(2).padStart(7) +
        d.C.toFixed(2).padStart(7) +
        d.hue.toFixed(0).padStart(7),
    )
  }
  lines.push(
    `  WHOLE FORM  mean rgb ${s.rgb.map((v) => v.toFixed(0)).join(",")}  Δr−b ${s.drb.toFixed(2)}  ` +
      `C*(of mean) ${s.C.toFixed(2)}  mean per-px C* ${s.pxC.toFixed(2)}  p90 C* ${s.p90C.toFixed(2)}  hue ${s.hue.toFixed(0)}°`,
  )
  return lines.join("\n")
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 1440 }, deviceScaleFactor: 2 })
  const page = await context.newPage()
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 200))
  })
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 200)))
  if (LAW) await page.addInitScript((v) => { window.__heroLitLaw = v }, LAW)
  if (RIG) await page.addInitScript((v) => { window.__studioRigLaw = v }, RIG)
  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 90000 })

  /* THE BUILD ASSERTION — a page that never booted renders identically to
   * another page that never booted. rAF must tick and the GPU must be real;
   * without --use-angle=metal Chrome falls back to SwiftShader, which pauses
   * the loop with no error. */
  const ticks = await page.evaluate(
    () => new Promise((res) => {
      let n = 0
      const t0 = performance.now()
      const step = () => { n++; performance.now() - t0 < 400 ? requestAnimationFrame(step) : res(n) }
      requestAnimationFrame(step)
    }),
  )
  const renderer = await page.evaluate(() => {
    const c = document.createElement("canvas")
    const gl = c.getContext("webgl2") || c.getContext("webgl")
    if (!gl) return "none"
    const e = gl.getExtension("WEBGL_debug_renderer_info")
    return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : "unknown"
  })
  if (ticks < 8) throw new Error(`rAF is not running (${ticks} ticks). Refusing to judge a frozen page.`)
  if (/swiftshader|software/i.test(String(renderer))) {
    throw new Error(`SwiftShader (${renderer}) — --use-angle=metal did not take.`)
  }
  await page.waitForTimeout(3500)

  const scrubber = page.locator("[data-hero-scrub]")
  const stage = page.locator("[data-hero-stage]")
  const total = await scrubber.evaluate((el) => parseFloat(el.max))
  const setPlayhead = async (t) => {
    await scrubber.evaluate((el, value) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      setter.call(el, String(value))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, t)
  }

  /* PLAYHEADS FROM THE PAGE'S OWN PHASES — never hardcoded. Every hardcoded
   * time in this beat's tooling has been wrong at least once. */
  const marks = []
  for (let i = 0; i < 160; i++) {
    const t = (i / 159) * total
    await setPlayhead(t)
    await page.waitForTimeout(12)
    const r = await page.evaluate(() => {
      const el = document.querySelector("[data-hero-phase]")
      if (!el) return null
      return { ph: el.getAttribute("data-hero-phase") }
    })
    marks.push({ t, ...r })
  }
  const midOf = (phase) => {
    const hit = marks.filter((m) => m.ph === phase)
    if (!hit.length) return null
    return hit[Math.floor(hit.length / 2)].t
  }

  const shots = {}
  const grab = async (name, t, orbit) => {
    await setPlayhead(t)
    await page.waitForTimeout(500)
    if (orbit) {
      await page.waitForFunction(
        (q) => window.__captureHarness.orbitView(q[0], q[1], q[2]),
        orbit,
        { timeout: 15000 },
      )
      await page.waitForTimeout(400)
      await page.evaluate((q) => window.__captureHarness.orbitView(q[0], q[1], q[2]), orbit)
      await page.waitForTimeout(350)
    }
    const buf = await stage.screenshot()
    writeFileSync(join(OUT, `${name}.png`), buf)
    shots[name] = await measureBuf(buf)
  }

  const tFlat = midOf("breath")
  const tSolid = midOf("solid")
  const tOrbit = midOf("orbit")
  if (tFlat === null || tSolid === null) throw new Error("the beat has no breath/solid phase")

  await grab("flat", tFlat, null)
  await grab("solid-headon", tSolid, null)
  await grab("solid-34", tSolid, [30, 16, 1.0])
  if (tOrbit !== null) await grab("orbit", tOrbit, null)

  await browser.close()

  console.log(`\nrenderer ${renderer} · rAF ${ticks}/400ms · lit-law ${LAW ?? "shipped"} · rig-law ${RIG ?? "shipped"} · label ${LABEL}`)
  console.log(`playheads: flat ${tFlat.toFixed(3)}s · solid ${tSolid.toFixed(3)}s` + (tOrbit !== null ? ` · orbit ${tOrbit.toFixed(3)}s` : ""))
  for (const [k, v] of Object.entries(shots)) console.log(table(k, v))
  console.log(`\nconsole errors: ${errors.length}${errors.length ? " — " + errors[0] : ""}`)
  console.log(`frames -> ${OUT}`)
  writeFileSync(join(OUT, "measurements.json"), JSON.stringify({ label: LABEL, law: LAW, rig: RIG, renderer, shots }, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
