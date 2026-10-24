// FILM THE WHOLE BEAT, IN REAL TIME, WITH A CLOCK ATTACHED.
//
// WHY THIS EXISTS AND WHY IT IS NOT `verify-hero-transition.mjs`'s `play.webm`.
//
// Everything known about this beat is MEASURED — per-frame series, mutation
// controls, model predictions. The last real-time judgement anybody made was on
// the OLD beat, before the retiming, the phase reorder, K4, K7, the camera
// rebalance and the affine stage. That is the exact gap between "every number
// passes" and "it is good", and it is the one this project keeps falling into.
//
// A SCRUB CANNOT SEE A STALL. Driving the transport to N playhead positions
// asks the renderer for N poses and waits for each; it has no clock, so a beat
// that takes 1.1s to draw one of those frames is indistinguishable from one that
// takes 8ms. `desk-doodles-hero-v2.webm` is the proof of what that costs: its
// entire 0.54s emerge is ONE FRAME on the tape (storyboard §10.3).
//
// So this drives the page's OWN Play button and records two things at once:
//
//   1. THE PICTURE — CDP `Page.startScreencast`, one file per painted frame,
//      cropped to the stage. A screencast frame is emitted when the page
//      PAINTS, so the gaps between frames are the truth about stalls rather
//      than a setting.
//
//   2. THE CLOCK — an in-page rAF probe recording (performance.now, playhead,
//      phase) every animation frame. This is what makes a stall legible as a
//      stall: a gap in the trace with the playhead frozen is a dropped frame,
//      and a gap with the playhead JUMPING is the clamp turning a stall into
//      slow motion. Neither is visible in a still and neither is visible in a
//      frame count.
//
// Output, under docs/verification/hero-beat-film/<label>/:
//   frames/*.png       every painted frame, cropped to the stage
//   film.mp4           real time — each frame held for its MEASURED duration
//   film-30.mp4        the same, resampled to a constant 30fps for scrubbing
//   contact-*.png      dense contact sheets, 8 wide
//   trace.json         the rAF clock trace + per-frame timing
//   REPORT.txt         the timing report: stalls, gaps, phase wall-clock
//
// Usage:
//   node scripts/verify/film-hero-beat.mjs --label=shipped
//   node scripts/verify/film-hero-beat.mjs --label=og-compare --tiles=6
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync, readdirSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { existsSync } from "node:fs"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { PORT } from "./lib/dev-server.mjs"
import { stageEvidence } from "./lib/evidence-swap.mjs"

const require = createRequire(import.meta.url)
let FFMPEG = require("ffmpeg-static")
if (!FFMPEG || !existsSync(FFMPEG)) FFMPEG = "ffmpeg"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "shipped")
const RELEASE = arg("release", null)
/* `--film=` / `--camera=` — the option row, driven THROUGH THE PANEL.
 *
 * Same shape as `--release=` above and for the same reason: the only honest way
 * to film an option is to click the control a person clicks. Setting the model
 * from script would film a beat nobody can reach — which is exactly how a panel
 * once rendered zero controls while its harness passed. The click is asserted
 * to have landed (the pill's own `aria-pressed`, plus the panel's readout)
 * before a single frame is recorded. */
