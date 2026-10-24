// Craft-judgement capture for MATERIAL / FUSION / STACK / TIMING.
//
// WHY THIS EXISTS. Earlier passes proved these systems change pixels and do not
// regress. Nobody proved they LOOK GOOD. This script captures the evidence that
// question needs: every material preset on real geometry, every dial swept end
// to end, every animation type over a full cycle (stills AND video), every
// fusion/stack/timing option under conditions designed to expose it.
//
// STANDING RULE: HEADED, Metal ANGLE. Headless silently pauses the rAF loop
// here, so any animation verdict from it is worthless.
//
// Usage:
//   node scripts/verify/verify-material-craft.mjs --phase=presets
//   node scripts/verify/verify-material-craft.mjs --phase=dials
//   node scripts/verify/verify-material-craft.mjs --phase=matanim   (+ video)
//   node scripts/verify/verify-material-craft.mjs --phase=fusion    (+ video)
//   node scripts/verify/verify-material-craft.mjs --phase=stack     (+ video)
//   node scripts/verify/verify-material-craft.mjs --phase=timing
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync, rmSync, readdirSync, renameSync } from "node:fs"
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
const PHASE = arg("phase", "presets")
const LABEL = arg("label", PHASE)
const OUT = join(ROOT, "docs", "verification", "material-craft", LABEL)
const VID = join(ROOT, "docs", "verification", "material-craft", "video")

const MATERIALS = [
  "ink", "softGel", "matteClay", "glossyPlastic", "rubber", "signal",
  "ceramic", "chalk", "chrome", "gold", "wax", "neon", "iridescent",
  "deskDoodles",
]
const MAT_ANIMS = ["shineSweep", "gelShimmer", "roughnessPulse", "completionFlash", "signalFlicker"]
const FUSIONS = [
  "terminalGel", "ditherBloom", "signalInk", "asciiRubber",
  "scanlineBalloon", "pixelClay", "codeBloom", "glitchRibbon",
]
const STACK_ANIMS = [
  "fadeIn", "pulse", "drift", "delayAfterReveal",
  "completionPulse", "freezeOnComplete", "loop",
]
const SYNC_MODES = [
  "independent", "revealSynced", "strokeTimeSynced",
  "delayedAfterReveal", "completionPulse", "loopSynced",
]

// One loopy stroke, drawn once and reused for every comparison so every
// judgement is same-geometry / different-style.
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

// A loud three-system stack, so fusion/stack relationships have something to
// actually modulate. Each preset below overrides what it drives.
const LOUD_STACK = {
  textureEnabled: true,
  textureMode: "scanlines",
  textureAnimated: true,
  textureScale: 1.2,
  textureIntensity: 0.7,
  textureContrast: 0.6,
  textureSpeed: 1,
  textureDirection: "vertical",
  textureLockMode: "object",
  ditherEnabled: true,
  ditherAnimated: true,
  ditherType: "bayer4",
  ditherScale: 3,
  ditherLevels: 2,
  ditherIntensity: 1,
  ditherContrast: 0.55,
  ditherThreshold: 0.5,
  ditherSpeed: 1,
  ditherDirection: "diagonal",
  ditherLockMode: "screen",
  asciiEnabled: true,
  asciiAnimated: true,
  asciiCharset: "blocks",
  asciiCellSize: 13,
  asciiDensity: 0.6,
  asciiContrast: 0.5,
  asciiScrollSpeed: 1,
  asciiDirection: "vertical",
  asciiAnimationType: "scroll",
  asciiLockMode: "screen",
  motionMode: "independent",
}

