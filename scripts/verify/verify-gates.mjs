// Phase-gate checks that are assertions, not pictures.
//
//   1. GEOMETRY REBUILD GATE — the PRD's hard requirement: "changing style
//      state updates preview without rebuilding geometry". Counts the actual
//      number of geometry builds (via a dev counter on window) across a big
//      sweep of style changes; must stay flat.
//   2. EXPORT REGRESSION — every mode still exports a non-empty GLB with the
//      style layer active.
//   3. TAXONOMY GATE — texture presets must never write dither/ascii state.
//
// Usage: node scripts/verify/verify-gates.mjs [--mutate=rebuild|skip]
//
// ⚠ THREE DEFECTS FIXED HERE 2026-08-01 (lane 23, the re-verification). All three
// were in the HARNESS, not the subject — §17.4: fix the check, never the surface.
//
//   a. `headless: false`. This file was the last browser harness in the repo that
//      took over the screen. Every other one runs headless with `--use-angle=metal`,
//      which is measured equivalent (2026-07-30: 121 rAF ticks headless vs 120
//      headed, identical renderer string) and is Sebs's standing preference. A
//      gate that cannot be run while he is at the machine is a gate that does not
//      get run.
//   b. `viewport: 1400x900`. Below the 1440x1440 floor. The stage is squeezed by
//      the timeline dock at small heights — one gate in this repo passed on a
//      third-scale subject for its entire life. Nothing here reads pixels, so the
//      old number was not producing a wrong answer, but a harness that disagrees
//      with the floor is one copy-paste away from one that does.
//   c. ⚠ THE SKIP WAS SCORED AS A PASS. `if (after < before)` printed `SKIP` and
//      then fell through WITHOUT touching `pass`, so a run in which all four
//      geometry-rebuild gates skipped still printed `ALL GATES PASS` and exited 0.
//      That is precisely the "green row that cannot fail" class this repo keeps
//      re-learning, and it sat on the one gate `docs/DISPATCH.md` §3 singles out:
//      *"verify-gates.mjs must be ALL PASS — a SKIP is not a pass."* A skip now
//      exits 3, the same code `_run-clean.mjs` uses for a contaminated run, which
//      means the same thing: DISCARD and repeat, never adjust.
//
// `--mutate=` is the negative control required by §17.4. `rebuild` forces a real
// geometry rebuild inside the style sweep (gate 1 must go red); `skip` forces the
// buildCount-decrease branch (the run must exit 3, not 0). A gate that cannot be
// made to fail has not been proved to work.
//
// ⚠ A FOURTH DEFECT, 2026-08-03, AND IT IS THE SAME SHAPE AS (c): ONE INVENTORY
// HAD STOPPED BEING MAINTAINED. `TEXTURES` was written out by hand as
//
//     ["grain", "noise", "scanlines", "bands", "contour"]
//
// while `TextureMode` (lib/style-system.ts:80-94) and the panel's own
// `TEXTURE_MODES` pills (:1136) both carry FOURTEEN. Nine texture modes —
// procedural, crosshatch, dots, woodgrain, cellular, brushed, craquelure,
// ripple — had never once been through gate 1, which is the gate that proves
// changing style state does not rebuild geometry. The tell is that the three
// sibling lists were complete: DITHERS 10 of 10, ASCII 10 of 10, MODES 4 of 4.
// A list that is right on three axes and stale on the fourth is not an
// oversight anybody can see by reading; it is only visible by counting.
//
// So it is not written out any more. `TEXTURES` is READ OUT OF
// `lib/style-system.ts` — the panel's own `TEXTURE_MODES` array, minus "none",
// because "none" is not a texture to sweep — and cross-checked against the
// `TextureMode` union in the same file, so a mode added to the type without a
// pill (or the reverse) fails the gate instead of quietly halving its coverage.
// The same is done for DITHERS and ASCII: they are correct today, and the
// reason they are correct is that somebody remembered, which is the thing this
// change removes the need for.
import { chromium } from "./lib/browser.mjs"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { LAB_URL } from "./lib/dev-server.mjs"

const MUTATE = (process.argv.find((a) => a.startsWith("--mutate=")) || "").split("=")[1] || ""

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const STYLE_SRC = readFileSync(join(ROOT, "lib", "style-system.ts"), "utf8")

