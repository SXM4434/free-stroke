// EVERY `FlatState` CHANNEL ACTUALLY RENDERS — driven, not read.
//
// WHY THIS EXISTS. This beat has now produced the same defect three times: a
// parameter that is declared, defaulted, documented and read by NOTHING that
// renders. `pushScaleEnd` (storyboard §10.2 C2). `squashX` / `squashY` — all
// four anticipation frames measured identical to the digit with the breath
// frames, because the only reference to the name anywhere was a readout
// printing it as text. And `shade`, which reached the flat register through
// `emissive` and therefore did nothing at all once the form was lit.
//
// A comment saying a channel is wired is not evidence. So each row below DRIVES
// the channel on the live page and asserts the rendered pixels move — and each
// carries its own negative control, either an identity value that must NOT move
// the render or the opposite end of the same channel. A row whose control also
// "passes" is measuring nothing and is reported as blind.
//
// The driving hook is `__captureHarness.setFlatten(...)`, a dev-only override
// merged inside the frame loop. It exists because adding a `FlatState` field
// and passing it from the host are two different files: the assertion cannot
// wait on the second one, or the wiring ships unproven exactly as it did before.
//
// Usage: node scripts/verify/assert-hero-flatstate.mjs
import { chromium } from "./lib/browser.mjs"
import { flatInterior } from "./lib/flat-interior.mjs"
import { gapRegions } from "./lib/joint-break-gaps.mjs"
import { createRequire } from "node:module"
import { HERO_URL } from "./lib/dev-server.mjs"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const INK_MAX = 150

