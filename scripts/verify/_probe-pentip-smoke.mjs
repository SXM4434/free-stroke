// _PROBE-PENTIP-SMOKE — does the new tip test COMPILE, RUN, and actually MOVE?
//
// The three ways this fix could be shipped dead, in the order they have
// actually happened in this repo:
//
//  1. THE SHADER DID NOT COMPILE. `THREE.WebGLProgram: Shader Error` kills the
//     material and the word renders NOTHING — and a screenshot of nothing looks
//     like a screenshot of a page that has not finished loading.
//  2. THE PAGE PRESENTED NO FRAMES. A `discard` inside a dynamically-bounded
//     loop hangs Chrome's Metal backend with rAF still ticking, JS responsive
//     and the console EMPTY (docs/README.md, the fifth bug pattern). The only
//     symptom is a screenshot timing out. `applyPenTip` has no loop, which is
//     the claim this probe settles rather than repeats.
//  3. THE DIAL DID NOTHING. Four tip modes that render four identical frames is
//     the dead-parameter class this beat has produced three times. So the smoke
//     test is not "it rendered" — it is that the four modes produce genuinely
//     DIFFERENT pixels, measured, with the pair that must differ named first.
//
// Usage: node scripts/verify/_probe-pentip-smoke.mjs
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { HERO_URL } from "./lib/dev-server.mjs"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const OUT = join(ROOT, "docs", "verification", "pentip", "smoke")
const VIEW = { width: 1600, height: 1600 }

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

