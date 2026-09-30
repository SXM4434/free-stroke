// DOES "MOTION MODE: OFF (STATIC)" ACTUALLY MAKE THE STYLE STACK STATIC?
//
// ── WHY THIS EXISTS ────────────────────────────────────────────────────────
// `MotionMode`'s own doc in lib/style-system.ts says it is "the single clear
// control the user sees today. Every renderer resolves the two together through
// `resolveSyncMode`", and the panel labels the value "Off (static)"
// (components/style-panel-scaffold.tsx:2285).
//
// The layer STACK's group animation does not go through `resolveSyncMode`. Its
// `enabled` was `!reduceMotion && layerStackEnabled && stackAnimationEnabled` —
// the media query reached it, the user's own switch did not. `motionMode` does
// not appear anywhere in lib/style-stack.ts.
//
// This is reachable on a FRESH page, not in some corner: `DEFAULT_STYLE_STATE`
// ships `motionMode: "off"` (lib/style-system.ts:574), and NOT ONE of the twelve
// `stackAnimation` presets writes `motionMode` in its `applies` patch. So the
// user picks "Stack Drift" from the rail and the group slides while the only
// motion control they have is reading Off.
//
// viewport-3d.tsx's own comment above the local `motionMode` says the point of
// resolving it in one place is that a rail "cannot be honoured on two rails and
// forgotten on the third". The stack was the forgotten rail.
//
// ── THE INSTRUMENT ─────────────────────────────────────────────────────────
// `STYLE_CLOCK_DEBUG.groupOffset` is the group's shared time offset, published
// by the frame loop and read here through `window.__geomDebug.styleClock()`.
// It is the number the dither direction fallback and the ASCII scroll fallback
// both branch on, so it is the thing that actually decides whether the stack
// moves — not a pixel guess.
//
// ── THE NEGATIVE CONTROL, WHICH IS THE WHOLE POINT ─────────────────────────
// Every "must be still" row is paired with the SAME behaviour under
// `motionMode: "independent"`, which MUST move. A stillness assertion with no
// moving arm cannot tell "the control works" from "the stack is broken and
// nothing animates at all" — that is the green-row-that-cannot-fail this repo
// has shipped eleven times.
//
// ── ⚠ AND THE GATE TESTED HALF THE RAIL, UNDER A COMMENT THAT SAID IT DID NOT
//      HAVE TO (found and repaired 2026-08-03) ────────────────────────────────
// The two loops were written out by hand as `["drift","loop"]` and
// `["fadeIn","pulse"]`, over this justification:
//
//     // `drift` and `loop` are the two behaviours that PRODUCE an offset (see
//     // lib/style-stack.ts). They are the only ones this channel can see…
//
// That sentence is FALSE, and lib/style-stack.ts says so in its own margin:
// `case "revealSynced"` (:276-289) returns
// `timeOffset: r * DEFAULT_REVEAL_SCALE * mag * dir + phase` — a third
// offset-producing behaviour, and the comment three lines above that case
// exists specifically to correct an earlier draft that had put it on the wrong
// side. The amplitude loop was worse: `delayAfterReveal` (:292),
// `completionPulse` (:308) and `revealSynced` all return a moving `amount`, so
// two of five. And `freezeOnComplete` (:321) drives a THIRD published channel,
// `STYLE_CLOCK_DEBUG.groupFrozen`, which this file never read at all.
//
// Four of `StackAnimationType`'s eight non-`none` values were exercised. THE
// INPUT THAT SHOULD HAVE FAILED AND COULD NOT: `stackAnimationType:
// "revealSynced"` with `motionMode: "off"` — one click on the rail from a fresh
// page, and the exact "forgotten rail" this file was written for.
//
// THE REPAIR, AND WHY IT IS A DERIVATION RATHER THAN A LONGER LIST. The
// behaviour set is read out of `lib/style-stack.ts`'s own union, cross-checked
// against `StackAnimationType` in lib/style-system.ts (the panel's type), and
// each behaviour is CLASSIFIED by RUNNING the real `evaluateStackAnimation`
// over a sweep in node and recording which of the three published channels it
// moves. A behaviour added to the union is therefore asserted here the moment it
// exists, and it is asserted on the channels it actually drives rather than the
// ones somebody assumed. The browser rows then assert the product claim
// directly: `motionMode: "off"` must hold the group at EXACTLY neutral —
// offset 0, amount 1, not frozen — for every behaviour, and "independent" must
// leave neutral in the channels the source says it should.
//
// ── AND THE SAMPLER NOW MOVES A DIAL ───────────────────────────────────────
// The old sampler loaded the page, set a style, and read fourteen samples of a
// wall clock. Four of the eight behaviours are keyed to the REVEAL, not to wall
// time (`revealSynced`, `freezeOnComplete`, `delayAfterReveal`,
// `completionPulse`), and at a playhead parked at 1 three of those four sit at
// a constant — so a wall-clock-only sampler could not have seen them move even
// if it had named them. Every sample now scrubs the reveal, which is both what
// makes those four legible and the thing this battery was not doing anywhere.
//
// ── THE KNOWN-BAD, RUNNABLE ────────────────────────────────────────────────
// `--mutate=norail` drives the "off" arm with `motionMode: "independent"`,
// which is exactly what the pre-fix build did: `stackAnimOn` did not mention
// `motionMode`, so picking Off and picking Independent produced the identical
// group animation. Every "Off holds the group at NEUTRAL" row must go red on
// it — INCLUDING `revealSynced`, which is the input the hand-written lists
// could not fail on because they never named it.
//
//   node scripts/verify/assert-motion-off.mjs --mutate=norail    (must FAIL)
//
// Run: node scripts/verify/_run-clean.mjs scripts/verify/assert-motion-off.mjs
import { chromium } from "./lib/browser.mjs"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { loadTs } from "./_ts-load.mjs"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { LAB_URL } from "./lib/dev-server.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const { evaluateStackAnimation } = loadTs("lib/style-stack.ts")

