// DRAFTED SIDE WALLS — does the whole mark taper as ONE moulding?
//
// THE PORT, AND THE TRAP IT CARRIES
//   `applyDraftTaper` (lib/dd-extrude-relief.ts, ported verbatim from Desk
//   Doodles) shrinks a geometry's back face toward THE GEOMETRY'S OWN bbox
//   centre. Desk Doodles hands it one pooled slab, so that centre is the mark's
//   centre and the form reads as one part released from a die.
//
//   Free Stroke's Extrude emits ONE GEOMETRY PER STROKE. So a verbatim call —
//   the obvious wiring, the one that typechecks, the one that renders something
//   plausible — tapers the `h` of a word toward the `h`'s own centre and the `o`
//   toward the `o`'s. Five letters, five mouldings, five directions. That is why
//   the function sat ported-but-unwired with a comment instead of being switched
//   on, and `applyDraftTaperAbout` is the same arithmetic with the centre
//   supplied.
//
// WHY THIS SCRIPT EXISTS RATHER THAN A SCREENSHOT
//   The two wirings are indistinguishable in every number the build reports:
//   same vertex count, same triangle count, same per-stroke bbox, same total
//   bbox (each letter still shrinks by the same amount), and on a SINGLE letter
//   they are identical. They differ in one place only — WHICH WAY each letter's
//   back face moves:
//
//     own-centre wiring  -> each mesh's back-face centroid stays put (shift ~ 0)
//     pool-centre wiring -> each mesh's back-face centroid moves TOWARD the
//                           shared centre, by draft x its distance from it
//
//   `__geomDebug.taperProfile()` reports exactly that per mesh, and the
//   assertion is the dot product of each letter's shift with its own direction
//   to the pool centre. It must be positive for EVERY letter.
//
// BOTH DIRECTIONS, as the standing rule requires:
//   1. `straight` must be flat — every shift ~ 0. Without this the test passes
//      for a build that tapers unconditionally and ignores the dial.
//   2. `drafted` must shift EVERY letter, and every letter must point INWARD to
//      the same place. Either half alone is satisfiable by a bug: an
//      unconditional taper satisfies (2), and a dead dial satisfies (1).
//   3. A multi-stroke mark is required. On one stroke the own-centre and
//      pool-centre wirings are the same call, so a single-letter fixture cannot
//      fail — the exact "guard that cannot fail" this repo keeps catching.
//
// Usage: node scripts/verify/assert-draft-taper.mjs [--label=run]
// Output: docs/verification/draft-taper/<label>/{straight,drafted}/*.png + .mp4
//         docs/verification/draft-taper/<label>/report.json
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync, existsSync } from "node:fs"
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
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "run")
const OUT = join(ROOT, "docs", "verification", "draft-taper", LABEL)
/* THE CONSTANT, READ FROM THE ENGINE — not a copy of it.
 *
 * INSTRUMENT REPAIR 2026-08-03 — A SECOND COPY OF A GUARDED CONSTANT.
 *   WAS: `const DRAFT = 0.18`, with the comment "Desk Doodles'
 *   EXTRUDE_DRAFT_AMOUNT", and nothing anywhere comparing the two. The real
 *   constant is `lib/dd-extrude-relief.ts:78`. Because the gate predicted from
 *   its OWN copy, the check below (`inward/(dist x DRAFT)` inside 0.6…1.4) was
 *   satisfied for any engine value in 0.108…0.252 — a -40 %/+40 % window on the
 *   one number this file exists to hold. The Extrude draft could have been
 *   halved and every row stayed green.
 *
 * Importing it fixes the staleness but, on its own, would make the ratio row
 * 1.0 BY CONSTRUCTION and therefore blind in a new way. So the repair is two
 * pieces, and both are needed:
 *   · DRAFT is the engine's value, so the ratio row now measures what it says
 *     it measures — "the rendered displacement equals the ported constant" —
 *     and its tolerance can be tight, because the only slack left is the
 *     front/back centroid banding over a bevelled face.
 *   · DRAFT-0 below PINS the engine's value against the recorded 0.18. That is
 *     the row that fires when the constant moves. A gate may derive from a
 *     constant or pin it, but deriving alone cannot see it change. */
const RELIEF = loadTs("lib/dd-extrude-relief.ts")
const DRAFT = RELIEF.EXTRUDE_DRAFT_AMOUNT
/** Recorded 2026-08-03 from lib/dd-extrude-relief.ts:78. */
const DRAFT_RECORDED = 0.18

let failures = 0
const check = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}

/** The word is the fixture BECAUSE it is many strokes — see note 3 above. */
function wordStrokes() {
  const { polylines, width } = layoutWord("hello", { x: 0, y: 0, size: 130, tracking: 14 })
  const k = 700 / width
  return polylines.map((pl) => pl.map((p) => ({ x: 90 + p.x * k, y: 380 + p.y * k })))
}

