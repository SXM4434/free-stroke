// THE PRESET RAIL ON SCREEN — does each new preset MOVE PIXELS, and do the
// new group dials do what their labels say?
//
// The companion model gate (assert-preset-registry.mjs) decides everything that
// is decidable from state. This one answers the two questions state cannot:
//
//   · does the render actually change — and for the animated families, does it
//     change OVER TIME — when the preset is chosen through the REAL selection
//     path the UI calls (`__styleHarness.selectPreset` → handleSelectPreset →
//     applyPresetToStyleState), not a synthesized one;
//   · is the panel telling the truth — the family the rail offers, the pills it
//     renders, and which of them it refuses to let you click.
//
// TWO THINGS THIS FILE DOES DIFFERENTLY, BOTH BECAUSE OF FAILURES ON RECORD
//
//   1. prefers-reduced-motion is emulated to `no-preference` explicitly.
//      Headless Chrome defaults to `reduce`, and viewport-3d gates the entire
//      group animation on `!reduceMotion` (:2127). Without the emulation every
//      animated row would measure still and the gate would confidently report
//      that twelve working presets are dead.
//
//   2. Direction and phase are measured on `revealSynced`, whose offset is
//      driven by the PLAYHEAD rather than by wall clock. Every other behaviour
//      moves while the harness is talking to it, so an A/B across two grabs is
//      a race: at drift's own rate a 50 ms scheduling jitter is worth 0.03 of
//      offset, and the control arm would inherit that same jitter and read as a
//      difference. Pinning the playhead makes both arms deterministic, and the
//      model gate has already proven that drift and loop take the identical
//      `dir` code path.
//
// Usage: node scripts/verify/assert-preset-pixels.mjs
//        node scripts/verify/assert-preset-pixels.mjs --save   (also write frames)
import { chromium } from "./lib/browser.mjs"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { LAB_URL } from "./lib/dev-server.mjs"
// The registry is the DATA half of the pill-row cross-check below: which
// Family-14 members carry a take, read from `lib/style-system.ts` rather than
// counted out in this file. See the note on `gaPills`.
import { loadTs } from "./_ts-load.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const has = (k) => process.argv.includes(`--${k}`)
const SAVE = has("save")
const OUT = join(ROOT, "docs", "verification", "preset-families")

let fails = 0
let checks = 0
const say = (ok, label, detail) => {
  checks++
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

/* ---------------------------- pixel helpers ---------------------------- */
async function decode(dataUrl) {
  const buf = Buffer.from(dataUrl.match(/base64,(.+)/)[1], "base64")
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  return {
    d: c.getContext("2d").getImageData(0, 0, img.width, img.height).data,
    w: img.width,
    h: img.height,
    buf,
  }
}

/**
 * SPATIAL DETAIL — mean absolute luminance step between horizontally adjacent
 * inked pixels.
 *
 * This is the instrument that answers "is a graphic layer ON this surface",
 * and it exists because the obvious instrument does not. Comparing a frame to
 * a composed reference cannot separate "the group moved" from "the group was
 * emptied", and comparing it to an EMPTIED reference cannot separate "emptied"
 * from "dimmed" — measured: `stackWhisperDrift`, whose whole design is a group
 * held at 0.4 opacity, landed NEARER the empty stack than the composition and
 * was reported as a wipe. It was doing exactly what its name says.
 *
 * Scanlines, a Bayer matrix and a glyph grid are all HIGH SPATIAL FREQUENCY;
 * a bare shaded material is smooth. So the presence of the composition is a
 * property of the surface's texture, not of its distance from any one frame,
 * and it survives both a phase shift and a dim.
 */
function detail(a) {
  let s = 0
  let n = 0
  for (let y = 0; y < a.h; y++) {
    const row = y * a.w * 4
    for (let x = 0; x < a.w - 1; x++) {
      const i = row + x * 4
      const j = i + 4
      if (a.d[i + 3] < 20 || a.d[j + 3] < 20) continue
      const l1 = 0.2126 * a.d[i] + 0.7152 * a.d[i + 1] + 0.0722 * a.d[i + 2]
      const l2 = 0.2126 * a.d[j] + 0.7152 * a.d[j + 1] + 0.0722 * a.d[j + 2]
      s += Math.abs(l1 - l2)
      n++
    }
  }
  return n ? s / n : 0
}
/** Mean absolute RGB difference over pixels where either frame carries ink. */
function diff(a, b) {
  let sum = 0
  let n = 0
  for (let i = 0; i < a.d.length; i += 4) {
    if (a.d[i + 3] < 20 && b.d[i + 3] < 20) continue
    sum +=
      (Math.abs(a.d[i] - b.d[i]) + Math.abs(a.d[i + 1] - b.d[i + 1]) + Math.abs(a.d[i + 2] - b.d[i + 2])) / 3
    n++
  }
  return n ? sum / n : 0
}
/** Mean luminance over inked pixels — "how present is the effect". */
function presence(a) {
  let s = 0
  let n = 0
  for (let i = 0; i < a.d.length; i += 4) {
    if (a.d[i + 3] < 20) continue
    s += (a.d[i] + a.d[i + 1] + a.d[i + 2]) / 3
    n++
  }
  return n ? s / n : 0
}

function testStroke() {
  const pts = []
  for (let i = 0; i <= 120; i++) {
    const t = i / 120
    pts.push({ x: 120 + t * 620, y: 330 + Math.sin(t * Math.PI * 2.2) * 130 })
  }
  return [pts]
}

/* A real composition, so the group behaviours have something to move. Matches
 * the one verify-stack-anim.mjs uses so the two agree about what a stack is. */
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
  ditherExposure: 0.5,
  ditherLockMode: "screen",
  ditherAnimated: true,
  ditherSpeed: 1.2,
  ditherDirection: "diagonal",
  ditherSyncMode: "independent",
  asciiEnabled: true,
  asciiCharset: "blocks",
  asciiCellSize: 14,
  asciiAnimated: false,
  motionMode: "independent",
  stackTextureOpacity: 0.8,
  stackDitherOpacity: 0.9,
  stackAsciiOpacity: 0.7,
  stackOrder: "ditherFirst",
  stackAnimationOpacity: 1,
}

