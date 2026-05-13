# Free Stroke — Session Handoff

## Solid checkpoint

- **name:** Solid Checkpoint B — Extruded Filled Silhouette
- **status:** frozen / validated for filled silhouettes
- **active mode:** `EXTRUDE_FROM_FLAT_BASE`
- **validated result:** coherent extruded solids across tested filled-silhouette cases
- **limitation:** true hole preservation not implemented

### What is working

- FLAT_BASE is valid
- EXTRUDE_FROM_FLAT_BASE works for filled-silhouette extrusion
- rasterization is working
- outer contour extraction is working
- validation gate is working
- manual extrusion from the validated flat base is working
- no shredded / sliver / rib artifacts in the tested filled-silhouette cases

### Validated cases

- open C-shape
- loopy cursive
- messy / angular scribble
- thin extreme
- thick extreme
- near-touch / closed-looking loop as filled silhouette

### Important limitation

- true hole preservation is NOT supported yet
- a clean O / donut should ideally preserve the center hole, but the current pipeline fills it because it extracts and extrudes only the largest outer contour
- `contourClosed: YES` means the generated mask boundary is closed; it does NOT mean the original source stroke was closed
- `holes: 0` means inner negative-space preservation is not implemented yet

## Do not regress

These are non-negotiable for this checkpoint:

- do not reopen raster / contour / validation unless a specific new failure proves it is necessary
- do not touch FLAT_BASE
- do not touch EXTRUDE_FROM_FLAT_BASE without preserving the current checkpoint
- do not treat hole filling as a bug in this checkpoint; treat it as a future Solid subphase

## Future Solid subphase

### Solid Hole Preservation / Ring Support

- **goal:** detect inner contours and preserve holes for O / donut-style shapes
- **likely requires:** inner contour detection, Shape holes, inner wall generation, and export parity
- **scope:** this is separate from the current filled-silhouette checkpoint and must not regress it

## Solid preview / export parity

- **status:** CONFIRMED (verified by code inspection, no code changes required)
- **shared function:** `buildMaskSolid()` in `/lib/solid-mask.ts`
- **active mode in shared function:** `EXTRUDE_FROM_FLAT_BASE` (module-level constant `SOLID_GEOMETRY_MODE`, so both call sites receive the same mode)
- **preview call site:** `SolidEngine.buildPreview` in `/lib/geometry-engines.ts` (line 3168)
- **export call site:** `SolidEngine.buildExport` in `/lib/geometry-engines.ts` (line 3267), invoked from `handleExportGLB` in `/components/viewport-3d.tsx` (line 819) via `engine.buildExport(processedStrokes, ...)`
- **identical inputs across both paths:**
  - same `strokesToTestStroke(strokes, canvasWidth, canvasHeight)` conversion
  - same `coordScale = 3.0 / max(canvasWidth, canvasHeight)`
  - same `worldThickness = solidParams.thickness * coordScale`
  - same `solidParams.depth` value
  - same `canvasWidth`, `canvasHeight` arguments
- **no legacy paths in use:** neither path uses old `THREE.ExtrudeGeometry`, old contour code, or any disabled Solid branch
- **export-only post-processing:** `geometry.computeBoundingBox()` + translate-to-origin (centering for clean export); does not alter vertex topology

## Solid animation checkpoint

- **name:** Solid Basic Draw-In Animation — Smoothed
- **label:** `SOLID_BASIC_DRAW_IN_ANIMATION_PASS`
- **status:** frozen / visually acceptable for MVP

### What is working at this checkpoint

- active geometry path: `EXTRUDE_FROM_FLAT_BASE`
- validated `FLAT_BASE` fallback / base checkpoint still intact
- filled-silhouette extrusion working
- preview working
- GLB export working
- preview / export parity confirmed by code inspection
- manual GLB export smoke test passed
- debug panel gated behind Debug mode
- Debug OFF no longer blocks playback controls
- basic Solid draw-in animation working
- smoothed Solid animation now visually acceptable for MVP

### Animation implementation

- Solid animation uses partial stroke progress to rebuild Solid geometry during playback.
- The smoothing pass replaced raw point-count reveal with arc-length-based reveal.
- The current cut point is interpolated inside the active segment, instead of snapping to the next whole point.
- `progress <= 0` returns empty / near-empty state.
- `progress >= 1` returns the original full strokes unchanged, so final frame should match static preview.
- React animation state now updates often enough for a smoother MVP reveal.
- Rod and Extrude animation paths remain separate / untouched.
- Export still uses full unfiltered strokes.

