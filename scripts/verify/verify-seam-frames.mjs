// THE CLOSED-LOOP SEAM, IN BOTH SETTINGS — the frames the look call needs.
//
// `assert-seam.mjs` proves the numbers: a mark that returns to its own start no
// longer gets two interpenetrating end caps (`circle/inflate` 13 fold rays -> 0,
// `square/rod` 1 -> 0), and the square's seam corner goes from rho_out 0.360 to
// 0.992. What no number in it settles is the LOOK, because the fix also removed
// a taper that was visible:
//
//   capped   the parked prior behaviour. A closed mark thins to
//            INFLATE_TIP_FRACTION — 0.159 of full radius — where the pen started
//            and stopped, so a closed square reads with three sharp corners and
//            one pinched.
//   wrapped  the new default. Full width the whole way round; the fourth corner
//            is a corner like the others.
//
// The argument for `capped` is that a real pen does leave a lift mark. The
// argument against is that it was being applied to a mark the drawing says is
// CLOSED, and that it was delivered by two interpenetrating domes rather than by
// a taper anyone designed. THAT IS SEBS'S CALL. This script exists to put the
// two in front of his eye and nothing else — it makes no assertion about which
// is better and it must not grow one.
//
// glossyPlastic for the same reason every other rim capture uses it: a narrow
// specular lobe traces a normal discontinuity instead of averaging over it.
//
// Usage: node scripts/verify/verify-seam-frames.mjs --label=seam [--modes=inflate,rod]
// Output: docs/verification/seam/<label>/<mode>_<loopEnds>_<view>.png
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { createHash } from "node:crypto"
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
const LABEL = arg("label", "seam")
const MODES = arg("modes", "inflate,rod").split(",")
const OUT = join(ROOT, "docs", "verification", "seam", LABEL)

const VIEW = { width: 1300, height: 850 }
const CW = VIEW.width / 2
const CH = VIEW.height - 48
const SCALE = 3.0 / Math.max(CW, CH)
const px2w = (px, py) => ({ x: (px - CW / 2) * SCALE, y: -(py - CH / 2) * SCALE })

// The standard `circle` fixture. It starts and ends at angle 0, so the seam is
// at canvas (650, 360) -> world (1.2157, 0.1534) — the same point the fold
// census located its 13 flagged rays at ([1.203, 0.137], explainer 19 §4).
const circleShape = () => {
  const p = []
  for (let i = 0; i <= 160; i++) {
    const t = (i / 160) * Math.PI * 2
    p.push({ x: 440 + Math.cos(t) * 210, y: 360 + Math.sin(t) * 210 })
  }
  return [p]
}
const SEAM = px2w(650, 360)

