// A FUSION YOU JUST MADE MUST DO SOMETHING. THIS IS THE GATE FOR THAT.
//
// WHY IT EXISTS, in Sebs's words (2026-08-02):
//   *"my fusion doesnt work ... i can make a new custom fusion but nhting
//    actually apples"*
//
// He was right, and the reason nothing caught it is the interesting part.
// `assert-fusion-authoring.mjs` proves every source and every target is live —
// and it is not lying. It BUILDS the composition each link needs before it
// measures it (its `BASE` turns texture, dither and ASCII on, its `SRC_ARM`
// animates the layer a phase source reads). The user gets whatever composition
// they happen to be in. So the gate and the product were answering two different
// questions, and only one of them was the product. This gate asks the product's
// question and nothing else: click the button a person clicks, and measure what
// happens.
//
// WHAT IT ASSERTS
//   A · THE MODEL, exactly. `newCustomFusion` through `fusionWakePatch` must
//       leave NO link asleep, and every link must move the FusionFrame away from
//       identity by a non-zero amount. This is the row that catches the actual
//       defect, because the actual defect was arithmetic: the seed link
//       `asciiField -> ditherThreshold` contributed EXACTLY 0.000000, ASCII
//       having been switched on but not ANIMATED, and a phase source whose layer
//       is still is pinned at `phaseTriangle(0) = 0` by design.
//   B · THE SURFACE, by click. The real button, the real DOM, the real canvas.
//       The relationship — isolated from the composition change by holding
//       everything the click produced and moving only the Link dial — must move
//       the picture more than the identical window with the coupling off.
//   C · AND THE MARK MUST SURVIVE IT. Waking two screen layers on a near-black
//       body can crush a modelled stroke into a black bar; a fusion that acts by
//       destroying the drawing is not a fix.
//
// THE KNOWN-BAD IS THE BUILD THAT SHIPPED, and it is reachable on demand:
//   node scripts/verify/assert-fusion-newborn.mjs --mutate=prior   # must FAIL
// `prior` reproduces 2026-08-02's `createFusion` exactly — the naked
// `ditherEnabled`/`asciiEnabled` pair and the old `breath -> gloss` seed — and
// requires the same rows to come back RED. Calibrated: it does.
//   --mutate=unlinked   Link 0, the engine's documented identity frame.
//
// Usage:
//   node scripts/verify/_run-clean.mjs scripts/verify/assert-fusion-newborn.mjs
import { chromium } from "./lib/browser.mjs"
import { openStyle } from "./lib/dock.mjs"
import { writeFileSync, mkdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { loadTs } from "./_ts-load.mjs"
import { PORT } from "./lib/dev-server.mjs"
/* THE PROVENANCE MODULE THIS DIRECTORY ALREADY HAD. `_capture-freshness.mjs` was
 * written for exactly the hole this gate has, and `assert-drawin-pentip.mjs` and
 * `assert-pentip-specks.mjs` already use these two primitives the same way.
 * Nothing new is written here. */
import { newestUnder, newestCapture } from "./_capture-freshness.mjs"

const S = loadTs("lib/style-system.ts")
const FUS = loadTs("lib/style-fusion.ts")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "run")
const MUTATE = arg("mutate", "")
const OUT = join(ROOT, "docs", "verification", "fusion-newborn", LABEL)
mkdirSync(OUT, { recursive: true })

/* THE 2026-08-02 BUILD, VERBATIM. Its `createFusion` set exactly these two
 * booleans and nothing else, and `newCustomFusion` seeded exactly these two
 * links. Kept as data rather than as a git reference so the known-bad is
 * reproducible after the branch moves on. */
const PRIOR_WAKE = { ditherEnabled: true, asciiEnabled: true, motionMode: "independent" }
const PRIOR_LINKS = [
  { id: "l1", source: "asciiField", target: "ditherThreshold", amount: 0.7 },
  { id: "l2", source: "breath", target: "gloss", amount: 0.45 },
]

/* The margin the coupled window has to clear over the same window uncoupled.
 * MEASURED, not chosen: the shipped build reads 1.00-1.05x (the coupling adds
 * nothing the layer's own scroll was not already doing) and the fixed build
 * reads 1.50x. 1.25 sits between them with room on both sides. */
const COUPLING_MARGIN = 1.25
/* What ONE relationship, alone, has to move the mark's mean value by before it
 * counts as reaching the screen. Calibrated on this instrument in this scene:
 * the empty-fusion control's own repeatability reads ~0.1-0.5 luma (printed with
 * the row), the shipped build's dead link reads 0.00, and its live one reads
 * ~5.9. 1.0 luma is clear of the noise and far below any working link. */
