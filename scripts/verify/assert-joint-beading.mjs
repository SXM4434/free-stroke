// JOINT BEADING — does Rod stamp a sphere at every real corner and nowhere else?
//
// THE COMPLAINT
//   "look at all the weird joints, it doesn't look like handwriting, it looks
//   like some stupid machine wrote it."  Spherical beads sitting proud of the
//   tube at stroke ends and bends, reading as plumbing fittings.
//
// THE MEASUREMENT
//   `__geomDebug.stats()` separates the two Rod sphere passes by vertex count
//   (cap = 225, joint = 81 — see the comment there). So the number under test
//   is `jointSpheres`, not "did the picture change".
//
//   The count is the headline but NOT the acceptance test. A fix that simply
//   stops stamping is a regression, not a fix, so this script measures a
//   fixture set with both signs in it:
//
//     word / loopyS / openC — smooth. Beads here are SPURIOUS; they must fall.
//     zigzag                — seven hard corners. Beads here are REQUIRED;
//                             they must survive.
//
//   That is the effect's own signature: down on smooth curves AND held on
//   corners. Either half alone is satisfiable by a bug.
//
// WHY GLOSS
//   Rod's mode default is `ink`. Specular reflection is a derivative operator
//   on the normal field: matte integrates over the hemisphere so a bead moves
//   the shaded value a few percent, gloss mirrors a small solid angle so the
//   same bead swings it 0 -> 1 in one pixel. A bead that survives on
//   glossyPlastic survives everywhere, so gloss is the harsh instrument and the
//   frames are captured on it. (Same reasoning as verify-gloss-rim.mjs.)
//
// ORDERING TRAP (inherited from verify-gloss-rim / verify-engine-ab)
//   `setMaterial` sets materialUserOverride and `setMode` stamps
//   MODE_MATERIAL_DEFAULTS over anything not overridden — so material must be
//   set AFTER mode, and read back. This project has already shipped a harness
//   that "passed" while its clicks landed on nothing.
//
// ⚠ WHAT THIS FILE WAS, AND WHY IT IS DIFFERENT NOW (2026-08-01)
//
//   Until today this script's DEFAULT invocation emitted ZERO PASS/FAIL rows. It
//   captured frames, printed `[joints] word joints=2 caps=8 …`, and exited 0. It
//   was a capture wearing an `assert-` name, so in every sweep it read green —
//   and it would have read green just as loudly with the beading bug back in.
//
//   Its two judging modes did exist and were good, but BOTH of them
//   (`--compare`, `--holdsteady`) are DIFFS BETWEEN TWO STORED LABELS. They read
//   two report.json files, capture nothing, and finish in 0 s. So the only paths
//   that could fail were paths that never touch the current tree.
//
//   The fix is the block marked `THE DEFAULT PATH JUDGES` below: after the
//   capture, the same run's numbers are checked against an oracle computed from
//   the FIXTURE GEOMETRY in node — not against a stored reading of a previous
//   run — and the exit code carries the verdict. `--compare` and `--holdsteady`
//   are untouched and still work.
//
// Usage:
//   node scripts/verify/assert-joint-beading.mjs                  # capture AND judge
//   node scripts/verify/assert-joint-beading.mjs --label=before
//   ...change the engine...
//   node scripts/verify/assert-joint-beading.mjs --label=after
//   node scripts/verify/assert-joint-beading.mjs --compare=before,after
// Output (durable, NOT /tmp):
//   docs/verification/joint-beading/<label>/<fixture>/*.png + <fixture>.mp4
//   docs/verification/joint-beading/<label>/report.json
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { layoutWord } from "../capture/letters.mjs"
import { loadTs } from "./_ts-load.mjs"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { LAB_URL } from "./lib/dev-server.mjs"
import { stageEvidence } from "./lib/evidence-swap.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const BASE = join(ROOT, "docs", "verification", "joint-beading")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "run")
const MATERIAL = arg("material", "glossyPlastic")
const AZ_STEPS = parseInt(arg("az", "8"), 10)

/**
 * `word` is the hero fixture and the one the complaint was made about — the
 * literal word from the Desk Doodles brief, laid out by the same stroke font
 * verify-engine-ab.mjs uses, so the 205-vs-63 number in
 * docs/explainers/12-desk-doodles-engine-port.md is directly comparable.
 *
 * `zigzag`, `loopyS` and `openC` are lifted verbatim from
 * scripts/verify/geometry-baseline.mjs so this run and the regression net are
 * looking at the same shapes.
 */
const FIXTURES = {
  word: () => {
    const { polylines, width } = layoutWord("Desk Doodles", { x: 0, y: 0, size: 118, tracking: 12 })
    const k = 760 / width
    return polylines.map((pl) => pl.map((p) => ({ x: 70 + p.x * k, y: 300 + p.y * k })))
  },
  zigzag: () => {
    const p = []
    for (let i = 0; i <= 8; i++) p.push({ x: 120 + i * 80, y: i % 2 === 0 ? 260 : 500 })
    return [p]
  },
  loopyS: () => {
    const p = []
    for (let i = 0; i <= 120; i++) {
      const t = i / 120
      p.push({ x: 120 + t * 620, y: 330 + Math.sin(t * Math.PI * 2.2) * 130 })
    }
    return [p]
  },
  openC: () => {
    const p = []
    for (let i = 0; i <= 90; i++) {
      const a = Math.PI * 0.35 + (i / 90) * Math.PI * 1.3
      p.push({ x: 420 + Math.cos(a) * 180, y: 380 + Math.sin(a) * 180 })
    }
    return [p]
  },
}
const NAMES = arg("fixtures", Object.keys(FIXTURES).join(",")).split(",")

