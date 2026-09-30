// ENGINE A/B — Free Stroke's geometry engine vs the ported Desk Doodles one.
//
// The port (lib/dd-engine/) exists to be JUDGED, not asserted. This script
// captures the two engines under conditions that are identical in every
// respect except which codebase built the geometry: same strokes, same mode,
// same camera path, same lights, same material — one variable.
//
// WHY GLOSS, NOT MATTE
//
// Specular reflection is a derivative operator on the normal field. A matte
// surface integrates incoming light over the hemisphere, so a normal
// discontinuity moves the shaded value by a few percent; a glossy surface
// mirrors a small solid angle, so the SAME discontinuity swings it 0 -> 1 in
// one pixel. Every complaint in the brief — ball joints stamped at ends and
// bends, ring banding traced like screw threading along the tube, "the edges
// and overlaps get weird" — is a normal-field defect, so matte is the register
// that HIDES the thing under test. This is the same reasoning
// verify-gloss-rim.mjs was written on, and it is how the Rod ring-banding was
// found in the first place.
//
// ORDERING TRAP (inherited from verify-gloss-rim, do not reorder)
//   `setMaterial` sets materialUserOverride, and `setMode` stamps
//   MODE_MATERIAL_DEFAULTS over anything that is not overridden. So material
//   must be set AFTER mode, and read back — this project has already shipped a
//   harness that "passed" while its clicks landed on nothing.
//
// Usage:
//   node scripts/verify/verify-engine-ab.mjs --label=run1
//   node scripts/verify/verify-engine-ab.mjs --label=quick --modes=rod --shapes=word --az=8
// Output (durable, NOT /tmp):
//   docs/verification/engine-ab/<label>/<shape>_<mode>_<engine>/*.png + .mp4
//   docs/verification/engine-ab/<label>/manifest.json
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync, existsSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { layoutWord } from "../capture/letters.mjs"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"
import { stageEvidence } from "./lib/evidence-swap.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "run")
const MODES = arg("modes", "rod,extrude,solid,inflate").split(",")
const ENGINES = arg("engines", "free-stroke,desk-doodles").split(",")
const AZ_STEPS = parseInt(arg("az", "16"), 10)
const MATERIAL = arg("material", "glossyPlastic")
const OUT = join(ROOT, "docs", "verification", "engine-ab", LABEL)

/**
 * The acceptance fixture is the literal word from the brief: "Desk Doodles"
 * has to read as ink laid down by a hand, not extruded pipe. The rest are the
 * geometry cases that historically broke something — a closed loop (does
 * either engine fill it, and how does the rim read), a hard corner (does the
 * corner survive smoothing) and a crossing (how does the overlap resolve).
 */