let failures = 0
const record = (name, pass, detail) => {
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}`)
  console.log(`      ${detail}`)
  if (!pass) failures++
}

/** Ink bbox + interior mean + the tone of the band UNDER the mark (the pool). */
async function stats(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const W = img.width
  const H = img.height
  let n = 0
  let minX = 1e9
  let maxX = -1
  let minY = 1e9
  let maxY = -1
  let sum = 0
  for (let y = 0; y < H; y++)
    for (let px = 0; px < W; px++) {
      const i = (y * W + px) * 4
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
      if (l <= INK_MAX) {
        n++
        sum += l
        if (px < minX) minX = px
        if (px > maxX) maxX = px
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  // The pool: a band immediately below the ink, sampled on the PAPER (above the
  // ink threshold) so the shadow is read as a tone on the ground rather than as
  // more ink. Empty when there is no ink at all.
  let poolSum = 0
  let poolN = 0
  if (n) {
    const y0 = Math.min(H - 1, maxY + 2)
    const y1 = Math.min(H - 1, maxY + 60)
    for (let y = y0; y <= y1; y++)
      for (let px = minX; px <= maxX; px++) {
        const i = (y * W + px) * 4
        const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
        if (l > INK_MAX) {
          poolSum += l
          poolN++
        }
      }
  }
  return {
    n,
    w: n ? maxX - minX + 1 : 0,
    h: n ? maxY - minY + 1 : 0,
    cx: n ? (minX + maxX) / 2 : 0,
    /** The mark's CONTACT — what a bottom-pinned squash must leave alone. */
    bottom: n ? maxY : 0,
    mean: n ? sum / n : 0,
    pool: poolN ? poolSum / poolN : 0,
  }
}

/**
 * PIXELS THAT DIFFER — the reading `stats()` cannot give.
 *
 * `stats()` returns six DERIVED numbers, and two different pictures can agree on
 * all six: a mark that shifts a stroke without changing its bbox, its count or
 * its mean is a different picture with an identical row. The §0 control below
 * asserts that a REFUSED object sets NOTHING, and "nothing" there has to mean
 * *to the pixel* or the row is satisfiable by a change the statistic is blind
 * to — which is the whole family of defect this gate exists inside.
 */
async function differingPixels(a, b) {
  const [ia, ib] = await Promise.all([loadImage(a), loadImage(b)])
  if (ia.width !== ib.width || ia.height !== ib.height) return -1
  const ca = createCanvas(ia.width, ia.height)
  const cb = createCanvas(ib.width, ib.height)
  ca.getContext("2d").drawImage(ia, 0, 0)
  cb.getContext("2d").drawImage(ib, 0, 0)
  const da = ca.getContext("2d").getImageData(0, 0, ia.width, ia.height).data
  const db = cb.getContext("2d").getImageData(0, 0, ib.width, ib.height).data
  let n = 0
  for (let i = 0; i < da.length; i += 4) {
    if (
      Math.abs(da[i] - db[i]) > 3 ||
      Math.abs(da[i + 1] - db[i + 1]) > 3 ||
      Math.abs(da[i + 2] - db[i + 2]) > 3
    )
      n++
  }
  return n
}

async function main() {
  const browser = await chromium.launch()
  // >= 1440 in both axes: at 1440x900 an expanded timeline dock squeezes the
  // stage to half height and CLIPS the mark, which reads as missing ink.
  const context = await browser.newContext({ viewport: { width: 1440, height: 1440 } })
  const page = await context.newPage()
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 200))
  })
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 200)))

  /* ✅ COLLAPSED — 2026-08-03. Two lanes had independently added an override for
   * the same thing and this file honoured BOTH:
   *   process.env.HERO_URL ?? `http://localhost:${process.env.FS_PORT || 3000}/desk-doodles`
   * with a note here saying "collapse these to one. Two names for one knob is
   * how a control silently stops reaching the thing it names." There is one
   * name now — `FS_PORT`, the port, because HERO_URL and LAB_URL are two
   * SURFACES of one server and no single URL variable can be both. Resolved once
   * in `lib/dev-server.mjs`, which throws on a set legacy name rather than
   * ignoring it. The unset default is byte-identical. */
  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, {
    timeout: 90000,
  })
  await page.waitForTimeout(2500)

  const stage = page.locator("[data-hero-stage]")
  const shot = async () => {
    await page.waitForTimeout(180)
    return stage.screenshot()
  }
  const set = async (o) => {
    await page.evaluate((v) => window.__captureHarness.setFlatten(v), o)
    await page.waitForTimeout(120)
  }

  // Park the beat on the settled flat mark: the draw-in complete, dead-on, no
  // turn. Every row below moves exactly one channel off that state.
  //
  // ⚠ FOUND BY RUNNING IT, 2026-07-31: this used to be a hard-coded 3.00s and
  // that stopped being the settled flat mark. `lib/hero-motion.ts` belongs to
  // another lane and its beat durations are live dials; when `draw` lengthened
  // (timeline 9.83s -> 12.37s) 3.00s landed MID-DRAW, so the "parked" mark was a
  // partial word — ink 25 460 -> 16 946, width 612 -> 447 — whose visible centre
  // is not the geometry's. The squashX registration row then failed
  // (cx 477.0 -> 465.0) on a build that had not changed: `squashX` scales about
  // the MESH's x centre, which is the right pivot and is not the partial
  // silhouette's. A constant standing in for a phase boundary is a row that
  // reports on the beat's tempo instead of on the channel it names.
  //
  // So the park is DERIVED: walk the phase readout and take the last `breath`
  // frame, which is the settled flat mark immediately before the anticipation
  // whatever the beat is currently timed at.
  const parkT = await page.evaluate(() => {
    const el = document.querySelector("[data-hero-scrub]")
    return Number(el.max)
  })
  const scrubTo = async (v) => {
    await page.evaluate((t) => {
      const el = document.querySelector("[data-hero-scrub]")
      const set = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set
      set.call(el, String(t))
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }, v)
  }
  let holdT = null
  for (let t = 0.2; t < parkT; t += 0.25) {
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
  await scrubTo(holdT)
  await page.waitForTimeout(600)
  console.log(
    `(timeline ${parkT.toFixed(2)}s; parked at ${holdT.toFixed(2)}s — the last BREATH frame, ` +
      `i.e. the held flat mark, dead-on, derived not hard-coded)\n`,
  )

  await set(null)
  const basePng = await shot()
  const base = await stats(basePng)
  if (!base.n) {
    console.error("no ink in the parked frame — nothing to measure")
    process.exit(1)
  }
  console.log(
    `baseline: ink ${base.n} · w ${base.w} · h ${base.h} · cx ${base.cx.toFixed(1)} · mean ${base.mean.toFixed(1)} · pool ${base.pool.toFixed(1)}\n`,
  )

  /* ══════════════════════════════════════════════════════════════════════
   * 0 · THE NEGATIVE CONTROL ON `setFlatten` ITSELF
   *
   * WHY IT IS HERE AND NOT SOMEWHERE ELSE. Every row below this block drives
   * `__captureHarness.setFlatten`. For three days that function returned `true`
   * for ANY object handed to it, including a key that cannot exist — so an arm
   * that set nothing was indistinguishable from an arm that set something and
   * changed no pixels. That is not a hypothetical: it is how
   * `setFlatten({flat: 0, depth: 1})` became a published "not it" verdict about
   * "the flat-ink path" in explainer 24's ruled-out table, on a path it had
   * never touched. `flat` is not one of `FlatState`'s thirteen keys.
   * Explainer 24 §8 item 4 asks for the row; §9.6 records that it could not go
   * here because this was not that lane's file. It is this one's.
   *
   * ONE ROW WOULD BE UNFALSIFIABLE, AND THAT IS THE WHOLE LESSON. A validator
   * that returned `false` for EVERYTHING would pass a reject-only control
   * perfectly and silently break `color` (a string) and `letters` (an array) —
   * explainer 24 §8's *"widen an exemption, never the rule"* trap, running the
   * other way. So the accept arms are the ones that carry the weight, and the
   * known-bad is the parked prior rather than a synthetic mutant.
   *
   * 🔴 AND THE CALIBRATION ARM IS CHOSEN BY MEASUREMENT ON *THIS* SURFACE.
   * The first version of the equivalent row on `/` used `{depth: 1}` — the
   * retracted arm's own valid half — and failed on its first run, because that
   * host already renders at depth 1 (explainer 24 §9.3). The same trap is live
   * here in a different place: at this beat's parked BREATH frame, measured
   * 2026-08-07, `{ink: 1}` moves **0 px** and `{depth: 1}` moves **26 px** on a
   * 30 545 px mark. An inherited calibration arm would have read zero for the
   * right reason and been thrown away for the wrong one. **A channel's OFAT
   * verdict is a property of the surface it was taken on**, so the arm is
   * picked here and the two inherited candidates are asserted to be silent —
   * the day one of them starts moving, this row says so.
   * ══════════════════════════════════════════════════════════════════════ */
  const rawSet = async (o) => {
    const r = await page.evaluate((v) => window.__captureHarness.setFlatten(v), o)
    await page.waitForTimeout(120)
    return r
  }
  const IMPOSSIBLE = { __flatStateKeyThatCannotExist: 0 }

  /* THE NOISE FLOOR FIRST. "A refused object sets nothing" is measured as a
   * pixel count, and a pixel count only means something if two frames of the
   * SAME state are identical. If this surface breathes on its own — a rim
   * shimmer, an env rotation, a rAF-driven tween that the scrub does not pin —
   * then a zero below would be luck and a non-zero would be blamed on the
   * setter. Asserted, not assumed. */
  const base2Png = await shot()
  const noise = await differingPixels(basePng, base2Png)
  record(
    "CONTROL · the parked surface is STILL — two frames of one state are identical",
    noise === 0,
    `${noise} px differ between two baseline captures (needs 0). Every "moved N px" row below ` +
      `is read against this floor; a breathing surface would make all of them unreadable.`,
  )

  const bogus = await rawSet(IMPOSSIBLE)
  await set(null)
  record(
    "CONTROL · setFlatten({a key that cannot exist}) returns FALSE",
    bogus === false,
    `returned ${bogus} (needs false). This is explainer 24 §8 item 4. Before the validator ` +
      `landed it returned true, and that is how a row about "the flat-ink path" was published ` +
      `about a path nothing had touched.`,
  )

  /* Every OTHER way to be malformed, because one shape of wrongness proves one
   * shape of wrongness. Each is refused WHOLE — never a valid subset applied,
   * which is the half-applied arm nobody can attribute. */
  const MALFORMED = [
    ["the retracted row's own object", { flat: 0, depth: 1 }],
    ["a second impossible key beside a real one", { ink: 1, notAChannel: 3 }],
    ["a numeric channel set to NaN", { ink: Number.NaN }],
    ["a numeric channel set to Infinity", { squashY: Number.POSITIVE_INFINITY }],
    ["a numeric channel set to a string", { yaw: "25" }],
    ["a numeric channel set to null", { shade: null }],
    ["`color` set to a number", { color: 5 }],
    ["`letters` set to a number", { letters: 4 }],
    ["`letters` carrying a non-conforming entry", { letters: [{ x: 1, y: 2 }] }],
    ["`letters` entry with a non-finite member", { letters: [{ yaw: 0, flat: 0, depth: 0, shade: Number.NaN }] }],
    ["an ARRAY rather than an object", [1, 2, 3]],
  ]
  let refused = 0
  const notRefused = []
  for (const [why, o] of MALFORMED) {
    const r = await rawSet(o)
    if (r === false) refused++
    else notRefused.push(why)
    await set(null)
  }
  record(
    "  ...and every OTHER malformed object is refused too",
    refused === MALFORMED.length,
    `${refused}/${MALFORMED.length} refused${notRefused.length ? " — ACCEPTED: " + notRefused.join(" · ") : ""}. ` +
      `A validator that only knows one shape of wrong is a validator that has been tested once.`,
  )

  /* THE ACCEPT ARMS — the half that actually constrains the fix. `color` and
   * `letters` are in here because a blanket `typeof v === "number"` passes every
   * reject row above and breaks exactly these two. */
  const LEGAL = [
    ["null (the documented CLEAR contract)", null],
    ["ink", { ink: 1 }],
    ["depth", { depth: 1 }],
    ["color", { color: "#101010" }],
    ["yaw", { yaw: 0 }],
    ["pitch", { pitch: 0 }],
    ["shade", { shade: 0 }],
    ["shadow", { shadow: 0 }],
    ["squashX", { squashX: 1 }],
    ["squashY", { squashY: 1 }],
    ["jointBreak", { jointBreak: 0 }],
    ["penCarve", { penCarve: 1 }],
    ["lit", { lit: 0 }],
    ["letters (an empty list)", { letters: [] }],
    ["letters (a conforming entry)", { letters: [{ yaw: 0, flat: 1, depth: 0.004, shade: 0 }] }],
    ["letters (a conforming entry with the optional `settle`)", { letters: [{ yaw: 0, flat: 1, depth: 0.004, shade: 0, settle: 0.5 }] }],
    ["all THIRTEEN at once", { ink: 1, depth: 1, color: "#101010", yaw: 0, pitch: 0, shade: 0, shadow: 0, squashX: 1, squashY: 1, jointBreak: 0, penCarve: 1, lit: 0, letters: [] }],
  ]
  let accepted = 0
  const rejectedLegal = []
  for (const [why, o] of LEGAL) {
    const r = await rawSet(o)
    if (r === true) accepted++
    else rejectedLegal.push(why)
    await set(null)
  }
  record(
    "  ...and it still ACCEPTS all THIRTEEN real keys, plus null",
    accepted === LEGAL.length,
    `${accepted}/${LEGAL.length} accepted${rejectedLegal.length ? " — REFUSED: " + rejectedLegal.join(" · ") : ""}. ` +
      `This is the row that matters: a blanket \`typeof v === "number"\` passes every reject ` +
      `row above and silently kills \`color\` and \`letters\`.`,
  )

  /* A REFUSED OBJECT SETS NOTHING — to the pixel, not to the statistic. */
  await rawSet(IMPOSSIBLE)
  const refusedPng = await shot()
  await set(null)
  const refusedMoved = await differingPixels(basePng, refusedPng)
  record(
    "  ...a REFUSED object sets NOTHING — unchanged to the pixel",
    refusedMoved <= noise,
    `${refusedMoved} px differ from the baseline (needs <= the measured noise floor, ${noise}). ` +
      `Read as PIXELS rather than as bbox/mean, because two different pictures can agree on ` +
      `every derived number.`,
  )

  /* CALIBRATION — and it is picked HERE, not inherited. */
  await set({ squashY: 0.85, squashX: 1 })
  const calPng = await shot()
  await set(null)
  const calMoved = await differingPixels(basePng, calPng)
  await set({ ink: 1 })
  const inkOnePng = await shot()
  await set(null)
  const inkOneMoved = await differingPixels(basePng, inkOnePng)
  await set({ depth: 1 })
  const depthOnePng = await shot()
  await set(null)
  const depthOneMoved = await differingPixels(basePng, depthOnePng)
  record(
    "  ...CALIBRATED — the same comparison SEES a legal arm",
    calMoved >= 2000,
    `{squashY: 0.85} moves ${calMoved} px (needs >= 2000). Without this the row above is ` +
      `satisfied by a comparison that cannot see anything at all.`,
  )
  record(
    "  ...and the calibration arm was CHOSEN ON THIS SURFACE, not inherited",
    inkOneMoved < 200 && depthOneMoved < 200 && calMoved >= 2000,
    `on THIS pose {ink: 1} moves ${inkOneMoved} px and {depth: 1} moves ${depthOneMoved} px ` +
      `(both need < 200) while {squashY: 0.85} moves ${calMoved}. Those two are the arms an ` +
      `outside table would reach for — explainer 24 §9.3 used {depth: 1} on \`/\` for exactly ` +
      `the reason §8 recommends it, and it read 0 because the host was already there. A ` +
      `channel's OFAT verdict is a property of the SURFACE. If this row ever goes red the ` +
      `host's defaults have moved and the calibration needs re-picking, which is the point.`,
  )

  /* ---- THE KNOWN-BAD IS THE PARKED PRIOR, ARMED ON THE BARE INVOCATION ----
   * `setFlattenValidates(false)` restores the setter that shipped — `return
   * true` for anything. Not a synthetic mutant, and not behind a flag no sweep
   * passes (explainer 31 §1: "the machinery that proves this repo's instruments
   * can fail is the machinery no sweep runs"). Armed inline, measured, disarmed.
   *
   * The object is `{flat: 0, squashY: 0.85}` and the shape is the historical
   * defect exactly: a key that cannot exist beside a valid one that MOVES THE
   * MARK on this surface. Armed, it returns `true` and moves the picture — an
   * arm that set nothing it was asked about and published a verdict anyway. */
  const armed = await page.evaluate(() => window.__captureHarness.setFlattenValidates(false))
  const armedReads = await page.evaluate(() => window.__captureHarness.flattenValidates())
  record(
    "the setFlatten known-bad ACTUALLY TOOK",
    armed === true && armedReads === false,
    `setFlattenValidates(false) returned ${armed} and the getter now reads ${armedReads} ` +
      `(needs true / false). An arm that did not arm grades nothing.`,
  )
  const kbBogus = await rawSet(IMPOSSIBLE)
  await set(null)
  const kbRetracted = await rawSet({ flat: 0, squashY: 0.85 })
  const kbPng = await shot()
  await set(null)
  const kbMoved = await differingPixels(basePng, kbPng)
  record(
    "  ...and the KNOWN-BAD REPRODUCES THE DEFECT",
    kbBogus === true && kbRetracted === true && kbMoved >= 2000,
    `armed: an impossible key returns ${kbBogus}, and {flat: 0, squashY: 0.85} returns ` +
      `${kbRetracted} while moving ${kbMoved} px (needs true / true / >= 2000). That is the ` +
      `retracted row of explainer 24's table, exactly: an arm that set nothing it was asked ` +
      `about, moved the mark, and published "not it".`,
  )
  const disarmed = await page.evaluate(() => window.__captureHarness.setFlattenValidates(true))
  const disarmedReads = await page.evaluate(() => window.__captureHarness.flattenValidates())
  const reBogus = await rawSet(IMPOSSIBLE)
  await set(null)
  record(
    "  ...and the known-bad was DISARMED",
    disarmed === true && disarmedReads === true && reBogus === false,
    `setFlattenValidates(true) returned ${disarmed}, the getter reads ${disarmedReads}, and ` +
      `the impossible key is refused again (${reBogus}). Every row below runs on the SHIPPED ` +
      `setter, and this is the evidence rather than the assumption.`,
  )
  console.log("")

  /* ---- 1. squashY renders, and identity does not ------------------------ */
  await set({ squashY: 0.85, squashX: 1 })
  const sqY = await stats(await shot())
  await set({ squashY: 1, squashX: 1 })
  const sqIdentity = await stats(await shot())
  const dH = base.h - sqY.h
  record(
    "squashY RENDERS — the mark compresses",
    dH >= 8,
    `h ${base.h} -> ${sqY.h} (${dH} px shorter at squashY 0.85; needs >= 8). ` +
      `Predicted 0.15 x ${base.h} = ${(base.h * 0.15).toFixed(0)} px`,
  )
  record(
    "  ...and its CONTROL is blind to nothing — squash 1 is identical to no squash",
    sqIdentity.h === base.h && sqIdentity.w === base.w,
    `identity h ${sqIdentity.h} vs ${base.h}, w ${sqIdentity.w} vs ${base.w} (must be equal, or the row above is measuring the override and not the squash)`,
  )

  /* ---- 2. it is pinned at the CONTACT, not the centre -------------------- */
  // A squash about the bbox centre lifts the contact by HALF the compression;
  // a squash about the contact leaves it exactly where it was. That is the
  // difference between weight and a scale, and it is measurable to the pixel:
  // at squashY 0.85 on a mark this tall, a centre-pinned squash would raise the
  // bottom by ~h*0.075, which is far outside the tolerance below.
  const centrePinnedLift = (base.h * 0.15) / 2
  record(
    "squashY is pinned at the CONTACT — the mark's bottom does not move",
    Math.abs(sqY.bottom - base.bottom) <= 2,
    `bottom ${base.bottom} -> ${sqY.bottom} (needs <= 2 px). A centre-pinned squash ` +
      `would have lifted it by ~${centrePinnedLift.toFixed(0)} px, so this row can fail.`,
  )

  /* ---- 3. squashX renders ------------------------------------------------ */
  await set({ squashX: 1.15, squashY: 1 })
  const sqX = await stats(await shot())
  const dW = sqX.w - base.w
  record(
    "squashX RENDERS — the mark widens",
    dW >= 8,
    `w ${base.w} -> ${sqX.w} (+${dW} px at squashX 1.15; needs >= 8). ` +
      `Predicted 0.15 x ${base.w} = ${(base.w * 0.15).toFixed(0)} px`,
  )
  record(
    "  ...and widening does NOT move the registration",
    Math.abs(sqX.cx - base.cx) < 2,
    `cx ${base.cx.toFixed(1)} -> ${sqX.cx.toFixed(1)} (needs < 2 px — x scales about the mark's own centre)`,
  )

  /* ---- 4. shade darkens the LIT form ------------------------------------ */
  // The defect this catches: `shade` reached the flat register through
  // `emissive`, which is zero once the form is lit, so past the edge of the turn
  // the falloff did nothing. Drive it with ink 0 — the solid half.
  await set({ ink: 0, depth: 1, shade: 0, squashX: 1, squashY: 1 })
  const litPlain = await stats(await shot())
  await set({ ink: 0, depth: 1, shade: 0.35, squashX: 1, squashY: 1 })
  const litShaded = await stats(await shot())
  record(
    "shade DARKENS THE LIT FORM, not only the flat ink",
    litPlain.mean - litShaded.mean >= 2,
    `ink mean ${litPlain.mean.toFixed(1)} -> ${litShaded.mean.toFixed(1)} at shade 0.35 ` +
      `(needs a drop >= 2). Before this was wired the two were identical, because ` +
      `the falloff only ever reached \`emissive\`.`,
  )

  /* ---- 5. the shadow has its own channel -------------------------------- */
  // MEASURED FROM ABOVE, AND THAT IS ITSELF A FINDING. The pool is a HORIZONTAL
  // plane at the mark's own contact, so at the beat's parked elevation (el 0,
  // the camera level with the mark) it is seen edge-on and contributes nothing:
  // driven from 0 to 1 dead-on it moves the ground tone by 0.00. So the channel
  // is exercised at the elevation where a contact pool is a cue at all, and the
  // dead-on reading is kept below as the measurement that says WHERE the beat's
  // shadow landing can and cannot be seen.
  const poolAt = async (o) => {
    await set(o)
    return stats(await shot())
  }
  const flatNo = await poolAt({ ink: 0, depth: 1, shadow: 0, squashX: 1, squashY: 1 })
  const flatFull = await poolAt({ ink: 0, depth: 1, shadow: 1, squashX: 1, squashY: 1 })

  await page.evaluate(() => window.__captureHarness.orbitView(0, 35, 1))
  await page.waitForTimeout(200)
  const noPool = await poolAt({ ink: 0, depth: 1, shadow: 0, squashX: 1, squashY: 1 })
  const fullPool = await poolAt({ ink: 0, depth: 1, shadow: 1, squashX: 1, squashY: 1 })
  const poolDelta = noPool.pool - fullPool.pool
  record(
    "shadow is its OWN channel — the pool answers to it, not to ink",
    poolDelta >= 1,
    `at el 35, ground tone under the mark ${noPool.pool.toFixed(2)} -> ${fullPool.pool.toFixed(2)} ` +
      `(darker by ${poolDelta.toFixed(2)}; needs >= 1). Both frames hold ink 0, so ` +
      `nothing about the mark itself changed between them.`,
  )
  // The control that matters: with `ink` pinned at 1, the OLD derived law
  // (`1 - ink`) removes the pool entirely. If the pool survives at `ink: 1`,
  // it is following `shadow`.
  const inkedPool = await poolAt({ ink: 1, depth: 1, shadow: 1, squashX: 1, squashY: 1 })
  record(
    "  ...and it OVERRIDES the derived `1 - ink` law",
    Math.abs(inkedPool.pool - fullPool.pool) < 1 && poolDelta >= 1,
    `pool ${fullPool.pool.toFixed(2)} at ink 0 vs ${inkedPool.pool.toFixed(2)} at ink 1, ` +
      `both at shadow 1 (needs < 1 apart AND the row above firing — under the old law ` +
      `ink 1 would have removed the pool entirely)`,
  )
  record(
    "  ...and DEAD-ON THE POOL IS INVISIBLE — reported, not asserted away",
    Math.abs(flatNo.pool - flatFull.pool) < 0.05,
    `at el 0, shadow 0 -> 1 moves the ground tone ${flatNo.pool.toFixed(2)} -> ${flatFull.pool.toFixed(2)}. ` +
      `A contact pool is a horizontal plane; at the beat's parked elevation it is edge-on. ` +
      `Whatever the shadow's landing is worth, it is not worth anything until the camera ` +
      `leaves el 0 — which the tilt does 0.26s later.`,
  )
  await page.evaluate(() => window.__captureHarness.orbitView(0, 0, 1))

  /* ---- 6. jointBreak opens PAPER at the junctions ------------------------ */
  // K7's news. The channel this file exists to keep honest: `lib/hero-motion.ts`
  // has computed `jointBreak` since the return turn landed, and until the render
  // consumer went in there was nothing on screen that answered to it — the same
  // shape as `squashX`/`squashY` above and as the storyboard's dead
  // `pushScaleEnd`. It is an OCCLUSION, so the row is written as an ink COUNT
  // rather than as a value: ink may only be removed.
  const flatPose = { ink: 1, depth: 0.004, yaw: 0, shade: 0, shadow: 0, squashX: 1, squashY: 1 }
  await set({ ...flatPose, jointBreak: 0 })
  const jbOffPng = await shot()
  const jbOff = await stats(jbOffPng)
  await set({ ...flatPose, jointBreak: 1 })
  const jbOnPng = await shot()
  const jbOn = await stats(jbOnPng)
  const jbLost = jbOff.n - jbOn.n
  /* ── 🔴 THIS ROW USED TO READ `jbLost >= 200` (corrected 2026-09-04) ────────
   *
   * 200 IS THIS FILE'S OWN NOISE FLOOR, and it was being used as the signal bar.
   * Six rows above, `{ink: 1}` moving 0 px and `{depth: 1}` moving 29 px are
   * accepted as NOT MOVING under `< 200`, while the calibration arm has to clear
   * 2000. A channel whose true effect is 172 px cannot be told from noise by an
   * instrument that calls 200 px noise — so this row was asking `jointBreak` to
   * be a thousand times its own size.
   *
   * AND 200 SAT ABOVE THE CEILING. `buildJointBreaks` in lib/flat-ink.ts has
   * said so since 2026-08-01: the break table predicts 188 px in total at the
   * shipped junction set and the render delivers 172, which
   * `assert-hero-k7-news.mjs`'s model row PASSES at ratio 0.92. This row, its
   * sibling below, and the same claim in two other gates had been red for a
   * month on a floor no correct render could reach.
   *
   * WHAT REPLACES IT IS NOT A SMALLER NUMBER. The claim is now about SHAPE: the
   * removed ink has to form separate regions of paper — the hairlines the row's
   * own title names — and not a scatter. On this pose it opens 3 gaps of 74, 52
   * and 46 px, each about 12 px across the stroke and 6-8 px along it, and all
   * three were rendered at 8x and looked at (docs/verification/hero-k7/gaps/).
   * How BIG each one should be is judged where the break table is available:
   * `assert-hero-k7-news.mjs` grades each gap against its own junction's `cut`.
   * This file's job is the narrower one it has always had — the channel is not
   * inert — and it now answers that with the same statistic the sibling uses
   * rather than with a second one. scripts/verify/lib/joint-break-gaps.mjs. */
  const jbGaps = await gapRegions(jbOffPng, jbOnPng)
  record(
    "jointBreak RENDERS — the junctions open a hairline of paper",
    jbGaps.refused === null && jbGaps.regions.length > 0 && jbLost > 0,
    jbGaps.refused
      ? `REFUSED — ${jbGaps.refused}`
      : `ink ${jbOff.n} -> ${jbOn.n} px (${jbLost} px of ink became paper) as ` +
        `${jbGaps.regions.length} separate region(s) of paper — ` +
        jbGaps.regions.map((r) => `${r.area}px ${r.w}x${r.h}`).join(" · ") +
        ` — plus ${jbGaps.crumbs} crumb(s) (${jbGaps.crumbPx} px). Needs at least one region and ` +
        `some ink gone; a scatter of antialiasing specks is crumbs and is counted, not merged. ` +
        `The break set comes from the page's own \`window.__heroJunctions\`; HOW BIG each gap ` +
        `should be is judged against the break table by scripts/verify/assert-hero-k7-news.mjs.`,
  )
  record(
    "  ...and its CONTROL is blind to nothing — 0 is identical to no channel at all",
    Math.abs(jbOff.n - base.n) < 40 && jbGaps.regions.length > 0,
    `jointBreak 0 reads ${jbOff.n} px against ${base.n} with no override (needs < 40 apart, ` +
      `and the row above firing). Without this the row above could be measuring the override ` +
      `rather than the break.`,
  )
  // MEASURED ON THE ERODED INTERIOR, not on the whole mask — and that
  // correction came from running it. Opening a gap creates NEW antialiased
  // boundary, and boundary pixels are lighter than the ink by construction, so
  // a whole-mask mean rises (26.76 -> 27.83) on a change that re-valued nothing.
  // The statistic was reading the edge and calling it a wash, which is the same
  // mistake gate 1's own `ERODE` exists to fix.
  const jbOffI = await flatInterior(jbOffPng)
  const jbOnI = await flatInterior(jbOnPng)
  /* The sd here is the TRIMMED one, for the reason `FLAT_TRIM` states in
   * lib/flat-interior.mjs: with the pen carve driven, this pose's interior
   * carries three COVERAGE pixels at the tip of a hairline gap the carve
   * correctly opens, and an isotropic erosion cannot reach a sub-pixel concave
   * notch. The mean clause is untouched — a wash moves the mean and a gap does
   * not, and that half of the row was never in question. */
  record(
    "  ...and it TAKES ink away rather than re-valuing it",
    Math.abs(jbOnI.mean - jbOffI.mean) < 0.5 &&
      jbOnI.sdTrim < 1 &&
      jbOnI.residue <= jbOnI.residueMax,
    `interior mean ${jbOffI.mean.toFixed(2)} -> ${jbOnI.mean.toFixed(2)} over ` +
      `${jbOffI.n} -> ${jbOnI.n} px, trimmed interior sd ${jbOnI.sdTrim.toFixed(3)}, residue ` +
      `${(100 * jbOnI.residue).toFixed(4)} % (needs mean within 0.5, sd < 1 and residue <= ` +
      `${(100 * jbOnI.residueMax).toFixed(2)} % — gate 1's own thresholds). [raw, not the verdict] ` +
      `sd ${jbOnI.sd.toFixed(3)}. A gap leaves every surviving ink pixel at exactly one value; ` +
      `a wash would move both.`,
  )

  await set(null)
  record("console clean", errors.length === 0, `${errors.length} errors${errors.length ? ": " + errors[0] : ""}`)

  await browser.close()
  console.log(`\n${failures === 0 ? "all rows passed" : `${failures} FAILED`}`)
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
