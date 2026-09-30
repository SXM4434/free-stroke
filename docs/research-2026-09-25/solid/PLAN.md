# Solid's rebuild stutter: plan

**Status: PARTIAL.** The measurement, the cause and one prototype are done and measured in Node. Web research on
workers and shader reveals was NOT done (the lane hit its 150k context line first), so the options below that are
not prototyped carry no external sources yet. Written 2026-09-25 by a read-only research lane. No product file changed.

## 1. What is wrong, from the record

Lane S2 (`docs/RUN-QUEUE.md`, "F118 lane S2 note, 2026-09-25 ~05:10"), dev, Solid playing on `/`:
815 main-thread ms a second, 706 of them under `useStrokeMeshes` / `buildMaskSolid`, `detectInteriorHoles` alone 389.
The tick syncs about 30 times a second, each rebuild about 21 ms, frames p95 33.4 ms, max 50.1 ms.
Prod before (no lifts): 418 ms/s, 0 frames over 20 ms. So the stutter is a dev-build problem today, with prod at
about half the frame budget. Any slower machine or longer word crosses the line in prod too.

## 2. Measured again, in Node, on the hero word

Rig: `bench.mjs`, `agg.mjs`, `make-mutant.mjs`, `crossholes.mjs` in
`/private/tmp/claude-501/-Users-sebs/2a1d3d28-4efb-4862-bdf3-64238bb23149/scratchpad/solid/` (this lane may not write
them into the repo; the controller copies them in before that scratchpad is cleared). It loads the real `lib/geometry-engines.ts`
and `lib/solid-mask.ts` through the repo's own loader `scripts/verify/_ts-load.mjs` (the loader every `scripts/verify`
probe uses; `scripts/verify/lib/engine-node.mjs` shims `document.createElement("canvas")` with `@napi-rs/canvas`, a real
raster). Input: `scripts/capture/logo-strokes.json` (12 strokes, 1100x242) fitted to 90 % of the harness canvas
(650x802), processed by `engine-node.process`. Each frame: `filterStrokesByProgress(strokes, f/121)`, then
`SolidEngine.buildPreview` with `holeStabilization = { mode: "ANIMATION_GATED", activeFinalHolesWorld: [] }`, the
override Scene passes from the first frame of play. 120 frames, 3 warm-up builds.

| arm | mean | p50 | p95 | max |
|---|---|---|---|---|
| animated path, today | 12.39 ms | 11.45 | 22.68 | 36.70 |
| static path (no override, 512 mask), today | 20.01 ms | 19.66 | 35.73 | 43.60 |

Run-to-run noise: two runs of the same arm gave 12.39 and 12.69 ms mean. Read differences under about 5 % as nothing.

CPU profile of the animated arm (`node --cpu-prof`, 200 us sampling, `agg.mjs` sums inclusive time per function), share of `buildPreview`:

| function | share |
|---|---|
| `detectInteriorHoles` | 41.5 % |
| `renderStrokeToMask` | 13.9 % |
| `labelConnectedComponents` | 7.8 % |
| `traceOuterContour` | 4.6 % |
| geometry (normals, shape, triangulate, merge) | about 6 % |

Node agrees with lane S2's browser profile: hole detection is the largest single cost.

## 3. Why, with file:line

1. **Every pass runs over the whole canvas, once per cluster, twice per build.**
   `SolidEngine.buildPreview` splits the strokes into clusters by ink overlap (`lib/geometry-engines.ts:5236`
   `clusterStrokesByInkOverlap`) and calls `buildMaskSolid` once per cluster (`lib/geometry-engines.ts:5382-5405`).
   The hero word is 2 clusters (measured: `SOLID_DEBUG.clusterCount = 2`). Each call rasters the WHOLE canvas at
   384 wide (`lib/solid-mask.ts:1631`, `renderStrokeToMask` `lib/solid-mask.ts:3674`), labels components over the
   whole canvas (`:3837`), copies a whole-canvas component mask (`:1740` area), and floods every EMPTY pixel of the
   canvas in `detectInteriorHoles` (`:4274`). The word covers a small part of the canvas, so most of that work is
   the blank page. Then counter detection repeats raster, labelling, copy and flood at a thinner line
   (`lib/solid-mask.ts:2143-2213`). That is about 4 whole-canvas floods and 4 whole-canvas rasters per tick.
2. **During play the detected holes do not reach the geometry.** Under `ANIMATION_GATED` the holes that feed the
   cap are REPLACED by the caller's active final holes (`lib/solid-mask.ts:2496-2522`). The per-tick detection only
   produces `detectedPartialHoleCentroidsWorld` (`lib/solid-mask.ts:2451`), which Scene's activation matcher reads
   (`components/viewport-3d.tsx` effect after the Play snapshot, `ACTIVATION_HIT_STREAK = 2`). So each tick pays for
   a full detection whose only output is a list of centroids.
