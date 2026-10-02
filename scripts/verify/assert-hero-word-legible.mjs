// ASSERT-HERO-WORD-LEGIBLE — arbitrary text renders as LETTERS, at any length.
//
// Sebs, 2026-08-02: *"the 3d text is fully distorted worse when u type ur own
// text."*
//
// ── WHAT WAS WRONG, IN TWO PARTS ────────────────────────────────────────────
//
//  1. **The font had seven glyphs** — `D e s k o d l` and a space. Twenty of the
//     twenty-five characters in "the quick brown fox jumps" drew NOTHING, which
//     is why the capture on disk is five discs: they are the `e`, the `k`, the
//     two `o`s and the `s`, each alone in its own dead space.
//     (`docs/verification/drawin-holes/sweep-long/carve-0.png`, comps 5.)
//
//  2. **The nib did not scale with the glyph.** `k = FONT_TARGET_W / laid.width`
//     squeezed the word to a fixed span while `HERO_INK_WIDTH_PX` stayed put, so
//     the ratio that decides whether a letterform survives —
//
//         R = nib diameter / cap height
//
//     — ran from 0.029 on `"ok"` to 0.378 on a 29-character line. The hero
//     itself is 0.175.
//
// ── THE THRESHOLD, AND WHERE IT COMES FROM ──────────────────────────────────
//
// `_probe-font-legibility.mjs` rasterises the nib as the disc it actually is,
// sweeps R against every glyph in the font, and bisects the ratio at which each
// one stops looking the way it looks at the hero's own weight. The minimum over
// the font is **R = 0.2176**, and the glyph that sets it is Sebs's `e` — its eye
// closes there. That is the number this gate holds the page to, and it is read
// back OUT of the probe rather than restated, so the two cannot drift.
//
// ── THE CONTROL, WHICH IS THE POINT ─────────────────────────────────────────
//
// docs/DISPATCH.md §2.6: *"Calibrate the instrument against a known-bad input
// and require it to fail."* The known-bad is not a synthetic fixture — it is the
// SHIPPED LAW, still reachable on the Scale pill as `"fit"`, driven through the
// real UI. Every row below runs against both arms, and a run in which `fit`
// does not fail on the long rungs is a run that proves nothing.
//
// Usage: node scripts/verify/assert-hero-word-legible.mjs [--label=gate] [--reuse=<label>]
import { execFileSync } from "node:child_process"
import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createHash } from "node:crypto"
import { layoutWord, measureWord, SUPPORTED, fold } from "../capture/letters.mjs"
import { loadTs } from "./_ts-load.mjs"
import { INK, SHIPPED_R, breakRatio, refTopology } from "./_probe-font-legibility.mjs"
import { frameTopology } from "./_probe-word-topology.mjs"
import { LADDER } from "./_probe-word-ladder.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "gate")
const REUSE = arg("reuse", "")
/**
 * WHICH LAW IS UNDER TEST — and the switch that proves this gate can fail.
 *
 * docs/DISPATCH.md §2.6. Every row below is written against `LAW` and its
 * control against the other arm, so `--law=fit` re-points the whole instrument
 * at the SHIPPED DEFECT. It must come back with the letterform rows red and the
 * control rows red too (the control of a broken arm is the working one, which
 * does not fail). That run is the calibration, and it is recorded in the lane's
 * return rather than asserted here — a gate that grades its own inversion is
 * back to marking its own homework.
 */
const LAW = arg("law", "fixed")
const CTRL = LAW === "fixed" ? "fit" : "fixed"

const { assignLetters } = loadTs("lib/hero-letters.ts")
const { DEFAULT_HERO_MOTION } = loadTs("lib/hero-motion.ts")
/* THE PAGE'S OWN STROKE LIST, NOT THE FILE'S. See the O5 row below: this gate
 * read `logo-strokes.json` straight off disk while `app/desk-doodles/page.tsx`
 * draws it through `dropSubNibStubs`, so the two were counting different words. */
