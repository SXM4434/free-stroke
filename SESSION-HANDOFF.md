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

## Solid H3 animation hole stabilization RESTORED checkpoint

- **name:** Solid H3 Animation Hole Stabilization Restored
- **label:** `SOLID_H3_ANIMATION_HOLE_STABILIZATION_RESTORED_PASS`
- **status:** locked / visually acceptable for MVP — do not reopen

### What is now true

- The bad `FILLED_DURING_REVEAL_COMMIT_AT_END` strategy was removed.
- Solid animation is back on `STICKY_FINAL_HOLE_CONTOURS`.
- Active final holes are no longer re-evaluated against the partial silhouette every frame.
- Once a hole activates during playback, it stays active for that playback session.
- Final frame force-activates remaining final holes so it matches static H3.
- The huge filled-blob-to-holed-mesh snap is gone.
- Solid animation is visually acceptable for MVP and should not be reopened right now.
- Static Solid H3 geometry/export remain unchanged.
- Rod, Extrude, and Inflate were untouched.

### Important note

- This is not final animation polish.
- Some tiny topology weirdness may still exist because Solid animation rebuilds partial geometry.
- That is acceptable for MVP.
- Do not keep iterating on Solid animation unless a major regression appears.

## Next branch — `CROSS_MODE_SMOKE_TEST_BEFORE_INFLATE`

- Rod animation still plays.
- Extrude animation still plays progressively.
- Solid animation still plays with stable enough holes.
- Solid final frame matches static H3.
- Export still exports the full static model, not animated partial strokes.
- If smoke test passes, move to `INFLATE_MODE_PHASE_1`.

## Inflate Phase 2 preview lock checkpoint

- **name:** Inflate Phase 2 Preview Locked for MVP
- **label:** `INFLATE_PHASE_2_PREVIEW_LOCKED_FOR_MVP`
- **status:** locked / accepted for MVP preview — do not reopen Inflate geometry unless a major regression appears

### What this checkpoint records

- Inflate preview is accepted for MVP.
- Remaining Inflate visual polish (true balloon physics, metaball joins, export) is post-MVP.
- Do not reopen Inflate geometry/material tuning unless a major regression appears.
- Next branch is `INFLATE_EXPORT_AND_FINAL_PROJECT_QA`.

### Final cross-mode QA results (verified in-browser)

QA method: drew one loopy S-curve stroke (41 raw → 275 processed pts) and exercised every mode live in the running preview (Chromium via agent-browser). Zero JS console errors and zero server runtime errors across all mode switches and slider interactions (only cosmetic `/icon*.png` + `/icon.svg` 404s, out of scope).

- **Rod QA — PASS**
  - Preview renders a thin 3D tube.
  - Play button + speed controls (0.5x / 1x / 2x) present and toggle correctly.
  - Reveal completes and returns to the full static frame (reset/replay behavior intact).
  - Export GLB enabled.
- **Extrude QA — PASS**
  - Preview renders a flat continuous ribbon.
  - Width / Depth / Bevel controls present and functional.
  - Progressive reveal + replay/reset behavior intact.
  - Export GLB enabled.
  - Remains visually distinct from Inflate (flat ribbon vs rounded volume).
- **Solid QA — PASS**
  - Preview renders the filled extruded silhouette.
  - Thickness / Depth controls present and functional.
  - H3 holes/counters path intact (static H3 unchanged by this QA).
  - Animation acceptable for MVP; final frame matches static.
  - Export GLB enabled (full static geometry).
- **Inflate QA — PASS**
  - Preview renders a rounded, soft volumetric body (no empty viewport).
  - Width (Thickness) changes stroke thickness — verified 38px → 64px visibly thicker.
  - Puff changes fullness/roundness — verified 0.18 → 0.50 visibly fuller/rounder.
  - No shredded Solid-normal bands, no old raster dome seam.
  - Soft matte-with-sheen material is visibly distinct from the glossy Rod/Extrude/Solid material.
  - Export is intentionally disabled with a clear "Phase 1 preview · export disabled" label (Phase-2 export is the next branch).

### Visual distinction Inflate vs Extrude

- **CONFIRMED distinct enough for MVP.** Extrude reads as a flat directional ribbon/strip; Inflate reads as a soft, rounded, pressure-filled tube with a diffuse sheen. Silhouettes and materials differ clearly at default and across the Puff/Thickness sweep.

### Blockers

- None.

### Untouched (no implementation code changed by this QA pass)

- Rod / Extrude / Solid / Inflate geometry, animation logic, export logic, and UI styling were all left unchanged. Only this `SESSION-HANDOFF.md` was updated.

## Next branch — `INFLATE_EXPORT_AND_FINAL_PROJECT_QA`

## Final saved checkpoint label

`INFLATE_PHASE_2_PREVIEW_LOCKED_FOR_MVP`

(supersedes `SOLID_H3_ANIMATION_HOLE_STABILIZATION_RESTORED_PASS`; all prior checkpoints remain in effect as underlying layers)

---

## Branch — `INFLATE_EXPORT_AND_FINAL_PROJECT_QA`

### Outcome: **INFLATE_EXPORT_AND_FINAL_PROJECT_QA_PASS**

- Inflate preview accepted for MVP (no visual tuning reopened).
- Inflate export implemented. Export is the **full static Inflate model only** — never animated/partial geometry.
- Preview and export now share ONE geometry builder: `inflateBuildStaticGeometries(...)` in `lib/geometry-engines.ts`. Both `InflateEngine.buildPreview` and `InflateEngine.buildExport` call it with the FULL processed strokes, so the exported GLB matches the static preview 1:1.
- Export centers the aggregate bbox at the origin (same convention as Solid), names meshes `inflate_000…`, and writes metadata: `mode: "inflate"`, `inflateThickness` (Width), `inflatePuff` (Puff), `inflateStrategy`, `vertexCount`, `triangleCount`, `fallbackUsed`, plus calibrated `inflateStrokeRadiusXY` / `inflatePuffAspectZ` / `inflateRadiusZ`. Empty-loft fallback exports the Solid silhouette with `fallbackUsed: true`.
- UI: removed the "Phase 1 preview · export disabled" label (now "Width · Puff · GLB export enabled") and the Inflate tab's "no export yet" tooltip. Export GLB button already gated only on `strokeCount === 0`.

### All four modes render and export

| Mode | Export | Bytes (loopy stroke) | Log mode tag |
| --- | --- | --- | --- |
| Rod | ✅ | ~3.4 MB | `mode=rod, merged=true` |
| Extrude | ✅ | ~38 KB | `mode=extrude, merged=true` |
| Solid | ✅ | ~409 KB | `mode=solid, merged=true` |
| Inflate | ✅ | ~346 KB | `mode=inflate, merged=false` |

### Inflate export test results (validated GLB header = glTF v2, node `inflate_000` under `FreeStroke`)

- Simple line — PASS (~90 KB, non-empty).
- Loopy cursive — PASS (~346 KB, non-empty).
- Big O / loop — PASS (~359 KB, non-empty).
- Each exported GLB is non-empty and visually matches the static Inflate preview; uses full strokes, not animated partial state; Width/Puff reflected in geometry + metadata.

### Animation + controls sanity

- Inflate animation still plays acceptably (reveal path untouched — animation reuses the same preview meshes).
- Rod / Extrude / Solid animation untouched.
- Inflate Width/Puff verified live: Puff 0.18 → 0.50 visibly fuller/rounder; Width unchanged in behavior. Extrude/Solid controls untouched.

### Untouched

- Rod / Extrude / Solid geometry, animation, and export logic unchanged.
- Inflate **visual tuning untouched** — the shared builder uses the exact same calibration constants the locked preview used; the refactor only relocated the deterministic math so preview and export can share it.

### Files

- Inspected: `lib/geometry-engines.ts`, `components/viewport-3d.tsx`, `app/page.tsx`.
- Changed: `lib/geometry-engines.ts` (added `inflateBuildStaticGeometries`, refactored `InflateEngine.buildPreview` to use it, implemented `InflateEngine.buildExport`), `app/page.tsx` (UI text/tooltip), `SESSION-HANDOFF.md`.

### Blockers

- None.

## Final saved checkpoint label (updated)

`INFLATE_EXPORT_AND_FINAL_PROJECT_QA_PASS`

(supersedes `INFLATE_PHASE_2_PREVIEW_LOCKED_FOR_MVP`; all prior checkpoints remain in effect as underlying layers)