// `whole` is the read that answers "does the loop look even all the way round".
// `seam` and `seamHigh` are the close-ups where a taper or a pair of domes is
// the only thing in frame.
const VIEWS = [
  ["whole", null, 0, 26],
  ["seam", 7, 0, 10],
  ["seamHigh", 7, 0, 58],
]

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: VIEW })
  const consoleErrors = []
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160))
  })
  // UNCAUGHT exceptions do NOT arrive on the `console` channel. This script's
  // first run reported "console errors: 2" (both 404s) while the page was
  // throwing `Vector3.copy(undefined)` out of `AnimatedStrokes.useFrame` on
  // every animation frame — a render loop in that state is not a surface any
  // frame should be captured from, and nothing in the run said so.
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

  mkdirSync(OUT, { recursive: true })
  const manifest = []

  // The guard reads the BYTES BEING SAVED — see lib/frame-ink.mjs for why the
  // in-page version it replaces could not fail (it measured the 2-D drawing
  // canvas and returned 863 on twelve consecutive frames, three of which were
  // empty 3-D renders). `INK_FLOOR` is set from the measurement: the studio's
  // grid alone scores 12,882 on this viewport, a framed form scores 20,000 to
  // 57,000, and the two do not overlap.
  const INK_FLOOR = 15000
  const grab = async (file) => {
    const url = await page.evaluate(() => window.__captureHarness.grab())
    const m = (url || "").match(/base64,(.+)/)
    if (!m) throw new Error(`grab failed for ${file}`)
    const buf = Buffer.from(m[1], "base64")
    const { ink } = await frameInk(buf)
    if (ink < INK_FLOOR) {
      throw new Error(
        `EMPTY frame for ${file} (ink=${ink} < ${INK_FLOOR}) — the 3-D render carries no form. ` +
          `Do not adjust the floor; find out why the scene is empty.`,
      )
    }
    writeFileSync(join(OUT, file), buf)
    return { ink, sha: createHash("sha256").update(buf).digest("hex").slice(0, 12) }
  }

  for (const mode of MODES) {
    for (const loopEnds of ["capped", "wrapped"]) {
      // The setting goes in BEFORE the strokes for Rod: `ROD_TUNING` is read at
      // build time, so a stroke set that already exists would keep the old
      // geometry and the two arms would be the same picture twice.
      await page.evaluate(() => window.__styleHarness.clearStrokes())
      await page.waitForTimeout(200)
      await page.evaluate((v) => {
        window.__styleHarness.setInflate({ loopEnds: v })
        if (window.__rodTuning) window.__rodTuning.loopEnds = v
      }, loopEnds)
      await page.waitForTimeout(300)
      await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 10 }), circleShape())
      await page.waitForTimeout(900)
      await page.evaluate((m) => window.__styleHarness.setMode(m), mode)
      await page.waitForTimeout(1600)
      await page.evaluate(() => window.__styleHarness.setMaterial("glossyPlastic"))
      await page.waitForTimeout(300)
      const mat = await page.evaluate(() => window.__styleHarness.get().styleState.materialPreset)
      if (mat !== "glossyPlastic") throw new Error(`material did not take: ${mat}`)
      const le = await page.evaluate(() => window.__styleHarness.get().inflateParams.loopEnds)
      if (mode === "inflate" && le !== loopEnds) throw new Error(`loopEnds did not take: ${le}`)
      await page.evaluate(() => window.__revealHarness.setProgress(1))
      await page.waitForTimeout(500)

      // PROOF THE ARM ACTUALLY MOVED. Two identical pictures labelled differently
      // is the exact failure this repo keeps shipping, so record the geometry
      // signature per arm and compare them at the end rather than trusting the
      // setter's return.
      const stats = await page.evaluate(() => {
        const d = window.__geomDebug.dumpMeshes()
        const g = window.__geomDebug.stats()
        return { meshes: d.meshes, verts: d.pos.length / 3, tris: d.idx.length / 3, bboxZ: g.bbox[2] }
      })

      /* THE CLOSE-UP DISTANCE SCALES TO THE MARK'S OWN THICKNESS, not to the
       * whole drawing. Framed off `bounds().radius` the Rod ring — whose tube is
       * a third of Inflate's — came out as a hairline in which the seam was not
       * resolvable at all, so the "before/after" carried no information for the
       * mode whose seam is two cap spheres. `stats().bbox[2]` is the Z extent,
       * i.e. the tube DIAMETER, which is exactly the feature being read. */
      const zExt = Math.max(stats.bboxZ, 1e-4)
      for (const [vname, distK, az, el] of VIEWS) {
        if (distK === null) {
          await page.evaluate(({ az, el }) => window.__captureHarness.orbitView(az, el, 0.9), { az, el })
        } else {
          await page.evaluate(
            ({ c, dist, az, el }) => window.__captureHarness.focusView({ x: c.x, y: c.y, z: 0 }, dist, az, el),
            { c: SEAM, dist: zExt * 1.9 * distK, az, el },
          )
        }
        await page.waitForTimeout(160)
        const file = `${mode}_${loopEnds}_${vname}.png`
        const { ink, sha } = await grab(file)
        manifest.push({ mode, loopEnds, view: vname, file, ink, sha, ...stats })
      }
      console.log(`[seam] ${mode} / ${loopEnds}: meshes ${stats.meshes}, verts ${stats.verts}, tris ${stats.tris}, tube dia ${stats.bboxZ.toFixed(4)}`)
    }
  }

  // Restore the shipped default so the next script on this server measures what
  // ships rather than whatever this one left behind.
  await page.evaluate(() => {
    window.__styleHarness.setInflate({ loopEnds: "wrapped" })
    if (window.__rodTuning) window.__rodTuning.loopEnds = "wrapped"
  })

  /* PROOF THE ARMS ACTUALLY MOVED — on the FRAMES, which is the deliverable.
   *
   * The first version of this check compared `dumpMeshes` vertex counts and
   * declared Rod's two arms identical. They are not: Rod's difference is its CAP
   * SPHERES, which the viewport instantiates separately from `capPositions` and
   * which `dumpMeshes` does not carry (lib/engine-node.mjs says so in its own
   * comment). The signature was blind to exactly the thing under test — so the
   * check now reads the pictures. Measured on the run that caught it: every one
   * of the six capped-vs-wrapped pairs differs, max channel delta 214-255. */
  let armsDiffer = true
  for (const mode of MODES) {
    for (const [, vname] of VIEWS.map((v) => [null, v[0]])) {
      const a = manifest.find((m) => m.mode === mode && m.loopEnds === "capped" && m.view === vname)
      const b = manifest.find((m) => m.mode === mode && m.loopEnds === "wrapped" && m.view === vname)
      if (a && b && a.sha === b.sha) {
        armsDiffer = false
        console.log(`[seam] ⚠️  ${mode}/${vname}: capped and wrapped rendered BYTE-IDENTICAL frames (${a.sha}).`)
        console.log(`[seam]     That is not a before/after — the setting did not reach the render.`)
      }
    }
    const a = manifest.find((m) => m.mode === mode && m.loopEnds === "capped")
    const b = manifest.find((m) => m.mode === mode && m.loopEnds === "wrapped")
    if (a && b && a.verts === b.verts) {
      console.log(
        `[seam] note: ${mode} tube buffers are identical between arms (verts ${a.verts}) —` +
          ` the difference is in separately-instanced cap geometry, and the frames carry it.`,
      )
    }
  }

  writeFileSync(join(OUT, "manifest.json"), JSON.stringify({ label: LABEL, seam: SEAM, armsDiffer, manifest }, null, 2))
  console.log(`\nwrote ${OUT}`)
  console.log(`console errors: ${consoleErrors.length}`)
  if (consoleErrors.length) console.log(consoleErrors.slice(0, 4).join("\n"))
  console.log(`UNCAUGHT page errors (distinct): ${pageErrors.length}`)
  for (const e of pageErrors.slice(0, 4)) console.log(`  ${e}`)
  await browser.close()
  process.exit(armsDiffer && pageErrors.length === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