const SHAPES = {
  word: () => {
    const { polylines, width } = layoutWord("Desk Doodles", { x: 0, y: 0, size: 118, tracking: 12 })
    const k = 760 / width
    return polylines.map((pl) => pl.map((p) => ({ x: 70 + p.x * k, y: 300 + p.y * k })))
  },
  circle: () => {
    const p = []
    for (let i = 0; i <= 160; i++) {
      const t = (i / 160) * Math.PI * 2
      p.push({ x: 440 + Math.cos(t) * 210, y: 360 + Math.sin(t) * 210 })
    }
    return [p]
  },
  square: () => {
    const p = []
    const corners = [
      [250, 180],
      [640, 180],
      [640, 545],
      [250, 545],
      [250, 180],
    ]
    for (let c = 0; c < corners.length - 1; c++) {
      const [x0, y0] = corners[c]
      const [x1, y1] = corners[c + 1]
      for (let i = 0; i < 30; i++) {
        p.push({ x: x0 + ((x1 - x0) * i) / 30, y: y0 + ((y1 - y0) * i) / 30 })
      }
    }
    p.push({ x: 250, y: 180 })
    return [p]
  },
  crossing: () => {
    const a = []
    const b = []
    for (let i = 0; i <= 90; i++) {
      const t = i / 90
      a.push({ x: 140 + t * 620, y: 250 + t * 190 })
      b.push({ x: 140 + t * 620, y: 470 - t * 190 })
    }
    return [a, b]
  },
  /**
   * ONE short stroke, so the whole frame is a single mark and the two defects
   * named in the brief are actually resolvable: a spherical joint bead stamped
   * at a bend and at the ends, and ring banding along the tube that a glossy
   * surface traces like screw threading. Both are ~1% of a word's width and
   * invisible in any whole-word frame, which is why they kept surviving
   * captures. Shape: a long straight run (banding shows on a straight run,
   * where nothing else is happening), one hard ~90-degree corner (the joint),
   * then a gentle curve out to a free end (the cap).
   */
  bend: () => {
    const p = []
    for (let i = 0; i <= 60; i++) p.push({ x: 180 + (i / 60) * 340, y: 200 })
    for (let i = 1; i <= 40; i++) p.push({ x: 520, y: 200 + (i / 40) * 240 })
    for (let i = 1; i <= 40; i++) {
      const t = (i / 40) * (Math.PI / 2)
      p.push({ x: 520 + Math.sin(t) * 170, y: 440 + (1 - Math.cos(t)) * 90 })
    }
    return [p]
  },
}
const SHAPE_NAMES = arg("shapes", Object.keys(SHAPES).join(",")).split(",")

// Same three elevations as the gloss-rim capture so these frames can be read
// beside that run rather than being their own universe.
//   8  — grazing; a hard cap/wall crease shows as a terminator line.
//   26 — the working three-quarter read.
//   50 — cap-dominant; shows whether a cap edge is a cut or a roll.
const ELEVATIONS = [8, 26, 50]