---

## LOCKED CHECKPOINT — `INFLATE_EXPORT_AND_FINAL_PROJECT_QA_PASS`

**Status: MVP-stable. Locked.** The project is now stable enough to move into cleanup / polish / demo work.

### What is now true

- Inflate preview is accepted for MVP.
- Inflate export works and looks good (user-confirmed).
- Inflate export uses the **full static Inflate model**, not animated partial geometry.
- Inflate is visually distinct enough from Extrude.
- **Width** maps to stroke thickness / XY radius.
- **Puff** maps to cross-section fullness / pressure-like roundness.
- Rod, Extrude, Solid, and Inflate all render.
- Cross-mode smoke test passed.
- Supported exports work (Rod, Extrude, Solid, Inflate all produce non-empty GLBs with correct mode tags).
- Remaining geometry/style issues are **post-MVP polish**.

### Frozen subsystems — DO NOT REOPEN

- Do **not** reopen Rod geometry.
- Do **not** reopen Extrude geometry/calibration.
- Do **not** reopen Solid H3 geometry/animation.
- Do **not** reopen Inflate visual tuning unless a major regression appears.

### Next branch — `MVP_UI_POLISH_AND_DEMO_CAPTURE`

Focus:

- remove temporary debug logs
- keep Debug panel behind Debug toggle only
- clean mode labels and helper text
- verify disabled/enabled export states are accurate
- capture short demo clips for Rod / Extrude / Solid / Inflate
- document known limitations
- prepare project for portfolio/demo use

### Final locked checkpoint label

`INFLATE_EXPORT_AND_FINAL_PROJECT_QA_PASS`

---

## LOCKED CHECKPOINT — `INFLATE_ANIMATION_PROGRESSIVE_REVEAL_PASS`

**Status: MVP-ready. Locked.** Inflate animation is accepted; all four modes are now ready to move into cleanup and demo prep.

### What is now true

- Inflate preview works.
- Inflate export works and looks good.
- Inflate animation now plays acceptably.
- Inflate reveals progressively along the drawn stroke path (arc-length partial rebuild — not all-at-once pop-in).
- **Width** still controls stroke thickness / XY radius.
- **Puff** still controls cross-section fullness / pressure-like roundness.
- Inflate remains visually distinct enough from Extrude.
- Rod, Extrude, and Solid remain accepted.
- All four modes are now MVP-ready enough to move into cleanup and demo prep.

### Important notes

- Do **not** reopen Inflate geometry.
- Do **not** reopen Inflate visual tuning.
- Do **not** reopen Solid animation.
- Do **not** reopen Extrude calibration.
- Remaining visual issues are **post-MVP polish** unless a major regression appears.

### Next branch — `MVP_UI_POLISH_AND_DEMO_CAPTURE`

Focus:

- remove temporary debug logs
- verify Debug panel only appears when Debug is ON
- clean helper text / mode labels
- verify export button states
- verify playback controls across all modes
- verify camera / framing / reset / top view
- create a demo capture checklist
- document known limitations for MVP

### Final locked checkpoint label

`INFLATE_ANIMATION_PROGRESSIVE_REVEAL_PASS`

(supersedes `INFLATE_EXPORT_AND_FINAL_PROJECT_QA_PASS`; all prior checkpoints remain in effect as underlying layers)

---

## LOCKED CHECKPOINT — `MVP_UI_POLISH_AND_DEMO_CAPTURE_PASS`

**Status: Demo-ready. Locked.** UI cleanup, debug gating, and demo prep complete. No geometry, animation, or export logic was touched.

### What was changed (cleanup only)

- Removed two temporary export status `console.log`s in `components/viewport-3d.tsx`
  (the dev-only `[FreeStroke Export] mode=...` status line and the ungated
  `[FreeStroke] Exported ...` line). Kept the dev-only integrity `console.warn`
  assertions and the `console.error` failure handler.
- Updated the stale Inflate controls comment in `app/page.tsx`
  (was "Phase 1 — BEVEL_EXTRUDE strategy / export is a placeholder";
  now describes the active stroke-volume tube loft with preview + animation + export sharing one path).
- Aligned the Inflate status helper text in `app/page.tsx` to
  "Soft inflated stroke · GLB export enabled" (was "Width · Puff ...", which
  conflicted with the visible "Thickness"/"Puff" slider labels).
- Gated the always-on drawing-canvas dev telemetry overlay
  (`raw N pts | processed N pts | ... draw: Xms | procOne: ... | lastTrigger: ...`)
  behind `process.env.NODE_ENV === "development"` in `components/drawing-canvas.tsx`,
  so it stays for dev work but is hidden in the demo/production build.

### Verified state

- **Debug panel:** hidden by default; the 3D viewport Debug overlays render only when Debug is ON, and only for the mode that owns them (Extrude metrics / Solid metrics). Inflate shows no stale strategy string. Overlays do not block playback/export/canvas controls.
- **Mode labels:** Rod / Extrude / Solid / Inflate all enabled and clearly labeled. Extrude = Width/Depth, Solid = Thickness/Depth, Inflate = Thickness/Puff. No stale "Phase 1 / export disabled" copy anywhere in the DOM.
- **Export:** Export GLB enabled for all four modes when a stroke exists; disabled only while exporting or with zero strokes. Consistent label ("Export GLB" / "Exporting..."). Mode-specific, timestamped filenames. Verified export emits no temporary console logs.
- **Playback:** Play/Pause, scrubber, Natural/Authentic, and 0.5x/1x/2x speed all present and mode-agnostic (gated by stroke count). Not blocked by overlays.
- **Camera:** Top view and Reset camera buttons present and working; orbit controls intact; per-mode framing locks to final geometry size.

### Demo capture checklist

**Clip 1 — Rod**
- draw a loopy stroke
- play animation (watch progressive reveal)
- orbit to show the round tube cross-section
- export GLB (optional)

**Clip 2 — Extrude**
- switch to Extrude (same stroke)
- adjust Width, then Depth
- play animation
- export GLB

**Clip 3 — Solid**
- switch to Solid; if the stroke has a loop, show the filled silhouette / counter
- adjust Thickness, then Depth
- play animation
- export GLB

**Clip 4 — Inflate**
- switch to Inflate
- adjust Thickness, then Puff
- play animation (soft inflated reveal)
- export GLB

**Clip 5 — Mode comparison**
- keep one stroke
- cycle Rod → Extrude → Solid → Inflate
- narrate why each mode exists (ink line → ribbon → filled solid → soft inflated volume)

### Known limitations (MVP)

- Inflate is an MVP stroke-volume preview/export (tube loft), not a final physical balloon simulation.
- Solid animation may still show tiny topology artifacts at loop-closure frames — acceptable for MVP.
- Extrude is usable but not final aesthetic polish.
- Materials and lighting are still basic.
- UI is demo-ready, not final product UX.
- Debug panels (3D viewport overlays + canvas telemetry) are development-only and hidden in the demo build.
- Future polish: improved materials, parameter presets, export metadata, mesh smoothing, and post-export object cleanup.

### Final locked checkpoint label

`MVP_UI_POLISH_AND_DEMO_CAPTURE_PASS`

(supersedes `INFLATE_ANIMATION_PROGRESSIVE_REVEAL_PASS`; all prior checkpoints remain in effect as underlying layers)

---

## LOCKED CHECKPOINT — `POST_MVP_STYLE_SUBSTRATE_PHASE_1_PASS`

**Status: Substrate added. Locked.** Infrastructure-only phase for the future visual style system. No visual effects implemented; geometry, animation, and export untouched.

### What was added (infrastructure only)

- **New file `lib/style-system.ts`** — the clean style state model + preset id shells:
  - Unions: `MaterialPreset`, `TextureMode`, `TextureLockMode`, `StyleSyncMode`, `StyleAnimationType`, `DitherType`/`DitherDirection`, `AsciiCharset`/`AsciiDirection`, `FusionPreset`, `StackAnimationType`.
  - `StyleState` interface with the full field set (material / texture / dither / ascii / layer stack / fusion / global sync + clock).
  - `DEFAULT_STYLE_STATE` — conservative defaults (material `ink`, `textureMode` `none`, all visual layers + animated systems OFF, `syncMode` `independent`).
  - Preset definition shells (IDs + labels only, no behavior): `MATERIAL_PRESETS`, `TEXTURE_MODES`, `DITHER_PRESETS`, `ASCII_PRESETS`, `FUSION_PRESETS`.
