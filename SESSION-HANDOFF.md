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
