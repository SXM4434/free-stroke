// EVERY COMBINATION CELL, MEASURED ON PIXELS, WITH ITS OWN UNLINKED CONTROL.
//
// `assert-fusion-combos.mjs` grades the MODEL: it asks `evaluateFusion` whether
// the frame it returns travels. That is a real check and it is not enough — it
// is the model's opinion of itself, and this repo's whole recurring defect is an
// instrument that agrees with the code it is measuring. So this drives the real
// page on the real GPU, presses the real control, and reads PIXELS.
//
// ── THE CONTROL, WHICH IS THE WHOLE POINT ──────────────────────────────────
// The naive measure — "does the picture change over this window" — CANNOT WORK
// here, and both ways it fails were measured on this probe's own first two runs:
//
//   · a CAMERA-driven cell is filmed while the turntable turns, so consecutive
//     frames differ enormously whether or not anything is coupled. Read
//     linked 350.8 against unlinked 349.5. It was measuring three.js's specular
//     response.
//   · a cell with an ANIMATED LAYER has a crawling screen underneath it, so the
//     unlinked arm travels just as far. Read `animation+texture+ascii` at
//     linked 160.8 against unlinked 186.6 — the CONTROL LOUDER THAN THE SIGNAL.
//
// So the question is asked at ONE MOMENT instead of across a window: hold the
// camera, hold the clock as still as three captures allow, and toggle the LINK
// dial. Three captures per moment, evenly spaced:
//
//     A   link 0.6   ┐ signal  = |A - B|    the link, plus one gap of drift
//     B   link 0.0   ┤
//     B'  link 0.0   ┘ control = |B - B'|   ONE GAP OF DRIFT AND NOTHING ELSE
//
// Both spans are the same length, and the CONTROL is taken with the relationship
// switched off in both halves — so it contains exactly the things that confound
// this measurement (a crawling screen, a scrolling glyph grid, ambient motion)
// and none of the thing being measured. The verdict is on `signal - control`.
//
// An earlier version used two LINKED captures as the control, and that was
// backwards: with the relationship ON, the control carried the fusion's own
// motion and read almost as loud as the signal (`texture+fusion`: 49.8 against
// 44.8). `fusionIntensity` 0 is the honest null — `evaluateFusion` returns the
// identity frame there, so B is the same composition with the relationship
// switched off and nothing else changed.
//
// It is also strictly stronger than a travel measure, because it catches a
// CONSTANT push — a `reveal` link on a finished mark sits at full deflection and
// never moves, which reads as dead to anything measuring change over time.
//
// ── AND THE CROPS ARE ASSERTED OPAQUE ──────────────────────────────────────
// `__captureHarness.grab()` returns the 3D canvas, which is TRANSPARENT outside
// the mark. One fusion lane's first contact sheet composited that onto black and
// read it as "creating a fusion shreds the mark". It does not. Every sample here
// is composited onto the real paper before it is measured, and the alpha
// fraction is recorded per cell so a run that captured nothing cannot read as a
// run where nothing moved.
//
//   node scripts/verify/_probe-fusion-combo-liveness.mjs --label=v1
//   ... --only=material+texture,dither+ascii     a subset, for iteration
//   ... --samples=4 --gap=1500                   moments per cell, ms between
//   ... --settle=170                             ms between the three captures
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { PORT } from "./lib/dev-server.mjs"
import { loadTs } from "./_ts-load.mjs"

const F = loadTs("lib/style-fusion.ts")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "run")
const ONLY = arg("only", "")
const SAMPLES = Number(arg("samples", 4))
const GAP = Number(arg("gap", 1100))
/** Gap between the three captures of one moment. 170ms is ~20 frames at 120Hz —
 *  long enough for a uniform write to land and be presented, short enough that
 *  the layer phase barely advances, which is what makes A/A' a tight control. */
