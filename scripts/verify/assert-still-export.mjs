// THE FIRST FRAME, AND THE PICTURE YOU LEAVE WITH.
//
// Two product surfaces that had nothing behind them, asserted through the REAL
// entry path — the buttons a user presses, not a dev harness:
//
//   * the empty state. `components/viewport-3d.tsx` rendered a grey
//     `boxGeometry` unconditionally while no stroke existed, so the first thing
//     a stranger saw was a default cube in a default material.
//   * the still export. The only download was a GLB, and every style layer is a
//     shader, so a mark styled with ASCII + dither could not be taken anywhere.
//
// ── EVERY ROW HAS AN ARM IT MUST GO RED ON, AND BOTH RUN BARE (2026-08-07) ──
//   cube            puts the placeholder cube back. Row 3 MUST fail.
//   nocompensate    grabs at 2x WITHOUT scaling the screen-locked ASCII /
//                   dither / texture frequencies with the buffer, i.e. the naive
//                   `toDataURL` at a bigger size. Row 7 — "the export is the
//                   picture you were looking at" — MUST fail, because the glyph
//                   grid comes out twice as fine.
//
//   They were `--law=` and no sweep passed either, so the two rows this file
//   exists for had never been shown able to go red in a sweep. See `runArm`.
//
// Usage: node scripts/verify/assert-still-export.mjs
import { chromium } from "./lib/browser.mjs"
import { createRequire } from "node:module"
import { mkdirSync, writeFileSync, readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { LAB_URL } from "./lib/dev-server.mjs"

const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const OUT = join(ROOT, "docs", "verification", "still-export")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const URL_ = LAB_URL

const WORD = [
  [
    { x: 200, y: 320 }, { x: 260, y: 200 }, { x: 330, y: 320 },
    { x: 400, y: 200 }, { x: 470, y: 320 },
  ],
  [
    { x: 220, y: 400 }, { x: 320, y: 370 }, { x: 420, y: 400 }, { x: 500, y: 360 },
  ],
]

let failures = 0
const record = (name, pass, detail) => {
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}`)
  console.log(`      ${detail}`)
  if (!pass) failures++
}
const control = (pass, name, detail) => {
  console.log(`${pass ? "PASS" : "FAIL"}  CONTROL · ${name}`)
  console.log(`      ${detail}`)
  if (!pass) failures++
}

const settle = (page, ms) => page.evaluate((m) => new Promise((r) => setTimeout(r, m)), ms)

/** Pixel stats of a PNG buffer, through a real decoder. */
async function decode(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  const ctx = c.getContext("2d")
  ctx.drawImage(img, 0, 0)
  const d = ctx.getImageData(0, 0, img.width, img.height).data
  let opaque = 0
  let ink = 0
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 200) opaque++
    // "Ink" = anything appreciably darker than the studio paper (#fafafa).
    if (d[i + 3] > 200 && 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2] < 200) ink++
  }
  const corner = [d[0], d[1], d[2], d[3]]
  return { width: img.width, height: img.height, opaque, ink, corner, canvas: c }
}

/** Mean absolute luma difference of `big` downsampled to `small`'s size. */
async function downsampleDelta(bigBuf, smallBuf) {
  const big = await loadImage(bigBuf)
  const small = await loadImage(smallBuf)
  const c = createCanvas(small.width, small.height)
  const ctx = c.getContext("2d")
  ctx.drawImage(big, 0, 0, small.width, small.height)
  const a = ctx.getImageData(0, 0, small.width, small.height).data
  const c2 = createCanvas(small.width, small.height)
  const ctx2 = c2.getContext("2d")
  ctx2.drawImage(small, 0, 0)
  const b = ctx2.getImageData(0, 0, small.width, small.height).data
  /* ⚠ WHOLE-FRAME, AND THE OBVIOUS "IMPROVEMENT" IS WRONG. Restricting this to
   * ink pixels was tried and had to be reverted: it measured 38.3 on the
   * SHIPPED arm and 123.2 on the parked one, i.e. it went red on both. The
   * reason is that it conflates two different things — the glyph GRID PERIOD
   * changing (the defect) with the glyph STROKES being finer at 2x and softer
   * once averaged down (correct behaviour, and unavoidable). Ink pixels are
   * exactly where the second effect lives, so restricting to them amplifies the
   * confound instead of the signal. Whole-frame keeps the ratio honest:
   * measured 1.51 shipped vs 5.56 parked, and the threshold of 2 sits between
   * them with 1.3x headroom on one side and 2.8x on the other. Row 9 asserts the
   * mechanism itself as a number, which is the row that cannot be argued with. */
  let sum = 0
  let n = 0
  for (let i = 0; i < a.length; i += 4) {
    const la = 0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2]
    const lb = 0.2126 * b[i] + 0.7152 * b[i + 1] + 0.0722 * b[i + 2]
    sum += Math.abs(la - lb)
    n++
  }
  return n > 0 ? sum / n : 0
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  /**
   * ONE ARM. `shipped` is the subject; `cube` and `nocompensate` are the two
   * known-bads the header names, and they run on EVERY invocation now.
   *
   * ⚠ THEY WERE `--law=cube|nocompensate` AND NO SWEEP PASSED EITHER, so rows 3
   * and 7 — the two this file exists for — had never been shown able to go red
   * in any sweep (`docs/explainers/21-losing-your-work.md` §7; explainer 31
   * counted nineteen gates like this and named this one). The flag is DELETED
   * per explainer 29 §5.
   *
   * ⚠ EACH ARM GETS ITS OWN **CONTEXT**, NOT JUST ITS OWN PAGE, AND THAT COST
   * ONE MEASUREMENT TO FIND. Both laws are read by `addInitScript` before the
   * first frame, so an arm needs a fresh navigation — but a second PAGE in the
   * same context inherits the first arm's localStorage, and this app restores a
   * drawing from it by design (explainer 21). Measured 2026-08-07: with a shared
   * context, row 1 ("the empty state speaks") came back RED in BOTH control arms
   * — not because either law touches the affordance, but because the strokes the
   * SHIPPED arm injected were still there, so the stage was never empty. The
   * control's verdict was still correct (it names the row it must break), but a
   * control arm carrying two reds it did not cause is one bad refactor away from
   * "something went red, therefore the control bit". A fresh context per arm.
   *
   * COST, MEASURED: 7.6 s per arm, ~21 s for all three. Nothing to schedule.
   *
   * A control arm's rows are RETURNED, NEVER PRINTED — they are red on purpose,
   * and both battery runners count an indented `FAIL`, so echoing them would
   * post this gate's evidence as its failures (Lane I, `assert-hero-transition`).
   */
  async function runArm(LAW, quiet) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1440 },
    acceptDownloads: true,
  })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text())
  })
  const verdicts = []
  const say = (key, name, pass, detail) => {
    verdicts.push({ key, name, pass, detail })
    if (!quiet) record(name, pass, detail)
  }

  await page.addInitScript((law) => {
    if (law === "cube") window.__fsEmptyState = "prior"
    if (law === "nocompensate") window.__fsStillCompensate = "off"
  }, LAW)

  await page.goto(URL_, { waitUntil: "networkidle" })
  await page.waitForFunction(
    () => !!window.__styleHarness && !!window.__geomDebug && !!window.__captureHarness,
    { timeout: 30000 },
  )
  await settle(page, 800)

  /* ---- THE EMPTY STATE, before a single stroke ---- */
  const affordance = page.getByText("Your form lands here")
  const emptyVisible = await affordance.count()
  const emptyOpacity = emptyVisible
    ? await affordance.evaluate((el) => getComputedStyle(el.parentElement).opacity)
    : "0"

  /* The GL buffer itself. The rig is transparent behind the mark (alpha:true,
   * Environment background:false), so anything OPAQUE in the middle of an empty
   * stage is geometry that should not be there — the grid is thin lines and a
   * cube is a filled block, which is what makes this separable. */
  const centreOpaque = () =>
    page.evaluate(() => {
      const all = [...document.querySelectorAll("canvas")]
      const c = all[all.length - 1]
      const g = document.createElement("canvas")
      g.width = c.width
      g.height = c.height
      const ctx = g.getContext("2d")
      ctx.drawImage(c, 0, 0)
      const half = 160
      const x0 = Math.max(0, ((c.width / 2) | 0) - half)
      const y0 = Math.max(0, ((c.height / 2) | 0) - half)
      const w = Math.min(half * 2, c.width - x0)
      const h = Math.min(half * 2, c.height - y0)
      const d = ctx.getImageData(x0, y0, w, h).data
      let n = 0
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) n++
      return { opaque: n, of: w * h }
    })
  /* ── FRAME THE EMPTY STAGE BEFORE READING IT ────────────────────────────
   *
   * 🔴 ROW 3's KNOWN-BAD WENT BLIND, AND THE FRAMING IS WHY. The viewport
   * mounts an ORTHOGRAPHIC camera whenever the host passes `flatten`
   * (`components/viewport-3d.tsx`, `projection` falls back to "affine"), and
   * R3F builds an ortho camera in PIXEL units — `top = height / 2` at zoom 1.
   * Every framing helper needs bounds, an empty stage has none, so nothing
   * calls `applyFraming` and the zoom stays 1: ONE WORLD UNIT IS ONE PIXEL.
   * Measured 2026-09-04 on :3122 — the 6-unit `gridHelper` renders as a 7x6 px
   * speck at dead centre, the 0.6-unit placeholder cube is SUB-PIXEL, and the
   * `cube` arm differed from the shipped arm by 2 pixels of 969 212. Both arms
   * read `42 of 102400 (0.04 %)`, so this row could no longer tell the defect
   * from the fix. Filed as a rendering finding in its own right.
   *
   * `focusView(origin, 5)` is not a framing invented here. It is byte-for-byte
   * the app's own "Reset camera" on an empty stage — `handleResetCamera`'s
   * no-bounds branch puts the camera at `INITIAL_CAMERA_POSITION` (0, 0, 5),
   * targets the origin and calls `applyFraming(camera, 5)` — and `applyFraming`
   * is the one place the two projections are reconciled, so this reads the same
   * picture the perspective build read implicitly when this row was written.
   *
   * ⚠ THE BAR IS UNCHANGED AT 2 %. Framed, shipped reads 0.94 % and the
   * known-bad reads 29.83 %; the bar sits between them with a factor of 2
   * below and 15 above.
   *
   * Its RETURN VALUE is checked and row 3 fails on a refusal. A framing helper
   * that quietly returned false would leave this row measuring the pixel-unit
   * stage and reporting green about it, which is the defect this note is about.
   */
  const framed = await page.evaluate(
    () => window.__captureHarness?.focusView?.({ x: 0, y: 0, z: 0 }, 5, 0, 0) === true,
  )
  await settle(page, 400)

  const empty = await centreOpaque()
  writeFileSync(
    join(OUT, `empty-${LAW}.png`),
    await page.screenshot({ clip: { x: 720, y: 100, width: 720, height: 900 } }),
  )

  say("1",
    "1 · the empty state speaks — the viewport says what will land there",
    emptyVisible > 0 && Number(emptyOpacity) > 0.9,
    `affordance found: ${emptyVisible} · opacity ${emptyOpacity}`,
  )

  say("3",
    "3 · no placeholder solid on the empty stage",
    framed && empty.opaque / empty.of < 0.02,
    `${empty.opaque} of ${empty.of} centre px are opaque (${((100 * empty.opaque) / empty.of).toFixed(2)} %) at the stage's own reset framing${framed ? "" : " — 🔴 THE FRAMING WAS REFUSED, so this number is the pixel-unit stage and means nothing"} — a 0.6-unit cube fills far more`,
  )

  /* ---- and it gets out of the way ---- */
  await page.evaluate((w) => window.__styleHarness.injectStrokes(w), WORD)
  await settle(page, 1600)
  const goneOpacity = emptyVisible
    ? await affordance.evaluate((el) => getComputedStyle(el.parentElement).opacity)
    : "1"
  say("2",
    "2 · …and gets out of the way on the first stroke",
    Number(goneOpacity) < 0.05,
    `opacity ${goneOpacity} after a stroke lands`,
  )

  /* ---- THE STILL EXPORT, through the buttons ---- */
  /* ASCII on through the REAL preset path, so row 7 has something screen-locked
   * to be wrong about — and on a BRIGHT material, because a glyph ramp over a
   * near-black subject is the documented way to make ASCII invisible
   * (explainer 03) and an invisible layer would make row 7 a green row that
   * cannot fail. Dither on top for a second screen-locked frequency. Motion off
   * so the two grabs are the same picture rather than two moments. */
  /* ⚠ TWO PRESET CLICKS DO NOT STACK, and the first version of this file got
   * that wrong. `applyPresetToStyleState` spreads `railDefaults(
   * COMPOSITION_RAIL_KEYS)` for every NON-material preset — a preset fully
   * determines the composition by design — so selecting a dither preset after
   * an ASCII one wipes the ASCII. The symptom here was row 9 reading an ASCII
   * cell of 13 (the default) when Terminal Shade sets 18, and it would have
   * quietly made row 7 a dither-only test. The second layer therefore goes on
   * through `setStyle`, which is the layer-stack path and does not reset. */
  await page.evaluate(() => {
    window.__styleHarness.selectPreset("material", "ceramic")
    window.__styleHarness.selectPreset("ascii", "terminalShade")
    window.__styleHarness.setStyle({
      ditherEnabled: true,
      ditherType: "bayer8",
      ditherIntensity: 0.6,
      ditherLockMode: "screen",
      asciiAnimated: false,
      ditherAnimated: false,
      motionMode: "off",
    })
  })
  await settle(page, 1200)

  const openPanel = async () => {
    const expanded = await page
      .getByRole("button", { name: "PNG export settings" })
      .getAttribute("aria-expanded")
    if (expanded !== "true") {
      await page.getByRole("button", { name: "PNG export settings" }).click()
      await settle(page, 200)
    }
  }
  const setScale = async (label) => {
    await openPanel()
    await page.getByRole("button", { name: label, exact: true }).click()
    await settle(page, 150)
  }
  const setBackground = async (label) => {
    await openPanel()
    await page.getByRole("button", { name: label, exact: true }).click()
    await settle(page, 150)
  }
  const savePng = async (tag) => {
    const [dl] = await Promise.all([
      page.waitForEvent("download", { timeout: 60000 }),
      page.getByRole("button", { name: "PNG", exact: true }).click(),
    ])
    const file = join(OUT, `${tag}-${LAW}.png`)
    await dl.saveAs(file)
    return { file, name: dl.suggestedFilename(), buf: readFileSync(file) }
  }

  const panelSize = await page.evaluate(() => {
    const el = document.querySelectorAll("canvas")
    const c = el[el.length - 1]
    return { w: c.clientWidth, h: c.clientHeight }
  })

  await setScale("2×")
  await setBackground("Paper")
  const paper2x = await savePng("paper-2x")
  const p2 = await decode(paper2x.buf)

  say("4",
    "4 · the PNG button saves a real file at the resolution the panel promises",
    Math.abs(p2.width - panelSize.w * 2) <= 2 &&
      Math.abs(p2.height - panelSize.h * 2) <= 2 &&
      p2.ink > 500,
    `${paper2x.name} — ${p2.width}x${p2.height} px (panel ${panelSize.w}x${panelSize.h} at 2x) · ${p2.ink} ink px · ${(paper2x.buf.length / 1024).toFixed(0)} KB`,
  )

  say("5",
    "5 · a real filename, not a harness dump",
    /^[a-zA-Z0-9_-]+_(rod|extrude|solid|inflate)_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/.test(
      paper2x.name,
    ),
    paper2x.name,
  )

  await setBackground("Transparent")
  const clear2x = await savePng("transparent-2x")
  const c2 = await decode(clear2x.buf)
  say("6",
    "6 · Transparent really is transparent, and Paper really is opaque",
    c2.corner[3] === 0 && p2.corner[3] === 255 && c2.ink > 500,
    `transparent corner alpha ${c2.corner[3]} · paper corner alpha ${p2.corner[3]} · transparent ink ${c2.ink} px`,
  )

  /* ---- THE ROW THE WHOLE DESIGN IS FOR ---- */
  await setBackground("Paper")
  await setScale("1×")
  const paper1x = await savePng("paper-1x")
  const delta = await downsampleDelta(paper2x.buf, paper1x.buf)
  say("7",
    "7 · the export is the picture you were looking at, at every scale",
    delta < 2,
    `2× downsampled to 1× differs by ${delta.toFixed(2)} mean luma (parked arm measures 5.56) — the ASCII cell and the dither/texture frequency travel with the buffer`,
  )

  /* THE MECHANISM, AS A NUMBER. Row 7 shows the pictures agree; this shows WHY,
   * and it is the row that cannot be argued with — a screen-locked cell is in
   * DEVICE pixels, so at 2x it must come out at exactly twice its viewport
   * value or the glyph grid is a different grid. */
  await setScale("2×")
  await savePng("mech-2x")
  const mech = await page.evaluate(() => window.__geomDebug.lastStill())
  say("9",
    "9 · the screen-locked layers travel with the buffer — the mechanism, measured",
    mech.scale === 2 &&
      mech.asciiScreenLocked &&
      Math.abs(mech.asciiCellAfter - mech.asciiCellBefore * 2) < 1e-6 &&
      Math.abs(mech.ditherScaleAfter - mech.ditherScaleBefore * 2) < 1e-6 &&
      mech.chromeHidden >= 1,
    `scale ${mech.scale} · ascii cell ${mech.asciiCellBefore} → ${mech.asciiCellAfter} (screen-locked ${mech.asciiScreenLocked}) · dither scale ${mech.ditherScaleBefore.toFixed(3)} → ${mech.ditherScaleAfter.toFixed(3)} · ${mech.chromeHidden} chrome object(s) hidden · ${mech.width}×${mech.height}`,
  )

  say("8",
    "8 · console clean",
    errors.length === 0,
    `${errors.length} errors${errors.length ? ": " + errors[0] : ""}`,
  )

  await page.close()
  await context.close()
  return verdicts
  }

  /* ---- THE SHIPPED ARM ---- */
  const real = await runArm("shipped", false)

  /* ---- THE TWO PARKED LAWS, each required to break the row it is aimed at ----
   *
   * Naming the TARGET row rather than accepting "something went red" is
   * load-bearing: `nocompensate` also reddens row 9, so a control that only
   * asked whether the run failed would still pass a build in which row 7 — the
   * row the whole design is for — had been made unfalsifiable. */
  const at = (rows, k) => rows.find((v) => v.key === k)
  const reds = (rows) => rows.filter((v) => !v.pass).map((v) => v.key)

  const cube = await runArm("cube", true)
  control(
    !at(cube, "3").pass,
    "KNOWN-BAD `cube` — the placeholder solid put back on the empty stage — is REJECTED by row 3",
    `red: [${reds(cube).join(" ") || "NONE — THIS GATE IS BLIND"}] (want 3). row 3 read: ${at(cube, "3").detail}` +
      `\n      against the shipped arm's ${at(real, "3").detail}`,
  )

  const nocomp = await runArm("nocompensate", true)
  control(
    !at(nocomp, "7").pass,
    "KNOWN-BAD `nocompensate` — a 2× grab WITHOUT scaling the screen-locked frequencies — is REJECTED by row 7",
    `red: [${reds(nocomp).join(" ") || "NONE — THIS GATE IS BLIND"}] (want 7; row 9 goes with it, which is the mechanism saying the same thing).` +
      `\n      row 7 read: ${at(nocomp, "7").detail}` +
      `\n      against the shipped arm's ${at(real, "7").detail}`,
  )

  await browser.close()
  console.log(`\nframes: ${OUT}`)
  console.log(failures === 0 ? "all rows passed" : `${failures} row(s) failed`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
