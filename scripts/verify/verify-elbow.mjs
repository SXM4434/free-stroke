// ELBOW CAPTURE — the four drawn corners of `square/inflate`, close enough to see.
//
// `assert-elbow.mjs` proves the loft self-intersects there and that routing to
// the field removes it. The census CANNOT see a fold — `min(acos d, acos -d)`
// scores a flap turned back through itself as a SMALL crease — and explainer 17
// §2 records a whole defect (the extrude seam flap) that every number called
// clean and one frame called broken. So the numbers get a picture beside them.
//
// FRAMING. The whole-form orbit resolves nothing here: the fold measured 0.158
// of one tube radius, which on a 390 px square is about two pixels. Each corner
// is framed individually via `__captureHarness.focusView` at a few radii, at
// three elevations, so the elbow is read from along the plane (where a fold
// breaks the silhouette) and from above (where it breaks the highlight).
//
// glossyPlastic, never softGel: a broad sheen lobe averages over a normal
// discontinuity instead of tracing it, which is how this class of defect
// survived as Inflate's default material.
//
// --orbit — AND WHY A STILL IS NOT ENOUGH. A fold is a motion defect as much as
// a still one: as the camera comes round, the second sheet SWIMS through the
// first, and the crossing line travels across the elbow. In a still that
// crossing is one dark seam you can argue is a crease; over 72 frames it is a
// sheet moving independently of the surface it is part of, which nothing else
// looks like. `--orbit` sweeps the full 360 degrees of azimuth about one corner
// at a fixed elevation, writes the frames, and encodes an mp4 beside them. Run
// it on BOTH cases so the loft's swim and the routed surface's stillness sit
// next to each other.
//
// Usage: node scripts/verify/verify-elbow.mjs --label=after [--cases=loft,auto]
//                                             [--orbit] [--orbitCorners=1]
//                                             [--orbitEl=22] [--orbitSteps=72]
// Output: docs/verification/elbow/<label>/frames/<case>_c<corner>_<view>.png
//         docs/verification/elbow/<label>/orbit/<case>_c<corner>/%04d.png + .mp4
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { frameInk } from "./lib/frame-ink.mjs"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "elbow")
const CASES = arg("cases", "loft,auto").split(",")
const ORBIT = process.argv.includes("--orbit")
// Corner 1 by default: a DRAWN corner, i.e. the elbow itself. Corner 0 is the
// seam, which is a different question (assert-seam.mjs owns it) — pass
// `--orbitCorners=0,1` to film both.
const ORBIT_CORNERS = arg("orbitCorners", "1").split(",").map(Number)
const ORBIT_EL = Number(arg("orbitEl", "22"))
const ORBIT_STEPS = Number(arg("orbitSteps", "72"))
const OUT = join(ROOT, "docs", "verification", "elbow", LABEL, "frames")
const ORBIT_OUT = join(ROOT, "docs", "verification", "elbow", LABEL, "orbit")

const VIEW = { width: 1300, height: 850 }
const CW = VIEW.width / 2
const CH = VIEW.height - 48
const SCALE = 3.0 / Math.max(CW, CH)
const px2w = (px, py) => ({ x: (px - CW / 2) * SCALE, y: -(py - CH / 2) * SCALE })

const SQUARE_PX = [[250, 180], [640, 180], [640, 545], [250, 545]]
const squareShape = () => {
  const p = []
  const c = [...SQUARE_PX, SQUARE_PX[0]]
  for (let k = 0; k < c.length - 1; k++) {
    const [x0, y0] = c[k]
    const [x1, y1] = c[k + 1]
    for (let i = 0; i < 30; i++) p.push({ x: x0 + ((x1 - x0) * i) / 30, y: y0 + ((y1 - y0) * i) / 30 })
  }
  p.push({ x: 250, y: 180 })
  return [p]
}

const parse = (name) => {
  if (name === "loft") return { fusion: "loft" }
  if (name === "auto") return { fusion: "auto" }
  const m = name.match(/implicit-b([\d.]+)-r([\d.]+)/)
  return { fusion: "implicit", blend: Number(m[1]), resolution: Number(m[2]) }
}

