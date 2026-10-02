// Verifies STACK-LEVEL animation: the whole group animating as one container.
//
// The thing that must be proven is that this is genuinely GROUP behaviour, not
// just another per-layer animation. Each behaviour therefore gets captured under
// conditions that expose its own signature:
//
//   fadeIn            starts near-invisible, ends at full strength
//   pulse             oscillates continuously
//   drift             moves continuously (phase, not opacity)
//   delayAfterReveal  absent mid-reveal, present after
//   completionPulse   normal, swells at completion, settles back to normal
//   freezeOnComplete  moving during the reveal, EXACTLY still after
//
// Usage: node scripts/verify/verify-stack-anim.mjs
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
 * `docs/verification/stack-anim-v1`: 91 tracked files.
 * The capture now writes to a sibling `.<name>.staging` and the stored set is
 * replaced only when the run completes, so a run that dies partway leaves every
 * committed frame alone. The same wipe on `hero-windup`, killed 14 s in, deleted
 * all 102 of its tracked files. lib/evidence-swap.mjs. */
const FINAL = join(__dirname, "..", "..", "docs", "verification", "stack-anim-v1")
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

// A stack with all three layers animating, so group behaviour is visible on top
// of per-layer motion.
const STACK = {
  layerStackEnabled: true,
  textureEnabled: true,
  textureMode: "scanlines",
  textureAnimated: true,
  textureScale: 1,
  textureIntensity: 0.6,
  textureContrast: 0.55,
  textureSpeed: 1.5,
  textureDirection: "vertical",
  textureLockMode: "object",
  textureSyncMode: "independent",
  ditherEnabled: true,
  ditherType: "bayer4",
  ditherScale: 4,
  ditherLevels: 3,
  ditherIntensity: 0.8,
  ditherContrast: 0.55,
  ditherThreshold: 0.5,
  ditherLockMode: "screen",
  ditherAnimated: true,
  ditherSpeed: 1.2,
  ditherDirection: "diagonal",
  ditherSyncMode: "independent",
  asciiEnabled: false,
  motionMode: "independent",
  stackTextureOpacity: 0.7,
  stackDitherOpacity: 0.9,
  stackOrder: "ditherFirst",
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
  /* ── WHY THIS TOOL COULD NOT RUN, AND WHY ITS EVIDENCE WENT 24 DAYS STALE ──
   *
   * `assert-stack-anim.mjs` grades docs/verification/stack-anim-v1 and its
   * PROVENANCE row refuses frames older than lib/. The row was right and the
   * frames were from 2026-08-04, so the gate was red with no way back. Running
   * this tool to get the way back found two defects in the tool, both measured
   * 2026-08-28:
   *
   * 1. THE READINESS WAIT WAS SHORT ONE HARNESS. It waited on __styleHarness and
   *    __captureHarness, then called `__revealHarness.setProgress`.
   *    __revealHarness is installed by components/viewport-3d.tsx, which mounts
   *    AFTER the other two, so the call threw "Cannot read properties of
   *    undefined". verify-material-craft.mjs:142 and verify-screen-layers.mjs:295
   *    already wait on all three; this file did not.
   *
   * 2. A FAST REFRESH KILLED IT MID-SWEEP. With the wait fixed it reached 2 of 8
   *    behaviours and died on `__captureHarness` being undefined again. This runs
   *    against a live dev server while other work lands in the tree, and every
   *    save remounts the page. verify-screen-layers.mjs:310 carries the shape that
   *    survives it.
   *
   * RETRIED PER BEHAVIOUR, NOT PER GRAB, AND THE TIMING IS WHY. Every block below
   * is a claim about WHEN the stack moves: a burst at completion, still after a
   * freeze, moving only while the playhead scrubs. Re-establishing the bed inside
   * one of those bursts would leave half its frames from before the reload and
   * half from after, and the gate reads them as consecutive. So the unit of retry
   * is the whole behaviour, which `arm()` resets from scratch anyway. */
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
    catch (e) { if (attempt >= 4) throw e; console.log("[stack-anim] bootstrap retry", attempt + 1); await page.waitForTimeout(1500) }
  }
  async function ensureHarness() {
    const ok = await page
      .evaluate(() => !!(window.__styleHarness && window.__captureHarness && window.__revealHarness))
      .catch(() => false)
    if (ok) return
    console.log("[stack-anim] harness vanished (hot reload) — re-establishing")
    await bootstrap()
  }
  /** one behaviour, captured whole or captured again. */
  async function behaviour(name, fn) {
    for (let attempt = 0; ; attempt++) {
      try {
        await ensureHarness()
        await fn()
        console.log("[stack-anim]", name)
        return
      } catch (e) {
        if (attempt >= 4) throw e
        console.log("[stack-anim] retry", name, attempt + 1, String(e).split("\n")[0])
        await page.waitForTimeout(1500)
      }
    }
  }

  const grab = async (n) => {
    const u = await page.evaluate(() => window.__captureHarness.grab())
    writeFileSync(join(OUT, `${n}.png`), Buffer.from(u.match(/base64,(.+)/)[1], "base64"))
  }
  const set = (p) => page.evaluate((x) => window.__styleHarness.setStyle(x), p)
  const prog = (v) => page.evaluate((x) => window.__revealHarness.setProgress(x), v)
  // Re-mounting the stack animation restarts scene-relative behaviours.
  const arm = async (type) => {
    await set({ ...STACK, stackAnimationEnabled: false, stackAnimationType: "none" })
    await page.waitForTimeout(200)
    await set({ ...STACK, stackAnimationEnabled: true, stackAnimationType: type, stackAnimationSpeed: 1 })
  }

  // fadeIn: capture immediately, so the arrival is inside the window.
  await behaviour("fadeIn", async () => {
    await prog(1)
    await arm("fadeIn")
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(110)
      await grab(`fade_${String(i).padStart(2, "0")}`)
    }
  })

  // pulse / drift: continuous behaviours, just sample them.
  for (const b of ["pulse", "drift"]) {
    await behaviour(b, async () => {
      await arm(b)
      await page.waitForTimeout(400)
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(110)
        await grab(`${b}_${String(i).padStart(2, "0")}`)
      }
    })
  }

  // delayAfterReveal: absent during, present after.
  await behaviour("delayAfterReveal", async () => {
    await arm("delayAfterReveal")
    await prog(0.45)
    await page.waitForTimeout(600)
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(110)
      await grab(`delay_during_${String(i).padStart(2, "0")}`)
    }
    await prog(1)
    await page.waitForTimeout(900)
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(110)
      await grab(`delay_after_${String(i).padStart(2, "0")}`)
    }
  })

  // freezeOnComplete: moving during the reveal, exactly still after.
  await behaviour("freezeOnComplete", async () => {
    await arm("freezeOnComplete")
    await prog(0.45)
    await page.waitForTimeout(500)
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(110)
      await grab(`freeze_during_${String(i).padStart(2, "0")}`)
    }
    await prog(1)
    await page.waitForTimeout(500)
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(110)
      await grab(`freeze_after_${String(i).padStart(2, "0")}`)
    }
  })

  /* --- THE THREE THAT WERE NEVER CAPTURED ---------------------------------
   *
   * ⚠ `StackAnimationBehaviour` declares eight; this file captured five, and
   * `assert-stack-anim.mjs` correctly reported NO EVIDENCE for `completionPulse`,
   * `loop` and `revealSynced` — with no other gate covering them either, so
   * three shipped behaviours had never been graded by anything.
   *
   * Each is captured in the two states that make its own claim falsifiable,
   * mirroring the arms above rather than inventing a new shape. */

  // completionPulse: resting, a burst at completion, then resting again.
  await behaviour("completionPulse", async () => {
    await arm("completionPulse")
    await prog(0.4)
    await page.waitForTimeout(600)
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(110)
      await grab(`cpulse_before_${String(i).padStart(2, "0")}`)
    }
    await prog(1)
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(120)
      await grab(`cpulse_burst_${String(i).padStart(2, "0")}`)
    }
    await page.waitForTimeout(2500)
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(110)
      await grab(`cpulse_settled_${String(i).padStart(2, "0")}`)
    }
  })

  // loop: free-running and wrapped, so it must MOVE and it must return.
  await behaviour("loop", async () => {
    await arm("loop")
    await prog(1)
    await page.waitForTimeout(400)
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(140)
      await grab(`loop_${String(i).padStart(2, "0")}`)
    }
  })

  // revealSynced: still while the playhead is still, moving when it scrubs.
  await behaviour("revealSynced", async () => {
    await arm("revealSynced")
    await prog(1)
    await page.waitForTimeout(400)
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(110)
      await grab(`rsync_held_${String(i).padStart(2, "0")}`)
    }
    for (let i = 0; i < 8; i++) {
      await prog(0.3 + i * 0.085)
      await page.waitForTimeout(150)
      await grab(`rsync_scrub_${String(i).padStart(2, "0")}`)
    }
  })

  console.log(`[stack-anim] console errors: ${errors.length}`, errors.slice(0, 3))
  await browser.close()
  /* THE SWAP, on completion and not on the pass flag. lib/evidence-swap.mjs */
  EV.commit()
  console.log(`[stack-anim] wrote frames to ${FINAL}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
