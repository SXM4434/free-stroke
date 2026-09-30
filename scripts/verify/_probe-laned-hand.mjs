// _PROBE-LANED-HAND — IS THE FIX REACHABLE BY A HAND, OR ONLY BY A HARNESS?
//
// AUDIT INSTRUMENT (lane D, read-only on source).
//
// `assert-drawin-attrs.mjs` drives three of its four dials with REAL clicks, but
// it sets the wobble slider by calling the native `value` setter and dispatching
// synthetic `input`/`change` events (assert-drawin-attrs.mjs:112-116). That is a
// state injection through the DOM, not a gesture — it never presses a button and
// never moves a pointer, so it cannot prove a hand can reach the state. This
// repo's own rule: *"a whole panel once rendered zero controls while harness
// assertions passed."*
//
// So this one uses `page.mouse` throughout — a real press, a real drag with
// intermediate moves, a real release — then presses the page's OWN Play button
// and watches the whole draw beat run, rather than scrubbing to a playhead.
// A scrub sets a time; PLAY is what Sebs does.
//
// PASS conditions:
//   1 · the four channels read back off computed style as the state that repros;
//   2 · no sampled frame of the playing beat is blank once the mark has started;
//   3 · zero `not big enough` messages, at EVERY console level.
//
// Usage: FS_PORT=3104 node scripts/verify/_probe-laned-hand.mjs
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const PORT = process.env.FS_PORT || "3000"
const OUT = join(ROOT, "docs", "verification", "lane-d-audit", "hand")