const LINK_FLOOR = 1.0
/* How much of the mark's own inked area must survive being woken. The 2026-08-02
 * wake kept 87.0% and turned a modelled grey stroke into a black bar; the
 * composition this build wakes into keeps 96%+ (measured,
 * docs/verification/fusion-newborn/wake-v3). 0.92 is below the good arm and
 * above the bad one. */
const INK_RETENTION = 0.92

function testStroke() {
  const pts = []
  for (let i = 0; i <= 150; i++) {
    const t = i / 150
    pts.push({ x: 140 + t * 600, y: 320 + Math.sin(t * Math.PI * 2.4) * 150 })
  }
  return [pts]
}

/* ON WHITE, BECAUSE THE PAPER IS WHITE. `grab()` returns the WebGL canvas, which
 * is TRANSPARENT wherever the scene did not draw — `document.body` computes
 * `lab(100 0 0)` and IS the paper. Measuring the raw grab counts undrawn paper
 * as black, which inverts every ink statistic; compositing a sheet onto a dark
 * background made this pass read "creating a fusion shreds the mark" off its own
 * contact sheet, when the shredding was the sheet's background showing through
 * the mark's antialiasing. */
const PAPER = "#ffffff"
function onPaper(img) {
  const c = createCanvas(img.width, img.height)
  const g = c.getContext("2d")
  g.fillStyle = PAPER
  g.fillRect(0, 0, img.width, img.height)
  g.drawImage(img, 0, 0)
  return c
}

async function frameDelta(a, b) {
  const [ia, ib] = await Promise.all([loadImage(a), loadImage(b)])
  const w = Math.min(ia.width, ib.width)
  const h = Math.min(ia.height, ib.height)
  const da = onPaper(ia).getContext("2d").getImageData(0, 0, w, h).data
  const db = onPaper(ib).getContext("2d").getImageData(0, 0, w, h).data
  let sum = 0
  for (let i = 0; i < da.length; i += 4) {
    sum += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])
  }
  return sum / (w * h * 3)
}

/** Share of the frame carrying ink — a pixel meaningfully darker than paper. */
async function inkFrac(png) {
  const img = await loadImage(png)
  const d = onPaper(img).getContext("2d").getImageData(0, 0, img.width, img.height).data
  let n = 0
  for (let i = 0; i < d.length; i += 4) {
    if (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2] < 215) n++
  }
  return n / (img.width * img.height)
}

/**
 * MEAN LUMINANCE OF THE RENDERED FORM — and why the coupling is measured here
 * rather than in whole-frame pixel deltas.
 *
 * The seed relationship needs the glyph field SCROLLING (a phase source whose
 * layer is still is pinned at zero — the defect this gate exists for). So the
 * composition under test is animated by necessity, and a whole-frame delta is
 * dominated by that scroll: it changes WHICH pixels are dark from frame to
 * frame while barely moving their average. Measured, that swamped the subject —
 * a coupled window read 1.14x-1.50x its own uncoupled control across runs, a
 * range too wide to put a bar in.
 *
 * The coupling does the opposite. Both seed links move the mark's overall VALUE:
 * one biases the dither threshold (more ink or less), the other lifts the
 * emissive. So the mark's mean luminance is where the relationship lives and the
 * scroll very nearly is not, which is what makes this a measurement of the
 * subject instead of of its neighbour.
 *
 * The FORM is selected by ALPHA, not by darkness: `grab()` returns the WebGL
 * canvas, transparent wherever the scene did not draw, so `a > 12` is exactly
 * "the mark rendered here" and is independent of how light or dark the layers
 * have made it. A brightness test would move the region it is averaging over
 * every time the thing it is measuring changed.
 */
async function markLuma(png) {
  const img = await loadImage(png)
  const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  const d = c.getContext("2d").getImageData(0, 0, img.width, img.height).data
  let sum = 0
  let n = 0
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] <= 12) continue
    sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
    n++
  }
  return n ? sum / n : 0
}

/* ------------------------------------------------------------------------- *
 * THE MODEL HALF — exact, and where the defect actually lived.
 * ------------------------------------------------------------------------- */

const IDENTITY_FIELDS = {
  textureIntensityMul: 1, textureScaleMul: 1, textureTimeAdd: 0, textureContrastAdd: 0,
  ditherIntensityMul: 1, ditherThresholdAdd: 0, ditherScaleMul: 1, ditherTimeAdd: 0,
  ditherContrastAdd: 0, asciiDensityAdd: 0, asciiTimeAdd: 0, asciiCellMul: 1,
  asciiContrastAdd: 0, clearcoatAdd: 0, roughnessAdd: 0, envMapAdd: 0, sheenAdd: 0,
  metalnessAdd: 0, emissiveAdd: 0, iridescenceAdd: 0, colorScale: 1,
}

/**
 * The worst excursion this fusion drives away from the identity frame, over a
 * window long enough to contain a full breath (omega 1.2 -> ~5.2 s).
 *
 * The signals are SIMULATED the way viewport-3d.tsx writes them, off the state's
 * own speed dials, so a layer this state does not animate contributes a PINNED
 * phase — which is the exact condition the defect lived in and must therefore be
 * reproducible here rather than assumed away.
 */
