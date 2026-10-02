// ═══════════════════════════════════════════════════════════════════════════
// PORTED FROM DESK DOODLES — DO NOT REWRITE, RE-DERIVE OR "CLEAN UP".
//
//   source repo   ~/Desktop/Projects/desk-doodles  @ cb97683
//   source file   src/app/lib/geometry3d/strokeTo3d.ts
//   source lines  165-202 (bevel + side-wall families), 845-868 (applyDraftTaper)
//   ported        2026-07-29, into lib/
//
// WHAT CHANGED TO MAKE IT RUN HERE:
//  •  The bodies are byte-identical. Every constant, guard, epsilon and
//     comment below the divider is Desk Doodles'.
//  •  Semicolons and single quotes match the source (it is Prettier-formatted
//     differently from this repo); left alone so a diff against the source
//     stays clean.
//  •  ADDED, not changed: the `*_FS` world-scale conversions at the bottom.
//     Desk Doodles maps 800 canvas px to 8 world units (WORLD_SCALE 0.01);
//     Free Stroke maps the canvas's LONGEST side to 3 units (normScale =
//     3/max(w,h)), so absolute world lengths convert DD -> Free Stroke by
//     x0.3. Angle- and count-valued constants (segments, draft FRACTION) port
//     verbatim. The originals are kept above so the conversion is auditable
//     rather than baked in.
//
// WHY THIS FILE EXISTS SEPARATELY from lib/dd-engine/, which already carries
// strokeTo3d.ts verbatim: lib/dd-engine/ is the Desk Doodles engine as a
// COMPLETE ALTERNATIVE engine family, reached through its own adapter and
// selected by lib/engine-registry.ts. What is needed here is different — these
// four values and one function have to be consumed by FREE STROKE'S OWN
// Extrude builder, which is a ribbon swept along an open centreline, not DD's
// closed-loop THREE.ExtrudeGeometry slab. Importing them out of the engine
// port would (a) couple Free Stroke's default path to a module owned by the
// concurrent dd-engine work and (b) pull a 101 KB module into the bundle for
// four numbers. Copied, with provenance, per that port's own convention.
//
// The comments ARE the spec. They record what was tried and why it failed;
// rewriting them destroys the only copy of that record.
// ═══════════════════════════════════════════════════════════════════════════
import type * as THREE from "three"

// ─── Desk Doodles, verbatim ─────────────────────────────────────────────────

export const EXTRUDE_DEPTH = 0.5;
/** Rounded extrude edge (2026-06-12 look pass): the old 0.02 hairline bevel
 *  left the camera-facing face meeting the side wall at a hard 90° — under
 *  any rig the face reads as a flat cut-out. A fatter 3-segment bevel gives
 *  the rim a curved band that catches the key light and carries the form
 *  (the "pressed cookie" read). Shared by Extrude + Solid. */
export const EXTRUDE_BEVEL_SIZE = 0.05;
export const EXTRUDE_BEVEL_THICKNESS = 0.05;
export const EXTRUDE_BEVEL_SEGMENTS = 3;

// ── Tier-2 Extrude style families (3d-mode-controls-spec three-tier
//    amendment — discrete look choices, additive engine options) ─────────────

/** Bevel profile family: how the front/back faces meet the side wall.
 *  'rounded' = today's tuned default (the constants above, byte-identical);
 *  'soft' = a single-segment chamfer (cut corner, no curve); 'sharp' =
 *  bevel disabled (hard 90° die-cut edge). */
export type ExtrudeBevelProfile = 'sharp' | 'soft' | 'rounded';
export const EXTRUDE_BEVEL_PROFILES: Record<
  ExtrudeBevelProfile,
  { enabled: boolean; size: number; thickness: number; segments: number }
> = {
  sharp: { enabled: false, size: 0, thickness: 0, segments: 0 },
  soft: { enabled: true, size: 0.022, thickness: 0.022, segments: 1 },
  rounded: {
    enabled: true,
    size: EXTRUDE_BEVEL_SIZE,
    thickness: EXTRUDE_BEVEL_THICKNESS,
    segments: EXTRUDE_BEVEL_SEGMENTS,
  },
};

/** Side-wall family: 'straight' = vertical walls (today); 'drafted' = walls
 *  taper toward the BACK face (pressed/molded read — the front face keeps the
 *  drawn silhouette, the back shrinks by EXTRUDE_DRAFT_AMOUNT around the
 *  slab's own xy center). */
export type ExtrudeSideWall = 'straight' | 'drafted';
export const EXTRUDE_DRAFT_AMOUNT = 0.18;

/** Drafted side-wall deform: linear xy taper toward the back face (−z) around
 *  the geometry's own bbox center. Runs AFTER z-centering; recomputes vertex
 *  normals (side walls are face-shaded anyway — the deform keeps the read). */
