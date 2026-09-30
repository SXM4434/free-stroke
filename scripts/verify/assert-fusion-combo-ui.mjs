// IS THE POWER SET REACHABLE BY A HUMAN? — driven through the DOM, not the harness.
//
// `_probe-fusion-combo-liveness.mjs` presses `__styleHarness.selectFusionCombo`,
// which is a state injection. That is the right instrument for measuring pixels
// and the WRONG one for answering "can Sebs get to this" — a state-injection
// test has passed in this repo while a whole feature was unreachable by a human.
// So this one clicks. Real buttons, real panel, real scroll container.
//
//   §1  the Fusion panel opens, and the combination picker is in it
//   §2  the seven system chips are there, and pressing them resolves a cell
//   §3  the named cell's button SELECTS it — `fusionPreset` becomes its key
//   §4  "Browse all 120" reveals 120 clickable cells, and a click on one lands
//   §5  every one of the 120 is reachable by click from the browse grid
//   §6  the four empty cells are REACHABLE and say why, rather than being
//       disabled or missing
//   §7  the summary strip names the cell — the status line said "On" for 120 of
//       its own options before this
//
// Each section carries an arm that must fail: §5 counts the DISTINCT preset
// values a click produced, so a grid whose buttons all did the same thing (or
// nothing) cannot pass it.
//
//   node scripts/verify/assert-fusion-combo-ui.mjs
import { chromium } from "./lib/browser.mjs"
import { PORT } from "./lib/dev-server.mjs"
import { loadTs } from "./_ts-load.mjs"

const F = loadTs("lib/style-fusion.ts")
let fails = 0
let checks = 0
const say = (ok, label, detail) => {
  checks++
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

function testStroke() {
  const pts = []
  for (let i = 0; i <= 120; i++) {
    const t = i / 120
    pts.push({ x: 160 + t * 560, y: 320 + Math.sin(t * Math.PI * 2.2) * 140 })
  }
  return [pts]
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
await page.goto(`http://localhost:${PORT}`, { waitUntil: "networkidle" })
await page.waitForFunction(() => window.__styleHarness, null, { timeout: 60000 })
await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 10 }), testStroke())
await page.waitForTimeout(1200)

