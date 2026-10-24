// Verifies the shared visual timing system: each sync mode must behave
// DIFFERENTLY, not just be five names for "it moves".
//
// What each mode must show:
//   independent        moves continuously, ignores the reveal
//   loopSynced         moves, and returns to its start after loopSeconds
//   delayedAfterReveal STILL while the reveal is running, moves after it ends
//   completionPulse    STILL, then a burst at completion, then still again
//   revealSynced       moves only when the reveal moves (scrubbing drives it)
//
// Usage: node scripts/verify/verify-timing.mjs
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"
import { stageEvidence } from "./lib/evidence-swap.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
/* STAGED, because this wipe can reach committed evidence. It empties
 * `docs/verification/timing-v1`: 76 tracked files.
 * The capture now writes to a sibling `.<name>.staging` and the stored set is
 * replaced only when the run completes, so a run that dies partway leaves every
 * committed frame alone. The same wipe on `hero-windup`, killed 14 s in, deleted
 * all 102 of its tracked files. lib/evidence-swap.mjs. */
const FINAL = join(__dirname, "..", "..", "docs", "verification", "timing-v1")
const EV = stageEvidence(FINAL)
const OUT = EV.dir

function testStroke() {
  const pts = []
  for (let i = 0; i <= 120; i++) {
    const t = i / 120
    pts.push({ x: 120 + t * 620, y: 330 + Math.sin(t * Math.PI * 2.2) * 130 })
  }
  return [pts]
}

// A loud, easy-to-measure layer: scrolling scanlines.
const LAYER = {
  textureEnabled: true,
  textureMode: "scanlines",
  textureAnimated: true,
  textureScale: 1,
  textureIntensity: 0.7,
  textureContrast: 0.6,
  textureSpeed: 2,
  textureDirection: "vertical",
  textureLockMode: "object",
  ditherEnabled: false,
  asciiEnabled: false,
}