- **`app/page.tsx`** — added `styleState`/`setStyleState` (`DEFAULT_STYLE_STATE`); added a compact **Style** panel shell (Material select, Texture select, Dither/ASCII/Animate/Sync Reveal toggles) that updates state immediately; passes `styleState` to the viewport.
- **`components/viewport-3d-wrapper.tsx`** — threads the optional `styleState` prop through to `Viewport3D`.
- **`components/viewport-3d.tsx`** — added optional `styleState` prop; added a **Style substrate** readout inside the existing `showDebug` panel (Debug-only). `styleState` is referenced ONLY in debug JSX — it is in no geometry/animation/export dependency array.

### Default style values

`materialPreset: "ink"`, `textureMode: "none"`, all of `textureEnabled / textureAnimated / ditherEnabled / ditherAnimated / asciiEnabled / asciiAnimated / layerStackEnabled / stackAnimationEnabled / fusionAnimationEnabled / syncToReveal = false`, `fusionPreset: "none"`, `syncMode: "independent"`, `textureLockMode: "object"`, `globalStyleTime: 0`.

### Does style change rebuild geometry?

**No.** Verified via Extrude `previewBuildCount`: toggling style controls produced zero build-count increments (stayed flat). Style state is not in any geometry memo dependency.

### Test results

- State updates — PASS (Material→softGel, Texture→procedural, Dither/ASCII/Animate/Sync Reveal toggles all reflected in debug readout).
- Rod — PASS (renders with style state active).
- Extrude — PASS (renders; export 23.7 KB GLB with style state active).
- Solid — PASS (renders).
- Inflate — PASS (renders).
- Animation unchanged — PASS (no animation logic touched).
- Export unchanged — PASS (GLB export still works; no export logic touched).
- Debug gating — PASS (Style substrate readout visible only when Debug ON; hidden when OFF).

### Confirmations

- Geometry untouched (no edits to `lib/geometry-engines.ts` / `lib/solid-*.ts`).
- Animation logic untouched.
- Export engine logic untouched.
- No dither / ASCII / fusion rendering implemented (rails only).

### Next branch — `POST_MVP_INITIAL_PRESET_RAILS_PHASE_1`

### Final locked checkpoint label

`POST_MVP_STYLE_SUBSTRATE_PHASE_1_PASS`

(supersedes `MVP_UI_POLISH_AND_DEMO_CAPTURE_PASS`; all prior checkpoints remain in effect as underlying layers)

---

## LOCKED CHECKPOINT — `POST_MVP_INITIAL_PRESET_RAILS_PHASE_1_PASS`

**Status: Preset rails added. Locked.** Preset infrastructure only — no visual effect renderers. Geometry, animation, and export untouched.

### What was added (preset infrastructure only)

- **Preset family model** in `lib/style-system.ts`: `PresetFamily` union (geometry, material, animatedMaterial, texture, animatedTexture, dither, animatedDither, ascii, animatedAscii, layerStack, stackAnimation, fusion, animatedFusion, geometryAnimation) and the `StylePreset` shape (`id`, `label`, `family`, `description?`, `bestModes?`, `enabled`, `implemented`, `previewOnly?`, `applies?`).
- **Initial preset definitions** (69 total, 0 duplicate IDs, all have family + label):
  - material (6, IMPLEMENTED): ink, softGel, matteClay, glossyPlastic, rubber, signal
  - texture (5): fineGrain, scanlines, contourBands, scratchedInk, gelBubbles
  - animatedTexture (5): grainDrift, scanlineScroll, rippleFlow, bandCrawl, bubbleDrift
  - dither (5): bayerClassic, dotMatrix, hardThreshold, softDither, pixelSignal
  - animatedDither (5): ditherCrawl, thresholdSweep, revealDither, completionPulseDither, diagonalMatrixDrift
  - ascii (5): terminalShade, binarySkin, blockGlyph, codeMarks, sparseGlyph
  - animatedAscii (6): glyphScroll, asciiRain, characterCycle, revealGlyphs, terminalFlicker, slowCodeCrawl
  - layerStack (5): cleanInkStack, ditheredGelStack, terminalStack, graphicSlabStack, softSignalStack
  - stackAnimation (6): stackFadeIn, stackCompletionPulse, stackDrift, stackFreezeOnComplete, stackLoopCrawl, stackDelay
  - fusion (8): terminalGel, ditherBloom, signalInk, asciiRubber, scanlineBalloon, pixelClay, codeBloom, glitchRibbon
  - animatedFusion (7): terminalGelRevealBuild, ditherBloomThresholdOpen, signalInkDataFlow, asciiRubberSlowdown, scanlineBalloonSoftPulse, glitchRibbonControlledBreak, codeBloomCharacterReveal
  - geometryAnimation (6): authenticDraw, smoothReveal, snappyDraw, slowGel, loopingStroke, completionPulse
  - `PRESET_REGISTRY` (family → presets), `PRESET_FAMILY_OPTIONS`, `ALL_PRESETS`, and `findPreset()`.
- **Style state fields** added to `StyleState` + `DEFAULT_STYLE_STATE`: `activePresetFamily` (default `material`), `activePresetId` (default `null`), `lastAppliedPresetId` (default `null`).
- **Preset rail UI** in `app/page.tsx`: a family selector + a preset selector in the Style bar, with a selected-preset status chip ("active" vs "defined · renderer later"). Unimplemented presets are labeled "(soon)". A `handleSelectPreset(family, id)` records the active preset and applies only the preset's safe `applies` patch.
- **Debug readout** in `components/viewport-3d.tsx` (Debug-only): activePresetFamily, activePresetId, activePresetImplemented, activePresetPreviewOnly, activePresetBestModes, presetAppliesState, presetDoesNotTouchGeometry: YES.

### Material preset behavior

Material presets are `implemented: true` and carry `applies: { materialPreset: ... }`. Selecting one updates the existing `materialPreset` style state through the shared style state path (no geometry rebuild).

### Unimplemented preset behavior

All non-material presets are `implemented: false` with no `applies` patch. Selecting one records `activePresetFamily`/`activePresetId` (and the UI shows "defined · renderer later") but applies nothing visual, does not change material, and does not break the preview. They never pretend to work.

### Does preset selection rebuild geometry?

**No.** Verified via Extrude `previewBuildCount`: selecting multiple unimplemented presets produced zero build-count increments. Style/preset state is in no geometry memo dependency.

### Test results

- Preset data — PASS (69 presets, 0 dupes, 0 missing label/family, only 6 material marked implemented, family counts match spec).
- UI — PASS (family selector switches the preset list; selecting material `rubber`/`matteClay` updates `materialPreset`; selecting unimplemented `bayerClassic`/ascii presets records selection, shows "(soon)"/"defined · renderer later", leaves material untouched, preview intact).
- Rod — PASS (renders).
- Extrude — PASS (renders; export 23.7 KB GLB with presets active).
- Solid — PASS (renders).
- Inflate — PASS (renders).
- Animation unchanged — PASS.
- Export unchanged — PASS.
- Debug gating — PASS (preset + substrate readouts visible only when Debug ON; hidden when OFF).

### Confirmations

- Geometry untouched (no edits to `lib/geometry-engines.ts` / `lib/solid-*.ts`).
- Animation logic untouched.
- Export engine logic untouched.
- No dither / ASCII / texture / fusion rendering implemented (rails + definitions only).

### Next branch — `POST_MVP_MATERIAL_AND_ANIMATED_MATERIAL_PHASE_1`

### Final locked checkpoint label

`POST_MVP_INITIAL_PRESET_RAILS_PHASE_1_PASS`

(supersedes `POST_MVP_STYLE_SUBSTRATE_PHASE_1_PASS`; all prior checkpoints remain in effect as underlying layers)

---

## LOCKED CHECKPOINT — `STYLE_TAXONOMY_UI_CORRECTION_PASS`

**Status: Taxonomy corrected. Locked.** State/UI-only correction — no renderers added; geometry, animation, and export untouched.

### What was corrected

- **Texture, Dither, and ASCII are now separate sibling systems.** Previously the UI placed Dither and ASCII under the Texture selector (conceptually wrong). They are now independent controls with independent state paths.
- `textureMode` no longer contains `dither` or `ascii` (nor the old umbrella `layered`/`fusion`).

