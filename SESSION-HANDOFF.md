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

## Final saved checkpoint label

`EXTRUDE_FROM_FLAT_BASE_VALIDATED_FOR_FILLED_SILHOUETTES_WITH_HOLE_LIMITATION`