// Same three elevations as the gloss-rim / engine-ab captures so these frames
// can be read beside those runs rather than being their own universe.
const ELEVATIONS = [8, 26, 50]

async function capture(label) {
  const OUT = join(BASE, label)
  mkdirSync(OUT, { recursive: true })

  // STANDING RULE: never headless. Headless silently pauses the rAF loop on
  // this machine and SwiftShader freezes rotateY outright, so a headless run
  // produces frames that look like evidence and are not.
  const browser = await chromium.launch({ headed: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 160))
  })

  const ready = async () => {
    await page.goto(LAB_URL, { waitUntil: "networkidle" })
    await page.waitForFunction(
      () => window.__styleHarness && window.__captureHarness && window.__revealHarness && window.__geomDebug,
      null,
      { timeout: 60000 },
    )
    await page.evaluate(() => window.__captureHarness.enable())
    await page.waitForTimeout(300)
  }
  await ready()

  const report = {}

  async function unit(name) {
    const dirFinal = join(OUT, name)
    /* STAGED PER UNIT. `joint-beading` holds 904 tracked files and this
     * wipe used to empty one fixture directory before spending minutes refilling it.
     * A run that dies mid-unit now leaves that unit's stored frames alone; every
     * unit already finished stays finished. lib/evidence-swap.mjs. */
    const ev = stageEvidence(dirFinal)
    const dir = ev.open()

    await page.evaluate(() => window.__styleHarness.clearStrokes())
    await page.waitForTimeout(200)
    await page.evaluate((poly) => window.__styleHarness.injectStrokes(poly, { msPerPoint: 10 }), FIXTURES[name]())
    await page.waitForTimeout(700)
    await page.evaluate(() => window.__styleHarness.setMode("rod"))
    await page.waitForTimeout(600)
    await page.evaluate(() => window.__styleHarness.setEngine("free-stroke"))
    await page.waitForTimeout(600)
    await page.evaluate((mat) => window.__styleHarness.setMaterial(mat), MATERIAL)
    await page.waitForTimeout(600)

    // Read it all back. A capture that ran on the wrong engine, mode or
    // material is worse than no capture — it looks like evidence.
    const state = await page.evaluate(() => {
      const g = window.__styleHarness.get()
      return { material: g.styleState.materialPreset, engine: g.engineFamily, mode: g.geometryMode }
    })
    if (state.material !== MATERIAL) throw new Error(`material did not take: ${state.material}`)
    if (state.engine !== "free-stroke") throw new Error(`engine did not take: ${state.engine}`)
    if (state.mode !== "rod") throw new Error(`mode did not take: ${state.mode}`)

    await page.evaluate(() => window.__revealHarness.setProgress(1))
    await page.waitForTimeout(500)

    const stats = await page.evaluate(() => window.__geomDebug.stats())
    if (!stats || typeof stats.jointSpheres !== "number") {
      throw new Error(
        "__geomDebug.stats() has no jointSpheres — the instrument this script " +
          "exists to read is missing. A broken instrument must look broken.",
      )
    }

    // `requireInk` counts non-transparent, non-white pixels IN THE PAGE before
    // the PNG is written, on the LARGEST canvas (the 1920x1080 capture target;
    // `querySelector("canvas")` returns the 2D drawing canvas, which is always
    // inked and would pass this gate for any 3D frame whatsoever — a guard that
    // cannot fail is not a guard). Copied from verify-gloss-rim.mjs, which
    // exists because this project already shipped a directory of blank frames
    // that read as evidence of a clean surface.
    const grab = async (file, { requireInk = false } = {}) => {
      const res = await page.evaluate((needInk) => {
        const url = window.__captureHarness.grab()
        if (!url || !needInk) return { url, ink: null }
        let img = null
        for (const c of document.querySelectorAll("canvas")) {
          if (!img || c.width * c.height > img.width * img.height) img = c
        }
        if (!img) return { url, ink: 0 }
        const cv = document.createElement("canvas")
        cv.width = img.width
        cv.height = img.height
        const g = cv.getContext("2d")
        try {
          g.drawImage(img, 0, 0)
        } catch {
          return { url, ink: null }
        }
        const d = g.getImageData(0, 0, cv.width, cv.height).data
        let ink = 0
        for (let i = 0; i < d.length; i += 16) {
          if (d[i + 3] > 8 && (d[i] < 240 || d[i + 1] < 240 || d[i + 2] < 240)) ink++
        }
        return { url, ink }
      }, requireInk)
      const m = (res.url || "").match(/base64,(.+)/)
      if (!m) throw new Error("grab failed")
      if (requireInk && res.ink !== null && res.ink < 200) {
        throw new Error(`blank frame for ${file} (ink=${res.ink}) — camera is not on the form`)
      }
      writeFileSync(join(dir, file), Buffer.from(m[1], "base64"))
    }

    let f = 0
    for (const el of ELEVATIONS) {
      for (let i = 0; i < AZ_STEPS; i++) {
        const az = (360 * i) / AZ_STEPS
        await page.evaluate(({ az, el }) => window.__captureHarness.orbitView(az, el, 0.92), { az, el })
        await page.waitForTimeout(90)
        await grab(`${String(f).padStart(4, "0")}.png`)
        f++
      }
    }
    // CLOSE-UPS. A whole-form orbit cannot resolve a bead that is ~1% of the
    // form's width, and that is exactly the defect under test.
    //
    // THIS LOOP WAS WRITTEN WITH THE BUG DOCUMENTED IN
    // docs/explainers/13-measuring-the-rim.md §3 STILL IN IT — the first version
    // of this file read
    //   `for (const [k, [az, el, fill]] of [[0,[18,10,0.26]], …].entries())`
    // where the rows ALREADY lead with their own index, so `.entries()` supplied
    // a second one: `az` took the row's index, `el` took the whole camera tuple
    // as an array, `fill` came out `undefined`, the camera position went NaN and
    // every closeup was blank. Fixed the same way verify-gloss-rim.mjs was —
    // focusView against `bounds()` with offsets as FRACTIONS of the form's own
    // radius (so a word and a zigzag are framed equally tightly), and every
    // frame ink-gated before it is written.
    const bounds = await page.evaluate(() => window.__captureHarness.bounds())
    if (!bounds) throw new Error("bounds() returned null — nothing to focus on")
    const R = bounds.radius

    /* ── 🔴 THE TARGET HAS TO BE ON THE FORM, AND AN OFFSET FROM THE BOUNDING
     *    CENTRE IS NOT (corrected 2026-09-04) ─────────────────────────────────
     *
     * This loop used to aim at `bounds().center + {-0.55, 0, +0.55}·R` in x. For
     * a closed shape that lands in ink; for an OPEN one the bounding centre is
     * the hole. `openC` is a 234° arc of page-radius 180 about (420, 380), so
     * ALL THREE of those targets sit in empty space — 0 and ±0.55 R are 0, 99 and
     * 99 page units from a centre with nothing within 180 of it.
     *
     * MEASURED, BOTH ENDS. The run of 2026-09-04 died on `openC` with
     * `blank frame for closeup_1.png (ink=0)` after four attempts — and the
     * STORED frame it would have replaced, `dense/openC/closeup_1.png` shot
     * 2026-07-29, is 90 % white with one sliver of arc in the far-left margin.
     * It cleared the guard's 200 px bar by luck of framing, not by aim. So this
     * is not a regression that arrived today. It is a targeting rule that was
     * wrong for open shapes from the day it was written, and it has been writing
     * frames of the background ever since.
     *
     * ⚠ AND `components/viewport-3d.tsx` PREDICTED IT, at `bounds`: *"every
     * `closeup_*.png` it wrote is blank white. Those blanks sit in
     * docs/verification looking exactly like evidence."* That paragraph is about
     * the fill-factor workaround this file already replaced. The offset is the
     * same mistake one step further on — a target chosen from the form's EXTENT
     * instead of from the form.
     *
     * ── THE ROUTE THAT LOOKED RIGHT AND IS NOT, WRITTEN DOWN SO THE NEXT
     *    READER DOES NOT SPEND THE HOUR AGAIN ─────────────────────────────────
     *
     * `__geomDebug.dumpMeshes()` publishes the export group's vertex buffer, so
     * a real surface point looks one call away. It is not, and the reason is a
     * silent one: `dumpMeshes` reads `geometry.getAttribute("position")` and
     * NEVER applies `mesh.matrixWorld`, while `stats()` two hundred lines above
     * it builds its box with `box.expandByObject(mesh)`, which does. On a
     * fixture whose meshes carry node transforms the two disagree and nothing
     * says so. Measured on this build, 2026-09-04:
     *
     *     fixture   raw dumpMeshes y-span   stats() bbox y   centres differ by
     *     openC     1.1582                  1.1582           0.000
     *     word      0.8590                  0.3044           0.277  (0.24 R)
     *
     * openC is ONE stroke and its node happens to be at identity, so the route
     * "works" on exactly the fixture that made it look necessary. The word is 44
     * meshes and the pile of local-space buffers is not a shape. A target read
     * off it would have been plausible, wrong, and unremarked — which is the
     * defect class this whole block is about, one layer down.
     *
     * ── WHAT IS ACTUALLY TRUE AND USED HERE ────────────────────────────────
     *
     *   1. `bounds().center` ± `stats().bbox / 2` IS the form's world box, and
     *      that is checked rather than believed: openC's corners agree with the
     *      dumped extremes to 0.0015, which is `bbox`'s own 4-dp rounding.
     *   2. Nothing published says which points inside that box hold ink. So the
     *      aim is not derived from the box — it is MEASURED. Candidates are laid
     *      across the box, the camera is put on each, and the ink in the frame is
     *      counted IN THE PAGE, with the same predicate `grab` uses. The
     *      best-inked candidate in each third of the form wins its station.
     *
     * That is a search, and it is a search over a NUISANCE PARAMETER — where the
     * camera looks — never over a verdict. No row below reads a closeup; they
     * read `__geomDebug.stats()`. What the search buys is that the frames a human
     * opens are frames of the form. The scores are recorded per fixture so a
     * reader can see how much ink each station actually found.
     *
     * The three camera stations (distance, azimuth, elevation) are untouched. */
    const boxSize = await page.evaluate(() => window.__geomDebug.stats()?.bbox ?? null)
    if (!Array.isArray(boxSize) || boxSize.length < 2) {
      throw new Error("stats().bbox is missing — the closeups have no legitimate world box to aim inside")
    }
    /** Ink in the CURRENT frame, counted in the page so nothing is transferred.
     *  Same canvas choice and same predicate as `grab`, on purpose: a scout that
     *  measured a different thing from the guard would pick a target the guard
     *  then rejects. */
    const inkNow = () =>
      page.evaluate(() => {
        let img = null
        for (const c of document.querySelectorAll("canvas")) {
          if (!img || c.width * c.height > img.width * img.height) img = c
        }
        if (!img) return 0
        const cv = document.createElement("canvas")
        cv.width = img.width
        cv.height = img.height
        const g = cv.getContext("2d")
        try {
          g.drawImage(img, 0, 0)
        } catch {
          return -1
        }
        const d = g.getImageData(0, 0, cv.width, cv.height).data
        let ink = 0
        for (let i = 0; i < d.length; i += 16) {
          if (d[i + 3] > 8 && (d[i] < 240 || d[i + 1] < 240 || d[i + 2] < 240)) ink++
        }
        return ink
      })
    const STATIONS = [
      [0.3, 18, 10],
      [0.26, 40, 26],
      [0.3, 8, 48],
    ]
    /* Three bands across x, one per station, so the closeups stay spread over the
     * form instead of converging on whichever spot happens to be densest. Five
     * columns and three rows per band, inset a tenth so a candidate is never
     * sitting on the silhouette edge. */
    const halfW = boxSize[0] / 2
    const halfH = boxSize[1] / 2
    const scouted = []
    for (const [k, [dist, az, el]] of STATIONS.entries()) {
      const x0 = bounds.center.x - halfW + (2 * halfW * (k + 0.05)) / 3
      const x1 = bounds.center.x - halfW + (2 * halfW * (k + 0.95)) / 3
      let best = null
      for (let cx = 0; cx < 5; cx++) {
        for (let cy = 0; cy < 3; cy++) {
          const t = {
            x: x0 + ((x1 - x0) * cx) / 4,
            y: bounds.center.y - halfH * 0.8 + (halfH * 1.6 * cy) / 2,
            z: bounds.center.z,
          }
          await page.evaluate(
            ({ t, dist, az, el, R }) => window.__captureHarness.focusView(t, dist * R, az, el),
            { t, dist, az, el, R },
          )
          await page.waitForTimeout(60)
          const ink = await inkNow()
          if (!best || ink > best.ink) best = { t, ink }
        }
      }
      if (!best || best.ink < 200) {
        throw new Error(
          `no candidate in station ${k}'s band of the form's own bounding box put ink in the ` +
            `frame (best ${best ? best.ink : "none"} of 200 needed). Either the form did not ` +
            `build or the box is not the form's — refusing to write a frame of the background.`,
        )
      }
      scouted.push(best)
    }

    for (const [k, [dist, az, el]] of STATIONS.entries()) {
      await page.evaluate(
        ({ t, dist, az, el, R }) => window.__captureHarness.focusView(t, dist * R, az, el),
        { t: scouted[k].t, dist, az, el, R },
      )
      await page.waitForTimeout(140)
      await grab(`closeup_${k}.png`, { requireInk: true })
    }

    /* ── CALIBRATION · THE BLANK GUARD STILL FIRES ────────────────────────────
     * §2.6. The rows above now pass because the camera is aimed at the mesh, and
     * a reader is entitled to ask whether they would pass anyway. So the LAST
     * thing each unit does is aim three radii off the form, at the same distance
     * and the same station, and require `grab({requireInk:true})` to THROW. A
     * run in which it does not throw has a blank guard that cannot see a blank,
     * and every closeup above it is worth nothing.
     *
     * The frame is never written: `grab` checks the ink before `writeFileSync`,
     * so the miss leaves no file to be mistaken for evidence later. */
    let guardFired = false
    await page.evaluate(
      ({ c, R }) =>
        window.__captureHarness.focusView({ x: c.x + 3 * R, y: c.y + 3 * R, z: c.z }, 0.26 * R, 40, 26),
      { c: bounds.center, R },
    )
    await page.waitForTimeout(140)
    try {
      await grab(`__calibration-must-not-exist.png`, { requireInk: true })
    } catch (e) {
      /* ⚠ ONLY THE BLANK GUARD COUNTS. `grab` also throws on a failed data URL
       * and on a dead execution context, and either of those would otherwise
       * read as "the guard fired" — a calibration satisfied by the run falling
       * over is exactly the shape of pass this block exists to refuse. */
      guardFired = /blank frame for/.test(e.message)
      if (!guardFired) throw e
    }
    if (!guardFired) {
      throw new Error(
        "CALIBRATION FAILED — the blank-frame guard did not fire on a camera aimed 3 R off the " +
          "form. It cannot tell a frame of the form from a frame of the background, so the " +
          "closeups it passed are not evidence of anything.",
      )
    }

    let mp4 = null
    try {
      const ffmpeg = (await import("ffmpeg-static")).default
      if (ffmpeg && existsSync(ffmpeg)) {
        mp4 = `${dirFinal}.mp4`
        execFileSync(
          ffmpeg,
          ["-y", "-framerate", "10", "-i", join(dir, "%04d.png"), "-c:v", "libx264",
           "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", mp4],
          { stdio: "ignore" },
        )
      }
    } catch {
      mp4 = null
    }

    /* THE SWAP, after ffmpeg has read the frames out of staging. */
    ev.commit()

    report[name] = {
      jointSpheres: stats.jointSpheres,
      capSpheres: stats.capSpheres,
      // The blind-census tripwire. `stats()` counts a sphere that carries
      // NEITHER part tag here; it was added after the census silently reported
      // zero joints for a whole session (explainer 16 §2) and it was being
      // captured nowhere, so nothing could ever assert on it.
      untagged: stats.untagged,
      meshes: stats.meshes,
      vertices: stats.vertices,
      triangles: stats.triangles,
      bbox: stats.bbox,
      frames: f,
      mp4: mp4 ? mp4.replace(ROOT + "/", "") : null,
      /* WHERE THE CLOSEUPS WERE AIMED, AND THE PROOF THE GUARD CAN STILL SEE A
       * BLANK. Recorded per fixture so a later reader can tell a frame that
       * shows the form from a frame that happened to catch it — the openC
       * closeup shot 2026-07-29 is the reason that distinction is written down.
       * These are FIELDS of the fixture's own row, never sibling keys: `compare`
       * walks `Object.keys(report)` and treats anything without a `__` prefix as
       * a fixture, so a stray `word__focusVerts` would report as a fixture with
       * zero joints. */
      focusInk: scouted.map((b) => b.ink),
      focusTargets: scouted.map((b) => b.t),
      blankGuardFires: guardFired,
    }
    console.log(
      `[joints] ${name.padEnd(8)} joints=${String(stats.jointSpheres).padStart(4)}  caps=${stats.capSpheres}  meshes=${stats.meshes}  verts=${stats.vertices}`,
    )
  }

  for (const name of NAMES) {
    if (!FIXTURES[name]) {
      console.log(`[joints] unknown fixture "${name}" — skipped`)
      continue
    }
    let attempt = 0
    for (;;) {
      attempt++
      try {
        await unit(name)
        break
      } catch (e) {
        // Hot reloads from the other agents live in this tree destroy the
        // execution context mid-run. Retry rather than chase.
        console.log(`[joints] ${name} attempt ${attempt}: ${e.message}`)
        if (attempt >= 4) throw e
        await page.waitForTimeout(3000)
        try {
          await ready()
        } catch {
          await page.waitForTimeout(6000)
        }
      }
    }
  }

  /* ── THE NEGATIVE CONTROL, MEASURED, ON THE DEFAULT PATH ──────────────────
   * A rule that has only ever been seen to pass is not evidence. R3 and R4 are
   * each other's control (a smooth fixture and a cornered one), but R2
   * (caps-complete) and R4 (corners-kept) need an arm where the SPHERES ARE NOT
   * THERE AT ALL — otherwise "26 caps" could be a number this file computes and
   * then compares to itself.
   *
   * `extrude` is that arm, and it is not synthetic: Rod is the only mode that
   * emits cap or joint spheres, so the same word through the same harness in
   * extrude mode must read 0 and 0. If R2/R4 do not go red on it, they are not
   * reading the render.
   *
   * No frames are written for the control — it is one stats() read after a mode
   * switch, so it costs about a second. Cheap enough to live on the default path,
   * which is the only place a control does any good. */
  try {
    await page.evaluate(() => window.__styleHarness.clearStrokes())
    await page.waitForTimeout(200)
    await page.evaluate((poly) => window.__styleHarness.injectStrokes(poly, { msPerPoint: 10 }), FIXTURES.word())
    await page.waitForTimeout(700)
    await page.evaluate(() => window.__styleHarness.setMode("extrude"))
    await page.waitForTimeout(900)
    await page.evaluate(() => window.__revealHarness.setProgress(1))
    await page.waitForTimeout(400)
    const mode = await page.evaluate(() => window.__styleHarness.get().geometryMode)
    const s = await page.evaluate(() => window.__geomDebug.stats())
    report.__control = {
      fixture: "word",
      mode,
      capSpheres: s.capSpheres,
      jointSpheres: s.jointSpheres,
      untagged: s.untagged,
      meshes: s.meshes,
    }
    console.log(
      `[joints] control  word/${mode}  joints=${s.jointSpheres}  caps=${s.capSpheres}  untagged=${s.untagged}  meshes=${s.meshes}`,
    )
  } catch (e) {
    report.__control = { error: String(e).slice(0, 200) }
    console.log(`[joints] control FAILED TO CAPTURE — ${String(e).slice(0, 120)}`)
  }

  report.__consoleErrors = errors.length
  report.__material = MATERIAL
  writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2))
  await browser.close()
  console.log(`\n[joints] saved '${label}' (console errors: ${errors.length})`)
}

