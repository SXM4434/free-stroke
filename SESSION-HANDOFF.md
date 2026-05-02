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

## Final saved checkpoint label

`SOLID_HOLE_SUPPORT_H1_DETECTION_PASS`

(supersedes all prior checkpoints; they remain in effect as underlying layers)