3. **The rebuild count.** `SolidAnimationTick` (`components/viewport-3d.tsx:7527`) syncs every 22 ms, and each
   sync re-runs the `animatedStrokes` memo (`:8612`) and `useStrokeMeshes` (`:516`), which rebuilds EVERY cluster,
   including a cluster that is already fully drawn and has not changed since the last tick.

## 4. A defect found on the way (Node only, not filmed)

`SOLID_DEBUG.lastStages` is the HEAD cluster's stages only (`lib/geometry-engines.ts:5578`, from
`mergeSolidResults`, which keeps `results[0]`'s stages). Scene snapshots the final holes from it on Play and reads
partial centroids from it every tick. So on the hero word:

- The final-hole snapshot holds 2 holes, both in the head cluster ("Doodles"). "Desk"'s own hole is not in it, so
  during play the "Desk" cluster never gets its hole until the final static frame. Measured: head `stableHolesWorld`
  = 2; the "Desk" strokes alone build 1 hole of their own.
- The override is passed to EVERY cluster. Measured (`scratchpad/solid/crossholes.mjs`): the "Desk" strokes built
  with Doodles' 2 holes as the override give 2688 vertices and `holesUsed = 2`, against 2224 and 0 with the empty
  override. Two foreign holes get extruded as inner walls inside a cluster whose outline does not contain them.

