// GLOSS RIM CAPTURE — judging Extrude and Solid on the material that shows.
//
// Why this exists as a SEPARATE capture from verify-form-orbit: form-orbit
// drives `setMode` and nothing else, and `handleModeChange` applies
// MODE_MATERIAL_DEFAULTS — extrude -> glossyPlastic, solid -> matteClay. So
// every Solid frame this project has ever captured for a geometry judgement was
// shot on MATTE, the register that hides exactly the defect we are looking for.
// A matte surface integrates incoming light over the hemisphere, so a normal
// discontinuity moves the shaded value by a few percent. A glossy surface
// mirrors a small solid angle, so the SAME discontinuity moves it from 0 to 1 in
// one pixel. Specular is a derivative operator on the normal field: if a form
// reads clean under gloss it reads clean everywhere, and the converse is what
// found the Rod ring-banding the matte register was hiding.
//
// `setMaterial` sets materialUserOverride, so it must be called AFTER setMode
// (mode change would otherwise stamp the mode default back over it). The script
// reads the state back and refuses to capture if the material did not take —
// this project has already shipped one harness that "passed" while its clicks
// were landing on nothing.
//
// Usage: node scripts/verify/verify-gloss-rim.mjs --label=before [--modes=solid,extrude]
// Output: docs/verification/gloss-rim/<label>/<shape>_<mode>/*.png + .mp4
//         docs/verification/gloss-rim/<label>/probe.json  (normal-band census)
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
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
const MODES = arg("modes", "solid,extrude").split(",")
const AZ_STEPS = parseInt(arg("az", "24"), 10)
const MATERIAL = arg("material", "glossyPlastic")
const OUT = join(ROOT, "docs", "verification", "gloss-rim", LABEL)

