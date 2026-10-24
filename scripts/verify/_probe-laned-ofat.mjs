// _PROBE-LANED-OFAT — DID EVERY ARM OF THE BLANK-TAIL OFAT TABLE ACTUALLY TAKE?
//
// AUDIT INSTRUMENT (lane D, read-only on source). It changes nothing and fixes
// nothing. It answers one question about
// `docs/verification/drawin-vanish/BLANK-TAIL-FONT-WORD.md`'s twelve-row table:
//
//   the write-up's own header retracts ONE row — `setFlatten({flat: 0, depth: 1})`
//   "set a key that is not on `FlatState` at all, so that row measured nothing."
//   If one row can do that, every row can. This checks every one of them.
//
// ── WHY IT MEASURES ON THE **FIXED** BUILD, NOT THE BROKEN ONE ─────────────
//
// On the broken build every arm read `ink: 1` — INCLUDING `shipped` — because the
// driver was dropping the whole draw call upstream of every fragment test. A
// measurement whose baseline is blank cannot tell "this arm did nothing" from
// "this arm did something and the picture was blank anyway". So the arms are
// re-run where the mark RENDERS, and the reading is the number of pixels the arm
// changes against the shipped frame at the same playhead. An arm that changes
// zero pixels on a rendering mark did not reach the render.
//
// ── THE NEGATIVE CONTROL IS A KEY THAT CANNOT EXIST ───────────────────────
//
// `__captureHarness.setFlatten` took `Partial<FlatState>` and returned `true`
// unconditionally — it never validated the key, so a typo reported success.
// `setFlatten({ __laneDBogus: 0 })` was therefore the floor: whatever it changed
// was this instrument's noise, and any arm at or below it was indistinguishable
// from a dead key.
//
// ═══════════════════════════════════════════════════════════════════════════
// LANE Q, 2026-08-07 — THE OPPOSITE-VALUE RE-RUN (explainer 24 §8 item 5)
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠ **THE FLOOR MOVED UNDER THIS FILE, AND THAT IS THE POINT.** Lane M landed
// `isValidFlatState` in `components/viewport-3d.tsx`, so `setFlatten` now REFUSES
// an object WHOLE if any own key is not one of `FlatState`'s thirteen. Lane D's
// CONTROL arm above therefore no longer returns `true`, and the retracted row
// `{flat: 0, depth: 1}` no longer applies its valid half — **its 18 px reading
// becomes 0.** The arm was always a lie; the setter now says so. Lane D's rows
// are kept verbatim below (`LEGACY_ARMS`) because deleting them would lose the
// before/after, and the whole point of this file is that a retracted reading is
// worth more than a tidy one.
//
// WHAT THIS RUN ADDS, and each addition marks a hole the last run had:
//
//   1. **BOTH DIRECTIONS ON EVERY NUMERIC CHANNEL.** Lane D: *"the
//      opposite-value arms are the point — no row of the original table has one,
//      and without one a 0-change reading cannot tell a dead arm from a state
//      already there."* All ELEVEN numeric channels (`FLAT_STATE_NUMERIC`) get a
//      LOW arm and a HIGH arm. The pair is the verdict, never one arm:
//        both move        -> LIVE, the channel is evidence on this surface
//        one moves        -> LIVE, but the still arm was asking for the state
//                            it was already in — that arm is not evidence
//        neither moves    -> INERT on this surface; no arm on it could ever
//                            have come out any other way
//   2. **THE VALIDATOR IS CONTROLLED IN BOTH DIRECTIONS.** A reject row alone is
//      unfalsifiable: `isValidFlatState` returning `false` for everything would
//      pass it perfectly and break every real channel. So the impossible key must
//      be REFUSED, `null` and all thirteen real keys must be ACCEPTED, and a
//      refused object must move ZERO pixels — measured, not assumed.
//   3. **THE CAPTURE SAYS WHAT IT GRABBED.** `__captureHarness.grabInfo()`
//      (Lane M) is read on every arm. `firstUnderContainer` false means
//      position-resolution and identity-resolution have diverged, which is how
//      seven frames of one film came back 1584×1468 instead of 799×1468.
//   4. **EVERY READING NAMES ITS MESH.** `revealState()` and `attrCensus()`
//      return one row per object out of `collect()`, and `collect()` also returns
//      small helper geometries — this probe's sibling printed `Infinity / 6` for
//      forty rows because it read `ranges[0]`. Every reading here is taken off
//      the LARGEST index buffer and the census of the others is written out
//      beside it, so a reader can check rather than trust.
//   5. **THE SURFACE IS A PARAMETER.** `--surface=draw96` is the state the §2
//      table was taken in (Free Stroke · FONT word · wobble 0 · endpoint CLEAN ·
//      DRAW 96 %). `--surface=breath` is the settled flat mark that
//      `assert-hero-flatstate.mjs` parks on — the pose `FlatState` was designed
//      for. **A channel's OFAT verdict is a property of the surface it was taken
//      on** (explainer 24 §9.3), so the same eleven channels are swept on both
//      and the difference is the finding, not an inconsistency.
//
// Usage: FS_PORT=3118 node scripts/verify/_probe-laned-ofat.mjs --label=<x> \
//          [--at=96] [--surface=draw96|breath]
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const AT = parseFloat(arg("at", "96")) / 100
const PORT = process.env.FS_PORT || "3000"
const SURFACE = arg("surface", "draw96")
/* THE CAMERA IS PART OF THE SURFACE, and `assert-hero-flatstate.mjs` is where
 * that was first measured: *"a contact pool is a HORIZONTAL plane, so at the
 * beat's parked elevation (el 0, the camera level with the mark) it is seen
 * edge-on and contributes nothing: driven from 0 to 1 dead-on it moves the
 * ground tone by 0.00."* That gate solves it by orbiting to el 35 for the shadow
 * row and keeping the dead-on reading as the statement of WHERE the channel can
 * be seen. A sweep that reports `shadow` INERT without saying which elevation it
 * was taken at is making the §2 table's mistake in a new place. */