/* The members of a string-union declaration, tolerant of the comment blocks
 * that sit BETWEEN members — `StackAnimationType` carries a seventeen-line note
 * between "loop" and "revealSynced", and a parser that stops at the first
 * non-`|` line would have reproduced the very omission this repairs. */
const unionMembers = (file, name) => {
  const lines = readFileSync(join(ROOT, file), "utf8").split("\n")
  const at = lines.findIndex((l) => l.startsWith(`export type ${name} =`))
  if (at < 0) throw new Error(`assert-motion-off: no type ${name} in ${file}`)
  const out = []
  for (let i = at; i < lines.length; i++) {
    const t = lines[i].trim()
    const continuation =
      i === at || t === "" || t.startsWith("|") || t.startsWith("/*") || t.startsWith("*") || t.startsWith("//")
    if (!continuation) break
    const m = t.match(/^\|\s*"([^"]+)"/)
    if (m) out.push(m[1])
  }
  return out
}

const MUTATE = (process.argv.find((a) => a.startsWith("--mutate=")) || "").split("=")[1] || ""
const NORAIL = MUTATE === "norail"
if (NORAIL) console.log(`\n[mutate=norail] the "off" arm is driven as "independent" — every Off row MUST go red\n`)

const BEHAVIOUR_UNION = unionMembers("lib/style-stack.ts", "StackAnimationBehaviour")
const PANEL_UNION = unionMembers("lib/style-system.ts", "StackAnimationType")
const BEHAVIOURS = BEHAVIOUR_UNION.filter((b) => b !== "none")

/**
 * WHICH CHANNELS DOES THIS BEHAVIOUR DRIVE? Answered by running the shipped
 * evaluator, not by reading it. The sweep walks `sinceArmed`, `reveal` and
 * `sinceCompletion` together so a behaviour keyed to any of the three is seen.
 */