const { dropSubNibStubs } = loadTs("lib/pen-reveal.ts")

const FONT_TARGET_W = 1100
const FONT_BASELINE_Y = 400
const DD_WIDTH = measureWord("Desk Doodles", { x: 0, y: 0, size: 120, tracking: 12 })
const FONT_SCALE = FONT_TARGET_W / DD_WIDTH

let pass = true
let rows = 0
const say = (ok, label, detail) => {
  rows++
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}
const h = (o) => createHash("sha256").update(JSON.stringify(o)).digest("hex").slice(0, 16)

/* ═══════════════════════════════════════════════════════════════════════════
 * PART 1 — THE GEOMETRY. No browser: these are facts about the font and the
 * scale law, and a fact that needs a GPU to check is a fact nobody checks.
 * ═══════════════════════════════════════════════════════════════════════════ */
console.log("\n── 1 · THE SCALE LAW AND ITS THRESHOLD ─────────────────────────────\n")
console.log(`  nib                    ${INK.toFixed(4)} stroke px`)
console.log(`  hero cap height        ${(120 * FONT_SCALE).toFixed(4)} stroke px`)
console.log(`  hero R                 ${SHIPPED_R.toFixed(4)}`)

/* The ceiling, DERIVED here and then required to match what the page believes.
 * A constant copied into a component and a constant computed by a probe are two
 * sources of truth for one number, which is this repo's most expensive defect
 * class; this row is what makes them one. */
const chars = [...SUPPORTED].filter((c) => c !== " ")
let worstCh = null
let ceiling = Infinity
for (const ch of chars) {
  const br = breakRatio(ch)
  if (br !== null && br < ceiling) {
    ceiling = br
    worstCh = ch
  }
}
console.log(`  font ceiling R_max     ${ceiling.toFixed(4)}  (set by ${JSON.stringify(worstCh)})\n`)

const pageSrc = readFileSync(join(ROOT, "app/desk-doodles/page.tsx"), "utf8")
const declared = Number((pageSrc.match(/const FONT_R_CEILING = ([\d.]+)/) ?? [])[1])
say(
  Number.isFinite(declared) && Math.abs(declared - ceiling) < 0.0005,
  "the page's FONT_R_CEILING is the ratio the probe actually measures",
  `page ${declared} vs probe ${ceiling.toFixed(4)}`,
)
say(
  worstCh === "e",
  "the font's limit is an AUTHORED letterform, not a glyph this lane drew",
  `set by ${JSON.stringify(worstCh)}`,
)
say(
  SHIPPED_R < ceiling,
  "the hero's own weight sits under the ceiling",
  `${SHIPPED_R.toFixed(4)} < ${ceiling.toFixed(4)} (${(ceiling / SHIPPED_R).toFixed(2)}x margin)`,
)

/* ---- BYTE-IDENTITY. The hero word and the trace may not move. ------------ */
console.log("")
const laidDD = layoutWord("Desk Doodles", { x: 0, y: 0, size: 120, tracking: 12 })
const kDD = FONT_TARGET_W / laidDD.width
const scaledDD = laidDD.polylines.map((pl) =>
  pl.map((p) => ({ x: p.x * kDD, y: FONT_BASELINE_Y + p.y * kDD })),
)
/* Frozen from the implementation as it stood BEFORE this lane — recomputed from
 * `git show HEAD:scripts/capture/letters.mjs` plus the sibling lane's
 * `letterOf` addition, not copied out of the new code. A self-comparison would
 * pass no matter what changed. */
const PRIOR_STROKES = "31cdd923a6880f37"
const PRIOR_LETTERMAP = "b8bf53156dbb8fb0"
const PRIOR_TRACED = "6205b9570c0ed67d"
const PRIOR_K = 1.0758998435054774
say(h(scaledDD) === PRIOR_STROKES, `"Desk Doodles" strokes are byte-identical to the shipped word`, h(scaledDD))
say(
  h({ of: laidDD.letterOf, count: laidDD.letterCount }) === PRIOR_LETTERMAP,
  `"Desk Doodles" authored letter map is unchanged`,
  `${laidDD.letterCount} letters`,
)
say(kDD === PRIOR_K && FONT_SCALE === PRIOR_K, "the hero word's scale k is bit-for-bit unchanged", String(FONT_SCALE))
const traced = JSON.parse(readFileSync(join(ROOT, "scripts/capture/logo-strokes.json"), "utf8"))
say(h(traced.polylines) === PRIOR_TRACED, "the TRACED word is untouched", h(traced.polylines))

