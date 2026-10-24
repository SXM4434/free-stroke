// K7 MAY NOT TAKE THE MARK APART — the invariant the eye had to find first.
//
// WHY THIS EXISTS. `assert-hero-k7-news.mjs` is 8/8 green on the return and is
// right about everything it measures: 1544 px of ink became paper, 0 px of
// paper became ink, the surviving interior holds sd 0.000, and the area agrees
// with the break model to 5 %. Watching the beat back at full resolution, the
// returned mark had a DECAPITATED `l` — the ascender's tip floating, detached
// from its own stem — a severed `s`, and four white bars across the `sk` that
// read as shattered rather than as over/under.
//
// Every one of those quantities is a SUM. A sum cannot see a letter come apart.
// The property the eye was actually checking is CONNECTIVITY: an occlusion
// hides part of a stroke behind another stroke, so the ink it leaves is still
// one mark. A cut that isolates a fragment is not an occlusion, it is damage.
//
// So this counts the connected components of ink in K1 and in K7 and requires
// them to be EQUAL. Nothing about how much ink went, or where — only whether
// the drawing is still assembled the way the hand left it.
//
// ── IT IS DRIVEN ON THE LIVE BEAT, WITH NO OVERRIDE ────────────────────────
// K7 is read at the end of the page's own timeline rather than through
// `__captureHarness.setFlatten`. That is deliberate and it is the second thing
// this file proves: `sample.jointBreak` has to reach the render through
// `page.tsx`'s flatten memo for the shipped beat to say anything at all, and an
// override would pass whether or not that wire exists.
//
// ── THE FIVE ARMS, AND THERE IS NO `--control=` FLAG ───────────────────────
// It was DELETED on 2026-08-07 (explainer 29 §5, explainer 36): no sweep ever
// passed it, so the arms that prove this instrument can fail had never run.
// Setting it now THROWS with the replacement, which is the rule
// `scripts/verify/lib/dev-server.mjs` already applies to a legacy knob name — a
// flag that is silently ignored is how a run gets attributed to an arm it never
// took, and this file spent six days as the proof of that.
//
//   selfcross   THE SHIPPED LAW. Graded, must PASS. Checked BY NAME, never
//               assumed: an arm that silently did not switch produces a run
//               identical to the shipped one, which then reads as "the control
//               passed too".
//   crossings   PARKED (§0.7) — `selfcross` with the self-crossing pass removed
//               and nothing else changed. Graded normally and it DOES pass:
//               K1 5 -> K7 5 at the shipped carve, measured 2026-08-07. It is
//               graded because explainer 36 §5 is about exactly this shape one
//               law over — a law that is selectable, still rendering, and
//               watched by no row is a law whose next regression nobody sees.
//   prior       KNOWN-BAD. All 22 contacts, no guard — the set that shipped a
//               decapitated `l` and a severed `s`. MUST go red, or this
//               instrument is measuring nothing.
//   nofarside   KNOWN-BAD. The SHIPPED law with ONE clause removed — the
//               come-out-the-far-side test — and nothing else changed. (Added
//               2026-08-01 with that clause.) It is the naive relaxation of the
//               margin `crossings` replaced, it admits 18->20 and 18->21, and it
//               MUST go red: a guard whose control cannot fail is not a guard.
//               `prior` alone did not prove this, because it differs from the
//               shipped law in every clause at once.
//   terminals   KNOWN-BAD SINCE 2026-08-07 — AND THIS FILE USED TO GRADE IT AS
//               AN EXPECTED PASS. It is the PARKED margin (§0.7). What that
//               paragraph said, and why it was wrong, is the block below.
//   ⚠ RE-POINTED 2026-10-03 (CL-BROWSERC, the controller's call): the three
//               known-bads are graded on the FORCED-OPEN break
//               (setFlatten({ jointBreak: 1 }), the must-fail's own forcing), not
//               the live K7. Since 74b0b114 made the return identical, no break
//               opens at K7 on the live beat, so every junction law left the mark
//               whole there and all three printed "THIS GATE IS BLIND".
//   --carve=<0..1>      drives `HeroMotionParams.carveAmount`. See below — this
//                       row is a FUNCTION of the carve and that has to be
//                       drivable, or the conflict looks like a mystery.
//
// ⚠ `--carve=0` IS NOT A VALID CONTROL INVOCATION OF THIS GATE, and it says so
// rather than passing. At `carve === 0` `findHeroJunctions` sends EVERY law
// down the parked `terminals` clause (`app/desk-doodles/page.tsx:880`), because
// the uncarved picture is gated and may not move — so `selfcross`, `nofarside`
// and `terminals` all publish the same 9-junction set and two of the three
// controls become the shipped arm wearing another name. Measured 2026-08-07:
// `--carve=0` reports `red: [NONE — THIS GATE IS BLIND]` on `nofarside` and
// exits 1. That is the correct answer, not a defect in the arm.
//
// ── ⚠ CORRECTED 2026-08-07 · THIS BLOCK'S HEADING USED TO READ "🔴 THIS ROW IS
//    RED AT THE SHIPPED CARVE, AND IT IS NOT A MYSTERY" ────────────────────
// (Added 2026-08-01 by the lane that drove `penCarve` from the model. Corrected
// by the lane that ran the arms it had never occurred to anyone to run.)
//
// IT IS GREEN. Measured bare at the shipped carve of 0.70 on 2026-08-07: the
// shipped `selfcross` law holds K1 5 -> K7 5 and all four subject rows pass, at
// carve 1.00 as well (K1 6 -> K7 6). The heading is kept rather than deleted
// because the CONFLICT below was real, it is what `--carve=` exists for, and
// three of its five paragraphs are still live. What closed it is what the
// paragraphs under "WHERE THE FIX LIVES" now say: `buildJointBreaks` takes the
// carve, the renderer uploads the per-break radii, and the three drop rules
// landed.
//
// THE CONFLICT, stated once: the break removes a TRANSVERSE SLAB of the under
// stroke at every crossing — the removed region is defined by distance to the
// OVER stroke's centreline, so it spans the under stroke's whole cross-section
// however narrow the band is. That always severs. On the FAT TUBE the mark
// stayed whole anyway, because the fused mark gave every fragment a second path
// around. The pen carve removes those fusions — correctly; un-fusing the mark is
// the entire point of it — and the fragments are then left floating.
//
// MEASURED THREE WAYS, so "unfixable from that lane" is a result and not a
// shrug (`docs/verification/pen-carve/sweep/sweep.json`):
//
//   1 · THE GAP IS NOT THE LEVER. `ret.breakK` 0.35 / 0.24 / 0.16 / 0.10 gives
//       K7 components 9 / 9 / 8 / 8 against K1's 6, while the ink removed falls
//       through `assert-hero-k7-news`'s own 200 px floor at 0.16. A thinner
//       paper band severs just as completely.
//   2 · THE JUNCTION SET IS NOT THE LEVER EITHER. Tightening the proximity test
//       in `findHeroJunctions` from 1.0 to 0.85, 0.70 and 0.55 ink diameters —
//       i.e. asking whether the strokes touch AS DRAWN rather than as tubes —
//       leaves the component sizes byte-identical. The junctions that fragment
//       the mark are genuine, tight crossings.
//   3 · AMPLITUDE IS THE ONLY LEVER, AND IT HAS NO SAFE VALUE. Assembly holds
//       to carve 0.40 and breaks at 0.55 (an extra 528 px fragment). But
//       `assert-flat-silhouette.mjs` needs the flat/solid silhouette difference
//       to clear 10 % AND 3x the 4.09 % value-only floor, and carve 0.40
//       measures 8.10 %. There is no amplitude that satisfies both gates.
//
// WHERE THE FIX LIVED — AND IT HAS LANDED, WHICH THIS PARAGRAPH USED TO DENY.
//
// ⚠ IT USED TO READ: *"the break's geometry is sized against the TUBE's radius —
// `JOINT_BREAK_KEEP_K · inkDiameter / 2` in `lib/flat-ink.ts`, called from
// `components/viewport-3d.tsx` with the page's published `inkWidth`. On a carved
// mark the stroke in front is ~0.69 R, so the paper band starts 0.37 R BEYOND
// the ink it is supposed to hide behind — the 'ink collar' failure mode
// `JOINT_BREAK_KEEP_K`'s own comment names. The break needs to know the carve."*
//
// THE BREAK KNOWS THE CARVE. `buildJointBreaks` takes a `carve` and returns
// `keepUnder` / `keepOver` / `outer` PER BREAK (lib/flat-ink.ts), and
// `components/viewport-3d.tsx:4886-4887` uploads both into `uFsBreakData`'s
// fourth `vec4`, which the fragment shader reads as `fsK.x` / `fsK.y` (:1878,
// :1887-1888). At carve > 0 the shipped shader runs the CARVED radii. The note
// in `lib/flat-ink.ts` that still said "NOT YET WIRED" was measured stale on
// 2026-08-07 and is corrected there.
//
// ⚠ AND THE INK COLLAR IS NOT THE MECHANISM OF THE ROW BELOW, WHICH IS WHY THIS
// PARAGRAPH IS BEING CORRECTED RATHER THAN LEFT AS BACKGROUND. The
// `terminals` red was reported on 2026-08-07 with the collar quoted as its
// cause, off this paragraph. It cannot be: `crossings` and `terminals` run the
// SAME radii, the SAME carve and the SAME shader on the SAME frame and differ
// only in which junctions are in the set — `crossings` holds K1 5 -> K7 5 and
// `terminals` splits a 3232 px part into 2330 + 777. A quantity that is
// identical across the two arms cannot be what separates them. The mechanism is
// the SET, and it is named at the `terminals` control below.
//
// ── RE-DERIVED 2026-10-02 (CL-REDERIVE): THE REACH ROW ───────────────────
// "the LIVE beat reaches K7 with the break OPEN" went stale when 74b0b114 made the
// return identical (DEFAULT_HERO_MOTION.ret.mode "identical"): the live beat never
// opens the break, so the row was red on every arm. Measured at 89226c543 before
// this change: K1 19047 px -> K7 19047 px, 0 gaps, no break table published. It
// now reads "the live beat cuts 0 px at the k junction on every hold frame", with a
// must-fail that forces the break open and must read paper above 0. Same wire
// (sample.jointBreak through the flatten memo, no override), graded the way the
// beat is now built. The launch moved to lib/browser.mjs, the harness path every
// other gate uses. The rest is at the row.
//
// Usage:
//   node scripts/verify/assert-hero-k7-intact.mjs [--carve=0.4] [--self]
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { injectSelfJunctions } from "./lib/self-junctions.mjs"
import { gapRegions } from "./lib/joint-break-gaps.mjs"
import { HERO_URL } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
/**
 * ⚠ `--control=` IS GONE AND SETTING IT IS AN ERROR, NOT A SHRUG.
 *
 * It selected ONE arm; since 2026-08-07 all five run on the bare invocation
 * (explainer 29 §5). Leaving the flag parsed-and-ignored would be worse than
 * deleting it: the operator types `--control=prior`, every arm runs, the run
 * looks like the one they asked for, and the attribution is silently wrong.
 * That is the same failure `lib/dev-server.mjs` throws on for a legacy knob
 * name, and this file is the gate that paid for the lesson.
 */