const SETTLE = Number(arg("settle", 90))
/** Attempts per cell before it is written off as `lost`. A dev server reloads,
 *  and how often depends on what else is running against it: measured
 *  2026-08-28 with six lanes live, THREE consecutive attempts on one cell were
 *  each cut short. 6 is sized for that, and `--retries=` is there because the
 *  right number is a property of the machine, not of this file. It buys more
 *  chances at a CLEAN measurement and changes no threshold. */
const RETRIES = Number(arg("retries", 6))
/** Fractions of the frame that contain the test stroke. Same window
 *  `_probe-fusion-sheet.mjs` frames its rows with. */
const CROP = (arg("crop", "0.24,0.30,0.58,0.46") || "").split(",").map(Number)
/** Azimuths a VIEW cell is stepped through — identical in both arms, so the
 *  camera's own contribution cancels instead of being mistaken for the
 *  relationship. See the header. */
const ANGLES = [0, 30, 60, 90, 120]
const OUT = join(ROOT, "docs", "verification", "fusion-combos", LABEL)
mkdirSync(OUT, { recursive: true })
mkdirSync(join(OUT, "crops"), { recursive: true })

/** The paper the app draws on. Same constant `_probe-fusion-sheet.mjs` uses. */
const PAPER = "#ffffff"
/** What `handleSelectCombo` sets the turntable to for a View cell. Recorded so
 *  the judge can assert the product DOES start it, separately from the stepped
 *  measurement, which deliberately does not use it. */
const FUSION_SPIN_EXPECTED = F.FUSION_VIEW_SPIN_DEG
/** The body every cell is measured and photographed against unless it names one
 *  of its own. See the reset in the loop for why the evidence needs this and the
 *  product does not. */
const DEFAULT_BODY = loadTs("lib/style-system.ts").DEFAULT_STYLE_STATE.materialPreset

function testStroke() {
  const pts = []
  for (let i = 0; i <= 150; i++) {
    const t = i / 150
    pts.push({ x: 140 + t * 600, y: 320 + Math.sin(t * Math.PI * 2.4) * 150 })
  }
  return [pts]
}

