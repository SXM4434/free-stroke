// DOES THE TAKE SURVIVE A RELOAD? — the gate for `drawIn` and `revealWindow`.
//
// ═══════════════════════════════════════════════════════════════════════════
// THE DEFECT, IN ONE LINE
//
//   A user sets up a draw-in, reloads, and the take is gone.
//
// `lib/doc-store.ts` persisted `styleState`, `geometryMode`, `engineFamily`,
// `extrudeParams`, `widthSlider`, `solidParams`, `inflateParams` and `canvas` —
// and NOTHING about motion. `drawIn` and `revealWindow` were `useState` inside
// `components/viewport-3d.tsx`, which put them below the only two machines that
// could keep them: `app/page.tsx` owns the undo stack and the persist effect.
// So the ink came back, every style dial came back, and the eleven controls
// that decide HOW the mark draws itself in came back as the raw transcript.
//
// That is the same defect `assert-data-safety.mjs` was written for — *"the mark
// survived a reload wearing nothing"* — one layer up. This file is its sibling
// and deliberately not part of it: that gate is the CONTROL for this change and
// must be able to be run unmodified before and after.
//
// ═══════════════════════════════════════════════════════════════════════════
// WHY A UNION IS NOT JUST ANOTHER STRING
//
// `coerceAgainst` keeps the default for a key of the wrong TYPE, and for every
// string field the document had before this it was right to accept any string —
// they were a hex colour and a preset id, both free text. `DrawInParams` is the
// first thing in the document that is mostly string UNIONS, and there is no
// type error to see: `"banana"` is a perfectly good string.
//
// What it costs is silent. `buildStrokeSchedule` branches on the order name and
// an unknown one falls through to the `asDrawn` arm, so the user gets a take
// they did not pick, with nothing on screen saying so — while the panel's pills
// show NONE of the five pressed, because `aria-pressed` compares against a value
// no pill has. §1.2 and §2.6 are that arm, in the model and on the page.
//
// ═══════════════════════════════════════════════════════════════════════════
// EVERY ASSERTION HERE HAS A CONTROL THAT MUST COME BACK RED
//
// This repo has caught eleven instruments reporting green while measuring
// nothing, so a row that cannot fail is treated as the lie.
//
//   · THE ACCEPTING ARM. §1.2 rejects `"banana"`, and the row beside it feeds a
//     VALID non-default (`byLength`) to the same validator and REQUIRES it
//     through. A validator that returned the default for every string would
//     pass the first row and fail the second, and only the pair is evidence.
//   · THE ADDITIVE ARM. §1.1 asserts a document with NO motion keys reads back
//     as the defaults — which is also what a validator that ignored the field
//     entirely would produce. So §1.1b feeds the SAME document shape WITH the
//     keys and requires the stored values to arrive.
//   · THE READER. §2.5 reads the take back after a reload. §2.5-CONTROL proves
//     the reader can tell the two states apart at all, by reading it before.
//   · THE UNSWEPT RULE. §2's subject is checked for reachability BEFORE the
//     first row prints, and a run that never reached the browser exits 3 and
//     never prints an all-pass summary. `assert-gate-integrity.mjs` channel G's
//     known-bad is exactly "an all-pass summary, exit 0, with a skip in it".
//
// ═══════════════════════════════════════════════════════════════════════════
// §2 DRIVES THE REAL PAGE, WITH THE REAL POINTER
//
// The order pills, the align pills, the direction pills and the window pills are
// CLICKED, and the overlap slider is DRAGGED with real pointer events, because
// this project has shipped a bug where harness assertions passed while the
// feature was unreachable by a human. `window.__revealHarness` is read ONLY to
// report the value back, never to perform the action being asserted — and every
// row that matters is ALSO confirmed against `aria-pressed` in the DOM, which is
// what a user actually sees.
//
// ⚠ ALIGN IS DISABLED AT `overlap === 0` and that is correct behaviour, not a
// bug (a control on screen that cannot act is the defect explainer 06 §3
// names). So the overlap drag happens BEFORE the align click. A gate that got
// that order wrong would report a red row caused entirely by itself.
//
// Usage:
//   node scripts/verify/_run-clean.mjs scripts/verify/assert-take-persists.mjs
//   node scripts/verify/assert-take-persists.mjs --only=store   # exits 3: §2 unswept
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { loadTs } from "./_ts-load.mjs"
// ONE KNOB, ONE NAME. This gate does not get to name its own server.
import { LAB_URL } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=")[1] : d
}
const ONLY = arg("only", "")
const LABEL = arg("label", "after")
const OUT = join(ROOT, "docs", "verification", "persist-2026-08-28", LABEL)
mkdirSync(OUT, { recursive: true })

let failures = 0
let rows = 0
const results = []
function say(ok, label, detail) {
  rows++
  if (!ok) failures++
  results.push({ ok, label, detail: detail ?? "" })
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}
/** A control: the subject is KNOWN BAD, or known GOOD where the risk is a
 *  validator that refuses everything. The check must come back as designed or
 *  the instrument is blind and nothing else it printed means anything. */