Nobody has looked at this on screen. It may be invisible (the foreign walls sit inside Doodles' own holes) or it may
z-fight. It belongs in the ledger as its own row, and any per-cluster change below must fix it first, because
it changes what a per-cluster cache key has to hold.

## 5. Options

| option | what it saves | picture risk | size |
|---|---|---|---|
| A. Bound the flood to the ink's bbox plus a 1 px ring | measured, see 6 | none, proved identical | 1 function |
| B. Bound raster, labelling and the mask copy to a dirty rect | the next ~30 % | none if the rect is padded by half the line plus AA | 3 functions |
| C. Cache each cluster's build; rebuild only the cluster the pen is in | about half the builds on a 2-cluster word | geometry disposal, see risk | geometry-engines |
| D. Skip counter detection while `ANIMATION_GATED` | about a quarter | changes which centroids reach the matcher, so hole timing | 1 condition |
| E. Precompute each final hole's activation distance once on Play, drop per-tick detection | all detection per tick | changes when holes appear; must match today's streak rule | Scene plus engine |
| F. Worker (`lib/implicit-surface.worker.ts` is the model) | main thread free | one frame of lag, activation reads `SOLID_DEBUG` synchronously today | large |
| G. Build once, reveal by shader clip or drawRange (how Inflate Auto already reveals, 0 commits a second) | all rebuilds | a union mask is not a clip of the final; the cut end is an open shell with no cap | large, his call |

Not researched with sources (context line): F and G. Before either is picked, a lane should read how
`lib/implicit-surface.worker.ts` hands geometry back and how Inflate's implicit drawRange orders triangles
(`lib/stroke-schedule.ts:1105` `sortTrianglesByKey`), and look up OffscreenCanvas 2D in workers.

## 6. Prototype A, measured

`scratchpad/solid/make-mutant.mjs` writes a `GATE_MUTATE_FILE` JSON that swaps only the flood half of
`detectInteriorHoles` (from `const emptyLabels = ...` to `const detected = ...`, with a `was` guard so a stale offset
fails loudly). Nothing on disk changes; the loader substitutes the text. The new flood:

- finds the bbox of the filled pixels, grows it by 1 px, clamps it to the canvas;
- floods only inside that box; a region touching the box edge (or the canvas edge) is the exterior;
- keeps `emptyLabels` full size, so the per-hole crop at `lib/solid-mask.ts:2354` indexes it unchanged.

Why it is exact: every pixel outside the ink's bbox is empty and joined to the canvas edge, so the 1 px ring is
exterior; a region that reaches the ring is the exterior, one that does not is enclosed exactly as in the full scan.
Scan order inside the box is the full scan's row-major order, so hole label ids come out the same.

| arm | mean | p50 | p95 | max |
|---|---|---|---|---|
| animated, today | 12.39 ms | 11.45 | 22.68 | 36.70 |
| animated, A | **7.82 ms** | 7.05 | 15.07 | 18.29 |
| static, today | 20.01 ms | 19.66 | 35.73 | 43.60 |
| static, A | **13.55 ms** | 12.14 | 30.22 | 34.11 |

That is 37 % off the animated build and 32 % off the static one. After A, `detectInteriorHoles` is 8.3 % of the
build (was 41.5 %); the raster is now the top cost at 18.8 %, then labelling at 9.8 %.

**Identity.** Per frame the rig hashes every float of every mesh's position buffer (FNV over the Float32 bits), plus
the head cluster's `validHoleCount` and every partial centroid to 5 decimals with its pixel area:
A vs today, **120 of 120 frames identical** on the animated path and **120 of 120** on the static path. 102 of the
120 frames carry at least one partial centroid, so the matcher's input is covered, not just empty frames.

**Must-fail control.** The same mutant with the border rule put back to canvas edges only (`--canvas-edge-only`,
so exterior pockets inside the box count as holes): **0 of 120 identical** on both paths. The hash can see a
wrong flood. A first control (ring of -2 px) passed 120 of 120, because a 2 px trim never reaches an enclosed hole;
a ring of -40 px crashed on a negative array length at small partials. Both are recorded so nobody reuses them.

Estimated browser effect, not measured: lane S2's 389 ms/s in `detectInteriorHoles` scales with it, so roughly 300
ms/s off Solid's 797 ms/s in dev. The next lane measures that; this estimate is not a result.

## 7. Recommended change and risk

**Do A now.** One function, `lib/solid-mask.ts:4274` flood half, the text in `make-mutant.mjs`. It is exact,
measured identical on both paths, and it speeds static and export builds too (every caller of `buildMaskSolid`).
Risk: `borderTouchingEmptyCount` (debug panel only, `components/viewport-3d.tsx:14000`) can differ, since the scan
no longer sees exterior pockets outside the box. No geometry reads it.

**Then B**, the same bounding for `renderStrokeToMask` (`getImageData` of the dirty rect only), `labelConnectedComponents`
and the component-mask copy. Rect = stroke bbox in mask space, padded by `ceil(thicknessPx / 2) + 2`. Same identity
rig, same must-fail control shape (a rect padded by 0 must break the round caps).

**Then C, after the section 4 defect is fixed**: filter the override holes to each cluster (centroid inside the
cluster's outline), snapshot and match holes across ALL clusters, then cache per-cluster results keyed on the
cluster's points and the override. Risk: a cached `THREE.BufferGeometry` returned twice may be disposed by the
viewport when the mesh list changes; the cache must own its geometries or hand out clones.

D and E change when a hole appears, so they need a film and his eye. F and G are larger and G is a look decision.

## 8. Test plan for the build lane

Probes and gates, in order. Each row is run on the tree before the change and after, and every moved row is read.

1. **Node identity, the rig above.** `bench.mjs --frames=120` and `--static`, sigs diffed frame by frame: must be
   120 of 120 on both. Add two more inputs: `scripts/verify/lib/engine-node.mjs` `SHAPES` (every shape, static) and a
   one-letter "o" (the smallest hole, where a tight box matters most). Must-fail: the `--canvas-edge-only` mutant
   must drop to 0 identical, or the rig is blind.
2. **Node timing.** Same rig, three runs per arm, report mean, p50, p95. Pass bar: animated mean at or under 8.5 ms
   on this machine.
3. **Gates that read Solid** (from lane S2's list, none were run after S2's change either):
   `assert-take-timeline`, `assert-drawin-timing`, `assert-export-window`, `assert-drawin-attrs`,
   `assert-harness-surface`, `assert-implicit-reveal`, `assert-cap-fit`, `assert-dead-code`, before and after.
4. **Browser frames, own headless Chrome, own profile dir and port, killed by exact pid.** `probe-frames.mjs
   --mode=solid` at `--gap-ms=0` and `400`, dev and prod (`next build`, `next start -p 3123`): R3F commits a second,
   main-thread ms a second, frames over 20 ms, p95. Before and after. Expect commits unchanged and ms/s down.
5. **Picture.** `probe-still.mjs --mode=solid --gap-ms=400` at playheads 0.25, 0.5, 0.55, 0.6, 0.75, 1: 0 px changed
   before vs after. Positive control, as S2 did: 0.25 vs 0.75 must differ by thousands of px.
6. **Film.** Solid playing the hero word, before and after, same crop, real time. Open three frames of each (one
   mid "Desk", one at the "Desk"/"Doodles" join, one mid "Doodles") and write what is on them. Look for the section
   4 hole on "Desk": does its D get its hole before the last frame. It should not today; say what you saw.

## 9. What this lane did not check

- No browser run of the prototype; the dev and prod ms/s after A are estimates.
- Web research on workers, OffscreenCanvas and shader reveal: not done.
- Option C (per-cluster cache): not prototyped, not timed.
- The section 4 defect: measured in vertex counts only, never looked at on screen.
- The harness canvas (650x802) is not the live `/` canvas; the blank-page share, and so A's saving, depends on the
  canvas size and the word's share of it.
