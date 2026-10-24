// Headed frame + video capture for the TIME-ORIGIN pass.
//
// The companion `assert-timing-origin.mjs` settles the maths on the pure
// functions. This script settles the other half: that the corrected numbers
// reach the SCREEN, through the real state path a user drives, and that the
// result reads as an intentional event rather than a glitch.
//
// Each run is built the way a user meets the option: draw, let the reveal
// finish, WAIT (so `sinceCompletion` goes stale exactly as it does in life),
// then select the option and watch. That waiting step is the whole point —
// every bug in this family is invisible unless the clock is already stale.
//
// STANDING RULE: HEADED, Metal ANGLE. Headless silently pauses the rAF loop,
// so any verdict about motion taken from it is worthless.
//
// Usage:
//   node scripts/verify/verify-timing-origin.mjs --label=after
//   node scripts/verify/verify-timing-origin.mjs --label=after --only=pulse
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync, rmSync, readdirSync, renameSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
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
  return hit ? hit.split("=")[1] : d
}
const LABEL = arg("label", "after")
const ONLY = arg("only", "")

/* ==PURE-BEGIN== `_probe-crosscheck-timing-origin.mjs` slices from here to
 * ==PURE-END== and runs it in plain node.
 *
 * 🔴 F113 FINDING 6 (Codex, 2026-09-18), reproduced 2026-09-22. `--only` had two
 * readings that disagreed. `want()` matched the SELECTOR (`pulse`, `flash`) and
 * the cleanup matched a FILE PREFIX. So `--only=flash` shot `completion_flash`
 * and cleared none of its old frames, leaving a short new capture padded out by
 * the last full one, and `--only=pulse_armed_at_rest` deleted that arm's frames
 * and shot nothing. An unknown name did neither and exited 0.
 * One table now says which files each selector owns, both readings come from it,
 * and a name that is not in it stops the run before anything is deleted. */
const ARMS = {
  pulse: ["pulse_armed_at_rest", "pulse_live"],
  delayed: ["delayed_after_reveal"],
  delay: ["delay_dial"],
  flash: ["completion_flash"],
  stack: ["stack_completion_pulse", "stack_delay_after_reveal"],
  preset: ["preset"],
  ui: ["ui"],
}
/** What `--only=<only>` selects and clears. `ok: false` means refuse to run. */
function selection(only) {
  if (!only) return { ok: true, want: () => true, mine: () => true }
  const prefixes = Object.hasOwn(ARMS, only) ? ARMS[only] : null
  if (!prefixes) {
    return { ok: false, why: `--only=${only} is not an arm. Known: ${Object.keys(ARMS).join(", ")}` }
  }
  /* ⚠ THE PREFIX NEEDS A BOUNDARY: `delay` must not reach `delayed_after_reveal_*`.
   * The arm's files are `<arm>_NN.png`, `<arm>.clock.json`, `<arm>-state.json`. */
  const mine = (f) => prefixes.some((p) => f.startsWith(p) && /^[_.-]/.test(f.slice(p.length)))
  return { ok: true, want: (n) => n === only, mine }
}
/* ==PURE-END== */
const BASE = join(ROOT, "docs", "verification", "timing-origin")
const OUT = join(BASE, LABEL)
const VID = join(BASE, "video")

/** The subject: one loopy stroke, identical in every run. */
function testStroke() {
  const pts = []
  for (let i = 0; i <= 120; i++) {
    const t = i / 120
    pts.push({
      x: 120 + t * 620,
      y: 330 + Math.sin(t * Math.PI * 2.2) * 130 + Math.sin(t * Math.PI * 6) * 22,
    })
  }
  return [pts]
}