function compare(a, b) {
  const ra = JSON.parse(readFileSync(join(BASE, a, "report.json"), "utf8"))
  const rb = JSON.parse(readFileSync(join(BASE, b, "report.json"), "utf8"))
  // The two signs of the effect. `zigzag` is the guard: its corners are real,
  // so its beads must NOT be swept away with the spurious ones.
  const MUST_FALL = ["word", "loopyS", "openC"]
  const MUST_HOLD = ["zigzag"]
  let fails = 0
  console.log(`\nfixture     joints ${a} -> ${b}`)
  for (const k of Object.keys(ra)) {
    if (k.startsWith("__")) continue
    const x = ra[k]?.jointSpheres ?? 0
    const y = rb[k]?.jointSpheres ?? 0
    let verdict = ""
    if (MUST_FALL.includes(k)) {
      if (y < x) verdict = "  OK (spurious beads down)"
      else { verdict = "  *** FAIL: spurious beads did not fall ***"; fails++ }
    }
    if (MUST_HOLD.includes(k)) {
      if (y >= 1 && y >= Math.min(x, 7) * 0.7) verdict = "  OK (real corners kept)"
      else { verdict = "  *** FAIL: real corners lost their joints ***"; fails++ }
    }
    console.log(`${k.padEnd(11)} ${String(x).padStart(4)} -> ${String(y).padStart(4)}${verdict}`)
  }
  console.log(fails === 0 ? "\nPASS — both signs hold." : `\n${fails} FAILURE(S).`)
  process.exit(fails === 0 ? 0 : 1)
}