function control(sawWhatItShould, label, detail) {
  rows++
  if (!sawWhatItShould) failures++
  results.push({ ok: sawWhatItShould, label: `CONTROL · ${label}`, detail: detail ?? "" })
  console.log(
    `${sawWhatItShould ? "PASS" : "FAIL"}  CONTROL · ${label}${detail ? " — " + detail : ""}${
      sawWhatItShould ? "" : "   *** the instrument did not react as designed ***"
    }`,
  )
}

const unswept = []
const unsweptRow = (what, why, fix) => {
  unswept.push(what)
  console.log(`UNSWEPT  ${what} — ${why}. NOT A PASS AND NOT A FAILURE: nothing was measured. ${fix}`)
}

/* ========================================================================== */
/*  A FAKE localStorage, so the real store can be exercised in node.           */
/* ========================================================================== */
function installFakeStorage() {
  const map = new Map()
  const ls = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
  }
  globalThis.window = { localStorage: ls }
  return { map, ls }
}

/* ========================================================================== */
/*  §1 · THE STORE — the additive read, the unions, the clamps                 */
/* ========================================================================== */

function storePart() {
  console.log("\n=== §1 · THE STORE — graded in node, against lib/doc-store.ts itself ===\n")
  installFakeStorage()
  const D = loadTs("lib/doc-store.ts")
  const S = loadTs("lib/stroke-schedule.ts")
  const { validateSession, defaultSession } = D
  const { DRAW_IN_DEFAULTS, REVEAL_WINDOW_DEFAULTS } = S

  /** A session payload of exactly the shape that is on every user's disk TODAY —
   *  every field the v1 document has ever had, and no motion keys at all. */
  const legacyDoc = () => {
    const d = defaultSession()
    const out = {
      styleState: d.styleState,
      geometryMode: "solid",
      engineFamily: d.engineFamily,
      extrudeParams: d.extrudeParams,
      widthSlider: 0.42,
      solidParams: d.solidParams,
      inflateParams: d.inflateParams,
      canvas: d.canvas,
    }
    delete out.drawIn
    delete out.revealWindow
    return out
  }

  /* ---- 1.1 THE ADDITIVE CLAIM — no version bump, and here is why ---------- */
  {
    const src = legacyDoc()
    const has = "drawIn" in src || "revealWindow" in src
    const v = validateSession(src)
    say(
      !has && !!v,
      "1.1   a document with NO motion keys — what is on disk today — still loads",
      `motion keys present in the payload: ${has ? "yes (test is wrong)" : "none"}`,
    )
    say(
      !!v && JSON.stringify(v.session.drawIn) === JSON.stringify(DRAW_IN_DEFAULTS),
      "1.1   …and gets DRAW_IN_DEFAULTS, which is the identity take it played like when it was written",
      JSON.stringify(v?.session.drawIn),
    )
    say(
      !!v && JSON.stringify(v.session.revealWindow) === JSON.stringify(REVEAL_WINDOW_DEFAULTS),
      "1.1   …and REVEAL_WINDOW_DEFAULTS, which is the prefix the app shipped with",
      JSON.stringify(v?.session.revealWindow),
    )
    say(
      !!v && v.session.geometryMode === "solid" && v.session.widthSlider === 0.42,
      "1.1   …with everything the old document DID carry untouched — this is a read, not a reset",
      `mode=${v?.session.geometryMode} width=${v?.session.widthSlider}`,
    )
    say(
      !!v && v.repairs.length === 0,
      "1.1   …and NOTHING is reported as repaired: a missing field is not damage",
      `repairs = [${v?.repairs.join("; ")}]`,
    )
  }

  /* CONTROL for 1.1. "Returns the defaults" is also what a validator that
   * DROPPED the field entirely would produce. So the same document shape WITH
   * the keys must come back carrying them. */
  {
    const src = { ...legacyDoc(), drawIn: { ...DRAW_IN_DEFAULTS, order: "byPosition", overlap: 0.35 } }
    const v = validateSession(src)
    control(
      v?.session.drawIn.order === "byPosition" && v?.session.drawIn.overlap === 0.35,
      "1.1b  the SAME document WITH the keys carries the stored values through",
      `order=${v?.session.drawIn.order} overlap=${v?.session.drawIn.overlap}`,
    )
  }

  /* ---- 1.2 THE KNOWN-BAD UNION VALUE ------------------------------------ */
  {
    const src = { ...legacyDoc(), drawIn: { ...DRAW_IN_DEFAULTS, order: "banana" } }
    const v = validateSession(src)
    const got = v?.session.drawIn.order
    say(
      got !== "banana",
      "1.2   a stored order of \"banana\" does NOT become the order",
      `it produces "${got}" — the shipped default`,
    )
    say(
      got === DRAW_IN_DEFAULTS.order,
      "1.2   …it produces DRAW_IN_DEFAULTS.order specifically, not undefined and not a dropped field",
      `"${got}" vs default "${DRAW_IN_DEFAULTS.order}"`,
    )
    say(
      !!v && v.repairs.some((r) => r.includes("banana")),
      "1.2   …and the user is TOLD, by name. A take quietly replaced is a silent repair",
      `repairs = [${v?.repairs.join("; ")}]`,
    )
  }

  /* CONTROL for 1.2 — the arm that makes the rejection mean something. */
  {
    const src = { ...legacyDoc(), drawIn: { ...DRAW_IN_DEFAULTS, order: "byLength" } }
    const v = validateSession(src)
    control(
      v?.session.drawIn.order === "byLength" && v.repairs.length === 0,
      "1.2   a VALID non-default order goes straight through, unrepaired",
      `order=${v?.session.drawIn.order} repairs=${v?.repairs.length}`,
    )
  }

  /* ---- 1.3 EVERY UNION FIELD, BOTH DIRECTIONS ---------------------------- */
  {
    const arms = [
      ["drawIn", "order", "banana", "byPosition"],
      ["drawIn", "align", "middle", "end"],
      ["drawIn", "unit", "letter", "stroke"],
      ["drawIn", "reverse", "sometimes", "alternate"],
      ["revealWindow", "mode", "vanishh", "vanish"],
    ]
    const defs = { drawIn: DRAW_IN_DEFAULTS, revealWindow: REVEAL_WINDOW_DEFAULTS }
    let refused = 0
    let accepted = 0
    const detail = []
    for (const [obj, key, bad, good] of arms) {
      const vb = validateSession({ ...legacyDoc(), [obj]: { ...defs[obj], [key]: bad } })
      const vg = validateSession({ ...legacyDoc(), [obj]: { ...defs[obj], [key]: good } })
      const gotBad = vb?.session[obj][key]
      const gotGood = vg?.session[obj][key]
      if (gotBad === defs[obj][key]) refused++
      if (gotGood === good) accepted++
      detail.push(`${obj}.${key}: "${bad}"→"${gotBad}", "${good}"→"${gotGood}"`)
    }
    say(refused === arms.length, `1.3   all ${arms.length} string-union fields refuse a value outside their vocabulary`, detail.join(" · "))
    control(accepted === arms.length, `1.3   …and all ${arms.length} accept a valid non-default`, `${accepted}/${arms.length}`)
  }

  /* ---- 1.4 THE CONTINUOUS DIALS ----------------------------------------- */
  {
    const hi = validateSession({ ...legacyDoc(), drawIn: { ...DRAW_IN_DEFAULTS, overlap: 5000 } })
    const lo = validateSession({ ...legacyDoc(), revealWindow: { ...REVEAL_WINDOW_DEFAULTS, length: -3 } })
    const nan = validateSession({ ...legacyDoc(), drawIn: { ...DRAW_IN_DEFAULTS, overlap: NaN } })
    say(
      hi?.session.drawIn.overlap === 1 && lo?.session.revealWindow.length === 0,
      "1.4   an out-of-range overlap / length is clamped rather than handed to a slider",
      `overlap 5000 -> ${hi?.session.drawIn.overlap} · length -3 -> ${lo?.session.revealWindow.length}`,
    )
    say(
      nan?.session.drawIn.overlap === DRAW_IN_DEFAULTS.overlap,
      "1.4   NaN is not a number this document accepts — `typeof NaN` is \"number\" and that has cost this repo a uniform before",
      `NaN -> ${nan?.session.drawIn.overlap}`,
    )
    const mid = validateSession({ ...legacyDoc(), drawIn: { ...DRAW_IN_DEFAULTS, overlap: 0.65 } })
    control(
      mid?.session.drawIn.overlap === 0.65,
      "1.4   an IN-range value is not clamped — the clamp is not just returning a constant",
      `0.65 -> ${mid?.session.drawIn.overlap}`,
    )
  }

  /* ---- 1.5 THE SHARED DEFAULTS ARE NOT WRITTEN INTO ---------------------- */
  {
    /* `coerceAgainst` returns the DEFAULTS OBJECT BY REFERENCE when the payload
     * has no such key — the common case here. A clamp written as
     * `drawIn.overlap = …` would assign straight into the module-level
     * `DRAW_IN_DEFAULTS` that `stroke-schedule.ts` hands every other consumer,
     * and it would be invisible today because the default is already in range. */
    const before = JSON.stringify(DRAW_IN_DEFAULTS) + "|" + JSON.stringify(REVEAL_WINDOW_DEFAULTS)
    validateSession(legacyDoc())
    validateSession({ ...legacyDoc(), drawIn: { ...DRAW_IN_DEFAULTS, overlap: 9 } })
    const after = JSON.stringify(DRAW_IN_DEFAULTS) + "|" + JSON.stringify(REVEAL_WINDOW_DEFAULTS)
    say(before === after, "1.5   validating does not write into the shared DEFAULTS objects", after)
    const clamped = validateSession({ ...legacyDoc(), drawIn: { ...DRAW_IN_DEFAULTS, overlap: 9 } })
    control(
      clamped?.session.drawIn.overlap === 1,
      "1.5   …and the clamp that could have done it demonstrably RAN on that payload",
      `overlap 9 -> ${clamped?.session.drawIn.overlap}`,
    )
  }

  /* ---- 1.6 A PAYLOAD FROM A NEWER BUILD --------------------------------- */
  {
    const v = validateSession({
      ...legacyDoc(),
      drawIn: { ...DRAW_IN_DEFAULTS, order: "byLength", stagger: 0.5, cameraShake: true },
    })
    const keys = Object.keys(v?.session.drawIn ?? {}).sort().join(",")
    say(
      !("stagger" in (v?.session.drawIn ?? {})) && !("cameraShake" in (v?.session.drawIn ?? {})),
      "1.6   fields a NEWER build added are dropped, not carried into state",
      `kept: ${keys}`,
    )
    control(
      v?.session.drawIn.order === "byLength",
      "1.6   …while the known fields of the same payload still arrive",
      `order=${v?.session.drawIn.order}`,
    )
  }

  /* ---- 1.7 THE WHOLE TAKE, ROUND-TRIPPED -------------------------------- */
  {
    const take = { order: "byPosition", overlap: 0.7, align: "end", unit: "stroke", seed: 9, reverse: "alternate" }
    const win = { mode: "travel", length: 0.4 }
    const v = validateSession({ ...legacyDoc(), drawIn: take, revealWindow: win })
    say(
      JSON.stringify(v?.session.drawIn) === JSON.stringify(take) &&
        JSON.stringify(v?.session.revealWindow) === JSON.stringify(win),
      "1.7   a fully non-default take survives the validator field for field",
      `${JSON.stringify(v?.session.drawIn)} ${JSON.stringify(v?.session.revealWindow)}`,
    )
  }
}