const EL = parseFloat(arg("el", "0"))
const LABEL = arg("label", null)
if (!LABEL) {
  console.error("--label=<name> is required: an artefact with no label overwrites the last one.")
  process.exit(2)
}
if (SURFACE !== "draw96" && SURFACE !== "breath") {
  console.error(`unknown --surface=${SURFACE} — one of draw96 | breath`)
  process.exit(2)
}
/* NOT `lane-d-audit/`. That directory is Lane D's artefact and its
 * `ofat-arms.json` is the BEFORE arm of this very comparison; writing over it
 * would delete the evidence this run exists to be compared against. */
const OUT = join(ROOT, "docs", "verification", "laneq-ofat", LABEL)

/* THE ELEVEN NUMERIC CHANNELS, and the two values each is driven to.
 *
 * Counted off `FlatState` in `components/viewport-3d.tsx` — thirteen keys, minus
 * `color` (a string) and `letters` (an array), is ELEVEN. Explainer 24 §8 item 2
 * says ten; that is the arithmetic slip §9.2 corrects, and this list is the
 * measurement behind it.
 *
 * LOW and HIGH are not "0 and 1" everywhere, because for three of them 1 is the
 * identity and 0 is a degenerate that says nothing:
 *   · squashX / squashY — 1 IS no squash. The pair is 0.72 (compress) against
 *     1.18 (stretch), so neither arm can be the host's own state.
 *   · yaw / pitch — 0 is dead-on. The pair is -25° against +25°.
 *   · depth — the flat register is 0.004, not 0 (the mark is squashed to a
 *     sliver, never to a plane). The pair is 0.004 against 1.
 * Everything else is the natural 0/1 of its own range. */
const CHANNELS = [
  ["ink", 0, 1],
  ["depth", 0.004, 1],
  ["yaw", -25, 25],
  ["pitch", -25, 25],
  ["shade", 0, 0.6],
  ["shadow", 0, 1],
  ["squashX", 0.72, 1.18],
  ["squashY", 0.72, 1.18],
  ["jointBreak", 0, 1],
  ["penCarve", 0, 1],
  ["lit", 0, 1],
]
/** The thirteen names, for the validator's ACCEPT control. `letters` and `color`
 *  carry the shapes `isValidFlatState` actually demands, not stand-ins. */
const ACCEPT_ALL = {
  ink: 1,
  depth: 1,
  color: "#101010",
  yaw: 0,
  pitch: 0,
  shade: 0,
  shadow: 0,
  squashX: 1,
  squashY: 1,
  jointBreak: 0,
  penCarve: 1,
  lit: 1,
  letters: [],
}