/**
 * HOLD-STEADY comparison — the other question, which `--compare` cannot ask.
 *
 * `--compare` asserts that a FIX landed: spurious beads must FALL and real ones
 * must survive. Run it on two labels that are both already fixed and it reports
 * "spurious beads did not fall" three times, because nothing fell — a clean
 * no-regression result that reads exactly like a broken one. That is the same
 * trap as every instrument in explainer 13, one level up: the comparator was
 * derived for a before/after pair and consumed on an after/after pair.
 *
 * So a later pass that touches OTHER engines and needs to prove Rod is
 * untouched asks this instead: every fixture's bead count must be EQUAL to the
 * reference, in both directions at once — the smooth fixtures still at their
 * floor, `zigzag` still at seven. Any drift either way is a failure.
 */
function holdSteady(a, b) {
  const ra = JSON.parse(readFileSync(join(BASE, a, "report.json"), "utf8"))
  const rb = JSON.parse(readFileSync(join(BASE, b, "report.json"), "utf8"))
  let fails = 0
  console.log(`\nfixture     joints ${a} -> ${b}   (must be UNCHANGED)`)
  for (const k of Object.keys(ra)) {
    if (k.startsWith("__")) continue
    const x = ra[k]?.jointSpheres ?? 0
    const y = rb[k]?.jointSpheres ?? 0
    const ok = x === y
    if (!ok) fails++
    console.log(
      `${k.padEnd(11)} ${String(x).padStart(4)} -> ${String(y).padStart(4)}` +
        (ok ? "  OK (held)" : "  *** FAIL: bead count moved ***"),
    )
  }
  console.log(fails === 0 ? "\nPASS — Rod's beading is unchanged." : `\n${fails} FAILURE(S).`)
  process.exit(fails === 0 ? 0 : 1)
}

