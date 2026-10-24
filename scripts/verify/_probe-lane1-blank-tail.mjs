// _PROBE-LANE1-BLANK-TAIL — WHY DOES THE FONT WORD GO BLANK AT 94 % OF THE DRAW?
//
// `_probe-drawin-vanish.mjs --engine=free-stroke --word=font` reads the mark at
// 23 846 ink px at DRAW 93.5 % and **1 px** at 94 %, and it stays at 1 for every
// step to 100 %. Mesh count and triangle count do not move through it. So the
// geometry is built and something between it and the screen is removing all of
// it — and from the outside "never submitted" and "submitted and discarded" are
// the same blank picture.
//
// This asks the ONE number that separates them: the drawRange the GPU was handed
// (`__inflateProbe.revealState()`), beside the reveal fraction that produced it.
//
//   count 0            -> the index range was cut to nothing. The reveal's own
//                         arithmetic. Read `frac`: `revealDistanceFraction`
//                         returns 0 for any non-positive OR NaN input, because
//                         its guard is `if (!(timeFrac > 0)) return 0`, and a
//                         NaN fails that test exactly like a 0 does.
//   count == total     -> everything was submitted and the FRAGMENTS went, which
//                         is the carve / tip / coverage family, not the reveal.
//
// Usage: node scripts/verify/_probe-lane1-blank-tail.mjs [--engine=free-stroke]
//        [--word=font] [--from=90] [--to=100] [--steps=41]
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const ENGINE = arg("engine", "free-stroke")
const WORD = arg("word", "font")
const FROM = parseFloat(arg("from", "90")) / 100
const TO = parseFloat(arg("to", "100")) / 100
const STEPS = parseInt(arg("steps", "41"), 10)
const PORT = process.env.FS_PORT || "3000"
const OUT = join(ROOT, "docs", "verification", "drawin-vanish", `blank-tail-${ENGINE}-${WORD}`)

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1600, height: 1600 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)))
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 300)) })

  await page.goto(`http://localhost:${PORT}/desk-doodles`, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 120000 })
  await page.waitForTimeout(2500)
  await page.click(`[data-engine-option="${ENGINE}"]`)
  await page.waitForTimeout(3500)
  if (WORD !== "traced") {
    await page.click(`[data-word-source="${WORD}"]`)
    await page.waitForTimeout(4000)
  }

  /* HIS TWO DIAL CHANGES, AND THEY ARE NOT COSMETIC. Wobble 0 and endpoint CLEAN
   * are what RESIZE the pen field — the pair that made the r175 texStorage2D
   * eraser bug reachable by hand and invisible to a battery that never touches a
   * dial. The first run of this probe omitted them and the blank did not appear,
   * which is itself the finding: the defect lives in the state Sebs actually
   * uses, not in the state a harness loads. */
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
  await page.waitForTimeout(2500)
  await page.evaluate(() => {
    for (const b of document.querySelectorAll("button")) {
      if ((b.textContent ?? "").trim().toLowerCase() === "clean") { b.click(); break }
    }
  })
  await page.waitForTimeout(2500)

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
    await page.waitForTimeout(200)
  }

  const inkOf = async () => {
    const buf = await page.locator("[data-hero-stage]").screenshot()
    const { createCanvas, loadImage } = createRequire(import.meta.url)("@napi-rs/canvas")
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
    return n
  }

  const rows = []
  for (let k = 0; k < STEPS; k++) {
    const pct = FROM + ((TO - FROM) * k) / Math.max(1, STEPS - 1)
    await seek(span.at + span.duration * pct)
    const r = await page.evaluate(() => {
      const rs = window.__inflateProbe?.revealState?.() ?? null
      return {
        rs,
        // The playhead the viewport is actually reading, as the page publishes it.
        reveal: document.querySelector("[data-hero-reveal]")?.getAttribute("data-hero-reveal") ?? null,
        phase: document.querySelector("[data-hero-phase]")?.getAttribute("data-hero-phase") ?? null,
      }
    })
    /* EVERY range, not `[0]`. The first version of this probe printed
     * `Infinity / 6` for forty rows because `collect()` also returns small
     * helper geometries and the mark was not index 0 — a reading taken off the
     * wrong object, which is the same class of error as grading a stale capture. */
    const ink = await inkOf()
    const all = r.rs?.ranges ?? []
    const big = all.reduce((a, b) => (b.totalIndices > (a?.totalIndices ?? -1) ? b : a), null)
    rows.push({ pct: +(pct * 100).toFixed(2), frac: r.rs?.frac ?? null, ranges: all, big, phase: r.phase })
    console.log(
      `${String((pct * 100).toFixed(2)).padStart(7)} %   frac ${String(r.rs?.frac).padStart(20)}   MARK drawRange ${String(big?.count).padStart(9)} / ${String(big?.totalIndices).padStart(9)}   INK ${String(ink).padStart(7)}   verts ${String(big?.vertexCount).padStart(7)}  maxIdx ${String(big?.maxIndex).padStart(7)}  firstBad ${String(big?.firstBadIndex).padStart(8)}  phase ${r.phase}`,
    )
  }
  /* ---- OFAT ON THE TWO FRAGMENT TESTS ------------------------------------
   *
   * The drawRange rows above show the mark SUBMITTED at ~98 % of its indices
   * while the picture is blank, so the geometry reached the rasteriser and
   * every fragment was discarded. Exactly two passes discard here — the pen
   * CARVE and the pen TIP — so they are swept one at a time, at a playhead the
   * sweep proved blank, and the ink is counted off the real stage.
   *
   * One at a time, and both, because two passes each removing "most" of the
   * mark would leave neither individually responsible. */
  const OFAT_AT = 0.96
  await seek(span.at + span.duration * OFAT_AT)
  const arms = []
  /* ⚠ THE SETTER'S RETURN IS PART OF THE READING (Lane Q, 2026-08-07).
   *
   * This block used to record only the ink. An arm that never reached the
   * render and an arm that reached it and changed nothing produce the same
   * number, and one of the arms below WAS the first kind for three days: the
   * `flat 0 (lit solid)` row set a key that is not on `FlatState` at all, and
   * `setFlatten` returned `true` for it, so the row published a verdict about a
   * path it had never touched (explainer 24 §8). `setFlatten` validates now, so
   * the answer is available for the asking — and it is asked, per arm, and
   * written into the artefact. An arm whose setter returns `false` set NOTHING
   * and its ink reading is the shipped frame under another label. */
  const run = async (name, setup, teardown) => {
    let setReturn = null
    if (setup) setReturn = await setup()
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(400)
    const ink = await inkOf()
    arms.push({ name, ink, setReturn })
    console.log(
      `   OFAT  ${name.padEnd(34)} ink ${String(ink).padStart(8)} px   setter ${String(setReturn)}`,
    )
    if (teardown) await teardown()
    await page.waitForTimeout(300)
  }
  const flat = (o) => () => page.evaluate((v) => window.__captureHarness.setFlatten(v), o)
  const tip = (n) => () => page.evaluate((v) => window.__captureHarness.setPenTip(v), n)
  const clear = flat(null)
  console.log(`\n--- OFAT at DRAW ${(OFAT_AT * 100).toFixed(0)} % ---`)
  await run("shipped", null, null)
  /* THE NEGATIVE CONTROL, ON THE BARE INVOCATION. A key that cannot exist must
   * be REFUSED and must move nothing; without it every 0-change row below is
   * indistinguishable from a row that never ran. Explainer 21 §7's law: the
   * control runs on the default path, never behind a flag. */
  await run("CONTROL · a key that cannot exist", flat({ __laneQBogus: 0 }), clear)
  await run("carve OFF", flat({ penCarve: 0 }), clear)
  await run("tip OFF", tip("off"), tip("reed"))
  await run("jointBreak 0", flat({ jointBreak: 0 }), clear)
  await run("  …opposite: jointBreak 1", flat({ jointBreak: 1 }), clear)
  /* 🔴 THE RETRACTED ARM, KEPT AND LABELLED — it used to read
   * `flat 0 (lit solid)` and it is the row explainer 24 §8 retracts. `flat` is
   * not one of `FlatState`'s thirteen keys, so this arm set NOTHING while
   * reporting a verdict about "the flat-ink path". It is kept rather than
   * deleted because with the validator in place it now RETURNS FALSE, and a
   * retracted row that says so out loud is worth more than a tidy one. The
   * honest arm it was always trying to be is the next line: the flat-ink blend
   * is `ink`, not `flat`. */
  await run("RETRACTED · flat 0 + depth 1 (DEAD KEY)", flat({ flat: 0, depth: 1 }), clear)
  await run("the lit solid, honestly · ink 0 + depth 1", flat({ ink: 0, depth: 1 }), clear)
  await run("ink 0", flat({ ink: 0 }), clear)
  await run("  …opposite: ink 1", flat({ ink: 1 }), clear)
  await run(
    "carve + tip OFF",
    async () => {
      const a = await page.evaluate(() => window.__captureHarness.setFlatten({ penCarve: 0 }))
      const b = await page.evaluate(() => window.__captureHarness.setPenTip("off"))
      return a && b
    },
    async () => {
      await page.evaluate(() => window.__captureHarness.setFlatten(null))
      await page.evaluate(() => window.__captureHarness.setPenTip("reed"))
    },
  )

  writeFileSync(join(OUT, "blank-tail.json"), JSON.stringify({ span, rows, arms, errors }, null, 2))
  if (errors.length) console.log("\nPAGE ERRORS:\n" + errors.slice(0, 6).join("\n"))
  await context.close()
  await browser.close()
  console.log(`\n${OUT}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