/* ---- O5's LETTER MAP, RE-CALIBRATED ------------------------------------
 * `lib/hero-letters.ts` grew a SEED, so its documented answers have to be
 * re-established rather than assumed: the font's authored map reproduced
 * exactly, and the traced word's own count. The trace passes no seed.
 *
 * ⚠ THIS ROW SAID **8** AND IT WAS ASSERTING A NUMBER NOTHING RENDERED.
 * 8 is the pure ink law at a reach of one whole nib — which is the TANGENCY
 * distance, where two nibs share a point of zero area. Two authored words say
 * that reach is wrong (`assert-hero-options.mjs`'s LETTER MAP rows: 21 letters
 * came back as 10), and the page was meanwhile running the same law over the
 * hand-feel-PROTRUDED ink and getting **6**. So this row was green on a third
 * number, belonging to neither the law's calibration nor the screen.
 *
 * **10** is the law at `LETTER_REACH_FRAC` over the pen's own paths, and it is
 * `D · e · sk · D · o · o · d · l · e · s` — one bound pair, the `s-k`, which is
 * exactly the content-double board §4 O5 sanctions by name. It is asserted
 * against the MODEL's own default rather than as a literal, so the two cannot
 * drift apart again the way 8 and 6 did.
 *
 * ⚠ AND THE LITERAL DID DRIFT, EXACTLY AS THAT SENTENCE SAID IT MUST NOT —
 * because the row asserted BOTH, and only one half was derived. Corrected
 * 2026-09-04, measured, not reasoned:
 *
 *     logo-strokes.json as it sits on disk    22 polylines   10 pieces
 *     the same file as the PAGE draws it      13 polylines   11 pieces
 *
 * `app/desk-doodles/page.tsx:177` passes `dropSubNibStubs: true`, and
 * `lib/pen-reveal.ts`'s `stampPenClock` applies it BEFORE either clock, so the
 * word that reaches the screen is 13 strokes and never 22. This gate was reading
 * the file. Nine sub-nib taps the trace kept were still in its count and two of
 * them BRIDGED the `s` to the `k`, which is the whole of the difference between
 * 10 and 11.
 *
 * The measured map over the page's own list is
 * `[0,1,2,3,3,4,5,6,7,8,9,10,10]` — `D · e · s · k · D · o · o · d · l · e · s`,
 * bit for bit the map `lib/hero-motion.ts:1648` states beside `letterCount: 11`.
 * ⭐ THE MODEL WAS RIGHT AND THE RULER WAS STALE. The stub filter landed
 * 2026-08-28, the default moved with it, and this row did not.
 *
 * So the literal is GONE. Both sides of the row are now derived — the count off
 * the page's stroke list, the expectation off the model — and the row can only
 * go red on a real disagreement between the two, which is what it was for. */
const tracedKept = dropSubNibStubs(traced.polylines, INK)
const tracedStrokes = tracedKept.map((pl) => ({ points: pl }))
const tracedMap = assignLetters(tracedStrokes, INK)
/* THE FILTER HAS TO HAVE DONE SOMETHING. A `dropSubNibStubs` that silently
 * returned its input — an unset nib, a renamed export, an import that resolved
 * to a stub — would make the row above read the 22-polyline file again and
 * quietly restore the defect this correction removes. It is a number, not an
 * assumption. */