function worstExcursion(state, fusion) {
  const st = { ...state, customFusions: [fusion], fusionPreset: FUS.customFusionKey(fusion.id) }
  let worst = 0
  const cellRate = st.asciiScrollSpeed * 1.6
  for (let i = 0; i <= 240; i++) {
    const t = i * 0.05
    const sig = { asciiTime: 0, ditherTime: 0, textureTime: 0, stackTime: 0, stackAmount: 1, orbit: 0.6 + t * 0.05 }
    if (st.asciiAnimated && st.asciiAnimationType !== "none") sig.asciiTime = t * cellRate
    if (st.ditherAnimated) sig.ditherTime = t * st.ditherSpeed * 6
    if (st.textureAnimated) sig.textureTime = t * st.textureSpeed * 1.2
    if (st.layerStackEnabled && st.stackAnimationEnabled && st.stackAnimationType !== "none")
      sig.stackTime = t * 0.5
    const fr = FUS.evaluateFusion(st, { elapsed: t, reveal: 1, sinceCompletion: t }, sig, t)
    if (!fr) continue
    for (const k of Object.keys(IDENTITY_FIELDS)) {
      const d = Math.abs(fr[k] - IDENTITY_FIELDS[k])
      if (Number.isFinite(d) && d > worst) worst = d
    }
    if (fr.sweep) worst = Math.max(worst, Math.abs(fr.sweep.amt))
  }
  return worst
}

/** Per-link, so a fusion cannot pass on the strength of one loud relationship
 *  while the other is a dead dropdown entry — which is precisely what shipped. */
function deadLinks(state, fusion) {
  return (fusion.links ?? [])
    .filter((l) => worstExcursion(state, { ...fusion, links: [l] }) <= 1e-9)
    .map((l) => `${l.source}->${l.target}`)
}