### Old incorrect taxonomy

- Material
- Texture: None / Procedural / **Dither** / **ASCII** / Layered / Fusion
- Dither toggle (boolean)
- ASCII toggle (boolean)

### Corrected taxonomy

- Material: Ink / Soft Gel / Matte Clay / Glossy Plastic / Rubber / Signal
- Texture (procedural patterning only): None / Procedural / Grain / Noise / Scanlines / Bands / Contour
- Dither (own system): Off / Bayer 4x4 / Bayer 8x8 / Blue Noise / Halftone / Lines
- ASCII (own system): Off / Blocks / Classic / Minimal / Dots / Custom
- Animate + Sync Reveal toggles
- Preset: family + preset (families stay separate)

### State model changes (`lib/style-system.ts`)

- `TextureMode` = `"none" | "procedural" | "grain" | "noise" | "scanlines" | "bands" | "contour"` (no `dither`/`ascii`/`layered`/`fusion`).
- `TEXTURE_MODES` shell list updated to match (no Dither/ASCII entries).
- Dither retains its independent fields (`ditherEnabled`, `ditherAnimated`, `ditherType`, `ditherScale`, `ditherThreshold`, `ditherContrast`, `ditherSpeed`, `ditherDirection`).
- ASCII retains its independent fields (`asciiEnabled`, `asciiAnimated`, `asciiCharset`, `asciiCellSize`, `asciiDensity`, `asciiContrast`, `asciiScrollSpeed`, `asciiDirection`).
- Dither/ASCII preset defs now carry safe `applies` patches that set their OWN state (`ditherEnabled`+`ditherType` / `asciiEnabled`+`asciiCharset`) — never `textureMode`.

### UI changes (`app/page.tsx`)

- Replaced the Dither/ASCII boolean toggle chips with two separate selects: **Dither** (Off + dither types) and **ASCII** (Off + charsets), siblings of the Texture select.
- Animate + Sync Reveal toggles retained.
- `handleSelectPreset` now applies a preset's safe `applies` patch for any family (the patches only touch inert style fields), so dither/ASCII presets record their own sibling state; `implemented` still governs the "active" vs "renderer later" label.

### Preset behavior changes

- Texture / animatedTexture / dither / animatedDither / ascii / animatedAscii / fusion families remain separate in `PRESET_REGISTRY`.
- Selecting a dither preset sets `ditherEnabled = true` + `ditherType` (verified `presetAppliesState: ditherEnabled, ditherType`); it does NOT set `textureMode`.
- Selecting an ASCII preset sets `asciiEnabled = true` + `asciiCharset`; it does NOT set `textureMode`.
- All non-material presets remain `implemented: false` ("(soon)" / "defined · renderer later"). No renderer is falsely claimed implemented.

### Debug changes (`components/viewport-3d.tsx`)

- Style substrate readout regrouped into labeled sections: **Texture (procedural patterning only)** (textureMode, textureEnabled, textureAnimated), **Dither (separate system)** (ditherEnabled, ditherAnimated, ditherType), **ASCII (separate system)** (asciiEnabled, asciiAnimated, asciiCharset), **Composite** (layerStack/stack/fusion/sync). Active preset block (activePresetFamily, activePresetId, …) retained. Debug no longer implies Dither/ASCII are texture modes.

### Test results

- UI taxonomy — PASS (Texture options = None/Procedural/Grain/Noise/Scanlines/Bands/Contour; no Dither, no ASCII. Dither + ASCII are own selects. Selecting Dither/ASCII left `textureMode` unchanged. Selecting Texture=scanlines left Dither/ASCII state unchanged.)
- Preset taxonomy — PASS (dither preset `dotMatrix` set `ditherType=halftone` + `presetAppliesState: ditherEnabled, ditherType`, `textureMode` unchanged; families separate; fusion separate).
- Rod — PASS (renders).
- Extrude — PASS (renders).
- Solid — PASS (renders).
- Inflate — PASS (renders; export 208 KB GLB with taxonomy state active).
- Material preset regression — PASS (material presets still apply via `materialPreset`).

### Confirmations

- No dither renderer implemented.
- No ASCII renderer implemented.
- No procedural texture renderer implemented.
- Geometry untouched (no edits to `lib/geometry-engines.ts` / `lib/solid-*.ts`).
- Animation logic untouched.
- Export engine logic untouched.

### Next branch — `POST_MVP_MATERIAL_AND_ANIMATED_MATERIAL_PHASE_1`

### Final locked checkpoint label

`STYLE_TAXONOMY_UI_CORRECTION_PASS`

(supersedes `POST_MVP_INITIAL_PRESET_RAILS_PHASE_1_PASS`; all prior checkpoints remain in effect as underlying layers)

---

## LOCKED CHECKPOINT — `STYLE_TAXONOMY_AND_PANEL_IA_CORRECTION_PASS`

**Status: Taxonomy + information architecture corrected. Locked.** UI/state clarity + panel scaffolding only — no renderers added; geometry, animation, and export untouched.

### Builds on the prior taxonomy pass

The texture/dither/ASCII sibling split was already done in `STYLE_TAXONOMY_UI_CORRECTION_PASS`. This pass finishes the IA work: clarifies the ambiguous Motion/Sync controls, treats the top row as a compact summary strip, and adds the dedicated-panel scaffolding.

### Files changed

- `lib/style-system.ts` — added `MotionMode` type + `motionMode` state field/default.
- `app/page.tsx` — replaced Animate/Sync Reveal toggles with a Motion select; updated helper copy; mounted `StylePanelScaffold`.
- `components/style-panel-scaffold.tsx` — NEW. Panel IA shell.
- `components/viewport-3d.tsx` — debug readout: added Motion section (motionMode/syncMode/syncToReveal); relabeled Composite.
- `SESSION-HANDOFF.md` — this checkpoint.

### Old incorrect / ambiguous taxonomy

- Texture selector listed Dither + ASCII (already fixed last pass).
- `Animate` (mapped to `textureAnimated`) — unclear what was being animated.
- `Sync Reveal` (boolean) — vague; didn't communicate "style timing follows stroke draw-in".
- Top row presented as if it were the full/final control surface.

### Corrected taxonomy + IA

- **Sibling systems (top summary strip):** Material · Texture · Dither · ASCII · Motion · Preset.
- **Motion** select: `Off` / `Independent` / `Sync to Draw` (replaces Animate + Sync Reveal). Tooltip: "Link style animation timing. Sync to Draw uses stroke draw-in progress as the clock."
- **Top row is a compact summary/quick-control strip** — helper copy now reads "summary strip · full controls land in dedicated panels later".
- **Panel scaffolding** (`StylePanelScaffold`): expandable "Style panels" drawer with tabs Material / Texture / Dither / ASCII / Motion / Presets / Layers (later) / Fusion (later). Each panel shows an honest status chip ("substrate active" vs "renderer later"), a placeholder note, and a list of documented FUTURE controls.

### State model changes (`lib/style-system.ts`)

- New `MotionMode = "off" | "independent" | "syncToDraw"` (coarse, user-facing).
- New `StyleState.motionMode: MotionMode` (default `"off"`).
- Existing fine-grained flags (`textureAnimated`, `ditherAnimated`, `asciiAnimated`) and `syncMode`/`syncToReveal` retained for future panels. `motionMode` is the single clear control surfaced today.

### UI label changes (`app/page.tsx`)

- `Animate` toggle → removed; superseded by `Motion` select.
- `Sync Reveal` toggle → removed; concept surfaced via Motion's `Sync to Draw` option.
- Helper microcopy updated to communicate "summary strip / dedicated panels later".

### Panel IA / scaffolding changes

- Added `components/style-panel-scaffold.tsx` (Option B: inline expandable placeholder panels). Documents per-panel future control inventories (Material, Texture, Dither, ASCII, Motion, Layers, Fusion) in code. No advanced control or renderer implemented; placeholder copy never claims a renderer exists.

### Preset behavior changes

- None this pass. Preset families remain separate (texture / animatedTexture / dither / animatedDither / ascii / animatedAscii / layerStack / stackAnimation / fusion / animatedFusion). Dither presets still set `ditherEnabled`+`ditherType`, ASCII presets set `asciiEnabled`+`asciiCharset`, never `textureMode`. Non-material presets remain `implemented:false`.