const PIX_HELPER = (cfg) => {
  const { paper, crop } = cfg
  /**
   * Frames are STORED per (slot, index) rather than diffed as they arrive,
   * because the comparison this probe needs is between two LINK STATES at the
   * same moment, not between two moments. `pair(a, b)` then reads the same index
   * out of two slots. A camera cell holds a fixed azimuth for each triple, so
   * the camera is identical across the three and cancels exactly.
   */
  window.__fsPix = {
    slots: {},
    box: null,
    reset() {
      window.__fsPix.slots = {}
    },
    async capture(slot, idx, keepUrl) {
      const url = window.__captureHarness.grab()
      if (!url) return { ok: false }
      const img = new Image()
      img.src = url
      await img.decode()
      /* THE CROP IS RESOLVED ONCE, IN PIXELS, AND A CANVAS THAT MOVES IS REFUSED.
       *
       * This read `crop[0] * img.width` on EVERY frame. The fraction is constant,
       * the canvas is not: the viewport is a flex child whose height follows the
       * geometry mode's config strip, so selecting a different fusion cell can
       * change it. The same fraction then covers a DIFFERENT PART OF THE MARK.
       *
       * Measured 2026-08-28 across two full captures: v1 came out 108 cells at
       * 2968x1816 and 12 at 1499x1816; v2 came out 98 and 22. Re-capturing did not
       * fix it because the probe was the cause. Downstream,
       * `assert-fusion-combo-distinct` REFUSED 554 of 3475 authored pairs for
       * mismatched geometry — 15.9 % of that file's central question — and a
       * duplicate hiding in those pairs was invisible.
       *
       * So the box is resolved from the FIRST frame and reused, and a later frame
       * whose canvas differs is refused rather than silently cropped somewhere
       * else. A wrong subject does not throw on its own; it returns a well-formed
       * answer to a question nobody asked. */
      if (!window.__fsPix.box) {
        window.__fsPix.box = {
          w: img.width,
          h: img.height,
          sx: crop[0] * img.width,
          sy: crop[1] * img.height,
          sw: crop[2] * img.width,
          sh: crop[3] * img.height,
        }
      }
      const box = window.__fsPix.box
      if (img.width !== box.w || img.height !== box.h) {
        return {
          ok: false,
          canvasMoved: `${img.width}x${img.height} against the ${box.w}x${box.h} this run's crop was resolved on`,
        }
      }
      const { sx, sy, sw, sh } = box
      const W = 480
      const H = Math.max(1, Math.round((W * sh) / sw))
      const c = document.createElement("canvas")
      c.width = W
      c.height = H
      const g = c.getContext("2d", { willReadFrequently: true })
      // ALPHA FIRST, on a cleared surface — the honest coverage number, and the
      // mask every difference below is measured over.
      g.clearRect(0, 0, W, H)
      g.drawImage(img, sx, sy, sw, sh, 0, 0, W, H)
      const raw = g.getImageData(0, 0, W, H).data
      const n = raw.length / 4
      const alpha = new Uint8Array(n)
      let opaque = 0
      for (let i = 0; i < n; i++) {
        alpha[i] = raw[i * 4 + 3]
        if (raw[i * 4 + 3] > 250) opaque++
      }
      // …THEN composite onto the real paper, which is what a viewer sees and the
      // only surface a difference means anything on. A crop measured on a
      // transparent canvas is the contact-sheet lie this repo has already read
      // as "creating a fusion shreds the mark".
      g.clearRect(0, 0, W, H)
      g.fillStyle = paper
      g.fillRect(0, 0, W, H)
      g.drawImage(img, sx, sy, sw, sh, 0, 0, W, H)
      const rgb = g.getImageData(0, 0, W, H).data
      ;(window.__fsPix.slots[slot] ??= [])[idx] = { rgb, alpha, n }
      return { ok: true, opaqueFrac: opaque / n, url: keepUrl ? url : null, w: img.width, h: img.height }
    },
    /* MEASURED OVER THE MARK, NOT OVER THE PAPER. The stroke covers ~3 % of the
     * cropped frame; averaging a change on the ink across 97 % of untouched
     * paper divides the signal by thirty and puts every cell under any floor
     * worth having — the same "a tone window five times wider than its subject"
     * mistake explainer 15 records. The mask is the UNION of the two frames'
     * alpha, so ink that appears or disappears counts as movement. */
    diff(A, B) {
      /* SAME FRAME SIZE, OR IT IS NOT A COMPARISON. `H` is derived from the
       * captured canvas, so two frames taken either side of a remount can have
       * different heights — and then `B.rgb[j]` runs off the end, returns
       * `undefined`, and every arithmetic below it turns to NaN. Measured: a
       * cell read `net NaN` on the run after a reload. A mismatch is a pair
       * that cannot be compared, which is exactly what `null` already means. */
      if (!A || !B || A.n !== B.n) return null
      let d = 0
      let m = 0
      let sumA = 0
      let sumB = 0
      for (let i = 0; i < A.n; i++) {
        if (A.alpha[i] <= 10 && B.alpha[i] <= 10) continue
        const j = i * 4
        d +=
          Math.abs(A.rgb[j] - B.rgb[j]) +
          Math.abs(A.rgb[j + 1] - B.rgb[j + 1]) +
          Math.abs(A.rgb[j + 2] - B.rgb[j + 2])
        sumA += A.rgb[j] * 0.2126 + A.rgb[j + 1] * 0.7152 + A.rgb[j + 2] * 0.0722
        sumB += B.rgb[j] * 0.2126 + B.rgb[j + 1] * 0.7152 + B.rgb[j + 2] * 0.0722
        m++
      }
      /* TWO CHANNELS, BECAUSE EACH IS BLIND TO WHAT THE OTHER SEES.
       *
       * `mean` is the per-pixel L1 distance. It catches anything that moves
       * WHERE the ink is — a sheared pattern, a travelling band, a matrix pushed
       * sideways — and it is what the first version measured.
       *
       * It is also swamped on a SCROLLING GLYPH GRID: 90 ms of ASCII scroll is
       * ~1.7 device px, and every glyph edge in the field moves, so the frame is
       * completely different by L1 whether or not anything is coupled. Measured:
       * `animation+ascii+layers` read signal 44.66 against drift 47.05 — the
       * control louder than the signal, on a cell the model says moves.
       *
       * `tone` is the difference in MEAN LUMINANCE over the mark. A scroll
       * preserves it almost exactly (the same glyphs, one cell over); a density,
       * threshold, contrast or ink-weight change moves it directly. So the two
       * channels are complementary, each is compared against its OWN drift
       * control, and a cell is live if EITHER separates. Reporting one alone
       * would call a whole family of real relationships dead. */
      return { mean: m ? d / (m * 3) : 0, tone: m ? Math.abs(sumA - sumB) / m : 0, maskPx: m }
    },
    /** Consecutive frames within one arm — the TIME measure. */
    travel(slot) {
      const f = window.__fsPix.slots[slot] ?? []
      const out = []
      for (let i = 1; i < f.length; i++) out.push(window.__fsPix.diff(f[i - 1], f[i]))
      return out
    },
    /** The same index in two arms — the PAIRED measure, camera cancelled. */
    pair(a, b) {
      const A = window.__fsPix.slots[a] ?? []
      const B = window.__fsPix.slots[b] ?? []
      const out = []
      for (let i = 0; i < Math.min(A.length, B.length); i++) out.push(window.__fsPix.diff(A[i], B[i]))
      return out
    },
  }
}