### Known limitations at this checkpoint

- Solid reveal is rebuild-based, not shader-based.
- Long / dense drawings may still cause micro-stalls because Solid rebuilds raster + contour + extrusion during playback.
- Solid reveal uses uniform arc-length pacing, not authentic pen-speed timing yet.
- No advanced animation editing yet.
- No shader / gel-pen reveal yet.
- No hole preservation yet.
- No Inflate work yet.
- Do not reopen Solid raster / contour / validation / extrusion unless a regression appears.

### Next recommended steps

1. Run one quick cross-mode QA pass:
   - Rod playback / export
   - Extrude playback / export
   - Solid playback / export
2. Then start the Solid holes branch.
3. Keep Inflate after holes, because Inflate should branch from the stable Solid filled-silhouette base.

## Cross-mode QA checkpoint

- **name:** Cross-Mode QA Pass — post Solid animation smoothing
- **label:** `CROSS_MODE_QA_PASS`
- **status:** passed / no regressions across modes

### QA results

- Rod playback works
- Rod GLB export works
- Extrude playback works
- Extrude GLB export works
- Solid playback works
- Solid pause / replay works
- Solid GLB export works
- Debug gating works
- Debug OFF does not block playback controls

### Current locked Solid status

- active path: `EXTRUDE_FROM_FLAT_BASE`
- `FLAT_BASE` validated as stable base / fallback
- filled-silhouette extrusion validated
- Solid preview works
- Solid export works
- preview / export parity confirmed by code inspection
- manual GLB export smoke test passed
- debug panel gated behind Debug mode
- basic smoothed Solid draw-in animation passed
- Rod / Extrude remained working after Solid animation changes

### Known limitations carried into next phase

- no hole preservation yet
- Solid reveal is rebuild-based, not shader-based
- no advanced animation editing yet
- no Inflate work yet

## H1 hole detection checkpoint

- **name:** Solid Hole Support Phase H1 — Detection Only
- **label:** `SOLID_HOLE_SUPPORT_H1_DETECTION_PASS`
- **status:** complete / detection validated

### H1 scope

- detection only
- no geometry behavior change
- no cap cutting
- no inner walls
- no hole extrusion
- no export changes
- no animation changes

### What was added

- `detectInteriorHoles()` in `/lib/solid-mask.ts`
  - inverted-mask flood-fill hole detection
  - 4-connectivity with 4 conservative filters (min area, min bbox, min ratio, border inset)
- Extended `MaskSolidDiagnostics` interface with 7 H1 fields
- Extended `solidDiagnostics` output to include H1 fields in all code paths
- Visible debug panel fields:
  - `holeDetectionEnabled`
  - `detectedHoleCount`
  - `validHoleCount`
  - `rejectedHoleCount`
  - `largestHoleArea`
  - `holeAreas`
  - `holeRejectReasons`
- New "HOLE DETECTION (H1)" subsection in `SolidDebugOverlay` (viewport-3d.tsx)

### Empirical validation results

- open C-shape: reports zero valid holes ✓
- simple line: reports zero valid holes ✓
- big O / donut: reports at least one valid hole ✓
- near-touch open gap: reports zero valid holes (unless raster thickness bridges the gap) ✓
- loopy/messy strokes: do not produce bogus valid holes ✓

### Important limitation

- Holes are detected and reported in the debug panel
- 3D Solid output **still fills the interior** (no visible hole yet)
- This is expected, not a regression — H2/H3 have not been implemented
- Geometry output (caps, walls, extrusion) is byte-identical to locked `EXTRUDE_FROM_FLAT_BASE`

## Next branch — `SOLID_HOLE_SUPPORT_PHASE_H2_FLAT_CAP_WITH_HOLES`

- **scope:** use detected valid holes in flat cap only
- **goal:** prove `FLAT_BASE` can render a donut with a visible hole
- **explicitly out of scope for H2:**
  - no extrusion with holes yet
  - no inner side walls yet
  - no export/animation changes yet

## Extrude recovery checkpoint

- **name:** Extrude Continuous-Ribbon Width/Depth Recovery
- **label:** `EXTRUDE_CONTINUOUS_RIBBON_WIDTH_DEPTH_PASS`
- **status:** locked / usable enough to unblock Solid H3