say(
  tracedKept.length < traced.polylines.length,
  "the stub filter the PAGE applies actually ran on this gate's copy of the word",
  `${traced.polylines.length} polylines on disk -> ${tracedKept.length} drawn ` +
    `(dropSubNibStubs at nib ${INK.toFixed(2)}). app/desk-doodles/page.tsx:177 is the caller.`,
)
say(
  tracedMap.count === DEFAULT_HERO_MOTION.letterCount,
  "O5 — the TRACED word, as the page draws it, measures the same pieces as the model's default",
  `${tracedMap.count} pieces [${tracedMap.of.join(",")}] over ${tracedStrokes.length} strokes · ` +
    `DEFAULT_HERO_MOTION.letterCount ${DEFAULT_HERO_MOTION.letterCount}. ` +
    `Neither side is a literal: the count is measured off the page's own stroke list, ` +
    `the expectation is read off the model.`,
)
/* ── AND THE ROW CAN STILL GO RED, PROVED IN THE SAME RUN ──────────────────
 * §2.6: calibrate against a known-bad and require it to FAIL. The known-bad is
 * not synthetic — it is THIS GATE AS IT SHIPPED THIS MORNING, the unfiltered
 * 22-polyline file, graded by the same `assignLetters` at the same nib against
 * the same model default. If that arm ever AGREES, the filter has stopped
 * separating the two words and the row above is passing on a comparison that
 * cannot resolve anything. */
const tracedMapUnfiltered = assignLetters(
  traced.polylines.map((pl) => ({ points: pl })),
  INK,
)
say(
  tracedMapUnfiltered.count !== DEFAULT_HERO_MOTION.letterCount,
  "CONTROL — the PARKED reading (the file unfiltered, as this gate read it until 2026-09-04) DISAGREES with the model",
  `unfiltered ${tracedMapUnfiltered.count} pieces over ${traced.polylines.length} strokes against ` +
    `letterCount ${DEFAULT_HERO_MOTION.letterCount}` +
    (tracedMapUnfiltered.count === DEFAULT_HERO_MOTION.letterCount
      ? " — IT AGREED, so the row above is measuring nothing"
      : " — the two words are different words, which is why the row above had to change"),
)
const fontMapNoSeed = assignLetters(
  laidDD.polylines.map((pl) => ({ points: pl.map((p) => ({ x: p.x * kDD, y: FONT_BASELINE_Y + p.y * kDD })) })),
  INK,
)
say(
  fontMapNoSeed.count === laidDD.letterCount &&
    fontMapNoSeed.of.every((v, i) => v === laidDD.letterOf[i]),
  "O5 — the ink law alone still reproduces the font's authored 11-letter map exactly",
  `${fontMapNoSeed.count} letters, ${fontMapNoSeed.of.join(",")}`,
)

/* ---- COVERAGE. Nothing in the ladder may silently draw as blank. --------- */
console.log("")
const missing = new Set()
for (const rung of LADDER) for (const ch of rung.text) if (fold(ch) === null) missing.add(ch)
say(missing.size === 0, "every character in the ladder is drawable", missing.size ? [...missing].join("") : `${chars.length} glyphs`)