async function main() {
  // STANDING RULE: never headless, always Metal ANGLE.
  const browser = await chromium.launch({ headed: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 160))
  })
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(
    () => window.__styleHarness && window.__captureHarness && window.__revealHarness && window.__geomDebug,
    null,
    { timeout: 60000 },
  )
  const hasProbe = await page.evaluate(
    () => typeof window.__geomDebug?.taperProfile === "function" &&
      typeof window.__styleHarness?.setExtrude === "function",
  )
  if (!hasProbe) {
    console.log("FAIL  harness / taperProfile or setExtrude is missing — nothing can be measured.")
    await browser.close()
    process.exit(1)
  }
  await page.evaluate(() => window.__captureHarness.enable())
  await page.waitForTimeout(300)

  await page.evaluate((poly) => window.__styleHarness.injectStrokes(poly, { msPerPoint: 10 }), wordStrokes())
  await page.waitForTimeout(800)
  await page.evaluate(() => window.__styleHarness.setMode("extrude"))
  await page.waitForTimeout(1200)
  await page.evaluate(() => window.__styleHarness.setMaterial("glossyPlastic"))
  await page.waitForTimeout(600)
  await page.evaluate(() => window.__revealHarness.setProgress(1))
  await page.waitForTimeout(500)

  const report = {}

  async function unit(sideWall) {
    await page.evaluate((sw) => window.__styleHarness.setExtrude({ sideWall: sw }), sideWall)
    await page.waitForTimeout(1200)
    // Read it back. A run that silently measured the other setting is worse than
    // no run: it looks like evidence.
    const got = await page.evaluate(() => window.__styleHarness.get().extrudeParams.sideWall)
    if (got !== sideWall) throw new Error(`setExtrude did not take: asked ${sideWall}, state says ${got}`)
    await page.evaluate(() => window.__revealHarness.setProgress(1))
    await page.waitForTimeout(400)

    let prof = null
    for (let t = 0; t < 30; t++) {
      prof = await page.evaluate(() => window.__geomDebug.taperProfile())
      if (Array.isArray(prof) && prof.length > 1) break
      await page.waitForTimeout(300)
    }
    if (!Array.isArray(prof) || prof.length < 2) {
      throw new Error(`taperProfile returned ${prof ? prof.length : "null"} meshes — need >1 to tell the two wirings apart`)
    }

    // The mark's own centre, from the meshes themselves rather than from the
    // engine — so this is an independent check of where the taper aimed, not a
    // restatement of the value the engine used.
    let sx = 0, sy = 0
    for (const p of prof) { sx += p.frontCentre[0]; sy += p.frontCentre[1] }
    const pool = [sx / prof.length, sy / prof.length]

    const rows = prof.map((p) => {
      const toPool = [pool[0] - p.frontCentre[0], pool[1] - p.frontCentre[1]]
      const dist = Math.hypot(toPool[0], toPool[1])
      const shiftMag = Math.hypot(p.shift[0], p.shift[1])
      const inward = dist > 1e-9 ? (p.shift[0] * toPool[0] + p.shift[1] * toPool[1]) / dist : 0
      return { name: p.name, dist: +dist.toFixed(5), shiftMag: +shiftMag.toFixed(5), inward: +inward.toFixed(5) }
    })

    // Frames + video, orbited, so the read is judged by eye as well as measured.
    const dirFinal = join(OUT, sideWall)
    /* STAGED PER UNIT. `draft-taper` holds 300 tracked files and this
     * wipe used to empty one side-wall directory before spending minutes refilling it.
     * A run that dies mid-unit now leaves that unit's stored frames alone; every
     * unit already finished stays finished. lib/evidence-swap.mjs. */
    const ev = stageEvidence(dirFinal)
    const dir = ev.open()
    let f = 0
    for (const el of [8, 26, 50]) {
      for (let i = 0; i < 12; i++) {
        await page.evaluate(({ az, el }) => window.__captureHarness.orbitView(az, el, 0.92), { az: (360 * i) / 12, el })
        await page.waitForTimeout(90)
        const url = await page.evaluate(() => window.__captureHarness.grab())
        const m = (url || "").match(/base64,(.+)/)
        if (!m) throw new Error("grab failed")
        writeFileSync(join(dir, `${String(f).padStart(4, "0")}.png`), Buffer.from(m[1], "base64"))
        f++
      }
    }
    let mp4 = null
    try {
      const ffmpeg = (await import("ffmpeg-static")).default
      if (ffmpeg && existsSync(ffmpeg)) {
        mp4 = `${dirFinal}.mp4`
        execFileSync(ffmpeg, ["-y", "-framerate", "10", "-i", join(dir, "%04d.png"), "-c:v", "libx264",
          "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", mp4], { stdio: "ignore" })
      }
    } catch { mp4 = null }

    /* THE SWAP, after ffmpeg has read the frames out of staging. */
    ev.commit()

    report[sideWall] = { pool, rows, meshes: prof.length, frames: f, mp4: mp4 ? mp4.replace(ROOT + "/", "") : null }
    console.log(`\n[draft] ${sideWall}: ${prof.length} meshes, pool centre [${pool.map((v) => v.toFixed(3))}]`)
    for (const r of rows) {
      console.log(`  ${r.name.padEnd(14)} dist=${r.dist.toFixed(4)}  |shift|=${r.shiftMag.toFixed(5)}  inward=${r.inward.toFixed(5)}`)
    }
    return rows
  }

  mkdirSync(OUT, { recursive: true })
  const straight = await unit("straight")
  const drafted = await unit("drafted")
  // Leave the app on the shipped default.
  await page.evaluate(() => window.__styleHarness.setExtrude({ sideWall: "straight" }))
  await page.waitForTimeout(400)

  // ---- ASSERTIONS -------------------------------------------------------
  // 0. THE CONSTANT ITSELF. See the note at DRAFT. Everything below predicts
  //    FROM this number, so a silent move in it would be absorbed rather than
  //    reported; this row is what makes the move loud. If the draft is
  //    deliberately re-tuned, DRAFT_RECORDED is edited in the same commit and
  //    this row is the record of that decision.
  check(
    "DRAFT-0 EXTRUDE_DRAFT_AMOUNT is published and is the recorded value",
    typeof DRAFT === "number" && Math.abs(DRAFT - DRAFT_RECORDED) < 1e-12,
    `lib/dd-extrude-relief.ts EXTRUDE_DRAFT_AMOUNT = ${JSON.stringify(DRAFT)} (recorded ${DRAFT_RECORDED})`,
  )

  // The scale everything is judged against: the mark's own size. An absolute
  // epsilon would be a different test on a word than on a letter.
  const spread = Math.max(...drafted.map((r) => r.dist), 1e-9)

  // 1. STRAIGHT IS FLAT. Vertical walls move nothing.
  const worstStraight = Math.max(...straight.map((r) => r.shiftMag))
  check(
    "straight / back face is not displaced",
    worstStraight < spread * 0.01,
    `worst |shift| ${worstStraight.toFixed(5)} against a mark spread of ${spread.toFixed(4)}`,
  )

  // 2. DRAFTED MOVES SOMETHING. Guards against a dead dial.
  const movedCount = drafted.filter((r) => r.shiftMag > spread * 0.02).length
  check(
    "drafted / the dial reaches the geometry",
    movedCount >= Math.max(2, drafted.length - 1),
    `${movedCount}/${drafted.length} meshes displaced`,
  )

  // 3. EVERY LETTER LEANS TOWARD THE SAME POINT. This is the assertion the
  //    whole file is for: with the naive per-geometry wiring `inward` is ~0 for
  //    every mesh, and with a per-letter centre the signs are mixed.
  const outward = drafted.filter((r) => r.dist > spread * 0.1 && r.inward <= 0)
  check(
    "drafted / every stroke leans toward the MARK's centre, not its own",
    outward.length === 0,
    outward.length === 0
      ? `all ${drafted.length} meshes lean inward`
      : `${outward.length} lean the wrong way: ${outward.map((r) => r.name).join(", ")}`,
  )

  // 4. THE AMOUNT IS THE PORTED CONSTANT. The back face is at scale
  //    (1 - draft) about the centre, so a mesh `d` from the centre must have its
  //    back centroid `draft * d` closer to it. Asserting the RATIO rather than
  //    "it moved" is what makes this a check on the ported number instead of on
  //    the existence of a call. Tolerance is loose because the front/back
  //    centroids are band averages over a bevelled face, not exact planes.
  const far = drafted.filter((r) => r.dist > spread * 0.25)
  const ratios = far.map((r) => r.inward / (r.dist * DRAFT))
  const worstRatio = ratios.length ? Math.min(...ratios) : 0
  const bestRatio = ratios.length ? Math.max(...ratios) : 0
  check(
    "drafted / displacement matches EXTRUDE_DRAFT_AMOUNT",
    ratios.length > 0 && worstRatio > 0.6 && bestRatio < 1.4,
    `inward/(dist x ${DRAFT}) in [${worstRatio.toFixed(2)}, ${bestRatio.toFixed(2)}] over ${ratios.length} meshes`,
  )

  report.__consoleErrors = errors.length
  writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2))
  await browser.close()
  console.log(`\nconsole errors: ${errors.length}`)
  console.log(failures === 0 ? "ALL DRAFT-TAPER ASSERTIONS PASS" : `${failures} FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