let pass = true
const rows = []
const say = (ok, label, detail) => {
  if (!ok) pass = false
  rows.push({ ok, label, detail })
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1600, height: 1600 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const logs = []
  page.on("console", (m) => logs.push({ type: m.type(), text: m.text().slice(0, 200) }))
  page.on("pageerror", (e) => logs.push({ type: "pageerror", text: String(e).slice(0, 200) }))
  const glFails = () => logs.filter((l) => l.text.includes("not big enough")).length

  await page.goto(`http://localhost:${PORT}/desk-doodles`, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__inflateProbe, null, { timeout: 120000 })
  await page.waitForTimeout(2500)

  /** A real press: move the pointer onto the element's centre, press, release. */
  const handClick = async (locator, what) => {
    const el = typeof locator === "string" ? page.locator(locator).first() : locator
    await el.scrollIntoViewIfNeeded()
    const b = await el.boundingBox()
    if (!b) throw new Error(`no box for ${what}`)
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await page.waitForTimeout(120)
    await page.mouse.down()
    await page.waitForTimeout(80)
    await page.mouse.up()
  }

  await handClick('[data-engine-option="free-stroke"]', "engine pill")
  await page.waitForTimeout(4500)
  await handClick('[data-word-source="font"]', "word pill")
  await page.waitForTimeout(5500)

  /* THE WOBBLE SLIDER, DRAGGED. Press on the thumb, walk left in ten steps with
   * the button held, release past the left edge. No `dispatchEvent` anywhere. */
  const wob = page
    .locator('input[type="range"]')
    .filter({ has: page.locator("xpath=/..") })
  const wobbleBox = await page.evaluate(() => {
    const list = [...document.querySelectorAll('input[type="range"]')]
    for (let i = 0; i < list.length; i++) {
      const row = list[i].closest("div")?.parentElement
      if (((row?.textContent ?? "").toLowerCase()).includes("wobble")) {
        list[i].scrollIntoView({ block: "center" })
        const r = list[i].getBoundingClientRect()
        return { i, x: r.x, y: r.y, w: r.width, h: r.height, value: Number(list[i].value) }
      }
    }
    return null
  })
  say(!!wobbleBox, "the WOBBLE slider is findable on the page as a real control", JSON.stringify(wobbleBox))
  if (wobbleBox) {
    const cy = wobbleBox.y + wobbleBox.h / 2
    await page.mouse.move(wobbleBox.x + wobbleBox.w * 0.5, cy)
    await page.mouse.down()
    for (let s = 1; s <= 10; s++) {
      await page.mouse.move(wobbleBox.x + wobbleBox.w * (0.5 - 0.06 * s), cy)
      await page.waitForTimeout(90)
    }
    await page.mouse.move(wobbleBox.x - 30, cy)
    await page.mouse.up()
  }
  await page.waitForTimeout(4500)

  const cleanBtn = page.locator("button", { hasText: /^clean$/i }).first()
  await handClick(cleanBtn, "CLEAN endpoint pill")
  await page.waitForTimeout(4500)

  // ---- the state, read off computed style, the way a hand would see it ----
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
    }
  })
  console.log(`state after the HAND pass: ${JSON.stringify(state)}`)
  say(state.engineFamily === "free-stroke", "engine reached FREE STROKE by pointer alone", String(state.engineFamily))
  say(state.word === "font", "word reached FONT by pointer alone", String(state.word))
  say(state.wobble === 0, "wobble reached 0 by DRAGGING the slider", String(state.wobble))
  say(state.endpoint === "clean", "endpoint reached CLEAN by pointer alone", String(state.endpoint))

  const census = await page.evaluate(() => {
    const c = window.__inflateProbe.attrCensus(-1)
    return c.reduce((a, b) => (b.indexCount > (a?.indexCount ?? -1) ? b : a), null)
  })
  say(
    census.short.length === 0,
    "after the hand pass, no attribute is short of the index buffer",
    `position ${census.attrs.position} · aFsLetter ${census.attrs.aFsLetter ?? "(absent)"} · short ${JSON.stringify(census.short)}`,
  )

  /* ---- AND NOW PRESS PLAY. Not a scrub — the page's own transport. ---- */
  const span = await page.evaluate(() =>
    JSON.parse(document.querySelector("[data-hero-draw-span]").getAttribute("data-hero-draw-span")),
  )
  const glBeforePlay = glFails()
  await handClick("[data-hero-play]", "PLAY")

  const ink = async (tag) => {
    const buf = await page.locator("[data-hero-stage]").screenshot()
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
    let n = 0
    for (let p = 0; p < luma.length; p++) if (luma[p] < cut) n++
    writeFileSync(join(OUT, `play-${tag}.png`), buf)
    return n
  }

  /* Sample the whole draw beat while it PLAYS. The playhead is read back from
   * the page rather than assumed, so a sample knows where it landed. */
  const samples = []
  const t0 = Date.now()
  const endMs = (span.at + span.duration) * 1000 + 400
  let k = 0
  while (Date.now() - t0 < endMs) {
    const t = await page.evaluate(() => {
      const el = document.querySelector("[data-hero-scrub]")
      return el ? Number(el.value) : null
    })
    const n = await ink(String(k).padStart(2, "0"))
    samples.push({ k, t, ink: n, elapsedMs: Date.now() - t0 })
    k++
  }
  const glDuringPlay = glFails() - glBeforePlay
  console.log(
    "\n  #   playhead(s)   ink px\n" +
      samples.map((s) => `  ${String(s.k).padStart(2)}   ${String(s.t?.toFixed(3)).padStart(9)}   ${String(s.ink).padStart(7)}`).join("\n"),
  )

  /* THE BLANK TEST. Skip samples before the mark has started — a genuinely empty
   * first frame is correct, not the defect. */
  const started = samples.filter((s) => s.ink > 500)
  const firstStarted = samples.findIndex((s) => s.ink > 500)
  const afterStart = firstStarted >= 0 ? samples.slice(firstStarted) : []
  const blanks = afterStart.filter((s) => s.ink <= 1)
  say(started.length >= 5, "the beat actually drew while PLAYING — enough inked samples to judge", `${started.length} of ${samples.length} samples over 500 px`)
  say(
    blanks.length === 0,
    "no frame of the PLAYING beat goes blank after the mark has started",
    blanks.length ? `${blanks.length} blank sample(s) at t=${blanks.map((b) => b.t?.toFixed(3)).join(",")}` : `min ink after start ${Math.min(...afterStart.map((s) => s.ink))} px over ${afterStart.length} samples`,
  )
  say(glDuringPlay === 0, "the driver rejected no draw while the beat PLAYED", `${glDuringPlay} × "not big enough"`)
  const errs = logs.filter((l) => l.type === "error" || l.type === "pageerror")
  say(errs.length === 0, "no console errors and no page errors across the whole hand pass", `${errs.length}`)

  writeFileSync(join(OUT, "hand.json"), JSON.stringify({ state, census, samples, glDuringPlay, rows, logs: logs.slice(-25) }, null, 2))
  console.log(`\n${rows.length} rows · ${pass ? "ALL PASS" : "FAILURES ABOVE"}`)
  console.log(OUT)
  await context.close()
  await browser.close()
  process.exit(pass ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