const FILM = arg("film", null)
const CAMERA = arg("camera", null)
/* STAGED, because this wipe can reach committed evidence. It empties
 * `docs/verification/hero-beat-film/<label>`, and the label is an argument, so the reach is the
 * whole subtree, 15302 tracked files.
 * The capture now writes to a sibling `.<name>.staging` and the stored set is
 * replaced only when the run completes, so a run that dies partway leaves every
 * committed frame alone. The same wipe on `hero-windup`, killed 14 s in, deleted
 * all 102 of its tracked files. lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", "hero-beat-film", LABEL)
const EV = stageEvidence(FINAL)
const OUT = EV.dir
const FRAMES_DIR = join(OUT, "frames")

async function main() {
  EV.open()
  mkdirSync(FRAMES_DIR, { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 1440 } })
  const page = await context.newPage()

  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 240))
  })
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 240)))

  /* THE PORT IS AN ENV OVERRIDE AND DEFAULTS TO THE SHIPPED 3000.
   *
   * A worktree lane cannot take :3000 — the shared checkout's dev server owns
   * it — and a film taken against another lane's server is a film of another
   * lane's build, which is exactly the "green that cannot fail" shape this file
   * already guards against with `--label=`. Unset, nothing about this script
   * changes. */
  await page.goto(`http://localhost:${PORT}/desk-doodles`, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, {
    timeout: 90000,
  })
  // The implicit-fusion build for the hero word costs a few hundred ms and the
  // page holds the scene while it measures. Wait it out: a film that starts
  // inside the build records the build, not the beat.
  await page.waitForTimeout(4000)

  if (RELEASE) {
    const pill = page.locator(`[data-read-release="${RELEASE}"]`)
    if ((await pill.count()) !== 1) throw new Error(`no [data-read-release="${RELEASE}"] pill`)
    await pill.click()
    await page.waitForTimeout(600)
  }

  /* THE FILM PILL WRITES THE WHOLE EXPOSURE SHEET INTO THE DOCK, so the check
   * that it landed is not "the pill is lit" — it is that the TIMELINE's own
   * total moved to the sheet's length. A pill that highlighted and left the
   * durations behind would film four films with one film's timing. */
  if (FILM) {
    const pill = page.locator(`[data-read-film="${FILM}"]`)
    if ((await pill.count()) !== 1) throw new Error(`no [data-read-film="${FILM}"] pill`)
    await pill.click()
    await page.waitForTimeout(900)
    const got = await page.locator("[data-hero-film]").getAttribute("data-hero-film")
    if (got !== FILM) throw new Error(`film pill did not take: panel reads "${got}"`)
  }
  if (CAMERA) {
    const pill = page.locator(`[data-read-camera="${CAMERA}"]`)
    if ((await pill.count()) !== 1) throw new Error(`no [data-read-camera="${CAMERA}"] pill`)
    await pill.click()
    await page.waitForTimeout(600)
  }
  if (FILM || CAMERA) {
    const read = {
      film: await page.locator("[data-hero-film]").getAttribute("data-hero-film"),
      camera: await page.locator("[data-hero-camera]").getAttribute("data-hero-camera"),
    }
    console.log(`[film] panel reads film="${read.film}" camera="${read.camera}"`)
    if (CAMERA && read.camera !== CAMERA) throw new Error(`camera pill did not take: "${read.camera}"`)
  }

  const stage = page.locator("[data-hero-stage]")
  const box = await stage.boundingBox()
  const total = await page.locator("[data-hero-scrub]").evaluate((el) => parseFloat(el.max))
  const projection = await page.evaluate(() => window.__captureHarness?.projection?.() ?? null)
  console.log(
    `[film] timeline ${total.toFixed(3)}s · stage ${Math.round(box.width)}x${Math.round(box.height)} at ${Math.round(box.x)},${Math.round(box.y)} · projection ${projection}`,
  )

  // Park at zero and let the first pose settle, so frame one of the film is the
  // beat's own frame one and not whatever the page was left on.
  await page.evaluate(() => {
    const el = document.querySelector("[data-hero-scrub]")
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
    set.call(el, "0")
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
  })
  await page.waitForTimeout(1200)

  /* THE CLOCK PROBE. Installed BEFORE Play, read AFTER — it samples the page's
   * own transport on the page's own rAF, so a frame the browser never ran is a
   * gap in this array and nothing else can hide it. */
  await page.evaluate(() => {
    window.__filmTrace = []
    window.__filmStop = false
    const tick = () => {
      const el = document.querySelector("[data-hero-scrub]")
      const ph = document.querySelector("[data-hero-phase]")
      window.__filmTrace.push([
        performance.now(),
        el ? parseFloat(el.value) : -1,
        ph ? ph.getAttribute("data-hero-phase") : null,
      ])
      if (!window.__filmStop) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })

  const client = await context.newCDPSession(page)
  const shots = []
  client.on("Page.screencastFrame", async (f) => {
    shots.push({ data: f.data, ts: f.metadata.timestamp })
    try {
      await client.send("Page.screencastFrameAck", { sessionId: f.sessionId })
    } catch {
      /* the session closes while frames are still in flight; harmless */
    }
  })
  await client.send("Page.startScreencast", {
    format: "png",
    everyNthFrame: 1,
    maxWidth: 1440,
    maxHeight: 1440,
  })

  const t0 = await page.evaluate(() => performance.now())
  await page.locator("[data-hero-play]").click()

  /* Poll the page's OWN transport, not the wall clock. Real-time playback is
   * not wall-clock here by design, and a fixed recording length is what
   * truncated the last artifact at timeline 7.2s — it held the emerge and lost
   * the hold, which is the frame that proves the form settled. */
  await page
    .waitForFunction(
      (t) => {
        const el = document.querySelector("[data-hero-scrub]")
        return el ? parseFloat(el.value) >= t - 0.02 : false
      },
      total,
      { timeout: Math.ceil(total * 1000) * 5 + 15000 },
    )
    .catch(() => console.warn("[film] playback did not reach the end inside the cap"))
  // Tail, so the last thing on the tape is the beat at rest rather than a cut.
  await page.waitForTimeout(1400)

  await client.send("Page.stopScreencast").catch(() => {})
  await page.evaluate(() => {
    window.__filmStop = true
  })
  const trace = await page.evaluate(() => window.__filmTrace)
  await page.waitForTimeout(300)

  console.log(`[film] ${shots.length} painted frames, ${trace.length} rAF samples`)

  /* ---- crop every frame to the stage ------------------------------------- */
  const manifest = []
  const tStart = shots.length ? shots[0].ts : 0
  for (let i = 0; i < shots.length; i++) {
    const img = await loadImage(Buffer.from(shots[i].data, "base64"))
    // The screencast can come back at a different device scale than the CSS
    // viewport; derive the ratio from the image rather than assuming 1.
    const k = img.width / 1440
    const c = createCanvas(Math.round(box.width * k), Math.round(box.height * k))
    c.getContext("2d").drawImage(
      img,
      Math.round(box.x * k),
      Math.round(box.y * k),
      Math.round(box.width * k),
      Math.round(box.height * k),
      0,
      0,
      Math.round(box.width * k),
      Math.round(box.height * k),
    )
    writeFileSync(join(FRAMES_DIR, String(i).padStart(4, "0") + ".png"), c.toBuffer("image/png"))
    manifest.push({ i, tSec: Number((shots[i].ts - tStart).toFixed(4)) })
  }

  /* ---- the timing report -------------------------------------------------
   * This is the half a contact sheet cannot show. Three questions:
   *   - did the beat play in real time? (timeline seconds vs wall seconds)
   *   - did it ever stall? (the largest gap between painted frames)
   *   - did the clamp turn a stall into slow motion? (a big playhead step) */
  const gaps = []
  for (let i = 1; i < manifest.length; i++) gaps.push(manifest[i].tSec - manifest[i - 1].tSec)
  gaps.sort((a, b) => b - a)
  const playFrom = trace.findIndex((r) => r[1] > 0.001)
  const play = playFrom >= 0 ? trace.slice(playFrom) : trace
  let worstStep = 0
  let worstStepAt = null
  let worstGap = 0
  let worstGapAt = null
  for (let i = 1; i < play.length; i++) {
    const dT = play[i][1] - play[i - 1][1]
    const dW = (play[i][0] - play[i - 1][0]) / 1000
    if (dT > worstStep) {
      worstStep = dT
      worstStepAt = play[i]
    }
    if (dW > worstGap) {
      worstGap = dW
      worstGapAt = play[i]
    }
  }
  const wallPlay = play.length ? (play[play.length - 1][0] - play[0][0]) / 1000 : 0
  const tlPlay = play.length ? play[play.length - 1][1] - play[0][1] : 0

  // Wall-clock spent in each phase, off the trace — the beat's real pacing.
  const phaseWall = {}
  for (let i = 1; i < play.length; i++) {
    const p = play[i - 1][2] ?? "-"
    phaseWall[p] = (phaseWall[p] ?? 0) + (play[i][0] - play[i - 1][0]) / 1000
  }

  const lines = []
  const say = (s) => {
    lines.push(s)
    console.log(s)
  }
  say(`\n=== FILM REPORT — ${LABEL} ===`)
  say(`timeline           ${total.toFixed(3)}s`)
  say(`painted frames     ${manifest.length} over ${manifest[manifest.length - 1]?.tSec.toFixed(2)}s of tape`)
  say(`rAF samples        ${play.length} while playing`)
  say(`REAL TIME?         timeline advanced ${tlPlay.toFixed(3)}s in ${wallPlay.toFixed(3)}s of wall clock` +
      `  =  ${(tlPlay / Math.max(wallPlay, 1e-6)).toFixed(3)}x  (1.000 = real time)`)
  say(`mean painted fps   ${(manifest.length / Math.max(manifest[manifest.length - 1]?.tSec ?? 1, 1e-6)).toFixed(1)}`)
  /* ⚠ "WORST PAINT GAP" IS NOT BY ITSELF A STALL, AND READING IT AS ONE COST A
   * LANE HALF A DAY. Measured 2026-08-02: this line reported 0.264s and 0.262s
   * across two runs, reproducible to 2ms, at playhead 8.2s in `tilt` — which
   * reads exactly like a quarter-second freeze in the middle of the beat. It is
   * not one. Inside that window the page ran **29 rAF callbacks at a 9.3ms
   * mean** and the playhead advanced **260ms**: the compositor was issuing
   * BeginFrame throughout and the animation never paused. The gap is the CDP
   * screencast's own ack-gated pipeline, not the subject. (Ruled out
   * separately: it is not the PNG encoder — re-running at `format: "jpeg",
   * quality: 60` leaves it at 0.256s — and it is not a shader link, since
   * `linkProgram` is called 0 times during playback against 9 during load. See
   * `_probe-hero-gpu-stall.mjs`.)
   *
   * So the gap is now printed WITH the rAF evidence beside it, and classified.
   * A gap with rAF callbacks inside it is the recorder; a gap with none is the
   * page. Printing the number alone is what made a green-looking instrument
   * report a defect that was not there.
   *
   * The same caution applies to `REAL TIME?` above: it divides by a wall-clock
   * span that includes the 1.4s parked TAIL this script records after playback
   * ends, so it reads ~0.900x on a beat that plays at 1.0019x. */
  const worstGapIdx = manifest.findIndex(
    (m, i) => i > 0 && m.tSec - manifest[i - 1].tSec === (gaps[0] ?? -1),
  )
  let insideRaf = 0
  if (worstGapIdx > 0 && play.length) {
    const w0 = play[0][0] + manifest[worstGapIdx - 1].tSec * 1000
    const w1 = play[0][0] + manifest[worstGapIdx].tSec * 1000
    insideRaf = play.filter((r) => r[0] > w0 && r[0] < w1).length
  }
  say(`worst paint gap    ${(gaps[0] ?? 0).toFixed(3)}s   (next four: ${gaps.slice(1, 5).map((g) => g.toFixed(3)).join(", ")})`)
  say(
    `  └─ rAF callbacks INSIDE that gap: ${insideRaf}` +
      (insideRaf > 2
        ? `  => THE PAGE KEPT ANIMATING. This gap is the screencast recorder, not a stall.`
        : `  => no frames ran: this one is a real stall.`),
  )
  say(`worst rAF gap      ${worstGap.toFixed(3)}s at playhead ${worstGapAt ? worstGapAt[1].toFixed(2) : "-"}s in "${worstGapAt ? worstGapAt[2] : "-"}"`)
  say(`worst playhead step ${worstStep.toFixed(3)}s at ${worstStepAt ? worstStepAt[1].toFixed(2) : "-"}s in "${worstStepAt ? worstStepAt[2] : "-"}"` +
      `   — a big step here is the clamp turning a stall into slow motion`)
  say(`\nwall-clock seconds per phase (authored seconds in brackets):`)
  for (const [p, w] of Object.entries(phaseWall)) say(`  ${p.padEnd(14)} ${w.toFixed(2)}s`)
  say(`\nconsole errors     ${errors.length}${errors.length ? "\n  " + errors.join("\n  ") : ""}`)

  writeFileSync(join(OUT, "REPORT.txt"), lines.join("\n"))
  writeFileSync(
    join(OUT, "trace.json"),
    JSON.stringify({ label: LABEL, total, projection, box, errors, manifest, trace }, null, 2),
  )

  await context.close()
  await browser.close()

  /* ---- encode ------------------------------------------------------------
   * REAL TIME first: a concat list with each frame's MEASURED duration, so the
   * tape plays at the pace the machine actually rendered it. A constant frame
   * rate would erase exactly the defect this film exists to look for. */
  const durations = manifest.map((m, i) =>
    i + 1 < manifest.length ? Math.max(0.008, manifest[i + 1].tSec - m.tSec) : 0.1,
  )
  const list = manifest
    .map((m, i) => `file '${join(FRAMES_DIR, String(m.i).padStart(4, "0") + ".png")}'\nduration ${durations[i].toFixed(4)}`)
    .join("\n")
  writeFileSync(join(OUT, "concat.txt"), list + `\nfile '${join(FRAMES_DIR, String(manifest[manifest.length - 1].i).padStart(4, "0") + ".png")}'\n`)
  const enc = (args, name) => {
    try {
      execFileSync(FFMPEG, args, { stdio: "ignore" })
      console.log(`[film] wrote ${name}`)
    } catch (e) {
      console.warn(`[film] ffmpeg ${name} failed:`, e.message)
    }
  }
  enc(
    ["-y", "-f", "concat", "-safe", "0", "-i", join(OUT, "concat.txt"), "-vsync", "vfr",
     "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p",
     "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", join(OUT, "film.mp4")],
    "film.mp4 (real time)",
  )
  enc(
    ["-y", "-f", "concat", "-safe", "0", "-i", join(OUT, "concat.txt"),
     "-r", "30", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p",
     "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", join(OUT, "film-30.mp4")],
    "film-30.mp4 (constant 30fps)",
  )

  /* ---- contact sheets ----------------------------------------------------
   * Dense, 8 wide, every frame, in pages — §0.5.1c's rule for reading a motion
   * arc: never judge from two or three frames. Each tile is stamped with its
   * frame index and playhead so a shot can be found again. */
  const files = readdirSync(FRAMES_DIR).filter((f) => f.endsWith(".png")).sort()
  const traceAt = (tapeSec) => {
    if (!play.length) return null
    const target = play[0][0] + tapeSec * 1000
    let best = play[0]
    for (const r of play) if (Math.abs(r[0] - target) < Math.abs(best[0] - target)) best = r
    return best
  }
  const COLS = 8
  const TW = 300
  const PER = COLS * 8
  for (let pageIdx = 0; pageIdx * PER < files.length; pageIdx++) {
    const slice = files.slice(pageIdx * PER, (pageIdx + 1) * PER)
    const th = Math.round((TW * box.height) / box.width)
    const rows = Math.ceil(slice.length / COLS)
    const c = createCanvas(COLS * TW, rows * (th + 18))
    const ctx = c.getContext("2d")
    ctx.fillStyle = "#111"
    ctx.fillRect(0, 0, c.width, c.height)
    for (let i = 0; i < slice.length; i++) {
      const img = await loadImage(join(FRAMES_DIR, slice[i]))
      const x = (i % COLS) * TW
      const y = Math.floor(i / COLS) * (th + 18)
      ctx.drawImage(img, x, y, TW, th)
      const gi = pageIdx * PER + i
      const tr = traceAt(manifest[gi]?.tSec ?? 0)
      ctx.fillStyle = "#eee"
      ctx.font = "13px monospace"
      ctx.fillText(
        `${gi}  tape ${(manifest[gi]?.tSec ?? 0).toFixed(2)}s  t ${tr ? tr[1].toFixed(2) : "-"}  ${tr ? tr[2] : ""}`,
        x + 4,
        y + th + 13,
      )
    }
    writeFileSync(join(OUT, `contact-${pageIdx}.png`), c.toBuffer("image/png"))
  }
  /* THE SWAP, on completion and not on the pass flag. lib/evidence-swap.mjs */
  EV.commit()
  console.log(`[film] wrote ${Math.ceil(files.length / PER)} contact sheet(s) → ${FINAL}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
