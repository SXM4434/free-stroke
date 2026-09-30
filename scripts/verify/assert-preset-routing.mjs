// THE TWO PRESET FAMILIES THAT ROUTE THROUGH app/page.tsx — do they land?
//
// WHAT THIS EXISTS TO STOP, and it is not a hypothetical
// ---------------------------------------------------------------------------
// A preset pill that is on the rail but cannot reach its state does not do
// NOTHING. `applyPresetToStyleState` resets the composition rails first so that
// a preset fully determines the look, then merges the preset's patch on top —
// so a pill with no reachable patch runs the reset and merges nothing, i.e. it
// WIPES the user's texture, dither, ASCII, layer stack and fusion, and then
// writes its own name into the summary chip. That shape has shipped in this
// repo TWICE. It is why `GEOMETRY_PRESET_DEFS` shipped `enabled: false` and why
// `PRESET_FAMILY_OPTIONS` is documented as a shipping gate rather than a label
// table.
//
// So the order is: the routing lands, it is PROVEN to land, and only then does
// the rail show the pills. This file is the proof, and section C is the exact
// landmine — a live composition is built first and then every geometry preset
// is clicked over the top of it, with a negative control that makes the same
// check FAIL so it is not a green row that cannot go red.
//
// WHAT IS DRIVEN, AND THROUGH WHICH DOOR
// ---------------------------------------------------------------------------
// Section A clicks the REAL DOM pills — the rail has to actually render the
// families and the click has to actually reach the router, because a harness
// call proves the function works and says nothing about whether a user can get
// to it. The bulk matrix in B/C/D then drives `__styleHarness.selectPreset`,
// which IS `handleSelectPreset`, the same function the pill's onClick calls.
//
// Usage: node scripts/verify/assert-preset-routing.mjs [--save]
//        node scripts/verify/_run-clean.mjs scripts/verify/assert-preset-routing.mjs
import { chromium } from "./lib/browser.mjs"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { loadTs } from "./_ts-load.mjs"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { LAB_URL } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const has = (k) => process.argv.includes(`--${k}`)
const SAVE = has("save")
const OUT = join(ROOT, "docs", "verification", "preset-routing")

const S = loadTs("lib/style-system.ts")
const { PRESET_REGISTRY, applyGeometryPreset, resolveViewPreset, viewPresetBlockers } = S