/* ---- THE LADDER, IN GEOMETRY. Both laws, and the control must break. ----- */
console.log("\n── 2 · R AND THE LETTER MAP, PER RUNG, PER LAW ─────────────────────\n")
console.log("  law    rung         R        lines  letters  map   verdict")
const geo = { fixed: [], fit: [] }
for (const law of [LAW, CTRL]) {
  for (const rung of LADDER) {
    const maxWidth = law === "fixed" ? FONT_TARGET_W / FONT_SCALE : 0
    const laid = layoutWord(rung.text, { x: 0, y: 0, size: 120, tracking: 12, maxWidth })
    const k = law === "fit" ? FONT_TARGET_W / laid.width : FONT_SCALE
    const R = INK / (120 * k)
    const baseY = FONT_BASELINE_Y - (((laid.lineCount - 1) * laid.lineHeight) / 2) * k
    const strokes = laid.polylines.map((pl) => ({
      points: pl.map((p) => ({ x: p.x * k, y: baseY + p.y * k })),
    }))
    const map = assignLetters(strokes, INK, laid.letterOf)
    /* AND THE SAME RUNG UNDER THE REACH THIS GATE WAS WRITTEN AGAINST. See the
     * control below: 1.0 nib is the tangency distance and it fuses letters that
     * share no area at all. Carried per rung so the control is the shipped
     * configuration rather than a strawman. */
    const mapPriorReach = assignLetters(strokes, INK, laid.letterOf, 1.0)
    const ok = R <= ceiling
    geo[law].push({
      ...rung,
      R,
      lineCount: laid.lineCount,
      letterCount: laid.letterCount,
      mapCount: map.count,
      mapCountPriorReach: mapPriorReach.count,
      ok,
    })
    console.log(
      `  ${law.padEnd(6)} ${rung.id.padEnd(12)} ${R.toFixed(4)}   ${laid.lineCount}     ${String(laid.letterCount).padStart(3)}    ` +
        `${String(map.count).padStart(3)}   ${ok ? "under the ceiling" : "OVER — counters close"}`,
    )
  }
}
console.log("")
say(
  geo[LAW].every((r) => r.ok),
  `${LAW.toUpperCase()} LAW: every rung's R is under the font's ceiling`,
  `max ${Math.max(...geo[LAW].map((r) => r.R)).toFixed(4)} <= ${ceiling.toFixed(4)}`,
)
say(
  geo[LAW].every((r) => r.mapCount === r.letterCount),
  `${LAW.toUpperCase()} LAW: the measured letter map reproduces the authored one on every rung`,
  geo[LAW].map((r) => `${r.mapCount}/${r.letterCount}`).join(" "),
)
/* ⚠ THE CONTROL. */
const brokenUnderFit = geo[CTRL].filter((r) => !r.ok)
say(
  brokenUnderFit.length >= 3,
  `CONTROL (${CTRL}) — the other law breaks the ceiling on the long rungs`,
  brokenUnderFit.length
    ? brokenUnderFit.map((r) => `${r.id} R=${r.R.toFixed(3)}`).join(", ")
    : "IT DID NOT FAIL, so this gate is measuring nothing",
)
/* ⚠ THIS CONTROL WAS REPAIRED BY A FIX, WHICH MAKES IT NOT A CONTROL.
 *
 * It used to read `geo[CTRL].some((r) => r.mapCount !== r.letterCount)` — the
 * fit law crushing rungs until the letter map fused them. It stopped failing,
 * and the reason is the finding: the letter law's reach was ONE WHOLE NIB, the
 * distance at which two round nibs share a single tangent point and no area at
 * all, so it fused letters that merely passed near each other. Corrected to
 * `LETTER_REACH_FRAC` the map now survives the fit law on every rung — which is
 * a better law and a dead control at the same time.
 *
 * So the control is the shipped configuration, whole: the FIT law AND the reach
 * it was calibrated with. That still fuses, and it is the pair that shipped. */
{
  const fused = geo[CTRL].filter((r) => r.mapCountPriorReach !== r.letterCount)
  const survives = geo[CTRL].every((r) => r.mapCount === r.letterCount)
  say(
    fused.length > 0 && survives,
    `CONTROL (${CTRL} + the shipped 1.0-nib reach) — that pair fuses letters the authored map keeps apart`,
    fused.length
      ? `at 1.0 nib: ${fused.map((r) => `${r.id} ${r.mapCountPriorReach}/${r.letterCount}`).join(", ")} — ` +
          `at ${"" + geo[CTRL].length} rungs the corrected reach loses none`
      : "IT DID NOT FAIL",
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
 * PART 3 — THE PIXELS. Through the real UI, in real Chrome on the real GPU,
 * because a geometry that is legible on paper and a page that renders it are
 * different claims. docs/DISPATCH.md §3.
 * ═══════════════════════════════════════════════════════════════════════════ */
console.log("\n── 3 · WHAT THE PAGE ACTUALLY RENDERED ─────────────────────────────\n")
const dir = join(ROOT, "docs", "verification", "word-ladder", REUSE || LABEL)
if (!REUSE) {
  console.log("  capturing both arms through the real UI (this takes a few minutes)…\n")
  execFileSync("node", [join(__dirname, "_probe-word-ladder.mjs"), `--label=${LABEL}`], {
    stdio: "inherit",
    cwd: ROOT,
  })
} else {
  console.log(`  reusing frames from ${dir}\n`)
}
say(existsSync(join(dir, "fixed")) && existsSync(join(dir, "fit")), "both arms captured", dir)

/**
 * PIECES PER LETTER — how much of the word did NOT fuse.
 *
 * The bar is 0.50 and it is set from the measured separation, with the two arms
 * a factor of two clear on either side of it. Under the shipped law the worst
 * rung is 0.67 ("Sebastian", whose `S` and `e` genuinely touch); under the
 * parked prior the two longest rungs are 0.24 and 0.15, i.e. a 25-character
 * sentence rendering as four or five lumps. Nothing lands near 0.50.
 */
const PIECE_BAR = 0.5
console.log("  law    rung         counters  pieces  letters  pieces/letter")
const px = { fixed: [], fit: [] }
for (const law of [LAW, CTRL]) {
  for (const rung of LADDER) {
    const f = join(dir, law, `${rung.id}.png`)
    if (!existsSync(f)) {
      say(false, `${law}/${rung.id} frame exists`, f)
      continue
    }
    const t = await frameTopology(f)
    const g = geo[law].find((r) => r.id === rung.id)
    const wantCounters = [...rung.text].reduce((a, ch) => a + (ch === " " ? 0 : refTopology(ch)?.counters ?? 0), 0)
    const ratio = t.pieces / g.letterCount
    px[law].push({ id: rung.id, ...t, wantCounters, letters: g.letterCount, ratio })
    console.log(
      `  ${law.padEnd(6)} ${rung.id.padEnd(12)} ${String(t.counters).padStart(4)}/${String(wantCounters).padEnd(4)} ` +
        `${String(t.pieces).padStart(5)}   ${String(g.letterCount).padStart(5)}    ${ratio.toFixed(2)}`,
    )
  }
}
console.log("")
say(
  px[LAW].every((r) => r.inkPx > 0),
  `${LAW.toUpperCase()} LAW: every rung actually rendered ink`,
  px[LAW].map((r) => r.inkPx).join(" "),
)
say(
  px[LAW].every((r) => r.ratio >= PIECE_BAR),
  `${LAW.toUpperCase()} LAW: the word comes apart into letters at every length (>= ${PIECE_BAR} pieces per letter)`,
  `worst ${Math.min(...px[LAW].map((r) => r.ratio)).toFixed(2)}`,
)
say(
  px[LAW].every((r) => r.wantCounters === 0 || r.counters > 0),
  `${LAW.toUpperCase()} LAW: counters survive on every rung that has one`,
  px[LAW].map((r) => `${r.counters}/${r.wantCounters}`).join(" "),
)
/* ⚠ THE CONTROL, IN PIXELS. */
const collapsed = px[CTRL].filter((r) => r.ratio < PIECE_BAR)
say(
  collapsed.length >= 3,
  `CONTROL (${CTRL}) — the other law renders long text as fused lumps`,
  collapsed.length
    ? collapsed.map((r) => `${r.id} ${r.pieces}pcs/${r.letters}ltr`).join(", ")
    : "IT DID NOT FAIL, so this gate is measuring nothing",
)
const blinded = px[CTRL].filter((r) => r.wantCounters > 0 && r.counters === 0)
say(
  blinded.length >= 1,
  `CONTROL (${CTRL}) — the other law closes every counter on the longest rungs`,
  blinded.length ? blinded.map((r) => r.id).join(", ") : "IT DID NOT FAIL",
)

console.log(`\n${pass ? "ALL PASS" : "FAILURES ABOVE"} — ${rows} rows`)
process.exit(pass ? 0 : 1)