/* ══════════════════════════════════════════════════════════════════════════
 * THE DEFAULT PATH JUDGES.
 *
 * THE ORACLE, and why it is not the previous run.
 *
 *   A bead belongs at a HARD CORNER and nowhere else. "Hard corner" is not an
 *   opinion here: `lib/geometry-engines.ts` exports `JOINT_ANGLE_THRESHOLD_DEG`
 *   (40°) and `detectJoints3D` fires when the turn between consecutive samples
 *   exceeds it. So the expected count for a fixture is a property OF THE
 *   FIXTURE — count its interior vertices whose turn exceeds that angle — and it
 *   can be computed in node, from the same polylines the browser is handed,
 *   before the browser is even launched.
 *
 *   That is what makes this an assertion rather than a regression diff. A diff
 *   against `before` can only say "it did not change"; two runs of a broken
 *   engine agree perfectly. The oracle says what the number SHOULD be.
 *
 *   The threshold is IMPORTED, never re-typed — if someone retunes the engine's
 *   40°, this file's expectations move with it, and a re-typed constant would
 *   silently keep asserting the old one.
 *
 * FOUR RULES, and the two directions they have to hold in.
 *
 *   R1 census-alive   `untagged` must be exactly ONE PER STROKE, and the three
 *                     buckets must sum to `meshes`. The joint census has ALREADY
 *                     gone structurally blind once (explainer 16 §2: it
 *                     separated caps from joints by vertex count, the two
 *                     tessellations were unified, the `else if` became
 *                     unreachable and `jointSpheres` was permanently 0 — a clean
 *                     zero that read like a fix). `untagged` exists to make that
 *                     visible; if nobody asserts on it, it is decoration.
 *                     ⚠ The floor is ONE PER STROKE, not zero: `stats()` walks
 *                     every mesh in the export group and the TUBE carries no
 *                     part tag. Asserting `untagged === 0` is what this file did
 *                     first and it failed on all four fixtures — a false red, and
 *                     the reason the number is derived from the fixture instead.
 *   R2 caps-complete  exactly two cap spheres per OPEN stroke, and none on a
 *                     closed one. Closure is read off the fixture (endpoint gap
 *                     under 5 % of the stroke's own bbox diagonal — a
 *                     shape-relative test, so it needs no unit conversion into
 *                     world space), which makes this the assertion that the
 *                     closed-loop cap suppression at `geometry-engines.ts:1466`
 *                     is still holding. That line is load-bearing: before it,
 *                     `circle/rod` threw 479 uncaught exceptions per load with
 *                     the canvas frozen.
 *   R3 smooth-clean   a fixture with NO corner above the threshold gets NO
 *                     beads. `loopyS` (a sine) and `openC` (a circular arc) are
 *                     smooth BY CONSTRUCTION, and the oracle says so out loud
 *                     rather than assuming it.
 *   R4 corners-kept   a fixture WITH corners keeps them. This is the half a
 *                     "fix" that just stops stamping would break, and the half
 *                     the original file's own comment says is the point.
 *
 * THE NEGATIVE CONTROL IS THE CROSS-PRODUCT, not a synthetic input.
 *
 *   R3 and R4 pull in opposite directions, so each is the other's control: R3
 *   applied to `zigzag` MUST fail (seven real corners are not zero) and R4
 *   applied to `openC` MUST fail (an arc has no corners to keep). The matrix is
 *   evaluated on the SAME measurements the verdict is built from, so a run where
 *   the instrument has gone blind — every count zero, or every count huge —
 *   cannot produce a clean matrix. A rule that passes everywhere is not a rule.
 * ═════════════════════════════════════════════════════════════════════════ */

