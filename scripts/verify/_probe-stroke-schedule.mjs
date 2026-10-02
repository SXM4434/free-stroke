// _PROBE-STROKE-SCHEDULE — CAPTURE HALF for `DRAW IN` (order · overlap · align).
//
// ── WHY IT IS A SEPARATE FILE FROM THE GATE ────────────────────────────────
// `docs/README.md`: *"`verify-*` captures frames. `assert-*` and `diff-frames`
// turn them into pass/fail. The split matters: capturing is cheap and
// rerunnable, asserting is where a claim gets settled."* The BYTE-IDENTICAL
// negative control this feature is held to spans two runs of the app — one from
// before the feature existed and one from after — so the capture half has to be
// runnable on its own, twice, against two builds.
//
// ── THE STROKE SET IS FIXED AND INJECTED, NOT DRAWN ────────────────────────
// `__styleHarness.injectStrokes(polys, { msPerPoint, gapMs })` bakes timestamps
// sequentially, so the same call is the same recording every time. A stroke
// drawn with real pointer events carries real wall-clock timestamps, the reveal
// replays those timestamps, and two runs would therefore differ in the one
// channel this probe is measuring. A byte comparison over a hand-drawn mark
// would be a row that can only fail.
//
// ── SIX STROKES, FOUR GROUPS, AND EVERY ORDER SEPARATES THEM ───────────────
//   A1 long horizontal · A2 short vertical crossing it   -> ONE group (fused)
//   B  short tick, far left                              -> one group, SHORTEST
//   C  wide arc, middle                                  -> one group
//   D1/D2 an X, far right                                -> ONE group (fused)
// As-drawn order is A·B·C·D; `byLength` is B·D·A·C-ish; `byPosition` is
// B·A·C·D. So a frame under one order cannot be mistaken for a frame under
// another, which is what makes a sweep of five orders five options rather than
// one option captured five times.
//
// Usage:
//   FS_PORT=3102 node scripts/verify/_probe-stroke-schedule.mjs --label=before
//   FS_PORT=3102 node scripts/verify/_probe-stroke-schedule.mjs --label=after
//   …--arms=schedule   also captures the non-default DRAW IN arms + a film
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { LAB_URL } from "./lib/dev-server.mjs"
import { stageEvidence } from "./lib/evidence-swap.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "run")
const ARMS = arg("arms", "default")
/* STAGED, because this wipe can reach committed evidence. It empties
 * `docs/verification/stroke-schedule/<label>`, and the label is an argument, so the reach is the
 * whole subtree, 18 tracked files.
 * The capture now writes to a sibling `.<name>.staging` and the stored set is
 * replaced only when the run completes, so a run that dies partway leaves every
 * committed frame alone. The same wipe on `hero-windup`, killed 14 s in, deleted
 * all 102 of its tracked files. lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", "stroke-schedule", LABEL)
const EV = stageEvidence(FINAL)
const OUT = EV.dir
// >= 1440 x 1440, the standing capture rule.
const VIEW = { width: 1600, height: 1600 }

/** The playheads every arm is sampled at. 0 and 1 are the pinned ends. */
export const PLAYHEADS = [0, 0.12, 0.28, 0.44, 0.6, 0.76, 0.9, 1]

/**
 * Free Stroke's four render paths, plus the ported Desk Doodles engine.
 *
 * ⚠ `inflate-implicit` IS A SEPARATE ARM AND IT IS NOT A DUPLICATE. Measured
 * here first-hand on this fixture: `DEFAULT_INFLATE_PARAMS.fusion` is `"auto"`,
 * and auto *"sweeps the loft where the loft is provably valid"* — so plain
 * Inflate on `/` builds LOFTS, one mesh per stroke, with **no `revealKeys` at
 * all** (`__inflateProbe.revealState().frac === null`, `__heroPenTip === null`)
 * and reveals by REBUILD. The fused marching-cubes surface — the one the whole
 * `setDrawRange`-prefix insight and the pen tip's fragment test live on — is
 * only reached by asking for it. A sweep that captured only the `auto` arm
 * would have called four paths five and never touched the interesting one.
 */