if (process.argv.some((a) => a.startsWith("--control="))) {
  console.error(
    `--control= was DELETED on 2026-08-07: all five arms (selfcross · crossings · prior · ` +
      `nofarside · terminals) now run on the bare invocation, because no sweep ever passed the ` +
      `flag. Run:  node scripts/verify/assert-hero-k7-intact.mjs`,
  )
  process.exit(2)
}
/** The carve amplitude to drive, or null for the page's own default. See the
 *  header: this row is a function of the carve, and a conflict nobody can
 *  reproduce at both ends is a conflict nobody can act on. */
const CARVE = arg("carve", null)
/** Inject the arc-keyed self-crossings — see the block that uses it. */
const SELF = process.argv.includes("--self")
/** Same override `assert-hero-k7-news.mjs` has always taken, so the pair can be
 *  pointed at the same build — including a sandbox copy carrying a diff to a
 *  file this lane does not own. */
const URL = HERO_URL
const OUT = join(ROOT, "docs", "verification", "hero-k7", "intact")

const INK_MAX_LUMA = 150
/** Ink islands smaller than this are antialiasing crumbs, not parts of a mark. */
const MIN_COMPONENT_PX = 40

const results = []
const record = (name, pass, detail) => {
  results.push({ name, pass, detail })
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}\n      ${detail}`)
}
const control = (pass, name, detail) => {
  results.push({ name: "CONTROL " + name, pass, detail })
  console.log(`${pass ? "PASS" : "FAIL"}  CONTROL · ${name}\n      ${detail}`)
}

/** 8-connected components of the ink mask, largest first. */
async function components(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  const ctx = c.getContext("2d")
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, img.width, img.height)
  const W = img.width
  // The viewport draws its own transport chrome low in the stage; the mark
  // lives in the top three-quarters, same crop the transition gate uses.
  const H = Math.floor(img.height * 0.75)
  const mask = new Uint8Array(W * H)
  for (let p = 0; p < W * H; p++) {
    const i = p * 4
    const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
    mask[p] = l <= INK_MAX_LUMA ? 1 : 0
  }
  const seen = new Uint8Array(W * H)
  const sizes = []
  const stack = new Int32Array(W * H)
  for (let s = 0; s < W * H; s++) {
    if (!mask[s] || seen[s]) continue
    let sp = 0
    stack[sp++] = s
    seen[s] = 1
    let n = 0
    while (sp > 0) {
      const p = stack[--sp]
      n++
      const x = p % W
      const y = (p / W) | 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
          const q = ny * W + nx
          if (!mask[q] || seen[q]) continue
          seen[q] = 1
          stack[sp++] = q
        }
      }
    }
    sizes.push(n)
  }
  sizes.sort((a, b) => b - a)
  /* THE MARK'S INK SPAN IN PIXELS. The per-break reach row turns the break
   * table's stroke units into pixels with it, and it belongs here rather than in
   * a second walk of the same mask. */
  let minX = W
  let maxX = -1
  for (let p = 0; p < W * H; p++) {
    if (!mask[p]) continue
    const x = p % W
    if (x < minX) minX = x
    if (x > maxX) maxX = x
  }
  return {
    all: sizes,
    real: sizes.filter((n) => n >= MIN_COMPONENT_PX),
    spanPx: maxX >= minX ? maxX - minX + 1 : 0,
  }
}

/** Ink mask of a whole frame at the same luma cut as `components` and `gapRegions`. */
async function inkMask(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  const ctx = c.getContext("2d")
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, img.width, img.height)
  const mask = new Uint8Array(img.width * img.height)
  for (let p = 0; p < mask.length; p++) {
    const i = p * 4
    mask[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2] <= INK_MAX_LUMA ? 1 : 0
  }
  return { mask, W: img.width, H: img.height }
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 1440 } })

  /**
   * ONE ARM. `null` is the shipped junction law; `crossings` is the second
   * PARKED law (§0.7) graded normally; `prior`, `nofarside` and `terminals` are
   * the three KNOWN-BADS. ALL FIVE RUN ON THE BARE INVOCATION.
   *
   * They were `--control=` and no sweep passed it, so the arms that prove this
   * instrument can fail had never run in a sweep
   * (`docs/explainers/21-losing-your-work.md` §7; explainer 31 counted nineteen
   * gates like this and named this one). The flag is DELETED per explainer 29 §5.
   *
   * COST, MEASURED: ~7.7 s per arm. Four arms 29.0 s (2026-08-07, lane N); the
   * `crossings` arm takes it to five. Nothing here approaches the 304 s that
   * earns a gate the right to schedule an arm somewhere else.
   *
   * ⚠ A GRADED ARM'S ROWS ARE NEVER ECHOED — `say` prints only on the shipped
   * arm. Both runners count an INDENTED `FAIL`, so echoing an arm that is
   * SUPPOSED to go red posts a gate's own evidence as its failures. Only the
   * one-line verdict is printed, and it names which arm produced it.
   *
   * An arm gets its own page AND its own context: the junction law is read by
   * `addInitScript` before first render, and this app restores a drawing from
   * localStorage, so a shared context leaks the previous arm's state.
   */
  async function runArm(CONTROL) {
  const context2 = await browser.newContext({ viewport: { width: 1440, height: 1440 } })
  const page = await context2.newPage()
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 200))
  })
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 200)))
  const verdicts = []
  const say = (key, name, pass, detail) => {
    verdicts.push({ key, name, pass, detail })
    if (!CONTROL) record(name, pass, detail)
  }

  // BEFORE NAVIGATION: the junction set is computed in a memo keyed on the
  // strokes, so the flag has to be present at first render.
  if (CONTROL) {
    await page.addInitScript((v) => {
      window.__heroJunctionLaw = v
    }, CONTROL)
  }
  // Same rule, same reason: the carve amplitude is latched in a mount effect.
  if (CARVE !== null) {
    await page.addInitScript((v) => {
      window.__heroCarveAmount = v
    }, Number(CARVE))
  }

  await page.goto(URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__captureHarness && window.__heroJunctions, null, {
    timeout: 90000,
  })
  await page.waitForTimeout(3000)

  /* THE ARM IS READ OFF THE PAGE, NOT OFF THE FLAG THAT ASKED FOR IT. A control
   * that silently failed to switch produces a run identical to the shipped arm,
   * which then reads as "the control passed too". */
  const jg = await page.evaluate(() => ({
    law: window.__heroJunctions?.law ?? null,
    count: window.__heroJunctions?.list?.length ?? 0,
    /* THE SET ITSELF, not just its size. Two arms can publish the same COUNT
     * and different junctions, and the difference between two sets is the only
     * thing that makes an arm a control at all — see the `terminals` verdict,
     * which asserts on it rather than on "something went red". A self-crossing
     * is keyed on its two ARC indices, so it is spelled out: `under === over`
     * alone would collapse every crossing on one stroke into one name. */
    pairs: (window.__heroJunctions?.list ?? []).map((j) =>
      j.underAt === undefined
        ? `${j.under}-${j.over}`
        : `${j.under}-${j.over}@${j.underAt}/${j.overAt}`,
    ),
    /* THE TWO NUMBERS THE PER-BREAK REACH ROW NEEDS, read off the page beside
     * the set that produced them so an arm cannot be scaled by another arm's
     * word. `inkWidth` is the published stroke diameter; `spanX` is the drawn
     * word's own extent, which turns pixels into stroke units below exactly as
     * `assert-hero-k7-news.mjs` does — one derivation, restated nowhere. */
    inkWidth: window.__heroJunctions?.inkWidth ?? 0,
    spanX: (() => {
      const st = window.__handFeelHarness?.processed
      if (!st) return 0
      let lo = Infinity
      let hi = -Infinity
      for (const s of st)
        for (const [x] of s) {
          if (x < lo) lo = x
          if (x > hi) hi = x
        }
      return hi > lo ? hi - lo : 0
    })(),
  }))
  /* THE SHIPPED LAW IS CHECKED BY NAME, never assumed — a control that silently
   * did not switch produces a run identical to the shipped arm, which then reads
   * as "the control passed too". It changed `"terminals"` -> `"crossings"` on
   * 2026-08-01 and `"crossings"` -> `"selfcross"` on 2026-08-02: §0.7 forbids
   * improving a read in place, so each new guard arrives as a NEW id and the one
   * it replaced is parked under its old one.
   *
   * ⚠ CORRECTED 2026-08-07. THIS USED TO ACCEPT EITHER NAME. It read: *"IN
   * TRANSITION (2026-08-02) … the CALL SITE lives in `app/desk-doodles/page.tsx`,
   * which belongs to another lane. Until that call site lands the page still
   * publishes `"crossings"` and `--self` injects the same set from the harness.
   * BOTH names are accepted."* THE CALL SITE LANDED. `page.tsx:1753` holds
   * `useState<JunctionLaw>("selfcross")` and the page publishes `"selfcross"`,
   * measured on every arm of every run below. Accepting `"crossings"` as shipped
   * is now a hole with a name: it is a PARKED law with its own graded arm two
   * blocks down, so a page that silently fell back to it would be graded twice,
   * once as the thing it is and once as the thing it is not. One name. */
  const SHIPPED_LAW = "selfcross"
  const lawOk = CONTROL ? jg.law === CONTROL : jg.law === SHIPPED_LAW
  if (!lawOk) {
    console.error(
      `the junction law did not take: page reports "${jg.law}", wanted ` +
        `"${CONTROL ?? SHIPPED_LAW}". ` +
        `Refusing to grade — an arm that did not switch is not a control.`,
    )
    process.exit(2)
  }
  /* THE CARVE IS READ OFF THE PAGE TOO, and printed with the verdict — because
   * this row's answer DEPENDS on it, and a component count reported without the
   * amplitude that produced it is a number nobody can act on. */
  const liveCarve = await page.evaluate(() => {
    const v = document.querySelector("[data-hero-carve]")?.getAttribute("data-hero-carve")
    return v === null || v === undefined ? null : Number(v)
  })
  if (CARVE !== null && Math.abs((liveCarve ?? -1) - Number(CARVE)) > 0.005) {
    console.error(
      `--carve=${CARVE} did not take: the page publishes ${liveCarve}. ` +
        `Refusing to grade — an arm that did not switch is not a control.`,
    )
    process.exit(2)
  }
  /* ── `--self` · THE ARC-KEYED SELF-CROSSINGS, INJECTED (2026-08-02) ───────
   * `lib/flat-ink.ts` owns the law; this arm makes the same call from the
   * harness, against the page's OWN strokes and through the REAL
   * `findSelfCrossings`, and publishes the result — so the shader, the break
   * table and this gate all run the shipped path over the extended set. See
   * `lib/self-junctions.mjs` for exactly what it does and does not prove.
   *
   * ⚠ CORRECTED 2026-08-07: THE CALL SITE LANDED, so this flag is OBSOLETE on
   * the shipped law and is not silently so. The paragraph here used to say the
   * twenty lines *"live in `app/desk-doodles/page.tsx`, which belongs to another
   * lane"*; `page.tsx:947-953` now publishes the self-crossings itself. Injecting
   * them again APPENDS a second copy of the same set, so `lib/self-junctions.mjs`
   * refuses on `"selfcross"` and returns `self: 0` — which the exit below turns
   * into a refusal to grade rather than a doubled list nobody can see. The flag
   * still does real work on the PARKED `"crossings"` arm, which is the arm that
   * genuinely lacks the pass. */
  let injected = null
  if (SELF) {
    injected = await injectSelfJunctions(page, liveCarve ?? 1)
    if (injected.self === 0) {
      console.error(
        `--self injected NOTHING. An arm that did not switch is not a control — refusing to grade.`,
      )
      process.exit(2)
    }
    // The break table caches on the list's identity; give the frame loop a tick
    // to rebuild before anything is captured.
    await page.waitForTimeout(600)
  }
  console.log(
    `junction law: ${jg.law} · ${jg.count} junctions${CONTROL ? "  [CONTROL]" : ""} · ` +
      `pen carve ${liveCarve === null ? "?" : liveCarve.toFixed(2)}` +
      `${CARVE !== null ? "  [forced]" : ""}` +
      `${injected ? `  ·  +${injected.self} SELF-crossings injected -> ${injected.after}` : ""}\n`,
  )

  const stage = page.locator("[data-hero-stage]")
  const box = await stage.boundingBox()
  const seek = async (t) => {
    await page.evaluate((v) => {
      const el = document.querySelector("[data-hero-scrub]")
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      set.call(el, String(v))
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }, t)
    await page.waitForTimeout(500)
  }
  const shot = async () => {
    await page.waitForTimeout(250)
    return page.screenshot({ clip: box })
  }
  const endT = await page.evaluate(() => Number(document.querySelector("[data-hero-scrub]").max))

  // K1 — the last `breath` frame, found by walking the page's own phase readout
  // rather than by arithmetic on a beat table this file does not own.
  let k1T = null
  for (let t = 0.2; t < endT; t += 0.25) {
    await page.evaluate((v) => {
      const el = document.querySelector("[data-hero-scrub]")
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      set.call(el, String(v))
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }, t)
    const ph = await page.evaluate(
      () => document.querySelector("[data-hero-phase]")?.dataset.heroPhase ?? null,
    )
    if (ph === "breath") k1T = t
    else if (k1T !== null) break
  }
  if (k1T === null) {
    console.error("could not find the breath phase — the beat's phase names moved")
    process.exit(2)
  }
  await seek(k1T)
  const k1Png = await shot()
  writeFileSync(join(OUT, `k1${CONTROL ? `-${CONTROL}` : ""}.png`), k1Png)

  // K7 — the end of the page's OWN timeline, no override anywhere.
  await seek(endT)
  const k7Png = await shot()
  writeFileSync(join(OUT, `k7${CONTROL ? `-${CONTROL}` : ""}.png`), k7Png)

  const k1 = await components(k1Png)
  const k7 = await components(k7Png)


  /* ── 🔴 RE-DERIVED 2026-10-02 (CL-REDERIVE). THIS ROW USED TO READ "the LIVE
   *    beat reaches K7 with the break OPEN" ──────────────────────────────────
   *
   * WHY. 74b0b114 (2026-09-25) set `DEFAULT_HERO_MOTION.ret` to "identical": with
   * the current strokes the one break the table opened was the k arm over the
   * stem, and it read as two white bars across the k in every hold frame. From
   * then on the live beat never opens the break, so the old row asked for paper
   * the shipped beat is built not to cut. Its per-break reach (2026-09-04, which
   * replaced `lost > 200`) is history now; the wire it graded is the same one.
   *
   * WHAT IT GRADES. On the page's own timeline, no override, every `hold` frame
   * at 1/30 s: pixels that are ink at K1 and paper at that frame, inside the
   * junction window, must be 0.
   *
   * THE WINDOW IS NOT TYPED. It is where THIS ARM's own break table draws when
   * the break is forced open on the K7 frame (`setFlatten({ jointBreak: 1 })`),
   * read as gap regions between the K7 frame and the forced one and padded by one
   * stroke diameter. A table that draws nowhere refuses, never reads 0.
   *
   * MUST-FAIL, graded after the shipped arm: the forced-open frame, read by the
   * same count against K1, must read paper above 0. */
  const FRAME = 1 / 30
  const at100 = (v) => Math.round(v * 100) / 100
  const scrubTo = (v) =>
    page.evaluate((tt) => {
      const el = document.querySelector("[data-hero-scrub]")
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      set.call(el, String(tt))
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }, v)
  const holdTs = []
  for (let k = 0; k < 600; k++) {
    const t = at100(endT - k * FRAME)
    if (t < 0) break
    await scrubTo(t)
    const ph = await page.evaluate(() => document.querySelector("[data-hero-phase]")?.dataset.heroPhase ?? null)
    if (ph !== "hold") break
    if (!holdTs.includes(t)) holdTs.unshift(t)
  }
  await seek(endT)
  const tookForce = await page.evaluate(() => window.__captureHarness.setFlatten({ jointBreak: 1 }))
  await page.waitForTimeout(600)
  const forcedPng = await shot()
  const brk = await page.evaluate(() => window.__heroBreaks ?? null)
  await page.evaluate(() => window.__captureHarness.setFlatten(null))
  await page.waitForTimeout(400)
  writeFileSync(join(OUT, `k7-forced${CONTROL ? `-${CONTROL}` : ""}.png`), forcedPng)
  const drew = await gapRegions(k7Png, forcedPng)
  const k7Scale = jg.spanX + jg.inkWidth > 0 ? k1.spanPx / (jg.spanX + jg.inkWidth) : 0
  const padPx = Math.ceil(jg.inkWidth * k7Scale)
  const k1Ink = await inkMask(k1Png)
  let win = null
  if (drew.refused === null && drew.regions.length > 0 && padPx > 0) {
    win = new Uint8Array(k1Ink.W * k1Ink.H)
    for (const r of drew.regions) {
      const x0 = Math.max(0, Math.floor(r.cx - r.w / 2) - padPx)
      const x1 = Math.min(k1Ink.W - 1, Math.ceil(r.cx + r.w / 2) + padPx)
      const y0 = Math.max(0, Math.floor(r.cy - r.h / 2) - padPx)
      const y1 = Math.min(k1Ink.H - 1, Math.ceil(r.cy + r.h / 2) + padPx)
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) win[y * k1Ink.W + x] = 1
    }
  }
  /** Ink at K1 that is paper in `m`, inside the window. null = no comparison happened. */
  const cutIn = (m) => {
    if (!win || m.W !== k1Ink.W || m.H !== k1Ink.H) return null
    let n = 0
    for (let p = 0; p < win.length; p++) if (win[p] && k1Ink.mask[p] && !m.mask[p]) n++
    return n
  }
  const perFrame = []
  for (const t of holdTs) {
    await scrubTo(t)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(150)
    perFrame.push({ t, cut: cutIn(await inkMask(await page.screenshot({ clip: box }))) })
  }
  const forcedCut = cutIn(await inkMask(forcedPng))
  /* THE FORCED FRAME'S COMPONENTS, for the known-bads (2026-10-03). Same counter
   * and same K1 as the intactness row; only the frame differs, and it is the one
   * frame where this arm's break table draws. */
  const kf = await components(forcedPng)
  const worst = perFrame.reduce((a, f) => (f.cut === null ? a : Math.max(a, f.cut)), 0)
  const above = perFrame.filter((f) => f.cut === null || f.cut > 0)
  say("kcut",
    "the LIVE beat cuts 0 px at the k junction on every hold frame, no override anywhere",
    win !== null && perFrame.length > 0 && above.length === 0,
    !holdTs.length
      ? `REFUSED: walking back from the end found no \`hold\` frame, so there is nothing to grade.`
      : win === null
        ? `REFUSED: no junction window. ${drew.refused ?? `The break forced open drew ${drew.regions.length} region(s); table opened ${brk?.opened ?? "?"}, setFlatten took ${tookForce}, pad ${padPx} px.`} A window that cannot be found is no answer, never 0.`
        : `${perFrame.length} hold frames, ${holdTs[0]}-${holdTs.at(-1)} s at 1/30 s. Ink at K1 that is paper on the frame, ` +
          `inside the junction window: max ${worst} px, frames above 0: ${above.length}` +
          `${above.length ? ` (${above.slice(0, 6).map((f) => `${f.t}s ${f.cut ?? "size mismatch"}`).join(", ")})` : ""}. ` +
          `Window: the ${drew.regions.length} region(s) this arm's table drew with the break forced open, ` +
          `${drew.regions.map((r) => `${r.area} px at (${r.cx.toFixed(0)},${r.cy.toFixed(0)}) ${r.w}x${r.h}`).join(" · ")}, ` +
          `padded ${padPx} px (one stroke); table opened ${brk?.opened ?? "?"}. ret is "identical" since 74b0b114, ` +
          `so the k arm over the stem stays ink.`,
  )

  say("intact",
    "K7 DOES NOT TAKE THE MARK APART — the drawing is still assembled",
    k7.real.length === k1.real.length,
    `connected ink components: K1 ${k1.real.length}, K7 ${k7.real.length} (must be equal). ` +
      `An occlusion hides ink behind another stroke and leaves the mark whole; a cut that isolates a ` +
      `fragment is damage. Components >= ${MIN_COMPONENT_PX} px; K1 sizes ${k1.real.slice(0, 8).join(", ")}` +
      `${k1.real.length > 8 ? ", …" : ""} · K7 sizes ${k7.real.slice(0, 8).join(", ")}${k7.real.length > 8 ? ", …" : ""}`,
  )

  say("crumbs",
    "...and it does not shed crumbs either",
    k7.all.length - k7.real.length <= k1.all.length - k1.real.length,
    `sub-${MIN_COMPONENT_PX}px islands: K1 ${k1.all.length - k1.real.length}, K7 ${k7.all.length - k7.real.length} ` +
      `(K7 may not exceed K1). A break that leaves a scatter of specks passes a component count that only ` +
      `looks at real parts, so the crumbs are counted separately rather than thresholded away.`,
  )

  say("console", "console clean", errors.length === 0, `${errors.length} errors${errors.length ? ": " + errors.join(" | ") : ""}`)

  await page.close()
  await context2.close()
  return {
    rows: verdicts, law: jg.law, pairs: jg.pairs,
    mustFail: { took: tookForce, cut: forcedCut, win: win !== null },
    forced: {
      took: tookForce, opened: brk?.opened ?? null,
      k1: k1.real.length, kf: kf.real.length,
      k1Crumbs: k1.all.length - k1.real.length, kfCrumbs: kf.all.length - kf.real.length,
      k1Sizes: k1.real.slice(0, 8), kfSizes: kf.real.slice(0, 8),
    },
  }
  }

  /* ---- THE SHIPPED JUNCTION LAW ---- */
  const real = await runArm(null)
  control(
    real.mustFail.win && real.mustFail.cut !== null && real.mustFail.cut > 0,
    "MUST-FAIL · the break FORCED OPEN (setFlatten jointBreak 1) reads paper above 0 at the k junction",
    `setFlatten took: ${real.mustFail.took} · ink at K1 that is paper inside the window on the forced frame: ` +
      `${real.mustFail.cut ?? "no window"} px (needs > 0). Same count the hold frames are read with; if it reads 0 ` +
      `here, the live 0 means nothing.`,
  )
  const at = (arm, k) => arm.rows.find((v) => v.key === k)
  const reds = (arm) => arm.rows.filter((v) => !v.pass).map((v) => v.key)
  /** What this arm admits that the shipped law does not — the whole reason an
   *  arm is an arm. An empty answer means the two sets are the same drawing. */
  const extraOf = (arm) => arm.pairs.filter((p) => !real.pairs.includes(p))
  const shipped = () => at(real, "intact").detail.split("\n")[0]

  /* ---- THE SECOND PARKED LAW, GRADED NORMALLY (§0.7) ----------------------
   *
   * `crossings` is `selfcross` with the self-crossing pass removed and nothing
   * else changed: still selectable, still rendering, and until 2026-08-07
   * watched by NO ROW anywhere in the battery. That is the shape explainer 36
   * §5 is about — the arm nobody runs — one law over from the arm it found it
   * in, so it is graded here rather than assumed.
   *
   * MEASURED, and it holds: 7 junctions, opens 7->8 and 18->19, K1 5 -> K7 5 at
   * the shipped carve. Two claims, because either alone is empty: the set has to
   * DIFFER from the shipped one (at `--carve=0` every law collapses onto the
   * parked margin and this arm becomes the shipped arm wearing another name),
   * and the mark has to stay assembled. */
  const alt = await runArm("crossings")
  const altT = at(alt, "intact")
  const altExtra = extraOf(alt)
  const altMissing = real.pairs.filter((p) => !alt.pairs.includes(p))
  record(
    "the PARKED `crossings` junction law is still REACHABLE and still holds the mark together",
    altT.pass && (altExtra.length > 0 || altMissing.length > 0),
    `${altT.detail.split("\n")[0]}` +
      `\n      it publishes ${alt.pairs.length} junctions against the shipped law's ${real.pairs.length}: ` +
      `+[${altExtra.join(" ") || "none"}] -[${altMissing.join(" ") || "none"}]. Both halves are asserted — a ` +
      `parked arm that publishes the SHIPPED set is not a second arm, it is the same run twice, and at ` +
      `--carve=0 that is exactly what every law becomes.`,
  )

  /* ---- THE THREE KNOWN-BADS ---------------------------------------------
   *
   * ⚠ `terminals` IS THE THIRD ONE SINCE 2026-08-07, AND IT USED TO BE GRADED
   * AS AN EXPECTED PASS. What that block said: *"§0.7: `terminals` is still
   * selectable and still renders. This header has always said it is 'expected to
   * PASS' here"* — on the stated ground that *"at carve 1.00 the break law drops
   * all but 7->8 on that set too"*. Nothing had ever run it. Every clause of
   * that sentence is now measured, and the last one is false:
   *
   *   carve 0.70   9 junctions, opens 7-8 · 18-19 · 18-20   K1 5 -> K7 6
   *   carve 1.00   9 junctions, opens 0-1 · 7-8 · 18-19 · 18-20   K1 6 -> K7 8
   *   carve 0      the clause every law collapses onto        K1 5 -> K7 5
   *
   * so the drop-all-but-7->8 sentence describes the `crossings` SET (six
   * junctions, `page.tsx`'s own census), not this one, and the expectation was
   * never true at any carve where the arm is distinguishable at all.
   *
   * THE MECHANISM, at one junction and one line. `terminals` is the MARGIN —
   * `app/desk-doodles/page.tsx:880-881`, `if (!(aEnd > reach) || !(bEnd > keep))
   * continue` — and it admits **18->20** at `aEnd 30.7` against `reach 28.23`.
   * Those 30.7 units are the part of stroke 18 lying FORWARD of the contact, and
   * every one of them is inside stroke 20's paper band when the pen lifts:
   * `comesOut(+1)` runs off the end of stroke 18 without ever leaving the band,
   * which is the clause `crossings` replaced the margin with (`page.tsx:919`).
   * `buildJointBreaks` then removes an 8.72-unit slab there and the whole forward
   * tail — the upper half of the final `s` of *Doodles*, 777 px — is cut free.
   * The margin admits it BECAUSE the piece is big, which is what the margin's
   * own docstring predicted: *"the further from the end a junction is, the BIGGER
   * the piece the break leaves floating, so the clause pushes the wrong way"*
   * (`page.tsx:676-678`).
   *
   * ⚠ AND IT IS NOT FIXABLE FROM THE BREAK LAW, WHICH IS MEASURED AND NOT
   * ASSUMED. 18->20 is the SAME junction `nofarside` is calibrated against
   * (`lib/flat-ink.ts`'s self-crossing note), and `_probe-lane31-ofat.mjs
   * --carve=0.70` says it is the ONLY one that severs on either known-bad:
   * removing 18->20 alone takes `nofarside` from K7 6 to K7 5 and `prior` from
   * K7 6 to K7 5. So a drop rule that closed this row would make BOTH of the
   * other two controls unable to fail — DISPATCH §2.6, and the reason this row
   * is graded as a known-bad rather than "fixed". §0.7 forbids reworking the
   * parked margin in place, and there is nothing to rework: the margin admitting
   * 18->20 IS `terminals`. */
  /* ── 🔴 RE-POINTED 2026-10-03 (CL-BROWSERC): THE KNOWN-BADS ARE GRADED ON THE
   *    FORCED-OPEN BREAK ─────────────────────────────────────────────────────
   *
   * WHY. Each known-bad's claim is about junctions: the law adds (or removes)
   * contacts the shipped law does not, and a break opened at one of them takes
   * the mark apart. With the return identical (74b0b114) the live beat opens no
   * break at K7, so no law can cut anything there and all three read "red: NONE,
   * THIS GATE IS BLIND" (CL-REDERIVE, 2026-10-02: K1 5 -> K7 5 on each).
   *
   * WHAT IT GRADES NOW. The same intactness count, K1 against the K7 frame with
   * the break FORCED OPEN (setFlatten({ jointBreak: 1 }), the forcing the
   * must-fail above uses; on the shipped law its table opens 1 break). Red means
   * the forced frame's component count differs from K1's AND from what the
   * shipped law's forced frame reads, so the red belongs to the law's own set and
   * not to the forcing. The live K7 reading is still printed, for the record.
   *
   * The 2026-09-04 block inside the loop is history: it is about the live K7
   * reading, which no longer decides this row. */
  /* `terminals` RETIRED AS A CONTROL, controller's call 2026-10-03: the junction it exists to
   * admit, 18->20 on the final `s`, left the drawing with the 2026-08-28 stub filter. On the
   * 13-stroke word it publishes exactly the `crossings` set (3 junctions, +[none] -[1-1@8/44];
   * forced K7: 1 break, 5 -> 5), and `crossings` is the arm this gate requires to HOLD, so no
   * forcing can make `terminals` read red here. It returns as a control if a drawing with
   * 18->20 comes back. `prior` (+2) and `nofarside` (+1) still grade on the forced K7. */
  const sF = real.forced
  const sDelta = sF.kf - sF.k1
  for (const [name, why] of [
    ["prior", "the prior junction law — all 22 contacts, no guard — which shipped a decapitated `l` and a severed `s`"],
    ["nofarside", "the SHIPPED law with the come-out-the-far-side clause removed and nothing else changed — the naive relaxation `crossings` replaced"],
  ]) {
    const arm = await runArm(name)
    const t = at(arm, "intact")
    const extra = extraOf(arm)
    /* ⚠ WHY THIS ROW IS RED AT THE SHIPPED CARVE, AND IT IS NOT THE ROW'S FAULT
     * (measured 2026-09-04, and it is a finding rather than a threshold).
     *
     * All three arms below still go red — on `crumbs`, never on `intact`. The
     * island each of them sheds is **1 pixel**. Measured off this run's own
     * stored frames, K1 -> K7, sub-40px islands:
     *
     *     shipped   0 -> 0        prior       0 -> 1
     *     crossings 0 -> 0        nofarside   0 -> 1
     *                             terminals   0 -> 1
     *
     * ONE PIXEL IS NOT A DECAPITATED `l`. Accepting `crumbs` here would let this
     * gate report "the known-bad is rejected" about an arm that no longer
     * reproduces anything like the defect, so the row keeps asking for `intact`
     * and keeps going red.
     *
     * ⭐ THE MECHANISM IS THE STUB FILTER. `lib/pen-reveal.ts`'s
     * `dropSubNibStubs` landed 2026-08-28 and removed nine of the traced word's
     * twenty-two polylines; the page now draws THIRTEEN strokes
     * (`window.__handFeelHarness.processed.length === 13`, measured). The `prior`
     * arm's own name says *"all 22 contacts"* and it publishes EIGHT, because the
     * contacts that used to sever the mark involved strokes that are no longer
     * drawn. These three known-bads describe a drawing this page does not draw.
     *
     * That is the same root cause as `assert-hero-word-legible`'s O5 row, fixed
     * the same day: one filter, two gates that were never told.
     *
     * WHAT IT WOULD TAKE, and why it was not done here. Restoring a severing arm
     * needs either the nine stubs back (they were deleted on purpose, and the
     * mark is better for it) or a harness switch over `buildJointBreaks`'s three
     * drop rules, which lives in lib/flat-ink.ts and is not this file's to add.
     * Weakening the row to accept a 1 px island would be exactly the pass this
     * repo does not take. So the red stands and says why. */
    const missing = real.pairs.filter((p) => !arm.pairs.includes(p))
    const f = arm.forced
    const aDelta = f.kf - f.k1
    const forcedRed = f.took !== false && f.k1 > 0 && aDelta !== 0 && aDelta !== sDelta
    control(
      forcedRed && (extra.length > 0 || missing.length > 0),
      `KNOWN-BAD \`${name}\` — ${why} — is REJECTED by the intactness row at the FORCED-OPEN break`,
      `${forcedRed ? "red" : "NOT RED — THIS GATE IS BLIND TO THIS LAW"}: with the break forced open ` +
        `(setFlatten jointBreak 1, took ${f.took}, table opened ${f.opened ?? "?"}) K1 ${f.k1} -> forced ${f.kf} components ` +
        `(${aDelta >= 0 ? "+" : ""}${aDelta}); the shipped law under the same forcing: K1 ${sF.k1} -> forced ${sF.kf} ` +
        `(${sDelta >= 0 ? "+" : ""}${sDelta}), table opened ${sF.opened ?? "?"}. Red needs a delta that is not 0 and not the shipped one.` +
        `\n      sizes K1 ${f.k1Sizes.join(", ")} · forced ${f.kfSizes.join(", ")} · sub-${MIN_COMPONENT_PX}px islands K1 ${f.k1Crumbs}, forced ${f.kfCrumbs}` +
        `\n      junctions over the shipped law: +[${extra.join(" ") || "none"}] -[${missing.join(" ") || "none"}]` +
        `\n      live K7, for the record (no break opens there): red [${reds(arm).join(" ") || "none"}] · ${t.detail.split("\n")[0]}`,
    )
  }

  const failed = results.filter((r) => !r.pass)
  console.log(`\nframes: ${OUT}`)
  console.log(failed.length ? `\n${failed.length} FAILED` : "\nall rows passed")
  await browser.close()
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