### Debug changes (`components/viewport-3d.tsx`)

- Added "— Motion (style animation) —" section: `motionMode`, `syncMode`, `syncToReveal`.
- Composite section relabeled "— Composite (renderers later) —".
- Readout no longer implies Dither/ASCII are texture modes or that Motion means only texture animation.

### Test results

- UI taxonomy — PASS (labels: Material/Texture/Dither/ASCII/Motion/Preset; Texture has no Dither/ASCII; old Animate/Sync Reveal buttons gone; Motion = Off/Independent/Sync to Draw; selecting Motion=Sync to Draw sets `motionMode` only).
- Panel IA — PASS (Style panels drawer expands; 8 tabs present; Dither panel shows "Dither renderer not implemented yet" + future-control chips; honest status chips).
- Preset taxonomy — PASS (families separate; dither/ASCII presets set their own state, not textureMode).
- Rod — PASS (renders).
- Extrude — PASS (renders).
- Solid — PASS (renders).
- Inflate — PASS (renders; export 90 KB GLB).
- Material preset regression — PASS (material presets still apply via `materialPreset`).

### Confirmations

- No dither renderer implemented.
- No ASCII renderer implemented.
- No procedural texture renderer implemented.
- Geometry untouched (no edits to `lib/geometry-engines.ts` / `lib/solid-*.ts`).
- Animation logic untouched.
- Export engine logic untouched.

### Next branch — `POST_MVP_MATERIAL_AND_ANIMATED_MATERIAL_PHASE_1`

### Final locked checkpoint label

`STYLE_TAXONOMY_AND_PANEL_IA_CORRECTION_PASS`

(supersedes `STYLE_TAXONOMY_UI_CORRECTION_PASS`; all prior checkpoints remain in effect as underlying layers)

---

## POST_MVP_MATERIAL_AND_ANIMATION_IA_PHASE_1

### Checkpoint: `POST_MVP_MATERIAL_AND_ANIMATION_IA_PHASE_1_PASS`

### What this branch delivered

- **Material presets now visibly affect surface response.** Six presets
  (`ink`, `softGel`, `matteClay`, `glossyPlastic`, `rubber`, `signal`) defined in
  `MATERIAL_PARAMS` and applied to a single live `MeshPhysicalMaterial`
  (`liveMaterial` in `viewport-3d.tsx`). Geometry is never touched.
- **Mode-aware material defaults.** `MODE_MATERIAL_DEFAULTS`: Rod→ink,
  Extrude→glossyPlastic, Solid→matteClay, Inflate→softGel. Applied in
  `handleModeChange` only when `materialUserOverride === false`; an explicit user
  pick pins the material and survives mode switches. "Reset to mode default"
  clears the override.
- **Animated Material v1 (preview-only).** Types: `none`, `shineSweep`,
  `gelShimmer`, `roughnessPulse`, `completionFlash`, `signalFlicker`, evaluated by
  `evaluateMaterialAnimation` against `globalStyleTime`. Subtle by default.
  Configured in the Material panel (toggle + type + speed + intensity).
- **Animation IA correction.** Animation is now a clear top-level concept, not a
  vague "Animate" button. New **Animation** panel enumerates all categories:
  Geometry Animation (basic playback today), Material Animation (active), and
  reserved IA for Texture / Dither / ASCII / Layer / Stack / Fusion — each labeled
  with its future branch name.
- **Sync to Draw.** `motionMode` of `off | independent | syncToDraw`. When
  `syncToDraw`, material animation may use reveal progress; geometry animation
  behavior is unchanged.
- **Debug fields** (Debug ON only): activeMaterialPreset, modeMaterialDefault,
  userMaterialOverride, materialColor/Roughness/Metalness/Clearcoat,
  materialAnimation Enabled/Type/Speed/Intensity, materialAnimationPreviewOnly,
  syncToDrawAffectsMaterialAnimation, and the five future*Reserved flags +
  materialDoesNotTouchGeometry.

### Files changed

- `lib/style-system.ts` — material params, animation types, mode defaults,
  `resolveMaterialParams`, `evaluateMaterialAnimation`, state fields.
- `components/viewport-3d.tsx` — live material, per-frame animation, debug fields.
- `components/style-panel-scaffold.tsx` — Material panel controls + Animation
  panel IA.
- `app/page.tsx` — mode-default wiring, Animation summary chip.
- `SESSION-HANDOFF.md` — this checkpoint.

### Scope / limitations

- Animated material is **preview-only**; static material may reflect in GLB via
  the existing material path, animated material export/baking is out of scope.
- Dither renderer **not implemented**. ASCII renderer **not implemented**.
  Procedural texture renderer **not implemented**.
- Geometry untouched. Current geometry animation behavior untouched. Export
  geometry untouched. No timeline, no keyframes, no advanced stroke-animation
  controls.

### Next branch — `POST_MVP_TEXTURE_AND_ANIMATED_TEXTURE_PHASE_1`

## LOCKED CHECKPOINT — `MATERIAL_READABILITY_ENV_AND_CUSTOM_PASS`

### Problem this branch fixed

Material presets looked nearly identical and the surface read as flat/near-black
because the scene had **no environment map** — `MeshPhysicalMaterial` highlights,
clearcoat, and metalness need reflections to be visible. Presets only varied
roughness/metalness, which is invisible without something to reflect.

### What changed

