// ASSERT-DRAWIN-ATTRS — THE MARK MUST SURVIVE THE DIALS SEBS ACTUALLY MOVES.
//
// ── THE DEFECT THIS EXISTS FOR ──────────────────────────────────────────────
//
// On FREE STROKE with the FONT word, wobble 0 and endpoint CLEAN, the whole
// mark went from 94 323 ink px at DRAW 93 % to **1** at 94 % and stayed gone to
// the end of the beat. Everything a gate normally asks read healthy: the reveal
// fraction was smooth and finite, `setDrawRange` submitted **335 820 of 359 568
// indices — MORE than at 93 %**, the mesh was `visible`, un-culled, in the same
// world position to the byte, the material was `opacity 1 · transparent false ·
// colorWrite true`, every index was in range for `position`, and all three
// fragment discards were swept OFAT and exonerated.
//
// The cause was an attribute nobody was checking. `lib/implicit-defer.ts`
// `adoptBuffers` refills the LIVE geometry in place — `position`, `normal` and
// the INDEX — because that is how an off-thread rebuild reaches the screen
// without React. `components/viewport-3d.tsx` writes a THIRD per-vertex
// attribute onto that same object, `aFsLetter`, from an effect keyed on five
// values that an in-place refill moves none of. So the attribute survived,
// describing the surface that had been replaced:
//
//     position 59 936 · normal 59 936 · aFsLetter 58 998
//
// **WebGL validates a draw against EVERY enabled attribute.** The first
// `setDrawRange` that reaches index 58 998 is `INVALID_OPERATION` and the driver
// drops the WHOLE draw call — not the triangle, the call. Chrome said so at
// **WARNING** level — `GL_INVALID_OPERATION: glDrawElements: Vertex buffer is
// not big enough for the draw call` — which is why every console-error check in
// the battery read zero. Explainer 24.
//
// ── WHY THE BATTERY COULD NOT SEE IT, AND WHAT THAT MAKES THIS GATE ─────────
//
// The mismatch is only CREATED by a rebuild that goes through the deferred
// path, and the first build of a slot never defers. So it does not exist on a
// page that is loaded and scrubbed. It needs a DIAL MOVED — and the whole
// battery loads, scrubs, and never touches a dial. That is the same hole the
// r175 `texStorage2D` eraser bug lived in (`MORNING-BRIEF.md` §1: *"a plain
// load-and-play never resizes the field… The bug was only reachable by using
// the app."*), and it has now cost this project twice.
//
// **So this gate DRIVES THE DIALS.** It walks Sebs's own sequence — engine,
// word, wobble, endpoint — and reads the buffers after each step. A gate that
// only loaded the page would be green on the defect it is named for.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⚠ 2026-08-07 — THIS GATE COULD NOT FAIL ON HALF THE FIX, AND THAT IS WHAT
//   THE ROWS BELOW ARE FOR. Read this before touching any predicate.
// ═══════════════════════════════════════════════════════════════════════════
//
// An audit lane mutation-tested this file rather than reading it, and found the
// row at the old `:207` unable to fail:
//
//     final.attrs.position === (final.attrs.aFsLetter ?? final.attrs.position)
//
// **`?? final.attrs.position` compares `position` WITH ITSELF when the attribute
// is ABSENT.** So the one state the fix's second half exists to prevent —
// `aFsLetter` gone entirely, the cascade with no letters to rotate by — read
// GREEN. Measured, not argued (`docs/verification/lane-d-audit/gatehole.json`):
// **2 of 2 single-half mutants left all seven shipped-arm predicates green**,
// including the one where `letterCensus()` reported `withAttr 0 · 0 letters`.
// This gate gated the PAIR and never a half, and it never called
// `letterCensus()` at all — so it could not see the cascade losing its letters,
// which is what half the fix exists to prevent.
//
// The fix has two halves and they close DIFFERENT classes
// (`docs/verification/lane-d-audit/halves.json` — the 2×2 nobody had run):
//
//   · `dropStaleImplicitAttrs`  (lib/geometry-engines.ts:5643, called :7664)
//     closes the SILENT class. With it ON the attribute is deleted on every
//     refill, so `ensureLetterStamp`'s `if (la && la.count === pos.count)
//     continue` (viewport-3d.tsx:4251) can never short-circuit. With it OFF, a
//     refill whose new count happens to EQUAL the stale count skips the
//     re-stamp and keeps values that are wrong at EVERY index — explainer 24
//     §2's silent outcome, which renders a picture nobody can tell is wrong.
//
//   · `ensureLetterStamp`      (components/viewport-3d.tsx:4244, called :4863)
//     keeps the CASCADE alive. Drop-only leaves `aFsLetter` absent: the mark is
//     fine, `letterCensus` reports **withAttr 0, zero letters**, and the
//     cascade has nothing to rotate by.
//
// **Either half alone closes the BLANK** — drop-only and stamp-only both render
// 24 763 px with 0 rejected draws. So no row that reads the picture, the draw
// count, or the console can separate them. Rows 3–9 below read the STAMP and
// the MECHANISM instead, and rows 16–19 arm each half OFF on its own and
// require this gate to catch it.
//
// ── THE MEASUREMENTS THE NEW ROWS ARE CALIBRATED AGAINST ────────────────────
// Read first-hand on this tree, port 3105, all three arms, same dial walk:
//
//   arm                       aFsLetter   withAttr  letters  spanning  DROPS/refills
//   SHIPPED  drop ON  stamp ON    60118      1/2       11        0        4 / 6
//   MUTANT A drop ON  stamp OFF  ABSENT      0/2        0        0        2 / 6
//   MUTANT B drop OFF stamp ON     60118     1/2       11        0      **0 / 6**
//   KNOWN-BAD both OFF            58998      1/2       12*    2452        0 / 6
//                                                    (*one of them stringifies
//                                                      empty — the stale buffer
//                                                      being read past its end)
//
// MUTANT B is the hard one and it is why row 9 exists: it renders a CORRECT
// picture on this walk. Nothing is corrupt on that arm — what is broken is that
// the silent class is reachable again, because six in-place refills happened and
// **not one of them cleared the attribute it did not write.** That is a
// measurement of the mechanism firing, not a read of a flag: `staleAttrDrops`
// counts refills that actually deleted something (`geometry-engines.ts:7666`),
// and `dropStaleImplicitAttrs` returns `[]` without deleting when the half is
// off (`:5649`), so the counter cannot move.
//
// ── THE EXEMPTION LIST (Sebs's standing rule — a gate with no exemption
//    mechanism gets disabled the first time it is "wrong") ─────────────────────
// See `EXEMPTIONS` below. Adding an entry REQUIRES a written reason on the same
// line. Widen an exemption, never the rule.
//
// ── THE KNOWN-BAD, AND IT IS NOT SYNTHETIC ─────────────────────────────────
//
// §2.6: calibrate against a known-bad and require it to FAIL. The known-bads
// here are the PARKED PRIORS — the code that shipped, still in the tree,
// re-armed — and there are now THREE of them, because the pair and each half
// fail differently:
//   both off   → the original blank: short attribute, rejected draws, 1 px
//   drop only  → the cascade loses its letters (rows 3, 5 must catch it)
//   stamp only → a refill keeps what it did not write (row 9 must catch it)
// Every arm is asserted to have actually TAKEN before it is graded, so a sweep
// cannot measure the same arm three times.
//
// ── AND THE EXTERNAL FALSIFICATION ─────────────────────────────────────────
// `--mutate=stamp-off` / `--mutate=drop-off` arm one half OFF **before** the
// shipped walk and INVERT the verdict: the named rows MUST go red, and the run
// exits 0 only if they all did. Same convention as `assert-hero-k7-news.mjs`.
// This is the direct answer to the audit — re-run its two mutants and watch the
// gate reject them.
//
// Usage: node scripts/verify/assert-drawin-attrs.mjs [--engine=free-stroke]
//        [--word=font] [--keep] [--verbose]
//        node scripts/verify/assert-drawin-attrs.mjs --mutate=stamp-off|drop-off
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"
/* ── WHICH TREE THIS GATE IS GRADING ───────────────────────────────────────
 * Imported, not re-derived. `docs/DISPATCH.md` §3: *"One knob, one name:
 * `FS_PORT`, resolved once in `scripts/verify/lib/dev-server.mjs`."*
 *
 * ⚠ THIS FILE USED TO CARRY ITS OWN COPY — `process.env.FS_PORT || "3000"` —
 * and that is only HALF port-aware. It honoured `FS_PORT`, so it did grade the
 * right tree whenever a lane set it; but it silently IGNORED `HERO_URL`, which
 * is the legacy name 24 other files still used and the one an operator's muscle
 * memory reaches for. Setting `HERO_URL=…:3105/desk-doodles` and running this
 * gate would have graded :3000 — the shared checkout — and printed green about
 * a tree the lane never touched. `dev-server.mjs` THROWS on a set legacy name
 * with the replacement command, which is the whole reason it exists, and a
 * private copy of the port line opts out of that.
 *
 * Measured 2026-08-07, and this is the class: a sibling lane found **35 of 48
 * browser gates hardcode `http://localhost:3000`** and ignore `FS_PORT`
 * entirely — one printed 189 green rows about the canonical tree while its own
 * lane's server logged every request. A gate that cannot fail and a gate that
 * measures the wrong tree are the same defect wearing two symptoms. */