/* ========================================================================== */
/*  §2 · THE REAL PAGE — real clicks, a real drag, a real reload               */
/* ========================================================================== */

async function pagePart() {
  console.log("\n=== §2 · THE REAL PAGE — driven the way a person drives it ===\n")

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1500, height: 1400 }, reducedMotion: "reduce" })
  const pageErrors = []
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 240)))

  /* A CLEAN ORIGIN — ONCE, NOT ON EVERY NAVIGATION. `addInitScript` runs on
   * every load including the reloads below; clearing per load would wipe the
   * take this file has just saved and then assert it was lost. `sessionStorage`
   * survives the reload and dies with the tab, which is exactly the gate wanted.
   * (Learned the hard way in `assert-data-safety.mjs`.) */
  await page.addInitScript(() => {
    try {
      if (window.sessionStorage.getItem("__fs_take_cleared__")) return
      for (const k of Object.keys(window.localStorage)) {
        if (k.startsWith("freestroke.")) window.localStorage.removeItem(k)
      }
      window.sessionStorage.setItem("__fs_take_cleared__", "1")
    } catch {}
  })
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => !!window.__revealHarness, null, { timeout: 60000 })

  const shot = async (name) => {
    try {
      await page.screenshot({ path: join(OUT, `${name}.png`), timeout: 60000 })
    } catch {
      console.log(`  (screenshot ${name} could not be taken — evidence missing, not a pass)`)
    }
  }
  /* READ-ONLY. Never used to perform an action being asserted. */
  const take = () =>
    page.evaluate(() => ({
      drawIn: window.__revealHarness.drawIn(),
      window: window.__revealHarness.window(),
    }))
  /* WHAT A USER SEES. `aria-pressed` on the pill itself, not the harness.
   * `null` means the pill is not on screen — which is a different answer from
   * "false", and the rows below depend on being able to tell them apart. */
  const pressed = (label) =>
    page.evaluate((l) => {
      const b = [...document.querySelectorAll("button[aria-pressed]")].find(
        (x) => (x.textContent ?? "").trim() === l,
      )
      return b ? b.getAttribute("aria-pressed") : null
    }, label)
  const openTiming = async () => {
    const dlg = page.locator("div[role=dialog][aria-label='Draw-in timing']")
    if (!(await dlg.count())) {
      await page.locator("button", { hasText: /^Timing/ }).first().click()
      await page.waitForTimeout(150)
    }
    return dlg
  }

  /* ---- draw something, so the take is a take and not an empty stage ------ */
  const drawStroke = async (y) => {
    const box = await page.locator("canvas[aria-label*='Drawing canvas']").boundingBox()
    await page.mouse.move(box.x + 80, box.y + y)
    await page.mouse.down()
    for (let i = 1; i <= 20; i++) {
      await page.mouse.move(box.x + 80 + i * 16, box.y + y + Math.sin(i / 3) * 28)
      await page.waitForTimeout(6)
    }
    await page.mouse.up()
    await page.waitForTimeout(120)
  }
  await drawStroke(220)
  await drawStroke(340)

  /* ---- 2.1 the take starts at the shipped identity ----------------------- */
  /* The popover is opened FIRST: `pressed()` reads the pill, and a pill that is
   * not on screen answers `null`, which would make the 2.5 control vacuous. */
  await openTiming()
  await page.waitForTimeout(150)
  const t0 = await take()
  say(
    t0.drawIn.order === "asDrawn" && t0.drawIn.overlap === 0 && t0.window.mode === "grow",
    "2.1   a fresh session opens on the identity take, unchanged",
    `${t0.drawIn.order} / overlap ${t0.drawIn.overlap} / ${t0.window.mode}`,
  )
  const asDrawnPressedBefore = await pressed("As drawn")

  /* ---- 2.2 author a take through the REAL controls ----------------------- */
  await page.locator("button", { hasText: /^Short first$/ }).click()
  await page.waitForTimeout(120)

  /* THE SLIDER, DRAGGED. ⚠ Align is disabled at overlap 0 by design, so this
   * has to happen BEFORE the align click below. */
  const ov = page.locator("input[aria-label='Overlap']")
  const obox = await ov.boundingBox()
  await page.mouse.move(obox.x + 2, obox.y + obox.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(obox.x + 2 + (obox.width - 4) * (i / 8) * 0.6, obox.y + obox.height / 2)
    await page.waitForTimeout(20)
  }
  await page.mouse.up()
  await page.waitForTimeout(150)
  const afterDrag = await take()
  say(
    afterDrag.drawIn.overlap > 0,
    "2.2   a real pointer drag on the Overlap slider moved a continuous dial",
    `overlap = ${afterDrag.drawIn.overlap}`,
  )

  await page.locator("button", { hasText: /^End together$/ }).click()
  await page.waitForTimeout(100)
  await page.locator("button", { hasText: /^Strokes$/ }).click()
  await page.waitForTimeout(100)
  await page.locator("button", { hasText: /^Alternating$/ }).click()
  await page.waitForTimeout(100)
  await page.locator("button", { hasText: /^Travel$/ }).click()
  await page.waitForTimeout(150)

  const authored = await take()
  say(
    authored.drawIn.order === "byLength" &&
      authored.drawIn.align === "end" &&
      authored.drawIn.unit === "stroke" &&
      authored.drawIn.reverse === "alternate" &&
      authored.window.mode === "travel" &&
      authored.drawIn.overlap > 0,
    "2.2   six controls authored through the panel's own buttons and slider",
    JSON.stringify(authored),
  )
  await shot("01-take-authored")

  /* ---- 2.3 it reached the disk ------------------------------------------ */
  const stored = await page.evaluate(() => {
    try {
      const raw = window.localStorage.getItem("freestroke.session.v1")
      if (!raw) return { present: false }
      const env = JSON.parse(raw)
      return { present: true, v: env.v, kind: env.kind, drawIn: env.data?.drawIn, window: env.data?.revealWindow }
    } catch (e) {
      return { present: false, err: String(e) }
    }
  })
  say(
    stored.present && !!stored.drawIn && !!stored.window,
    "2.3   the take is written into the session key, inside the versioned envelope",
    `v=${stored.v} kind=${stored.kind} drawIn=${JSON.stringify(stored.drawIn)}`,
  )
  say(
    stored.v === 1,
    "2.3   …under version 1. NO BUMP: the field is additive, so an older build's refusal of a newer document is not spent on this",
    `v=${stored.v}`,
  )

  /* ---- 2.4 it is undoable, because it is document state now -------------- */
  await page.keyboard.press("Meta+z")
  await page.waitForTimeout(250)
  const undone = await take()
  say(
    undone.window.mode === "grow" && undone.drawIn.reverse === "alternate",
    "2.4   ⌘Z takes back the LAST take edit only — the window mode, leaving the rest standing",
    `mode ${authored.window.mode} -> ${undone.window.mode}, reverse still ${undone.drawIn.reverse}`,
  )
  await page.keyboard.press("Meta+Shift+z")
  await page.waitForTimeout(250)
  const redone = await take()
  control(
    redone.window.mode === "travel",
    "2.4   ⇧⌘Z puts it back — the undo reader is reading a real stack, not a constant",
    `${undone.window.mode} -> ${redone.window.mode}`,
  )

  /* ---- 2.5 THE ROUND TRIP ----------------------------------------------- */
  await page.reload({ waitUntil: "networkidle" })
  await page.waitForFunction(() => !!window.__revealHarness, null, { timeout: 60000 })
  await page.waitForTimeout(400)
  const afterReload = await take()
  say(
    JSON.stringify(afterReload.drawIn) === JSON.stringify(redone.drawIn) &&
      JSON.stringify(afterReload.window) === JSON.stringify(redone.window),
    "2.5   ⭐ THE TAKE SURVIVES A RELOAD, field for field",
    JSON.stringify(afterReload),
  )
  /* AND IT IS ON SCREEN, not merely in a getter. */
  await openTiming()
  await page.waitForTimeout(150)
  const shortPressed = await pressed("Short first")
  const travelPressed = await pressed("Travel")
  say(
    shortPressed === "true" && travelPressed === "true",
    "2.5   …and the panel a user opens shows it pressed — the restore reaches the CONTROLS, not just the model",
    `Short first aria-pressed=${shortPressed} · Travel aria-pressed=${travelPressed}`,
  )
  control(
    asDrawnPressedBefore === "true" && (await pressed("As drawn")) === "false",
    "2.5   the aria-pressed reader distinguishes the two states",
    `"As drawn" was ${asDrawnPressedBefore} before, is ${await pressed("As drawn")} now`,
  )
  say(
    (await page.locator("text=could not be restored").count()) === 0,
    "2.5   …with no 'could not be restored' error on the way in",
    "clean boot",
  )
  await shot("02-after-reload")

  /* ---- 2.6 THE KNOWN-BAD, ON THE PAGE ----------------------------------- */
  const badTake = await page.evaluate(() => {
    const raw = window.localStorage.getItem("freestroke.session.v1")
    const env = JSON.parse(raw)
    env.data.drawIn.order = "banana"
    env.data.revealWindow.mode = "vanishh"
    window.localStorage.setItem("freestroke.session.v1", JSON.stringify(env))
    return { order: env.data.drawIn.order, mode: env.data.revealWindow.mode }
  })
  await page.reload({ waitUntil: "networkidle" })
  await page.waitForFunction(() => !!window.__revealHarness, null, { timeout: 60000 })
  await page.waitForTimeout(500)
  const afterBad = await take()
  say(
    afterBad.drawIn.order === "asDrawn" && afterBad.window.mode === "grow",
    `2.6   a stored order of "${badTake.order}" and mode "${badTake.mode}" produce the SHIPPED DEFAULTS, not a broken take`,
    `order -> "${afterBad.drawIn.order}", mode -> "${afterBad.window.mode}"`,
  )
  say(
    afterBad.drawIn.align === "end" && afterBad.drawIn.unit === "stroke",
    "2.6   …and the fields that were FINE in the same payload still restore — one bad value is not a lost document",
    `align=${afterBad.drawIn.align} unit=${afterBad.drawIn.unit} overlap=${afterBad.drawIn.overlap}`,
  )
  await openTiming()
  await page.waitForTimeout(150)
  say(
    (await pressed("As drawn")) === "true",
    "2.6   …and the panel shows a real pill pressed. An unknown order leaves NO pill pressed, which is the silent state this refuses",
    `"As drawn" aria-pressed=${await pressed("As drawn")}`,
  )
  const repairToast = await page.locator("text=/banana/").count()
  say(
    repairToast > 0,
    "2.6   …and the app SAYS so, naming the value it refused",
    `a toast naming "banana" was on screen: ${repairToast > 0}`,
  )
  await shot("03-banana-refused")

  /* ---- 2.7 AN OLD DOCUMENT, WITH NO MOTION KEYS AT ALL ------------------ */
  const legacyWritten = await page.evaluate(() => {
    const raw = window.localStorage.getItem("freestroke.session.v1")
    const env = JSON.parse(raw)
    delete env.data.drawIn
    delete env.data.revealWindow
    env.data.geometryMode = "solid"
    window.localStorage.setItem("freestroke.session.v1", JSON.stringify(env))
    return { hasDrawIn: "drawIn" in env.data, hasWindow: "revealWindow" in env.data, v: env.v }
  })
  await page.reload({ waitUntil: "networkidle" })
  await page.waitForFunction(() => !!window.__revealHarness, null, { timeout: 60000 })
  await page.waitForTimeout(500)
  const afterLegacy = await take()
  say(
    !legacyWritten.hasDrawIn && !legacyWritten.hasWindow,
    "2.7   the payload written for this arm genuinely has NO motion keys",
    `drawIn present: ${legacyWritten.hasDrawIn} · revealWindow present: ${legacyWritten.hasWindow} · v=${legacyWritten.v}`,
  )
  say(
    afterLegacy.drawIn.order === "asDrawn" &&
      afterLegacy.drawIn.overlap === 0 &&
      afterLegacy.drawIn.reverse === "off" &&
      afterLegacy.window.mode === "grow",
    "2.7   ⭐ an OLD document with no motion keys loads and gets the defaults — the additive claim, on the real page",
    JSON.stringify(afterLegacy),
  )
  say(
    (await page.locator("text=could not be restored").count()) === 0,
    "2.7   …and it is not treated as damage: no error toast, nothing quarantined",
    "clean boot",
  )
  const legacyRest = await page.evaluate(() => window.__styleHarness?.get?.()?.geometryMode ?? null)
  control(
    legacyRest === "solid",
    "2.7   the rest of that same old document still restored — the reload really did read it",
    `geometryMode=${legacyRest}`,
  )
  await shot("04-old-document")

  /* ---- 2.8 A RESTORED TAKE MUST NOT OPEN ON NOTHING --------------------- */
  /*
   * ⭐ THE DEFECT PERSISTING `revealWindow` CREATED, and the reason this arm is
   * not optional. The boot rule pinned the playhead to 1 and called it "show it
   * fully", which is true for `grow` and FALSE for the other three: at playhead
   * 1, `travel`, `vanish` and `shrink` all resolve to an EMPTY interval. That is
   * correct for the mode — it is what the end of their beat looks like — and it
   * was unreachable on boot for as long as the window reset to `grow` on every
   * reload.
   *
   * Measured before the fix: all three restored their mode correctly and then
   * opened on a blank stage — 66,590 B of PNG for every one of them, byte
   * identical to each other because they were the same empty picture, against
   * 139,490 B for `grow`. The take came back and the mark did not, which is the
   * "half-persisted take" this whole lane was told is worse than none.
   *
   * The row asserts the INTERVAL is non-empty at the boot playhead, and the
   * grab BYTES separately, because either alone can lie: an interval is model
   * state, and a byte count cannot say WHY a picture is dark.
   */
  const bootArms = []
  for (const mode of ["grow", "travel", "vanish", "shrink"]) {
    /* READ WHAT THE DRIVER RETURNED. `setWindow` returns a boolean and this
     * threw it away, so "the setter refused" and "the setter acted and the
     * value did not survive" were the same picture from here. The arm below
     * already checks the mode came back; this separates the two ways it
     * could not. */
    const setTook = await page.evaluate(
      (m) => window.__revealHarness.setWindow({ mode: m }),
      mode,
    )
    if (!setTook) {
      say(
        false,
        `2.8   setWindow REFUSED ${mode}, so its reload arm cannot be judged`,
        "the driver returned false; nothing below this is a verdict on persistence",
      )
      continue
    }
    await page.waitForTimeout(500)
    await page.reload({ waitUntil: "networkidle" })
    await page.waitForFunction(() => !!window.__revealHarness, null, { timeout: 60000 })
    await page.waitForTimeout(2500)
    const arm = await page.evaluate(() => {
      const h = window.__revealHarness
      const clock = h.getClock()
      return {
        mode: h.window().mode,
        clock,
        empty: h.windowAt(clock).empty,
        bytes: (window.__captureHarness?.grab?.() ?? "").length,
      }
    })
    bootArms.push({ asked: mode, ...arm })
  }
  const detail = bootArms
    .map((a) => `${a.asked}: restored=${a.mode} clock=${a.clock} empty=${a.empty} ${a.bytes}B`)
    .join(" · ")
  say(
    bootArms.every((a) => a.mode === a.asked),
    "2.8   every one of the four window modes survives its own reload",
    detail,
  )
  say(
    bootArms.every((a) => a.empty === false),
    "2.8   ⭐ …and NOT ONE of them boots into an empty window. A restored take opens showing the mark",
    detail,
  )
  /* THE BLANK STAGE, MEASURED ON THIS RUN RATHER THAN GUESSED AT.
   *
   * ⚠ The first version of this row compared each arm against a FRACTION of
   * `grow`, and `travel` failed it at 52 % — correctly, because `travel` shows a
   * 25 %-length segment and is SUPPOSED to carry far fewer pixels than the whole
   * mark. A threshold picked out of the air cannot tell "a smaller picture" from
   * "no picture", which is the only question here.
   *
   * So the floor is the real blank: same page, same scene, same canvas, the
   * playhead driven to the one instant `vanish` is genuinely empty. Every boot
   * arm has to be clear of THAT. (`assert-data-safety.mjs` §3.8b builds its
   * reference the same way and reports the ratio.) */
  const blank = await page.evaluate(async () => {
    const h = window.__revealHarness
    /* BOTH DRIVERS ANSWER, AND BOTH ANSWERS TRAVEL. This reference frame is
     * the empty stage every arm above is compared against, so a setter that
     * refused here would hand every one of them a reference that is not the
     * thing it claims to be, silently. */
    const setWindowTook = h.setWindow({ mode: "vanish" })
    const setProgressTook = h.setProgress(1)
    await new Promise((r) => setTimeout(r, 700))
    return {
      setWindowTook,
      setProgressTook,
      bytes: (window.__captureHarness?.grab?.() ?? "").length,
      empty: h.windowAt(1).empty,
      notEmptyAtStart: h.windowAt(0).empty === false,
    }
  })
  /* THE TWO DRIVERS THAT BUILT THE REFERENCE, JUDGED BEFORE THE REFERENCE IS
   * USED. Both answers were dropped, so a refusal here produced a frame
   * that was not the empty stage and every arm below was measured against
   * it anyway.
   *
   * THE TWO HAVE DIFFERENT CONTRACTS AND THIS ROW HOLDS BOTH.
   * `setWindow` VALIDATES a partial patch, so it answers with a boolean.
   * `setProgress` CLAMPS with `Math.max(0, Math.min(1, value))` and has no
   * failure mode at all, so it is void on purpose. The first cut of this
   * row expected `true` from both and went red on `undefined`, which was
   * the row being wrong about the code rather than the code being wrong.
   * Asserting the SHAPE each one contracts means this notices either a
   * refusal or a setter quietly growing a return. */
  control(
    blank.setWindowTook === true && blank.setProgressTook === undefined,
    "2.8   both drivers answered as their contracts say they should",
    `setWindow(vanish)=${blank.setWindowTook} (boolean, validates) · ` +
      `setProgress(1)=${blank.setProgressTook} (void, clamps)`,
  )
  control(
    blank.empty === true && blank.notEmptyAtStart === true,
    "2.8   the reference really IS the empty stage, and the reader is not stuck on 'empty'",
    `vanish at playhead 1: empty=${blank.empty} · at playhead 0: empty=${!blank.notEmptyAtStart}`,
  )
  const worst = bootArms.reduce((a, b) => (a.bytes < b.bytes ? a : b))
  say(
    bootArms.every((a) => a.bytes > blank.bytes * 1.3),
    "2.8   …confirmed in PIXELS against that blank, not against a guessed fraction",
    `blank ${blank.bytes}B · thinnest arm ${worst.asked} ${worst.bytes}B (${(worst.bytes / blank.bytes).toFixed(2)}x blank) · ${detail}`,
  )
  await shot("05-boot-window-modes")

  say(pageErrors.length === 0, "2.x   no uncaught page errors during the whole run", pageErrors.slice(0, 3).join(" | ") || "clean")

  await browser.close()
}