/* ── THE PREPARED PAGE, AS A FUNCTION, BECAUSE IT DOES NOT SURVIVE THE RUN ──
 *
 * A 120-cell run is ~13 minutes against a dev server, and a dev server RELOADS.
 * Measured 2026-08-28 in a checkout with six lanes live, all driving gates at
 * the same server: a full document reload landed roughly every other cell, and
 * on one cell three consecutive attempts were each cut short. It takes
 * `window.__fsPix` and the injected stroke with it, and the next
 * `page.evaluate` dies on `undefined`. Run as a straight line, this probe
 * therefore lost the WHOLE run at whatever cell the first reload hit — twice at
 * cell 2 and cell 4 of a four-cell smoke. The reload reproduces with this
 * lane's changes reverted, so it is the environment, not the build.
 *
 * ⚠ THE RETRY MUST NOT BE ABLE TO INVENT A NUMBER. A cell is measured whole or
 * not at all: the loop below builds one record from its own captures and a
 * reload makes it THROW rather than return a short one, so a half-measured cell
 * is discarded instead of written. A cell that cannot be completed after
 * `--retries` attempts is written as `lost`, which the judge fails on. A reload
 * that quietly became a 0.000 would be a dead cell manufactured by the
 * instrument, which is the exact defect this file's alpha check exists for. */
async function prepare(page) {
  await page.goto(`http://localhost:${PORT}`, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__styleHarness && window.__captureHarness, null, { timeout: 60000 })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12 }), testStroke())
  await page.waitForTimeout(1500)
  if (await page.evaluate(() => !!window.__revealHarness))
    await page.evaluate(() => window.__revealHarness.setProgress(1))
  await page.waitForTimeout(500)
  await page.evaluate(PIX_HELPER, { paper: PAPER, crop: CROP })
}

/** Is the page still the one we prepared? `__fsPix` is ours and nothing else
 *  writes it, so its absence is exactly "this document is not that document". */
