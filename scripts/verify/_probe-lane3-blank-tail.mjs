// _PROBE-LANE3-BLANK-TAIL — WHICH PASS BLANKS THE FONT WORD AT 94 % OF THE DRAW?
//
// `docs/verification/drawin-vanish/BLANK-TAIL-FONT-WORD.md` is the open defect:
// on **FREE STROKE + the FONT word + wobble 0 + endpoint CLEAN** the whole mark
// goes from 94 323 ink px at DRAW 93 % to **1 px** at 94 % and stays gone to
// 100 %, reversibly on the playhead, with 335 820 of 359 568 indices SUBMITTED
// — more than at 93 %.
//
// The prior lane ruled out the reveal fraction, `setDrawRange`, visibility,
// culling, world position, scale, material opacity/transparent/colorWrite and
// out-of-range indices, then swept the three fragment passes ONE AT A TIME and
// found none of them individually responsible.
//
// ── WHY THAT SWEEP COULD NOT HAVE FOUND IT ────────────────────────────────
// OFAT is blind to a defect that fires in TWO passes at once, and a SHARED
// INPUT is exactly that shape: the joint break, the pen carve and the pen tip
// all transform every fragment by `inverse(group.matrixWorld)`, all three read
// a baked field through a box, and all three `discard`. Turning one off leaves
// the other two blanking the same mark, so every arm reads "still blank" and
// every arm is innocent.
//
// So this probe does three things the prior one could not:
//   1. reads `__inflateProbe.drawDiag()` — the actual uniform values handed to
//      all three passes in the frame that produced the picture, plus
//      `WebGLRenderer.info.render.triangles`, which separates "the driver
//      dropped the draw call" from "every fragment was discarded";
//   2. sweeps the cliff at 0.25 % so the threshold is a NUMBER, not a bracket;
//   3. runs the OFAT arms in the POWER SET of the three discards, not one at a
//      time — including all three off together, which is the only arm that can
//      exonerate the fragment stage as a whole.
//
// Usage: node scripts/verify/_probe-lane3-blank-tail.mjs [--engine=free-stroke]
//        [--word=font] [--from=90] [--to=100] [--steps=41] [--dsf=1]
import { chromium } from "playwright-core"
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
const DSF = parseInt(arg("dsf", "1"), 10)
const LABEL = arg("label", `lane3-${ENGINE}-${WORD}`)
const PORT = process.env.FS_PORT || "3000"
const OUT = join(ROOT, "docs", "verification", "drawin-vanish", LABEL)

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal"] })
  const context = await browser.newContext({ viewport: { width: 1600, height: 1600 }, deviceScaleFactor: DSF })
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

  /* HIS TWO DIAL CHANGES — wobble 0 and endpoint CLEAN are what RESIZE the pen
   * field, and the blank does not appear without them. Same setup as
   * `_probe-lane1-blank-tail.mjs`, deliberately, so the two runs are comparable. */
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

  const readAll = async () =>
    page.evaluate(() => {
      const rs = window.__inflateProbe?.revealState?.() ?? null
      const dd = window.__inflateProbe?.drawDiag?.() ?? null
      const all = rs?.ranges ?? []
      const big = all.reduce((a, b) => (b.totalIndices > (a?.totalIndices ?? -1) ? b : a), null)
      return {
        frac: rs?.frac ?? null,
        big,
        render: dd?.render ?? null,
        diag: dd?.diag ?? null,
        field: window.__heroPenField ?? null,
        phase: document.querySelector("[data-hero-phase]")?.getAttribute("data-hero-phase") ?? null,
      }
    })

  const rows = []
  for (let k = 0; k < STEPS; k++) {
    const pct = FROM + ((TO - FROM) * k) / Math.max(1, STEPS - 1)
    await seek(span.at + span.duration * pct)
    const r = await readAll()
    const ink = await inkOf()
    rows.push({ pct: +(pct * 100).toFixed(3), ink, ...r })
    const d = r.diag
    console.log(
      `${String((pct * 100).toFixed(2)).padStart(7)} %  INK ${String(ink).padStart(7)}` +
        `  tris ${String(r.render?.triangles).padStart(8)} calls ${String(r.render?.calls).padStart(3)}` +
        `  range ${String(r.big?.count).padStart(7)}/${String(r.big?.totalIndices).padStart(7)}` +
        `  frac ${String(r.frac?.toFixed(6)).padStart(9)}` +
        `  carve ${String(d?.pen?.carve?.toFixed(3)).padStart(6)} slack ${String(d?.pen?.slack?.toFixed(4)).padStart(8)}` +
        `  tipOn ${String(d?.tip?.on)} d ${String(d?.tip?.d?.toFixed(5)).padStart(8)} back ${String(d?.tip?.back?.toFixed(5)).padStart(9)} taper ${String(d?.tip?.taper?.toFixed(5)).padStart(9)} a2l ${String(d?.tip?.arcToLocal?.toFixed(3)).padStart(8)}` +
        `  brk ${String(d?.brk?.count)}  wDet ${String(d?.worldDet?.toExponential(2))}`,
    )
  }

  /* ---- THE POWER SET OF THE THREE DISCARDS -------------------------------
   * One-at-a-time cannot attribute a defect that fires in two passes on one
   * shared input, which is why the prior sweep exonerated all three. Every
   * subset is driven here.
   *
   * 🔴 RESTATED 2026-08-07 — the sentence that used to end this comment was
   * "at a playhead the sweep above proved blank", and it has been FALSE on
   * every run since the blank tail was closed.
   *
   * `rows.find((r) => r.ink <= 4)` looks for the blank frame. When there is no
   * blank frame the `??` silently hands back the LAST row instead, and the
   * header below then prints `OFAT POWER SET at DRAW 100.00 %` under a claim
   * that the playhead was proved blank. Measured on this probe's own surface
   * (free-stroke · FONT word · wobble 0 · endpoint clean), 90→100 % in 21 steps:
   *
   *     90%:23323  91%:23514  92%:23627  93%:23846  94%:24091  95%:24248
   *     96%:24542  97%:24763  98%:24946  99%:25115  100%:25441     MONOTONE
   *
   * No frame in the sweep is blank; the fallback fires; the power set runs at
   * DRAW 100 % on **25 441 px of ink**. That is not a defect in the fallback —
   * a fallback is the right call — it is that the two branches MEAN OPPOSITE
   * THINGS and printed the same sentence. With the defect present the block
   * measures a blank frame; without it, a full one, and calls both "the
   * playhead the sweep proved blank". A row that reads the same whether or not
   * the thing it is about is happening is the half that cannot fail.
   *
   * So the branch is NAMED, and the arms below are labelled by which one ran.
   * The power set is still worth running at a full frame — that is the
   * REGRESSION reading, and the falsifiability control measured at this pose
   * says the frame is movable, so the arms are not on a dead playhead:
   *     penCarve 0 → 10 285 px moved · ink 0 → 26 372 · squashY 0.72 → 18 788
   *     penTip off → 0 · jointBreak pair → 0
   * ⚠ Which means the `tip OFF` arm below is ALSO not evidence at this pose.
   * Stated, not hidden. */
  const blankRow = rows.find((r) => r.ink <= 4)
  const blank = blankRow ?? rows[rows.length - 1]
  const OFAT_AT = blank.pct / 100
  const POSE_IS_BLANK = !!blankRow
  console.log(
    POSE_IS_BLANK
      ? `\n[pose] the sweep FOUND a blank frame at DRAW ${blank.pct} % (${blank.ink} px) — the arms below run on the defect`
      : `\n[pose] NO BLANK FRAME IN THE SWEEP — ink is monotone ${rows[0].ink} → ${rows[rows.length - 1].ink} across ` +
          `${rows.length} steps. The blank tail is CLOSED on this surface, so the fallback took the LAST row: ` +
          `DRAW ${blank.pct} % at ${blank.ink} px of ink. These arms are a REGRESSION reading on a full frame, ` +
          `NOT a power set on a blank one.`,
  )
  await seek(span.at + span.duration * OFAT_AT)
  const arms = []
  /* 🔴 THE TEARDOWN RESTORES WHAT WAS THERE — fixed 2026-08-07.
   *
   * Four of the arms below used to end `setPenTip("reed")`. `reed` is a NAMED
   * value, not the value that shipped, so every arm after the first tip arm ran
   * one channel off `reed` — which is not OFAT, and nothing said so because the
   * teardown reported nothing either. Read the live value once, put THAT back.
   * The same defect, found by reading rather than by running, is fixed in
   * `_probe-drawin-holes.mjs`, which restored to a named `"quill"`. */
  const TIP_BEFORE = await page.evaluate(() => window.__captureHarness.penTip())
  console.log(`[teardown] the pen tip that shipped on this surface is "${TIP_BEFORE}" — every arm restores to THAT`)
  const restore = async () => {
    const a = await page.evaluate(() => window.__captureHarness.setFlatten(null))
    const b = await page.evaluate((t) => window.__captureHarness.setPenTip(t), TIP_BEFORE)
    if (b !== true) console.log(`   🔴 TEARDOWN REFUSED — setPenTip("${TIP_BEFORE}") returned ${b}; every arm after this one is off-state`)
    return a && b
  }
  /* EVERY ARM READS WHAT ITS DRIVER RETURNED. `setFlatten` and `setPenTip` both
   * refuse bad input; an arm that never reached the render and an arm that
   * reached it and changed nothing print the SAME ink number, and only the
   * boolean separates them (explainer 39 §4 rule 1). `setup` returns the
   * driver's answer — an array when it drives two — and a refusal is loud.
   * `scripts/verify/assert-arm-took.mjs` is the channel that holds this. */
  const run = async (name, setup, teardown) => {
    let took = null
    if (setup) took = await page.evaluate(setup)
    const refused = took === false || (Array.isArray(took) && took.some((t) => t === false))
    if (refused) console.log(`   🔴 ARM  ${name.padEnd(30)} THE DRIVER REFUSED — returned ${JSON.stringify(took)}; this arm set NOTHING and its ink is the shipped state under a different label`)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(450)
    const ink = await inkOf()
    const r = await readAll()
    arms.push({ name, ink, took, refused, poseIsBlank: POSE_IS_BLANK, atPct: blank.pct, render: r.render, diag: r.diag })
    console.log(
      `   ARM  ${name.padEnd(30)} ink ${String(ink).padStart(8)} px   tris ${String(r.render?.triangles).padStart(8)}` +
        `  carve ${String(r.diag?.pen?.carve?.toFixed(2))} tipOn ${String(r.diag?.tip?.on)} brk ${String(r.diag?.brk?.count)}` +
        `  took ${JSON.stringify(took)}`,
    )
    if (teardown) await teardown()
    await page.waitForTimeout(300)
  }
  console.log(
    `\n--- OFAT POWER SET at DRAW ${(OFAT_AT * 100).toFixed(2)} % ` +
      `(${blank.ink} px of ink — ${POSE_IS_BLANK ? "A BLANK FRAME, the defect is present" : "A FULL FRAME, the blank tail is closed on this surface"}) ---`,
  )
  await run("shipped", null, null)
  await run("carve OFF", () => window.__captureHarness.setFlatten({ penCarve: 0 }), restore)
  await run("tip OFF", () => window.__captureHarness.setPenTip("off"), restore)
  await run("break OFF", () => window.__captureHarness.setFlatten({ jointBreak: 0 }), restore)
  await run(
    "carve + break OFF",
    () => window.__captureHarness.setFlatten({ penCarve: 0, jointBreak: 0 }),
    restore,
  )
  await run(
    "tip + break OFF",
    () => [window.__captureHarness.setFlatten({ jointBreak: 0 }), window.__captureHarness.setPenTip("off")],
    restore,
  )
  await run(
    "carve + tip OFF",
    () => [window.__captureHarness.setFlatten({ penCarve: 0 }), window.__captureHarness.setPenTip("off")],
    restore,
  )
  await run(
    "ALL THREE OFF",
    () => [window.__captureHarness.setFlatten({ penCarve: 0, jointBreak: 0 }), window.__captureHarness.setPenTip("off")],
    restore,
  )

  writeFileSync(join(OUT, "blank-tail.json"), JSON.stringify({ span, rows, arms, errors }, null, 2))
  if (errors.length) console.log("\nPAGE ERRORS:\n" + errors.slice(0, 6).join("\n"))
  await context.close()
  await browser.close()
  console.log(`\n${OUT}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