/* ========================================================================== */

async function uiReachable() {
  try {
    const r = await fetch(LAB_URL, { signal: AbortSignal.timeout(60000) })
    return { ok: r.status === 200, why: `HTTP ${r.status}` }
  } catch (e) {
    return { ok: false, why: String(e).slice(0, 80) }
  }
}

async function main() {
  /* PRE-FLIGHT, BEFORE THE FIRST ROW. `assert-data-safety.mjs` printed 85
   * greens against a dead port before this rule existed. */
  const wantsUi = ONLY === "" || ONLY === "page"
  let runUi = wantsUi
  if (!wantsUi) {
    unsweptRow(
      "§2 · THE REAL PAGE",
      `--only=${ONLY} was passed, so the round trip was never driven`,
      "Drop the flag to run both sections.",
    )
  } else {
    const reach = await uiReachable()
    if (!reach.ok) {
      runUi = false
      unsweptRow(
        "§2 · THE REAL PAGE",
        `${LAB_URL} is not answering (${reach.why}), so the round trip was never driven in a browser`,
        `Start the dev server on the port FS_PORT names and re-run. §1 still ran — it grades lib/doc-store.ts in node — but the round trip is this file's headline question.`,
      )
      console.log("")
    }
  }

  if (ONLY === "" || ONLY === "store") storePart()
  if (runUi) await pagePart()

  writeFileSync(
    join(OUT, "report.json"),
    JSON.stringify({ rows, failures, unswept, complete: unswept.length === 0, results }, null, 2),
  )
  if (failures > 0) {
    console.log(`\n${failures} of ${rows} FAILED.`)
    console.log(`wrote ${join(OUT, "report.json")}`)
    process.exit(1)
  }
  if (unswept.length) {
    console.log(
      `\nPARTIAL — ${rows} row(s) passed and ${unswept.length} channel(s) were NEVER REACHED: ${unswept.join(", ")}.` +
        `\nThis is NOT "the take persists": the round trip was not driven.` +
        `\nExiting 3, not 0. A SKIP IS NOT A PASS (DISPATCH §3:116).`,
    )
    console.log(`wrote ${join(OUT, "report.json")}`)
    process.exit(3)
  }
  console.log(`\nALL ${rows} TAKE-PERSISTENCE ASSERTIONS PASS (controls included), both sections swept.`)
  console.log(`wrote ${join(OUT, "report.json")}`)
  process.exit(0)
}

main().catch((e) => {
  console.log(`FAIL  the run itself crashed after ${rows} row(s) had already printed — ${String(e).slice(0, 300)}`)
  console.log(
    `      Those ${rows} row(s) are NOT a verdict on this run: it did not finish, so nothing below the crash was asked.`,
  )
  try {
    writeFileSync(
      join(OUT, "report.json"),
      JSON.stringify({ rows, failures, unswept, complete: false, crashed: String(e).slice(0, 300), results }, null, 2),
    )
  } catch {}
  process.exit(1)
})