// Three views per corner. `flat` looks along the drawing plane, where a fold
// breaks the SILHOUETTE; `high` looks down, where it breaks the HIGHLIGHT;
// `raking` is the shallow angle that stretches a specular streak across the
// elbow, which is what makes a crease read as die-cut.
const VIEWS = [
  ["flat", 0, 6],
  ["high", 0, 62],
  ["raking", 38, 22],
]

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: VIEW })
  const consoleErrors = []
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160))
  })
  // UNCAUGHT exceptions never reach the `console` channel. This script reported
  // "console errors: 2" while the page was throwing out of `useFrame` 100+ times
  // per run — a surface no frame should be captured from, and nothing said so.
  const pageErrors = []
  page.on("pageerror", (e) => {
    const s = (e.stack || String(e)).split("\n").slice(0, 2).join(" | ").slice(0, 220)
    if (!pageErrors.includes(s)) pageErrors.push(s)
  })
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(
    () => window.__styleHarness && window.__captureHarness && window.__geomDebug,
    null,
    { timeout: 60000 },
  )

  await page.evaluate(() => window.__styleHarness.clearStrokes())
  await page.waitForTimeout(200)
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 10 }), squareShape())
  await page.waitForTimeout(900)
  await page.evaluate(() => window.__styleHarness.setMode("inflate"))
  await page.waitForTimeout(1400)
  await page.evaluate(() => window.__styleHarness.setMaterial("glossyPlastic"))
  await page.waitForTimeout(300)
  // Read the material BACK. `setMode` stamps MODE_MATERIAL_DEFAULTS, so a
  // setMaterial that lands first is silently reverted, and this project has
  // already shipped one harness that "passed" while its clicks hit nothing.
  const mat = await page.evaluate(() => window.__styleHarness.get().styleState.materialPreset)
  if (mat !== "glossyPlastic") {
    console.log(`FAIL material did not take: ${mat}`)
    await browser.close()
    process.exit(1)
  }
  await page.evaluate(() => window.__revealHarness.setProgress(1))
  await page.waitForTimeout(400)

  mkdirSync(OUT, { recursive: true })
  const corners = SQUARE_PX.map(([px, py]) => px2w(px, py))
  const manifest = []

  /* BLANK-FRAME GUARD, on the bytes being saved.
   *
   * The version this replaces ran IN THE PAGE, walked `querySelectorAll
   * ("canvas")`, took the largest and counted its pixels — and on this page the
   * largest canvas is the 2-D DRAWING canvas, not the 3-D one
   * `__captureHarness.grab()` returns. It reported ink=863 on twelve
   * consecutive captures of four different builds at three different camera
   * positions, three of which were EMPTY 3-D renders, and passed all twelve.
   * A guard that cannot fail is the lie. See lib/frame-ink.mjs.
   *
   * The floor is read off the measurement, not tuned: the studio grid alone
   * scores ~12,900 at this viewport and a framed corner scores 20,000-57,000. */
  const INK_FLOOR = 15000
  const grab = async (file, dir = OUT) => {
    const url = await page.evaluate(() => window.__captureHarness.grab())
    const m = (url || "").match(/base64,(.+)/)
    if (!m) throw new Error(`grab failed for ${file}`)
    const buf = Buffer.from(m[1], "base64")
    const { ink } = await frameInk(buf)
    if (ink < INK_FLOOR) {
      throw new Error(
        `EMPTY frame for ${file} (ink=${ink} < ${INK_FLOOR}) — the camera is not on the corner, ` +
          `or the render loop is frozen. Do not lower the floor; find out which.`,
      )
    }
    writeFileSync(join(dir, file), buf)
    return ink
  }

  for (const name of CASES) {
    await page.evaluate((p) => window.__styleHarness.setInflate(p), parse(name))
    await page.waitForTimeout(2600)
    const dbg = await page.evaluate(() => window.__inflateProbe?.debug?.() ?? null)
    const r = dbg?.fieldBaseRadius || 0.05
    console.log(
      `\n[${name}] requested=${dbg?.fusionRequested} used=${dbg?.fusionUsed} ` +
        `foldPairs=${dbg?.loftFoldingPairs} foldOverR=${dbg?.loftFoldOverR?.toFixed(4)} build=${dbg?.msBuildTotal?.toFixed(0)}ms`,
    )
    for (let ci = 0; ci < corners.length; ci++) {
      const c = corners[ci]
      for (const [vname, az, el] of VIEWS) {
        await page.evaluate(
          ({ c, dist, az, el }) => window.__captureHarness.focusView({ x: c.x, y: c.y, z: 0 }, dist, az, el),
          { c, dist: r * 7, az, el },
        )
        await page.waitForTimeout(140)
        const file = `${name}_c${ci}_${vname}.png`
        const ink = await grab(file)
        manifest.push({ case: name, corner: ci, view: vname, file, ink, fusionUsed: dbg?.fusionUsed })
      }
    }
    console.log(`   wrote 12 frames`)

    if (ORBIT) {
      for (const ci of ORBIT_CORNERS) {
        const c = corners[ci]
        const dir = join(ORBIT_OUT, `${name}_c${ci}`)
        mkdirSync(dir, { recursive: true })
        // Every frame goes through the same blank-frame guard as the stills, so
        // a camera that lost the corner mid-sweep fails the run instead of
        // encoding 72 empty frames into something that looks like a film.
        let minInk = Infinity
        for (let i = 0; i < ORBIT_STEPS; i++) {
          const az = (360 * i) / ORBIT_STEPS
          await page.evaluate(
            ({ c, dist, az, el }) => window.__captureHarness.focusView({ x: c.x, y: c.y, z: 0 }, dist, az, el),
            { c, dist: r * 7, az, el: ORBIT_EL },
          )
          await page.waitForTimeout(110)
          const ink = await grab(`${String(i).padStart(4, "0")}.png`, dir)
          if (ink !== null && ink < minInk) minInk = ink
        }
        let mp4 = null
        try {
          mp4 = join(ORBIT_OUT, `${name}_c${ci}.mp4`)
          execFileSync(
            "ffmpeg",
            [
              "-y", "-framerate", "24",
              "-i", join(dir, "%04d.png"),
              "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18",
              "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
              mp4,
            ],
            { stdio: "ignore" },
          )
        } catch {
          console.log(`   ffmpeg failed for ${name}_c${ci} (frames still on disk)`)
          mp4 = null
        }
        console.log(`   orbit ${name} corner ${ci}: ${ORBIT_STEPS} frames at elevation ${ORBIT_EL}, min ink ${minInk}${mp4 ? `, ${mp4}` : ""}`)
        manifest.push({ case: name, corner: ci, view: "orbit", file: `orbit/${name}_c${ci}.mp4`, frames: ORBIT_STEPS, minInk, fusionUsed: dbg?.fusionUsed })
      }
    }
  }

  writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2))
  console.log(`\nwrote ${OUT}`)
  console.log(`console errors: ${consoleErrors.length}`)
  console.log(`UNCAUGHT page errors (distinct): ${pageErrors.length}`)
  for (const e of pageErrors.slice(0, 4)) console.log(`  ${e}`)
  await browser.close()
  if (pageErrors.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