const { JOINT_ANGLE_THRESHOLD_DEG } = loadTs("lib/geometry-engines.ts")

/** Interior vertices whose turn exceeds the engine's own joint threshold, plus
 *  how many of the strokes are CLOSED loops (which get no end caps). */
function oracleFor(polylines) {
  const lim = (JOINT_ANGLE_THRESHOLD_DEG * Math.PI) / 180
  let n = 0
  let maxTurn = 0
  let closed = 0
  for (const pl of polylines) {
    for (let i = 1; i < pl.length - 1; i++) {
      const ax = pl[i].x - pl[i - 1].x, ay = pl[i].y - pl[i - 1].y
      const bx = pl[i + 1].x - pl[i].x, by = pl[i + 1].y - pl[i].y
      const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by)
      if (la < 1e-9 || lb < 1e-9) continue
      const turn = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb))))
      if (turn > maxTurn) maxTurn = turn
      if (turn > lim) n++
    }
    let lo = [Infinity, Infinity], hi = [-Infinity, -Infinity]
    for (const p of pl) {
      lo = [Math.min(lo[0], p.x), Math.min(lo[1], p.y)]
      hi = [Math.max(hi[0], p.x), Math.max(hi[1], p.y)]
    }
    const diag = Math.hypot(hi[0] - lo[0], hi[1] - lo[1])
    const gap = Math.hypot(pl[0].x - pl[pl.length - 1].x, pl[0].y - pl[pl.length - 1].y)
    if (diag > 1e-9 && gap / diag < 0.05) closed++
  }
  return {
    corners: n,
    maxTurnDeg: (maxTurn * 180) / Math.PI,
    strokes: polylines.length,
    closed,
    open: polylines.length - closed,
  }
}