export const ENGINES = [
  { key: "rod", mode: "rod", family: "free-stroke" },
  { key: "extrude", mode: "extrude", family: "free-stroke" },
  { key: "solid", mode: "solid", family: "free-stroke" },
  { key: "inflate", mode: "inflate", family: "free-stroke" },
  { key: "inflate-implicit", mode: "inflate", family: "free-stroke", inflate: { fusion: "implicit" } },
  { key: "dd-inflate", mode: "inflate", family: "desk-doodles" },
]

export function fixture() {
  const A1 = []
  for (let i = 0; i <= 60; i++) A1.push({ x: 120 + (i / 60) * 540, y: 200 })
  const A2 = []
  for (let i = 0; i <= 8; i++) A2.push({ x: 390, y: 170 + (i / 8) * 60 })
  const B = []
  for (let i = 0; i <= 8; i++) B.push({ x: 140 + (i / 8) * 60, y: 330 })
  const C = []
  for (let i = 0; i <= 40; i++) {
    const th = Math.PI - (i / 40) * Math.PI
    C.push({ x: 400 + Math.cos(th) * 110, y: 430 - Math.sin(th) * 70 })
  }
  const D1 = []
  const D2 = []
  for (let i = 0; i <= 14; i++) {
    const t = i / 14
    D1.push({ x: 560 + t * 110, y: 330 + t * 120 })
    D2.push({ x: 670 - t * 110, y: 330 + t * 120 })
  }
  return [A1, A2, B, C, D1, D2]
}

const sha = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 16)

async function settle(page, ms = 260) {
  await page.waitForTimeout(ms)
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  )
}

/* ---- 🔴 WHAT EVERY GRAB IN THIS RUN WAS ACTUALLY OF ---------------------
 *
 * On 2026-08-07 the THIRD film take of this probe wrote **f113–f119 at
 * 1584×1468 instead of 799×1468** — the last seven frames of the last take.
 * Nothing failed: no page error, no GL warning, no exception. The loop asked
 * for a frame, got a frame, and wrote it under the filename it had planned.
 * It was found by listing a directory.
 *
 * A capture cannot check its own subject from the PNG it just wrote, so it has
 * to ask. `__captureHarness.grabInfo()` reports the element's backing-buffer
 * size and whether the OLD position-based resolution (`querySelector("canvas")`
 * — the first canvas in document order) still agrees with the ref that now
 * names the canvas by identity. This census is written into the manifest so a
 * repeat says so in the evidence rather than in a directory listing.
 *
 * ⚠ IT IS A CENSUS, NOT A GATE. It records; `assert-stroke-schedule.mjs` §15 is
 * the row that can come back red. A probe that fails is a probe people stop
 * running.
 */
const grabCensus = { n: 0, sizes: {}, wrongSubject: 0, multiCanvas: 0, info: null }

async function grab(page) {
  const [url, info] = await page.evaluate(() => [
    window.__captureHarness.grab(),
    window.__captureHarness.grabInfo ? window.__captureHarness.grabInfo() : null,
  ])
  const buf = Buffer.from(String(url).split(",")[1], "base64")
  /* Straight out of the PNG IHDR — no decode, so this costs nothing per frame. */
  const key = `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`
  grabCensus.n++
  grabCensus.sizes[key] = (grabCensus.sizes[key] ?? 0) + 1
  if (info) {
    grabCensus.info = info
    if (info.firstUnderContainer === false) grabCensus.wrongSubject++
    if (info.canvasesUnderContainer > 1) grabCensus.multiCanvas++
  }
  return buf
}