import { HERO_URL, PORT } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const ENGINE = arg("engine", "free-stroke")
const WORD = arg("word", "font")
const VERBOSE = process.argv.includes("--verbose")
const MUTATE = arg("mutate", null)
const OUT = join(ROOT, "docs", "verification", "drawin-attrs")

/* ── THE EXEMPTION LIST ─────────────────────────────────────────────────────
 * Every entry needs a WRITTEN REASON on the same line. This exists because a
 * gate whose only response to being wrong is "turn it off" gets turned off; one
 * that asks for a one-line reason stays on. If a new case is legitimate, add it
 * HERE with its reason — do not widen the predicate.
 */
const EXEMPTIONS = {
  /* `attrCensus`/`letterCensus` walk EVERY mesh with an index buffer, and the
   * scene carries one helper geometry beside the mark — 4 vertices, 6 indices,
   * `opacity 0` (the object that made `_probe-lane1-blank-tail.mjs` print
   * `Infinity / 6` for forty rows before it was made to take the LARGEST index
   * buffer). It is not a letter-bearing mark and never carries `aFsLetter`.
   * Measured on this build: `letterCensus` reports meshes 2 · withAttr 1.
   * REASON: a helper geometry with no letters cannot carry a letter stamp. */
  lettersMeshesWithoutStamp: 1,

  /* REASON (none taken): if `aFsLetter` is ever moved INTO the implicit build's
   * own outputs — i.e. added to `IMPLICIT_OWN_ATTRS` in geometry-engines.ts —
   * then the refill writes it and there is correctly nothing to drop, so row 9
   * would go red while the product was healthier than before. That is the ONE
   * legitimate way to zero this counter. It has not happened; when it does, the
   * right change is to DELETE row 9 and replace it with "the refill WRITES
   * aFsLetter", not to exempt it. Recorded so the next reader does not have to
   * re-derive why the row is phrased about the drop rather than the flag. */
  refillsAllowedToDropNothing: 0,
}