async function main() {
  let pass = true
  const results = []
  const say = (ok, label, detail) => {
    if (!ok) pass = false
    results.push({ ok, label, detail })
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
  }

  /* ================== 0 · CAN THIS SCRIPT FAIL? ========================== */
  /* Every instrument below is probed against an input whose answer is known.
   * Eleven instruments in this repo have reported green while measuring
   * nothing, and three of those were born unable to fail. */
  {
    const base = { ...S.DEFAULT_STYLE_STATE, motionMode: "independent" }
    // A fusion whose single link is at amount 0 CANNOT move the frame. If the
    // excursion metric reports movement here it is measuring something else.
    const nullFusion = {
      id: "selfcheck", name: "selfcheck", glowColor: "#7ec8a0",
      links: [{ id: "z", source: "breath", target: "glow", amount: 0 }],
    }
    say(worstExcursion(base, nullFusion) <= 1e-9,
      "SELF-CHECK: the excursion metric reports EXACTLY zero for a link at amount 0")
    // And it must report movement for one that plainly does.
    const loud = { ...nullFusion, links: [{ id: "z", source: "breath", target: "glow", amount: 1 }] }
    say(worstExcursion(base, loud) > 0.05,
      "SELF-CHECK: and reports movement for a link that plainly acts",
      worstExcursion(base, loud).toFixed(4))
    // The sleep predicate must be able to say ASLEEP.
    const sleeping = FUS.fusionLinkSleep(
      { id: "z", source: "ditherField", target: "ditherThreshold", amount: 1 },
      { ...S.DEFAULT_STYLE_STATE },
      "loop",
    )
    say(sleeping.length > 0,
      "SELF-CHECK: the sleep predicate reports ASLEEP for a link whose layer is off",
      sleeping.map((r) => r.why).join("; ").slice(0, 90))
  }

  /* ================== A · THE MODEL ====================================== */
  console.log("\n--- A · the model: what a newborn fusion computes ---")
  const fresh = { ...S.DEFAULT_STYLE_STATE }
  const newborn = FUS.newCustomFusion("gate")
  const wake = FUS.fusionWakePatch(newborn, fresh, "loop")
  const woken = { ...fresh, ...wake.patch }
  console.log(`  creating one switches on: ${wake.turnsOn.join(", ") || "(nothing)"}`)

  const asleepNow = (newborn.links ?? []).filter(
    (l) => FUS.fusionLinkSleep(l, woken, "loop").length > 0,
  )
  say(asleepNow.length === 0,
    "a brand-new fusion lands with NO relationship asleep",
    asleepNow.map((l) => `${l.source}->${l.target}`).join(", ") || `${newborn.links.length}/${newborn.links.length} awake`)

  const dead = deadLinks(woken, newborn)
  say(dead.length === 0,
    "and EVERY one of its relationships moves the frame away from identity",
    dead.join(", ") || `worst Δ${worstExcursion(woken, newborn).toFixed(4)}`)

  /* THE KNOWN-BAD, ASSERTED TO BE BAD. This is the row that keeps the gate
   * honest after the fix: if someone reverts the wake, `prior` stops being
   * distinguishable from the current build and this row goes red. */
  const priorState = { ...S.DEFAULT_STYLE_STATE, ...PRIOR_WAKE }
  const priorFusion = { ...newborn, id: "prior", links: PRIOR_LINKS }
  const priorDead = deadLinks(priorState, priorFusion)
  say(priorDead.length > 0,
    "CALIBRATION: the 2026-08-02 build IS reproducibly dead through this same metric",
    priorDead.join(", ") || "IT NOW LOOKS ALIVE — the known-bad no longer differs from the fix")

  /* EVERY SHIPPED LINK-AUTHORED RELATIONSHIP, on its own composition. Read out
   * of the module, so a preset added tomorrow is checked tomorrow.
   *
   * ⚠ THROUGH `applyPresetToStyleState`, NOT `{ ...DEFAULT, ...def.applies }` —
   * corrected 2026-08-04 after Sebs: *"some dont animate."*
   *
   * The spread was the preset's PATCH, which is a table an author wrote. The
   * pill's click is `onSelectPreset("fusion", id)` -> `handleSelectPreset`
   * (app/page.tsx) -> `applyPresetToStyleState`, and that function also runs the
   * composition RESET and — as of this pass — the derived wake. Grading the
   * table instead of the function is this repo's own "test the real entry path,
   * not a synthesized one": the two agreed today, and nothing here could have
   * noticed if they had not. */
  const builtinDead = []
  for (const [id, f] of Object.entries(FUS.BUILTIN_LINK_FUSIONS)) {
    const def = S.FUSION_PRESET_DEFS.find((p) => p.id === id)
    if (!def) {
      builtinDead.push(`${id}(no preset definition)`)
      continue
    }
    const st = S.applyPresetToStyleState({ ...S.DEFAULT_STYLE_STATE }, "fusion", id)
    const d = deadLinks(st, f)
    const sleeping = (f.links ?? []).filter((l) => FUS.fusionLinkSleep(l, st, "loop").length > 0)
    if (d.length) builtinDead.push(`${id}: dead ${d.join("/")}`)
    if (sleeping.length) builtinDead.push(`${id}: asleep ${sleeping.map((l) => l.source + "->" + l.target).join("/")}`)
    console.log(`  ${d.length || sleeping.length ? "FAIL" : "  ok"}  ${id.padEnd(14)} ${f.links.length} links, worst Δ${worstExcursion(st, f).toFixed(4)}`)
  }
  say(builtinDead.length === 0,
    `all ${Object.keys(FUS.BUILTIN_LINK_FUSIONS).length} link-authored relationships ship with every link live THROUGH THE PILL'S OWN PATH (applyPresetToStyleState)`,
    builtinDead.join(" · ") || "no dead or sleeping links")

  /* ── THE THIRTEENTH PRESET · is the correctness in the DERIVATION, or in
   *    twelve hand-written patches that all happened to be right? ───────────
   *
   * The row above is green and was green before the wake reached this path,
   * because every shipped `applies` switches on exactly what its own links read.
   * That is twelve pieces of remembering, and remembering is what a derivation
   * replaces. So this asks the question the rail cannot: a relationship whose
   * preset patch FORGOT its layers — the shape a thirteenth preset will have the
   * first time someone adds one — must still land awake.
   *
   * PAIRED, so it can fail in the direction that matters. Without the wake the
   * same links must be measurably ASLEEP; with it, awake. If the "without" arm
   * ever comes back awake, the wake is not what is doing the work here and this
   * row is worth nothing. */
  {
    const forgetful = {
      id: "gate-thirteenth",
      name: "Thirteenth",
      glowColor: "#7ec8a0",
      links: [
        { id: "x1", source: "asciiField", target: "ditherThreshold", amount: 0.7 },
        { id: "x2", source: "ditherField", target: "asciiDensity", amount: 0.6 },
        { id: "x3", source: "stackField", target: "textureBite", amount: 0.5 },
      ],
    }
    /* The composition a forgetful author would ship: fusion's own base (motion
     * on, every layer OFF) and nothing else. */
    const bare = { ...S.DEFAULT_STYLE_STATE, motionMode: "independent" }
    const withoutWake = (forgetful.links ?? []).filter(
      (l) => FUS.fusionLinkSleep(l, bare, "loop").length > 0,
    )
    const wake13 = FUS.fusionWakePatch(forgetful, bare, "loop")
    const withWake = (forgetful.links ?? []).filter(
      (l) => FUS.fusionLinkSleep(l, { ...bare, ...wake13.patch }, "loop").length > 0,
    )
    say(withoutWake.length === forgetful.links.length,
      "CALIBRATION: a relationship whose patch forgot its layers IS asleep without the wake — every link of it",
      `${withoutWake.length}/${forgetful.links.length} asleep: ${withoutWake.map((l) => l.source + "->" + l.target).join(", ")}`)
    say(withWake.length === 0,
      "…and the DERIVED wake — the one applyPresetToStyleState now runs on every fusion selection — brings all of them round",
      `switches on: ${wake13.turnsOn.join(", ") || "(nothing)"}`)
    /* AND THE WIRE ITSELF. The two rows above prove `fusionWakePatch` works; this
     * proves the model CALLS it, which is the actual defect Sebs hit — a correct
     * function nothing reached from the rail. Read off the shipped source, so
     * deleting the call turns it red even if every other row stays green. */
    const sysSrc = readFileSync(join(ROOT, "lib", "style-system.ts"), "utf8")
    say(/fusionWakePatch\(/.test(sysSrc),
      "CONTROL · applyPresetToStyleState's own file really does call fusionWakePatch — the built-in path is wired, not just correct by hand",
      `${(sysSrc.match(/fusionWakePatch\(/g) ?? []).length} call site(s) in lib/style-system.ts`)
  }

  /* THE FUSE-EVERYTHING ARM. Its whole claim is coverage, so the claim is the
   * assertion: it must reach every SYSTEM, not merely have many links. */
  const every = FUS.fuseEverything("gate-everything")
  const everyWake = FUS.fusionWakePatch(every, fresh, "loop")
  const everyState = { ...fresh, ...everyWake.patch }
  const everyDead = deadLinks(everyState, every)
  const systemsOf = (f) =>
    new Set(
      (f.links ?? []).map((l) => {
        const t = FUS.FUSION_TARGETS.find((x) => x.id === l.target)
        return t?.needs ?? "material"
      }),
    )
  const covered = systemsOf(every)
  say(everyDead.length === 0 && covered.size >= 4,
    '"Fuse everything" reaches every system at once, with no dead link',
    `${[...covered].join(", ")} · ${everyDead.join(", ") || "0 dead"}`)
  /* AND EVERY LINK ON A DIFFERENT DRIVER, which is the whole design of it: nine
   * relationships on one breath is one throbbing object, not nine systems. */
  const drivers = new Set(every.links.map((l) => l.source))
  say(drivers.size === every.links.length,
    "…and every one of its relationships runs off a DIFFERENT driver",
    `${drivers.size} drivers for ${every.links.length} links`)

  /* THE INVENTORY. This gate iterates the rail's own lists rather than copying
   * them, so it cannot fall behind; printed so that is visible rather than
   * claimed. */
  console.log(
    `  the rail: ${FUS.FUSION_SOURCES.length} sources x ${FUS.FUSION_TARGETS.length} targets x 3 drives` +
      ` = ${FUS.FUSION_SOURCES.length * FUS.FUSION_TARGETS.length * 3} combinations`,
  )

  /* ================== B · THE SURFACE, BY CLICK ========================== */
  console.log("\n--- B · the surface: the button a person clicks ---")
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: 1500, height: 950 },
    deviceScaleFactor: 2,
  })
  const page = await ctx.newPage()
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 200))
  })
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`))
  // A clean library, or the pill counts depend on a previous run.
  await page.addInitScript(() => {
    try {
      window.localStorage.removeItem("freestroke.fusions.v1")
    } catch {}
  })
  await page.goto(`http://localhost:${PORT}`, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__styleHarness && window.__captureHarness, null, { timeout: 60000 })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12 }), testStroke())
  await page.waitForTimeout(1500)
  if (await page.evaluate(() => !!window.__revealHarness))
    await page.evaluate(() => window.__revealHarness.setProgress(1))
  await page.waitForTimeout(500)

  const grab = async () => {
    const url = await page.evaluate(() => window.__captureHarness.grab())
    return url ? Buffer.from(url.split(",")[1], "base64") : null
  }
  const readState = () => page.evaluate(() => window.__styleHarness.get().styleState)

  // L4: the Style panel shown from the rail on its Fusion family (the style bar's Show panel and the drawer's Fusion tab until L4).
  await openStyle(page, "fusion")
  await page.waitForTimeout(250)
  await page.waitForTimeout(400)
  const body = page.locator("div.fs-panel-enter")
  say((await body.count()) === 1, "the fusion panel is reachable by clicking")

  const ghost = await body.getByRole("button", { name: "Nonexistent Fusion Control", exact: true }).count()
  say(ghost === 0, "SELF-CHECK: the button locator reports a MISS for a control that does not exist")

  const beforeFrame = await grab()
  const beforeInk = await inkFrac(beforeFrame)
  say(beforeInk > 0.001, "SELF-CHECK: the frame being measured contains a rendered mark",
    `${(beforeInk * 100).toFixed(3)}% inked`)
  say((await frameDelta(beforeFrame, beforeFrame)) === 0,
    "SELF-CHECK: the pixel metric reports EXACTLY 0 for a frame against itself")

  const newBtn = body.locator("[data-fusion-new]")
  say((await newBtn.count()) === 1, "the '+ New fusion' control exists")
  await newBtn.click()
  await page.waitForTimeout(600)

  /* THE MUTATION ARMS drive the state back to the build being calibrated
   * against, THROUGH THE SAME `setStyle` the panel writes, so what follows
   * measures a real configuration and not a mocked one. */
  if (MUTATE === "prior") {
    const st0 = await readState()
    await page.evaluate(
      (p) => window.__styleHarness.setStyle(p),
      {
        ...S.DEFAULT_STYLE_STATE,
        ...PRIOR_WAKE,
        customFusions: [{ ...st0.customFusions[0], links: PRIOR_LINKS }],
        fusionPreset: st0.fusionPreset,
      },
    )
    await page.waitForTimeout(700)
  } else if (MUTATE === "unlinked") {
    await page.evaluate(() => window.__styleHarness.setStyle({ fusionIntensity: 0 }))
    await page.waitForTimeout(500)
  }

  const st = await readState()
  say(st.customFusions.length === 1 && st.fusionPreset === `custom:${st.customFusions[0].id}`,
    "clicking it creates a fusion AND selects it", `${st.fusionPreset}`)

  /* THE LIVE STATE, ASKED THE MODEL'S OWN QUESTION. Not a re-derivation — the
   * same `fusionLinkSleep` the panel renders from, run against the state the
   * page is actually in. */
  const fusionOnPage = st.customFusions[0]
  const pageAsleep = (fusionOnPage.links ?? []).filter(
    (l) => FUS.fusionLinkSleep(l, st, st.fusionDrive ?? "loop").length > 0,
  )
  say(pageAsleep.length === 0,
    "the state the click lands in leaves NO relationship asleep",
    pageAsleep
      .map((l) => `${l.source}->${l.target}: ${FUS.fusionLinkSleep(l, st, st.fusionDrive ?? "loop").map((r) => r.why).join("/")}`)
      .join(" · ") || `${fusionOnPage.links.length} links live`)

  const pageDead = deadLinks(st, fusionOnPage)
  say(pageDead.length === 0,
    "and every one of them computes a non-zero modulation in that state",
    pageDead.join(", ") || "0 dead")

  /* AND THE PANEL AGREES. The model saying "awake" while the panel prints
   * "Asleep" would be the two disagreeing about the same state, which is the
   * class of defect that put a false warning on a working control before. */
  const editor = body.locator("[data-fusion-editor]")
  const editorText = ((await editor.textContent()) ?? "").replace(/\s+/g, " ")
  say((await editor.count()) === 1, "the editor opens on the fusion that was just made")
  say(!/Asleep/.test(editorText) === (pageAsleep.length === 0),
    "the panel's own wording agrees with the model about whether anything is asleep",
    /Asleep/.test(editorText) ? editorText.slice(0, 140) : "no 'Asleep' row")

  /* THE LIVE METER — the positive half. A row that can only report silence
   * cannot tell a working relationship from a dead one. */
  const meters = editor.locator("[data-fusion-link-meter]")
  say((await meters.count()) === fusionOnPage.links.length,
    "every relationship shows what it is doing right now", `${await meters.count()} meters`)
  /* The meter's text is a LABEL plus a number ("now" + "-0.27"), so the number
   * is extracted rather than `parseFloat`-ed off the front — which returned NaN
   * and failed the row the moment the label was added, a gate reading its
   * subject's chrome instead of its subject. */
  const numberIn = (t) => {
    const m = String(t).match(/-?\d+(?:\.\d+)?\s*$/)
    return m ? parseFloat(m[0]) : NaN
  }
  let meterMoved = false
  let meterSeen = []
  for (let i = 0; i < 10 && !meterMoved; i++) {
    await page.waitForTimeout(320)
    const txt = await meters.allTextContents()
    meterSeen = txt.map((t) => t.replace(/\s+/g, " ").trim())
    if (meterSeen.some((t) => Math.abs(numberIn(t)) > 0.02)) meterMoved = true
  }
  say(meterMoved, "and at least one of them reads a non-zero value while the fusion runs",
    meterSeen.join(" | "))

  /* ---- THE RELATIONSHIP, ISOLATED FROM THE COMPOSITION ---------------- */
  const hold = async (v, n = 6) => {
    await page.evaluate((x) => window.__styleHarness.setStyle({ fusionIntensity: x }), v)
    await page.waitForTimeout(500)
    const out = []
    for (let i = 0; i < n; i++) {
      await page.waitForTimeout(430)
      out.push(await grab())
    }
    return out
  }
  /* THE RANGE OF THE MARK'S OWN VALUE over an identical window, coupled versus
   * uncoupled. See `markLuma` for why this statistic and not a frame delta —
   * two frame-delta comparisons were tried first and both are structurally
   * wrong for a subject whose composition has to be animating.
   *
   * Both arms carry the identical scrolling composition, so whatever the scroll
   * contributes is in BOTH numbers. What is left is the coupling. */
  const lumaRange = async (A) => {
    const vals = []
    for (const f of A) vals.push(await markLuma(f))
    return { range: Math.max(...vals) - Math.min(...vals), vals }
  }
  const linkDial = MUTATE === "unlinked" ? 0 : (st.fusionIntensity || 0.5)
  const unlinkedArm = await hold(0, 8)
  const linkedArm = await hold(linkDial, 8)
  const un = await lumaRange(unlinkedArm)
  const co = await lumaRange(linkedArm)
  /* THE DENOMINATOR IS FLOORED, and that is not a fudge — it is the difference
   * between a ratio and a division by zero. On the 2026-08-02 build the
   * uncoupled arm reads EXACTLY 0.00 (its composition never animates, which is
   * the defect), and `x / 0` is a number that cannot fail. 0.25 luma is below
   * anything this instrument has resolved as a signal and above zero. */
  const ratio = co.range / Math.max(un.range, 0.25)
  say(ratio > COUPLING_MARGIN,
    `the relationship visibly moves the picture (the mark's own value travels >${COUPLING_MARGIN}x further than in the same window at Link 0)`,
    `coupled ${co.range.toFixed(2)} luma vs uncoupled ${un.range.toFixed(2)} = ${ratio.toFixed(2)}x`)

  /* ---- AND EVERY RELATIONSHIP INDIVIDUALLY, ON PIXELS -----------------
   *
   * The row above is satisfiable by ONE loud link carrying a dead one — which is
   * exactly what shipped: `breath -> gloss` moved the mark's value by 5.9 luma
   * while `asciiField -> ditherThreshold`, the one the panel's own copy tells
   * the user about, moved it by nothing at all. So each link is run ALONE, on
   * the composition the click produced, against the same fusion with no links.
   *
   * BOTH STATISTICS, because a relationship can be honest in either shape: an
   * oscillating link shows up as RANGE over the window, and a link driven by a
   * constant source (draw progress on a finished stroke is exactly +1) shows up
   * as a shifted MEAN with no range at all. Taking the larger of the two is what
   * stops this row from scoring a working constant link as dead — the mistake
   * that made the phase-invariant comparison useless above. */
  const armFor = async (links) => {
    await page.evaluate(
      (p) => window.__styleHarness.setStyle(p),
      { customFusions: [{ ...fusionOnPage, links }], fusionIntensity: linkDial },
    )
    await page.waitForTimeout(550)
    const frames = []
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(430)
      frames.push(await grab())
    }
    const vals = []
    for (const f of frames) vals.push(await markLuma(f))
    return { range: Math.max(...vals) - Math.min(...vals), mean: vals.reduce((a, b) => a + b, 0) / vals.length }
  }
  const noneArm = await armFor([])
  const perLink = []
  for (const l of fusionOnPage.links) {
    const a = await armFor([l])
    const effect = Math.max(a.range - noneArm.range, Math.abs(a.mean - noneArm.mean))
    perLink.push({ link: `${l.source}->${l.target}`, effect, range: a.range, mean: a.mean })
    console.log(
      `  ${effect > LINK_FLOOR ? "  ok" : " DEAD"}  ${`${l.source} -> ${l.target}`.padEnd(34)}` +
        ` effect ${effect.toFixed(3)} luma (range ${a.range.toFixed(2)}, mean shift ${(a.mean - noneArm.mean).toFixed(2)})`,
    )
  }
  const deadOnScreen = perLink.filter((r) => r.effect <= LINK_FLOOR)
  say(deadOnScreen.length === 0,
    `EVERY relationship in a new fusion reaches the screen on its own (>${LINK_FLOOR} luma)`,
    deadOnScreen.map((r) => `${r.link} ${r.effect.toFixed(3)}`).join(", ") ||
      `weakest ${Math.min(...perLink.map((r) => r.effect)).toFixed(2)} luma · control (no links) range ${noneArm.range.toFixed(2)}`)

  await page.evaluate(
    (p) => window.__styleHarness.setStyle(p),
    { customFusions: [fusionOnPage], fusionIntensity: linkDial },
  )
  await page.waitForTimeout(400)

  /* ---- AND THE MARK SURVIVES IT ---------------------------------------
   *
   * MEASURED ON THE UNCOUPLED ARM, deliberately. The question is what WAKING
   * THE LAYERS did to the drawing, and the coupling is a separate thing that is
   * also lifting the mark's brightness at the moment of measurement — reading
   * this with the glow breathing scored the same composition anywhere from 82%
   * to 96% depending on which instant the grab landed on, which is a statistic
   * measuring the wrong subject. Averaged over the window for the same reason
   * the scroll phase demands it. */
  let retSum = 0
  for (const f of unlinkedArm) retSum += await inkFrac(f)
  const retained = retSum / unlinkedArm.length / Math.max(beforeInk, 1e-9)
  say(retained > INK_RETENTION,
    `waking the fusion's layers does not eat the drawing (>${(INK_RETENTION * 100).toFixed(0)}% of its inked area survives)`,
    `${(retained * 100).toFixed(1)}% retained`)
  const afterFrame = linkedArm[linkedArm.length - 1]
  writeFileSync(join(OUT, "gate-before.png"), beforeFrame)
  writeFileSync(join(OUT, "gate-after.png"), afterFrame)

  /* ═══ PROVENANCE · WAS THIS VERDICT MEASURED ON THIS RUN, ON THIS TREE? ═════
   *
   * ⚠ MEASURED 2026-08-28: this gate's capture directory was 23.5 days behind before tonight (frames from 08-04).
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
   *
   * Together they imply channel F's own test: a capture younger than a process
   * that started after every source write post-dates every source write.
   *
   * The subject is all three roots, the same three channel F compares against;
   * `captureFreshness()` walks `lib/` alone and tonight `app/` moved with it.
   * The filter is narrowed to gate-before.png and gate-after.png so the row cannot certify this gate's own
   * newborn-report.json as evidence — the trap `assert-drawin-pentip.mjs` recorded.
   * DISPATCH §3 — a SKIP is not a pass. */
  {
    const capNow = newestCapture(OUT, /\.png$/)
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
            `The rows here graded evidence an earlier run left behind. Re-run node scripts/verify/assert-fusion-newborn.mjs --label=${LABEL}; do NOT relax this row.`
          : `NO ARTEFACT written by this run under ${relP(OUT)} — nothing was graded, so nothing below is a verdict.`)
      : !treeHeld
        ? `THE TREE MOVED UNDER THIS RUN — ${relP(subjNow.file)} was written ${stampP(subjNow.ms)}, after this run started ${stampP(started)}. ` +
          `The capture straddles two builds and belongs to neither. Re-run node scripts/verify/assert-fusion-newborn.mjs --label=${LABEL}; do NOT relax this row.`
        : `capture ${relP(capNow.file)} ${stampP(capNow.ms)} · run started ${stampP(started)} · newest source ${relP(subjNow.file)} ${stampP(subjNow.ms)}`
    say(
      landed && treeHeld,
      "PROVENANCE · this verdict was measured on this run, against a tree that did not move under it",
      detailP,
    )
  }


  /* ---- "FUSE EVERYTHING", BY CLICK ------------------------------------ */
  const everyBtn = body.locator("[data-fusion-everything]")
  say((await everyBtn.count()) === 1, "the '+ Fuse everything' control exists")
  await everyBtn.click()
  await page.waitForTimeout(800)
  const st2 = await readState()
  const everyOnPage = st2.customFusions[st2.customFusions.length - 1]
  const everyAsleep = (everyOnPage?.links ?? []).filter(
    (l) => FUS.fusionLinkSleep(l, st2, st2.fusionDrive ?? "loop").length > 0,
  )
  say(everyOnPage && everyOnPage.links.length >= 8 && everyAsleep.length === 0,
    "clicking it makes an all-systems fusion with nothing asleep",
    `${everyOnPage?.links.length ?? 0} links · asleep: ${everyAsleep.map((l) => l.source + "->" + l.target).join(", ") || "none"}`)

  say(errors.length === 0, "no console or page errors", errors.slice(0, 2).join(" | ") || "0")

  writeFileSync(
    join(OUT, "newborn-report.json"),
    JSON.stringify(
      {
        mutate: MUTATE,
        wake: wake.turnsOn,
        results,
        coupledLumaRange: co.range,
        uncoupledLumaRange: un.range,
        coupledLuma: co.vals,
        uncoupledLuma: un.vals,
        ratio,
        retained,
      },
      null,
      2,
    ),
  )
  await ctx.close()
  await browser.close()
  console.log(pass ? "\nFUSION NEWBORN: ALL PASS" : "\nFUSION NEWBORN: FAILURES PRESENT")
  console.log(`wrote ${OUT}`)
  /* EXIT-COUPLED TO THE VERDICT, and only to the verdict. A `.catch(exit(1))`
   * says the script crashed, never that the subject failed — the meta-gate
   * checks for exactly that confusion. */
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  // A crash is not a verdict. Exit 2 so a reader (and assert-gate-integrity)
  // can tell "the subject failed" from "the instrument fell over".
  process.exit(2)
})