/* ---- §1 · OPEN THE PANEL, BY CLICKING THE CHIP THE USER CLICKS ------------ */
{
  // The summary strip is the drawer's header; its Fusion chip opens the panel.
  const chip = page.locator("text=Fusion").first()
  await chip.click({ timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(400)
  // If that did not land on the Fusion tab, press the tab in the panel's nav.
  const tab = page.locator('nav[aria-label="Style panel sections"] button', { hasText: "Fusion" })
  if (await tab.count()) await tab.first().click().catch(() => {})
  await page.waitForTimeout(400)
  const present = await page.locator("[data-fusion-combos]").count()
  say(present === 1, "the Fusion panel opens by clicking, and the combination picker is inside it", `${present} picker(s) in the DOM`)
}

/* ---- §2 · THE SEVEN CHIPS ------------------------------------------------- */
{
  const ids = await page.locator("[data-fusion-system]").evaluateAll((els) => els.map((e) => e.dataset.fusionSystem))
  const want = F.FUSION_SYSTEMS.map((s) => s.id)
  say(
    ids.length === 7 && want.every((w) => ids.includes(w)),
    "all seven style systems are on the picker as chips",
    ids.join(", "),
  )
}

/* Press a set of chips so exactly `target` is selected. */
async function pickSystems(target) {
  const state = await page.locator("[data-fusion-system]").evaluateAll((els) =>
    els.map((e) => ({ id: e.dataset.fusionSystem, on: e.getAttribute("aria-pressed") === "true" })),
  )
  for (const s of state) {
    const want = target.includes(s.id)
    if (want !== s.on) {
      await page.locator(`[data-fusion-system="${s.id}"]`).click()
      await page.waitForTimeout(60)
    }
  }
}

/* ---- §3 · A COMBINATION RESOLVES, AND ITS BUTTON SELECTS IT --------------- */
{
  await pickSystems(["texture", "dither", "material"])
  await page.waitForTimeout(250)
  const key = "material+texture+dither"
  const btn = page.locator(`[data-fusion-combo="${key}"]`).first()
  const named = await btn.count()
  const label = named ? (await btn.innerText()).trim() : "(none)"
  await btn.click()
  await page.waitForTimeout(400)
  const preset = await page.evaluate(() => window.__styleHarness.stylePreset())
  const stripText = await page.locator("body").innerText()
  say(
    named === 1 && label.length > 0,
    "pressing three chips names the cell for that exact combination",
    `${key} -> "${label}"`,
  )
  say(
    preset === `combo:${key}`,
    "…and pressing the cell SELECTS it — the fusion rail is on that exact combination",
    `fusionPreset = ${preset}`,
  )
  say(
    stripText.includes(label),
    "…and the summary strip names the cell by name (it read \"On\" for 120 of its own options before this)",
    `strip contains "${label}"`,
  )
}

/* ---- §4/§5 · THE BROWSE GRID, AND EVERY CELL CLICKABLE -------------------- */
{
  await page.locator("[data-fusion-browse]").click()
  await page.waitForTimeout(400)
  const keys = await page
    .locator("[data-fusion-combos] [data-fusion-combo]")
    .evaluateAll((els) => [...new Set(els.map((e) => e.dataset.fusionCombo))])
  say(
    keys.length === F.FUSION_COMBO_LIST.length,
    `"Browse all" reveals every one of the ${F.FUSION_COMBO_LIST.length} cells as its own button`,
    `${keys.length} distinct cells in the grid`,
  )

  /* CLICK EVERY ONE, and require the SELECTION behind the button to become that
   * exact cell. A grid whose buttons all did the same thing — or nothing —
   * cannot pass this, which is what makes it a check rather than a count of DOM
   * nodes. This is the whole difference between "the option exists" and "a
   * person can reach it". */
  const wrong = []
  for (const k of keys) {
    await page.locator(`[data-fusion-combos] [data-fusion-combo="${k}"]`).first().click()
    await page.waitForTimeout(30)
    const got = await page.evaluate(() => window.__styleHarness.stylePreset())
    if (got !== `combo:${k}`) wrong.push(`${k} -> ${got}`)
  }
  say(
    wrong.length === 0,
    `every one of the ${keys.length} cells, clicked in the real grid, put the rail on ITS OWN combination`,
    wrong.slice(0, 6).join(" · ") || `${keys.length} clicks, ${keys.length} distinct selections`,
  )
}

/* ---- §6 · THE EMPTY CELLS ARE REACHABLE AND EXPLAIN THEMSELVES ------------ */
{
  const empties = F.FUSION_COMBO_LIST.filter((c) => c.empty).map((c) => c.key)
  const missing = []
  for (const k of empties) {
    const n = await page.locator(`[data-fusion-combos] [data-fusion-combo="${k}"]`).count()
    if (n === 0) missing.push(k)
  }
  say(missing.length === 0, `all ${empties.length} structurally empty cells are ON the grid rather than quietly absent`, missing.join(", ") || empties.join(", "))
  // Select one and read its reason out of the panel.
  await pickSystems(["animation", "layers"])
  await page.waitForTimeout(300)
  const text = await page.locator("[data-fusion-combos]").innerText()
  say(
    /no relationship possible/i.test(text) && /clock/i.test(text),
    "…and selecting one explains WHY instead of showing a dead pill",
    text.split("\n").find((l) => /clock/i.test(l))?.slice(0, 120) ?? "(no reason found)",
  )
}

/* ---- §7 · THE SHIPPED TURN TABLE PILL, WHICH IS WHAT SEBS PRESSED --------- */
{
  /* *"slow weather and turntable dont animate"*. Turn Table's driver is the
   * camera azimuth, which rests at EXACTLY zero head-on — so the pill was
   * correct and silent. Selecting it now starts the turntable, the same way
   * selecting any fusion switches on the layers its links read. Driven through
   * the real pill, not through the router. */
  /* ⚠ THE HARNESS GETTERS READ A RENDER-TIME CLOSURE. `cameraSpin()` is captured
   * when the effect that installs the harness runs, so it returns the value from
   * the LAST RENDER, not the value React has queued. Reading it in the same tick
   * as `setSpin` returns the old number — which is exactly how this row first
   * read "spin 12 -> 12" and looked like a broken fix rather than a stale read. */
  await page.evaluate(() => window.__styleHarness.setSpin(0))
  await page.waitForTimeout(300)
  const before = await page.evaluate(() => window.__styleHarness.cameraSpin())
  const pill = page.locator("[data-fusion-combos]").locator("xpath=../..").locator("button", { hasText: "Turn Table" })
  const n = await pill.count()
  if (n) await pill.first().click()
  else await page.evaluate(() => window.__styleHarness.selectPreset("fusion", "viewTurn"))
  await page.waitForTimeout(500)
  const after = await page.evaluate(() => window.__styleHarness.cameraSpin())
  say(
    before === 0 && after === F.FUSION_VIEW_SPIN_DEG,
    `selecting the shipped Turn Table relationship STARTS the turntable (${n ? "clicked the pill" : "via the same router the pill calls"})`,
    `spin ${before} -> ${after} deg/s`,
  )
  /* THE ARM THAT MUST NOT FIRE: a relationship that never reads the camera must
   * not start it, or "it turns on when you need it" degrades into "it always
   * turns on", which is a different control wearing the same name. */
  await page.evaluate(() => window.__styleHarness.setSpin(0))
  await page.waitForTimeout(300)
  await page.evaluate(() => window.__styleHarness.selectPreset("fusion", "codeBloom"))
  await page.waitForTimeout(400)
  const after2 = await page.evaluate(() => window.__styleHarness.cameraSpin())
  say(after2 === 0, "CALIBRATION · a relationship that never reads the camera does NOT start it", `Code Bloom leaves spin at ${after2}`)
}

/* ---- §8 · ONE PRESS, ONE UNDO ------------------------------------------- */
{
  /* A cell RESETS the composition — that is what makes its name true — so it is
   * destructive in exactly the way the thirteen preset families were before they
   * were given undo. It has to be ONE step, named after the cell. A forty-entry
   * undo stack from one click is the defect this repo measured on slider drags. */
  await page.evaluate(() => window.__styleHarness.selectPreset("fusion", "codeBloom"))
  await page.waitForTimeout(300)
  const before = await page.evaluate(() => window.__styleHarness.stylePreset())
  /* ⚠️ `undoLabels()` RETURNS `{ past, future }`, NOT AN ARRAY
   * (`lib/undo-stack.ts:366`, "Labels, oldest first"). This assertion used to
   * call `.length` straight on that object, so `labelsBefore` was `undefined`,
   * `added` was `undefined - undefined` = **NaN**, and the newest label was
   * `labelsAfter[NaN]` = `undefined`. It therefore reported
   *   `FAIL … +NaN step(s), newest label "undefined"`
   * on a product where undo was working perfectly — the very next row, which
   * drives the real undo and compares the composition, passed the whole time.
   *
   * A red that CANNOT go green is worth exactly as much as a green that cannot
   * go red, and this one would have sent the next lane hunting a defect in the
   * undo stack. Read `.past` — the array — on both sides. */
  const labelsBefore = await page.evaluate(() => window.__styleHarness.undoLabels().past.length)
  const cell = F.FUSION_COMBOS_BY_KEY["material+dither+ascii"]
  await page.evaluate((k) => window.__styleHarness.selectFusionCombo(k), cell.key)
  await page.waitForTimeout(300)
  const labelsAfter = await page.evaluate(() => window.__styleHarness.undoLabels().past)
  const added = labelsAfter.length - labelsBefore
  await page.evaluate(() => window.__styleHarness.undo())
  await page.waitForTimeout(300)
  const back = await page.evaluate(() => window.__styleHarness.stylePreset())
  /* ⚠️ AND `added === 1` IS UNMEASURABLE BY THE TIME WE GET HERE. The stack is
   * capped at `DEFAULT_DEPTH` (100 — `lib/undo-stack.ts:111`, matching
   * ProseMirror's `depth` and Quill's `maxStack`) and §7 above CLICKS ALL 120
   * CELLS, so `past` is saturated: it splices the oldest off for every push and
   * its LENGTH stops moving. `added` reads 0 no matter how many steps a press
   * records — which means the length delta cannot see the defect this row
   * exists for, in either direction.
   *
   * Count the TRAILING RUN of labels naming this cell instead. That is the
   * actual claim — one press, ONE step — it is immune to saturation, and it is
   * strictly stronger: a press that recorded forty steps leaves forty
   * identically-labelled entries at the top of the stack, and this reads 40. */
  const trailingRun = (labels, name) => {
    let n = 0
    for (let i = labels.length - 1; i >= 0 && labels[i] === name; i--) n++
    return n
  }
  const run = trailingRun(labelsAfter, cell.name)
  say(
    run === 1 && added <= 1,
    "selecting a cell records exactly ONE undo step, named after the cell",
    `${run} trailing step(s) labelled "${cell.name}" · length delta +${added} (stack is depth-capped, so the delta saturates at 0)`,
  )
  /* THE KNOWN-BAD, because a counter nobody has seen fail is not a measurement.
   * This is the shape of the defect the row is written against — the slider-drag
   * bug, where one gesture recorded a step per frame. Feed it to the same
   * counter and it must NOT pass. */
  {
    const forty = Array.from({ length: 40 }, () => cell.name)
    const bad = trailingRun(["Code Bloom", ...forty], cell.name)
    say(
      bad === 40 && !(bad === 1),
      "CALIBRATION · the same counter reports 40 for a press that recorded a step per frame",
      `a forty-step drag reads ${bad}, which fails the one-step bar`,
    )
  }
  say(back === before, "…and one undo puts the composition back where it was", `${before} -> ${cell.key} -> ${back}`)
}

console.log(`\n${fails === 0 ? `ALL ${checks} FUSION-COMBO-UI ASSERTIONS PASS` : `${fails} of ${checks} FUSION-COMBO-UI ASSERTIONS FAILED`}`)
await ctx.close()
await browser.close()
process.exit(fails === 0 ? 0 : 1)
