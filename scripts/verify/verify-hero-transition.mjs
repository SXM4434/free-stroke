// HERO TRANSITION CAPTURE — the 2D→3D beat, in motion and frame by frame.
//
// The beat this captures is the product's whole pitch: a flat drawn mark
// becomes a three-dimensional object. That claim can only be judged two ways,
// and this script produces both, because either one alone lies.
//
//   1. IN MOTION. A real-time screen recording of the page's OWN Play button
//      driving its OWN rAF loop. A transition is a time-domain artefact; a
//      contact sheet of stills cannot tell you whether it reads as one object
//      changing state or as two images swapping. Playwright's recordVideo is
//      used rather than a synthesised frame sequence so what lands on disk is
//      what a human would have seen.
//
//   2. FRAME BY FRAME, DENSE. The page's own scrub slider is driven to N
//      evenly-spaced playhead positions and the WebGL canvas is grabbed at
//      each. This is what makes the ACCEPTANCE TEST checkable: pause on frame
//      one and ask whether a viewer would call it a 2D drawing. A dense
//      sequence also localises the handoff to a couple of frames so the
//      silhouette can be diffed across it.
//
// Both drive the page through the REAL UI — the Play button and the transport
// slider — not through a state-injection harness, because this project has
// already shipped a bug where harness assertions passed while the feature was
// unreachable by a human.
//
// STANDING RULE: real Chrome on the Metal ANGLE backend, HEADLESS.
//
// This used to read "headed... headless silently pauses the rAF loop here,
// which would record a frozen scene". The observation was real but the cause
// was misattributed: without `--use-angle=metal` Chrome falls back to
// SwiftShader, and THAT is what pauses the loop. The flag is the load-bearing
// part, not the window.
//
// Measured 2026-07-30, both modes on this machine: 121 rAF ticks headless vs
// 120 headed, distinct frames at every seek, zero errors, and an identical
// renderer string — `ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Max)`.
//
// It matters because headed Chrome on macOS surfaces and steals focus every
// time it is driven, which made Sebs's machine unusable while lanes ran, and
// `channel: "chrome"` keeps this his real Chrome rather than Playwright's
// bundled Chromium either way.
//
// Usage:
//   node scripts/verify/verify-hero-transition.mjs --label=before [--frames=120]
// Output:
//   docs/verification/hero-transition/<label>/play.webm     real-time recording
//   docs/verification/hero-transition/<label>/scrub/*.png   dense stills
//   docs/verification/hero-transition/<label>/scrub.mp4     stills as a film
//   docs/verification/hero-transition/<label>/frame-one.png full-page, unscaled
//   docs/verification/hero-transition/<label>/manifest.json phase per frame
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync, readdirSync, renameSync, existsSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { HERO_URL } from "./lib/dev-server.mjs"
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
const LABEL = arg("label", "run")
// Default is deliberately high. A 10s beat sampled at 120 steps is ~12 samples
// per second of screen time, which is enough to catch a one-frame pop; sampled
// at 20 it is not, and a one-frame pop is exactly the defect this beat dies of.
const FRAMES = parseInt(arg("frames", "120"), 10)
/* THE PROJECTION ARM — and this is the registration fix's NEGATIVE CONTROL.
 *
 * `--projection=perspective` reproduces the prior read: the lab's 50° camera on
 * the hero stage, which is what the beat shipped with and what measures
 * `max cx step 24.50 px`. Omitted, the page decides (a host driving `flatten`
 * gets `"affine"`), which is the shipped arm.
 *
 * It exists because `Viewport3DProps.projection`'s own comment CLAIMED this
 * control was drivable and NOTHING IN THE REPO DROVE IT — the only caller of
 * `window.__viewport3dProjection` was a smoke probe. A fix whose control cannot
 * be run is a fix nobody tested, and the two arms below are the whole evidence
 * that the projection is the mechanism rather than a coincidence that happens
 * to cancel one measurement. */
const PROJECTION = arg("projection", null)
/* THE WIND-UP'S RELEASE ARM — the cy clause's INTERVENTION control.
 *
 * `--release=prior` clicks the panel's own "snaps" pill, which parks
 * `releaseLaw` on the cliff: the tense springs back to full height in ONE FRAME
 * at the anticipation→emerge boundary instead of unwinding inside the turn
 * (`hero-motion.ts` `squashAt`). It exists because the registration gate's old
 * `cy` clause was reading that release and calling it a mis-registration, and a
 * mechanism claim is worth nothing without an arm that removes the mechanism.
 *
 * Under `prior` the whole squash is gone before the first `emerge` frame, so the
 * parked window contains no dilation at all and even the OVERTURNED midpoint
 * quantity has to read 0.00. Driven through the real pill, not through an
 * override — the pill is what Sebs would click. */
