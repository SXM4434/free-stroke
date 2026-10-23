# Explainer 07 — The engine passes

What changed when geometry was unlocked, across all four engines and the stroke
math upstream of them — and the one bug pattern that turned up in three of them.

Files: `lib/geometry-engines.ts`, `lib/solid-mask.ts`, `lib/stroke-processing.ts`,
`components/viewport-3d.tsx`, `scripts/verify/geometry-baseline.mjs` (new).

---

## 1. Why geometry was locked, and what replaced the lock

The PRD said, repeatedly and in bold: *do not touch geometry*. That wasn't
timidity. This project spent months in what the handoff calls "engine survival"
— every phase a rescue — and the lock was what let the visual systems get built
at all.

When the lock lifted, the first thing built was not an engine change but a
**regression net**: `scripts/verify/geometry-baseline.mjs`. It runs eight stroke
shapes drawn from this project's own failure history through all four modes and
records an export size and a rendered PNG for each of the 32 cells.

```bash
node scripts/verify/geometry-baseline.mjs --save=before
# ...change an engine...
node scripts/verify/geometry-baseline.mjs --save=after
node scripts/verify/geometry-baseline.mjs --compare=before,after
```

The eight shapes each encode a past failure: open C (must *not* grow a hole),
closed O (must keep one), near-touch gap (must not bridge), zigzag (corner
handling), self-intersecting scribble (the classic ribbon killer), two strokes,
a degenerate 6-point tick, and a loopy S.

The only *hard* failure is geometry or export dying. Everything else is a
judgment call — improving an engine **should** move the numbers. The point isn't
to freeze the output; it's that every move is visible and deliberate instead of
discovered three phases later.

---

## 2. The bug pattern: code that runs and does nothing

Three of the four engines contained a version of the same thing — code that
executed correctly, cost real time, and had no effect or the wrong one. None of
it was catchable by reading; all of it needed instrumentation or measurement.

### Extrude: a sign error that cost years

A miter joint extends the outer corner so a stroked path stays full width
through a turn. The correct offset length is:

```
miterLength = halfWidth / cos(φ/2)
```

where φ is the angle between the segments. The deprecated code used
**`sin(φ/2)`**.

That difference matters most exactly where it hurts. On a *nearly straight*
vertex φ approaches 180°, so φ/2 approaches 90°: `cos` heads to 0 (a bounded,
clampable miter) while **`sin` heads to 1**… but on a *sharp* vertex φ→0, and
`sin(φ/2)` → 0, so `halfWidth/sin` **diverges to infinity**. Every near-fold in
a stroke produced an enormous spike.

Those spikes are the "spikes/blob" artifact recorded in the handoff — and the
reason miters were abandoned here entirely, replaced with a hard clamp at
`halfWidth`. That clamp is geometrically *always too short*, which is why every
corner in this app had been pinching to about 70% width ever since.

The fix restores the correct formula, and gets it almost free: since
`|n₁ + n₂| = 2cos(φ/2)` for unit normals, the averaged normal's own length
*is* the cosine term. Clamped at 2× for safety.

### Extrude: a four-strategy chain where only one strategy ran

The engine had a legacy parametric path (tried first), an experimental
raster-trace path, a continuous-ribbon fallback, and a Rod emergency fallback.
Instrumenting the live app across all eight shapes showed **every single stroke
— including a straight line and the 6-point tick — took `legacy → continuous
ribbon`.** The "preferred" path had *never once succeeded*: its self-built
contour always failed validation. The raster path was unreachable behind a
compile-time constant that never flipped.

885 lines deleted. Continuous-ribbon *is* the engine.

### Solid: an O(n²) test for something geometrically impossible

`contourSelfIntersects()` checked every segment pair of the traced contour, on
**every animation frame**. The contour comes from marching a pixel lattice, so
its segments are unit-length, axis-aligned, and each undirected edge is emitted
at most once — under those constraints a proper crossing **cannot occur**. The
function was performing millions of segment-vs-segment tests per frame to
compute a constant `false`.

That was the single largest cost in a draw-in running at ~17fps.

### Rod: paying full price for buried geometry

Joint spheres fill the wedge gap on the *outside* of a sharp corner where two
consecutive tube cross-sections don't meet. Their radius equals the tube radius,
so **the vast majority of each sphere is inside the tube** — only a small cap is
ever visible, and only at corners.

They were built at full resolution (14×14 = 225 vertices) and deduplicated only
every 0.75× radius, so consecutive spheres overlapped almost entirely. A dense
scribble piled up hundreds of them: **10.7 MB of GLB, nearly all of it invisible.**

Dropping joints to 8×8 (81 verts — caps keep full resolution, since caps *are*
visible) and widening dedup to 1.8× radius (spheres span 2× radius, so adjacent
joints still touch) gave **−83%** with no visual change.

---

## 3. What actually got faster, and how it was measured

Performance claims are worthless without a method. Solid's draw-in was measured
headed, via the real Play button, recording `requestAnimationFrame` deltas.

| | before | after |
|---|---|---|
| standard stroke | 57.4 ms/frame mean (~17fps), 28 frames >40ms | **0 frames >40ms**, p99 26ms |
| heavy 600-pt scribble | 66.5 ms (~15fps) | 34.1 ms (**~29fps**) |

