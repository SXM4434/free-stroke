// THE HERO WORD, OUTSIDE THE BROWSER — built by the page's own code path.
//
// Every probe that wants to say something about the hero draw-in needs the same
// strokes the page renders. Re-deriving them per probe is how two numbers about
// "the hero word" end up describing two different words, so this is the one
// builder and it CALLS THE REAL FUNCTIONS: `stampPenClock` from
// `lib/pen-reveal.ts` and `processStroke` from `lib/stroke-processing.ts` are
// literally the ones `app/desk-doodles/page.tsx` calls.
//
// ⚠ WHAT CANNOT BE IMPORTED IS CHECKED, NOT TRUSTED. `page.tsx` is a React
// module and `_ts-load.mjs` cannot execute it (JSX, next/*), so the three
// settings it passes are restated below. A restated constant that silently
// drifts from its source is exactly the defect class this repo keeps finding,
// so `assertMirrorsPage()` greps the real file and throws if any of them moved.
// It runs on import — there is no way to use this file without it.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { ROOT, loadTs } from "./_ts-load.mjs"

/** app/desk-doodles/page.tsx — PROCESS_SETTINGS */
export const PROCESS_SETTINGS = { spacing: 4, smoothing: true, preserveCorners: true }
/** app/desk-doodles/page.tsx — the shipped hand-feel defaults. */
export const HERO_WOBBLE_PRESET = "roughHanddrawn"
export const HERO_ENDPOINT = "protrude"
/** app/desk-doodles/page.tsx — `useState<PenClock>("lognormal")`. */
export const HERO_PEN_CLOCK = "lognormal"
/** app/desk-doodles/page.tsx — `buildTracedStrokes`'s stub filter. ON for the
 *  TRACE and off for the font; see the block above `subNibStubCensus` in
 *  lib/pen-reveal.ts. A probe that measured the unfiltered word would be
 *  measuring a word the page no longer draws. */
export const HERO_DROP_SUB_NIB_STUBS = true

function assertMirrorsPage() {
  const src = readFileSync(join(ROOT, "app/desk-doodles/page.tsx"), "utf8")
  const want = [
    [`spacing: ${PROCESS_SETTINGS.spacing}`, "PROCESS_SETTINGS.spacing"],
    [`smoothing: ${PROCESS_SETTINGS.smoothing}`, "PROCESS_SETTINGS.smoothing"],
    [`useState<EndpointBehavior>("${HERO_ENDPOINT}")`, "the endpoint default"],
    [`WOBBLE_PRESETS.${HERO_WOBBLE_PRESET}`, "the wobble preset"],
    [`useState<PenClock>("${HERO_PEN_CLOCK}")`, "the pen-clock default"],
    [`dropSubNibStubs: ${HERO_DROP_SUB_NIB_STUBS}`, "the traced word's stub filter"],
    [`closed: closedLoops[i]`, "the closed-loop flag on the hand-feel settings"],
    [`closureStateOf(s.points.map((p) => [p.x, p.y] as [number, number])) === "closed"`,
      "the closure predicate the flag is derived from"],
  ]
  for (const [needle, what] of want) {
    if (!src.includes(needle)) {
      throw new Error(
        `_hero-word: ${what} no longer matches page.tsx (looked for \`${needle}\`). ` +
          `Update this file; do NOT adjust the measurement.`,
      )
    }
  }
}
assertMirrorsPage()

const { processStroke } = loadTs("lib/stroke-processing.ts")
const { stampPenClock } = loadTs("lib/pen-reveal.ts")
const { WOBBLE_PRESETS } = loadTs("lib/hand-feel.ts")
const { computeSolidEffectiveThicknessPx, DEFAULT_SOLID_PARAMS } = loadTs("lib/geometry-engines.ts")
const { closureStateOf } = loadTs("lib/dd-engine/strokeTo3d.ts")

/** app/desk-doodles/page.tsx — HERO_INK_WIDTH_PX */
export const HERO_INK_WIDTH_PX = computeSolidEffectiveThicknessPx(DEFAULT_SOLID_PARAMS.thickness)

export function heroPolylines() {
  const json = JSON.parse(readFileSync(join(ROOT, "scripts/capture/logo-strokes.json"), "utf8"))
  return json.polylines
}

/** The raw, timestamped strokes — `buildTracedStrokes(clock)`. */
export function rawHeroStrokes(clock = HERO_PEN_CLOCK) {
  return stampPenClock(heroPolylines(), clock, {
    nibDiameter: HERO_INK_WIDTH_PX,
    dropSubNibStubs: HERO_DROP_SUB_NIB_STUBS,
  })
}

/**
 * The processed strokes the hero actually renders and reveals.
 *
 * `handFeel` defaults to the page's shipped values, which is what makes the
 * Sigma-Lognormal kinematic pass run at all: `PenKinematicsSettings.enabled`
 * defaults to "ON whenever hand-feel is engaged" (lib/stroke-processing.ts),
 * and hand-feel is engaged by `wobble > 0 || endpoint !== "clean"`.
 */
export function processedHeroStrokes(handFeel, clock = HERO_PEN_CLOCK) {
  const hf =
    handFeel === undefined
      ? { wobble: WOBBLE_PRESETS[HERO_WOBBLE_PRESET], endpoint: HERO_ENDPOINT, inkWidth: HERO_INK_WIDTH_PX }
      : handFeel
  return rawHeroStrokes(clock).map((s) =>
    processStroke(
      s,
      PROCESS_SETTINGS.spacing,
      PROCESS_SETTINGS.smoothing,
      PROCESS_SETTINGS.preserveCorners,
      45,
      /* THE CLOSED-LOOP FLAG IS PART OF THE SHIPPED SETTINGS, so a default call
       * has to carry it or every offline probe would measure a word the page
       * stopped drawing on 2026-08-28. A caller that passes its own `handFeel`
       * is asking a different question and gets exactly what it asked for. */
      handFeel === undefined ? { ...hf, closed: heroStrokeIsClosed(s) } : hf,
    ),
  )
}

/** THE PAGE'S OWN CLOSURE PREDICATE, from the engine module the page imports.
 *  `closureStateOf`'s 'closed' state — gap < max(8 px, 2.5 % of the stroke's
 *  bbox diagonal) — is the unambiguous one; see the block above
 *  `closedLoops` in app/desk-doodles/page.tsx for the argument and the
 *  measurement. Not re-derived here: the same function, called the same way. */
export function heroStrokeIsClosed(stroke) {
  return closureStateOf(stroke.points.map((p) => [p.x, p.y])) === "closed"
}