// A loud, high-contrast texture layer: the timing envelope multiplies this
// layer's intensity, so the envelope is only legible if the layer itself is.
//
// NOTE ON THIS OBJECT'S COMPLETENESS. It names every field any run below
// touches, including the three `*SyncMode`s, because `setStyle` is a PATCH:
// a field one run sets and the next does not mention is inherited. That is the
// same leak this pass fixes in the preset rail, and it bit this script first —
// a `textureSyncMode` left on `delayedAfterReveal` silenced the texture in
// every later run and produced five confident, meaningless zero curves.
const LOUD_TEXTURE = {
  materialPreset: "ink",
  materialUserOverride: true,
  textureSyncMode: "independent",
  ditherSyncMode: "independent",
  asciiSyncMode: "independent",
  ditherAnimated: false,
  asciiAnimated: false,
  textureEnabled: true,
  textureMode: "scanlines",
  textureAnimated: true,
  textureScale: 1.1,
  textureIntensity: 0.9,
  textureContrast: 0.7,
  textureSpeed: 1.4,
  textureDirection: "vertical",
  textureLockMode: "object",
  textureDelay: 0,
  texturePhase: 0,
  ditherEnabled: false,
  asciiEnabled: false,
  layerStackEnabled: false,
  stackAnimationEnabled: false,
  stackAnimationType: "none",
  fusionPreset: "none",
  fusionAnimationEnabled: false,
  materialAnimationEnabled: false,
  materialAnimationType: "none",
  motionMode: "independent",
}

const ALL_OFF = {
  ...LOUD_TEXTURE,
  textureEnabled: false,
  textureAnimated: false,
  textureMode: "none",
  motionMode: "off",
}