const RELEASE = arg("release", null)
/* THE PEN CARVE'S ARM — the §0.7 park, and the A/B the whole change rests on.
 *
 * `--carve=prior` loads the page with `window.__heroCarveLaw = "prior"`, which
 * puts `lib/hero-motion.ts` back on the shipped read: the flat mark keeps the
 * 3-D tube's silhouette and only its VALUE flattens. That is the state Sebs
 * described as *"way too subtle... hard to tell it went from 2D to 3D"*, and it
 * is measurably the whole of the problem — the flat state and the settled solid
 * differ on the silhouette by 4.09 % of a stroke radius and a value-only control
 * accounts for all of it, i.e. the silhouette change is ZERO.
 *
 * Two things need this arm and neither can be argued instead of run:
 *   · §0.7 — the prior read must still reproduce, byte for byte;
 *   · the claim "the carve is what made the change legible" needs an arm with
 *     the carve REMOVED, measured the same way, or it is a story.
 *
 * It goes in before navigation because the page latches it in a mount effect,
 * and the capture then ASSERTS off the page's own per-frame `data-hero-carve`
 * readout that the arm actually took — see `mountedCarve` below. */
const CARVE = arg("carve", null)
/* STAGED, because this wipe can reach committed evidence. It empties
 * `docs/verification/hero-transition/<label>`, and the label is an argument, so the reach is the
 * whole subtree, 5887 tracked files.
 * The capture now writes to a sibling `.<name>.staging` and the stored set is
 * replaced only when the run completes, so a run that dies partway leaves every
 * committed frame alone. The same wipe on `hero-windup`, killed 14 s in, deleted
 * all 102 of its tracked files. lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", "hero-transition", LABEL)
const EV = stageEvidence(FINAL)
const OUT = EV.dir
const SCRUB = join(OUT, "scrub")

async function main() {
  EV.open()
  mkdirSync(SCRUB, { recursive: true })

  const browser = await chromium.launch()
  /* THE VIEWPORT HAS TO CLEAR THE TIMELINE DOCK.
   *
   * The page reserves its own height for the DialKit dock (`dockHeight`, page
   * :760), so when the dock is expanded the 3D stage gets what is left. At
   * 1440x900 with the dock open the stage came out 1120x350 — half the 1120x702
   * it had when the dock was collapsed — and every absolute pixel threshold in
   * the gates was then being read against a mark rendered at a third of the
   * area. Worse, a squeezed stage can CLIP the turning mark, which reads as
   * missing ink rather than as a framing problem.
   *
   * Sizing the viewport so the stage survives either dock state is the fix:
   * the capture then measures the same object whatever UI state the page was
   * last left in, which is not something a capture should be sensitive to. */
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1440 },
    recordVideo: { dir: OUT, size: { width: 1440, height: 1440 } },
  })
  const page = await context.newPage()

  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 240))
  })
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 240)))

  /* BEFORE NAVIGATION, because R3F builds the camera from the `orthographic`
   * flag exactly once and the viewport therefore reads the override in a
   * `useState` initialiser. An override written after the first render is an
   * override that does nothing while still LOOKING like a driven control. */
  if (PROJECTION) {
    await page.addInitScript((v) => {
      window.__viewport3dProjection = v
    }, PROJECTION)
  }
  // Same reason, one file over: the page latches `__heroCarveLaw` in a mount
  // effect, so an override written after the first render does nothing while
  // still LOOKING like a driven control.
  if (CARVE) {
    await page.addInitScript((v) => {
      window.__heroCarveLaw = v
    }, CARVE)
  }

  // `FS_PORT` defaults to the shipped 3000; a worktree lane cannot take that
  // port because the shared checkout's dev server owns it, and a capture taken
  // against another lane's server is a capture of another lane's build.
  // It is the ONLY name for this knob now — see `lib/dev-server.mjs`.
  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, {
    timeout: 90000,
  })
  /* ASSERT THE ARM ACTUALLY MOUNTED, off the LIVE CAMERA and not off the flag
   * that asked for it. `__captureHarness.projection()` reads
   * `controls.object.isOrthographicCamera`. A control that silently fails to
   * take produces a capture identical to the shipped arm — which would then be
   * reported as "the control passed too", i.e. the exact green-that-cannot-fail
   * this repo keeps shipping. Refuse to write frames instead. */
  const mountedProjection = await page.evaluate(
    () => window.__captureHarness?.projection?.() ?? null,
  )
  if (PROJECTION && mountedProjection !== PROJECTION) {
    throw new Error(
      `--projection=${PROJECTION} did not take: the live camera reports "${mountedProjection}". ` +
        `Refusing to capture — an arm that did not switch is not a control.`,
    )
  }
  console.log(`[hero] projection: ${mountedProjection}${PROJECTION ? " (forced)" : " (page default)"}`)

  /* THE CARVE ARM, ASSERTED OFF THE PAGE'S OWN READOUT — never off the flag.
   * `data-hero-carve-law` is what `motion.carveLaw` resolved to, published
   * beside the per-frame carve value. An arm that silently did not switch would
   * produce a capture identical to the shipped one, which then reads as "the
   * control passed too". */
  const mountedCarveLaw = await page.evaluate(
    () => document.querySelector("[data-hero-carve-law]")?.getAttribute("data-hero-carve-law") ?? null,
  )
  if (CARVE && mountedCarveLaw !== CARVE) {
    throw new Error(
      `--carve=${CARVE} did not take: the page reports "${mountedCarveLaw}". ` +
        `Refusing to capture — an arm that did not switch is not a control.`,
    )
  }
  console.log(`[hero] carve law: ${mountedCarveLaw}${CARVE ? " (forced)" : " (page default)"}`)

  /* THE RELEASE ARM, THROUGH THE REAL PILL — and it refuses to capture if the
   * click did not take. A control arm that silently stayed on the shipped law
   * produces a capture identical to the shipped one, which then reads as "the
   * control passed too": the green-that-cannot-fail this repo keeps shipping. */
  if (RELEASE) {
    const pill = page.locator(`[data-read-release="${RELEASE}"]`)
    if ((await pill.count()) !== 1) {
      throw new Error(`no [data-read-release="${RELEASE}"] pill on the page — the wind-up control moved`)
    }
    await pill.click()
    await page.waitForTimeout(600)
    const active = await page.evaluate(() => {
      const on = [...document.querySelectorAll("[data-read-release]")].find(
        (el) => el.getAttribute("aria-pressed") === "true" || el.dataset.active === "true",
      )
      return on?.getAttribute("data-read-release") ?? null
    })
    // `aria-pressed`/`data-active` is how the Pill marks its own state; if the
    // component ever stops publishing it, fail loudly rather than assume.
    if (active !== RELEASE) {
      throw new Error(
        `--release=${RELEASE} did not take: the panel reports "${active}". ` +
          `Refusing to capture — an arm that did not switch is not a control.`,
      )
    }
    console.log(`[hero] wind-up release: ${RELEASE} (driven through the panel pill)`)
  }
  // The implicit-fusion build for the hero word costs a few hundred ms, and the
  // page holds the scene while it measures. Wait that out before judging
  // anything — a frame grabbed mid-build is a frame of a different object.
  await page.waitForTimeout(3500)

  // The page's OWN transport, addressed by explicit test hooks. Positional
  // selectors were tried first and picked up the 3D viewport's own playback
  // slider, which is a different timeline in the same <main> — the capture then
  // silently scrubbed a 1-second draw-in instead of the 10-second beat.
  const scrubber = page.locator("[data-hero-scrub]")
  const playBtn = page.locator("[data-hero-play]")
  // The STAGE, not the raw canvas. The viewport mounts more than one canvas
  // (a hidden compare surface among them) and `first()` picked an invisible
  // one; the stage box is also what a viewer actually sees.
  const canvas = page.locator("[data-hero-stage]")

  const setPlayhead = async (t) => {
    await scrubber.evaluate((el, value) => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set
      setter.call(el, String(value))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, t)
  }

  const total = await scrubber.evaluate((el) => parseFloat(el.max))
  console.log(`[hero] timeline ${total.toFixed(2)}s, sampling ${FRAMES} frames`)

  /* ---- 1. Frame one, at rest, full page and canvas ---------------------- */
  await setPlayhead(0)
  await page.waitForTimeout(900)
  await page.screenshot({ path: join(OUT, "frame-one-page.png") })
  await canvas.screenshot({ path: join(OUT, "frame-one.png") })

  /* ---- 2. Dense scrub --------------------------------------------------- */
  const manifest = []
  for (let i = 0; i < FRAMES; i++) {
    const t = (i / (FRAMES - 1)) * total
    await setPlayhead(t)
    // Two frames of settle: one for React to push the pose into the scene, one
    // for the renderer to draw it. Without this the grab races the paint and
    // the sequence shows stale poses, which reads as dropped frames.
    await page.waitForTimeout(70)
    /* PHASE **AND CARVE**, read in ONE evaluate off the same DOM node, so the
     * two can never come from different frames. The carve is recorded per frame
     * because gate 1 samples the breath and gate 2 the orbit, and "which frames
     * were carved" is now part of reading either verdict. */
    const read = await page
      .evaluate(() => {
        const el = document.querySelector("[data-hero-phase]")
        if (!el) return { phase: null, carve: null }
        const c = el.getAttribute("data-hero-carve")
        return { phase: el.getAttribute("data-hero-phase"), carve: c === null ? null : Number(c) }
      })
      .catch(() => ({ phase: null, carve: null }))
    await canvas.screenshot({ path: join(SCRUB, String(i).padStart(4, "0") + ".png") })
    manifest.push({ i, t: Number(t.toFixed(3)), phase: read.phase, carve: read.carve })
  }

  /* ---- 3. The emerge window, at high density -----------------------------
   * The beat that carries the whole claim is about half a second long. Sampled
   * at the timeline's own rate that is five frames — not enough to tell a
   * gradual change of state from a two-frame pop, which is precisely the
   * distinction being judged. The window is derived from the page's own phase
   * readout rather than from hardcoded offsets, so it follows the dials. */
  /* THE WINDOW IS DERIVED FROM WHATEVER FOLLOWS `emerge`, BY POSITION.
   *
   * This used to look up the phase named "anticipation" and use its start as
   * the window's end — which silently assumed the tense comes AFTER the beat.
   * When the phase order was corrected (the tense now precedes the turn it
   * winds up for), that lookup returned an EARLIER frame and the window ran
   * backwards: `emerge window 4.04s..3.76s`, 72 frames sampled over a negative
   * span. The capture still wrote 72 files with correct-looking names.
   *
   * Reading the next phase by position instead of by name means a future
   * reorder cannot do this again. */
  const emergeIdx = manifest.findIndex((m) => m.phase === "emerge")
  const afterIdx = manifest.findIndex((m, i) => i > emergeIdx && m.phase !== "emerge")
  if (emergeIdx > 0) {
    const w0 = Math.max(0, manifest[emergeIdx - 1].t)
    const w1 = afterIdx > 0 ? manifest[afterIdx].t : Math.min(total, w0 + 2)
    if (!(w1 > w0)) {
      throw new Error(
        `emerge window is not forwards: ${w0.toFixed(2)}s..${w1.toFixed(2)}s. ` +
          `Refusing to capture — a backwards window writes correctly-named frames of the wrong thing.`,
      )
    }
    const N = 72
    const dir = join(OUT, "emerge")
    mkdirSync(dir, { recursive: true })
    console.log(`[hero] emerge window ${w0.toFixed(2)}s..${w1.toFixed(2)}s at ${N} frames`)
    const emergeManifest = []
    /* THE PHASE IS RECORDED PER EMERGE FRAME, and it is load-bearing rather
     * than bookkeeping. The window deliberately opens one scrub sample BEFORE
     * the turn, so its leading frames belong to `anticipation` — whose squash
     * is a non-uniform 2D scale PINNED AT THE CONTACT (asserted by
     * `assert-hero-dead-channels.mjs`: *"the squash is pinned at the CONTACT,
     * not the centre — the baseline holds — cy 501.0 -> 505.0"*). It therefore
     * moves the bbox's vertical midpoint BY DESIGN, on frames at full extent.
     * A registration gate that cannot tell those frames from the turn reads an
     * authored wind-up as a mis-registered swap. */
    for (let i = 0; i < N; i++) {
      const t = w0 + ((w1 - w0) * i) / (N - 1)
      await setPlayhead(t)
      await page.waitForTimeout(70)
      const read = await page
        .evaluate(() => {
          const el = document.querySelector("[data-hero-phase]")
          if (!el) return { phase: null, carve: null }
          const c = el.getAttribute("data-hero-carve")
          return { phase: el.getAttribute("data-hero-phase"), carve: c === null ? null : Number(c) }
        })
        .catch(() => ({ phase: null, carve: null }))
      await canvas.screenshot({ path: join(dir, String(i).padStart(4, "0") + ".png") })
      emergeManifest.push({ i, t: Number(t.toFixed(3)), phase: read.phase, carve: read.carve })
    }
    writeFileSync(join(OUT, "emerge-manifest.json"), JSON.stringify(emergeManifest, null, 2))
    try {
      execFileSync(
        FFMPEG,
        [
          "-y", "-framerate", "12",
          "-i", join(dir, "%04d.png"),
          "-c:v", "libx264", "-pix_fmt", "yuv420p",
          "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
          join(OUT, "emerge.mp4"),
        ],
        { stdio: "ignore" },
      )
    } catch (e) {
      console.warn("[hero] ffmpeg (emerge) failed:", e.message)
    }
  }

  /* ---- 4. Real-time play, recorded --------------------------------------- */
  await setPlayhead(0)
  await page.waitForTimeout(600)
  await playBtn.click()
  /* Record until the page's OWN transport says the beat is over — not for
   * `total + 1.5s` of wall clock, which is what this used to do and which
   * silently truncated the artifact.
   *
   * Real-time playback is deliberately NOT wall-clock. The implicit-fusion
   * build stalls the main thread about 1.1s at the end of the draw, and the
   * playback loop clamps each step to 0.25s so that stall becomes slow motion
   * rather than a skipped beat (see explainers/14 §7). The consequence is that
   * a 10.2s timeline takes ~16s of wall time to play out, so a 11.7s recording
   * stopped at about timeline 7.2s: the video contained the emerge but never
   * the hold, and the hold is the frame that proves the form settled as an
   * object rather than kept moving.
   *
   * Polling the transport makes the recording follow the timeline however long
   * it actually takes. The cap is generous but finite so a genuine hang still
   * ends the run instead of recording forever. */
  await page
    .waitForFunction(
      (t) => {
        const el = document.querySelector("[data-hero-scrub]")
        return el ? parseFloat(el.value) >= t - 0.02 : false
      },
      total,
      { timeout: Math.ceil(total * 1000) * 4 + 10000 },
    )
    .catch(() => console.warn("[hero] playback did not reach the end inside the cap"))
  // Tail: hold the settled frame on the video for a beat after the timeline
  // ends, so the last thing judged is the object at rest and not a cut.
  await page.waitForTimeout(1500)

  writeFileSync(
    join(OUT, "manifest.json"),
    JSON.stringify(
      {
        label: LABEL,
        total,
        frames: FRAMES,
        // What the LIVE CAMERA was, not what was asked for. The judge prints it
        // so an arm can never be mistaken for its own control after the fact.
        projection: mountedProjection,
        projectionForced: PROJECTION ?? null,
        // Same rule for the carve: what the PAGE resolved, beside what was asked
        // for. `carvePeak` is the largest value the model published anywhere in
        // this capture — 0 on the parked arm, and the one number that says at a
        // glance whether these frames carry the drawing's outline or the tube's.
        carveLaw: mountedCarveLaw,
        carveForced: CARVE ?? null,
        carvePeak: manifest.reduce((a, m) => Math.max(a, m.carve ?? 0), 0),
        errors,
        manifest,
      },
      null,
      2,
    ),
  )

  await context.close()
  await browser.close()

  // Playwright names the video by an internal id; give it a stable name.
  const vids = readdirSync(OUT).filter((f) => f.endsWith(".webm"))
  if (vids.length) renameSync(join(OUT, vids[0]), join(OUT, "play.webm"))

  /* ---- 4. Stills -> film ------------------------------------------------- */
  try {
    execFileSync(
      FFMPEG,
      [
        "-y",
        "-framerate", "24",
        "-i", join(SCRUB, "%04d.png"),
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        join(OUT, "scrub.mp4"),
      ],
      { stdio: "ignore" },
    )
  } catch (e) {
    console.warn("[hero] ffmpeg failed:", e.message)
  }
  // The real-time recording is the one a human judges; give it an mp4 too so it
  // opens anywhere.
  try {
    if (existsSync(join(OUT, "play.webm"))) {
      execFileSync(
        FFMPEG,
        ["-y", "-i", join(OUT, "play.webm"), "-c:v", "libx264", "-pix_fmt", "yuv420p", join(OUT, "play.mp4")],
        { stdio: "ignore" },
      )
    }
  } catch (e) {
    console.warn("[hero] ffmpeg (play) failed:", e.message)
  }

  /* THE SWAP, on completion and not on the pass flag. lib/evidence-swap.mjs */
  EV.commit()
  console.log(`[hero] wrote ${FINAL}`)
  if (errors.length) console.log(`[hero] console errors: ${errors.length}`, errors.slice(0, 5))
  else console.log("[hero] console clean")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
