// THE FUSION PANEL, DRIVEN THE WAY A PERSON DRIVES IT.
//
// WHY THIS EXISTS SEPARATELY FROM assert-layer-flicker.mjs --fusion.
//
// That script measures the RENDERER. It reaches the presets through
// `window.__styleHarness.selectPreset`, which is the same function the panel
// calls — good enough to prove the relationships work, and completely blind to
// whether a human can reach them. This project has already shipped a panel that
// rendered ZERO controls while harness assertions passed, because the harness
// never opened the panel. So this script never touches the harness for anything
// it is asserting: it clicks the tab, counts the controls that actually exist in
// the DOM, clicks every pill, drags every slider, and reads the resulting state
// back out.
//
// WHAT IT ASSERTS, and why each one is here:
//
//   1. The panel is REACHABLE by clicking, and renders a non-zero number of
//      controls. The zero-control bug, caught structurally.
//   2. ONE row of relationship pills — 8 of them plus None. The old panel had a
//      second row of 7 "animated fusion" pills describing the same 8 looks; the
//      whole point of the taxonomy fix is that that row is gone, so its absence
//      is an assertion, not a hope.
//   3. THREE drive pills, each of which changes `fusionDrive` when clicked and
//      reports `aria-pressed`.
//   4. All 24 combinations reachable BY CLICK: 8 relationship pills x 3 drive
//      pills, each verified in state afterwards.
//   5. The captions change. A dial whose label never updates is a dial the user
//      cannot read, and the caption is how the panel explains what Arc and Burst
//      mean on THIS preset.
//   6. Link and Swing are separate, both present, and both write their own field.
//   7. No control mentions the retired vocabulary ("Animated fusion", "Intensity").
//
// Real Chrome, Metal ANGLE, video recorded — and HEADLESS.
//
// ⚠ THIS LINE USED TO READ "NEVER headless (standing rule)", AND THAT RULE IS
// SUPERSEDED BY THIS REPO'S OWN docs/DISPATCH.md §3, which states that headless
// is fine and is Sebs's preference, measured 2026-07-30: 121 rAF ticks headless
// against 120 headed, identical renderer string.
//
// The flag that IS load-bearing is `--use-angle=metal`. Without it Chrome falls
// back to SwiftShader, which silently pauses the rAF loop — and a frozen
// animation is indistinguishable from a still one in a screenshot.
//
// Headed cost more than it bought. On a LOCKED screen headed Chrome does not
// render at all, so an overnight run of this gate grades blank frames and
// reports them; and `page.bringToFront()` (removed below) is exactly the
// screen-stealing the dispatch contract §19 was written to stop.
//
// Usage: node scripts/verify/assert-fusion-ui.mjs [--label=after]
import { chromium } from "./lib/browser.mjs"
import { openStyle } from "./lib/dock.mjs"
import { writeFileSync, mkdirSync, renameSync, readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { loadTs } from "./_ts-load.mjs"
/* ⚠ THIS GATE WAS PORT-BLIND, AND A PORT-BLIND GATE IN A LANE GRADES SOMEBODY
 * ELSE'S TREE AND PRINTS GREEN ABOUT IT. It hardcoded `http://localhost:3000`
 * and ignored `FS_PORT` entirely — one of 35 of the 48 browser gates measured
 * doing this on 2026-08-07. The failure is silent and total: a lane on :3101
 * drives the canonical checkout, grades code it never wrote, and reports a
 * result that is true of a tree nobody asked about. `docs/DISPATCH.md` §3 is
 * explicit that there is ONE knob and it is `FS_PORT`, resolved once here. */
import { LAB_URL } from "./lib/dev-server.mjs"
/* THE PROVENANCE MODULE THIS DIRECTORY ALREADY HAD. `_capture-freshness.mjs` was
 * written for exactly the hole this gate has, and `assert-drawin-pentip.mjs` and
 * `assert-pentip-specks.mjs` already use these two primitives the same way.
 * Nothing new is written here. */
import { newestUnder, newestCapture } from "./_capture-freshness.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=")[1] : d
}
const LABEL = arg("label", "after")
const OUT = join(ROOT, "docs", "verification", "fusion-ui", LABEL)
const VIDEO = join(OUT, "video")
const SHOTS = join(OUT, "frames")
mkdirSync(VIDEO, { recursive: true })
mkdirSync(SHOTS, { recursive: true })