/** The ids of a `PresetShell<...>[]` list, in the order the panel shows them. */
const presetIds = (name) => {
  const m = STYLE_SRC.match(new RegExp(`export const ${name}: PresetShell<[^>]+>\\[\\] = \\[([\\s\\S]*?)\\n\\]`))
  if (!m) throw new Error(`verify-gates: could not read ${name} out of lib/style-system.ts`)
  return [...m[1].matchAll(/\{\s*id:\s*"([^"]+)"/g)].map((x) => x[1])
}
/* The members of a string-union type declaration.
 *
 * Scanned line by line and stopped at the first line that is not a `| "member"`
 * continuation, rather than at the first blank line: `DitherType` is followed
 * IMMEDIATELY by `DitherDirection` with no blank between them, and a blank-line
 * terminator silently swallowed `horizontal | vertical | diagonal` into the
 * dither list. A parser that over-reads is the same defect as a hand-written
 * list that under-reads — it just fails in the other direction. */
const unionMembers = (name) => {
  const lines = STYLE_SRC.split("\n")
  const at = lines.findIndex((l) => l.startsWith(`export type ${name} =`))
  if (at < 0) throw new Error(`verify-gates: could not read type ${name} out of lib/style-system.ts`)
  const out = []
  for (let i = at; i < lines.length; i++) {
    const t = lines[i].trim()
    if (i > at && !t.startsWith("|")) break
    const m = t.match(/\|\s*"([^"]+)"/)
    if (m) out.push(m[1])
  }
  return out
}

const MODES = ["rod", "extrude", "solid", "inflate"]
/* PARKED — what these three used to be, written out by hand. Only TEXTURES was
 * wrong, and only on one axis, which is exactly why it survived:
 *   TEXTURES = ["grain","noise","scanlines","bands","contour"]                  (5 of 14)
 *   DITHERS  = ["bayer4",…,"newsprint"]                                        (10 of 10)
 *   ASCII    = ["classic",…,"numeric"]                                         (10 of 10) */
const INVENTORIES = [
  { name: "texture", list: "TEXTURE_MODES", type: "TextureMode" },
  { name: "dither", list: "DITHER_PRESETS", type: "DitherType" },
  { name: "ascii", list: "ASCII_PRESETS", type: "AsciiCharset" },
].map((i) => {
  const ids = presetIds(i.list)
  const union = unionMembers(i.type)
  return { ...i, ids, union, missing: union.filter((u) => !ids.includes(u)) }
})
const inv = (n) => INVENTORIES.find((i) => i.name === n)
const TEXTURES = inv("texture").ids.filter((t) => t !== "none")
const DITHERS = inv("dither").ids.filter((d) => d !== "none")
const ASCII = inv("ascii").ids.filter((a) => a !== "none")
const STYLE_CHANGES_PER_MODE = (TEXTURES.length + DITHERS.length + ASCII.length) * 2