async function main() {
  EV.open()

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
    ...(ARMS === "schedule" ? { recordVideo: { dir: OUT, size: VIEW } } : {}),
  })
  const page = await context.newPage()
  const pageErrors = []
  const consoleAll = []
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 300)))
  // EVERY LEVEL. The message that named explainer 24's defect was a WARNING and
  // every probe here filtered on `error`.
  page.on("console", (m) => consoleAll.push(`${m.type()}: ${m.text().slice(0, 240)}`))

  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(
    () => window.__styleHarness && window.__revealHarness && window.__captureHarness,
    null,
    { timeout: 120000 },
  )
  await page.evaluate(
    (poly) => window.__styleHarness.injectStrokes(poly, { msPerPoint: 12, gapMs: 60 }),
    fixture(),
  )
  await page.waitForTimeout(1600)

  const hasDrawIn = await page.evaluate(() => typeof window.__revealHarness?.setDrawIn === "function")
  console.log(`__revealHarness.setDrawIn present: ${hasDrawIn}`)

  const rows = []
  const captureArm = async (armKey, eng) => {
    await page.evaluate(
      ([mode, family, inflate]) => {
        window.__styleHarness.setEngine(family)
        window.__styleHarness.setMode(mode)
        // `auto` is restored explicitly on every arm that does not ask for a
        // fusion, so an arm cannot inherit the previous one's surface.
        window.__styleHarness.setInflate(inflate ?? { fusion: "auto" })
      },
      [eng.mode, eng.family, eng.inflate ?? null],
    )
    await page.waitForTimeout(1800)
    // A DETERMINISTIC CAMERA. `frontView` fits the bounds and aims at the mark's
    // own centre, so two runs frame the same pixels — an orbit left wherever the
    // last arm put it would make every byte comparison meaningless.
    await page.evaluate(() => window.__captureHarness.frontView(0.8))
    await settle(page, 500)
    for (const p of PLAYHEADS) {
      await page.evaluate((v) => window.__revealHarness.setProgress(v), p)
      await settle(page)
      const png = await grab(page)
      const name = `${armKey}__${eng.key}__p${String(Math.round(p * 100)).padStart(3, "0")}.png`
      writeFileSync(join(OUT, name), png)
      rows.push({ arm: armKey, engine: eng.key, playhead: p, file: name, sha: sha(png), bytes: png.length })
    }
  }

  const setDrawIn = async (patch) => {
    const ok = await page.evaluate(
      (pp) => (window.__revealHarness?.setDrawIn ? window.__revealHarness.setDrawIn(pp) : false),
      patch,
    )
    if (!ok) throw new Error(`setDrawIn refused: ${JSON.stringify(patch)}`)
    await page.waitForTimeout(700)
  }
  /* THE WINDOW — step 3. Refuses on an unknown mode for the same reason
   * `setDrawIn` refuses an unknown order: a sweep that silently accepted one
   * would capture `grow` four times and report it as four options. */
  const setWindow = async (patch) => {
    const ok = await page.evaluate(
      (pp) => (window.__revealHarness?.setWindow ? window.__revealHarness.setWindow(pp) : false),
      patch,
    )
    if (!ok) throw new Error(`setWindow refused: ${JSON.stringify(patch)}`)
    await page.waitForTimeout(700)
  }
  const WINDOW_OFF = { mode: "grow", length: 0.25 }

  // ---- arm 1 · THE DEFAULT. This is the negative control's whole subject. ----
  if (ARMS !== "film") for (const eng of ENGINES) await captureArm("default", eng)

  // ---- arm 2..n · the DRAW IN dials, only where the build carries them ------
  if (ARMS === "schedule") {
    if (!hasDrawIn) throw new Error("--arms=schedule needs __revealHarness.setDrawIn; this build has none")
    const SWEEP = [
      { key: "reversed", patch: { order: "reversed" } },
      { key: "byLength", patch: { order: "byLength" } },
      { key: "byPosition", patch: { order: "byPosition" } },
      { key: "random", patch: { order: "random", seed: 7 } },
      { key: "overlap50", patch: { order: "asDrawn", overlap: 0.5, align: "start" } },
      { key: "overlap100-start", patch: { order: "asDrawn", overlap: 1, align: "start" } },
      { key: "overlap100-end", patch: { order: "asDrawn", overlap: 1, align: "end" } },
      { key: "unit-stroke-rev", patch: { order: "reversed", unit: "stroke" } },
    ]
    for (const s of SWEEP) {
      await setDrawIn({ order: "asDrawn", overlap: 0, align: "start", unit: "group", seed: 1, reverse: "off", ...s.patch })
      for (const eng of ENGINES) await captureArm(s.key, eng)
    }
    // Back to the default so the film below starts from a known state.
    await setDrawIn({ order: "asDrawn", overlap: 0, align: "start", unit: "group", seed: 1, reverse: "off" })
  }

  /* ---- STEP 3 · THE WINDOW AND THE REVERSE -------------------------------
   *
   * A separate arm set from `--arms=schedule` for the reason `inflate-implicit`
   * is a separate ENGINE arm: they answer different questions and folding them
   * would make a sweep of one look like a sweep of both. The window arms move
   * only the window; the reverse arms move only the direction; the compound arm
   * exists because the two are meant to compose and a claim that they do is
   * worth a frame rather than a sentence. */
  if (ARMS === "window") {
    if (!(await page.evaluate(() => typeof window.__revealHarness?.setWindow === "function")))
      throw new Error("--arms=window needs __revealHarness.setWindow; this build has none")
    const WIN_SWEEP = [
      { key: "win-travel25", win: { mode: "travel", length: 0.25 }, draw: {} },
      { key: "win-travel60", win: { mode: "travel", length: 0.6 }, draw: {} },
      { key: "win-vanish", win: { mode: "vanish" }, draw: {} },
      { key: "win-shrink", win: { mode: "shrink" }, draw: {} },
      { key: "rev-all", win: WINDOW_OFF, draw: { reverse: "all" } },
      { key: "rev-alternate", win: WINDOW_OFF, draw: { reverse: "alternate" } },
      // The compound: a travelling window over a snaking schedule over a
      // reordered word. If any pair of the three does not compose, this is the
      // arm it shows up in.
      {
        key: "compound",
        win: { mode: "travel", length: 0.3 },
        draw: { order: "reversed", reverse: "alternate", overlap: 0.5 },
      },
    ]
    for (const s of WIN_SWEEP) {
      await setDrawIn({ order: "asDrawn", overlap: 0, align: "start", unit: "group", seed: 1, reverse: "off", ...s.draw })
      await setWindow({ mode: "grow", length: 0.25, ...s.win })
      for (const eng of ENGINES) await captureArm(s.key, eng)
    }
    await setDrawIn({ order: "asDrawn", overlap: 0, align: "start", unit: "group", seed: 1, reverse: "off" })
    await setWindow(WINDOW_OFF)
  }

  /* ---- THE FILM ----------------------------------------------------------
   * `docs/DISPATCH.md` §3: *"Save video as well as frames, and watch it back.
   * Motion defects — crawl, strobing, judder — do not exist in a still."* And
   * the map §8 makes it the acceptance for this feature specifically: the
   * `overlap > 0` claim is about ONE INSTANT having two pen tips in it, which
   * is a thing only a sequence can show. Dense sheets, so the whole arc is
   * readable rather than three sampled frames. */
  if (ARMS === "film" || ARMS === "film-window") {
    const FR = 120
    const FUSED = ENGINES.find((e) => e.key === "inflate-implicit")
    const D = { order: "asDrawn", overlap: 0, align: "start", unit: "group", seed: 1, reverse: "off" }
    /* THE STEP-2 FILMS ARE UNTOUCHED AND STILL SHOT (§7 of the map: nothing is
     * deleted or replaced). `--arms=film-window` shoots step 3's beside them
     * rather than instead of them, because the claim step 3 has to film is a
     * DIFFERENT one: not "two pens on the page at once" but "ink is being taken
     * OFF the page while other ink goes on", which is the thing a prefix is
     * structurally unable to do and which no still can show. */
    const TAKES =
      ARMS === "film"
        ? [
            ["seq", D, {}, FUSED],
            ["overlap100", { ...D, overlap: 1 }, {}, FUSED],
            ["reversed", { ...D, order: "reversed" }, {}, FUSED],
          ]
        : [
            ["win-travel", D, { mode: "travel", length: 0.25 }, FUSED],
            ["win-vanish", D, { mode: "vanish", length: 0.25 }, FUSED],
            ["rev-all", { ...D, reverse: "all" }, { mode: "grow", length: 0.25 }, FUSED],
          ]
    for (const [key, patch, winPatch, eng] of TAKES) {
      await page.evaluate(
        ([mode, family, inflate]) => {
          window.__styleHarness.setEngine(family)
          window.__styleHarness.setMode(mode)
          window.__styleHarness.setInflate(inflate ?? { fusion: "auto" })
        },
        [eng.mode, eng.family, eng.inflate ?? null],
      )
      await page.waitForTimeout(1800)
      await page.evaluate(() => window.__captureHarness.frontView(0.8))
      await settle(page, 500)
      await setDrawIn(patch)
      if (winPatch && Object.keys(winPatch).length > 0)
        await setWindow({ mode: "grow", length: 0.25, ...winPatch })
      const dir = join(OUT, `film-${key}`)
      mkdirSync(dir, { recursive: true })
      for (let i = 0; i < FR; i++) {
        await page.evaluate((v) => window.__revealHarness.setProgress(v), i / (FR - 1))
        await settle(page, 70)
        writeFileSync(join(dir, `f${String(i).padStart(3, "0")}.png`), await grab(page))
      }
      const { execFileSync } = await import("node:child_process")
      const { createRequire } = await import("node:module")
      const req = createRequire(import.meta.url)
      let FFMPEG = "ffmpeg"
      try {
        FFMPEG = req("ffmpeg-static") || "ffmpeg"
      } catch {}
      try {
        execFileSync(FFMPEG, ["-y", "-framerate", "24", "-i", join(dir, "f%03d.png"), "-pix_fmt", "yuv420p", "-vf", "scale=800:-2", join(OUT, `film-${key}.mp4`)], { stdio: "ignore" })
        execFileSync(FFMPEG, ["-y", "-i", join(dir, "f%03d.png"), "-vf", "scale=260:-1,tile=10x12", join(OUT, `contact-${key}.png`)], { stdio: "ignore" })
        console.log(`[schedule] film + contact sheet: ${key}`)
      } catch (e) {
        console.log(`[schedule] ffmpeg failed for ${key}: ${String(e).slice(0, 160)}`)
      }
    }
  }

  writeFileSync(
    join(OUT, "manifest.json"),
    JSON.stringify(
      {
        label: LABEL,
        arms: ARMS,
        url: LAB_URL,
        view: VIEW,
        playheads: PLAYHEADS,
        engines: ENGINES.map((e) => e.key),
        hasDrawIn,
        rows,
        grabCensus,
        pageErrors,
        glWarnings: consoleAll.filter((c) => /not big enough|INVALID_OPERATION/i.test(c)),
      },
      null,
      2,
    ),
  )
  /* THE SWAP, on completion and not on the pass flag. lib/evidence-swap.mjs */
  EV.commit()
  console.log(`[schedule] ${rows.length} frames -> ${FINAL}`)
  /* PRINT IT, ALWAYS. An admission nothing parses is not an admission — the
   * 1584px frames were on disk for hours with nothing saying so. */
  const sizeKeys = Object.keys(grabCensus.sizes)
  console.log(
    `[schedule] grabs: ${grabCensus.n} · sizes ${JSON.stringify(grabCensus.sizes)}` +
      (sizeKeys.length > 1 ? "  <<< MORE THAN ONE SIZE — the capture changed subject" : "") +
      ` · wrong-subject grabs ${grabCensus.wrongSubject}`,
  )
  console.log(`[schedule] page errors: ${pageErrors.length}`)
  if (pageErrors.length) console.log(pageErrors.slice(0, 5).join("\n"))

  await context.close()
  await browser.close()
}

/* RUN ONLY WHEN RUN. `assert-stroke-schedule.mjs` imports `fixture()` and
 * `ENGINES` from this file rather than restating them — the fixture IS the
 * subject, and two copies of it would let the gate and the evidence drift onto
 * two different drawings. Without this guard that import would fire a 40-frame
 * capture as a side effect. */
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (invokedDirectly) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