const OFF_STACK = {
  textureEnabled: false, textureMode: "none", textureAnimated: false,
  ditherEnabled: false, ditherAnimated: false,
  asciiEnabled: false, asciiAnimated: false,
  layerStackEnabled: false, stackAnimationEnabled: false, stackAnimationType: "none",
  fusionPreset: "none", fusionAnimationEnabled: false,
  materialAnimationEnabled: false, materialAnimationType: "none",
  motionMode: "off",
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  mkdirSync(VID, { recursive: true })
  for (const f of readdirSync(OUT)) rmSync(join(OUT, f), { force: true, recursive: true })

  const wantsVideo = ["matanim", "fusion", "stack"].includes(PHASE)
  const browser = await chromium.launch({ headed: true })
  const ctx = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    ...(wantsVideo ? { recordVideo: { dir: VID, size: { width: 1400, height: 900 } } } : {}),
  })
  const page = await ctx.newPage()
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 220))
  })
  await page.goto(LAB_URL, { waitUntil: "networkidle" })

  // Another agent's hot-reload can wipe the harness mid-run; re-arm on demand.
  const arm = async (mode = "solid") => {
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
    await page.evaluate((m) => window.__styleHarness.setMode(m), mode)
    await page.waitForTimeout(900)
    await page.evaluate(() => window.__revealHarness.setProgress(1))
    await page.evaluate(() => window.__captureHarness.frontView(1.0))
    await page.waitForTimeout(400)
  }
  const alive = () => page.evaluate(() => !!(window.__styleHarness && window.__captureHarness))

  await arm("solid")

  const grab = async (name) => {
    if (!(await alive())) await arm(lastMode)
    const url = await page.evaluate(() => window.__captureHarness.grab())
    const m = (url || "").match(/base64,([A-Za-z0-9+/=]+)/)
    if (!m) throw new Error(`grab failed for ${name}`)
    writeFileSync(join(OUT, `${name}.png`), Buffer.from(m[1], "base64"))
  }
  const set = (p) => page.evaluate((x) => window.__styleHarness.setStyle(x), p)
  const setProgress = (v) => page.evaluate((x) => window.__revealHarness.setProgress(x), v)
  let lastMode = "solid"
  const setMode = async (m) => {
    lastMode = m
    await page.evaluate((x) => window.__styleHarness.setMode(x), m)
    await page.waitForTimeout(800)
    await page.evaluate(() => window.__captureHarness.frontView(1.0))
    await page.waitForTimeout(300)
  }
  const view = async (az, el, k = 1.0) => {
    await page.evaluate(
      ({ az, el, k }) => window.__captureHarness.orbitView(az, el, k),
      { az, el, k },
    )
    await page.waitForTimeout(220)
  }

  /* ================= PHASE: material presets on real geometry ============ */
  if (PHASE === "presets") {
    for (const mode of ["solid", "rod"]) {
      await setMode(mode)
      await set(OFF_STACK)
      await page.waitForTimeout(300)
      for (const mat of MATERIALS) {
        await set({ materialPreset: mat, materialUserOverride: true })
        await page.waitForTimeout(320)
        await view(0, 0, 1.0)
        await grab(`front_${mode}_${mat}`)
        await view(34, 20, 1.0)
        await grab(`orbit_${mode}_${mat}`)
        await view(0, 0, 0.42) // close-up: highlight structure at real scale
        await grab(`close_${mode}_${mat}`)
      }
      console.log(`[presets] ${mode} done`)
    }
  }

  /* ================= PHASE: every dial swept end to end ================== */
  if (PHASE === "dials") {
    await setMode("solid")
    const steps = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]

    // 1. materialAnimationIntensity, per animation type, phase-frozen so the
    //    only variable is the dial. motionMode syncToDraw + reveal pinned gives
    //    a deterministic phase.
    for (const type of MAT_ANIMS) {
      await set({
        ...OFF_STACK,
        materialPreset: type === "signalFlicker" ? "signal" : type === "roughnessPulse" ? "matteClay" : type === "gelShimmer" ? "softGel" : "glossyPlastic",
        materialUserOverride: true,
        materialAnimationEnabled: true,
        materialAnimationType: type,
        materialAnimationSpeed: 1,
        motionMode: "syncToDraw",
      })
      await setProgress(1)
      await page.waitForTimeout(400)
      for (const s of steps) {
        await set({ materialAnimationIntensity: s })
        await page.waitForTimeout(260)
        await grab(`matint_${type}_${String(Math.round(s * 100)).padStart(3, "0")}`)
      }
      console.log(`[dials] matint ${type}`)
    }

    // 2. fusionIntensity, per fusion preset, phase-frozen (motionMode off pins
    //    the fusion clock at its fixed representative phase).
    for (const fp of FUSIONS) {
      await set({ ...LOUD_STACK, materialPreset: "ink", materialUserOverride: true, motionMode: "off", fusionPreset: fp, fusionAnimationEnabled: false })
      await setProgress(1)
      await page.waitForTimeout(420)
      for (const s of steps) {
        await set({ fusionIntensity: s })
        await page.waitForTimeout(240)
        await grab(`fusint_${fp}_${String(Math.round(s * 100)).padStart(3, "0")}`)
      }
      console.log(`[dials] fusint ${fp}`)
    }

    // 3. stack opacities — each layer's composition dial, others held at 1.
    for (const [key, label] of [
      ["stackTextureOpacity", "tex"],
      ["stackDitherOpacity", "dit"],
      ["stackAsciiOpacity", "asc"],
    ]) {
      await set({
        ...LOUD_STACK, motionMode: "off", fusionPreset: "none",
        materialPreset: "ink", materialUserOverride: true,
        layerStackEnabled: true,
        stackTextureOpacity: 1, stackDitherOpacity: 1, stackAsciiOpacity: 1,
        stackDitherBlend: "normal", stackAsciiBlend: "normal",
      })
      await page.waitForTimeout(380)
      for (const s of steps) {
        await set({ [key]: s })
        await page.waitForTimeout(230)
        await grab(`stackop_${label}_${String(Math.round(s * 100)).padStart(3, "0")}`)
      }
      console.log(`[dials] stackop ${label}`)
    }

    // 4. custom-material dials — the only place a user edits raw PBR numbers.
    await set({
      ...OFF_STACK, materialPreset: "custom", materialUserOverride: true,
    })
    await page.waitForTimeout(400)
    const CUSTOM_DIALS = [
      ["roughness", 0, 1], ["metalness", 0, 1], ["clearcoat", 0, 1],
      ["sheen", 0, 1], ["envMapIntensity", 0, 3], ["emissiveIntensity", 0, 2],
    ]
    for (const [key, lo, hi] of CUSTOM_DIALS) {
      // Reset to the neutral custom base each time.
      await page.evaluate(() =>
        window.__styleHarness.setCustom({
          color: "#2a2a2a", roughness: 0.5, metalness: 0, clearcoat: 0.4,
          sheen: 0, sheenColor: "#000000", emissive: "#000000",
          emissiveIntensity: 0, envMapIntensity: 1,
        }),
      )
      await page.waitForTimeout(260)
      for (const s of steps) {
        const v = lo + (hi - lo) * s
        await page.evaluate(({ k, v }) => window.__styleHarness.setCustom({ [k]: v }), { k: key, v })
        await page.waitForTimeout(230)
        await grab(`custom_${key}_${String(Math.round(s * 100)).padStart(3, "0")}`)
      }
      console.log(`[dials] custom ${key}`)
    }
  }

  /* ============ PHASE: material animation types (stills + video) ========= */
  if (PHASE === "matanim") {
    await setMode("solid")
    // Each animation on the preset it exists for AND on a neutral control, so
    // "works only on its home preset" shows up as a finding.
    const HOME = {
      shineSweep: "glossyPlastic",
      gelShimmer: "softGel",
      roughnessPulse: "matteClay",
      completionFlash: "ink",
      signalFlicker: "signal",
    }
    for (const type of MAT_ANIMS) {
      for (const mat of [HOME[type], "ink", "chalk"]) {
        await set({
          ...OFF_STACK, materialPreset: mat, materialUserOverride: true,
          materialAnimationEnabled: true, materialAnimationType: type,
          materialAnimationSpeed: 1, materialAnimationIntensity: 0.5,
          motionMode: "independent",
        })
        await setProgress(1)
        await page.waitForTimeout(500)
        // 24 frames across ~3.2s — enough to catch a full cycle of every type.
        for (let i = 0; i < 24; i++) {
          await page.waitForTimeout(135)
          await grab(`anim_${type}_${mat}_${String(i).padStart(2, "0")}`)
        }
        console.log(`[matanim] ${type} on ${mat}`)
      }
    }
    // completionFlash needs a real completion event, not a pinned reveal.
    for (const mat of ["ink", "chalk"]) {
      await set({
        ...OFF_STACK, materialPreset: mat, materialUserOverride: true,
        materialAnimationEnabled: true, materialAnimationType: "completionFlash",
        materialAnimationSpeed: 1, materialAnimationIntensity: 1,
        motionMode: "independent",
      })
      await setProgress(0.5)
      await page.waitForTimeout(500)
      await grab(`flash_${mat}_00_before`)
      await setProgress(0.95)
      await page.waitForTimeout(140)
      await grab(`flash_${mat}_01_ramp`)
      await setProgress(1)
      for (let i = 0; i < 12; i++) {
        await page.waitForTimeout(150)
        await grab(`flash_${mat}_${String(i + 2).padStart(2, "0")}_after`)
      }
      console.log(`[matanim] completionFlash event on ${mat}`)
    }
    // Video: one long take per animation on its home preset.
    for (const type of MAT_ANIMS) {
      await set({
        ...OFF_STACK, materialPreset: HOME[type], materialUserOverride: true,
        materialAnimationEnabled: true, materialAnimationType: type,
        materialAnimationSpeed: 1, materialAnimationIntensity: 0.7,
        motionMode: "independent",
      })
      await setProgress(1)
      await page.waitForTimeout(4200)
    }
  }

  /* ================ PHASE: fusion (stills + video) ====================== */
  if (PHASE === "fusion") {
    await setMode("solid")
    const FUSE_MAT = {
      terminalGel: "softGel", ditherBloom: "ink", signalInk: "signal",
      asciiRubber: "rubber", scanlineBalloon: "softGel", pixelClay: "matteClay",
      codeBloom: "ink", glitchRibbon: "signal",
    }
    // Baseline: the loud stack with NO fusion, per material — every fusion
    // frame is judged against its own material's un-fused look.
    for (const fp of FUSIONS) {
      await set({ ...LOUD_STACK, materialPreset: FUSE_MAT[fp], materialUserOverride: true, fusionPreset: "none", fusionAnimationEnabled: false, motionMode: "off" })
      await setProgress(1)
      await page.waitForTimeout(420)
      await grab(`base_${fp}`)
    }
    for (const fp of FUSIONS) {
      for (const animated of [false, true]) {
        await set({
          ...LOUD_STACK, materialPreset: FUSE_MAT[fp], materialUserOverride: true,
          fusionPreset: fp, fusionAnimationEnabled: animated,
          fusionIntensity: 0.5, fusionAnimationSpeed: 1,
          motionMode: "independent",
        })
        await setProgress(1)
        await page.waitForTimeout(500)
        const tag = animated ? "anim" : "static"
        for (let i = 0; i < 20; i++) {
          await page.waitForTimeout(180)
          await grab(`fus_${fp}_${tag}_${String(i).padStart(2, "0")}`)
        }
        console.log(`[fusion] ${fp} ${tag}`)
      }
    }
    // Video: each fusion preset, animated, long enough for its choreography.
    for (const fp of FUSIONS) {
      await set({
        ...LOUD_STACK, materialPreset: FUSE_MAT[fp], materialUserOverride: true,
        fusionPreset: fp, fusionAnimationEnabled: true,
        fusionIntensity: 0.85, fusionAnimationSpeed: 1, motionMode: "independent",
      })
      await setProgress(1)
      await page.waitForTimeout(5000)
    }
  }

  /* ================ PHASE: stack (stills + video) ======================= */
  if (PHASE === "stack") {
    await setMode("solid")
    const STACK_BASE = {
      ...LOUD_STACK, materialPreset: "ink", materialUserOverride: true,
      fusionPreset: "none", motionMode: "off", layerStackEnabled: true,
      stackTextureOpacity: 1, stackDitherOpacity: 1, stackAsciiOpacity: 1,
      stackDitherBlend: "normal", stackAsciiBlend: "normal",
      stackOrder: "ditherFirst", stackAnimationEnabled: false,
      stackAnimationType: "none",
    }
    // blend × order matrix
    for (const db of ["normal", "multiply", "screen"]) {
      for (const ab of ["normal", "multiply", "screen"]) {
        for (const order of ["ditherFirst", "asciiFirst"]) {
          await set({ ...STACK_BASE, stackDitherBlend: db, stackAsciiBlend: ab, stackOrder: order })
          await setProgress(1)
          await page.waitForTimeout(300)
          await grab(`blend_${db}_${ab}_${order}`)
        }
      }
    }
    console.log("[stack] blend x order matrix done")
    // group animation behaviours
    for (const beh of STACK_ANIMS) {
      await set({ ...STACK_BASE, stackAnimationEnabled: false, stackAnimationType: "none", motionMode: "independent" })
      await page.waitForTimeout(320)
      await setProgress(beh === "delayAfterReveal" || beh === "completionPulse" || beh === "freezeOnComplete" ? 0.4 : 1)
      await page.waitForTimeout(280)
      await set({ ...STACK_BASE, motionMode: "independent", stackAnimationEnabled: true, stackAnimationType: beh, stackAnimationSpeed: 1, styleLoopSeconds: 3 })
      await page.waitForTimeout(120)
      for (let i = 0; i < 18; i++) {
        if (i === 6 && (beh === "delayAfterReveal" || beh === "completionPulse" || beh === "freezeOnComplete")) {
          await setProgress(1)
        }
        await page.waitForTimeout(170)
        await grab(`sanim_${beh}_${String(i).padStart(2, "0")}`)
      }
      console.log(`[stack] ${beh}`)
    }
    // Video: drift, pulse, loop, freezeOnComplete
    for (const beh of ["pulse", "drift", "loop", "freezeOnComplete"]) {
      await set({ ...STACK_BASE, motionMode: "independent", stackAnimationEnabled: true, stackAnimationType: beh, stackAnimationSpeed: 1, styleLoopSeconds: 3 })
      await setProgress(1)
      await page.waitForTimeout(4500)
    }
  }

  /* ================ PHASE: timing sync modes ============================ */
  if (PHASE === "timing") {
    await setMode("solid")
    const T = {
      ...OFF_STACK,
      materialPreset: "ink", materialUserOverride: true,
      textureEnabled: true, textureMode: "scanlines", textureAnimated: true,
      textureScale: 1, textureIntensity: 0.8, textureContrast: 0.6,
      textureSpeed: 2, textureDirection: "vertical", textureLockMode: "object",
      motionMode: "independent",
    }
    // Each mode gets the SAME scripted reveal timeline, so differences are the
    // mode's own behaviour rather than different inputs.
    for (const sm of SYNC_MODES) {
      await set({ ...T, textureSyncMode: sm, styleLoopSeconds: 2 })
      await setProgress(0)
      await page.waitForTimeout(500)
      // t0..t3 : reveal climbing 0 -> 1 in four steps
      for (let i = 0; i < 4; i++) {
        await setProgress(i / 3)
        await page.waitForTimeout(200)
        await grab(`sync_${sm}_r${i}`)
      }
      // p0..p9 : reveal pinned at 1, free time running
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(190)
        await grab(`sync_${sm}_p${String(i).padStart(2, "0")}`)
      }
      console.log(`[timing] ${sm}`)
    }
    // Scrub test: does the mode follow the playhead backwards?
    for (const sm of SYNC_MODES) {
      await set({ ...T, textureSyncMode: sm, motionMode: "syncToDraw" })
      for (const [i, p] of [0, 0.25, 0.5, 0.75, 1].entries()) {
        await setProgress(p)
        await page.waitForTimeout(220)
        await grab(`scrub_${sm}_${i}`)
      }
    }
  }

  console.log(errors.length ? `CONSOLE ERRORS (${errors.length}):` : "no console errors")
  for (const e of [...new Set(errors)].slice(0, 8)) console.log("  " + e)

  await page.close()
  await ctx.close()
  await browser.close()
  if (wantsVideo) {
    // Name the take after the phase instead of playwright's random hash.
    for (const f of readdirSync(VID).filter((f) => f.endsWith(".webm"))) {
      const target = join(VID, `${LABEL}.webm`)
      rmSync(target, { force: true })
      renameSync(join(VID, f), target)
    }
    console.log(`video: docs/verification/material-craft/video/${LABEL}.webm`)
  }
  console.log(`frames: ${readdirSync(OUT).length} in docs/verification/material-craft/${LABEL}/`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