### What is now true

- Extrude no longer relies on Rod fallback for normal loopy handwriting.
- Legacy offset-ribbon strategy still exists (still tried first).
- Raster trace strategy still exists as experimental / non-default.
- Rod fallback still exists only as emergency fallback (degenerate input only).
- Continuous-ribbon fallback is the usable fallback for normal handwriting when legacy contour fails.
- Depth works as a multiplier of effective width (decoupled from XY footprint).
- Width range is now more controlled (calibrated slider + safe-envelope clamp inside the engine).
- Depth range can be more expressive (multiplier max raised, world-space ceiling raised).
- Preview/export parity is preserved (both flow through the same `tryBuildExtrudeGeometry`).
- Debug panel shows width/depth trace values clearly (`widthSliderValue`, `effectiveWidthUsed`, `depthMultiplierSliderValue`, `effectiveDepthUsed`, `depthToWidthRatio`, `geometryBBoxZ`).
- Solid H1/H2 code was not touched.

### Important note

- This checkpoint does NOT mean Extrude is final-polished.
- It means Extrude is usable enough to stop blocking Solid H3.
- Future polish can improve joins, caps, and style quality later.

## Next branch — `SOLID_HOLE_SUPPORT_PHASE_H3_EXTRUDED_HOLES_AND_INNER_WALLS`

## Solid H3 control calibration checkpoint

- **name:** Solid H3 Control Calibration
- **label:** `SOLID_H3_CONTROL_CALIBRATION_PASS`
- **status:** locked / stable enough to unblock the next QA pass

### What is now true

- Solid H3 is functionally active.
- H3 uses H2 flat cap with holes as source.
- H3 builds front cap, back cap, outer walls, and inner hole walls.
- Solid Depth now affects actual H3 thickness.
- Thickness and Depth controls now use calibrated effective values.
- Mid-slider no longer enters breaking territory too early.
- Breaking / experimental territory is now reserved closer to the upper end of the Thickness slider.
- Preview/export parity is preserved through the same effective thickness/depth mapping.
- H3 debug panel exposes raw-vs-effective Thickness and Depth values.
- Rod, Extrude, and Inflate were untouched.

### Important note

- This does NOT mean Solid is final-polished.
- It means Solid H3 is stable enough to stop blocking the next QA pass.
- Future polish can still improve surface smoothness, edge cleanup, material feel, and extreme slider behavior.

## Next branch — `SOLID_H3_QA_EXPORT_ANIMATION_CLEANUP`

- verify GLB export preserves H3 through-holes
- verify exported mesh is non-empty
- verify animation final frame matches static H3 geometry
- confirm open C does not create fake holes
- confirm big O / donut exports with a through-hole
- confirm b-like counters remain viable at normal/default controls
- document any remaining limitations before Inflate

## Solid H3 animation cleanup checkpoint

- **name:** Solid H3 Animation Cleanup
- **label:** `SOLID_H3_ANIMATION_CLEANUP_PASS`
- **status:** locked / smoothness + reset behavior unblocked, ready for next QA

### What is now true

- Arc-length reveal with sub-segment interpolated cut point is confirmed in use (constants surfaced in the debug panel as proof, not assumption).
- Start/reset flash is eliminated: a `useLayoutEffect` in `Scene` synchronously snaps `solidAnimProgress` to `playheadRef.current` on the false→true `playing` transition when the playhead was just reset, so the first painted frame of playback is the empty/partial mesh — not the previously full mesh.
- SolidAnimationTick cadence is now time-dominated (~45 Hz, 22 ms gate). The prior 0.003 progress-delta floor was relaxed to a `> 1e-5` no-op guard, eliminating chunking at slow speeds and at extreme totalDuration values without spamming rebuilds.
- Boundary syncs at progress 0 and progress 1 are preserved, so the final frame is bit-equal to static H3 (filter short-circuits to the original strokes ref at `progress >= 1`).
- Animation diagnostics live in a new `SOLID_ANIM_DEBUG` singleton (in `lib/geometry-engines.ts`), written by `Scene` and polled by the existing `SolidDebugOverlay`. No new prop plumbing.
- Topology popping is **classified, not faked**: when `validHoleCount` changes during an active animation the panel increments `topologyChangeCount`. No hysteresis is applied; static H3 hole detection is untouched.
- Per-Play counter reset: `solidAnimationRebuildCount` and `topologyChangeCount` reset to 0 every time the user starts playback.
- Export path is unaffected: it always builds from full `processedStrokes`, never from animated subsets.
- Rod, Extrude, Inflate, H1/H2/H3 static geometry, and hole detection thresholds were not touched.