async function px(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  return { d: x.getImageData(0, 0, img.width, img.height).data, w: img.width, h: img.height }
}
function inkOf(p) {
  const hist = new Uint32Array(256)
  const luma = new Uint8Array(p.w * p.h)
  for (let i = 0, q = 0; i < p.d.length; i += 4, q++) {
    const l = (0.2126 * p.d[i] + 0.7152 * p.d[i + 1] + 0.0722 * p.d[i + 2]) | 0
    luma[q] = l
    hist[l]++
  }
  let paper = 0
  for (let l = 1; l < 256; l++) if (hist[l] > hist[paper]) paper = l
  const cut = Math.max(8, paper - 45)
  let n = 0
  for (let q = 0; q < luma.length; q++) if (luma[q] < cut) n++
  return n
}
/** Pixels differing from the baseline by more than 3/255 on any channel. */
function diffOf(a, b) {
  if (a.w !== b.w || a.h !== b.h) return -1
  let n = 0
  for (let i = 0; i < a.d.length; i += 4) {
    if (
      Math.abs(a.d[i] - b.d[i]) > 3 ||
      Math.abs(a.d[i + 1] - b.d[i + 1]) > 3 ||
      Math.abs(a.d[i + 2] - b.d[i + 2]) > 3
    )
      n++
  }
  return n
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1600, height: 1600 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const logs = []
  page.on("console", (m) => logs.push({ type: m.type(), text: m.text().slice(0, 200) }))
  page.on("pageerror", (e) => logs.push({ type: "pageerror", text: String(e).slice(0, 200) }))

  await page.goto(`http://localhost:${PORT}/desk-doodles`, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__inflateProbe, null, { timeout: 120000 })
  await page.waitForTimeout(2500)

  let wobbleOk = null
  let endpointOk = null
  if (SURFACE === "draw96") {
    // ---- Sebs's own dial sequence, through the real controls. ----
    await page.click('[data-engine-option="free-stroke"]')
    await page.waitForTimeout(4000)
    await page.click('[data-word-source="font"]')
    await page.waitForTimeout(5000)
    wobbleOk = await page.evaluate(() => {
      for (const inp of document.querySelectorAll('input[type="range"]')) {
        const row = inp.closest("div")?.parentElement
        if (((row?.textContent ?? "").toLowerCase()).includes("wobble")) {
          const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
          s.call(inp, "0")
          inp.dispatchEvent(new Event("input", { bubbles: true }))
          inp.dispatchEvent(new Event("change", { bubbles: true }))
          return true
        }
      }
      return false
    })
    await page.waitForTimeout(4000)
    endpointOk = await page.evaluate(() => {
      for (const b of document.querySelectorAll("button")) {
        if ((b.textContent ?? "").trim().toLowerCase() === "clean") {
          b.click()
          return true
        }
      }
      return false
    })
    await page.waitForTimeout(4000)
  }
  /* THE STATE READ OFF THE LIVE DOM, not off the harness — lifted verbatim from
   * `_probe-drawin-vanish.mjs:178-206` so a "same state" claim means the same
   * thing in both instruments. The active pill is decided by its computed
   * background, i.e. by what a HAND would see, not by a prop. */
  const state = await page.evaluate(() => {
    let wobble = null
    for (const inp of document.querySelectorAll('input[type="range"]')) {
      const row = inp.closest("div")?.parentElement
      const t = (row?.textContent ?? "").toLowerCase()
      if (t.includes("wobble")) { wobble = Number(inp.value); break }
    }
    const LABELS = { clean: "clean", protrude: "protrude", long: "long-overshoot", kink: "kink" }
    let endpoint = null
    for (const b of document.querySelectorAll("button")) {
      const key = LABELS[(b.textContent ?? "").trim().toLowerCase()]
      if (!key) continue
      const bg = getComputedStyle(b).backgroundColor
      if (!(bg === "rgba(0, 0, 0, 0)" || bg === "transparent")) endpoint = key
    }
    let word = null
    for (const b of document.querySelectorAll("[data-word-source]")) {
      const bg = getComputedStyle(b).backgroundColor
      if (!(bg === "rgba(0, 0, 0, 0)" || bg === "transparent")) word = b.getAttribute("data-word-source")
    }
    return {
      wobble,
      endpoint,
      word,
      engineFamily: document.querySelector("[data-engine-family]")?.getAttribute("data-engine-family") ?? null,
      penTip: window.__captureHarness?.penTip?.() ?? null,
    }
  })
  console.log(`surface ${SURFACE} — dial walk: wobble set ${wobbleOk} · endpoint set ${endpointOk}`)
  console.log(`live state: ${JSON.stringify(state)}`)

  const scrubTo = async (t) => {
    await page.evaluate((tt) => {
      const el = document.querySelector("[data-hero-scrub]")
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      s.call(el, String(tt))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, t)
  }

  /* ---- PARK THE PLAYHEAD ------------------------------------------------
   *
   * `draw96` is the §2 table's own playhead, derived from the page's published
   * draw span rather than from a constant — the same rule
   * `assert-hero-flatstate.mjs` states at its own park: "a constant standing in
   * for a phase boundary is a row that reports on the beat's tempo instead of on
   * the channel it names."
   *
   * `breath` is the LAST `breath` frame: the settled flat mark, dead-on, before
   * the anticipation. Walked, not assumed, for the same reason. */
  let parkedAt = null
  if (SURFACE === "draw96") {
    const span = await page.evaluate(() =>
      JSON.parse(document.querySelector("[data-hero-draw-span]").getAttribute("data-hero-draw-span")),
    )
    parkedAt = span.at + span.duration * AT
    await scrubTo(parkedAt)
  } else {
    const maxT = await page.evaluate(() => Number(document.querySelector("[data-hero-scrub]").max))
    let holdT = null
    for (let t = 0.2; t < maxT; t += 0.25) {
      await scrubTo(t)
      const ph = await page.evaluate(
        () => document.querySelector("[data-hero-phase]")?.dataset.heroPhase ?? null,
      )
      if (ph === "breath") holdT = t
      else if (holdT !== null) break
    }
    if (holdT === null) {
      console.error("no `breath` phase on the scrub — the beat's phase names moved")
      process.exit(1)
    }
    parkedAt = holdT
    await scrubTo(holdT)
  }
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  await page.waitForTimeout(600)
  if (EL !== 0) {
    await page.evaluate((e) => window.__captureHarness.orbitView(0, e, 1), EL)
    await page.waitForTimeout(600)
  }
  console.log(`parked at ${parkedAt.toFixed(3)}s (${SURFACE}) · elevation ${EL}°`)

  /* ---- WHAT THE CAPTURE IS LOOKING AT, STATED ----------------------------
   * Lane M's `grabInfo()`. `firstUnderContainer` false is the row that says
   * position-resolution and identity-resolution have diverged. The stage
   * locator is also counted: Playwright throws on a multi-match in strict mode,
   * but a count of ONE is a claim worth writing down rather than relying on. */
  const grab = await page.evaluate(() => window.__captureHarness?.grabInfo?.() ?? null)
  const stageCount = await page.locator("[data-hero-stage]").count()
  console.log(`grabInfo ${JSON.stringify(grab)} · [data-hero-stage] matches ${stageCount}`)

  const shot = async () => {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(400)
    return px(await page.locator("[data-hero-stage]").screenshot())
  }

  /* ---- WHICH MESH EVERY READING CAME FROM -------------------------------
   * `collect()` returns the mark AND small helper geometries. `ranges[0]` in the
   * original artefact is the trap object — `totalIndices 6 · vertexCount 4 ·
   * opacity 0`. So the mark is taken as the LARGEST index buffer and the whole
   * census is written out beside it. This also doubles as the falsifiability
   * control for rows 3 and 5 of the §2 table: if some object in the same census
   * reads `opacity 0` or `visible false`, then those readings are demonstrably
   * capable of saying something other than what they said about the mark. */
  const meshCensus = async () => {
    return page.evaluate(() => {
      const rs = window.__inflateProbe?.revealState?.() ?? null
      const ac = window.__inflateProbe?.attrCensus?.() ?? []
      const all = rs?.ranges ?? []
      const big = all.reduce((a, b) => (b.totalIndices > (a?.totalIndices ?? -1) ? b : a), null)
      const bigAttr = ac.reduce((a, b) => (b.indexCount > (a?.indexCount ?? -1) ? b : a), null)
      return {
        frac: rs?.frac ?? null,
        window: rs?.window ?? null,
        meshes: all.length,
        big,
        bigAttr,
        /* Every distinct value each ruled-out reading takes across the census.
         * A single-element set means that reading has never been observed to be
         * able to say anything else — which is a statement about the
         * INSTRUMENT, not about the mark. */
        distinct: {
          visible: [...new Set(all.map((r) => r.visible))],
          frustumCulled: [...new Set(all.map((r) => r.frustumCulled))],
          opacity: [...new Set(all.map((r) => r.opacity))],
          transparent: [...new Set(all.map((r) => r.transparent))],
          colorWrite: [...new Set(all.map((r) => r.colorWrite))],
          matVisible: [...new Set(all.map((r) => r.matVisible))],
          firstBadIndex: [...new Set(all.map((r) => r.firstBadIndex))],
        },
        others: all
          .filter((r) => r !== big)
          .map((r) => ({ totalIndices: r.totalIndices, vertexCount: r.vertexCount, opacity: r.opacity, visible: r.visible })),
      }
    })
  }

  /* ---- THE ARMS. Each is (label, setup, teardown, the FlatState keys it claims). ----
   *
   * LEGACY_ARMS is Lane D's set, VERBATIM. It is kept — not replaced — because
   * three of its readings only mean anything beside the same arm's reading on
   * the pre-validator build, and because `{flat: 0, depth: 1}` returning `false`
   * where it used to return `true` is the single clearest artefact this lane can
   * produce. Deleting a retracted row loses the retraction. */
  /* ⚠ SETUP IS DATA, NOT A CLOSURE. `page.evaluate(() => …setFlatten(o))` sends
   * the function's SOURCE across the boundary and leaves `o` undefined in the
   * page — an arm that throws instead of setting, and every reading after it a
   * reading of the shipped state under a different label. That is the same
   * failure class this whole file is about (an arm that reports a verdict about
   * a path it never touched), so the arm's payload is serialised as an
   * ARGUMENT and there is exactly one dispatcher. */
  const CLEAR = () => window.__captureHarness.setFlatten(null)
  const setFlat = (o) => page.evaluate((v) => window.__captureHarness.setFlatten(v), o)
  const setTip = (n) => page.evaluate((v) => window.__captureHarness.setPenTip(v), n)
  const applyStep = async (s) => {
    if (!s) return null
    let last = null
    if ("flat" in s) last = await setFlat(s.flat)
    if ("penTip" in s) last = await setTip(s.penTip)
    return last
  }
  const F = (o) => ({ flat: o })
  const CLR = { flat: null }

  const LEGACY_ARMS = [
    ["shipped (baseline)", null, null, []],
    ["shipped (repeat — noise floor)", null, null, []],
    ["CONTROL · a key that cannot exist", F({ __laneQBogus: 0 }), CLR, ["__laneQBogus"]],
    ["penCarve 0", F({ penCarve: 0 }), CLR, ["penCarve"]],
    ["penTip off", { penTip: "off" }, { penTip: "reed" }, []],
    ["jointBreak 0", F({ jointBreak: 0 }), CLR, ["jointBreak"]],
    ["flat 0 + depth 1  (THE RETRACTED ROW)", F({ flat: 0, depth: 1 }), CLR, ["flat", "depth"]],
    ["  …isolated: flat 0 alone", F({ flat: 0 }), CLR, ["flat"]],
    ["  …isolated: depth 1 alone", F({ depth: 1 }), CLR, ["depth"]],
    ["ink 0", F({ ink: 0 }), CLR, ["ink"]],
    /* ── THE OPPOSITE VALUE, for every channel that came back at the floor. ──
     * A channel that changes nothing when set to X is ambiguous: the arm may
     * have failed to reach the render, or the state may ALREADY have been X.
     * Only the opposite value separates them, and no row of the original table
     * has one. */
    ["  …opposite: ink 1", F({ ink: 1 }), CLR, ["ink"]],
    ["  …opposite: jointBreak 1", F({ jointBreak: 1 }), CLR, ["jointBreak"]],
    ["  …opposite: penCarve 1", F({ penCarve: 1 }), CLR, ["penCarve"]],
    ["  …opposite: depth 0", F({ depth: 0 }), CLR, ["depth"]],
    [
      "penCarve 0 + penTip off",
      { flat: { penCarve: 0 }, penTip: "off" },
      { flat: null, penTip: "reed" },
      ["penCarve"],
    ],
  ]

  /* ---- THE VALIDATOR, CONTROLLED IN BOTH DIRECTIONS ----------------------
   *
   * A reject-only control is unfalsifiable: `isValidFlatState` returning `false`
   * for EVERYTHING passes it perfectly and silently kills every channel below.
   * So the accept arms are the ones that matter, and `color` / `letters` are in
   * the set because a blanket `typeof v === "number"` would break exactly those
   * two — explainer 24 §8's "widen an exemption, never the rule" trap, running
   * the other way. */
  const VALIDATOR = [
    ["REJECT · a key that cannot exist", { __laneQBogus: 0 }, false],
    ["REJECT · the retracted row's own object", { flat: 0, depth: 1 }, false],
    ["REJECT · a real key, non-finite value", { ink: Number.NaN }, false],
    ["REJECT · a real key, wrong type", { color: 5 }, false],
    ["REJECT · letters carrying a non-number", { letters: [{ x: "a", y: 0, w: 1, h: 1 }] }, false],
    ["ACCEPT · null means CLEAR (the documented contract)", null, true],
    ["ACCEPT · all THIRTEEN real keys at once", ACCEPT_ALL, true],
    ...CHANNELS.map(([k, lo]) => [`ACCEPT · ${k} alone`, { [k]: lo }, true]),
    ["ACCEPT · color alone (a string channel)", { color: "#101010" }, true],
  ]

  /* ---- BOTH DIRECTIONS, EVERY NUMERIC CHANNEL --------------------------- */
  const SWEEP = []
  for (const [k, lo, hi] of CHANNELS) {
    SWEEP.push([`${k} ${lo}`, F({ [k]: lo }), CLR, [k], k, "lo"])
    SWEEP.push([`${k} ${hi}`, F({ [k]: hi }), CLR, [k], k, "hi"])
  }
  /* `color` is not numeric and gets its own pair — a colour that must move the
   * mark and one that is the mark's own ink, so the pair still separates "the
   * channel is dead" from "the arm asked for the state it was in". */
  SWEEP.push(["color #d02020", F({ color: "#d02020" }), CLR, ["color"], "color", "lo"])
  SWEEP.push(["color #101010", F({ color: "#101010" }), CLR, ["color"], "color", "hi"])

  /* ---- CHANNELS THAT ARE GATED BEHIND ANOTHER CHANNEL -------------------
   *
   * `lit` reads 0 px in BOTH directions on every surface swept so far, which
   * would ordinarily be the verdict "this dial does nothing" — a defect under
   * DISPATCH §2.7, *"a dial whose label does not describe what renders is a
   * defect."* It is not that. `viewport-3d.tsx:6430` multiplies the whole rim
   * term by `(1 - k)`, and `k` is the flat-ink blend: at `ink 1` the term is
   * exactly zero whatever `lit` is. So a single-key OFAT arm on `lit` is asking
   * the channel to act in the one state where it is arithmetically switched off.
   *
   * That is the same defect as the retracted row wearing different clothes — an
   * arm that could not have come out any other way — and the fix is the same:
   * hold the partner at the value that lets the channel act, and diff the PAIR
   * against each other rather than against the shipped frame. `shadow` gets the
   * same treatment, for the reason `assert-hero-flatstate.mjs` already records
   * about the pool being edge-on. */
  SWEEP.push(["lit 0  · partner ink 0 (the LIT form)", F({ ink: 0, lit: 0 }), CLR, ["ink", "lit"], "lit@ink0", "lo"])
  SWEEP.push(["lit 1  · partner ink 0 (the LIT form)", F({ ink: 0, lit: 1 }), CLR, ["ink", "lit"], "lit@ink0", "hi"])
  SWEEP.push(["shadow 0 · partner ink 0", F({ ink: 0, shadow: 0 }), CLR, ["ink", "shadow"], "shadow@ink0", "lo"])
  SWEEP.push(["shadow 1 · partner ink 0", F({ ink: 0, shadow: 1 }), CLR, ["ink", "shadow"], "shadow@ink0", "hi"])
  SWEEP.push(["jointBreak 0 · partner depth 1", F({ depth: 1, jointBreak: 0 }), CLR, ["depth", "jointBreak"], "jointBreak@depth1", "lo"])
  SWEEP.push(["jointBreak 1 · partner depth 1", F({ depth: 1, jointBreak: 1 }), CLR, ["depth", "jointBreak"], "jointBreak@depth1", "hi"])

  const runArms = async (arms, base0) => {
    let base = base0
    const rows = []
    /* THE FRAMES ARE KEPT, because the diff that matters for a channel is not
     * "did each arm move the shipped frame" but "do the two arms differ FROM
     * EACH OTHER". Two arms that each move 25 000 px against the baseline and
     * are byte-identical to one another have measured their PARTNER, not the
     * channel — which is exactly what `{flat: 0, depth: 1}` did. */
    const frames = new Map()
    for (const [name, setup, teardown, keys, channel, dir] of arms) {
      let setReturn = null
      if (setup) setReturn = await applyStep(setup)
      const p = await shot()
      if (!base) base = p
      if (channel) frames.set(`${channel}/${dir}`, p)
      const ink = inkOf(p)
      const changed = diffOf(base, p)
      rows.push({ name, keys, channel: channel ?? null, dir: dir ?? null, setReturn, ink, changed })
      console.log(
        `  ${name.padEnd(44)} ink ${String(ink).padStart(7)}   changed ${String(changed).padStart(8)}   setter ${String(setReturn)}`,
      )
      if (teardown) await applyStep(teardown)
      await page.waitForTimeout(400)
    }
    return { rows, base, frames }
  }

  console.log(`\n--- LEGACY: Lane D's arm set, verbatim, on the POST-VALIDATOR build ---`)
  const legacy = await runArms(LEGACY_ARMS, null)
  const base = legacy.base

  console.log(`\n--- THE VALIDATOR, both directions ---`)
  const validator = []
  for (const [name, obj, want] of VALIDATOR) {
    const got = await setFlat(obj)
    const p = await shot()
    const changed = diffOf(base, p)
    await page.evaluate(CLEAR)
    await page.waitForTimeout(300)
    const ok = got === want
    validator.push({ name, obj: obj === null ? null : Object.keys(obj), want, got, ok, changed })
    console.log(
      `  ${ok ? "PASS" : "FAIL"}  ${name.padEnd(48)} returned ${String(got).padEnd(5)} (want ${want})   moved ${String(changed).padStart(7)} px`,
    )
  }

  console.log(`\n--- BOTH DIRECTIONS, all ${CHANNELS.length} numeric channels + color ---`)
  const sweep = await runArms(SWEEP, base)

  /* ---- THE READINGS (rows 1-6 of the §2 table) --------------------------
   * These are not arms and cannot be swept. What CAN be asked of them is
   * whether they are capable of reading anything other than what they read —
   * which is the same question, one level up. Two playheads and the census of
   * sibling meshes answer most of it; what they cannot answer is NAMED. */
  const censusHere = await meshCensus()
  await scrubTo(SURFACE === "draw96" ? parkedAt * 0.5 : parkedAt * 0.5)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  await page.waitForTimeout(500)
  const censusElsewhere = await meshCensus()
  await scrubTo(parkedAt)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  await page.waitForTimeout(500)
  /* A pose arm, so rows 4 ("mesh moved or collapsed") and 3 ("hidden or culled")
   * can be asked whether the numbers they quote MOVE when the mesh does. */
  await setFlat({ squashY: 0.72, yaw: 25 })
  await page.waitForTimeout(400)
  const censusMoved = await meshCensus()
  await page.evaluate(CLEAR)
  await page.waitForTimeout(400)

  console.log(`\n--- THE SIX READINGS: can each of them say otherwise? ---`)
  const readings = [
    {
      row: "1 · the reveal fraction",
      here: censusHere.frac,
      elsewhere: censusElsewhere.frac,
      moves: censusHere.frac !== censusElsewhere.frac,
      how: "read at two playheads",
    },
    {
      row: "2 · setDrawRange cut to nothing",
      here: censusHere.big?.count ?? null,
      elsewhere: censusElsewhere.big?.count ?? null,
      moves: (censusHere.big?.count ?? null) !== (censusElsewhere.big?.count ?? null),
      how: "read at two playheads",
    },
    {
      row: "3 · mesh hidden or culled",
      here: `visible ${censusHere.big?.visible} · culled ${censusHere.big?.frustumCulled}`,
      elsewhere: `distinct across ${censusHere.meshes} meshes: visible ${JSON.stringify(censusHere.distinct.visible)} · culled ${JSON.stringify(censusHere.distinct.frustumCulled)}`,
      moves: censusHere.distinct.visible.length > 1 || censusHere.distinct.frustumCulled.length > 1,
      how: "the census of every object collect() returns",
    },
    {
      row: "4 · mesh moved or collapsed",
      here: JSON.stringify(censusHere.big?.world) + " scale " + JSON.stringify(censusHere.big?.scale),
      elsewhere: JSON.stringify(censusMoved.big?.world) + " scale " + JSON.stringify(censusMoved.big?.scale),
      moves:
        JSON.stringify(censusHere.big?.world) + JSON.stringify(censusHere.big?.scale) !==
        JSON.stringify(censusMoved.big?.world) + JSON.stringify(censusMoved.big?.scale),
      how: "squashY 0.72 + yaw 25 driven through the same harness",
    },
    {
      row: "5 · material invisible",
      here: `opacity ${censusHere.big?.opacity} · transparent ${censusHere.big?.transparent} · colorWrite ${censusHere.big?.colorWrite}`,
      elsewhere: `distinct across ${censusHere.meshes} meshes: opacity ${JSON.stringify(censusHere.distinct.opacity)} · transparent ${JSON.stringify(censusHere.distinct.transparent)} · colorWrite ${JSON.stringify(censusHere.distinct.colorWrite)}`,
      moves:
        censusHere.distinct.opacity.length > 1 ||
        censusHere.distinct.transparent.length > 1 ||
        censusHere.distinct.colorWrite.length > 1,
      how: "the census of every object collect() returns",
    },
    {
      row: "6 · indices out of range",
      here: `vertexCount ${censusHere.big?.vertexCount} · maxIndex ${censusHere.big?.maxIndex} · firstBadIndex ${censusHere.big?.firstBadIndex}`,
      elsewhere: `vertexCount ${censusElsewhere.big?.vertexCount} · maxIndex ${censusElsewhere.big?.maxIndex} · firstBadIndex ${censusElsewhere.big?.firstBadIndex}`,
      moves: (censusHere.big?.maxIndex ?? null) !== (censusElsewhere.big?.maxIndex ?? null),
      how: "read at two playheads — maxIndex only; firstBadIndex has never been observed non-null, which is explainer 24 §7's point",
    },
  ]
  for (const r of readings) {
    console.log(`  ${r.moves ? "CAN SAY OTHERWISE" : "NEVER OBSERVED TO MOVE"}  ${r.row}`)
    console.log(`        here      ${r.here}`)
    console.log(`        control   ${r.elsewhere}   [${r.how}]`)
  }

  /* ---- THE VERDICT PER CHANNEL, from the PAIR --------------------------- */
  const byChannel = {}
  for (const r of sweep.rows) {
    if (!r.channel) continue
    byChannel[r.channel] ??= {}
    byChannel[r.channel][r.dir] = r
  }
  const NOISE = legacy.rows.find((r) => r.name.startsWith("shipped (repeat"))?.changed ?? 0
  console.log(`\n--- PER-CHANNEL VERDICT (noise floor from the repeat baseline: ${NOISE} px) ---`)
  const verdicts = []
  const CHANNEL_KEYS = [...CHANNELS.map((c) => c[0]), "color", "lit@ink0", "shadow@ink0", "jointBreak@depth1"]
  for (const k of CHANNEL_KEYS) {
    const lo = byChannel[k]?.lo
    const hi = byChannel[k]?.hi
    const loM = (lo?.changed ?? 0) > NOISE
    const hiM = (hi?.changed ?? 0) > NOISE
    /* THE PAIR DIFF — the reading that cannot be faked by a partner key. */
    const fLo = sweep.frames.get(`${k}/lo`)
    const fHi = sweep.frames.get(`${k}/hi`)
    const pair = fLo && fHi ? diffOf(fLo, fHi) : null
    const pairM = (pair ?? 0) > NOISE
    const verdict = !pairM
      ? "INERT on this surface — the two directions are the SAME PICTURE"
      : loM && hiM
        ? "LIVE (both directions move the shipped frame)"
        : "LIVE — but one arm asked for the state it was already in"
    verdicts.push({ channel: k, lo: lo?.changed ?? null, hi: hi?.changed ?? null, pair, loMoved: loM, hiMoved: hiM, verdict })
    console.log(
      `  ${k.padEnd(18)} lo ${String(lo?.changed ?? "—").padStart(8)}   hi ${String(hi?.changed ?? "—").padStart(8)}   lo-vs-hi ${String(pair ?? "—").padStart(8)}   ${verdict}`,
    )
  }

  const glShort = logs.filter((l) => l.text.includes("not big enough")).length
  const errs = logs.filter((l) => l.type === "error" || l.type === "pageerror").length
  console.log(`\nGL "not big enough": ${glShort} · console errors: ${errs}`)
  writeFileSync(
    join(OUT, "ofat.json"),
    JSON.stringify(
      {
        label: LABEL,
        surface: SURFACE,
        elevation: EL,
        at: SURFACE === "draw96" ? AT : null,
        parkedAt,
        state,
        wobbleOk,
        endpointOk,
        grab,
        stageCount,
        noiseFloor: NOISE,
        legacy: legacy.rows,
        validator,
        sweep: sweep.rows,
        verdicts,
        readings,
        census: { here: censusHere, elsewhere: censusElsewhere, moved: censusMoved },
        glShort,
        errs,
      },
      null,
      2,
    ),
  )
  console.log(join(OUT, "ofat.json"))
  await context.close()
  await browser.close()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