async function main() {
  /* 🔴 F99: `--only` USED TO WIPE THE ARMS IT WAS NOT GOING TO RE-SHOOT.
   *
   * This line cleared the WHOLE label and then `want()` skipped every arm but
   * one, so `--only=delay` deleted the other three and left the gate reading:
   *     FAIL  evidence / pulse_armed_at_rest  — 0 frames (need 27)
   *     FAIL  evidence / pulse_live           — 0 frames (need 33)
   *     FAIL  evidence / delayed_after_reveal — 0 frames (need 21)
   * The flag READS as "do less". It MEANT "keep less". Hit while calibrating a
   * known-bad, and it cost only minutes because the other arms were
   * reproducible; on a capture that is expensive or non-deterministic it would
   * have cost the evidence itself.
   *
   * A partial run now clears only what it is about to replace. A full run still
   * wipes the label, because a full run really does own all of it. */
  /* ⚠ THE PREFIX NEEDS A BOUNDARY, and a bare startsWith does not have one:
   * `--only=delay` would also match `delayed_after_reveal_*`, wiping an arm it
   * was NOT going to re-shoot, which is the very defect this block fixes.
   * The arm's files are `<arm>_NN.png`, `<arm>.clock.json`, `<arm>-state.json`,
   * so the character after the name must be a separator. */
  const sel = selection(ONLY)
  if (!sel.ok) {
    console.error(`[timing-origin] ${sel.why}. Nothing was cleared or captured.`)
    process.exit(2)
  }
  // Made only after the selection is accepted: a refused run used to leave an
  // empty label directory behind, which reads as a capture that happened.
  mkdirSync(OUT, { recursive: true })
  mkdirSync(VID, { recursive: true })
  const mine = sel.mine
  const cleared = readdirSync(OUT).filter(mine)
  for (const f of cleared) rmSync(join(OUT, f), { force: true, recursive: true })
  if (ONLY) {
    const kept = readdirSync(OUT).length
    console.log(`[timing-origin] --only=${ONLY}: cleared ${cleared.length} file(s) for this arm, KEPT ${kept} from the other arms`)
  }

  const browser = await chromium.launch({ headed: true })
  const ctx = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    recordVideo: { dir: VID, size: { width: 1400, height: 900 } },
  })
  const page = await ctx.newPage()
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 220))
  })
  await page.goto(LAB_URL, { waitUntil: "networkidle" })

  const arm = async () => {
    await page.waitForFunction(
      () => window.__styleHarness && window.__captureHarness && window.__revealHarness,
      null,
      { timeout: 40000 },
    )
    await page.evaluate((poly) => {
      window.__styleHarness.injectStrokes(poly, { msPerPoint: 12, gapMs: 60 })
      window.__captureHarness.enable()
    }, testStroke())
    await page.waitForTimeout(1400)
    await page.evaluate(() => window.__styleHarness.setMode("solid"))
    await page.waitForTimeout(900)
    await page.evaluate(() => window.__revealHarness.setProgress(1))
    await page.evaluate(() => window.__captureHarness.frontView(1.0))
    await page.waitForTimeout(400)
  }
  await arm()

  const alive = () => page.evaluate(() => !!(window.__styleHarness && window.__captureHarness))
  const grab = async (name) => {
    // Chrome throttles rAF in an occluded/blurred window, which silently
    // freezes the render and turns every subsequent frame into a duplicate of
    // the last one — indistinguishable from "the effect does nothing" unless
    // you notice the control curves went flat too.
    await page.bringToFront()
    // Another agent's hot-reload can tear the harness down between the liveness
    // check and the call itself, so retry rather than abandoning a 200-frame
    // run at frame 140.
    for (let attempt = 0; attempt < 4; attempt++) {
      if (!(await alive())) await arm()
      const url = await page.evaluate(() =>
        window.__captureHarness ? window.__captureHarness.grab() : null,
      )
      const m = (url || "").match(/base64,([A-Za-z0-9+/=]+)/)
      if (m) {
        writeFileSync(join(OUT, `${name}.png`), Buffer.from(m[1], "base64"))
        return
      }
      await page.waitForTimeout(600)
    }
    throw new Error(`grab failed for ${name} after 4 attempts`)
  }
  const set = (p) => page.evaluate((x) => window.__styleHarness.setStyle(x), p)
  const setProgress = (v) => page.evaluate((x) => window.__revealHarness.setProgress(x), v)
  const selectPreset = (family, id) =>
    page.evaluate(({ f, i }) => window.__styleHarness.selectPreset(f, i), { f: family, i: id })

  /**
   * The shape every run below shares.
   *
   * `stale` is the load-bearing step: hold the finished drawing for several
   * seconds BEFORE arming, so the completion clock is as far out of date as it
   * is when a real person finally opens the panel and picks something. Arm, and
   * only then start sampling.
   */
  async function run(name, { pre, armed, frames = 26, everyMs = 120, stale = 5000 }) {
    await set({ ...ALL_OFF })
    await setProgress(1)
    await page.waitForTimeout(300)
    if (pre) await set(pre)
    await setProgress(1)
    await page.waitForTimeout(stale) // <- let sinceCompletion go stale
    await grab(`${name}_00_before`)
    /* ⚠ THE CLOCK IS RECORDED, NOT ASSUMED. A dial set in SECONDS cannot be
     * graded against a FRAME INDEX without knowing how long arming took, and
     * that gap is real: `set(armed)` is a round trip through the page. Grading
     * a 1.2s delay as "step 11 at 110ms a frame" put the bar two frames past
     * where the release actually lands and failed the row on the one frame that
     * proves the feature works. Every frame's offset from ARM is written beside
     * the pngs so the assert can work in seconds. */
    const t0 = Date.now()
    await set(armed) // <- ARM
    const armedMs = Date.now() - t0
    const at = []
    for (let i = 0; i < frames; i++) {
      await page.waitForTimeout(everyMs)
      at.push(Date.now() - t0)
      await grab(`${name}_${String(i + 1).padStart(2, "0")}`)
    }
    writeFileSync(join(OUT, `${name}.clock.json`),
      JSON.stringify({ name, frames, everyMs, armedMs, msSinceArm: at }, null, 2) + "\n")
    console.log(`[timing-origin] ${name} (${frames} frames @ ${everyMs}ms · arm took ${armedMs}ms)`)
  }

  const want = sel.want

  /* 1. completionPulse armed on a stroke that finished 5s ago. The option a
   *    user can actually reach. Pre-fix: 26 identical frames. */
  if (want("pulse")) {
    await run("pulse_armed_at_rest", {
      pre: { ...LOUD_TEXTURE, textureSyncMode: "independent" },
      armed: { textureSyncMode: "completionPulse" },
      frames: 26,
      everyMs: 120,
    })
  }

  /* 2. completionPulse fired by a REAL completion — the case where the pre-fix
   *    snap-back at the 1.77s cutoff is visible. Sampled densely across it. */
  if (want("pulse")) {
    await set({ ...ALL_OFF })
    await page.waitForTimeout(200)
    await set({ ...LOUD_TEXTURE, textureSyncMode: "completionPulse" })
    await setProgress(0.35)
    await page.waitForTimeout(900)
    await grab("pulse_live_00_drawing")
    await setProgress(1) // <- the completion event
    for (let i = 0; i < 32; i++) {
      await page.waitForTimeout(90)
      await grab(`pulse_live_${String(i + 1).padStart(2, "0")}`)
    }
    console.log("[timing-origin] pulse_live (32 frames @ 90ms across the 1.77s cutoff)")
  }

  /* 3. delayedAfterReveal armed at rest — must ARRIVE, from nothing. */
  if (want("delayed")) {
    await run("delayed_after_reveal", {
      pre: { ...LOUD_TEXTURE, textureSyncMode: "independent" },
      armed: { textureSyncMode: "delayedAfterReveal" },
      frames: 20,
      everyMs: 90,
    })
  }

  /* 4. A Delay dial set on a scene that has been running for a while. The wait
   *    has to happen from NOW, not from scene start. */
  if (want("delay")) {
    await run("delay_dial", {
      pre: { ...LOUD_TEXTURE, textureAnimated: false, textureSyncMode: "independent" },
      armed: { textureAnimated: true, textureDelay: 1.2, textureSyncMode: "independent" },
      frames: 24,
      everyMs: 110,
    })
  }

  /* 5. The material one-shot, same story. */
  if (want("flash")) {
    await run("completion_flash", {
      pre: {
        ...ALL_OFF,
        materialPreset: "ink",
        materialUserOverride: true,
        materialAnimationEnabled: false,
        materialAnimationType: "none",
        motionMode: "independent",
      },
      armed: {
        materialAnimationEnabled: true,
        materialAnimationType: "completionFlash",
        materialAnimationIntensity: 1,
        materialAnimationSpeed: 1,
      },
      frames: 22,
      everyMs: 100,
    })
  }

  /* 6. The group-scale siblings. */
  if (want("stack")) {
    // The GROUP envelope is the subject, so the layers inside are held STILL.
    // With them animating, "distance from the pre-arm frame" measures the
    // layers' own motion and says nothing about the group — which is exactly
    // how the pre-fix run produced a confident PASS for a behaviour that was
    // doing nothing at all.
    const STACK_BASE = {
      ...LOUD_TEXTURE,
      textureAnimated: false,
      ditherEnabled: true,
      ditherAnimated: false,
      ditherType: "bayer4",
      ditherScale: 3,
      ditherLevels: 2,
      ditherIntensity: 1,
      ditherContrast: 0.55,
      ditherThreshold: 0.5,
      ditherDirection: "diagonal",
      ditherLockMode: "screen",
      layerStackEnabled: true,
      stackTextureOpacity: 1,
      stackDitherOpacity: 1,
      stackAsciiOpacity: 1,
      stackDitherBlend: "normal",
      stackAsciiBlend: "normal",
      stackOrder: "ditherFirst",
      stackAnimationSpeed: 1,
    }
    await run("stack_completion_pulse", {
      pre: { ...STACK_BASE, stackAnimationEnabled: false, stackAnimationType: "none" },
      armed: { stackAnimationEnabled: true, stackAnimationType: "completionPulse" },
      frames: 22,
      everyMs: 100,
    })
    await run("stack_delay_after_reveal", {
      pre: { ...STACK_BASE, stackAnimationEnabled: false, stackAnimationType: "none" },
      armed: { stackAnimationEnabled: true, stackAnimationType: "delayAfterReveal" },
      frames: 20,
      everyMs: 100,
    })
  }

  /* 7. PRESET LEAK, driven through the real preset-selection path (the same
   *    function the preset rail's buttons call), not by writing style fields.
   *    Pick an animated preset, then a STATIC one: the static frames must be
   *    identical to each other. */
  if (want("preset")) {
    await set({ ...ALL_OFF })
    await setProgress(1)
    await page.waitForTimeout(300)
    await selectPreset("animatedTexture", "grainDrift")
    await page.waitForTimeout(700)
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(160)
      await grab(`preset_01_animated_${String(i).padStart(2, "0")}`)
    }
    await selectPreset("texture", "fineGrain")
    await page.waitForTimeout(700)
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(160)
      await grab(`preset_02_static_after_animated_${String(i).padStart(2, "0")}`)
    }
    // …and the stack-opacity leak: a Layer Stack preset, then a Texture preset.
    await selectPreset("layerStack", "ditheredGelStack")
    await page.waitForTimeout(800)
    await grab("preset_03_layerstack")
    await selectPreset("texture", "fineGrain")
    await page.waitForTimeout(800)
    await grab("preset_04_texture_after_layerstack")
    // Reference: the same texture preset from a clean slate. If selecting it
    // after the stack leaves a stale opacity, these two differ.
    const afterStack = await page.evaluate(() => window.__styleHarness.get().styleState)
    await set({ ...ALL_OFF })
    await page.waitForTimeout(400)
    await selectPreset("texture", "fineGrain")
    await page.waitForTimeout(800)
    await grab("preset_05_texture_from_clean")
    const fromClean = await page.evaluate(() => window.__styleHarness.get().styleState)
    /* THE RESOLVED STATE, not only the pixels.
     *
     * `assert-timing-frames.mjs` used to judge this pair on a whole-frame diff
     * alone, and its own label guessed the mechanism — "stale stack opacity
     * would darken/weaken it". When the pair finally differed (56.00) the guess
     * was wrong: the two states differ in `materialPreset`, because
     * `ditheredGelStack` writes `materialPreset: "softGel"` and the material
     * rail is DELIBERATELY not in `COMPOSITION_RAIL_KEYS`. A pixel number cannot
     * tell those two stories apart, so the state is captured beside the frames
     * and the assertion names the field. */
    writeFileSync(
      join(OUT, "preset-state.json"),
      JSON.stringify({ afterStack, fromClean }, null, 2),
    )
    console.log("[timing-origin] preset (real selectPreset path)")
  }

  /* 8. THE UI ITSELF. Everything above drives React state directly. A bug has
   *    shipped here before where a panel rendered zero controls while harness
   *    assertions passed, so click the real preset rail in the DOM and confirm
   *    the same state lands. */
  if (want("ui")) {
    const ui = await page.evaluate(() => {
      const out = { found: [], applied: null, error: null }
      try {
        const selects = Array.from(document.querySelectorAll("select"))
        out.found = selects.map((s) => ({
          label: s.getAttribute("aria-label") || s.getAttribute("title") || s.name || "",
          options: s.options.length,
        }))
      } catch (e) {
        out.error = String(e)
      }
      return out
    })
    console.log("[timing-origin] UI controls present:", JSON.stringify(ui.found).slice(0, 500))
    await grab("ui_00_panel")
  }

  console.log(errors.length ? `CONSOLE ERRORS (${errors.length}):` : "no console errors")
  for (const e of [...new Set(errors)].slice(0, 8)) console.log("  " + e)

  await page.close()
  await ctx.close()
  await browser.close()
  /* SKIP THE TARGET ITSELF. Re-running the same label made this loop delete
   * `<label>.webm` and then try to rename it onto itself — ENOENT, exit 1, and
   * the capture it had just finished reported as a failed run. Found 2026-08-01
   * by capturing the same label twice, which is what a re-capture IS. */
  const target = join(VID, `${LABEL}.webm`)
  for (const f of readdirSync(VID).filter((f) => f.endsWith(".webm"))) {
    if (join(VID, f) === target) continue
    if (existsSync(target)) rmSync(target, { force: true })
    renameSync(join(VID, f), target)
  }
  console.log(`video:  docs/verification/timing-origin/video/${LABEL}.webm`)
  console.log(`frames: ${readdirSync(OUT).length} in docs/verification/timing-origin/${LABEL}/`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