- **Studio environment map added** in `components/viewport-3d.tsx`. A neutral
  multi-`Lightformer` studio rig inside drei's `<Environment resolution={256}
  frames={1} background={false}>` bakes a reflection environment **once**
  (`frames={1}`, not a live scene background) onto `scene.environment`. This
  lights every mode's shared `liveMaterial`, so highlights, clearcoat streaks,
  and reflections are now visible. The 2D background and grid are unchanged; the
  env map is reflection-only (`background={false}`).
- **`envMapIntensity` added to the material model** in `lib/style-system.ts`
  (`MaterialParams.envMapIntensity`). Each preset now sets a deliberate value so
  reflections differ per preset (e.g. glossyPlastic high, matteClay low). The
  per-frame animation and the static `liveMaterial` both apply it.
- **Presets retuned for clear visual distinction** under the env map. Verified
  in-browser: Glossy Plastic shows crisp white + amber + blue specular streaks;
  Matte Clay shows a soft diffuse gradient with no sharp highlight.
- **Custom material added.** New `"custom"` member of `MaterialPreset` plus a
  `CustomMaterial` interface and `DEFAULT_CUSTOM_MATERIAL` in
  `lib/style-system.ts`. `resolveMaterialParams(preset, custom)` returns the
  custom params when preset === "custom". `styleState.customMaterial` holds the
  live values. The Material panel renders a **Custom material editor** (color /
  sheen color / emissive pickers + roughness / metalness / clearcoat / sheen /
  emissive / reflection sliders) only when the Custom preset is selected; edits
  update the 3D preview live.
- **Animation off now snaps the surface back to its static base** (added `else`
  branch in the `useFrame` material block) instead of freezing on the last
  animated frame.
- **Debug fields added** (Debug ON): materialSheen, materialEnvMapIntensity,
  isCustomMaterial, envMapPresent, materialAppliedToAllModes. The material
  readout and debug panel now use `resolveMaterialParams` so they reflect custom
  edits.

### Files touched

- `lib/style-system.ts` — `envMapIntensity`, `"custom"` preset, `CustomMaterial`,
  `DEFAULT_CUSTOM_MATERIAL`, `resolveMaterialParams(preset, custom)` signature,
  retuned preset params.
- `components/viewport-3d.tsx` — studio `<Environment>` + `Lightformer` rig on
  `scene.environment`, `envMapIntensity` applied in static + animated paths,
  anim-off reset branch, debug fields, removed unused `MATERIAL_PARAMS` import.
- `components/style-panel-scaffold.tsx` — Custom material editor, readout uses
  `resolveMaterialParams`.
- `SESSION-HANDOFF.md` — this checkpoint.

### Scope / limitations

- Env map is **reflection lighting only** — it is not drawn as a visible
  background and does not change the 2D canvas, grid, or geometry.
- Animated material remains **preview-only**; static material (including custom)
  follows the existing GLB material path, animated material is not baked.
- Geometry, draw-in clock, and export geometry untouched.

### Next branch — `POST_MVP_TEXTURE_AND_ANIMATED_TEXTURE_PHASE_1`

## LOCKED CHECKPOINT — `MATERIAL_APPLICATION_DISTINCTION_AND_ANIMATION_READABILITY_FIX_PASS`

Consolidates the env-map readability + custom-material work and re-verifies it
against the explicit spec for this branch. (Note: `components/viewport-3d.tsx`
and `components/style-panel-scaffold.tsx` had partially reverted during the
session; this pass re-applied and re-verified the changes.)

### Root causes identified (from visual review, not just code)

- **"Only Inflate reads clearly":** all four modes already shared one
  `liveMaterial`, but with **no environment map** the PBR clearcoat / metalness /
  sheen had nothing to reflect, so thin/low-curvature geometry (Rod, Extrude,
  Solid faces) collapsed to near-flat dark. Inflate's rounded tubes caught the
  few direct lights, which is why it *looked* like only Inflate responded.
- **Presets looked the same:** without reflections the roughness/clearcoat
  differences were invisible; every preset resolved to "slightly different
  black."
- **Animated material hard to see / too similar:** effects only nudged
  color/roughness with no reflection term, so the modulation was below the
  perceptual floor and the types were not differentiated by which property they
  drive.

### Fixes (re-applied this pass)

- **Studio environment map** — offline `<Environment frames={1}
  background={false}>` with four `<Lightformer>`s feeds `scene.environment`
  only. Reflection lighting, no visible background, no canvas/grid/geometry
  change. This is what makes material read on Rod / Extrude / Solid.
- **`envMapIntensity` added to `MaterialParams`** and tuned per preset so the
  six presets are visibly distinct (ink 1.0, softGel 0.7, matteClay 0.15,
  glossyPlastic 1.6, rubber 0.4, signal 1.3).
- **Animated material** now also drives `envMapIntensity`, and each type varies
  which property / wave shape / speed it animates; added an **anim-off reset**
  that pins the surface back to its static base.
- **`resolveMaterialParams(preset, custom)`** is the single shared resolution
  path; `baseParams` and `liveMaterial` both flow through it for all modes.

### Custom Material (Part C)

- `"custom"` material preset + `CustomMaterial` interface + `customMaterial`
  state. Editor in the Material panel (color / sheen color / emissive pickers +
  roughness / metalness / clearcoat / sheen / emissive / reflection sliders)
  updates the preview live across all four modes.

### Future custom IA reserved (Part C, not implemented)

- Debug fields assert reserved-but-unimplemented: `futureCustomTextureReserved`,
  `futureCustomDitherReserved`, `futureCustomAsciiReserved`,
  `futureCustomAnimationReserved`, `futureCustomFusionReserved`. Only **Custom
  Material** is implemented this branch.

### Debug fields (spec list)

activeMaterialPreset, materialSource (preset/custom/modeDefault),
materialAppliedToMode, materialAppliedToRod/Extrude/Solid/Inflate (all YES —
single shared material), materialColor/Roughness/Metalness/Clearcoat/
EnvMapIntensity, customMaterialActive, customMaterialValues,
materialAnimationEnabled/Type/Speed/Intensity,
materialAnimationAppliesToCurrentMode, materialAnimationVisibleEnough,
materialAnimationDistinctFromOtherTypes, syncToDrawAffectsMaterialAnimation,
materialDoesNotTouchGeometry, future custom* reserved flags.

### Test results (verified in-browser this pass)

- **Extrude + Glossy Plastic:** crisp white specular streak on top edge + warm
  amber reflection underneath. **Extrude + Matte Clay:** uniform soft mid-gray,
  no highlight. Distinction obvious on the same stroke.
- **Rod + Glossy Plastic:** specular highlight along the crest of the thin tube
  — material applies (subtler only due to thin geometry).
- **Inflate + Soft Gel / Glossy:** soft diffuse sheen vs sharp specular —
  confirmed earlier this session.
- Custom material color edit (cyan) updated the preview live.
- Dev server compiles clean; restored missing `evaluateMaterialAnimation`
  import (would otherwise crash) and removed unused `MATERIAL_PARAMS` imports.

### Confirmations

- Dither renderer NOT implemented. ASCII renderer NOT implemented. Procedural
  texture renderer NOT implemented.
- Geometry untouched. Current geometry animation untouched. Export geometry
  untouched. Texture/Dither/ASCII remain separate systems.

### Scope / limitations

- Env map is reflection lighting only (no visible background).
- Animated material is preview-only; static + custom material follow the
  existing GLB material path; animated material is not baked.

### Conclusion — `MATERIAL_APPLICATION_DISTINCTION_AND_ANIMATION_READABILITY_FIX_PASS`

### Next branch — `POST_MVP_TEXTURE_AND_ANIMATED_TEXTURE_PHASE_1`

---

## LOCKED CHECKPOINT — `LOGO_CAPTURE_VARIANTS_FONT_AND_TRACE_PASS`

**Status: both logo-capture variants delivered.** Finishes the v0 plan that ran
out of credits (PR #30): Variant B (clean rounded font, inflated, logo-sized)
and Variant A (traced logo, inflated, matching the handwriting). No app code
touched — capture tooling + stroke sources only.

### What was delivered

- **Variant B — font:** "Desk Doodles" laid out from the clean single-stroke
  vector font (`letters.mjs`, size 120 scaled to the trace's 1100px coordinate
  span so tube weight matches), injected via the DEV harnesses, Inflate mode,
  custom near-ink material (roughness 0.35). Fully legible inflated word.
  Output: `public/videos/desk-doodles-logo-flip-font.webm`.
- **Variant A — trace:** the skeleton tracer no longer shreds the word. Fixed
  `trace-logo.mjs`: walks THROUGH junctions picking the straightest
  continuation (dot-product against the recent heading) instead of stopping,
  then greedy endpoint-merging of fragments (≤6px gaps, direction-continuity
  guard so neighbouring letters never bridge), then left-to-right stroke
  ordering so the reveal draws like writing. 30 raw → 22 continuous strokes
  (was ~60 shredded fragments). The inflated word now reads as the real
  handwritten logo. Output: `public/videos/desk-doodles-logo-flip-traced.webm`.
- Reference stills: `scripts/capture/variant-b-font-full.png`,
  `scripts/capture/variant-a-traced-full.png`.

### New capture driver (agent-browser replacement)

- `scripts/capture/capture-run.mjs` — local Playwright-core driver using the
  installed system Chrome (`channel: "chrome"`, headless works fine for this
  WebGL capture since frames are grabbed via `canvas.toDataURL`, no
  rAF-dependent motion). Supports `--source=font|trace`, `--headed`, and the
  same env knobs as before (`DRAW_FRAMES`, `ROUGHNESS`, plus `FONT_TARGET_W`).
- `encode.mjs` now falls back to a system `ffmpeg` on PATH when pnpm blocks
  ffmpeg-static's postinstall download.
- Full pipeline per variant:
  `pnpm dev` → `node scripts/capture/capture-run.mjs --source=font|trace` →
  `node scripts/capture/compose.mjs --mode=with3d` →
  `node scripts/capture/encode.mjs --out=<name>.webm`

### Untouched

- Rod / Extrude / Solid / Inflate geometry, animation, export, style system,
  and all app components — zero app code changed this pass.

### Final locked checkpoint label

`LOGO_CAPTURE_VARIANTS_FONT_AND_TRACE_PASS`

(supersedes `MATERIAL_APPLICATION_DISTINCTION_AND_ANIMATION_READABILITY_FIX_PASS`
as the latest layer; all prior checkpoints remain in effect)

---

## LOCKED CHECKPOINT — `POST_MVP_TEXTURE_AND_ANIMATED_TEXTURE_PHASE_1_PASS`

**Status: procedural texture + animated texture are LIVE on all four modes.**
Renderer implemented (not rails). Geometry, geometry animation, and export
geometry untouched.

### What was built

- **`lib/texture-shader.ts` (NEW)** — the pattern renderer. Injects GLSL into the
  shared `MeshPhysicalMaterial` via `onBeforeCompile`, so all four modes get
  texture from the one live material. Patterns are COMPUTED from position (no
  UVs — Solid's raster/contour and Inflate's loft have no usable UV
  parameterization, so image textures were never an option).
  - Five patterns behind ONE shader, selected by the `uFsTexType` uniform:
    grain (per-cell hash), noise (2-octave value noise), scanlines, bands,
    contour (value noise sliced at even levels → topo lines).
  - `fsHash` + `fsValueNoise` with smoothstep-eased bilinear blend (the
    `f*f*(3-2f)` easing is what kills the value-noise grid seams).
  - Coordinate source = object space (welded to the form) or screen space
    (graphic overlay), per `textureLockMode`.
  - Animation = sliding the sample coordinate along a unit direction vector.
    Clock is elapsed time (`independent`) or reveal progress (`syncToDraw`).
  - Constant `customProgramCacheKey` so every textured material shares one
    compiled program.
- **`lib/style-system.ts`** — added `TextureDirection` + `textureDirection`
  state/default. TEXTURE_PRESET_DEFS and ANIMATED_TEXTURE_PRESET_DEFS are now
  `implemented: true` with real `applies` patches (Fine Grain, Scanlines,
  Contour Bands, Scratched Ink, Gel Bubbles / Grain Drift, Scanline Scroll,
  Ripple Flow, Band Crawl, Bubble Drift). They only ever write `texture*`.
- **`components/viewport-3d.tsx`** — texture uniforms in a ref (survive material
  re-creation); per-frame uniform writes in `useFrame`; full texture debug
  readout; NEW mode-agnostic `GEOM_BUILD_DEBUG.buildCount`; extracted
  `buildGLBBuffer` so the export button and the verification harness run the
  same export code; dev-only `window.__geomDebug`.
- **`components/style-panel-scaffold.tsx`** — real Texture panel (pattern /
  scale / intensity / contrast / lock mode + Texture Animation with speed and
  direction). Panel + Animation-category status flipped from "reserved" to
  "active".
- **`app/page.tsx`** — Texture summary chip now live (shows pattern + `·anim`);
  dev harness gained `setStyle(patch)` for verification sweeps.

### Root cause found by visual verification (not code review)

First implementation darkened albedo only. On the glossy near-black Extrude
default this was **invisible** — multiplying near-black by <1 stays near-black,
and on a glossy dark surface nearly all visible light is the specular lobe, not
albedo. Fix: bidirectional albedo modulation (lift AND darken) plus modulating
`material.roughness` and `material.clearcoatRoughness` right after
`<lights_physical_fragment>` so the HIGHLIGHT carries the pattern.
Measured: extrude/contour meanΔ 1.94 (below perceptual floor) → 10.74.

### Verification tooling (NEW, reusable for every future style phase)

- `scripts/verify/verify-style.mjs` — drives the running app through
  (mode × pattern) stills and long consecutive-frame motion runs; writes to
  `docs/verification/<pass>/`. `--only=still|motion` no longer wipes the other
  family.
- `scripts/verify/diff-frames.mjs` — measures each still against its mode's
  texture-off baseline (reads / faint / TOO SUBTLE) and each motion cell for
  consecutive-frame change (travels / jitters / STATIC).
- `scripts/verify/verify-gates.mjs` — asserts the geometry-rebuild gate, export
  health, and the taxonomy gate.

### Test results (all captured evidence in `docs/verification/texture-v1/`)

- **Stills — 20/20 read.** Every mode × every pattern above the perceptual
  floor. Range meanΔ 7.39 (inflate/noise) to 31.43 (solid/contour). Zero
  TOO SUBTLE, zero faint.
- **Motion — 4/4 travel.** inflate/grain, inflate/scanlines, solid/grain,
  solid/scanlines all show real consecutive-frame movement (consecΔ 17.2–56.9).
- **Geometry-rebuild gate — PASS on all four modes.** buildCount flat across 10
  style changes each: rod 2→2, extrude 4→4, solid 5→5, inflate 6→6.
- **Export regression — PASS on all four.** rod 2.16 MB, extrude 29 KB,
  solid 303 KB, inflate 261 KB, all non-empty with texture active.
- **Taxonomy gate — PASS.** Texture never enables dither or ASCII.
- **Console errors — 0** across every capture run.

### Confirmations

- Dither renderer NOT implemented. ASCII renderer NOT implemented.
- Geometry untouched. Geometry animation untouched. Export GEOMETRY untouched
  (only the GLB-building code path was extracted to a shared function; the
  produced buffer is identical).
- Texture is preview-only — no texture baking into GLB (per PRD: preview first,
  bake later).

### Docs

- `docs/PRD.md` (the plan, now in-repo), `docs/README.md` (the loop + doc system)
- `docs/explainers/01-procedural-texture.md` — code / tech / math / reasoning
- `docs/research/texture-phase.md` — every source used, what it is, what we used it for

### Next branch — `POST_MVP_DITHER_AND_ANIMATED_DITHER_PHASE_1`

### Final locked checkpoint label

`POST_MVP_TEXTURE_AND_ANIMATED_TEXTURE_PHASE_1_PASS`

(supersedes `MATERIAL_APPLICATION_DISTINCTION_AND_ANIMATION_READABILITY_FIX_PASS`;
all prior checkpoints remain in effect as underlying layers)

---

## LOCKED CHECKPOINT — `POST_MVP_DITHER_AND_ANIMATED_DITHER_PHASE_1_PASS`

**Status: dither + animated dither are LIVE on all four modes.** Threshold
renderer implemented. Geometry, geometry animation, and export geometry
untouched.

### What was built

- **`lib/dither-shader.ts` (NEW)** — threshold-based tonal reduction. Injects at
  `<dithering_fragment>` — the very END of the fragment shader, AFTER lighting,
  tone mapping and color space. This is what makes dither a genuinely different
  system from texture (which injects at albedo + lighting stages).
  - Core: `quantize(luminance + (threshold(x,y) - 0.5))`. The `- 0.5` centring
    is required or average brightness drifts up (Wikipedia flags this).
  - `fsBayer` generates the Bayer recurrence ARITHMETICALLY (one bit of x/y per
    refinement level, accumulated base-4) instead of a lookup table, so ONE
    function serves both 4x4 and 8x8 via a `levels` parameter.
  - Five threshold maps: bayer4, bayer8, blueNoise (interleaved gradient noise —
    honestly labeled "Noise threshold (IGN)", NOT true blue noise), halftone
    (distance-from-cell-centre so dots GROW with tone, like print), lines.
  - Rec. 709 luma weights for perceived brightness.
  - Hue preservation: divides colour by its own luminance, quantizes brightness,
    re-applies the tint — so material presets stay distinguishable under dither
    instead of all collapsing to identical black/white.
- **`lib/style-shader.ts` (NEW)** — a material has ONE `onBeforeCompile`, but
  texture and dither must both live on the shared material. This composer
  stitches each system's GLSL into its correct chunk while each system keeps its
  own module, uniforms and state (the PRD's separation preserved in code).
- **`lib/texture-shader.ts`** — refactored to export its GLSL as constants
  (`TEXTURE_COMMON_GLSL` / `TEXTURE_MAP_GLSL` / `TEXTURE_LIGHTS_GLSL`) for the
  composer. Behaviour identical.
- **`lib/style-system.ts`** — added `ditherIntensity`, `ditherLevels`, and a
  DEDICATED `ditherLockMode` (dither gets its own, not texture's). DITHER and
  ANIMATED_DITHER preset defs are now `implemented: true` with real `applies`
  patches (Bayer Classic, Dot Matrix, Hard Threshold, Soft Dither, Pixel Signal /
  Dither Crawl, Threshold Sweep, Reveal Dither, Completion Pulse Dither,
  Diagonal Matrix Drift).
- **`components/viewport-3d.tsx`** — dither uniforms ref + per-frame uniform
  writes; two genuinely different animation behaviours (see below); full dither
  debug readout.
- **`components/style-panel-scaffold.tsx`** — real Dither panel (threshold map /
  cell size / tone levels / threshold bias / contrast / amount / lock mode +
  Dither Animation with speed and motion kind). Panel + Animation-category
  status flipped to "active".
- **`app/page.tsx`** — Dither summary chip now live; harness gained
  `selectPreset(family, id)` so gates exercise the REAL preset path.

### Animated dither = THRESHOLD motion (not pattern motion)

- **Matrix crawl** (direction chosen): offsets the threshold lookup coordinate,
  so the dither structure travels while tone stays put.
- **Threshold-bias sweep** (direction "static"): oscillates the bias so tone
  opens and closes in place, like an aperture. Verified in frames: sparse dots →
  open checkerboard.
- **Sync to Draw**: threshold opens as the reveal progresses.

### NEW verification check — pairwise distinctness

`diff-frames.mjs` now also compares every variant against every OTHER variant
within a mode, not just against the off baseline. This is the check that would
have caught the historical "all the material presets look the same" bug — a set
of options can each differ hugely from off while being near-identical to each
other. Retroactively run on texture-v1 too; both systems pass.

### Test results (evidence in `docs/verification/dither-v1/`)

- **Stills — 20/20 read.** Every mode × threshold map, meanΔ 22.83 (extrude/
  lines) to 119.80 (solid/halftone). Zero TOO SUBTLE, zero faint.
- **Distinctness — distinct on all four modes.** Closest pair is bayer4 vs
  bayer8 (same family, different resolution): 9.68 extrude / 17.36 rod /
  36.52 inflate / 70.93 solid.
- **Texture distinctness (retroactive) — distinct on all four modes.** Closest
  pair grain vs noise: 13.84–23.90.
- **Motion — 3/3 travel.** solid/crawl (consecΔ 72.15), solid/sweep (9.56),
  inflate/halftonesweep (13.10).
- **Geometry-rebuild gate — PASS on all four modes** across 20 combined
  texture+dither style changes each: rod 3→3, extrude 5→5, solid 6→6,
  inflate 7→7.
- **Export regression — PASS on all four** (unchanged byte counts).
- **Taxonomy gates — PASS.** Texture never enables dither/ASCII; the dither
  preset `dotMatrix` applies `ditherType: halftone` and touches neither
  `textureMode` nor `ascii*`. Asserted through the real `handleSelectPreset`.
- **Console errors — 0** across every run.

### Confirmations

- ASCII renderer NOT implemented (next phase).
- Geometry untouched. Geometry animation untouched. Export geometry untouched.
- Dither is preview-only — no dither baking into GLB.
- Texture (pattern) / Dither (threshold) / ASCII (glyphs) remain separate
  systems with separate state, separate modules, and separate shader stages.

### Docs

- `docs/explainers/02-dither.md` — code / tech / math / reasoning
- `docs/research/dither-phase.md` — every source used

### Next branch — `POST_MVP_ASCII_AND_ANIMATED_ASCII_PHASE_1`

### Final locked checkpoint label

`POST_MVP_DITHER_AND_ANIMATED_DITHER_PHASE_1_PASS`

(supersedes `POST_MVP_TEXTURE_AND_ANIMATED_TEXTURE_PHASE_1_PASS`; all prior
checkpoints remain in effect as underlying layers)

---

## LOCKED CHECKPOINT — `POST_MVP_ASCII_AND_ANIMATED_ASCII_PHASE_1_PASS`

**Status: ASCII + animated ASCII are LIVE on all four modes.** Glyph renderer
implemented. All three visual primitives (texture / dither / ASCII) now exist
and compose. Geometry, geometry animation, and export geometry untouched.

### What was built

- **`lib/ascii-shader.ts` (NEW)** — glyph-grid renderer. Injects at
  `<dithering_fragment>` AFTER dither, so glyphs represent the tone dither
  produced.
  - **No font, no texture atlas.** Each character is a 5x5 bitmap packed into
    bits (bit index = x + 5*y); a pixel works out its position in the cell and
    tests one bit.
  - **PRECISION:** a full 5x5 block is 2^25-1 but GLSL floats are only exact to
    2^24 — every glyph is split into lo (13 bit) / hi (12 bit) halves. Storing
    the raw value would silently corrupt the densest glyphs.
  - Five charsets: classic `.:-=+*#%@`, blocks, binary, dots, code marks.