async function inkOf(buf) {
  const img = await loadImage(buf)
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
  let n = 0
  for (let p = 0; p < luma.length; p++) {
    m[p] = luma[p] < cut ? 1 : 0
    n += m[p]
  }
  return { m, n, w: img.width, h: img.height }
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  /* deviceScaleFactor 2 for the same reason `_probe-pentip-sweep.mjs` uses it:
   * the mark is ~13 device pixels wide at scale 1, and every difference this
   * probe measures is a few pixels at the moving end. */
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2 })
  const page = await context.newPage()
  const errors = []
  const console_ = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)))
  page.on("console", (m) => {
    if (m.type() === "error") console_.push(m.text().slice(0, 300))
  })

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness, null, { timeout: 120000 })
  await page.waitForTimeout(2000)
  await page.click(`[data-register-option="desk-doodles"]`)
  await page.waitForTimeout(400)
  await page.click(`[data-engine-option="free-stroke"]`)
  await page.waitForTimeout(2500)

  const hasHook = await page.evaluate(() => typeof window.__captureHarness?.setPenTip === "function")
  say(hasHook, "the harness exposes setPenTip", String(hasHook))
  const rejects = await page.evaluate(() => window.__captureHarness.setPenTip("not-a-mode"))
  say(rejects === false, "setPenTip REFUSES an unknown mode", String(rejects))

  const span = await page.evaluate(() =>
    JSON.parse(document.querySelector("[data-hero-draw-span]").getAttribute("data-hero-draw-span")),
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
    await page.waitForTimeout(160)
  }

  // Mid-draw: far enough in that the pen is inside the word, not at either end.
  const T = span.at + span.duration * 0.55
  const modes = ["off", "cut", "nib", "quill"]
  const shots = {}
  for (const m of modes) {
    const ok = await page.evaluate((mm) => window.__captureHarness.setPenTip(mm), m)
    say(ok === true, `setPenTip("${m}") accepted`, String(ok))
    // Re-seek AFTER the mode change: the uniforms are written on the frame
    // loop, and a scrub is what guarantees a frame is actually painted.
    await seek(T - 0.01)
    await seek(T)
    const buf = await page.locator("[data-hero-stage]").screenshot()
    writeFileSync(join(OUT, `${m}.png`), buf)
    shots[m] = await inkOf(buf)
    console.log(`  ${m.padEnd(6)} ink ${shots[m].n}`)
  }

  const field = await page.evaluate(() => window.__heroPenTip ?? null)
  console.log("  __heroPenTip:", JSON.stringify(field))
  say(!!field, "the tip field baked and published its readout", field ? `${field.width}x${field.height}, ${field.bakeMs} ms` : "absent")
  if (field) {
    say(
      field.unitsPerTexel === field.expectedUnitsPerTexel,
      "the field is baked at the pitch the module says",
      `${field.unitsPerTexel} vs ${field.expectedUnitsPerTexel}`,
    )
    say(field.bakeMs < 120, "the bake is under the deferral floor explainer 20 §7 sets", `${field.bakeMs} ms`)
  }

  for (const m of modes) say(shots[m].n > 1000, `${m} — the mark is on screen at all`, `ink ${shots[m].n}`)

  const diff = (a, b) => {
    let d = 0
    for (let p = 0; p < a.m.length; p++) if (a.m[p] !== b.m[p]) d++
    return d
  }

  /* ---- THE NOISE FLOOR IS MEASURED, NOT GUESSED ------------------------
   *
   * ⚠ THE FIRST VERSION OF THIS PROBE ASSERTED `> 50`, `> 200` and `> 100`
   * PIXELS, and all three were numbers I made up before looking. They failed on
   * a build that was working: the mark is about thirteen device pixels wide at
   * scale 1, so a nose one half-width deep adds an area of order pi*r^2/2 ~ 70
   * px, not 200. A threshold invented ahead of the measurement is the same
   * defect as a window sized for an old beat — it just fails in the honest
   * direction.
   *
   * So the floor is the instrument's OWN repeatability: the same mode captured
   * twice, through the same seek-and-screenshot path. Anything that survives a
   * multiple of that is a real difference between shapes rather than the
   * capture moving under itself. */
  const repeats = {}
  for (const m of modes) {
    await page.evaluate((mm) => window.__captureHarness.setPenTip(mm), m)
    await seek(T - 0.01)
    await seek(T)
    repeats[m] = await inkOf(await page.locator("[data-hero-stage]").screenshot())
  }
  const noise = Math.max(...modes.map((m) => diff(shots[m], repeats[m])))
  console.log(`  same-mode repeat noise: ${modes.map((m) => `${m} ${diff(shots[m], repeats[m])}`).join(", ")}  → floor ${noise}`)
  say(noise < 200, "the capture path REPEATS — the noise floor is small enough to measure against", String(noise))
  const FLOOR = Math.max(20, noise * 4)

  // THE PAIRS THAT MUST DIFFER, named before they are measured.
  const dOffCut = diff(shots.off, shots.cut)
  const dCutNib = diff(shots.cut, shots.nib)
  const dNibQuill = diff(shots.nib, shots.quill)
  const dOffQuill = diff(shots.off, shots.quill)
  console.log(`  off→cut ${dOffCut}   cut→nib ${dCutNib}   nib→quill ${dNibQuill}   off→quill ${dOffQuill}   (floor ${FLOOR})`)
  say(dOffCut > FLOOR, "off → cut MOVES pixels (the facet removal is separable)", `${dOffCut} vs floor ${FLOOR}`)
  say(dCutNib > FLOOR, "cut → nib MOVES pixels (the nose is real)", `${dCutNib} vs floor ${FLOOR}`)
  say(dNibQuill > FLOOR, "nib → quill MOVES pixels (the taper is real)", `${dNibQuill} vs floor ${FLOOR}`)
  // A NIB ADDS INK AHEAD OF THE PEN; A TAPER TAKES IT AWAY. Direction, not just
  // magnitude — four modes that all differ but in the wrong direction would
  // still be four wrong modes.
  say(shots.nib.n > shots.cut.n, "the NOSE draws MORE ink than a cut", `${shots.nib.n} vs ${shots.cut.n}`)
  say(shots.quill.n < shots.nib.n, "the TAPER draws LESS ink than a round nose", `${shots.quill.n} vs ${shots.nib.n}`)

  // AND THE SETTLED FRAME MUST NOT MOVE AT ALL.
  await page.evaluate(() => window.__captureHarness.setPenTip("quill"))
  await seek(span.at + span.duration)
  const settledQuill = await inkOf(await page.locator("[data-hero-stage]").screenshot())
  await page.evaluate(() => window.__captureHarness.setPenTip("off"))
  await seek(span.at + span.duration - 0.01)
  await seek(span.at + span.duration)
  const settledOff = await inkOf(await page.locator("[data-hero-stage]").screenshot())
  const dSettled = diff(settledQuill, settledOff)
  say(dSettled === 0, "the FINISHED mark is byte-identical across tip modes", `${dSettled} px differ`)

  say(errors.length === 0, "no page errors", errors.join(" | ") || "0")
  const shaderErrs = console_.filter((t) => /Shader Error|undeclared|GL_INVALID/i.test(t))
  say(shaderErrs.length === 0, "no shader compile errors on the console", shaderErrs.join(" | ") || "0")

  writeFileSync(
    join(OUT, "smoke.json"),
    JSON.stringify({ field, ink: Object.fromEntries(modes.map((m) => [m, shots[m].n])), noise, floor: FLOOR, dOffCut, dCutNib, dNibQuill, dOffQuill, dSettled }, null, 2),
  )
  await context.close()
  await browser.close()
  console.log(`\nframes: ${OUT}`)
  console.log(pass ? "\nSMOKE CLEAN" : "\nSMOKE PROBLEMS ABOVE")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