function channelsOf(behaviour) {
  let offset = false
  let amount = false
  let frozen = false
  for (let i = 0; i < 40; i++) {
    const s = evaluateStackAnimation({
      enabled: true,
      behaviour,
      speed: 1.2,
      phase: 0,
      sinceArmed: i * 0.1,
      reveal: i / 39,
      sinceCompletion: i > 25 ? (i - 25) * 0.1 : Infinity,
      loopSeconds: 4,
    })
    if (Math.abs(s.timeOffset) > 1e-9) offset = true
    if (Math.abs(s.amount - 1) > 1e-9) amount = true
    if (s.frozen) frozen = true
  }
  return { offset, amount, frozen }
}
const CHANNELS = Object.fromEntries(BEHAVIOURS.map((b) => [b, channelsOf(b)]))

let failures = 0
const check = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `   [${detail}]` : ""}`)
  if (!ok) failures++
}

const line = () => {
  const a = [], b = []
  for (let i = 0; i <= 90; i++) {
    const t = i / 90
    a.push({ x: 140 + t * 620, y: 250 + t * 190 })
    b.push({ x: 140 + t * 620, y: 470 - t * 190 })
  }
  return [a, b]
}

/**
 * Sample all THREE published group channels while SCRUBBING THE REVEAL.
 *
 * The behaviour is re-armed first (leave it, come back), so a fade that already
 * finished during a previous row is not read as "still" — and the reveal is
 * driven back to 0 and walked to 1 inside the sample window, so the four
 * reveal-keyed behaviours have somewhere to move. Departure from NEUTRAL is
 * what is reported, not travel: `revealSynced` at a parked playhead is a
 * constant, non-zero offset, which "span" cannot see and "off must be neutral"
 * can.
 */
async function travel(page, patch) {
  await page.evaluate(() => window.__styleHarness.setStyle({ stackAnimationType: "none" }))
  await page.waitForTimeout(150)
  await page.evaluate((p) => window.__styleHarness.setStyle(p), patch)
  await page.evaluate(() => window.__revealHarness.setProgress(0))
  await page.waitForTimeout(350)
  const samples = []
  for (let i = 0; i < 16; i++) {
    await page.evaluate((v) => window.__revealHarness.setProgress(v), Math.min(1, i / 11))
    await page.waitForTimeout(90)
    samples.push(await page.evaluate(() => window.__geomDebug.styleClock()))
  }
  const offs = samples.map((s) => s.groupOffset)
  const amts = samples.map((s) => s.groupAmount)
  const frozens = samples.map((s) => !!s.groupFrozen)
  return {
    // DEPARTURE FROM NEUTRAL, per channel. Neutral is (0, 1, false).
    offDev: Math.max(...offs.map(Math.abs)),
    amtDev: Math.max(...amts.map((a) => Math.abs(a - 1))),
    frozenEver: frozens.some(Boolean),
    // Travel, kept because drift and loop are still best described by it.
    offSpan: Math.max(...offs) - Math.min(...offs),
    amtSpan: Math.max(...amts) - Math.min(...amts),
    first: offs[0],
    last: offs[offs.length - 1],
  }
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 1500 } })
await page.goto(LAB_URL, { waitUntil: "networkidle" })
await page.waitForFunction(() => window.__styleHarness && window.__geomDebug, null, { timeout: 60000 })
await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 10 }), line())
await page.waitForTimeout(900)
await page.evaluate(() => window.__revealHarness.setProgress(1))
await page.waitForTimeout(400)

/* THE DEFAULT IS THE CASE. Confirmed off the running app rather than read off
 * the constant, because what ships is what the app resolves, not what a literal
 * in a file says. */
const shipped = await page.evaluate(() => window.__styleHarness.get().styleState.motionMode)
console.log(`\nSHIPPED DEFAULT  motionMode = ${JSON.stringify(shipped)}\n`)
check("the default motion mode really is Off", shipped === "off", shipped)

/* THE INVENTORY IS ASSERTED BEFORE IT IS USED. Two files declare this rail —
 * the evaluator's `StackAnimationBehaviour` and the panel's
 * `StackAnimationType` — and a value in one and not the other is a rail the
 * user can pick and the engine cannot answer, or the reverse. */
console.log("\nTHE RAIL, READ OUT OF THE SOURCE\n")
console.log(`  StackAnimationBehaviour (lib/style-stack.ts)  ${BEHAVIOUR_UNION.length}: ${BEHAVIOUR_UNION.join(", ")}`)
console.log(`  StackAnimationType      (lib/style-system.ts) ${PANEL_UNION.length}: ${PANEL_UNION.join(", ")}`)
check(
  "the evaluator's behaviours and the panel's types are the same set",
  BEHAVIOUR_UNION.slice().sort().join("|") === PANEL_UNION.slice().sort().join("|"),
  `${BEHAVIOUR_UNION.length} vs ${PANEL_UNION.length}`,
)
// PARKED — what this file used to sweep: ["drift","loop"] on the offset channel
// and ["fadeIn","pulse"] on the amplitude channel. Four of eight, and the
// `frozen` channel was never read.
check(
  "every non-`none` behaviour is swept, not the four the hand-written lists named",
  BEHAVIOURS.length >= 8,
  `${BEHAVIOURS.length} behaviours`,
)
console.log("\n  behaviour           channels it drives (measured by running evaluateStackAnimation)")
for (const b of BEHAVIOURS) {
  const c = CHANNELS[b]
  console.log(
    `  ${b.padEnd(18)}  offset ${c.offset ? "YES" : "no "}   amount ${c.amount ? "YES" : "no "}   frozen ${c.frozen ? "YES" : "no "}`,
  )
}
check(
  "every behaviour drives at least one published channel — none is a dead rail entry",
  BEHAVIOURS.every((b) => CHANNELS[b].offset || CHANNELS[b].amount || CHANNELS[b].frozen),
  BEHAVIOURS.filter((b) => !CHANNELS[b].offset && !CHANNELS[b].amount && !CHANNELS[b].frozen).join(", ") || "all live",
)

console.log(`\n"OFF (STATIC)" MUST HOLD THE GROUP AT NEUTRAL — offset 0, amount 1, not frozen`)
console.log(`Its control is the SAME behaviour under "independent", which must LEAVE neutral`)
console.log(`in whichever channels the evaluator says it drives.\n`)

for (const behaviour of BEHAVIOURS) {
  const want = CHANNELS[behaviour]
  const base = {
    layerStackEnabled: true,
    stackAnimationEnabled: true,
    stackAnimationType: behaviour,
    stackAnimationSpeed: 1.2,
    styleLoopSeconds: 4,
    textureEnabled: true,
    textureMode: "grain",
  }
  // `--mutate=norail`: the switch does not reach the stack, which is what the
  // pre-fix `stackAnimOn` did. See the header.
  const off = await travel(page, { ...base, motionMode: NORAIL ? "independent" : "off" })
  const ind = await travel(page, { ...base, motionMode: "independent" })
  console.log(
    `  ${behaviour.padEnd(18)} OFF  off ${off.offDev.toFixed(4)} amt ${off.amtDev.toFixed(4)} frozen ${off.frozenEver}` +
      `   |   IND  off ${ind.offDev.toFixed(4)} amt ${ind.amtDev.toFixed(4)} frozen ${ind.frozenEver}`,
  )
  check(
    `${behaviour}: "Off (static)" holds the group at NEUTRAL on all three channels`,
    off.offDev < 1e-6 && off.amtDev < 1e-6 && !off.frozenEver,
    `offset ${off.offDev.toFixed(4)} · amount dev ${off.amtDev.toFixed(4)} · frozen ${off.frozenEver}`,
  )
  /* THE CONTROL, CHANNEL BY CHANNEL. Asserting only "something moved" would let
   * a behaviour that drives two channels pass on one of them, which is how a
   * half-wired rail reads as wired. */
  const departed =
    (!want.offset || ind.offDev > 1e-4) &&
    (!want.amount || ind.amtDev > 1e-3) &&
    (!want.frozen || ind.frozenEver)
  check(
    `${behaviour}: CONTROL — "Independent clock" leaves neutral on ${
      [want.offset && "offset", want.amount && "amount", want.frozen && "frozen"].filter(Boolean).join(" + ")
    }`,
    departed,
    `offset ${ind.offDev.toFixed(4)} · amount dev ${ind.amtDev.toFixed(4)} · frozen ${ind.frozenEver}`,
  )
}

await browser.close()
console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILED`}\n`)
process.exit(failures === 0 ? 0 : 1)