let pass = true
let rows = 0
const rowLog = []
const say = (ok, label, detail) => {
  rows++
  if (!ok) pass = false
  rowLog.push({ name: label, pass: ok, detail })
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

/* Row names the `--mutate` controls address. Constants because a control that
 * matches a row by a string literal typed twice is a control that silently
 * stops matching. */
const R_PRESENT = "the letter attribute is PRESENT on the surface the draw reads"
const R_MATCHES = "…and it matches position AFTER the dials Sebs actually moves"
const R_LETTERS = "the cascade still HAS its letters — the stamp survived the walk"
const R_SPANNING = "no triangle straddles two letters — the stamp describes THIS surface"
const R_FINITE = "every letter id is a real number — nothing was read past the end of the stamp"
const R_REFILLED = "the walk actually REFILLED geometry in place — the drop row below is not vacuous"
const R_DROPS = "every in-place refill CLEARED the attribute it did not write"

/* The GL message the driver emits when a draw is rejected against a short
 * attribute. Matched on the stable half of the string — the context id and the
 * entry-point name are Chrome's, and both have changed spelling before. */
const GL_SHORT = "not big enough"

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1600, height: 1600 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const logs = []
  page.on("pageerror", (e) => logs.push({ type: "pageerror", text: String(e).slice(0, 300) }))
  page.on("console", (m) => logs.push({ type: m.type(), text: m.text().slice(0, 300) }))
  const glFails = () => logs.filter((l) => l.text.includes(GL_SHORT)).length

  /* SAY WHICH TREE, OUT LOUD, BEFORE GRADING IT. A green run whose target is
   * implicit is a green run nobody can attribute. */
  console.log(`grading ${HERO_URL}  (FS_PORT=${PORT})\n`)
  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__inflateProbe, null, { timeout: 120000 })
  await page.waitForTimeout(2500)

  /* ---- THE DIAL DRIVERS. Each is the control a HAND uses, found in the DOM,
   * not a state injection — a harness that writes state cannot prove the
   * control reaches it. (`verify-through-the-ui`, and the panel that once
   * rendered zero controls while every assertion passed.) ---- */
  const setEngine = async (e) => { await page.click(`[data-engine-option="${e}"]`); await page.waitForTimeout(4000) }
  const setWord = async (w) => { await page.click(`[data-word-source="${w}"]`); await page.waitForTimeout(5000) }
  const setWobble = async (v) =>
    page.evaluate((val) => {
      for (const inp of document.querySelectorAll('input[type="range"]')) {
        const row = inp.closest("div")?.parentElement
        if (((row?.textContent ?? "").toLowerCase()).includes("wobble")) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
          setter.call(inp, String(val))
          inp.dispatchEvent(new Event("input", { bubbles: true }))
          inp.dispatchEvent(new Event("change", { bubbles: true }))
          return true
        }
      }
      return false
    }, v)
  const setEndpoint = async (name) =>
    page.evaluate((n) => {
      for (const b of document.querySelectorAll("button")) {
        if ((b.textContent ?? "").trim().toLowerCase() === n) { b.click(); return true }
      }
      return false
    }, name)

  const census = () =>
    page.evaluate(() => {
      const c = window.__inflateProbe.attrCensus(-1)
      const big = c.reduce((a, b) => (b.indexCount > (a?.indexCount ?? -1) ? b : a), null)
      return big
    })
  /* THE CASCADE'S OWN VIEW OF THE STAMP. The gate never called this, which is
   * how a mutant with ZERO letters read ALL PASS. `spanning` is the only
   * VALUE-level reading available from outside: `ownTrianglesWhole` gives every
   * triangle three vertices of ONE letter, so a triangle whose corners disagree
   * is a stamp describing a surface that no longer exists. */
  const letters = () => page.evaluate(() => window.__inflateProbe.letterCensus())
  /* THE REFILL'S OWN COUNTER. `staleAttrDrops` increments only when
   * `dropStaleImplicitAttrs` actually DELETED something; with the half off it
   * returns `[]` before deleting, so the counter cannot move.
   * `implicitDeferApplied` counts the in-place refills themselves, and is what
   * keeps the drop row from being vacuous on a run where nothing deferred. */
  const debug = () =>
    page.evaluate(() => {
      const d = window.__inflateProbe.debug()
      return {
        drops: d.staleAttrDrops,
        droppedNames: d.staleAttrsDropped,
        refills: d.implicitDeferApplied,
        deferred: d.implicitDeferred,
      }
    })
  const inkAt = async (frac) => {
    const span = await page.evaluate(() =>
      JSON.parse(document.querySelector("[data-hero-draw-span]").getAttribute("data-hero-draw-span")),
    )
    await page.evaluate((t) => {
      const el = document.querySelector("[data-hero-scrub]")
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      setter.call(el, String(t))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, span.at + span.duration * frac)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(250)
    const buf = await page.locator("[data-hero-stage]").screenshot()
    const { createCanvas, loadImage } = createRequire(import.meta.url)("@napi-rs/canvas")
    const img = await loadImage(buf)
    const cv = createCanvas(img.width, img.height)
    const x = cv.getContext("2d")
    x.drawImage(img, 0, 0)
    const { data } = x.getImageData(0, 0, img.width, img.height)
    const hist = new Uint32Array(256)
    const luma = new Uint8Array(img.width * img.height)
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) | 0
      luma[p] = l
      hist[l]++
    }
    let paper = 0
    for (let l = 1; l < 256; l++) if (hist[l] > hist[paper]) paper = l
    const cut = Math.max(8, paper - 45)
    let n = 0
    for (let p = 0; p < luma.length; p++) if (luma[p] < cut) n++
    return n
  }

  /* Arm the two parked priors and READ THEM BACK through their own getters —
   * the live module variables the two fix sites consume, not the request. */
  const armPriors = (drop, stamp) =>
    page.evaluate(
      ([d, s]) => {
        const a = window.__captureHarness.setRefillDropsStaleAttrs(d)
        const b = window.__captureHarness.setLetterStampFollowsRefill(s)
        return {
          ok: a && b,
          drop: window.__captureHarness.refillDropsStaleAttrs(),
          stamp: window.__captureHarness.letterStampFollowsRefill(),
        }
      },
      [drop, stamp],
    )

  /* Re-drive the SAME dials, SAMPLING AFTER EACH MOVE. The mismatch is CREATED
   * by a rebuild, so an arm that only flips a switch and re-reads would find the
   * healthy attribute still there and report a fix that was never tested.
   *
   * ⚠ AND IT SAMPLES FOUR TIMES RATHER THAN ONCE, BECAUSE A SINGLE READ IS A
   * RACE. Not every dial move defers: measured on this tree, wobble 0.4 -> 0 on
   * the drop-only arm reused the slot, `implicitDeferApplied` did not move, the
   * React effect re-stamped on its own, and the final read showed `aFsLetter`
   * PRESENT on an arm whose whole point is that it is absent. Three of the four
   * moves in this walk DID defer and all three read ABSENT. A known-bad graded
   * off one sample would have gone green about a quarter of the time — which is
   * a flaky gate, and a flaky gate gets turned off. */
  const reDrive = async () => {
    const samples = []
    const moves = [
      ["wobble=0.4", () => setWobble(0.4)],
      ["endpoint=protrude", () => setEndpoint("protrude")],
      ["wobble=0", () => setWobble(0)],
      ["endpoint=clean", () => setEndpoint("clean")],
    ]
    for (const [name, go] of moves) {
      await go()
      await page.waitForTimeout(4000)
      samples.push({ move: name, census: await census(), letters: await letters(), debug: await debug() })
    }
    return samples
  }

  /* ══ 0 · THE MUTATION CONTROL — one half OFF *BEFORE* the walk ══
   * The gate only ever armed its priors at its known-bad step, so the state a
   * single-half mutant leaves is one this file had never read. That is exactly
   * why it could not fail. */
  let mutantArmed = null
  if (MUTATE) {
    const spec = { "stamp-off": [true, false], "drop-off": [false, true] }[MUTATE]
    if (!spec) {
      console.error(`\nunknown control "${MUTATE}" — expected stamp-off or drop-off`)
      process.exit(2)
    }
    mutantArmed = await armPriors(spec[0], spec[1])
    if (!mutantArmed.ok || mutantArmed.drop !== spec[0] || mutantArmed.stamp !== spec[1]) {
      console.error(`\nthe mutant did not ARM — drop ${mutantArmed.drop} stamp ${mutantArmed.stamp}; refusing to grade it`)
      process.exit(2)
    }
    console.log(
      `--mutate=${MUTATE}: armed BEFORE the walk — refillDropsStaleAttrs ${mutantArmed.drop} · letterStampFollowsRefill ${mutantArmed.stamp}\n`,
    )
  }

  /* ══ 1 · THE DIAL WALK — the attribute must track the surface at every step ══ */
  const walk = []
  const step = async (label) => {
    const c = await census()
    const d = await debug()
    walk.push({ label, ...c, glFails: glFails(), ...d })
    if (VERBOSE)
      console.log(
        `   ${label}  position ${c.attrs.position}  aFsLetter ${c.attrs.aFsLetter ?? "(ABSENT)"}` +
          `  short ${JSON.stringify(c.short)}  drops ${d.drops}/${d.refills} refills`,
      )
    return c
  }
  await step("0 load")
  await setEngine(ENGINE)
  await step(`1 engine=${ENGINE}`)
  if (WORD !== "traced") { await setWord(WORD); await step(`2 word=${WORD}`) }
  await setWobble(0)
  await page.waitForTimeout(4000)
  await step("3 wobble=0")
  await setEndpoint("clean")
  await page.waitForTimeout(4000)
  const final = await step("4 endpoint=clean")
  const finalLetters = await letters()
  const finalDebug = await debug()

  /* NON-VACUITY FIRST. The claim is empty if the walk never actually rebuilt
   * the surface — a page that ignored every dial would trivially keep a
   * matching attribute. So the vertex count has to have MOVED. */
  const counts = walk.map((w) => w.attrs.position)
  const moved = new Set(counts).size
  say(
    moved >= 3,
    "the dial walk actually REBUILT the surface — the claim below is not vacuous",
    `${moved} distinct vertex counts across ${walk.length} steps: ${counts.join(" -> ")}`,
  )
  const anyShort = walk.filter((w) => w.short.length > 0)
  say(
    anyShort.length === 0,
    "every per-vertex attribute spans the index buffer, at EVERY dial position",
    anyShort.length
      ? `${anyShort.length} step(s) short: ${anyShort.map((w) => `${w.label} ${w.short.join("/")}`).join(" · ")}`
      : walk.map((w) => `${w.label} ${w.attrs.position}`).join(" · "),
  )

  /* ⚠ PRESENCE AND EQUALITY ARE TWO ROWS, AND THE OLD FILE MERGED THEM INTO ONE
   * THAT COULD NOT FAIL. `position === (aFsLetter ?? position)` compares
   * `position` with itself when the attribute is gone, so the drop-only mutant
   * — the exact state `ensureLetterStamp` exists to prevent — read green. */
  const letterCount = final.attrs.aFsLetter
  say(
    letterCount !== undefined,
    R_PRESENT,
    letterCount === undefined
      ? "aFsLetter is ABSENT — the refill dropped it and nothing re-stamped it. The mark still draws; the cascade has nothing to rotate by."
      : `aFsLetter present, ${letterCount} vertices`,
  )
  say(
    letterCount !== undefined && letterCount === final.attrs.position,
    R_MATCHES,
    `position ${final.attrs.position} · aFsLetter ${letterCount ?? "(ABSENT)"}`,
  )

  /* ══ 1b · THE CASCADE'S VIEW — what the gate never asked ══
   * Half the fix exists so the letters SURVIVE a refill, and nothing here read
   * them. Drop-only renders a perfect mark with zero letters on it. */
  const stampBearing = finalLetters.meshes - EXEMPTIONS.lettersMeshesWithoutStamp
  say(
    finalLetters.withAttr >= stampBearing && finalLetters.letters.length >= 2,
    R_LETTERS,
    `withAttr ${finalLetters.withAttr}/${finalLetters.meshes} mesh(es) ` +
      `(${EXEMPTIONS.lettersMeshesWithoutStamp} exempt: the helper geometry carries no letters) · ` +
      `${finalLetters.letters.length} distinct letter(s)`,
  )
  say(
    finalLetters.spanning === 0,
    R_SPANNING,
    `${finalLetters.spanning} triangle(s) whose three vertices claim different letters, of ${finalLetters.triangles}`,
  )
  say(
    finalLetters.letters.every((l) => Number.isFinite(l)),
    R_FINITE,
    `letters [${finalLetters.letters.map((l) => (Number.isFinite(l) ? l : "NOT-A-NUMBER")).join(",")}]`,
  )

  /* ══ 1c · THE MECHANISM, NOT THE PICTURE ══
   * Drop-only and stamp-only BOTH render 24 763 px with 0 rejected draws, so no
   * reading of the picture can separate them. This pair reads whether the
   * refill actually cleared what it did not write — the half that closes the
   * SILENT class, which by construction leaves the picture looking right. */
  say(
    finalDebug.refills > 0,
    R_REFILLED,
    `${finalDebug.refills} in-place refill(s) landed during the walk · lastDeferred ${finalDebug.deferred}`,
  )
  say(
    finalDebug.drops > 0,
    R_DROPS,
    finalDebug.drops > 0
      ? `${finalDebug.drops} of ${finalDebug.refills} refill(s) dropped a stale attribute · last dropped "${finalDebug.droppedNames}"`
      : `0 of ${finalDebug.refills} refills dropped anything. A refill that keeps a foreign attribute is one coincidence ` +
        `(new count === stale count) away from the SILENT class: the stamp short-circuits, the values stay wrong at every index, and the picture looks right.`,
  )

  /* ══ 2 · THE DRIVER'S OWN VERDICT ══
   * Not inferred from pixels. A rejected draw is a message, and this repo has
   * been reading only `type === "error"` — the message is a WARNING. */
  say(
    glFails() === 0,
    "the driver accepted every draw — no rejected draw calls at any dial position",
    `${glFails()} × "${GL_SHORT}"`,
  )

  /* ══ 3 · AND THE PICTURE, AT THE PLAYHEAD THAT WAS BLANK ══ */
  const inkMid = await inkAt(0.93)
  const inkTail = await inkAt(0.97)
  const inkEnd = await inkAt(1.0)
  say(inkMid > 1000, "the mark is inked at DRAW 93 %", `${inkMid} px`)
  say(
    inkTail >= inkMid,
    "…and the TAIL of the draw has MORE ink, not none — the reveal is monotone through 97 %",
    `93 % ${inkMid} px -> 97 % ${inkTail} px`,
  )
  say(inkEnd >= inkTail, "…and the finished mark is the fullest of the three", `100 % ${inkEnd} px`)

  /* ══ 4 · THE KNOWN-BADS — the parked priors, re-armed, EACH REQUIRED to fail ══
   * Three arms, because the pair and each half break differently and a gate
   * that only ever arms the pair is the gate this file used to be. */
  const arms = {}
  const runKnownBad = async (key, drop, stamp) => {
    const armed = await armPriors(drop, stamp)
    const glBefore = glFails()
    const dbgBefore = await debug()
    const samples = await reDrive()
    const c = samples[samples.length - 1].census
    const lc = samples[samples.length - 1].letters
    const dbgAfter = await debug()
    const ink = await inkAt(0.97)
    arms[key] = {
      armed,
      samples,
      census: c,
      letters: lc,
      ink,
      gl: glFails() - glBefore,
      drops: dbgAfter.drops - dbgBefore.drops,
      refills: dbgAfter.refills - dbgBefore.refills,
      /* THE READINGS THE VERDICTS ARE TAKEN OVER — any-sample, not last-sample.
       * See the note on `reDrive`. */
      anyShort: samples.filter((s) => s.census.short.length > 0).length,
      anyStampGone: samples.filter(
        (s) => s.census.attrs.aFsLetter === undefined || s.letters.withAttr === 0 || s.letters.letters.length < 2,
      ).length,
      worstSpanning: Math.max(...samples.map((s) => s.letters.spanning)),
    }
    return arms[key]
  }
  const trail = (a) =>
    a.samples
      .map((s) => `${s.move} ${s.census.attrs.aFsLetter ?? "ABSENT"}/${s.census.attrs.position} L${s.letters.letters.length}`)
      .join(" · ")

  if (MUTATE) {
    console.log(`\n(--mutate: the known-bad arms are skipped — this run grades the SHIPPED rows above.)`)
  } else {
    /* 4a · BOTH OFF — the original blank, verbatim. */
    const both = await runKnownBad("bothOff", false, false)
    say(
      both.armed.ok && both.armed.stamp === false && both.armed.drop === false,
      "the known-bad arm actually TOOK — a sweep cannot measure the same arm twice",
      `stampFollowsRefill ${both.armed.stamp} · refillDropsStale ${both.armed.drop}`,
    )
    say(
      both.anyShort > 0 || both.gl > 0 || both.ink <= 1 || both.worstSpanning > 0,
      "KNOWN-BAD · BOTH HALVES OFF (the prior: stale attribute survives the refill) is REJECTED",
      `${both.anyShort} of ${both.samples.length} sample(s) short ${JSON.stringify(both.census.short)} · rejected draws ${both.gl}` +
        ` · ink at 97 % ${both.ink} px · worst spanning ${both.worstSpanning}` +
        ` · letters [${both.letters.letters.map((l) => (Number.isFinite(l) ? l : "NOT-A-NUMBER")).join(",")}]`,
    )

    /* 4b · DROP ONLY — `ensureLetterStamp` removed. The mark is FINE and the
     * cascade is dead. Rows 3 and 5 are the only things that can see it. */
    const dropOnly = await runKnownBad("dropOnly", true, false)
    say(
      dropOnly.armed.ok && dropOnly.armed.drop === true && dropOnly.armed.stamp === false,
      "the DROP-ONLY arm actually TOOK",
      `refillDropsStale ${dropOnly.armed.drop} · stampFollowsRefill ${dropOnly.armed.stamp}`,
    )
    say(
      dropOnly.anyStampGone > 0,
      "KNOWN-BAD · DROP ONLY (the re-stamp removed) is REJECTED — the cascade loses its letters",
      `${dropOnly.anyStampGone} of ${dropOnly.samples.length} sample(s) had no usable stamp · ` +
        `ink at 97 % ${dropOnly.ink} px (the MARK is fine — that is the point) · ${trail(dropOnly)}`,
    )

    /* 4c · STAMP ONLY — `dropStaleImplicitAttrs` removed. Everything renders
     * correctly; the silent class is simply reachable again. Row 9 is the only
     * thing that can see it. */
    const stampOnly = await runKnownBad("stampOnly", false, true)
    say(
      stampOnly.armed.ok && stampOnly.armed.drop === false && stampOnly.armed.stamp === true,
      "the STAMP-ONLY arm actually TOOK",
      `refillDropsStale ${stampOnly.armed.drop} · stampFollowsRefill ${stampOnly.armed.stamp}`,
    )
    /* ⚠ `refills > 0` IS PART OF THE PASS CONDITION, NOT A PRECONDITION WAIVED
     * WHEN IT IS FALSE. If this arm never refilled, the instrument did not
     * create the condition it is asserting about, and the honest verdict is a
     * RED that names the instrument — explainer 21 §7's §3.14 lesson, where a
     * row failed while the app behaved correctly because the test had not
     * filled storage. A green there would be the worse answer. */
    say(
      stampOnly.refills > 0 && stampOnly.drops === 0,
      "KNOWN-BAD · STAMP ONLY (the refill's drop removed) is REJECTED — a refill kept what it did not write",
      stampOnly.refills === 0
        ? `THE ARM NEVER REFILLED — 0 in-place refills over ${stampOnly.samples.length} dial moves, so nothing was asked. This red is the instrument, not the subject.`
        : `${stampOnly.drops} of ${stampOnly.refills} refill(s) dropped anything · aFsLetter ${stampOnly.census.attrs.aFsLetter ?? "(ABSENT)"}` +
          ` · spanning ${stampOnly.letters.spanning} · ink at 97 % ${stampOnly.ink} px (the PICTURE is correct — that is the point)`,
    )
  }

  await armPriors(true, true)

  writeFileSync(
    join(OUT, `attrs-${ENGINE}-${WORD}${MUTATE ? `-mutate-${MUTATE}` : ""}.json`),
    JSON.stringify(
      { mutate: MUTATE, mutantArmed, walk, finalLetters, finalDebug, inkMid, inkTail, inkEnd, arms, rows: rowLog, exemptions: EXEMPTIONS, logs: logs.slice(-40) },
      null,
      2,
    ),
  )
  await context.close()
  await browser.close()

  /* ---- the control's verdict is INVERTED (same convention as
   * assert-hero-k7-news.mjs) — a mutant that leaves the gate green is the
   * failure being reported, not a passing run. ---- */
  if (MUTATE) {
    const mustFail = {
      "stamp-off": [R_PRESENT, R_MATCHES, R_LETTERS],
      "drop-off": [R_DROPS],
    }[MUTATE]
    const stillGreen = mustFail.filter((n) => rowLog.find((r) => r.name === n)?.pass)
    console.log(`\n--mutate=${MUTATE}: these rows MUST be red —`)
    for (const n of mustFail) {
      const r = rowLog.find((x) => x.name === n)
      console.log(`   ${r && !r.pass ? "went red ✓" : "STAYED GREEN ✗"}  ${n}`)
    }
    console.log(`\n${join(OUT, `attrs-${ENGINE}-${WORD}-mutate-${MUTATE}.json`)}`)
    if (stillGreen.length) {
      console.log(`\nCONTROL FAILED — ${stillGreen.length} row(s) could not tell the difference.`)
      process.exit(1)
    }
    console.log(`\ncontrol SOUND — the gate rejects this half on its own.`)
    process.exit(0)
  }

  console.log(`\n${rows} rows · ${pass ? "ALL PASS" : "FAILURES ABOVE"}`)
  console.log(join(OUT, `attrs-${ENGINE}-${WORD}.json`))
  process.exit(pass ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