async function ready(page) {
  return await page
    .evaluate(() => !!(window.__fsPix && window.__styleHarness && window.__captureHarness))
    .catch(() => false)
}

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  let reloads = 0
  await prepare(page)

  const keys = ONLY
    ? ONLY.split(",").map((s) => s.trim()).filter(Boolean)
    : await page.evaluate(() => window.__styleHarness.fusionComboKeys())
  console.log(`driving ${keys.length} combination cells, ${SAMPLES} frames per arm, ${GAP}ms apart`)

  const results = []
  let i = 0
  for (const key of keys) {
    i++
    const cell = F.FUSION_COMBOS_BY_KEY[key]
    let done = false
    let lost = null
    for (let attempt = 1; attempt <= RETRIES && !done; attempt++) {
     try {
      /* A CELL IS MEASURED ON A PREPARED PAGE OR NOT AT ALL. If the document was
       * replaced since the last cell, this rebuilds it — same stroke, same
       * reveal, same helper — and the cell starts over from its first capture
       * rather than continuing into a page that has never seen the stroke. */
      if (!(await ready(page))) {
        reloads++
        console.log(`  … page was replaced, re-preparing (reload ${reloads})`)
        await prepare(page)
      }
    /* THE CAMERA IS RESET BEFORE EVERY CELL. Selecting a View cell starts the
     * turntable, and without this it stayed on for every cell after it — so the
     * first smoke run measured every later cell on a moving camera. A leaked
     * piece of state is the difference between an instrument and a rumour. */
    await page.evaluate(() => window.__styleHarness.setSpin(0))
    await page.evaluate(() => window.__captureHarness.orbitView(38, 14))
    /* THE BODY IS RESET TOO, AND IT IS NOT THE SAME KIND OF RESET AS THE CAMERA.
     *
     * MATERIAL IS ORTHOGONAL — the shipped rule (`applyPresetToStyleState`) is
     * that a composition preset leaves the body alone unless its own patch names
     * one, and a combination cell names one exactly when `material` is a MEMBER.
     * That is correct in the product: a relationship you can wear on any body is
     * a feature.
     *
     * It is wrong for EVIDENCE. Run sequentially, a cell with no material member
     * inherits whatever body the PREVIOUS cell set — the first 120-cell sheet
     * came back with a run of amber tiles because Candle Wax had set `wax` five
     * cells earlier. That makes the evidence history-dependent and makes a tile
     * a picture of two cells. Resetting to the default body first isolates the
     * cell: what you see is what THIS relationship contributes. */
    await page.evaluate((m) => window.__styleHarness.setStyle({ materialPreset: m, materialUserOverride: false }), DEFAULT_BODY)
    await page.waitForTimeout(120)
    const took = await page.evaluate((k) => window.__styleHarness.selectFusionCombo(k), key)
    if (!took) {
      results.push({ key, refused: true })
      console.log(`  ${String(i).padStart(3)}/${keys.length}  ${key.padEnd(52)} ROUTE REFUSED`)
      done = true
      break
    }
    /* DOES THE PRODUCT START THE TURNTABLE? Read BEFORE it is stopped for the
     * measurement. The free-running turntable is what a press does and is the
     * fix for "turntable dont animate"; it is the wrong instrument for a
     * difference, because it never repeats. Both facts are recorded. */
    const spinOnSelect = await page.evaluate(() => window.__styleHarness.cameraSpin())
    const stepped = !!cell && F.fusionUsesView(cell)
    await page.evaluate(() => window.__styleHarness.setSpin(0))

    await page.evaluate(() => window.__fsPix.reset())
    let head = null
    const moved = []
    for (let s = 0; s < SAMPLES; s++) {
      /* A CAMERA CELL IS STEPPED THROUGH FIXED ANGLES — the driver has to have a
       * value to give, and head-on it rests at exactly zero (that is the whole
       * viewTurn defect). Each triple is taken at ONE angle, held still. */
      if (stepped) {
        await page.evaluate((az) => window.__captureHarness.orbitView(az, 14), ANGLES[s % ANGLES.length])
        await page.waitForTimeout(GAP)
      } else if (s > 0) {
        await page.waitForTimeout(GAP)
      } else {
        await page.waitForTimeout(700)
      }
      /* THREE CAPTURES, ONE GAP APART, AND THE CONTROL IS THE ONE WITH THE
       * RELATIONSHIP SWITCHED OFF IN BOTH HALVES.
       *
       *   A   link 0.6   ┐ signal  = |A - B|   the link, plus one gap of drift
       *   B   link 0.0   ┤
       *   B'  link 0.0   ┘ control = |B - B'|  ONE GAP OF DRIFT AND NOTHING ELSE
       *
       * The control is captured with `fusionIntensity` at 0, where
       * `evaluateFusion` returns the identity frame — so it contains exactly the
       * things that confound this measurement (a crawling screen, a scrolling
       * glyph grid, any ambient motion in the scene) and NONE of the thing being
       * measured. An earlier version used two LINKED captures as the control and
       * that was backwards: with the relationship on, the control contained the
       * fusion's own motion and read almost as loud as the signal.
       *
       * The verdict is therefore on `signal - control`: the difference the LINK
       * makes over and above what the composition does on its own in the same
       * interval. */
      await page.evaluate((v) => window.__styleHarness.setStyle({ fusionIntensity: v }), 0.6)
      await page.waitForTimeout(SETTLE)
      /* AND THE REFUSAL IS READ. `capture()` can now return `ok: false` with a
       * `canvasMoved` reason, and until 2026-08-28 every one of these three call
       * sites threw the result away — two of them did not even assign it. A guard
       * whose refusal nobody reads is a comment, which is the defect this probe's
       * own crop had. Any refusal makes the whole cell unmeasured. */
      const r = await page.evaluate(([sl, idx, keep]) => window.__fsPix.capture(sl, idx, keep), ["a", s, s === 0])
      if (r && r.ok === false && r.canvasMoved) moved.push(`a@${s}: ${r.canvasMoved}`)
      if (s === 0) head = r
      await page.evaluate((v) => window.__styleHarness.setStyle({ fusionIntensity: v }), 0)
      await page.waitForTimeout(SETTLE)
      const rb = await page.evaluate(([sl, idx]) => window.__fsPix.capture(sl, idx, false), ["b", s])
      if (rb && rb.ok === false && rb.canvasMoved) moved.push(`b@${s}: ${rb.canvasMoved}`)
      await page.waitForTimeout(SETTLE)
      const rb2 = await page.evaluate(([sl, idx]) => window.__fsPix.capture(sl, idx, false), ["b2", s])
      if (rb2 && rb2.ok === false && rb2.canvasMoved) moved.push(`b2@${s}: ${rb2.canvasMoved}`)
    }
    const sig = await page.evaluate(() => window.__fsPix.pair("a", "b"))
    const ctl = await page.evaluate(() => window.__fsPix.pair("b", "b2"))
    const mean = (rows) => rows.reduce((x, y) => x + (y?.mean ?? 0), 0) / Math.max(1, rows.length)
    const tone = (rows) => rows.reduce((x, y) => x + (y?.tone ?? 0), 0) / Math.max(1, rows.length)
    const netL1 = Math.max(0, mean(sig) - mean(ctl))
    const netTone = Math.max(0, tone(sig) - tone(ctl))
    const rec = {
      key,
      mode: stepped ? "angles" : "moments",
      spinOnSelect,
      empty: !!cell?.empty,
      /* A cell whose canvas moved under the crop is NOT a measurement. It carries
       * the reason so the gate can refuse it by name rather than reading whatever
       * a differently-framed window happened to contain. */
      canvasMoved: moved.length ? moved : undefined,
      /* AND IT REUSES THE `lost` MECHANISM RATHER THAN ADDING A SECOND ONE.
       * `assert-fusion-combo-liveness` already refuses a run with any `lost` cell
       * — "a cell the probe lost the page on is not a cell that did not move" —
       * and a cell whose canvas moved under the crop is exactly that: not a
       * measurement. One mechanism, two causes, no new gate row.
       *
       * ⚠ BOTH FIELDS ARE NOW BUILT AND NEVER SHIPPED. The throw at the foot of
       * this block sends a moved cell round again instead of writing it, so a
       * record that reaches `results` cannot carry either. They are kept because
       * the record is assembled before the guards run and the reason belongs on
       * it while it exists; the reason a reader actually sees is the `lost`
       * string the retry loop writes after the attempts run out. */
      lost: moved.length ? true : undefined,
      opaqueFrac: head?.opaqueFrac ?? 0,
      maskPx: sig[0]?.maskPx ?? 0,
      w: head?.w ?? 0,
      h: head?.h ?? 0,
      signal: mean(sig),
      control: mean(ctl),
      toneSignal: tone(sig),
      toneControl: tone(ctl),
      netL1,
      netTone,
      /** THE NUMBER THE GATE JUDGES: whichever channel actually sees this
       *  relationship. `netTone` is scaled x8 so the two land on one axis — a
       *  1-level shift in the mark's mean tone is a far bigger event than a
       *  1-level average per-pixel wobble, because it moves EVERY pixel the same
       *  way instead of shuffling them. Calibrated on the four structurally
       *  empty cells, which read 0.000 on both channels. */
      net: Math.max(netL1, netTone * 8),
      /* PER MOMENT, so the verdict is not a mean hiding one loud sample. The
       * judge requires the net to be positive at a MAJORITY of moments as well
       * as on average — a relationship whose driver happened to be at rest for
       * three of four samples is a real finding, not a rounding error. */
      perMomentNet: sig.map((r, k) =>
        Number(
          Math.max(
            (r?.mean ?? 0) - (ctl[k]?.mean ?? 0),
            ((r?.tone ?? 0) - (ctl[k]?.tone ?? 0)) * 8,
          ).toFixed(3),
        ),
      ),
    }
    /* A NUMBER THAT IS NOT A NUMBER IS NOT A MEASUREMENT. Anything non-finite
     * here means the captures this record was built from do not describe one
     * page, so the record is thrown away and the cell measured again — never
     * written out, because `NaN > FLOOR` is false and the judge would have
     * reported a false DEAD cell off it. */
    for (const k of ["signal", "control", "toneSignal", "toneControl", "netL1", "netTone", "net"])
      if (!Number.isFinite(rec[k])) throw new Error(`non-finite ${k} (${rec[k]}) — captures do not describe one page`)
    /* 🔴 A MISSING FRAME IS NOT AN EMPTY MASK, AND SAYING SO SENT A LANE AFTER
     * THE WRONG DEFECT.
     *
     * `diff()` returns `null` when either frame is absent or the two differ in
     * size, and `sig[0]?.maskPx ?? 0` collapses that `null` to 0 — the same 0 a
     * genuinely blank crop produces. So SEVEN cells were written as `empty mask
     * — the crop caught no mark`, which reads as a statement about the picture
     * and is not one. It is a statement about the CAPTURE: `capture()` returned
     * `ok: false` at moment 0, because the canvas had moved under the pinned
     * crop or because `grab()` came back null mid-remount, so nothing was ever
     * stored in slot `a`.
     *
     * Measured 2026-08-28, all seven driven directly and read whole-frame:
     * `material+animation+texture`, `material+animation+dither`,
     * `material+texture+dither`, `material+animation+ascii`,
     * `material+texture+ascii`, `material+dither+ascii` and
     * `animation+texture+dither+layers+fusion` render 13,019 to 13,146 pixels of
     * alpha > 10 INSIDE the crop, against 13,146 for a healthy control. The mark
     * was present and it was in frame every time.
     *
     * The two causes get two messages, and the refusal's own reason is carried
     * into the retry log instead of being discarded. `maskPx` 0 on a pair that
     * DID compare still means what it always meant. */
    if (sig[0] == null)
      throw new Error(
        moved.length
          ? `no pair at moment 0 — ${moved[0]}`
          : "no pair at moment 0 — a capture was refused or two frames differ in size; this is not an empty crop",
      )
    /* A MOVED CANVAS IS RETRIED, LIKE EVERY OTHER THING THAT IS NOT A
     * MEASUREMENT. This file's own rule two hundred lines up is "a cell is
     * measured whole or not at all", and a reload gets six attempts under it. A
     * moved canvas was the one unmeasurable outcome that got none: the record
     * was written straight to `lost` on the first sighting.
     *
     * That mattered once the layout stopped ratcheting. Before `min-w-0` on
     * app/page.tsx, a canvas that went wide STAYED wide, so retrying could only
     * burn six attempts on a cell that was never coming back. Now the wide frame
     * is a transient, measured 2026-08-28: one moment of one cell in a 120-cell
     * run went 2968x1816 while a concurrent recompile swapped the stylesheet,
     * and every frame either side of it was 1499x1816. Written straight to
     * `lost`, that transient costs a cell. Retried, it costs a few seconds.
     *
     * `RETRIES` is unchanged and so is every threshold. A cell that is STILL
     * moving after its attempts lands as `lost` carrying the refusal's own
     * reason, which is what the gate reads today. */
    if (moved.length) throw new Error(`canvas moved under the crop — ${moved[0]}`)
    if (!rec.maskPx) throw new Error("empty mask — the crop caught no mark")
    results.push(rec)
    /* MARKED DONE THE INSTANT THE RECORD EXISTS, so nothing after this line can
     * send the cell round again and push a SECOND record for it. Writing the
     * crop and the log line are reporting, not measuring. */
    done = true
    if (head?.url)
      writeFileSync(join(OUT, "crops", `${key.replace(/\+/g, "_")}.png`), Buffer.from(head.url.split(",")[1], "base64"))
    console.log(
      `  ${String(i).padStart(3)}/${keys.length}  ${key.padEnd(52)} ${rec.mode.padEnd(7)} net ${rec.net.toFixed(3).padStart(8)} · L1 ${netL1.toFixed(2).padStart(6)} (${rec.signal.toFixed(1)}-${rec.control.toFixed(1)}) · tone ${netTone.toFixed(3).padStart(6)} (${rec.toneSignal.toFixed(2)}-${rec.toneControl.toFixed(2)}) · spin ${spinOnSelect}`,
    )
     } catch (e) {
      /* A THROW HERE IS THE RELOAD, and this cell's captures are now a mix of
       * two documents. They are DISCARDED, not salvaged: `page.evaluate` failing
       * mid-triple would otherwise leave `__fsPix` holding frames from before
       * and after the reload, and a difference measured across that is noise
       * wearing a signal's clothes. */
      lost = String(e?.message ?? e).split("\n")[0].slice(0, 200)
      console.log(`  … ${key} attempt ${attempt}/${RETRIES} lost the page: ${lost}`)
     }
    }
    /* NOT MEASURED IS NOT THE SAME AS DID NOT MOVE, and only one of those two is
     * a finding about the product. A cell that ran out of attempts is written as
     * `lost` — with no `net` at all, so nothing downstream can read it as a
     * quiet 0.000 — and the judge has a row that fails on it. */
    if (!done) {
      results.push({ key, lost: lost ?? "unknown" })
      console.log(`  ${String(i).padStart(3)}/${keys.length}  ${key.padEnd(52)} LOST — not measured after ${RETRIES} attempts`)
    }
  }

  const meta = {
    label: LABEL,
    at: new Date().toISOString(),
    port: PORT,
    samples: SAMPLES,
    gapMs: GAP,
    settleMs: SETTLE,
    retries: RETRIES,
    /** How many times the document was replaced under the run. Recorded so a
     *  clean-looking table cannot hide an unstable server. */
    reloads,
    paper: PAPER,
    defaultBody: DEFAULT_BODY,
    crop: CROP,
    angles: ANGLES,
    results,
  }
  writeFileSync(join(OUT, "liveness.json"), JSON.stringify(meta, null, 2))
  console.log(`\nwrote ${join(OUT, "liveness.json")}  (${results.length} cells)`)
  await ctx.close()
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
