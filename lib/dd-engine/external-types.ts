// ─── external-types — the ONLY hand-written file in lib/dd-engine/ ──────────
//
// PROVENANCE / WHY THIS EXISTS
//
// Every other file in this directory is a Desk Doodles file copied across
// byte-for-byte (see README.md). Four of them import *types* from Desk Doodles
// modules that live OUTSIDE the engine — the smartHachure classifier, the
// Canvas3D React context, and the hatch material shader. Those modules are not
// part of the engine and have no counterpart in Free Stroke, so copying them
// would have dragged the whole 2D pipeline and a React context tree along with
// the geometry.
//
// They are all plain string unions with no runtime, so this file re-declares
// them verbatim from their Desk Doodles source, each with the file it came
// from. Nothing here is invented; if any of these ever grows a member in Desk
// Doodles, it is a one-line update here.
//
//   TonalRole       ← src/app/lib/smartHachure/types.ts:17
//   DecisionSurface ← src/app/lib/smartHachure/index.ts:47
//   Style3D         ← src/app/state/Canvas3DContext.tsx:46
//   HatchGrammar    ← src/app/components/canvas3d/hatchMaterial.ts:49
//   HatchDirection  ← src/app/components/canvas3d/hatchMaterial.ts:55
//
// Source repo: ~/Desktop/Projects/desk-doodles @ cb97683.

/** VERBATIM from src/app/lib/smartHachure/types.ts:17, comments included. */
export type TonalRole =
  | 'paper'              // skip hachure — paper-white reservation
  | 'sparse-tonal'       // light-grey register — sparse marks, gap-dominant
  | 'mid-tonal'          // mid-grey register — parallel hatch tightening
  | 'dense-tonal'        // dark-grey register — cross-hatch, multi-layer
  | 'solid-content'      // near-black register — fine cross-hatch / solid fill
  | 'structural-frame'   // clean outline, no fill technique regardless of darkness
  | 'decorative-accent'  // preserve as-is, scale roughness down
  | 'line-decoration'    // outline-only, no fill family
  | 'label-text';        // pass-through, never hachure

/** VERBATIM from src/app/lib/smartHachure/index.ts:47. Which host surface ran
 *  the conversion — rides conversion receipts as G-10 provenance. */
export type DecisionSurface = 'record' | 'desk-lens' | 'pen-preview' | 'sandbox' | 'audit';

/** VERBATIM from src/app/state/Canvas3DContext.tsx:46. */
export type Style3D = 'native' | 'hatch' | 'svg-port';

/** VERBATIM from src/app/components/canvas3d/hatchMaterial.ts:49. */
export type HatchGrammar = 'hachure' | 'cross-hatch' | 'stipple' | 'contour';

/** VERBATIM from src/app/components/canvas3d/hatchMaterial.ts:55.
 *  Discrete DIRECTION MODE (Hatch variant). Fixed = the angle slider drives
 *  the mark direction (current behavior). Light-following = marks orient off
 *  the rig's light direction in screen space, so they re-orient as the camera
 *  orbits (a different read at every viewing angle). */
export type HatchDirection = 'fixed' | 'light';