async function main() {
  // STANDING RULE: never headless. Headless silently pauses the rAF loop on
  // this machine, and SwiftShader freezes rotateY outright, so a headless run
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
      () => window.__styleHarness && window.__captureHarness && window.__revealHarness,
      null,
      { timeout: 60000 },
    )
    await page.evaluate(() => window.__captureHarness.enable())
    await page.waitForTimeout(300)
  }
  await ready()

  const manifest = []
  const failed = []

  async function captureUnit(shapeName, shapeFn, mode, engine, dirFinal) {
    /* STAGED PER UNIT. `engine-ab` holds 1844 tracked files and this
     * wipe used to empty one shape/mode/engine directory before spending minutes refilling it.
     * A run that dies mid-unit now leaves that unit's stored frames alone; every
     * unit already finished stays finished. lib/evidence-swap.mjs. */
    const ev = stageEvidence(dirFinal)
    const dir = ev.open()

    await page.evaluate(() => window.__styleHarness.clearStrokes())
    await page.waitForTimeout(200)
    await page.evaluate((poly) => {
      window.__styleHarness.injectStrokes(poly, { msPerPoint: 10 })
    }, shapeFn())
    await page.waitForTimeout(700)
    await page.evaluate((m) => window.__styleHarness.setMode(m), mode)
    await page.waitForTimeout(900)
    await page.evaluate((e) => window.__styleHarness.setEngine(e), engine)
    await page.waitForTimeout(1200)
    await page.evaluate((mat) => window.__styleHarness.setMaterial(mat), MATERIAL)
    await page.waitForTimeout(700)

    // Read BOTH back. A capture that ran on the wrong engine or the wrong
    // material is worse than no capture — it looks like evidence.
    const state = await page.evaluate(() => {
      const g = window.__styleHarness.get()
      return { material: g.styleState.materialPreset, engine: g.engineFamily, mode: g.geometryMode }
    })
    if (state.material !== MATERIAL) throw new Error(`material did not take: ${state.material}`)
    if (state.engine !== engine) throw new Error(`engine did not take: ${state.engine}`)
    if (state.mode !== mode) throw new Error(`mode did not take: ${state.mode}`)

    await page.evaluate(() => window.__revealHarness.setProgress(1))
    await page.waitForTimeout(500)

    const grab = async (file) => {
      const url = await page.evaluate(() => window.__captureHarness.grab())
      const m = (url || "").match(/base64,(.+)/)
      if (!m) throw new Error("grab failed")
      writeFileSync(join(dir, file), Buffer.from(m[1], "base64"))
    }

    let f = 0
    for (const el of ELEVATIONS) {
      for (let i = 0; i < AZ_STEPS; i++) {
        const az = (360 * i) / AZ_STEPS
        await page.evaluate(({ az, el }) => window.__captureHarness.orbitView(az, el, 0.92), {
          az,
          el,
        })
        await page.waitForTimeout(90)
        await grab(`${String(f).padStart(4, "0")}.png`)
        f++
      }
    }

    // CLOSE-UPS. A whole-form orbit cannot resolve a joint bead or a ring band
    // that is ~1% of the form's width, and those are exactly the two defects
    // named in the brief. Small fill factor keeps the harness's own bounds
    // centre and just moves the camera in.
    for (const [k, [az, el, fill]] of [
      [0, [18, 10, 0.26]],
      [1, [40, 26, 0.26]],
      [2, [8, 48, 0.26]],
    ].entries()) {
      await page.evaluate(({ az, el, fill }) => window.__captureHarness.orbitView(az, el, fill), {
        az,
        el,
        fill,
      })
      await page.waitForTimeout(140)
      await grab(`closeup_${k}.png`)
    }

    const stats = await page.evaluate(() => {
      const d = window.__geomDebug
      return d ? { meshCount: d.meshCount?.(), buildCount: d.buildCount?.() } : null
    })

    // VIDEO as well as stills — durable, under docs/verification/.
    let mp4 = null
    try {
      const ffmpeg = (await import("ffmpeg-static")).default
      if (ffmpeg && existsSync(ffmpeg)) {
        mp4 = `${dirFinal}.mp4`
        execFileSync(
          ffmpeg,
          [
            "-y",
            "-framerate",
            "12",
            "-i",
            join(dir, "%04d.png"),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-vf",
            "scale=trunc(iw/2)*2:trunc(ih/2)*2",
            mp4,
          ],
          { stdio: "ignore" },
        )
      }
    } catch (e) {
      mp4 = null
    }

    /* THE SWAP, after ffmpeg has read the frames out of staging. The manifest
     * records where the frames LANDED, never the staging path. */
    ev.commit()
    manifest.push({ shape: shapeName, mode, engine, frames: f, dir: dirFinal, mp4, stats })
    console.log(`[ab] ${shapeName}/${mode}/${engine} — ${f} frames${mp4 ? " + mp4" : ""}`)
  }

  for (const shapeName of SHAPE_NAMES) {
    const shapeFn = SHAPES[shapeName]
    if (!shapeFn) {
      console.log(`[ab] unknown shape "${shapeName}" — skipped`)
      continue
    }
    for (const mode of MODES) {
      for (const engine of ENGINES) {
        const dir = join(OUT, `${shapeName}_${mode}_${engine}`)
        let attempt = 0
        for (;;) {
          attempt++
          try {
            await captureUnit(shapeName, shapeFn, mode, engine, dir)
            break
          } catch (e) {
            console.log(`[ab] ${shapeName}/${mode}/${engine} attempt ${attempt}: ${e.message}`)
            if (attempt >= 4) {
              failed.push(`${shapeName}/${mode}/${engine}`)
              break
            }
            await page.waitForTimeout(3000)
            try {
              await ready()
            } catch {
              await page.waitForTimeout(6000)
            }
          }
        }
      }
    }
  }

  mkdirSync(OUT, { recursive: true })
  writeFileSync(
    join(OUT, "manifest.json"),
    JSON.stringify({ label: LABEL, material: MATERIAL, modes: MODES, engines: ENGINES, units: manifest, failed, errors }, null, 2),
  )
  console.log(`\n[ab] ${manifest.length} units, ${failed.length} failed, ${errors.length} console errors`)
  if (failed.length) console.log(`[ab] FAILED: ${failed.join(", ")}`)
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