export function applyDraftTaper(geometry: THREE.BufferGeometry, draft: number): void {
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  if (!bb) return;
  const cx = (bb.min.x + bb.max.x) / 2;
  const cy = (bb.min.y + bb.max.y) / 2;
  const zMin = bb.min.z;
  const zMax = bb.max.z;
  const span = zMax - zMin;
  if (span <= 1e-9) return;
  const pos = geometry.getAttribute('position');
  const arr = pos.array as Float32Array;
  for (let i = 0; i < pos.count; i++) {
    const z = arr[i * 3 + 2];
    const s = 1 - draft * ((zMax - z) / span); // front face (zMax) keeps 1.0
    arr[i * 3] = cx + (arr[i * 3] - cx) * s;
    arr[i * 3 + 1] = cy + (arr[i * 3 + 1] - cy) * s;
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
}

// ─── Free Stroke side of the boundary ───────────────────────────────────────
//
// Everything below is NOT Desk Doodles' code. It is the unit conversion and
// the one semantic difference that has to be named rather than papered over.

/** DD world units -> Free Stroke world units. DD: 800 px = 8 units. Free
 *  Stroke: max(canvasW, canvasH) = 3 units, so on a ~1000 px canvas one px is
 *  ~0.003 units against DD's 0.01. Absolute lengths scale by 0.3; segment
 *  counts and fractions do not scale at all. */
export const DD_TO_FREE_STROKE_LENGTH = 0.3

/** DD's bevel profiles with the absolute lengths converted. The cross-check
 *  that the conversion is right: `rounded.size` comes out at 0.015, which is
 *  what DEFAULT_EXTRUDE_PARAMS.bevelSize in lib/geometry-engines.ts already
 *  was, arrived at independently. The two registers agreed on the SIZE all
 *  along; what Free Stroke was missing was the SEGMENTS. */
export const EXTRUDE_BEVEL_PROFILES_FS: Record<
  ExtrudeBevelProfile,
  { enabled: boolean; size: number; thickness: number; segments: number }
> = {
  sharp: { enabled: false, size: 0, thickness: 0, segments: 0 },
  soft: {
    enabled: true,
    size: EXTRUDE_BEVEL_PROFILES.soft.size * DD_TO_FREE_STROKE_LENGTH,
    thickness: EXTRUDE_BEVEL_PROFILES.soft.thickness * DD_TO_FREE_STROKE_LENGTH,
    segments: EXTRUDE_BEVEL_PROFILES.soft.segments,
  },
  rounded: {
    enabled: true,
    size: EXTRUDE_BEVEL_PROFILES.rounded.size * DD_TO_FREE_STROKE_LENGTH,
    thickness: EXTRUDE_BEVEL_PROFILES.rounded.thickness * DD_TO_FREE_STROKE_LENGTH,
    segments: EXTRUDE_BEVEL_PROFILES.rounded.segments,
  },
}

/**
 * THE SEMANTIC MISMATCH, stated instead of shipped.
 *
 * `applyDraftTaper` shrinks toward `geometry`'s OWN bbox centre. In Desk
 * Doodles that geometry is the whole pooled slab, so "the form tapers toward
 * its middle" — a moulded part released from a die.
 *
 * Free Stroke's Extrude emits ONE GEOMETRY PER STROKE. Calling this per
 * geometry would taper every letter toward its own centre, so the `h` and the
 * `o` of a word would lean in different directions and the word would read as
 * five separate mouldings rather than one. That is not what the port does; it
 * is what a naive port of the port would do.
 *
 * The faithful call needs the aggregate bbox of every stroke in the mark, and
 * a version of the loop that takes that centre as an argument. This function is
 * that version — same maths, same constant, centre supplied.
 *
 * WIRED as of the rim-in-the-round pass (docs/explainers/17 §3), behind
 * `ExtrudeParams.sideWall`, `straight` by default — which is Desk Doodles' own
 * default too, so "moulded on by default" is still a judgement Sebs has not been
 * asked to make. Three notes for whoever touches this next:
 *
 *  •  THE CENTRE IS SUPPLIED BY THE CALLER, not derived from the strokes the
 *     engine happens to be holding. During draw-in, Extrude rebuilds from an
 *     arc-length-filtered PARTIAL of the mark, and a partial pool has a smaller
 *     bbox — so a centre computed inside the engine would travel across the
 *     reveal and re-slant every letter already on screen, every tick. viewport-3d
 *     computes it once from the FULL strokes and threads it as
 *     `PreviewParams.draftCentre`.
 *  •  The memo dep-array worry this note used to carry is ALREADY HANDLED:
 *     `useStrokeMeshes` derives its signature by serialising the params objects,
 *     so a field added to `ExtrudeParams` is in the signature the moment it
 *     exists. That was written after `bevelSize`/`bevelSegments` were consumed
 *     for a cycle without being listed.
 *  •  Calling the VERBATIM `applyDraftTaper` above from the per-stroke path is
 *     the mistake this whole comment exists to prevent, and it is now caught:
 *     `scripts/verify/assert-draft-taper.mjs` measures each mesh's back-face
 *     centroid displacement against its own direction to the mark's centre, and
 *     three of its four assertions fire on the verbatim wiring.
 */
export function applyDraftTaperAbout(
  geometry: THREE.BufferGeometry,
  draft: number,
  centre: { x: number; y: number },
): void {
  geometry.computeBoundingBox()
  const bb = geometry.boundingBox
  if (!bb) return
  const zMin = bb.min.z
  const zMax = bb.max.z
  const span = zMax - zMin
  if (span <= 1e-9) return
  const pos = geometry.getAttribute("position")
  const arr = pos.array as Float32Array
  for (let i = 0; i < pos.count; i++) {
    const z = arr[i * 3 + 2]
    const s = 1 - draft * ((zMax - z) / span) // front face (zMax) keeps 1.0
    arr[i * 3] = centre.x + (arr[i * 3] - centre.x) * s
    arr[i * 3 + 1] = centre.y + (arr[i * 3 + 1] - centre.y) * s
  }
  pos.needsUpdate = true
  geometry.computeVertexNormals()
}