## Next branch — `SOLID_H3_ANIMATION_QA_AND_INFLATE_PREP`

- record clean playback at 0.5x / 1x / 2x and confirm no chunking
- replay 3x in a row, confirm no flash and no stale full-mesh frame
- confirm `finalFrameMatchesStatic = YES` at end of every replay
- confirm export GLB still uses full strokes (no animated subset)
- begin Inflate bridge from the locked Solid filled-silhouette base

## Solid H3 ANIMATION_GATED hole stabilization checkpoint

- **name:** Solid H3 Animation Hole Stabilization
- **label:** `SOLID_H3_ANIMATION_HOLE_STABILIZATION`
- **status:** wired end-to-end, behind animation gate only — static + export unaffected

### What is now true

- `buildMaskSolid` accepts an OPTIONAL `holeStabilization` parameter (mode `"ANIMATION_GATED"`, plus `activeFinalHolesWorld`). Static, Rod, Extrude, and Solid export paths never pass it; their behavior is byte-identical to before.
- On the animation path only, Scene snapshots the final-pass hole world contours from the currently-displayed static H3 (`SOLID_DEBUG.lastStages.solidDiagnostics.stableHolesWorld`) at the false→true `playing` transition. No extra `buildMaskSolid` call is needed — the static mesh the user was already looking at IS the reference.
- A per-final-hole activation state machine runs after each animated build: it matches `detectedPartialHoleCentroidsWorld` (newly stamped by `buildMaskSolid`) against the snapshotted final hole centroids using a per-hole tolerance of `0.7 * sqrt(area/π)`. Threshold = 1 hit (first-match activation), sticky for the rest of playback.
- The H2 gate in `buildMaskSolid` now also opens when `holeStabilization` carries at least one active final hole, so the override stays live across brief partial-detection drop-outs. When opened, the override replaces `orderedHoles`/`orderedAreas` with the topologically-safe subset of activated finals (centroid must lie inside the current partial outer), and that exact subset feeds cap triangulation, the H3 inner walls, and `stableHolesWorld` diagnostics.
- New diagnostics (panel-visible under `HOLE STABILIZATION` in the Solid Debug overlay): `holeStabilizationActive`, `finalHoleReferenceCount`, `activatedFinalHoleCount`, `lastPartialCentroidCount`, `perHoleHitStreaks`, `perHoleMissStreaks`, `perHoleActivationRadius`, `lastRejects`. The override's per-hole reject reasons (`degenerate-contour`, `centroid-outside-partial-outer`, `world-area~0`) are surfaced verbatim.
- Override clears automatically when playback stops or `solidAnimProgress >= 1`, so the static/final frame uses the unstabilized path and stays bit-equal to pre-animation static H3.

### Pipeline summary (animation, per frame)

1. Scene computes `animatedStrokes` from arc-length progress.
2. Scene reads `activationRef.current` and builds `holeStabilization` only when activation transitions; otherwise reuses the last ref. A signature key feeds `useStrokeMeshes`'s `useMemo` deps.
3. `SolidEngine.buildPreview` forwards `holeStabilization` to `buildMaskSolid`.
4. `buildMaskSolid` runs normal partial-frame H1/H2 detection AND, if the override has active holes, substitutes its filtered subset before cap triangulation and H3 wall assembly.
5. After the build, Scene reads partial centroids from `SOLID_DEBUG.lastStages.solidDiagnostics.detectedPartialHoleCentroidsWorld`, updates streaks, possibly flips activation, and (on flip) bumps the stabilization key.

### Next QA

- record clean playback on H, O, B, 8, & — confirm zero hole flicker once a hole has been seen once.
- replay multiple times in a row, confirm `finalHoleReferenceCount` matches static H3 hole count every time.
- confirm static H3 (paused or stopped) shows `holeStabilizationActive: NO`.
- confirm export GLB hole count == static H3 hole count == final animation frame hole count.

## Final saved checkpoint label

`SOLID_H3_ANIMATION_HOLE_STABILIZATION`

(supersedes `SOLID_H3_ANIMATION_CLEANUP_PASS`; all prior checkpoints remain in effect as underlying layers)