function judge(label) {
  const report = JSON.parse(readFileSync(join(BASE, label, "report.json"), "utf8"))
  let fails = 0
  const say = (ok, name, detail) => {
    if (!ok) fails++
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`)
  }

  console.log("\n=== the oracle, computed from the fixtures in node ===")
  const oracle = {}
  for (const name of NAMES) {
    if (!FIXTURES[name]) continue
    const h = oracleFor(FIXTURES[name]())
    oracle[name] = h
    console.log(
      `  ${name.padEnd(8)} ${String(h.strokes).padStart(3)} stroke(s) ` +
        `(${h.open} open, ${h.closed} closed)   ` +
        `${String(h.corners).padStart(3)} corner(s) over ${JOINT_ANGLE_THRESHOLD_DEG}°   ` +
        `max turn ${h.maxTurnDeg.toFixed(1)}°`,
    )
  }

  console.log("\n=== verdicts ===")

  // R1 — the census must still be able to see. A blind census reports zeros.
  for (const name of NAMES) {
    const r = report[name]
    if (!r) continue
    const want = oracle[name].strokes
    say(
      r.untagged === want,
      `${name} / census-alive: exactly one untagged mesh (the tube) per stroke`,
      r.untagged === undefined
        ? "MISSING — __geomDebug.stats() has no untagged field"
        : `untagged ${r.untagged} for ${want} strokes` +
          (r.untagged > want ? " — A TAGGED PASS HAS LOST ITS TAG" : ""),
    )
    say(
      r.capSpheres + r.jointSpheres + r.untagged === r.meshes,
      `${name} / census-complete: the three buckets sum to the mesh count`,
      `${r.capSpheres} + ${r.jointSpheres} + ${r.untagged} = ${r.capSpheres + r.jointSpheres + r.untagged} vs meshes ${r.meshes}`,
    )
  }

  // R2 — two caps per OPEN stroke, none on a closed loop.
  for (const name of NAMES) {
    const r = report[name]
    if (!r) continue
    const want = oracle[name].open * 2
    say(
      r.capSpheres === want,
      `${name} / caps-complete: two per OPEN stroke, none on a closed loop`,
      `${r.capSpheres} caps for ${oracle[name].open} open + ${oracle[name].closed} closed (want ${want})`,
    )
  }

  /* R3 / R4 as a MATRIX. `rule(name)` returns the verdict of applying that rule
   * to that fixture; the assertion is that each rule holds where the geometry
   * says it should and BREAKS where it should not. */
  const smoothClean = (name) => (report[name]?.jointSpheres ?? -1) === 0
  const cornersKept = (name) => {
    const got = report[name]?.jointSpheres ?? -1
    const want = oracle[name].corners
    return want > 0 && got >= Math.ceil(want * 0.7) && got <= want
  }
  const SMOOTH = NAMES.filter((n) => oracle[n] && oracle[n].corners === 0)
  const CORNERED = NAMES.filter((n) => oracle[n] && oracle[n].corners > 0)

  for (const name of SMOOTH) {
    say(smoothClean(name), `${name} / smooth-clean: no corner over ${JOINT_ANGLE_THRESHOLD_DEG}°, so no bead`,
      `joints ${report[name]?.jointSpheres} (max turn ${oracle[name].maxTurnDeg.toFixed(1)}°)`)
  }
  for (const name of CORNERED) {
    say(cornersKept(name), `${name} / corners-kept: its real corners still get a bead`,
      `joints ${report[name]?.jointSpheres} of ${oracle[name].corners} corners`)
  }

  console.log("\n=== the control matrix — each rule must FAIL where it does not belong ===")
  for (const name of CORNERED) {
    say(!smoothClean(name), `control: smooth-clean REJECTS ${name}`,
      `${oracle[name].corners} real corners, joints ${report[name]?.jointSpheres} — a rule that passed here would be blind`)
  }
  for (const name of SMOOTH) {
    say(!cornersKept(name), `control: corners-kept REJECTS ${name}`,
      `no corners to keep, joints ${report[name]?.jointSpheres} — a rule that passed here would be vacuous`)
  }

  /* The measured arm where the spheres do not exist. R2 and R4 must both go red
   * on it, or they are arithmetic this file is doing against itself. */
  const ctl = report.__control
  if (!ctl || ctl.error) {
    say(false, "control: the extrude arm was captured", ctl?.error ?? "missing from the report")
  } else {
    const wantCaps = oracle[ctl.fixture].open * 2
    say(ctl.mode === "extrude", "control: the extrude arm really is on extrude", `mode ${ctl.mode}`)
    say(
      ctl.capSpheres !== wantCaps,
      "control: caps-complete REJECTS the extrude arm",
      `extrude emits ${ctl.capSpheres} caps against rod's ${wantCaps} — the rule reads the render, not the oracle`,
    )
    say(
      !(ctl.jointSpheres >= Math.ceil(oracle[ctl.fixture].corners * 0.7)),
      "control: corners-kept REJECTS the extrude arm",
      `extrude emits ${ctl.jointSpheres} joints where rod needs ${oracle[ctl.fixture].corners}`,
    )
    say(
      ctl.capSpheres + ctl.jointSpheres + ctl.untagged === ctl.meshes,
      "control: census-complete still HOLDS on the extrude arm (a structural invariant, not a rod fact)",
      `${ctl.capSpheres} + ${ctl.jointSpheres} + ${ctl.untagged} = ${ctl.meshes}`,
    )
  }

  const ce = report.__consoleErrors ?? 0
  say(ce === 0, "console errors during capture", String(ce))

  console.log(
    fails === 0
      ? "\nALL JOINT-BEADING ASSERTIONS PASS — measured on THIS tree, not on a stored label."
      : `\n${fails} JOINT-BEADING FAILURE(S).`,
  )
  return fails
}

const cmp = arg("compare", "")
const hold = arg("holdsteady", "")
if (hold) {
  const [a, b] = hold.split(",")
  if (!existsSync(join(BASE, a)) || !existsSync(join(BASE, b))) {
    console.error(`missing run: need ${a} and ${b} under ${BASE}`)
    process.exit(1)
  }
  holdSteady(a, b)
} else if (cmp) {
  const [a, b] = cmp.split(",")
  if (!existsSync(join(BASE, a)) || !existsSync(join(BASE, b))) {
    console.error(`missing run: need ${a} and ${b} under ${BASE}`)
    process.exit(1)
  }
  compare(a, b)
} else {
  capture(LABEL)
    .then(() => {
      // THE EXIT CODE CARRIES THE VERDICT. Without this line the whole file is
      // a capture: it printed numbers and exited 0 whatever they said.
      process.exit(judge(LABEL) === 0 ? 0 : 1)
    })
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