Beyond the impossible intersection test, three ordinary mistakes:

- Both flood fills used `queue.shift()`. On a JavaScript array that is **O(n)
  per pop**, making a linear-time algorithm quadratic. Replaced with a head
  pointer — the standard fix, and one worth remembering: `shift()` in a hot loop
  is a performance bug, not a style choice.
- A fresh canvas and a non-`willReadFrequently` 2D context were allocated per
  rasterize, twice a frame. Without that flag the browser keeps the surface
  GPU-side and every `getImageData` forces a readback stall.
- Roughly eight `console.log` calls **with object payloads** per build per frame.
  Serialising objects for a console nobody was reading, 60 times a second.

Plus one honest trade: animated builds now rasterize at 384px instead of 512px.
**Playback only** — static preview, the final committed frame, and export all
stay at 512. Hole-detection thresholds scale with the resolution so topology
decisions don't change with it.

---

## 4. Aliasing: why smoothing a contour is dangerous, and how to do it safely

Solid's silhouette came from a marching-squares boundary at mask resolution, fed
straight into triangulation. That's a pixel staircase, and it showed.

Smoothing a contour is risky in a way smoothing a curve is not: Solid's holes
depend on the *topological relationship* between the outer boundary and each
hole rim. Move them carelessly and a hole fuses with the outside, or two rims
merge, and the H3 hole system silently produces wrong geometry.

So the smoothing is bounded and guarded:

1. **Exact collinear simplification** — removes redundant vertices without
   moving the polygon at all.
2. **Three Chaikin corner-cut passes** — replaces each corner with two points
   ¼ and ¾ along its edges. Converges to a quadratic B-spline.
3. **Douglas–Peucker at 0.45px** — drops points that don't carry shape.

Guarded by: area retention between 90–105%, a self-intersection check, and a
fallback to the exact loop if either fails. Maximum deviation stays under 0.9
mask pixels — **inside the ≥1px filled wall that separates any hole from the
outer boundary**, so the smoothing provably cannot fuse or create topology.

Side effect worth having: Solid exports shrank **53–93%**.

---

## 5. Stroke processing, and a correction to my own claim

Two changes upstream of every engine.

**Taubin smoothing.** The kernel was `c*0.5 + (p+n)*0.25` — a Laplacian pass,
run twice. Laplacian smoothing pulls every point toward the chord between its
neighbours, so it *shrinks* the curve on every pass. Taubin alternates it with a
slightly larger **negative** pass (λ = 0.5, μ = −0.53) which re-inflates: tremor
is removed by both passes, shape survives because they cancel.

**But measured honestly, this changed rendered size by 0.00%.** Shrinkage per
pass goes roughly as `s²/8R`; at the default 4px spacing against a ~170px radius
that's about 0.006px. The change is *preventive* — it bites at coarse spacing
with tight curvature (s=20px, R=50px works out near 4% over four passes), both
reachable from the spacing slider. It is the correct algorithm and costs
nothing, so it stays. It did not fix a bug I could see, and saying otherwise
would be a lie the numbers contradict.

**Re-resample after smoothing** — the measurable one. Smoothing moves points off
the arc-length grid the resample just built, and every engine assumes even
spacing: Rod's cross-sections, Solid's rasteriser and Inflate's loft all sample
the point list directly, so drift shows up as wobbling radius and stair-stepped
contours. Re-resampling afterwards restores the grid and keeps the smoothed
shape. Export sizes fell up to 23% for the same form.

---

## 6. Inflate: what got better, and what a loft can never do

Two real deficiencies fixed:

**End caps.** The old "hemisphere" faded the ring radius to zero *across the
last in-stroke samples*. That shortened the form, made cap shape depend on
sample spacing, and left a degenerate final ring. Replaced with true ellipsoid
domes appended *beyond* each endpoint — rings of radius `cos(φ)` at offset
`L·sin(φ)`, tip one cap-length past the end.

**Crossings.** Tubes previously hard-interpenetrated. A spatial hash now finds
where another body passes within a merged diameter and swells both tubes
smoothly (+22–40% radius, scaling with Puff).

**What it still cannot do.** Inflate is a *swept loft* — a tube extruded along a
path. A loft's topology is fixed by construction: a ring of vertices per sample,
stitched in order. Two lofts that cross can be made to bulge, but they can never
*merge*, because merging requires re-computing the surface itself.

Real fusion needs an **implicit field**: define a scalar function that's high
near the stroke and low away from it, combine strokes with a smooth minimum
(which blends rather than unions), and extract the surface with marching cubes.
Topology falls out of the field, so crossings fuse for free.

That is the right long-term answer and it is deliberately **not started** — it's
a rewrite, not a pass, and a half-finished one would be worse than the working
loft. Written up here so the decision is recorded rather than rediscovered.

---

## 7. What this pass did not fix

- Heavy scribbles draw in at ~29fps, not 60. The remaining cost is the per-tick
  full pipeline. Next step is typed-array masks, currently blocked by `boolean[]`
  in `MaskSolidStages` being consumed by the debug overlay.
- Faint segment striping on Solid's inner rim walls under grazing light.
- Inflate crossings swell but do not fuse (see §6).
- Rod's tube still uses a fixed radial segment count regardless of curvature; a
  curvature-adaptive count would cut it further.