let fails = 0
let checks = 0
const say = (ok, label, detail) => {
  checks++
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

async function decode(dataUrl) {
  const buf = Buffer.from(dataUrl.match(/base64,(.+)/)[1], "base64")
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  return { d: c.getContext("2d").getImageData(0, 0, img.width, img.height).data, buf }
}
/** Mean per-pixel RGB distance over the union of the two forms' painted area. */
function diff(a, b) {
  let sum = 0
  let n = 0
  for (let i = 0; i < a.d.length; i += 4) {
    if (a.d[i + 3] < 20 && b.d[i + 3] < 20) continue
    sum += (Math.abs(a.d[i] - b.d[i]) + Math.abs(a.d[i + 1] - b.d[i + 1]) + Math.abs(a.d[i + 2] - b.d[i + 2])) / 3
    n++
  }
  return n ? sum / n : 0
}
/** Exact byte comparison — used where "identical" is the claim, not "close". */
const sameBytes = (a, b) => a.buf.length === b.buf.length && a.buf.equals(b.buf)

/** A mark with a crossing and a curve, so every mode has something to build. */
function testStroke() {
  const pts = []
  for (let i = 0; i <= 110; i++) {
    const t = i / 110
    pts.push({ x: 150 + t * 560, y: 340 + Math.sin(t * Math.PI * 1.9) * 120 })
  }
  return [pts]
}

/** The composition-rail fields a bad preset click destroys. Named here so the
 *  landmine check reads as "did the user's work survive", not as a diff dump. */
const COMPOSITION_FIELDS = [
  "textureEnabled",
  "textureMode",
  "ditherEnabled",
  "ditherType",
  "asciiEnabled",
  "asciiCharset",
  "layerStackEnabled",
  "stackAnimationEnabled",
  "stackAnimationType",
  "fusionPreset",
  "motionMode",
]

/** A composition a user would actually be standing in when they click a pill.
 *  Deliberately ANIMATED — a wipe has to be caught on the state that costs the
 *  most to lose, and `stackAnimationType` is one of the fields at risk. */
const LIVE_COMPOSITION = {
  textureEnabled: true,
  textureMode: "scanlines",
  ditherEnabled: true,
  asciiEnabled: true,
  layerStackEnabled: true,
  stackAnimationEnabled: true,
  stackAnimationType: "drift",
  motionMode: "independent",
}

/* ⚠ AN INSTRUMENT BUG THIS FILE HAD, CAUGHT BY ITS OWN CONTROL — leaving it
 * written down because the shape recurs.
 *
 * The first run reported "an unresolvable geometry id changes NOTHING" as
 * FAILING at Δpx 86.559, and two further rows failed downstream because they
 * take their floor from it. Nothing was wrong with the routing: the LANDMINE
 * composition above had been left switched on by the section before, so the
 * scanlines, dither and ASCII layers were DRIFTING between the two shots. The
 * pixel channel was measuring the style clock, not the geometry.
 *
 * That is the "green row that cannot fail" failure in its useful direction — a
 * control that goes red for a reason that has nothing to do with the claim. Had
 * the control been omitted, the twelve preset rows would each have measured a
 * large Δ and been reported as proof that every preset moves pixels, when a
 * preset that did nothing at all would have measured the same.
 *
 * So every section that reads PIXELS pins the style state flat first. The
 * geometry is then the only thing that can move. */
const STATIC_COMPOSITION = {
  textureEnabled: false,
  ditherEnabled: false,
  asciiEnabled: false,
  layerStackEnabled: false,
  stackAnimationEnabled: false,
  stackAnimationType: "none",
  fusionPreset: "none",
  materialAnimationEnabled: false,
  materialAnimationType: "none",
  motionMode: "off",
}

const eqSettings = (a, b) =>
  Object.keys(a).every((k) => (typeof a[k] === "number" ? Math.abs(a[k] - b[k]) < 1e-9 : a[k] === b[k]))
const fmtSettings = (g) => `${g.mode} w${g.extrudeWidthSlider} d${g.extrudeDepth} th${g.solidThickness}`

async function main() {
  if (SAVE) mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({
    viewport: { width: 1500, height: 1500 },
    reducedMotion: "no-preference",
  })
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 160))
  })
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 160)))
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(
    () => window.__styleHarness && window.__captureHarness && window.__revealHarness,
    null,
    { timeout: 30000 },
  )
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12 }), testStroke())
  await page.waitForTimeout(1600)
  await page.evaluate((v) => window.__revealHarness.setProgress(v), 1)
  await page.waitForTimeout(400)

  const wait = (ms) => page.waitForTimeout(ms)

  /* ================================================================== */
  /*  A · CAN A USER ACTUALLY GET THERE? (the real DOM, real clicks)     */
  /* ================================================================== */
  console.log("\n=== A · the rail, through the real UI ===")

  // Open the Presets panel from the summary strip — the only way in.
  await page.getByRole("button", { name: /^Preset/ }).click()
  await wait(300)

  const familyOptions = await page.evaluate(() => {
    const sel = [...document.querySelectorAll("select")].find((s) =>
      [...s.options].some((o) => o.textContent === "Material"),
    )
    return sel ? [...sel.options].map((o) => o.textContent) : []
  })
  say(
    familyOptions.includes("Geometry"),
    "the preset rail OFFERS the Geometry family",
    `${familyOptions.length} families: ${familyOptions.join(", ")}`,
  )
  say(familyOptions.includes("View / Export"), "the preset rail OFFERS the View / Export family")
  say(
    new Set(familyOptions).size === familyOptions.length,
    "CONTROL · no family is listed twice (the consumer-side opt-in is dedupe-safe)",
    `${familyOptions.length} rows, ${new Set(familyOptions).size} distinct`,
  )

  const selectFamily = async (label) => {
    await page.evaluate((lab) => {
      const sel = [...document.querySelectorAll("select")].find((s) =>
        [...s.options].some((o) => o.textContent === "Material"),
      )
      const opt = [...sel.options].find((o) => o.textContent === lab)
      sel.value = opt.value
      sel.dispatchEvent(new Event("change", { bubbles: true }))
    }, label)
    await wait(300)
  }

  await selectFamily("Geometry")
  const geomPills = await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((b) => b.className.includes("rounded-full") && b.parentElement?.className.includes("flex-wrap"))
      .map((b) => ({ label: b.textContent.replace(/soon$/, "").trim(), disabled: b.disabled })),
  )
  say(
    geomPills.length === PRESET_REGISTRY.geometry.length,
    "every geometry preset in the registry renders as a pill",
    `${geomPills.length} pills / ${PRESET_REGISTRY.geometry.length} in registry`,
  )
  say(
    geomPills.length > 0 && geomPills.every((p) => !p.disabled),
    "every geometry pill is CLICKABLE (its patch is routed)",
    geomPills.filter((p) => p.disabled).map((p) => p.label).join(", ") || "0 disabled",
  )

  // THE REAL ENTRY PATH: click the pill, not the harness.
  const modeBefore = await page.evaluate(() => window.__styleHarness.get().geometryMode)
  await page.getByRole("button", { name: "Solid Cutout" }).click()
  await wait(1800)
  const modeAfter = await page.evaluate(() => window.__styleHarness.get().geometryMode)
  say(
    modeBefore === "rod" && modeAfter === "solid",
    "clicking the 'Solid Cutout' PILL switches the app into Solid",
    `${modeBefore} → ${modeAfter}`,
  )
  const chipAfterClick = await page.evaluate(
    () => [...document.querySelectorAll("button")].find((b) => b.textContent.startsWith("Preset"))?.textContent,
  )
  say(
    /Solid Cutout/.test(chipAfterClick ?? ""),
    "the summary chip names the geometry preset that actually ran",
    chipAfterClick,
  )

  await selectFamily("View / Export")
  const viewPills = await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((b) => b.className.includes("rounded-full") && b.parentElement?.className.includes("flex-wrap"))
      .map((b) => ({ label: b.textContent.replace(/soon$/, "").trim(), disabled: b.disabled, title: b.title })),
  )
  /* ⚠ RE-POINTED 2026-08-03 — the route landed and both of these rows were about
   * its absence.
   *
   *   PARKED PRIOR:
   *     say(!!video && video.disabled, "CONTROL · 'Video Preview Export' is REFUSED …")
   *     say(!!video && /video/i.test(t) && /writer|export/i.test(t),
   *         "…and it says WHAT it is waiting on, rather than a generic 'soon'")
   *
   * Every view preset is selectable now. What has to be true INSTEAD is the
   * thing that made the wiring safe to do at all, and it is a stronger claim
   * than "disabled": THIS PILL SAYS WHAT IT WILL COST BEFORE IT IS CLICKED.
   * Every other view preset moves a camera and is instant; this one renders the
   * whole draw-in frame by frame and writes a file to the user's disk. A control
   * that does that and reads like its neighbours is the defect — so the two rows
   * become "selectable" and "and it warns", which is the same pair of questions
   * pointed at the state the app is actually in.
   *
   * Both fail on a real change: re-block the member and the first goes red;
   * shorten the description to a bare framing note and the second does. The
   * title is `p.description` (components/style-panel-scaffold.tsx), so the text
   * under test is the shipped copy, not a string this gate invented. */
  const video = viewPills.find((p) => p.label === "Video Preview Export")
  say(
    !!video && !video.disabled,
    "'Video Preview Export' is SELECTABLE — the last view member that named a missing capability",
    video ? `disabled=${video.disabled}` : "pill not found",
  )
  say(
    !!video && /\brender/i.test(video.title) && /\bframe/i.test(video.title) && /(saved|file|download)/i.test(video.title),
    "…and its own tooltip states the COST before the click — a frame-by-frame render that writes a file",
    video?.title?.slice(0, 140),
  )
  const spin = viewPills.find((p) => p.label === "Portfolio Spin")
  say(
    !!spin && !spin.disabled,
    "'Portfolio Spin' is now selectable — the turntable it needs was built in this change",
    `viewPresetBlockers("portfolioSpin") reports ${viewPresetBlockers("portfolioSpin").length} — the stale entry this row used to have to excuse is gone from lib/style-system.ts`,
  )

  /* ================================================================== */
  /*  G · THE SUMMARY STRIP — is every panel reachable from it?          */
  /* ================================================================== */
  console.log("\n=== G · the summary strip ===")
  const chips = await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((b) => b.className.includes("rounded-full") && b.className.includes("gap-1.5"))
      .map((b) => b.textContent.trim()),
  )
  const chipLabels = chips.map((c) => c.replace(/([a-z])([A-Z0-9])/g, "$1|$2").split("|")[0])
  say(
    chips.some((c) => c.startsWith("Layers")),
    "the strip has a LAYERS chip — the layer stack + stack animation are reachable in one click",
    chips.find((c) => c.startsWith("Layers")),
  )
  /* THE DURABLE VERSION OF THAT CHECK. The strip is the only navigation into
   * the panels, so an active panel with no chip is unreachable from the one
   * screen that lists what is on. Asserting the SET catches the next one. */
  const activePanels = ["material", "animation", "texture", "dither", "ascii", "presets", "layers", "fusion"]
  const missing = activePanels.filter(
    (id) => !chips.some((c) => c.toLowerCase().startsWith(id === "presets" ? "preset" : id)),
  )
  say(
    missing.length === 0,
    "EVERY active panel has a chip — no panel is reachable only via another panel",
    missing.length ? `missing: ${missing.join(", ")}` : `${activePanels.length} panels, ${chips.length} chips`,
  )

  const layersChip = async () =>
    page.evaluate(
      () => [...document.querySelectorAll("button")].find((b) => b.textContent.startsWith("Layers"))?.textContent,
    )
  await page.evaluate(() =>
    window.__styleHarness.setStyle({ layerStackEnabled: false, stackAnimationEnabled: false }),
  )
  await wait(200)
  const chipOff = await layersChip()
  await page.evaluate((c) => window.__styleHarness.setStyle(c), LIVE_COMPOSITION)
  await wait(300)
  const chipOn = await layersChip()
  say(
    /Off$/.test(chipOff ?? "") && /3 layers/.test(chipOn ?? "") && /Drift/.test(chipOn ?? ""),
    "the Layers chip READS the live state (it is a status line, not a label)",
    `"${chipOff}" → "${chipOn}"`,
  )

  /* ================================================================== */
  /*  B · DOES THE GEOMETRY PATCH ACTUALLY LAND IN THE FIVE HOOKS?       */
  /* ================================================================== */
  console.log("\n=== B · geometry routing: state + pixels ===")
  /* PIN THE STYLE CLOCK FLAT. See STATIC_COMPOSITION — every pixel measurement
   * below is a claim about GEOMETRY or the CAMERA, and an animated layer moving
   * underneath it is a second variable that reads exactly like the first. */
  const pinFlat = async () => {
    await page.evaluate((c) => window.__styleHarness.setStyle(c), STATIC_COMPOSITION)
    await wait(300)
  }
  await pinFlat()
  await page.evaluate(() => window.__captureHarness.enable())
  await wait(400)
  const shot = async (name) => {
    const u = await page.evaluate(() => window.__captureHarness.grab())
    const f = await decode(u)
    if (SAVE && name) writeFileSync(join(OUT, `${name}.png`), f.buf)
    return f
  }
  const settle = async (mode) => {
    await wait(mode === "inflate" ? 2400 : 1500)
    await page.evaluate((v) => window.__revealHarness.setProgress(v), 1)
    await wait(400)
    await page.evaluate(() => window.__captureHarness.orbitView(34, 18, 1.05))
    await wait(350)
  }

  // Start from a known place so `before` is the same for every row.
  await page.evaluate(() => window.__styleHarness.selectPreset("geometry", "cleanRod"))
  await settle("rod")
  const baseSettings = await page.evaluate(() => window.__styleHarness.geometrySettings())
  const baseFrame = await shot(SAVE ? "base_cleanRod" : null)

  const rows = []
  for (const p of PRESET_REGISTRY.geometry) {
    await page.evaluate(() => window.__styleHarness.selectPreset("geometry", "cleanRod"))
    await settle("rod")
    const before = await page.evaluate(() => window.__styleHarness.geometrySettings())
    const beforeFrame = await shot(null)
    await page.evaluate((id) => window.__styleHarness.selectPreset("geometry", id), p.id)
    await settle(applyGeometryPreset(before, p.id).mode)
    const after = await page.evaluate(() => window.__styleHarness.geometrySettings())
    const afterFrame = await shot(SAVE ? `geom_${p.id}` : null)
    rows.push({
      id: p.id,
      expected: applyGeometryPreset(before, p.id),
      actual: after,
      d: diff(beforeFrame, afterFrame),
    })
  }
  console.log("preset                 expected               actual                 Δpx vs cleanRod")
  for (const r of rows) {
    console.log(
      `${r.id.padEnd(22)} ${fmtSettings(r.expected).padEnd(22)} ${fmtSettings(r.actual).padEnd(22)} ${r.d.toFixed(3).padStart(8)}`,
    )
  }
  const wrongState = rows.filter((r) => !eqSettings(r.expected, r.actual))
  say(
    wrongState.length === 0,
    "every geometry preset lands EXACTLY what the pure resolver said it would",
    wrongState.length ? wrongState.map((r) => r.id).join(", ") : `${rows.length} presets, all fields equal`,
  )

  /* THE CONTROL FOR THE PIXEL CHANNEL. An id nothing resolves must change
   * neither the settings nor the render — and must produce a 0, so the reader
   * knows the metric is capable of returning one. */
  await page.evaluate(() => window.__styleHarness.selectPreset("geometry", "deepRibbon"))
  await settle("extrude")
  const preNoop = await shot(null)
  const preNoopSettings = await page.evaluate(() => window.__styleHarness.geometrySettings())
  await page.evaluate(() => window.__styleHarness.selectPreset("geometry", "__not_a_preset__"))
  await settle("extrude")
  const postNoop = await shot(null)
  const postNoopSettings = await page.evaluate(() => window.__styleHarness.geometrySettings())
  const dNoop = diff(preNoop, postNoop)
  say(
    dNoop < 0.5 && eqSettings(preNoopSettings, postNoopSettings),
    "CONTROL · an unresolvable geometry id changes NOTHING and leaves no receipt",
    `Δpx ${dNoop.toFixed(3)}`,
  )
  const floor = Math.max(1.0, dNoop * 6)
  const inert = rows.filter((r) => r.id !== "cleanRod" && r.d < floor)
  say(
    inert.length === 0,
    "every geometry preset MOVES PIXELS against the same starting form",
    inert.length ? inert.map((r) => `${r.id} Δ${r.d.toFixed(2)}`).join(", ") : `floor ${floor.toFixed(2)} from the control`,
  )

  /* ================================================================== */
  /*  C · 🚨 THE LANDMINE — does the user's composition survive?          */
  /* ================================================================== */
  console.log("\n=== C · the composition-wipe landmine ===")
  const readComposition = () =>
    page.evaluate((keys) => {
      const s = window.__styleHarness.get().styleState
      return Object.fromEntries(keys.map((k) => [k, s[k]]))
    }, COMPOSITION_FIELDS)

  await page.evaluate((c) => window.__styleHarness.setStyle(c), LIVE_COMPOSITION)
  await wait(300)
  const compBefore = await readComposition()
  const survived = []
  for (const p of PRESET_REGISTRY.geometry) {
    await page.evaluate((id) => window.__styleHarness.selectPreset("geometry", id), p.id)
    await wait(250)
    const now = await readComposition()
    const lost = COMPOSITION_FIELDS.filter((k) => now[k] !== compBefore[k])
    survived.push({ id: p.id, lost })
  }
  const wiped = survived.filter((s) => s.lost.length)
  say(
    wiped.length === 0,
    "🚨 clicking EVERY geometry preset over a live composition destroys none of it",
    wiped.length
      ? wiped.map((s) => `${s.id} lost ${s.lost.join("/")}`).join(" | ")
      : `${survived.length} presets × ${COMPOSITION_FIELDS.length} fields, 0 changed`,
  )

  /* THE NEGATIVE CONTROL, and it is the whole reason the row above is worth
   * reading. A COMPOSITION-family preset is SUPPOSED to reset the rails — that
   * is what makes a preset fully determine the look. So the same check, run
   * against one, must come back FAILING. If it does not, the check is blind and
   * the green row above means nothing. */
  await page.evaluate((c) => window.__styleHarness.setStyle(c), LIVE_COMPOSITION)
  await wait(300)
  const ctlBefore = await readComposition()
  const textureMember = PRESET_REGISTRY.texture.find((p) => p.enabled && p.implemented)
  await page.evaluate((id) => window.__styleHarness.selectPreset("texture", id), textureMember.id)
  await wait(300)
  const ctlAfter = await readComposition()
  const ctlLost = COMPOSITION_FIELDS.filter((k) => ctlAfter[k] !== ctlBefore[k])
  say(
    ctlLost.length > 0,
    `CONTROL · the same check DOES fire — a composition preset ('${textureMember.label}') resets the rails, as designed`,
    `${ctlLost.length} fields changed: ${ctlLost.join(", ")}`,
  )

  /* ================================================================== */
  /*  D · UNDO                                                           */
  /* ================================================================== */
  console.log("\n=== D · undo the preset ===")
  await pinFlat()
  await page.evaluate(() => window.__styleHarness.selectPreset("geometry", "cleanRod"))
  await settle("rod")
  const undoBeforeSettings = await page.evaluate(() => window.__styleHarness.geometrySettings())
  const undoBeforeFrame = await shot(SAVE ? "undo_before" : null)
  await page.evaluate(() => window.__styleHarness.selectPreset("geometry", "thickSlab"))
  await settle("solid")
  const undoAppliedFrame = await shot(SAVE ? "undo_applied" : null)
  const dApplied = diff(undoBeforeFrame, undoAppliedFrame)
  const reverted = await page.evaluate(() => window.__styleHarness.revertPreset())
  await settle("rod")
  const undoAfterSettings = await page.evaluate(() => window.__styleHarness.geometrySettings())
  const undoAfterFrame = await shot(SAVE ? "undo_after" : null)
  const dReverted = diff(undoBeforeFrame, undoAfterFrame)
  say(
    reverted && eqSettings(undoBeforeSettings, undoAfterSettings),
    "undo restores every geometry field to what it was before the preset",
    `${fmtSettings(undoBeforeSettings)} → ${fmtSettings(undoAfterSettings)}`,
  )
  say(
    dReverted < floor && dApplied > floor,
    "…and the RENDER comes back — with the applied state as the control that it had really moved",
    `applied Δ ${dApplied.toFixed(3)} (> ${floor.toFixed(2)}), reverted Δ ${dReverted.toFixed(3)}`,
  )
  /* CONTROL · a second undo goes FURTHER BACK — it does not repeat itself.
   *
   * ⚠ THIS ROW USED TO ASSERT `revertPreset() === false` ON THE SECOND CALL,
   * AND THAT ASSERTION IS NOW WRONG ABOUT A BETTER SURFACE. `revertPreset` was
   * a one-shot revert of the last preset; it is now a thin alias for the real
   * undo stack (`doUndo`, app/page.tsx), which every one of the fifteen preset
   * families records onto — the change that made ⌘Z reach the composition
   * families that used to wipe your work with no way back. A general undo
   * stack SHOULD return true on a second call: there is more history.
   *
   * Left as it was, the row failed on the improvement and would have been
   * "fixed" by putting the one-shot revert back. So the control is re-pointed
   * at what the mechanism must still guarantee — undo MOVES, and it moves
   * somewhere NEW — which is the property that would actually be broken by a
   * no-op undo, a self-repeating undo, or a stack that popped nothing.
   *
   * It still discriminates: it fails if the second call reports nothing, and it
   * fails if the second call lands on the state the first one did. */
  const undoTwiceMoved = await page.evaluate(() => window.__styleHarness.revertPreset())
  await settle("rod")
  const undoTwiceSettings = await page.evaluate(() => window.__styleHarness.geometrySettings())
  say(
    undoTwiceMoved === true && !eqSettings(undoAfterSettings, undoTwiceSettings),
    "CONTROL · a second undo goes FURTHER BACK — it moves, and it moves somewhere new",
    `reported ${undoTwiceMoved}; ${fmtSettings(undoAfterSettings)} → ${fmtSettings(undoTwiceSettings)}`,
  )

  /* ================================================================== */
  /*  E · VIEW PRESETS                                                   */
  /* ================================================================== */
  console.log("\n=== E · view presets: the camera actually goes there ===")
  await pinFlat()
  await page.evaluate(() => window.__styleHarness.selectPreset("geometry", "thickSlab"))
  await settle("solid")

  const viewShot = async (id, name) => {
    const ok = await page.evaluate((x) => window.__styleHarness.selectViewPreset(x), id)
    await wait(500)
    return { ok, f: await shot(SAVE ? name : null) }
  }
  const vHero = await viewShot("threeQuarterHero", "view_threeQuarterHero")
  const vTop = await viewShot("topDownMark", "view_topDownMark")
  const vRake = await viewShot("rakingProfile", "view_rakingProfile")
  const vHero2 = await viewShot("threeQuarterHero", "view_threeQuarterHero_repeat")

  say(
    vHero.ok && vTop.ok && vRake.ok,
    "three implemented view presets all reported that they framed the shot",
  )
  const dRepeatView = diff(vHero.f, vHero2.f)
  say(
    dRepeatView < 0.5,
    "CONTROL · the same view preset twice returns the same frame (the metric can read 0)",
    `Δpx ${dRepeatView.toFixed(3)}`,
  )
  const vFloor = Math.max(1.0, dRepeatView * 6)
  const pairs = [
    ["threeQuarterHero", "topDownMark", diff(vHero.f, vTop.f)],
    ["threeQuarterHero", "rakingProfile", diff(vHero.f, vRake.f)],
    ["topDownMark", "rakingProfile", diff(vTop.f, vRake.f)],
  ]
  say(
    pairs.every(([, , d]) => d > vFloor),
    "no two view presets frame the same shot",
    pairs.map(([a, b, d]) => `${a}/${b} ${d.toFixed(1)}`).join(" · "),
  )

  /* ⚠ THE SUBJECT OF THIS CONTROL WAS RETIRED, SO THE CONTROL MOVED RATHER THAN
   * BEING DELETED — 2026-08-03.
   *
   *   PARKED PRIOR:
   *     const refused = await page.evaluate(() =>
   *       window.__styleHarness.selectViewPreset("videoPreviewExport"))
   *     say(refused === false && diff(before, after) < 0.5,
   *         "CONTROL · the blocked member is REFUSED and moves nothing — it does not half-run")
   *
   * `videoPreviewExport` is no longer blocked (the `target === "video"` route
   * landed), so that exact call now DOES something — it frames the camera and
   * starts a render. Asserting the old sentence would be asserting a defect, and
   * deleting the row would drop the property it was protecting: A REFUSED VIEW
   * PRESET MUST NOT HALF-RUN. `applyViewPresetById` still has that path — an id
   * `resolveViewPreset` does not know returns `false` before it touches the
   * camera, the style state or the undo stack — so the control is re-pointed at
   * a refusal that still exists instead of at a member that stopped being one.
   *
   * It still fails for the right reason: move the `if (!patch) return false`
   * below the `orbitView` call and the frame moves, red. Driving the real video
   * member is `assert-view-presets`' job (it waits for the file to land); doing
   * it here as well would run a multi-second export inside a routing gate and
   * leave the playhead mid-flight for every row after it. */
  const beforeRefused = await shot(null)
  const refused = await page.evaluate(() => window.__styleHarness.selectViewPreset("__not_a_view_preset__"))
  await wait(500)
  const afterRefused = await shot(null)
  say(
    refused === false && diff(beforeRefused, afterRefused) < 0.5,
    "CONTROL · an unknown view id is REFUSED and moves nothing — the router does not half-run",
    `returned ${refused}, Δpx ${diff(beforeRefused, afterRefused).toFixed(3)}`,
  )

  /* THE REFACTOR'S OWN CONTROL. `frontView` used to carry its own copy of the
   * framing maths and now delegates to `orbitView(0, 0, k)`. The original code
   * asserted that identity in a comment; this asserts it in bytes. */
  await page.evaluate(() => window.__captureHarness.frontView(1.0))
  await wait(400)
  const fFront = await shot(SAVE ? "front_via_frontView" : null)
  await page.evaluate(() => window.__captureHarness.orbitView(0, 0, 1.0))
  await wait(400)
  const fOrbit = await shot(SAVE ? "front_via_orbitView" : null)
  say(
    sameBytes(fFront, fOrbit),
    "frontView(k) is BYTE-IDENTICAL to orbitView(0, 0, k) — the delegation changed nothing",
    `${fFront.buf.length} vs ${fOrbit.buf.length} bytes`,
  )

  /* ================================================================== */
  /*  F · THE TURNTABLE                                                  */
  /* ================================================================== */
  console.log("\n=== F · the turntable ===")
  await pinFlat()
  await page.evaluate(() => window.__captureHarness.setSpin(0))
  await wait(400)
  const still1 = await shot(null)
  await wait(700)
  const still2 = await shot(SAVE ? "spin_off" : null)
  const dStill = diff(still1, still2)
  say(
    dStill < 0.5,
    "CONTROL · with the spin OFF, two frames 700 ms apart are the same picture",
    `Δpx ${dStill.toFixed(3)}`,
  )
  await page.evaluate(() => window.__captureHarness.setSpin(90))
  await wait(300)
  const spin1 = await shot(null)
  await wait(700)
  const spin2 = await shot(SAVE ? "spin_on" : null)
  const dSpin = diff(spin1, spin2)
  say(
    dSpin > Math.max(2, dStill * 10),
    "the turntable actually TURNS the camera — 'Portfolio Spin' does what its name says",
    `Δpx ${dSpin.toFixed(3)} at 90°/s vs ${dStill.toFixed(3)} stopped`,
  )
  say(
    (await page.evaluate(() => window.__captureHarness.effectiveSpin())) === 90,
    "…and it reports the rate it is ACTUALLY applying, not the rate it was asked for",
  )
  /* STOPPING IS AN EASE-OUT, NOT A CUT, and the first version of this row did
   * not know that: it waited 800 ms and measured Δpx 8.112, i.e. the camera was
   * still turning at roughly 8°/s. That is not a stuck control — drei mounts
   * OrbitControls with `enableDamping = true` by default, so three retains
   * `sphericalDelta` and decays it ~5% per frame, which is ~2.3 s to settle. The
   * turntable therefore coasts to a stop rather than snapping, which is the
   * better behaviour; the assertion was wrong about the mechanism, so the
   * assertion moved. Both halves are checked: it must STILL be moving shortly
   * after the stop (or the ease-out claim is unfalsifiable), and it must be
   * fully still once the decay has run. */
  await page.evaluate(() => window.__captureHarness.setSpin(0))
  await wait(150)
  const coast1 = await shot(null)
  await wait(400)
  const coast2 = await shot(null)
  await wait(3000)
  const stopped1 = await shot(null)
  await wait(700)
  const stopped2 = await shot(null)
  const dCoast = diff(coast1, coast2)
  const dStopped = diff(stopped1, stopped2)
  say(
    dStopped < 0.5,
    "setSpin(0) stops it — fully still once the damped ease-out has run",
    `Δpx ${dStopped.toFixed(3)} after settling`,
  )
  say(
    dCoast > dStopped * 4,
    "CONTROL · and it EASES out rather than cutting — still moving just after the stop",
    `Δpx ${dCoast.toFixed(3)} during the coast vs ${dStopped.toFixed(3)} settled (drei mounts enableDamping by default)`,
  )

  say(errors.length === 0, "no console or page errors across the whole run", errors.length ? errors[0] : "0")
  await browser.close()

  /* ---- REDUCED MOTION, in its own context ---------------------------- */
  console.log("\n=== F2 · reduced motion vetoes the turntable ===")
  const b2 = await chromium.launch()
  const p2 = await b2.newPage({ viewport: { width: 1500, height: 1500 }, reducedMotion: "reduce" })
  await p2.goto(LAB_URL, { waitUntil: "networkidle" })
  await p2.waitForFunction(() => window.__styleHarness && window.__captureHarness && window.__revealHarness, null, {
    timeout: 30000,
  })
  await p2.evaluate((pl) => window.__styleHarness.injectStrokes(pl, { msPerPoint: 12 }), testStroke())
  await p2.waitForTimeout(1600)
  await p2.evaluate((v) => window.__revealHarness.setProgress(v), 1)
  await p2.evaluate(() => window.__captureHarness.enable())
  await p2.waitForTimeout(600)
  await p2.evaluate(() => window.__captureHarness.orbitView(34, 18, 1.05))
  await p2.waitForTimeout(400)
  await p2.evaluate(() => window.__captureHarness.setSpin(90))
  await p2.waitForTimeout(300)
  const rShot = async () => decode(await p2.evaluate(() => window.__captureHarness.grab()))
  const r1 = await rShot()
  await p2.waitForTimeout(900)
  const r2 = await rShot()
  const requested = await p2.evaluate(() => window.__captureHarness.getSpin())
  const applied = await p2.evaluate(() => window.__captureHarness.effectiveSpin())
  say(
    requested === 90 && applied === 0 && diff(r1, r2) < 0.5,
    "under prefers-reduced-motion the framing still applies and the SPIN does not",
    `requested ${requested}°/s, applied ${applied}°/s, Δpx ${diff(r1, r2).toFixed(3)}`,
  )
  await b2.close()

  console.log(
    fails === 0
      ? `\nALL ${checks} PRESET-ROUTING ASSERTIONS PASS`
      : `\n${fails} of ${checks} PRESET-ROUTING ASSERTIONS FAILED`,
  )
  process.exit(fails === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