async function main() {
  if (SAVE) mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ headed: true })
  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 },
    // See the header: without this the whole group animation is gated off and
    // every animated row would measure dead.
    reducedMotion: "no-preference",
  })
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 160))
  })
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 160)))
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(
    () => window.__styleHarness && window.__captureHarness && window.__revealHarness && window.__geomDebug,
    null,
    { timeout: 30000 },
  )

  const set = (p) => page.evaluate((x) => window.__styleHarness.setStyle(x), p)
  const pick = (f, id) => page.evaluate(([a, b]) => window.__styleHarness.selectPreset(a, b), [f, id])
  const prog = (v) => page.evaluate((x) => window.__revealHarness.setProgress(x), v)
  const state = () => page.evaluate(() => window.__styleHarness.get().styleState)
  const clock = () => page.evaluate(() => window.__geomDebug.styleClock())
  const builds = () => page.evaluate(() => window.__geomDebug.buildCount())
  const shot = async (name) => {
    const u = await page.evaluate(() => window.__captureHarness.grab())
    const f = await decode(u)
    if (SAVE && name) writeFileSync(join(OUT, `${name}.png`), f.buf)
    return f
  }
  const wait = (ms) => page.waitForTimeout(ms)

  /* ------------------- PHASE 1 · the panel tells the truth ----------------
   * FIRST, before capture mode is enabled. Capture mode mounts a fixed
   * 1920x1080 render target that covers the page and swallows pointer events —
   * a real click on the Preset chip times out under it, which is how this
   * phase was originally written and why it is now first. */
  console.log("\n=== 1 · the rail, in the real DOM ===")
  await page.click('button[title="Edit Preset"]')
  await wait(300)
  const famSel = await page.$$eval("select", (ss) =>
    ss.map((s) => [...s.options].map((o) => o.value)),
  )
  const famList = famSel.find((l) => l.includes("material") && l.includes("dither")) ?? []
  say(
    famList.includes("animatedMaterial"),
    "the Animated Material family is offered on the rail",
    famList.join(", "),
  )
  /* ⚠ THIS CONTROL'S PREMISE EXPIRED WHEN THE ROUTING LANDED, and it is the
   * second stale premise in this file (see STATIC_STACK below for the first).
   *
   * It asserted that geometry and view are NOT on the rail "because their
   * routing does not exist yet". It exists: `applyGeometryPresetById` and
   * `applyViewPresetById` in app/page.tsx, opted into by `ROUTED_FAMILIES` in
   * components/style-panel-scaffold.tsx:77 — whose own comment says "THAT
   * ROUTING NOW EXISTS … so the gate's condition is met". Corroborated by two
   * sibling gates that are fully green: assert-geometry-presets (14/14) and
   * assert-view-presets (12/12).
   *
   * THE INTENT SURVIVES AND IS WHAT IS ASSERTED NOW. The row exists to stop the
   * rail offering a family whose patch cannot land — the failure named at
   * app/page.tsx:925, where a pill that cannot reach its state "does not do
   * nothing", it runs the composition reset and WIPES the user's work. So the
   * question is no longer "are they absent" but "are they present AND routed":
   * both families offered, and a member the router does not know still refused.
   * That is strictly stronger than the row it replaces, and it fails in both
   * directions: it goes red if a family is dropped from the rail, and red if the
   * router stops refusing what it cannot serve.
   *
   * ⚠ THE REFUSED SUBJECT CHANGED 2026-08-03 and the reason is worth keeping.
   * It used to be `videoPreviewExport`, described here as "the one member whose
   * capability is still missing — there is no frame writer anywhere in the app".
   * That sentence was already false when it was written (`lib/export/` had
   * shipped the writer on 2026-08-01); the real gap was one `else if` in
   * `applyViewPresetById`, and it is now wired. Selecting that member today
   * starts a multi-second render, so using it as a "refused" control would both
   * assert a defect and fire an export inside a pixel gate. The control is
   * re-pointed at an id `resolveViewPreset` genuinely cannot serve, which is a
   * refusal that does not expire when the roadmap moves. */
  const routedOffered = famList.includes("geometry") && famList.includes("view")
  const stillRefused = await page.evaluate(() => {
    const w = window
    return typeof w.__styleHarness.selectViewPreset === "function"
      ? w.__styleHarness.selectViewPreset("__not_a_view_preset__") === false
      : null
  })
  say(
    routedOffered && stillRefused === true,
    "geometry and view ARE offered — their routing exists — and a member the router cannot serve is still refused",
    `${famList.length} families offered`,
  )

  const pillsFor = async (family) => {
    await page.evaluate((f) => {
      const sel = [...document.querySelectorAll("select")].find((s) =>
        [...s.options].some((o) => o.value === "animatedMaterial"),
      )
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set
      setter.call(sel, f)
      sel.dispatchEvent(new Event("change", { bubbles: true }))
    }, family)
    await wait(250)
    return page.evaluate(() => {
      const wrap = [...document.querySelectorAll("div")].find(
        (d) => d.className.includes("max-w-lg") && d.className.includes("flex-wrap"),
      )
      if (!wrap) return null
      return [...wrap.querySelectorAll("button")].map((b) => ({
        label: b.textContent.trim(),
        disabled: b.disabled,
      }))
    })
  }

  const amPills = await pillsFor("animatedMaterial")
  say(
    !!amPills && amPills.length === 11 && amPills.every((p) => !p.disabled),
    "all 11 Animated Material pills render and every one is selectable",
    amPills ? `${amPills.length} pills, ${amPills.filter((p) => p.disabled).length} disabled` : "no pill row found",
  )
  /* ── THE NEGATIVE CONTROL FOR THE ROW ABOVE, AND IT HAD EXPIRED ──────────
   *
   * The row above passes when eleven pills come back with `disabled: false`.
   * On its own that is vacuous: if `b.disabled` were misread as `undefined`
   * for every button it would still be green. This row is what proves the
   * instrument can see a disabled pill, so it needs one to exist.
   *
   * 🔴 IT USED TO DEMAND ALL SIX FAMILY-14 PILLS BE NON-SELECTABLE, and that
   * went red on 2026-09-04 reading `6 pills, 1 disabled`. The app was right and
   * the row was stale prose: five of the six now carry a real `motion` take
   * (`GEOMETRY_ANIMATION_PRESET_DEFS`, `implemented: true`), and
   * `presetIsSelectable`'s `geometryAnimation` arm enables exactly those. Only
   * `completionPulse` is still a shell — it needs the mark to move after it has
   * arrived, and the reveal is a prefix of a sorted key array, which cannot
   * express a settle.
   *
   * So the row is DERIVED now instead of counted out here. `lib/style-system.ts`
   * says which members carry a take; the DOM says which pills are clickable;
   * this asserts the two agree, member for member. That is strictly stronger
   * than "all six are dead": it goes red if the scaffold stops disabling a
   * shell — the defect at `app/page.tsx:925`, where a pill that cannot reach
   * its state runs the composition reset and WIPES the drawing — and equally
   * red if it starts disabling a member that has a take.
   *
   * ⚠ AND IT CANNOT EXPIRE QUIETLY A SECOND TIME. If Family 14 ever ships its
   * last shell the derived set is empty, there is no disabled pill left to see,
   * and this row FAILS saying so rather than passing on a set of nothing.
   */
  const FAM14 = loadTs("lib/style-system.ts").PRESET_REGISTRY.geometryAnimation
  /* Mirrors `presetIsSelectable`'s Family-14 arm: the take lives on `motion`. */
  const shells = FAM14.filter((p) => !p.motion).map((p) => p.label)
  const gaPills = await pillsFor("geometryAnimation")
  /* The disabled pills wear a "soon" badge inside the button, so the rendered
   * text is the label with it appended. Resolve back to the registry label. */
  const named = (p) => FAM14.find((d) => p.label.startsWith(d.label))?.label ?? p.label
  const domDisabled = (gaPills ?? []).filter((p) => p.disabled).map(named)
  const setsAgree =
    !!gaPills &&
    gaPills.length === FAM14.length &&
    shells.length > 0 &&
    shells.length === domDisabled.length &&
    shells.every((l) => domDisabled.includes(l))
  say(
    setsAgree,
    "CONTROL · the Family-14 pills with no take render NON-SELECTABLE, and only those",
    gaPills
      ? `${gaPills.length} pills of ${FAM14.length} · disabled on screen [${domDisabled.join(", ") || "none"}] · shells in the registry [${shells.join(", ") || "NONE — the control has expired, there is no dead pill left to prove `disabled` is read"}]`
      : "no pill row found",
  )
  await pillsFor("animatedMaterial")
  // Close the drawer so the fixed capture target has the viewport to itself.
  await page.click('button[title="Close Preset"]')
  await wait(300)

  /* --------------------------- PHASE 1b · setup -------------------------- */
  await page.evaluate((p) => {
    window.__styleHarness.injectStrokes(p, { msPerPoint: 12 })
    window.__captureHarness.enable()
  }, testStroke())
  await wait(1600)
  await page.evaluate(() => window.__styleHarness.setMode("solid"))
  await wait(900)
  await page.evaluate(() => window.__captureHarness.frontView(1))
  await prog(1)
  await wait(400)

  const rm = (await clock()).reduceMotion
  say(rm === false, "the page is running with reduced-motion OFF (or every animated row is vacuous)", `reduceMotion=${rm}`)

  /* --------------- PHASE 2 · animated material moves pixels -------------- */
  console.log("\n=== 2 · animated material — every preset, through the real selection path ===")
  await set({ ...STACK, layerStackEnabled: false, textureEnabled: false, ditherEnabled: false, asciiEnabled: false, motionMode: "independent" })
  await page.evaluate(() => window.__styleHarness.setMaterial("softGel"))
  await wait(500)
  const buildsBefore = await builds()

  // Drive by id, not by label — the ids are the module's, so the two cannot drift.
  const amIds = [
    "shineSweepAcross",
    "slowGlassSweep",
    "gelShimmerBreath",
    "deepGelBloom",
    "roughnessPulseWet",
    "wetClayBreath",
    "completionFlashOne",
    "completionAfterglow",
    "signalFlickerFault",
    "dyingTube",
    "stillSurface",
  ]
  /* THE SAMPLING WINDOW IS SCALED BY THE PRESET'S OWN SPEED, and the first
   * version of this loop was not — it sampled every preset over a fixed 660 ms
   * and reported `slowGlassSweep` at EXACTLY 0.000, i.e. seven byte-identical
   * frames, which reads as a dead preset.
   *
   * It is not dead; 660 ms was the wrong window. The sweep band's cycle is
   * `(elapsed * speed / 2.6) % 1` with the band amplitude forced to 0 for the
   * last 12% of it (components/viewport-3d.tsx:2464-2482). At speed 0.3 that
   * cycle is 8.67 s and its off-form beat alone lasts 1.04 s — longer than the
   * whole window — so the sample could sit entirely inside the gap between two
   * passes and record a still image of a moving effect.
   *
   * A window shorter than the thing's period measures nothing and says zero,
   * which is the same failure shape as a metric that cannot fail. Every preset
   * now gets ~97% of ITS OWN cycle, and `stillSurface` is held to the same rule
   * as the control — if the wider window made everything look alive, the still
   * row would move too. */
  const speedOf = {
    shineSweepAcross: 1,
    slowGlassSweep: 0.3,
    gelShimmerBreath: 1,
    deepGelBloom: 0.4,
    roughnessPulseWet: 1,
    wetClayBreath: 0.3,
    completionFlashOne: 1,
    completionAfterglow: 0.18,
    signalFlickerFault: 1,
    dyingTube: 0.35,
    stillSurface: 1,
  }
  const amResult = {}
  for (const id of amIds) {
    // Re-arm through the same "select none, then select" the panel produces
    // when a user moves between pills.
    await pick("animatedMaterial", "stillSurface")
    await wait(200)
    await pick("animatedMaterial", id)
    await wait(300)
    const step = Math.min(1500, Math.round(420 / Math.max(0.15, speedOf[id])))
    const frames = []
    for (let i = 0; i < 7; i++) {
      frames.push(await shot(SAVE ? `am_${id}_${i}` : null))
      await wait(step)
    }
    let motion = 0
    for (let i = 1; i < frames.length; i++) motion += diff(frames[i - 1], frames[i])
    amResult[id] = { motion: motion / (frames.length - 1), first: frames[0], pres: presence(frames[0]), step }
    console.log(
      `        ${id.padEnd(20)} consecΔ ${amResult[id].motion.toFixed(3).padStart(7)}  lum ${amResult[id].pres.toFixed(1).padStart(6)}  (7 frames x ${step}ms)`,
    )
  }
  const buildsAfter = await builds()
  say(
    buildsAfter === buildsBefore,
    "selecting 11 animated-material presets rebuilt geometry ZERO times (PRD phase gate)",
    `buildCount ${buildsBefore} → ${buildsAfter}`,
  )

  const stillMotion = amResult.stillSurface.motion
  say(stillMotion < 0.35, "'Still Surface' measures STILL — the family's own control", `consecΔ ${stillMotion.toFixed(3)}`)
  const notMoving = amIds
    .filter((id) => id !== "stillSurface")
    .filter((id) => amResult[id].motion <= stillMotion * 3 + 0.4)
  say(
    notMoving.length === 0,
    "every other animated-material preset MOVES on screen, well clear of the still control",
    notMoving.length
      ? notMoving.map((id) => `${id} ${amResult[id].motion.toFixed(3)}`).join(", ")
      : `10 moving, floor ${(stillMotion * 3 + 0.4).toFixed(3)}`,
  )
  // The two shineSweep presets are the ones the model gate could not judge:
  // their motion lives in the shader, not in the material params.
  say(
    amResult.shineSweepAcross.motion > stillMotion * 3 + 0.4 &&
      amResult.slowGlassSweep.motion > stillMotion * 3 + 0.4,
    "the shader-driven sweeps travel (the exemption the model gate names is CLOSED here)",
    `shineSweep ${amResult.shineSweepAcross.motion.toFixed(3)} · slowGlass ${amResult.slowGlassSweep.motion.toFixed(3)}`,
  )

  const collapsed = []
  for (let i = 0; i < amIds.length; i++) {
    for (let j = i + 1; j < amIds.length; j++) {
      const d = diff(amResult[amIds[i]].first, amResult[amIds[j]].first)
      const dm = Math.abs(amResult[amIds[i]].motion - amResult[amIds[j]].motion)
      if (d < 0.6 && dm < 0.35) collapsed.push(`${amIds[i]}=${amIds[j]} (Δpx ${d.toFixed(2)}, Δmotion ${dm.toFixed(2)})`)
    }
  }
  say(collapsed.length === 0, "no two animated-material presets collapse onto the same look", collapsed.join(" | ") || "55 pairs, 0 collapsed")
  say(
    diff(amResult.dyingTube.first, amResult.dyingTube.first) === 0,
    "CONTROL · the pixel comparison reports EXACTLY 0 for a frame against itself",
  )

  /* ------- PHASE 3 · a stack-animation preset must not empty the stack ---- */
  console.log("\n=== 3 · stack animation preserves the composition it animates ===")
  /* TWO REFERENCES, not one — and the first version of this check had only one,
   * which made it wrong in an instructive way. It asserted that a frame taken
   * after selecting a stack-animation preset stayed CLOSE to the composed
   * frame, and every arm failed at 74-95 Δpx. Those presets ANIMATE the group;
   * of course the frame differs from a still reference. "Distance from the
   * composition" cannot separate "the group moved" from "the group was
   * emptied", so it was measuring the wrong thing in a way that happened to
   * look like a defect.
   *
   * The discriminant is which of TWO references the frame is nearer: the
   * composition, or the same stack with its layers switched off. */
  await set({ ...STACK, textureEnabled: false, ditherEnabled: false, asciiEnabled: false })
  await wait(600)
  const emptied = await shot(SAVE ? "stack_emptied" : null)
  await set(STACK)
  await wait(600)
  const composed = await shot(SAVE ? "stack_composed" : null)
  const composedState = await state()
  say(
    composedState.textureEnabled && composedState.ditherEnabled && composedState.asciiEnabled,
    "the reference composition is loaded (texture + dither + ASCII all on)",
  )
  const detComposed = detail(composed)
  const detEmpty = detail(emptied)
  /* The bar: a quarter of the way from a bare surface to the full composition.
   * Low enough that a deliberately faint group (whisper, 0.4 opacity) is not
   * called a wipe; high enough that an actually-empty stack cannot clear it,
   * which the control below is required to demonstrate. */
  const FLOOR = detEmpty + 0.25 * (detComposed - detEmpty)
  say(
    detComposed > detEmpty * 1.5,
    "CONTROL · the two references separate on spatial detail, so the discriminant has room",
    `composed ${detComposed.toFixed(2)} vs emptied ${detEmpty.toFixed(2)} — floor ${FLOOR.toFixed(2)}`,
  )
  say(
    !(detEmpty > FLOOR),
    "CONTROL · the EMPTY stack FAILS the same check the presets have to pass",
    `${detEmpty.toFixed(2)} <= ${FLOOR.toFixed(2)}`,
  )

  const wiped = []
  for (const id of ["stackDrift", "stackWhisperDrift", "stackRevealTrack", "stackHardLoop", "stackSlowBreath", "stackDriftBack"]) {
    await set(STACK)
    await wait(350)
    await pick("stackAnimation", id)
    await wait(450)
    const s = await state()
    if (!s.textureEnabled || !s.ditherEnabled || !s.asciiEnabled) wiped.push(`${id}:state`)
    const f = await shot(SAVE ? `stack_${id}` : null)
    const det = detail(f)
    if (!(det > FLOOR)) wiped.push(`${id}: surface is bare (detail ${det.toFixed(2)} <= ${FLOOR.toFixed(2)})`)
    console.log(
      `        ${id.padEnd(20)} detail ${det.toFixed(2).padStart(6)}  (composed ${detComposed.toFixed(2)} · empty ${detEmpty.toFixed(2)})  Δcomposed ${diff(composed, f).toFixed(1)}`,
    )
  }
  say(wiped.length === 0, "six stack-animation presets leave the graphic layers ON the surface, in state and in pixels", wiped.join(", ") || "6 presets")

  /* CONTROL: a COMPOSITION preset from the same starting state MUST empty the
   * layers it does not name — in state and in pixels. Without this row the
   * check above passes on a build that resets nothing anywhere. */
  await set(STACK)
  await wait(350)
  await pick("texture", "fineGrain")
  await wait(450)
  const afterTex = await state()
  const texFrame = await shot(SAVE ? "stack_control_texture" : null)
  say(
    !afterTex.ditherEnabled && !afterTex.asciiEnabled && diff(composed, texFrame) > 22,
    "CONTROL · a composition preset DOES clear the stack — in state and in pixels",
    `dither ${afterTex.ditherEnabled} · ascii ${afterTex.asciiEnabled} · Δpx ${diff(composed, texFrame).toFixed(1)}`,
  )

  /* ------------------ PHASE 4 · the new group dials ---------------------- */
  console.log("\n=== 4 · the new group dials, on screen ===")

  /* EVERY LAYER HELD STILL FOR THIS PHASE, and that is the fix for three rows
   * that first came back red. `STACK` animates its texture and dither on their
   * own clocks, so two grabs taken a second apart differ by ~60 Δpx no matter
   * what dial is between them — the repeat CONTROL measured 56 against a 77
   * signal, and the direction A/B measured 49 against a 61 repeat, i.e. the
   * instrument was reading the layers' own motion and calling it the dial.
   *
   * ⚠ THIS ARM USED TO ALSO SET `motionMode: "off"`, ON A PREMISE THAT IS NO
   * LONGER TRUE — and that ONE LINE was failing six rows of this gate while the
   * app was correct. The premise, verbatim as it stood here:
   *
   *     "the GROUP animation is deliberately NOT gated on motionMode
   *      (components/viewport-3d.tsx:2127 gates it on reduce-motion and the two
   *      enables only)"
   *
   * It is now gated on it, deliberately, as a DEFECT FIX:
   *
   *     const stackAnimOn = !!styleState &&
   *       motionMode !== "off" &&
   *       styleState.layerStackEnabled &&
   *       styleState.stackAnimationEnabled     // viewport-3d.tsx:2465
   *
   * whose own comment reads "THE STACK WAS THE RAIL `motionMode` NEVER REACHED"
   * — the group had been running at full amplitude with the panel's only motion
   * control reading "Off (static)", measured Off 1.7600 vs Independent 1.7489
   * on drift. Line :2127 no longer holds that code at all.
   *
   * So this arm was switching the group OFF and then reporting that Direction,
   * Phase and revealSynced move nothing: Δpx 0.00 with `groupOffset` 0.00 on
   * BOTH sides of every A/B. A gate measuring a thing it has itself disabled.
   * §17.4: the check was wrong, so the check is fixed — the surface is not
   * touched to make it pass.
   *
   * THE ARM'S ACTUAL REQUIREMENT IS UNCHANGED and is still met: "the only thing
   * that can move a pixel is the group." That is what the three `*Animated:
   * false` lines below buy — `evaluateLayerTime` returns a RESTING phase for a
   * layer whose animation is off (lib/style-clock.ts:322), regardless of the
   * clock — so the layers are as still as they were. `motionMode` only ever had
   * to be non-"off" so the GROUP could run, which is the thing being measured.
   *
   * The instrument is unchanged in strength, and its own negative controls
   * still prove it: `dDirRepeat` (the same setting twice), the amplitude-
   * behaviour CONTROL row that requires direction to be inert on `fadeIn`, and
   * the fadeIn-vs-revealSynced pair. If this line made junk pass, those three
   * would have to pass on junk too. */
  const STATIC_STACK = {
    ...STACK,
    textureAnimated: false,
    ditherAnimated: false,
    asciiAnimated: false,
    motionMode: "independent",
  }

  // GROUP OPACITY
  await set({ ...STATIC_STACK, stackAnimationEnabled: false, stackAnimationType: "none", stackAnimationOpacity: 1 })
  await wait(500)
  const gFull = await shot(SAVE ? "group_opacity_100" : null)
  await set({ stackAnimationOpacity: 0.25 })
  await wait(500)
  const gDim = await shot(SAVE ? "group_opacity_025" : null)
  await set({ stackAnimationOpacity: 1 })
  await wait(500)
  const gFull2 = await shot(SAVE ? "group_opacity_100b" : null)
  const dOpacity = diff(gFull, gDim)
  const dRepeat = diff(gFull, gFull2)
  say(dOpacity > 1.5, "group opacity 1.00 → 0.25 changes the render", `Δpx ${dOpacity.toFixed(2)}`)
  say(
    dRepeat < dOpacity / 4,
    "CONTROL · returning to 1.00 returns the render (so the difference is the dial, not drift)",
    `Δpx ${dRepeat.toFixed(2)} vs ${dOpacity.toFixed(2)}`,
  )
  say(
    presence(gDim) !== presence(gFull),
    "group opacity changes how PRESENT the layers are",
    `lum ${presence(gFull).toFixed(1)} → ${presence(gDim).toFixed(1)}`,
  )

  /* DIRECTION and PHASE, measured on the one behaviour whose offset is pinned
   * to the playhead. See the header for why the wall-clock behaviours are the
   * wrong instrument for an A/B. */
  const pinned = async (over) => {
    await set({ ...STATIC_STACK, stackAnimationEnabled: true, stackAnimationType: "revealSynced", stackAnimationSpeed: 1, stackAnimationPhase: 0, ...over })
    await prog(0.62)
    await wait(420)
    return { f: await shot(null), c: await clock() }
  }
  const fwd = await pinned({})
  const rev = await pinned({ stackAnimationSpeed: -1 })
  const fwd2 = await pinned({})
  const dDir = diff(fwd.f, rev.f)
  const dDirRepeat = diff(fwd.f, fwd2.f)
  say(
    dDir > 1.0 && dDir > dDirRepeat * 4,
    "DIRECTION reverses the group's shared slide on screen",
    `Δpx forward↔reverse ${dDir.toFixed(2)} · repeat ${dDirRepeat.toFixed(2)} · offset ${fwd.c.groupOffset.toFixed(2)} vs ${rev.c.groupOffset.toFixed(2)}`,
  )
  const fadeF = await (async () => {
    await set({ ...STATIC_STACK, stackAnimationEnabled: true, stackAnimationType: "fadeIn", stackAnimationSpeed: 1 })
    await prog(0.62)
    await wait(1500)
    return shot(null)
  })()
  const fadeR = await (async () => {
    await set({ stackAnimationSpeed: -1 })
    await wait(700)
    return shot(null)
  })()
  say(
    diff(fadeF, fadeR) < dDir / 4,
    "CONTROL · direction is inert on an amplitude behaviour, as the panel says",
    `Δpx ${diff(fadeF, fadeR).toFixed(2)} vs ${dDir.toFixed(2)} on the offset behaviour`,
  )

  const ph0 = await pinned({ stackAnimationPhase: 0 })
  const phP = await pinned({ stackAnimationPhase: 3.14 })
  const dPhase = diff(ph0.f, phP.f)
  say(
    dPhase > 1.0 && Math.abs(phP.c.groupOffset - ph0.c.groupOffset - 3.14) < 0.01,
    "PHASE OFFSET moves the group on screen — the field that had no UI at all",
    `Δpx ${dPhase.toFixed(2)} · offset ${ph0.c.groupOffset.toFixed(2)} → ${phP.c.groupOffset.toFixed(2)}`,
  )

  /* REVEAL SYNC — the group's strength IS the playhead. Isolated from the
   * geometry by comparing against fadeIn at the SAME progress: the stroke drawn
   * is identical on both arms, only the group's amount differs. */
  await set({ ...STATIC_STACK, stackAnimationEnabled: true, stackAnimationType: "revealSynced", stackAnimationSpeed: 1, stackAnimationPhase: 0 })
  await prog(0.35)
  await wait(500)
  const rsEarly = await shot(SAVE ? "reveal_sync_035" : null)
  const rsClock = await clock()
  await set({ stackAnimationType: "fadeIn" })
  await wait(1600)
  const fiEarly = await shot(SAVE ? "reveal_fade_035" : null)
  const fiClock = await clock()
  say(
    Math.abs(rsClock.groupAmount - 0.35) < 0.03 && fiClock.groupAmount === 1,
    "revealSynced holds the group at the playhead's value while fadeIn holds it at full",
    `revealSynced ${rsClock.groupAmount.toFixed(3)} vs fadeIn ${fiClock.groupAmount.toFixed(3)} at progress 0.35`,
  )
  say(
    diff(rsEarly, fiEarly) > 1.0,
    "and that difference is visible — same stroke drawn, different group strength",
    `Δpx ${diff(rsEarly, fiEarly).toFixed(2)}`,
  )

  say(errors.length === 0, "no console or page errors across the whole run", errors.length ? errors[0] : "0")

  await browser.close()
  console.log(
    fails === 0 ? `\nALL ${checks} PRESET-PIXEL ASSERTIONS PASS` : `\n${fails} of ${checks} PRESET-PIXEL ASSERTIONS FAILED`,
  )
  process.exit(fails === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