const S = loadTs("lib/style-system.ts")
const F = loadTs("lib/style-fusion.ts")
const FUSION_LABELS = S.FUSION_PRESET_DEFS.map((p) => ({ id: p.id, label: p.label }))
const DRIVES = ["loop", "arc", "burst"]
/* CL-REDS2 2026-10-03: the dials and the two choice rows are read from code, not typed.
 * Every numeric fusion field is a slider, and Field draws a key button beside each
 * keyable one; lib/style-key-meta.ts is where a fusion path gets its dial label.
 * The completion and pause-hold rows draw one pill per value of their types. */
const DIALS = loadTs("lib/style-key-meta.ts").STYLE_KEY_META.filter((m) => m.family.id === "fusion")
const STYLE_SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "lib", "style-system.ts"), "utf8")
const unionOf = (name) => STYLE_SRC.match(new RegExp(`export type ${name} = ([^\\n]+)`))?.[1].match(/"[^"]+"/g) ?? []
const COMPLETIONS = unionOf("FusionCompletion")
const PAUSE_HOLDS = unionOf("FusionPauseHold")

function testStroke() {
  const pts = []
  for (let i = 0; i <= 120; i++) {
    const t = i / 120
    pts.push({ x: 120 + t * 620, y: 330 + Math.sin(t * Math.PI * 2.2) * 130 })
  }
  return [pts]
}