// Same four fixtures as verify-form-orbit, so the gloss frames can be read
// side by side with the matte ones rather than being a separate universe.
const SHAPES = {
  word: () => {
    const { polylines, width } = layoutWord("hello", { x: 0, y: 0, size: 130, tracking: 14 })
    const k = 700 / width
    return polylines.map((pl) => pl.map((p) => ({ x: 90 + p.x * k, y: 380 + p.y * k })))
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
}

// Elevations chosen for what each one exposes on a rim:
//   8  — grazing. The rim occupies most of the visible surface; a hard
//        cap/wall crease shows as a terminator line the length of the form.
//   26 — the working three-quarter read.
//   50 — cap-dominant. Shows whether the cap edge is a cut or a roll.
const ELEVATIONS = [8, 26, 50]

async function main() {
  const browser = await chromium.launch({ headed: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 160))
  })
  // A dev server that is being edited by someone else hot-reloads underneath a
  // long capture: the page swaps, `window.__captureHarness` is torn down and
  // `grab()` returns null. That is not a defect in the thing under test, so it
  // must not end the run — but it must also never silently produce a short or
  // stale series. Every unit re-establishes the page from scratch and is
  // retried as a whole; a unit that cannot complete is recorded as failed.
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
  const probes = {}
  const failed = []
  for (const [shapeName, shapeFn] of Object.entries(SHAPES)) {
    for (const mode of MODES) {
      const dir = join(OUT, `${shapeName}_${mode}`)
      let attempt = 0
      for (;;) {
        attempt++
        try {
          await captureUnit(shapeName, shapeFn, mode, dir)
          break
        } catch (e) {
          console.log(`[gloss] ${shapeName}/${mode} attempt ${attempt} failed: ${e.message}`)
          if (attempt >= 4) {
            failed.push(`${shapeName}/${mode}`)
            break
          }
          await page.waitForTimeout(4000)
          try {
            await ready()
          } catch {
            await page.waitForTimeout(8000)
          }
        }
      }
    }
  }

  async function captureUnit(shapeName, shapeFn, mode, dirFinal) {
    /* STAGED PER UNIT. `gloss-rim` holds 3665 tracked files and this
     * wipe used to empty one shape/mode directory before spending minutes refilling it.
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
      await page.waitForTimeout(1100)
      // Material AFTER mode: setMode stamps MODE_MATERIAL_DEFAULTS unless the
      // user has overridden, and setMaterial is what sets that override flag.
      await page.evaluate((mat) => window.__styleHarness.setMaterial(mat), MATERIAL)
      await page.waitForTimeout(700)
      // Read it back. A capture that silently ran on the wrong material is
      // worse than no capture: it looks like evidence.
      const got = await page.evaluate(() => window.__styleHarness.get().styleState.materialPreset)
      if (got !== MATERIAL) {
        throw new Error(`material did not take: asked ${MATERIAL}, state says ${got}`)
      }
      await page.evaluate(() => window.__revealHarness.setProgress(1))
      await page.waitForTimeout(500)

      // `requireInk` counts non-transparent, non-white pixels IN THE PAGE before
      // the PNG is written. A capture harness that silently writes empty frames
      // produces documents that look like passing evidence; this run has
      // already shipped one directory of those.
      const grab = async (file, { requireInk = false } = {}) => {
        const res = await page.evaluate((needInk) => {
          const url = window.__captureHarness.grab()
          if (!url || !needInk) return { url, ink: null }
          // The LARGEST canvas is the 3D capture target (1920x1080 in capture
          // mode); `document.querySelector("canvas")` returns the 2D drawing
          // canvas, whose ink is always present and would pass this gate for
          // any 3D frame whatsoever — a guard that cannot fail is not a guard.
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
          await page.evaluate(
            ({ az, el }) => window.__captureHarness.orbitView(az, el, 0.92),
            { az, el },
          )
          await page.waitForTimeout(90)
          await grab(`${String(f).padStart(4, "0")}.png`)
          f++
        }
      }

      // Rim CLOSE-UPS. The whole-form orbit cannot resolve a rim band that is
      // ~1% of the form's width.
      //
      // The previous version did this with `orbitView(az, el, 0.26)`, reasoning
      // that a small fill factor "keeps the harness's own bounds centre and
      // just moves in" — because `focusView` wanted a world-space target and
      // nothing exposed the bounds CENTRE. But orbitView's fill factor scales
      // the camera DISTANCE, and 0.26 puts the camera inside the bounding
      // sphere, aimed at the empty middle of a word. Every closeup it wrote is
      // blank white, and they were committed to docs/verification looking like
      // evidence of a clean rim.
      //
      // `__captureHarness.bounds()` now returns the centre, so focusView has a
      // legitimate target. Offsets are FRACTIONS of the form's own radius, so
      // the framing is the same tightness on a word and on a circle. Every
      // frame is checked for ink before it is written — a blank closeup is a
      // harness failure and must fail the run, not become a document.
      const bounds = await page.evaluate(() => window.__captureHarness.bounds())
      if (!bounds) throw new Error("bounds() returned null — nothing to focus on")
      const R = bounds.radius
      // NOTE the shape of this loop. The version before it wrote
      //   `for (const [k, [az, el, fill]] of [[0,[18,10,0.26]], …].entries())`
      // — `.entries()` on rows that ALREADY lead with their own index, so the
      // destructure took k from the outer counter and then read the row's own
      // index as the first camera argument. `fill` came out `undefined`, the
      // camera position went NaN, and the frames came out blank. Both the
      // camera call AND the file name looked correct at the call site.
      // The row's index is the array index; do not wrap it again.
      for (const [k, [ox, oy, dist, az, el]] of [
        [-0.55, 0.0, 0.30, 18, 10],
        [0.0, 0.0, 0.26, 40, 26],
        [0.55, 0.0, 0.30, 8, 48],
      ].entries()) {
        await page.evaluate(
          ({ c, ox, oy, dist, az, el, R }) =>
            window.__captureHarness.focusView(
              { x: c.x + ox * R, y: c.y + oy * R, z: c.z },
              dist * R,
              az,
              el,
            ),
          { c: bounds.center, ox, oy, dist, az, el, R },
        )
        await page.waitForTimeout(140)
        await grab(`closeup_${k}.png`, { requireInk: true })
      }

      const stats = await page.evaluate(() =>
        window.__geomDebug ? window.__geomDebug.stats() : null,
      )
      const probe = await page.evaluate(() =>
        window.__geomDebug?.probeNormals ? window.__geomDebug.probeNormals() : null,
      )
      // Normal-band census: what fraction of the surface carries a normal that
      // is NEITHER cap-facing (|nz|>0.9) NOR wall-facing (|nz|<0.4)? That
      // in-between band IS the bevel. A die-cut rim scores 0.
      const band = await page.evaluate(() => {
        const root = window.__geomDebug?.normalHistogram
        return root ? root() : null
      })
      probes[`${shapeName}/${mode}`] = { stats, probe, band }
      manifest.push({ shape: shapeName, mode, frames: f, material: MATERIAL, stats })

      try {
        execFileSync(
          "ffmpeg",
          [
            "-y", "-framerate", "24",
            "-i", join(dir, "%04d.png"),
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18",
            "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
            join(OUT, `${shapeName}_${mode}.mp4`),
          ],
          { stdio: "ignore" },
        )
      } catch {
        console.log(`[gloss] ffmpeg failed for ${shapeName}/${mode} (frames still on disk)`)
      }
      /* THE SWAP, after ffmpeg has read the frames out of staging. */
      ev.commit()
      console.log(`[gloss] ${shapeName}/${mode} on ${MATERIAL}: ${f} frames + 3 closeups`)
  }

  mkdirSync(OUT, { recursive: true })
  writeFileSync(
    join(OUT, "manifest.json"),
    JSON.stringify({ label: LABEL, material: MATERIAL, azSteps: AZ_STEPS, elevations: ELEVATIONS, entries: manifest, failed, errors }, null, 2),
  )
  writeFileSync(join(OUT, "probe.json"), JSON.stringify(probes, null, 2))
  console.log(
    `[gloss] saved to ${OUT} (console errors: ${errors.length}${failed.length ? `, FAILED UNITS: ${failed.join(", ")}` : ""})`,
  )
  await browser.close()
  if (failed.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