- **`scripts/gen/glyphs.py` (NEW)** — generates the bit tables from readable
  ASCII-art strings so bitmaps are reviewable as pictures, not magic numbers.
  **Self-validating:** our `0` encodes to 15255086, the exact constant the
  Codrops reference publishes for the same glyph — confirms the bit convention.
- **`lib/style-shader.ts`** — now composes all three systems into one
  `onBeforeCompile` with the correct stage ordering.
- **`lib/style-system.ts`** — `AsciiAnimationType` (scroll / rain / cycle /
  flicker / revealDensity), `asciiLockMode`. ASCII + ANIMATED_ASCII presets now
  `implemented: true` with real `applies` patches.
- **`components/viewport-3d.tsx`** — ASCII uniforms + per-frame writes + full
  debug readout.
- **`components/style-panel-scaffold.tsx`** — real ASCII panel (charset / cell
  size / density / contrast / lock + animation behaviour / speed / direction,
  with direction disabled for the behaviours that don't travel).
- **`app/page.tsx`** — ASCII chip live.

### Three bugs found ONLY by looking at frames

1. **Empty output.** Raw luminance of near-black ink (~0.05–0.25) only ever
   selected the two sparsest glyphs. Fixed with an exposure step: divide
   luminance by a reference representing "bright for this subject". Density IS
   that reference.
2. **Flat mesh.** The first exposure fix over-corrected — hard contrast
   expansion saturated every cell to the DENSEST glyph, so no character
   variation showed. Contrast multiplier reduced ~3.0 → ~1.1.
3. **Invisible glyphs.** Lit pixels were `surface * 1.35`, which on near-black
   is still near-black. Now hue is recovered by dividing by luminance and
   brightness is set explicitly (bright glyph / near-black gap), same technique
   as dither, so material presets stay distinguishable.

All three were correct code that rendered wrong. This is the third consecutive
phase where the frames-verified rule caught something review would not have.

### CONVENTION NOTE (deliberate inversion)

Traditional ASCII art maps DARK → DENSE (black chars on white paper). Free
Stroke's glyph pixels are the LIT part of a dark object, so we map
BRIGHT → DENSE. Copying the traditional convention would make highlights vanish
and shadows glow.

### Animated ASCII = GLYPH motion, five genuinely different behaviours

scroll (grid travels) / rain (each column falls at its own hashed speed) /
cycle (glyphs change in place, walking the ramp) / flicker (random cells jump
per tick) / revealDensity (density follows draw-in).

### Test results (evidence in `docs/verification/ascii-v1/` + `stack-v1/`)

- **Stills — 20/20 read.** meanΔ 17.06 (extrude/blocks) to 100.42
  (solid/blocks). Zero TOO SUBTLE, zero faint.
- **Distinctness — distinct on all modes.** Closest pair classic vs custom
  (17.03 extrude / 31.43 rod / 58.04 inflate).
- **Motion — 4/4 travel.** solid/scroll 61.86, solid/cycle 46.79, solid/rain
  38.46, inflate/flicker 13.21 (consecutive-frame change).
- **Geometry-rebuild gate — PASS on all four modes** across 30 combined
  texture+dither+ASCII style changes each.
- **NEW: all three systems STACKED — PASS.** texture + dither + ASCII
  simultaneously: no geometry rebuild (buildCount 10→10), export still works
  (261 KB), zero console errors. Four-step layering series captured in
  `docs/verification/stack-v1/`.
- **Taxonomy gates — PASS.** ASCII preset `blockGlyph` applies
  `asciiCharset: blocks` and touches neither `texture*` nor `dither*`. Asserted
  through the real `handleSelectPreset`.
- **Export regression — PASS on all four.**
- **Console errors — 0.**

### Known limitation (documented, not hidden)

Character selection uses PER-PIXEL luminance, not cell-mean luminance, because
this runs in the MATERIAL shader where a fragment cannot read its neighbours.
The ramp is coarsely quantized so nearly every cell resolves to one character; a
cell on a brightness boundary can show two. True cell-averaging requires a
post-process pass — listed in the panel's future controls.

### Observation for the layer-stack phase

With all three systems on at default strengths the result is legible but dark.
Tasteful stacking defaults (one dominant graphic layer, others supporting) are
explicitly that phase's job; `stack-v1/` gives it a baseline.

### Docs

- `docs/explainers/03-ascii.md` — code / tech / math / reasoning
- `docs/research/ascii-phase.md` — every source, incl. the deliberate
  convention inversion and the finding no source covers (dark subjects)

### Next branch — `POST_MVP_VISUAL_TIMING_SYSTEM_PHASE_1`

### Final locked checkpoint label

`POST_MVP_ASCII_AND_ANIMATED_ASCII_PHASE_1_PASS`

(supersedes `POST_MVP_DITHER_AND_ANIMATED_DITHER_PHASE_1_PASS`; all prior
checkpoints remain in effect as underlying layers)
