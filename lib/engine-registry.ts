/**
 * ENGINE FAMILY REGISTRY — pick which codebase's geometry builds the form.
 *
 * Free Stroke now carries TWO complete stroke->geometry engines:
 *
 *   "free-stroke"   lib/geometry-engines.ts — this app's own. Adaptive tube
 *                   with a curvature-driven ring table, a continuous ribbon
 *                   strip for Extrude, a canvas raster + marching-squares
 *                   Solid, and an implicit-surface fusion for Inflate.
 *
 *   "desk-doodles"  lib/dd-engine/ — the Desk Doodles engine, ported across as
 *                   FILES (see lib/dd-engine/README.md for provenance and the
 *                   exact list of what changed). Reached through
 *                   lib/dd-engine/adapter.ts, which is the only translation
 *                   layer; the ported files themselves are untouched.
 *
 * WHY BOTH, RATHER THAN A REPLACEMENT
 *
 * Desk Doodles' output is the reference for how a mark should read as ink laid
 * down by a hand. Free Stroke is ahead of it in places (its Inflate fusion is
 * the implicit-field merge Desk Doodles has parked in its own backlog) and
 * behind it in others. Neither is uniformly better, so the only way to settle
 * it is to put them side by side under the same lights, on the same strokes,
 * at the same dial settings — which is what this switch is for. Free Stroke's
 * engine is not deleted and is still the default.
 *
 * This module exists as its own file rather than living inside
 * geometry-engines.ts because the adapter imports FROM geometry-engines (for
 * the GeometryEngine / StrokeMeshData contract and the two dial calibration
 * curves). Registering it there would make that a cycle.
 */
import { getEngine as getFreeStrokeEngine, type GeometryEngine, type GeometryMode } from "@/lib/geometry-engines"
import { getDeskDoodlesEngine } from "@/lib/dd-engine/adapter"

export type EngineFamily = "free-stroke" | "desk-doodles"

export const DEFAULT_ENGINE_FAMILY: EngineFamily = "free-stroke"

/**
 * ORDER IS DELIBERATE AND SHARED. Desk Doodles first, matching
 * `REGISTER_ORDER` in lib/registers.ts.
 *
 * These are two different axes — one picks a LOOK, one picks a GEOMETRY ENGINE —
 * that happen to be named after the same two codebases. On /desk-doodles they sit
 * side by side in the header, and they used to be listed in OPPOSITE orders
 * ("Desk Doodles | Free Stroke" next to "Free Stroke | Desk Doodles"), unlabelled
 * and identically styled. Sebs: *"these toggles switching between the two make no
 * sense."* Two mirrored pills make their two active states read as a
 * contradiction rather than as two independent choices.
 *
 * `DEFAULT_ENGINE_FAMILY` stays Free Stroke; which option is listed first is a
 * presentation decision and does not have to encode the default.
 */
export const ENGINE_FAMILIES: { value: EngineFamily; label: string; tooltip: string }[] = [
  {
    value: "desk-doodles",
    label: "Desk Doodles",
    tooltip: "The ported Desk Doodles engine (lib/dd-engine): their constants, their curves, their joints",
  },
  {
    value: "free-stroke",
    label: "Free Stroke",
    tooltip: "This app's own engine: adaptive tube, ribbon extrude, implicit-fusion inflate",
  },
]

export function isEngineFamily(v: unknown): v is EngineFamily {
  return v === "free-stroke" || v === "desk-doodles"
}

/**
 * Resolve (mode, family) to a concrete engine.
 *
 * `family` is optional and defaults to Free Stroke's own, so every existing
 * call site keeps its behaviour byte-for-byte.
 */
export function getEngineFor(mode: GeometryMode, family: EngineFamily = DEFAULT_ENGINE_FAMILY): GeometryEngine {
  return family === "desk-doodles" ? getDeskDoodlesEngine(mode) : getFreeStrokeEngine(mode)
}