async function main() {
  // FS_VIEWPORT=WxH runs the same rows at another window size; 1500x950 is the default.
  const [VW, VH] = (process.env.FS_VIEWPORT || "1500x950").split("x").map(Number)
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: VW, height: VH },
    recordVideo: { dir: VIDEO, size: { width: VW, height: VH } },
  })
  const page = await ctx.newPage()
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 200))
  })
  // The panel restores the user's own fusions from localStorage, and each one
  // adds a pill — so without this the button count below depends on whatever a
  // previous run happened to leave behind on this machine.
  await page.addInitScript(() => {
    try {
      window.localStorage.removeItem("freestroke.fusions.v1")
    } catch {}
  })
  await page.goto(LAB_URL, { waitUntil: "networkidle" })

  let pass = true
  const results = []
  const say = (ok, label, detail) => {
    if (!ok) pass = false
    results.push({ ok, label, detail })
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
  }

  // A form on the stage, so what the panel does is visible. This is the ONLY
  // harness call in the script and it is not part of any assertion — it is the
  // subject, not the instrument.
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness, null, { timeout: 60000 })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12 }), testStroke())
  await page.waitForTimeout(1400)
  await page.evaluate(() => window.__revealHarness.setProgress(1))
  await page.waitForTimeout(400)

  const readState = () => page.evaluate(() => window.__styleHarness.get().styleState)

  /* page.screenshot() blocks on document.fonts.ready, and against a dev server
   * that is being hammered by consecutive verification runs that occasionally
   * exceeds the default 30 s. A lost screenshot is lost EVIDENCE, not a failed
   * assertion, so it gets a longer budget and one retry — and if it still cannot
   * be taken, that is recorded loudly rather than swallowed, because silently
   * missing evidence is how a directory of blank frames got mistaken for a pass
   * in this project before. */
  const missedShots = []
  const shot = async (name) => {
    for (let a = 0; a < 2; a++) {
      try {
        await page.screenshot({ path: join(SHOTS, name), timeout: 60000 })
        return
      } catch (e) {
        if (a === 1) {
          missedShots.push(`${name}: ${String(e).slice(0, 80)}`)
          console.log(`[warn] screenshot not captured: ${name}`)
        }
      }
    }
  }

  /* ---- 1. reach the panel by clicking, and find its controls ------------- */
  // L4: the Style panel shown from the rail on its Fusion family (the style bar's Show panel and the drawer's Fusion tab until L4).
  await openStyle(page, "fusion")
  await page.waitForTimeout(300)
  await page.waitForTimeout(400)

  // The panel BODY, so nothing outside it is counted. Located from its heading
  // rather than by a test id, because a test id can exist while the body is empty.
  const body = page.locator("div.fs-panel-enter")
  say(await body.count() === 1, "fusion panel body is rendered", `${await body.count()} body`)
  const buttons = body.locator("button")
  const sliders = body.locator('input[type="range"]')
  const nButtons = await buttons.count()
  const nSliders = await sliders.count()
  say(nButtons > 0 && nSliders > 0, "panel renders controls (the zero-control bug)", `${nButtons} buttons, ${nSliders} sliders`)
  await shot("00-panel-open.png")

  const buttonLabels = await buttons.allTextContents()
  const trimmed = buttonLabels.map((s) => s.trim())

  /* ---- 0. CAN THIS SCRIPT FAIL? -----------------------------------------
   * Every check below is of the form "this control is present" or "this state
   * matches", and both are trivially satisfiable by a broken locator: a
   * `getByRole` that resolves to nothing and a state read that returns undefined
   * will happily agree with an assertion written the wrong way round. This pass
   * has already found four instruments that reported confidently while measuring
   * nothing, so before trusting a single PASS the script proves the same code
   * paths report a MISS on inputs whose answer is known.
   *
   * Deliberately-absent control: no such pill has ever existed, so if the button
   * locator claims to find it, none of the "present" results mean anything.
   * Deliberately-wrong state: comparing the live state against a value it cannot
   * hold must come out false, or the state comparisons are vacuous. */
  const ghost = "Nonexistent Relationship"
  const ghostFound =
    trimmed.includes(ghost) || (await body.getByRole("button", { name: ghost, exact: true }).count()) > 0
  say(!ghostFound, "SELF-CHECK: the button locator reports a MISS for a control that does not exist")
  const live = await readState()
  say(live.fusionPreset !== "__impossible__" && !(live.fusionPreset === undefined),
    "SELF-CHECK: state read returns a real value, and comparing it to an impossible one is false",
    `fusionPreset=${live.fusionPreset}`)
  const sliderProbe = await body.locator('input[type="range"][data-nonexistent]').count()
  say(sliderProbe === 0, "SELF-CHECK: the slider locator reports a MISS for a selector that matches nothing")

  /* ---- 2. ONE row of relationship pills ---------------------------------- */
  for (const p of FUSION_LABELS) {
    say(trimmed.includes(p.label), `relationship pill present: ${p.label}`)
  }
  say(trimmed.includes("None"), "relationship pill present: None")
  // The retired second row. Every one of the old animated-fusion labels must be
  // absent as a top-level pill — they live on as captions now.
  const strayVariants = S.ANIMATED_FUSION_PRESET_DEFS
    .map((p) => p.label)
    .filter((l) => trimmed.includes(l))
  say(strayVariants.length === 0, "no second row of animated-fusion pills", strayVariants.join(", ") || "none")
  /* THE COUNT MOVED BECAUSE THE PANEL GAINED A REAL CONTROL, and it is still
   * EXACT so it can still fail.
   *
   * The panel now carries the user's own fusion rail (PRD Layer 14 — "a NEW
   * AUTHORED visual system"), whose only control with an empty library is
   * "+ New fusion". This script clears the library on load, so the expected
   * count is deterministic: 8 built-in relationships + None + 3 drives + the
   * create button. Written as a sum of named parts rather than a number, so the
   * next person to change the panel has to state what they added. */
  /* 2026-08-03: two, not one. "+ Fuse everything" joined "+ New fusion" — it
   * authors a fusion that links every system at once, which is what Sebs assumed
   * fusion already meant, and it lands in the library rather than on the preset
   * rail. Stated rather than absorbed, which is the point of writing this count
   * as a sum of named parts. */
  const AUTHORING_BUTTONS = 2 // "+ New fusion" and "+ Fuse everything"
  /* 2026-08-07: the combination picker joined the panel — the power set of the
   * seven systems, 120 cells. Its always-visible controls are the SEVEN system
   * chips, the named cell for the current combination, and "Browse all 120".
   * The browse grid itself is behind that button and is counted only when open,
   * which is why this stays a small number and not 129.
   *
   * Stated as named parts rather than absorbed into a literal, because that is
   * the entire point of writing the count this way: the next person to change
   * the panel has to say what they added. `FUSION_SYSTEMS` is imported rather
   * than typed as 7 — a hand-copied count is the inventory-that-drifts defect
   * this repo has hit five times. */
  const PICKER_BUTTONS = F.FUSION_SYSTEMS.length + 1 + 1 // chips + the named cell + Browse all
  /* 2026-10-03 (CL-REDS2): 806b2c909 added Chaos, Reveal and Tip shimmer dials and
   * the Completion and Pause hold rows, and the keyed fields put a key button beside
   * every dial. Named parts again, each read from code: one key button per fusion
   * dial in lib/style-key-meta.ts, one pill per value of FusionCompletion and
   * FusionPauseHold in lib/style-system.ts. */
  const KEY_BUTTONS = DIALS.length
  const CHOICE_BUTTONS = COMPLETIONS.length + PAUSE_HOLDS.length
  const expectedButtons = FUSION_LABELS.length + 1 + DRIVES.length + AUTHORING_BUTTONS + PICKER_BUTTONS + KEY_BUTTONS + CHOICE_BUTTONS
  say(DIALS.length >= 3 && COMPLETIONS.length > 0 && PAUSE_HOLDS.length > 0,
    "SELF-CHECK: the derived parts were read from code, none came back empty",
    `dials [${DIALS.map((d) => d.label).join(", ")}], completion ${COMPLETIONS.join(" ")}, pause hold ${PAUSE_HOLDS.join(" ")}`)
  say(nButtons === expectedButtons,
    `pill count is ${FUSION_LABELS.length} relationships + None + 3 drives + ${AUTHORING_BUTTONS} authoring + ${PICKER_BUTTONS} picker (${F.FUSION_SYSTEMS.length} system chips, the named cell, Browse all) + ${KEY_BUTTONS} key buttons (one per dial) + ${COMPLETIONS.length} completion + ${PAUSE_HOLDS.length} pause hold = ${expectedButtons}`,
    `${nButtons} buttons: ${trimmed.join(" | ")}`)
  say(nButtons !== expectedButtons - KEY_BUTTONS,
    "  must-fail: the same sum without the key buttons does not match the panel",
    `${expectedButtons - KEY_BUTTONS} against ${nButtons}`)
  say(trimmed.some((t) => /New fusion/.test(t)),
    "the user can reach the authoring rail from this panel",
    trimmed.filter((t) => /New/.test(t)).join(", ") || "ABSENT")

  /* ---- 3. three drive pills, wired to fusionDrive ------------------------ */
  for (const d of ["Loop", "Arc", "Burst"]) {
    say(trimmed.includes(d), `drive pill present: ${d}`)
  }

  /* ---- 6. two separate dials, and the retired vocabulary is gone --------- */
  const panelText = (await body.textContent()) ?? ""
  say(/\bLink\b/.test(panelText), "Link dial is labelled")
  say(/\bSwing\b/.test(panelText), "Swing dial is labelled")
  say(/\bSpeed\b/.test(panelText), "Speed dial is labelled")
  for (const d of DIALS.filter((d) => !["Link", "Swing", "Speed"].includes(d.label))) {
    say(panelText.includes(d.label), `${d.label} dial is labelled`)
  }
  say(nSliders === DIALS.length, `exactly ${DIALS.length} dials (${DIALS.map((d) => d.label).join(", ")}), one per fusion key path`, `${nSliders}`)
  say(nSliders !== 3, "  must-fail: the old typed count of three dials does not match the panel", `${nSliders}`)
  say(!/Animated fusion/i.test(panelText), "retired copy gone: 'Animated fusion'")
  say(!/\bIntensity\b/.test(panelText), "retired copy gone: 'Intensity'")
  say(await body.locator('input[type="checkbox"]').count() === 0,
    "the animated-fusion checkbox is gone",
    `${await body.locator('input[type="checkbox"]').count()} checkboxes`)

  /* ---- 6b. the dials are ON SCREEN, not just in the DOM -----------------
   * `isVisible()` is true for an element scrolled out of a clipping container,
   * so it cannot answer this. The first run of this script passed every control
   * assertion while the screenshot showed a panel that ENDED at the Drive row:
   * all three dials existed, below a max-height with overflow-y-auto, and a user
   * looking for the dial that explains "why is nothing moving" would not have
   * seen it. So compare boxes against the scroll container's box. */
  /* CL-FUSIONUI (2026-10-03): this row read "all three dials visible without
   * scrolling". 806b2c909 grew the panel to six dials in two rows plus the
   * Completion and Pause hold rows, and the 2026-09-26 ruling is more controls,
   * not fewer, with space coming from the layout (workspaces, a dock that
   * maximizes), so "every dial fits one screen of a fixed panel" cannot hold as
   * controls keep landing. Two claims replace it, and they fail for different
   * causes:
   *   OPEN    the defect above: the panel ends before the dials. At open, with
   *           no scroll, the FIRST row of dials (label, track AND explanation,
   *           the explanation being the point) is on screen.
   *   REACH   every dial (label, track, explanation) comes fully on screen by a
   *           real mouse wheel inside the panel. A clip with no scroll fails it.
   * Each dial is its <label>, which holds the name, the value, the track and the
   * explanation. Dials below the fold at open are printed, not failed. */
  const dialLabels = body.locator("label")
  const nLabels = await dialLabels.count()
  const measureDials = async () => {
    await body.evaluate((b) => { b.scrollTop = 0 })
    await page.waitForTimeout(120)
    const bb = await body.boundingBox()
    const inside = (b) => b && b.y >= bb.y - 1 && b.y + b.height <= bb.y + bb.height + 1
    const atOpen = []
    for (let i = 0; i < nLabels; i++) atOpen.push(await dialLabels.nth(i).boundingBox())
    const tracks = []
    for (let i = 0; i < nSliders; i++) tracks.push((await sliders.nth(i).boundingBox())?.y ?? Infinity)
    const firstRowTop = Math.min(...tracks)
    const firstRow = tracks.map((y, i) => (Math.abs(y - firstRowTop) < 4 ? i : -1)).filter((i) => i >= 0)
    const firstRowOn = firstRow.length > 0 && firstRow.every((i) => inside(atOpen[i]))
    const belowFold = atOpen.map((b, i) => (inside(b) ? null : `${i}@${b ? Math.round(b.y) : "none"}`)).filter(Boolean)
    const seen = new Set(atOpen.map((b, i) => (inside(b) ? i : -1)).filter((i) => i >= 0))
    await page.mouse.move(bb.x + 6, bb.y + bb.height / 2)
    let last = -1
    for (let step = 0; step < 60; step++) {
      await page.mouse.wheel(0, 90)
      await page.waitForTimeout(70)
      const top = await body.evaluate((b) => b.scrollTop)
      for (let i = 0; i < nLabels; i++) if (inside(await dialLabels.nth(i).boundingBox())) seen.add(i)
      if (top === last) break
      last = top
    }
    await body.evaluate((b) => { b.scrollTop = 0 })
    const unreached = [...Array(nLabels).keys()].filter((i) => !seen.has(i))
    return { bb, firstRow, firstRowOn, belowFold, unreached, scrolled: last }
  }
  const real = await measureDials()
  console.log(`[fusion-ui] scroll body ${Math.round(real.bb.y)}..${Math.round(real.bb.y + real.bb.height)}; first dial row ${real.firstRow.join(",")}; below the fold at open: ${real.belowFold.join(" ") || "none"}`)
  say(nLabels === nSliders, "one label per dial, so each dial's box is its label", `${nLabels} labels, ${nSliders} dials`)
  say(real.firstRowOn,
    "OPEN: the first row of dials (label, track, explanation) is on screen without scrolling the panel",
    `row ${real.firstRow.map((i) => DIALS[i]?.label ?? i).join(", ")}`)
  say(real.unreached.length === 0,
    `REACH: a mouse wheel inside the panel brings each of the ${nLabels} dials fully on screen`,
    `unreached ${real.unreached.map((i) => DIALS[i]?.label ?? i).join(", ") || "none"}; scrolled to ${real.scrolled}`)
  /* Must-fails, each bringing one cause back in the page and then undoing it. */
  const firstLabelBottom = Math.max(...await Promise.all(real.firstRow.map(async (i) => { const b = await dialLabels.nth(i).boundingBox(); return b.y + b.height })))
  const firstTrackTop = (await sliders.nth(real.firstRow[0]).boundingBox()).y
  const mutate = (css) => body.evaluate((b, c) => { b.dataset.mfStyle = b.getAttribute("style") ?? ""; Object.assign(b.style, c) }, css)
  const restore = () => body.evaluate((b) => { b.setAttribute("style", b.dataset.mfStyle ?? ""); delete b.dataset.mfStyle; b.scrollTop = 0 })
  // OPEN's cause: the panel ends above the dials (the first run's defect).
  await mutate({ flex: "none", height: `${Math.round(firstTrackTop - real.bb.y - 8)}px` })
  const mfOpen = await measureDials()
  await restore()
  say(!mfOpen.firstRowOn && mfOpen.unreached.length === 0,
    "  must-fail: a panel that ends above the dials fails OPEN and still passes REACH (the rows measure different causes)",
    `OPEN ${mfOpen.firstRowOn ? "passed" : "failed"}, unreached ${mfOpen.unreached.length}`)
  // REACH's cause: a clip with no scroll, cut just below the first dial row.
  await mutate({ flex: "none", height: `${Math.round(firstLabelBottom - real.bb.y + 4)}px`, overflowY: "hidden" })
  const mfReach = await measureDials()
  await restore()
  say(mfReach.unreached.length > 0,
    "  must-fail: a panel clipped below the first dial row with no scroll leaves dials unreached",
    `unreached ${mfReach.unreached.map((i) => DIALS[i]?.label ?? i).join(", ") || "none"}`)

  /* ---- 4 + 5. all 24 combinations reachable BY CLICK -------------------- */
  const captions = new Map()
  let combos = 0, comboFails = 0
  for (const p of FUSION_LABELS) {
    await body.getByRole("button", { name: p.label, exact: true }).click()
    await page.waitForTimeout(160)
    for (const d of DRIVES) {
      const btn = body.getByRole("button", { name: d[0].toUpperCase() + d.slice(1), exact: true })
      await btn.click()
      await page.waitForTimeout(160)
      const st = await readState()
      const pressed = await btn.getAttribute("aria-pressed")
      /* The caption block: the named combination's label + description.
       *
       * LOCATED BY `data-fusion-caption`, NOT BY `p.rounded-md`. It was located
       * by the styling class, and when the caption block gained a button beside
       * it — so the rounding moved to a wrapping div — this locator matched
       * nothing and the gate TIMED OUT rather than reporting a wrong caption.
       * A timeout reads as a flaky harness, which is the failure mode
       * docs/README.md's fifth bug pattern is about. A control's identity does
       * not live in its border radius. */
      const cap = (await body.locator("[data-fusion-caption]").first().textContent())?.trim() ?? ""
      const ok = st.fusionPreset === p.id && st.fusionDrive === d && pressed === "true" && cap.length > 20
      combos++
      if (!ok) {
        comboFails++
        console.log(`  FAIL  ${p.id}/${d} — state ${st.fusionPreset}/${st.fusionDrive}, aria-pressed=${pressed}, caption ${cap.length}ch`)
      }
      captions.set(`${p.id}/${d}`, cap)
      // Legacy mirror must track the drive, or the scripts that still read it lie.
      if (st.fusionAnimationEnabled !== (d !== "loop")) {
        comboFails++
        console.log(`  FAIL  ${p.id}/${d} — legacy fusionAnimationEnabled=${st.fusionAnimationEnabled}`)
      }
    }
    await shot(`10-${p.id}.png`)
  }
  say(comboFails === 0, `all ${combos} combinations reachable by click and correct in state`, `${comboFails} failures`)
  const uniqueCaptions = new Set(captions.values())
  say(uniqueCaptions.size === combos,
    "every combination has its OWN caption (no two combinations described identically)",
    `${uniqueCaptions.size} distinct captions for ${combos} combinations`)

  /* ---- the dials actually write their own fields ------------------------- */
  const setSlider = async (i, v) => {
    await sliders.nth(i).fill(String(v))
    await page.waitForTimeout(150)
  }
  await setSlider(0, 0.25)
  let st = await readState()
  say(Math.abs(st.fusionIntensity - 0.25) < 1e-6 && Math.abs(st.fusionSwing - 1) < 1e-6,
    "Link slider writes fusionIntensity and only that",
    `link=${st.fusionIntensity} swing=${st.fusionSwing}`)
  await setSlider(1, 0)
  st = await readState()
  say(Math.abs(st.fusionSwing) < 1e-6 && Math.abs(st.fusionIntensity - 0.25) < 1e-6,
    "Swing slider writes fusionSwing and only that",
    `link=${st.fusionIntensity} swing=${st.fusionSwing}`)
  await setSlider(2, 2)
  st = await readState()
  say(Math.abs(st.fusionAnimationSpeed - 2) < 1e-6, "Speed slider writes fusionAnimationSpeed", `${st.fusionAnimationSpeed}`)
  await shot("20-dials.png")

  /* ---- None turns it off, by click -------------------------------------- */
  await body.getByRole("button", { name: "None", exact: true }).click()
  await page.waitForTimeout(200)
  st = await readState()
  say(st.fusionPreset === "none" && st.fusionDrive === "loop" && st.fusionAnimationEnabled === false,
    "None clears the relationship and resets the drive",
    `${st.fusionPreset}/${st.fusionDrive}`)

  say(errors.length === 0, "console errors", `${errors.length}${errors.length ? ": " + errors[0] : ""}`)
  say(missedShots.length === 0, "every screenshot was captured (evidence is complete)",
    missedShots.join("; ") || `${FUSION_LABELS.length + 2} frames`)

  writeFileSync(join(OUT, "fusion-ui-report.json"),
    JSON.stringify({ results, captions: [...captions], missedShots }, null, 2))
  await ctx.close()
  await browser.close()
  for (const f of readdirSync(VIDEO)) {
    if (f.endsWith(".webm") && !f.startsWith("session")) {
      renameSync(join(VIDEO, f), join(VIDEO, `session-fusion-ui-${LABEL}.webm`))
    }
  }
  /* ═══ PROVENANCE · WAS THIS VERDICT MEASURED ON THIS RUN, ON THIS TREE? ═════
   *
   * ⚠ MEASURED 2026-08-28: this gate's capture directory was 23.5 days behind when this lane started, though a sibling lane had already re-run it.
   * `assert-gate-integrity.mjs` channel F called that out and was right.
   *
   * THIS GATE CAN RECAPTURE — it drives the browser and rewrites the directory
   * on every invocation — so the cure for the AGE is to run it, and running it
   * is what makes the row below pass. What the row guards is the part running
   * does not cure:
   *
   *   the capture is younger than this process   what was just graded was written
   *                                              by THIS run, not left behind by
   *                                              an older one. `lib/evidence-swap.mjs`
   *                                              keeps the previous set when a run
   *                                              dies partway, which is exactly the
   *                                              case where stale frames get graded.
   *   no source moved while it ran               six lanes share this checkout
   *                                              tonight. A lib/ write landing
   *                                              mid-capture straddles two builds
   *                                              and the reading belongs to neither.
   *                                              Measured on assert-geom-offthread
   *                                              at 12:23 — a sibling lane wrote
   *                                              lib/style-fusion.ts nine seconds in,
   *                                              and three arms went red with nothing
   *                                              able to say why.
   *
   * Together they imply channel F's own test: a capture younger than a process
   * that started after every source write post-dates every source write.
   *
   * The subject is all three roots, the same three channel F compares against;
   * `captureFreshness()` walks `lib/` alone and tonight `app/` moved with it.
   * The filter is narrowed to the captured frames and session video so the row cannot certify this gate's
   * own fusion-ui-report.json as evidence — the trap `assert-drawin-pentip.mjs` recorded.
   * DISPATCH §3 — a SKIP is not a pass. */
  {
    const capNow = newestCapture(OUT, /\.(png|webm)$/)
    const subjNow = ["lib", "app", "components"]
      .map((d) => newestUnder(join(ROOT, d)))
      .filter((x) => x.file)
      .sort((x, y) => y.ms - x.ms)[0]
    const relP = (f) => (f && f.startsWith(ROOT) ? f.slice(ROOT.length + 1) : f)
    const stampP = (ms) => new Date(ms).toLocaleString()
    const started = performance.timeOrigin
    const landed = Boolean(capNow.file) && capNow.ms >= started
    const treeHeld = Boolean(subjNow?.file) && subjNow.ms <= started
    const detailP = !landed
      ? (capNow.file
          ? `THE CAPTURE DID NOT LAND — newest artefact ${relP(capNow.file)} ${stampP(capNow.ms)} predates this run, which started ${stampP(started)}. ` +
            `The rows here graded evidence an earlier run left behind. Re-run node scripts/verify/assert-fusion-ui.mjs --label=${LABEL}; do NOT relax this row.`
          : `NO ARTEFACT written by this run under ${relP(OUT)} — nothing was graded, so nothing below is a verdict.`)
      : !treeHeld
        ? `THE TREE MOVED UNDER THIS RUN — ${relP(subjNow.file)} was written ${stampP(subjNow.ms)}, after this run started ${stampP(started)}. ` +
          `The capture straddles two builds and belongs to neither. Re-run node scripts/verify/assert-fusion-ui.mjs --label=${LABEL}; do NOT relax this row.`
        : `capture ${relP(capNow.file)} ${stampP(capNow.ms)} · run started ${stampP(started)} · newest source ${relP(subjNow.file)} ${stampP(subjNow.ms)}`
    say(
      landed && treeHeld,
      "PROVENANCE · this verdict was measured on this run, against a tree that did not move under it",
      detailP,
    )
  }
  console.log(pass ? "\nFUSION UI: ALL PASS" : "\nFUSION UI: FAILURES PRESENT")
  console.log(`wrote ${OUT}`)
  process.exit(pass ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