async function main() {
  EV.open()

  const browser = await chromium.launch({ headed: true })
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 160))
  })
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  /* ── WHY THIS TOOL COULD NOT RUN, AND THE WORSE HALF: IT COULD RUN WRONG ──
   *
   * `assert-timing.mjs` grades docs/verification/timing-v1 and its PROVENANCE row
   * refuses frames older than lib/. The frames were from 2026-07-28, so the gate
   * was red with no way back. Getting the way back found three things, all
   * measured 2026-08-28:
   *
   * 1. THE READINESS WAIT WAS SHORT ONE HARNESS. It waited on __styleHarness and
   *    __captureHarness, then called `__revealHarness.setProgress`.
   *    __revealHarness is installed by components/viewport-3d.tsx, which mounts
   *    AFTER the other two. verify-material-craft.mjs:142 and
   *    verify-screen-layers.mjs:295 already wait on all three; this file did not.
   *
   * 2. A FAST REFRESH KILLS IT. Six lanes are saving into this tree and every save
   *    remounts the page. Measured over three consecutive bare runs: two died on
   *    "Execution context was destroyed" at grab(), one completed.
   *
   * 3. ⚠ AND A DISTURBED RUN COMMITTED ANYWAY, WHICH IS THE EXPENSIVE ONE. The
   *    12:15 run finished, printed "wrote frames", and EV.commit()ed a full set of
   *    the right shape. The gate then read `completionPulse / decays back to still
   *    - consecD 24.14` against a floor of 1.0 and went red. Nothing was wrong
   *    with the product: a remount inside the 2.5 s decay window had restarted the
   *    pulse, so the frames labelled "settled" caught a fresh burst. Two clean
   *    runs either side read 0.00, and so did the 2026-08-04 evidence. A capture
   *    that is interrupted must not produce a complete-looking set that says
   *    something false, and this one did, with no error anywhere.
   *
   * RETRIED PER BLOCK, NOT PER GRAB, AND (3) IS EXACTLY WHY. Every block below is
   * a claim about WHEN a layer moves: silent before completion, a burst at it,
   * still afterwards. Re-establishing inside one of those windows leaves half its
   * frames from before the remount and half from after, and the gate reads them as
   * consecutive. So the unit of retry is the whole block, which its own `set()`
   * and `setProgress()` rebuild from scratch. */
  async function bootstrap() {
    await page.waitForFunction(
      () => window.__styleHarness && window.__captureHarness && window.__revealHarness,
      null, { timeout: 60000 })
    await page.evaluate((p) => {
      window.__styleHarness.injectStrokes(p, { msPerPoint: 12 })
      window.__captureHarness.enable()
    }, testStroke())
    await page.waitForTimeout(1500)
    await page.evaluate(() => window.__styleHarness.setMode("solid"))
    await page.waitForTimeout(800)
    await page.evaluate(() => window.__captureHarness.frontView(1))
  }
  for (let attempt = 0; ; attempt++) {
    try { await bootstrap(); break }
    catch (e) { if (attempt >= 4) throw e; console.log("[timing] bootstrap retry", attempt + 1); await page.waitForTimeout(1500) }
  }
  /* A remount is detectable AFTER the fact as well as before it: the harnesses are
   * fresh objects, so a block that started on one page and finished on another is
   * caught here even when no call threw. That is the (3) case. */
  const mark = () => page.evaluate(() => {
    /* Tagged on the HARNESS, not on window. A Next.js Fast Refresh hot-swaps the
     * React tree without navigating, so anything parked on window survives it and
     * would report "same page" across the exact remount this is looking for. The
     * harness is installed in a useEffect, so a remount hands back a NEW object
     * and the tag is re-seeded. A real navigation gives a fresh window too, so
     * this catches both. */
    const h = window.__captureHarness
    if (!h) return null
    if (h.__captureEpoch === undefined) h.__captureEpoch = Math.random()
    return h.__captureEpoch
  }).catch(() => null)
  async function block(name, fn) {
    for (let attempt = 0; ; attempt++) {
      try {
        const ok = await page
          .evaluate(() => !!(window.__styleHarness && window.__captureHarness && window.__revealHarness))
          .catch(() => false)
        if (!ok) {
          console.log("[timing] harness vanished (hot reload) — re-establishing")
          await bootstrap()
        }
        const before = await mark()
        await fn()
        const after = await mark()
        if (before === null || before !== after) throw new Error("page remounted mid-block, frames are not consecutive")
        console.log(`[timing] captured ${name}`)
        return
      } catch (e) {
        if (attempt >= 4) throw e
        console.log("[timing] retry", name, attempt + 1, String(e).split("\n")[0])
        await page.waitForTimeout(1500)
      }
    }
  }

  const grab = async (name) => {
    const u = await page.evaluate(() => window.__captureHarness.grab())
    writeFileSync(join(OUT, `${name}.png`), Buffer.from(u.match(/base64,(.+)/)[1], "base64"))
  }
  const set = (p) => page.evaluate((x) => window.__styleHarness.setStyle(x), p)
  const setProgress = (v) => page.evaluate((x) => window.__revealHarness.setProgress(x), v)

  // --- A. continuous modes: capture frames while the reveal sits at 1 -----
  for (const mode of ["independent", "loopSynced"]) {
    await block(mode, async () => {
      await setProgress(1)
      await set({ ...LAYER, textureSyncMode: mode, motionMode: "independent", styleLoopSeconds: 2 })
      await page.waitForTimeout(500)
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(120)
        await grab(`A_${mode}_${String(i).padStart(2, "0")}`)
      }
    })
  }

  // --- B. delayedAfterReveal: must be STILL mid-reveal, moving after ------
  // Re-arm by scrubbing back before completion.
  await block("delayedAfterReveal", async () => {
    await set({ ...LAYER, textureSyncMode: "delayedAfterReveal", motionMode: "independent" })
    await setProgress(0.4)
    await page.waitForTimeout(600)
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(120)
      await grab(`B_delayed_during_${String(i).padStart(2, "0")}`)
    }
    await setProgress(1)
    await page.waitForTimeout(400)
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(120)
      await grab(`B_delayed_after_${String(i).padStart(2, "0")}`)
    }
  })

  // --- C. completionPulse: still, burst at completion, still again -------
  await block("completionPulse", async () => {
    await set({ ...LAYER, textureSyncMode: "completionPulse", motionMode: "independent" })
    await setProgress(0.4)
    await page.waitForTimeout(600)
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(120)
      await grab(`C_pulse_before_${String(i).padStart(2, "0")}`)
    }
    await setProgress(1)
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(130)
      await grab(`C_pulse_burst_${String(i).padStart(2, "0")}`)
    }
    /* 2500 ms against a PULSE_LIFETIME of 1.86 s (lib/style-clock.ts:205,
     * 0.09 + 0.55 * ln(1/0.04)), and the burst loop above already spends 1040 ms
     * of it, so the settled frames start ~3.5 s after the trigger. The margin is
     * ~1.9x. It is the REMOUNT that breaks this window, not the arithmetic. */
    await page.waitForTimeout(2500)
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(120)
      await grab(`C_pulse_settled_${String(i).padStart(2, "0")}`)
    }
  })

  // --- D. revealSynced: driven by scrubbing, static when the playhead is --
  await block("revealSynced", async () => {
    await set({ ...LAYER, textureSyncMode: "revealSynced", motionMode: "syncToDraw" })
    await setProgress(1)
    await page.waitForTimeout(500)
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(120)
      await grab(`D_reveal_held_${String(i).padStart(2, "0")}`)
    }
    for (let i = 0; i < 8; i++) {
      await setProgress(0.3 + i * 0.085)
      await page.waitForTimeout(160)
      await grab(`D_reveal_scrub_${String(i).padStart(2, "0")}`)
    }
  })

  /* --- E. strokeTimeSynced -------------------------------------------------
   *
   * ⚠ THIS ARM DID NOT EXIST, AND THAT IS WHY THE GATE WENT RED. `StyleSyncMode`
   * declares six modes; this file captured five and did not even list the sixth
   * in its own header. `assert-timing.mjs` correctly reported NO EVIDENCE for
   * `strokeTimeSynced` — and no other gate in the set covered it either, so the
   * mode had never been graded by anything.
   *
   * `lib/style-clock.ts` :24 defines it: "like revealSynced but scaled by the
   * stroke's real duration, so a slowly-drawn stroke gets slow style motion —
   * the gesture's own tempo, not the playhead's." So it is captured the same
   * way D is (held, then scrubbed) because those are the two states that make
   * the claim falsifiable — it must be STILL while the playhead is still, and
   * it must MOVE when the playhead moves. What separates it from `revealSynced`
   * is the RATE, which needs a second stroke duration to show; that is a
   * stronger arm than this one and is named here rather than pretended. */
  await block("strokeTimeSynced", async () => {
    await set({ ...LAYER, textureSyncMode: "strokeTimeSynced", motionMode: "syncToDraw" })
    await setProgress(1)
    await page.waitForTimeout(500)
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(120)
      await grab(`E_stroketime_held_${String(i).padStart(2, "0")}`)
    }
    for (let i = 0; i < 8; i++) {
      await setProgress(0.3 + i * 0.085)
      await page.waitForTimeout(160)
      await grab(`E_stroketime_scrub_${String(i).padStart(2, "0")}`)
    }
  })

  console.log(`[timing] console errors: ${errors.length}`, errors.slice(0, 3))
  await browser.close()
  /* THE SWAP, on completion and not on the pass flag. lib/evidence-swap.mjs */
  EV.commit()
  console.log(`[timing] wrote frames to ${FINAL}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