function testStroke() {
  const pts = []
  for (let i = 0; i <= 100; i++) {
    const t = i / 100
    pts.push({ x: 140 + t * 560, y: 340 + Math.sin(t * Math.PI * 2) * 120 })
  }
  return [pts]
}

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 1440 } })
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 200))
  })
  // ONE KNOB, ONE NAME: `FS_PORT`, resolved in `lib/dev-server.mjs`. This line
  // used to read `LAB_URL ?? http://localhost:${FS_PORT || 3000}` — two names
  // for one thing, added by two lanes that did not know about each other.
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__styleHarness && window.__geomDebug, null, { timeout: 30000 })
  await page.evaluate((poly) => window.__styleHarness.injectStrokes(poly, { msPerPoint: 12 }), testStroke())
  await page.waitForTimeout(1500)

  let pass = true
  const skipped = []
  const say = (ok, label, detail) => {
    if (!ok) pass = false
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
  }
  /** A SKIP is not a PASS. It is an un-run row, and it ends the run. */
  const skip = (label, detail) => {
    skipped.push(label)
    console.log(`SKIP  ${label}${detail ? " — " + detail : ""}`)
  }

  // ---- 0. THE INVENTORIES THIS GATE SWEEPS ARE THE ONES THE APP HAS -----
  //
  // Gate 1's answer is only as wide as its lists, and one of those lists was
  // 5 of 14 for however long it took nobody to count. These rows put the width
  // itself under assertion: the sweep set is the panel's own preset array, and
  // it has to account for every member of the corresponding union type. A mode
  // added to `TextureMode` without a pill, or a pill added without a type
  // member, fails here rather than halving gate 1 in silence.
  for (const i of INVENTORIES) {
    console.log(`  ${i.name.padEnd(8)} ${i.list} has ${i.ids.length} — ${i.ids.join(", ")}`)
    say(
      i.missing.length === 0,
      `inventory / every ${i.type} member is reachable as a ${i.list} pill`,
      `${i.union.length} in the type, ${i.ids.length} pills${i.missing.length ? `, MISSING: ${i.missing.join(", ")}` : ""}`,
    )
  }
  say(
    TEXTURES.length >= 13,
    "inventory / the texture sweep is the whole set, not the five it used to be",
    `${TEXTURES.length} textures swept (the parked hand-written list had 5)`,
  )

  // ---- 1. geometry rebuild gate ----------------------------------------
  for (const mode of MODES) {
    await page.evaluate((m) => window.__styleHarness.setMode(m), mode)
    await page.waitForTimeout(800)
    const before = await page.evaluate(() => window.__geomDebug.buildCount())
    for (const tex of TEXTURES) {
      for (const intensity of [0.3, 0.9]) {
        await page.evaluate(
          ({ tex, intensity }) =>
            window.__styleHarness.setStyle({
              textureEnabled: true,
              textureMode: tex,
              textureIntensity: intensity,
              textureScale: 1 + intensity,
              textureAnimated: true,
              motionMode: "independent",
            }),
          { tex, intensity },
        )
        await page.waitForTimeout(80)
      }
    }
    for (const dit of DITHERS) {
      for (const levels of [2, 5]) {
        await page.evaluate(
          ({ dit, levels }) =>
            window.__styleHarness.setStyle({
              ditherEnabled: true,
              ditherType: dit,
              ditherLevels: levels,
              ditherScale: 3 + levels,
              ditherAnimated: true,
              ditherDirection: "diagonal",
              motionMode: "independent",
            }),
          { dit, levels },
        )
        await page.waitForTimeout(80)
      }
    }
    for (const cs of ASCII) {
      for (const cell of [8, 16]) {
        await page.evaluate(
          ({ cs, cell }) =>
            window.__styleHarness.setStyle({
              asciiEnabled: true,
              asciiCharset: cs,
              asciiCellSize: cell,
              asciiAnimated: true,
              asciiAnimationType: "scroll",
              motionMode: "independent",
            }),
          { cs, cell },
        )
        await page.waitForTimeout(80)
      }
    }
    // NEGATIVE CONTROL (--mutate=rebuild): a mode switch DOES rebuild geometry,
    // so slipping one in here must drive gate 1 red. If it does not, gate 1 is
    // not reading the counter it claims to read.
    if (MUTATE === "rebuild") {
      await page.evaluate((m) => window.__styleHarness.setMode(m), mode === "rod" ? "solid" : "rod")
      await page.waitForTimeout(800)
    }
    await page.waitForTimeout(300)
    let after = await page.evaluate(() => window.__geomDebug.buildCount())
    // NEGATIVE CONTROL (--mutate=skip): force the decrease branch and prove the
    // run now ends non-zero instead of printing ALL GATES PASS.
    if (MUTATE === "skip") after = before - 1
    // A DECREASE is impossible from rebuilding — the counter only increments.
    // It means the module re-initialised, i.e. the dev server hot-reloaded
    // mid-run (common when an agent is editing files concurrently).
    //
    // ⚠ THIS USED TO FALL THROUGH AS A PASS. It does not any more: an un-run row
    // is not a green row. `_run-clean.mjs` already detects the sibling save that
    // causes this, and the correct response to both is identical — discard the
    // run and repeat it.
    if (after < before) {
      skip(`geometry-rebuild gate / ${mode}`, `page reloaded mid-test (buildCount ${before} → ${after}); re-run when the tree is stable`)
    } else {
      // The count is COMPUTED. It read "(30 style changes)" while the loops
      // performed 5x2 + 10x2 + 10x2 = 50, and a label that disagrees with its
      // own loops is how a shrunken sweep goes unnoticed.
      say(
        after === before,
        `geometry-rebuild gate / ${mode}`,
        `buildCount ${before} → ${after} (${STYLE_CHANGES_PER_MODE} style changes: ` +
          `${TEXTURES.length} textures + ${DITHERS.length} dithers + ${ASCII.length} charsets, x2 each)`,
      )
    }
  }

  // ---- 2. export regression ---------------------------------------------
  for (const mode of MODES) {
    await page.evaluate((m) => window.__styleHarness.setMode(m), mode)
    await page.waitForTimeout(800)
    const bytes = await page.evaluate(() => window.__geomDebug.exportBytes())
    say(typeof bytes === "number" && bytes > 1000, `export / ${mode}`, `${bytes} bytes`)
  }

  // ---- 3. taxonomy gate --------------------------------------------------
  await page.evaluate(() =>
    window.__styleHarness.setStyle({
      ditherEnabled: false,
      asciiEnabled: false,
      textureEnabled: true,
      textureMode: "scanlines",
    }),
  )
  await page.waitForTimeout(200)
  const s = await page.evaluate(() => window.__styleHarness.get().styleState)
  say(!s.ditherEnabled, "taxonomy / texture does not enable dither")
  say(!s.asciiEnabled, "taxonomy / texture does not enable ascii")

  // Dither presets must write ONLY dither* state — never textureMode/ascii.
  await page.evaluate(() =>
    window.__styleHarness.setStyle({
      textureEnabled: false,
      textureMode: "none",
      ditherEnabled: false,
      asciiEnabled: false,
    }),
  )
  await page.waitForTimeout(150)
  await page.evaluate(() => window.__styleHarness.selectPreset("dither", "dotMatrix"))
  await page.waitForTimeout(200)
  const s2 = await page.evaluate(() => window.__styleHarness.get().styleState)
  say(s2.ditherEnabled && s2.ditherType === "halftone", "dither preset / dotMatrix applies", `type=${s2.ditherType}`)
  say(s2.textureMode === "none" && !s2.textureEnabled, "taxonomy / dither preset does not touch texture")
  say(!s2.asciiEnabled, "taxonomy / dither preset does not touch ascii")

  // ASCII presets must write ONLY ascii* state.
  await page.evaluate(() =>
    window.__styleHarness.setStyle({
      textureEnabled: false,
      textureMode: "none",
      ditherEnabled: false,
      asciiEnabled: false,
    }),
  )
  await page.waitForTimeout(150)
  await page.evaluate(() => window.__styleHarness.selectPreset("ascii", "blockGlyph"))
  await page.waitForTimeout(200)
  const s3 = await page.evaluate(() => window.__styleHarness.get().styleState)
  say(s3.asciiEnabled && s3.asciiCharset === "blocks", "ascii preset / blockGlyph applies", `charset=${s3.asciiCharset}`)
  say(s3.textureMode === "none" && !s3.textureEnabled, "taxonomy / ascii preset does not touch texture")
  say(!s3.ditherEnabled, "taxonomy / ascii preset does not touch dither")

  // All three systems on at once must not error or rebuild geometry.
  const stackBefore = await page.evaluate(() => window.__geomDebug.buildCount())
  await page.evaluate(() =>
    window.__styleHarness.setStyle({
      textureEnabled: true,
      textureMode: "scanlines",
      textureAnimated: true,
      ditherEnabled: true,
      ditherType: "bayer4",
      ditherAnimated: true,
      asciiEnabled: true,
      asciiCharset: "classic",
      asciiAnimated: true,
      asciiAnimationType: "scroll",
      motionMode: "independent",
    }),
  )
  await page.waitForTimeout(600)
  const stackAfter = await page.evaluate(() => window.__geomDebug.buildCount())
  say(stackAfter === stackBefore, "all three systems stacked / no geometry rebuild", `buildCount ${stackBefore} → ${stackAfter}`)
  const stackBytes = await page.evaluate(() => window.__geomDebug.exportBytes())
  say(stackBytes > 1000, "all three systems stacked / export still works", `${stackBytes} bytes`)

  say(errors.length === 0, "console errors", `${errors.length}${errors.length ? ": " + errors[0] : ""}`)

  await browser.close()
  if (skipped.length) {
    console.log(`\n${skipped.length} GATE(S) SKIPPED — A SKIP IS NOT A PASS. Un-run rows:`)
    for (const s of skipped) console.log(`  · ${s}`)
    console.log("DISCARD this run and repeat it once the tree is quiet (exit 3, same meaning as _run-clean).")
    process.exit(3)
  }
  console.log(pass ? "\nALL GATES PASS" : "\nGATE FAILURES PRESENT")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
