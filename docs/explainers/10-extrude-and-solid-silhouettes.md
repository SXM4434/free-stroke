# 10 — Extrude and Solid: the silhouette pass

> *"I think the Free Stroke app has some serious geometry issues in general. Look
> at all the weird joints, it doesn't look like handwriting, it looks like some
> stupid machine wrote it — the edges and overlaps, the geometry gets all weird."*

Every previous pass proved the engines had not *regressed*. None had proved they
looked good. This one orbited them and looked.

## 1. The thing that had never been done

The verification kit had two shapes of camera move: a close-up sweep of ONE point
on a rim (`verify-solid-rim`), and the hero camera program (`capture-run`). Both
are answers to questions someone already knew to ask.

Silhouette defects are angle-dependent. A rim that reads as one continuous edge
head-on breaks into a ladder of flats at 40° and closes up again at 80°. A join
that looks solid from the front shows daylight through it from three-quarters. So
the new script, `verify-form-orbit.mjs`, flies a full 360° at three elevations,
144 frames per (shape × mode), and writes an mp4 per cell so the artefacts can be
judged in motion rather than in a hero still.

The fixtures are chosen against the complaint, not against the code:

| fixture | what it is there to expose |
|---|---|
| `word` — "hello" laid out in the capture font | real joints, real crossings, real counters, all at once. This is the actual subject. |
| `circle` | uniform curvature: every contour segment turns by the same small angle, so any polygonalisation shows as a regular ladder |
| `square` | the **control** for the circle. A fix that rounds the circle by rounding *everything* must fail here. |
| `crossing` | two strokes overlapping at a shallow angle |

The first run said the quiet part out loud. Solid rendered `hello` as **`heMo`**.

## 2. Solid was drawing lines nobody asked for

`docs/verification/form-orbit/before/word_solid/0000.png`: the two `l` stems were
joined to each other, to the `e`, and to the `o` by full-thickness diagonal bars.
The word had a zigzag through the middle of it.

The path there is three functions long.

`strokesToTestStroke` concatenates every stroke's points into one flat array. Its
doc-comment says "a single merged TestStroke", and that is exactly what it built —
merged into one *polyline*, when what Solid needs is one *pool*.

`renderStrokeToMask` then rasterised that array as a single Canvas2D path:

```ts
if (i === 0) ctx.moveTo(mx, my)
else         ctx.lineTo(mx, my)
```

`moveTo` once, at index zero. Every subsequent stroke boundary is a `lineTo`, and
a `lineTo` at `lineWidth = thicknessPx` is a **bar**. Five strokes, four phantom
bars, welded into the mask before a single line of contour code ran.

The reference implementation does not have this problem because it never
concatenates. Desk Doodles' `rasterizePoolLoops` loops over the pool and stamps
each stroke into the shared grid on its own:

```ts
for (let i = 0; i < pool.length; i++) {
  if (closed && !loopSelfIntersectsXY(pool[i])) scanlineFillPolygon(grid, …, pool[i])
  stampInkBody(grid, …, pool[i], inkRadius)
}
```

Union happens **in the grid**. Two strokes become one mass because they paint the
same cells — never because they are connected. The fix carries `subpathStarts`
alongside the points and issues `moveTo` at each one. Same single `stroke()` call,
same cost, and Canvas2D applies the round cap per subpath so each stroke still
closes its own ends.

## 3. The second bug, which the first one had been hiding

With the connectors gone, Solid rendered `hello` as **`h`**.

`buildMaskSolid` labels connected components and then keeps only the largest:

```ts
// Find largest component
…
for (let i = 0; i < mask.length; i++) if (labels[i] === largestLabel) componentMask[i] = 1
```

Four letters discarded. That line had been live the whole time and had never once
been observable, because the phantom bars guaranteed there was only ever *one*
component. Bug one was load-bearing for bug two.

This is worth naming as a pattern rather than an anecdote: **a defect that
destroys a distinction makes every downstream decision about that distinction
untestable.** The largest-component filter is not defended by a test, a comment or
a debug counter — it is defended by an upstream bug, and it stayed correct-looking
for exactly as long as that bug lived.

The fix follows Solid's own semantics rather than patching the filter. Strokes
whose ink can touch fuse into one mass — that is what Solid *is* — and strokes
that cannot touch are separate masses that each get their own build.
`clusterStrokesByInkOverlap` does union-find over a bbox prefilter with the exact
condition under which two stamped bodies overlap, and `buildSolidResultForStrokes`
builds per cluster and merges. A single-cluster drawing takes the identical code
path it always did.

Two deliberate limits, both stated in the code:
- **`SOLID_MAX_CLUSTERS = 16`.** One full raster per cluster is the honest cost. A
  scribble with forty disjoint marks falls back to one pooled build rather than
  multiplying the raster by forty.
- The merged result reports **cluster 0's** contour and hole diagnostics (largest
  first), with pixel and hole counts summed. The debug overlay therefore describes
  the largest mass, which is written down rather than implied.

Preview and export both go through `buildSolidResultForStrokes` for one reason:
preview/export parity is a gate on this project, and a clustering rule applied to
only one of them would fail it *silently* — the export would quietly keep dropping
every mark but the biggest.

## 4. The faceted rim, and why the literature disagrees with the fix we ported

The circle's silhouette was visibly polygonal and its rim showed stair-step
banding. Free Stroke's answer was in `smoothLatticeLoop`:

```ts
let smooth = chaikinClosed(chaikinClosed(chaikinClosed(exactLoop)))
smooth = dpSimplifyClosed(smooth, 0.45)
```

Three Chaikin passes, **then** Douglas–Peucker. That order does not work, and the
reason is structural rather than a matter of tuning.

A raster boundary trace emits one vertex per lattice edge, so a diagonal arrives
as a **staircase** — a periodic sawtooth with a fixed step, not noise. Chaikin is
a *local* operator: it cuts each corner toward its immediate neighbours. Run on a
staircase it rounds every individual step into a scallop and leaves the
staircase's period and amplitude intact. You trade a stepped edge for a rippled
one. Douglas–Peucker afterwards then re-inserts corners at the ripple extremes,
because those are the farthest points from their chords.

Decimating *first* collapses the staircase — a step deviates from its local chord
by a fraction of a cell, so an epsilon above that removes whole runs at once — and
hands Chaikin a coarse polygon whose vertices are shape rather than quantisation.
A genuine corner survives for the same reason: it is the farthest point on its
segment, so RDP always keeps it.

That is the Desk Doodles chain, and it ported directly:
`CONTOUR_CORNER_PIN_RAD = 1.05` rad, `CONTOUR_SMOOTH_PASSES = 3`,
`markCorners`' two-way corner test, and the epsilon that makes it work —
`SOLID_SMOOTH_DECIMATE_EPSILON_CELLS = 1.4`, expressed in **cells** so it scales
with resolution. Its own note is the finding:

> *"The gentle 0.6 epsilon leaves the marching-squares staircase intact on a
> circle (max per-vertex turn ~45° — the facet read Sebs sees), and a single
> Chaikin pass barely dents it. Re-decimating the contour at ~1.4 cells collapses
> the staircase steps (max turn → ~20°) so the subsequent multi-pass corner-aware
> Chaikin can rebuild a TRUE smooth curve."*

### But the literature has a better answer, and this codebase could afford it

The instruction was to port rather than re-derive, and the port is right. The
research was worth doing anyway, because it says the reference solves this problem
**one stage too late**.

The standard treatment for marching-squares staircase is not to smooth it
afterwards. It is to not create it: instead of classifying each cell corner as
in/out and emitting lattice vertices, **interpolate the crossing position along
the cell edge using the underlying scalar field**. Sub-cell placement, done at
extraction.

Desk Doodles cannot do that. Its grid comes from `scanlineFillPolygon` and
`stampInkBody` — hand-written binary rasterisers with no coverage information to
interpolate. It has no scalar field, so downstream reconstruction is the only
option available to it, and its chain is a good version of that.

Free Stroke's grid comes from **Canvas2D with antialiasing on**. `pixels[i*4]` is
a real coverage value, computed by the browser's rasteriser, and
`renderStrokeToMask` was throwing it away:

```ts
if (pixels[i * 4] > 127) { mask[i] = 1; filledCount++ }
```

So the pipeline here is:

1. **`snapLoopToCoverage`** — one Newton step onto the 127.5 isoline of the
   bilinearly-sampled coverage field, along its own gradient. This removes the
   quantisation *at source*.
2. **RDP at 1.4 cells** — collapses whatever staircase remains.
3. **Corner-aware multi-pass Chaikin** — rebuilds a true curve, pins real corners.

The binary mask is untouched and still drives every topological decision
(components, hole detection, validation), so nothing about *what* is solid
changed — only where its boundary is measured to be. The displacement is clamped
to 0.45 px, strictly less than half the ≥1 px filled wall the mask guarantees
between a hole boundary and the outer boundary, so the snap cannot fuse a hole or
punch one.

### One ported constant that had to be adapted, and why that matters

`CONTOUR_SMOOTH_MAX_POINTS = 192` did **not** port. It is calibrated to Desk
Doodles' 144-cell grid; this mask is 512, and RDP at a cell-relative epsilon keeps
roughly `sqrt(res)` more vertices for the same shape. Copied verbatim, the cap
would trip on pass zero and the smoother would perform **zero passes** — a ported
constant that renders as a no-op.

That is precisely this codebase's recurring failure (see the mechanism section
below), arriving by a new route: not a wrong value, a *right value from the wrong
register*. It is scaled by the resolution ratio at the call site, with the
derivation written next to it.

## 5. The joints: a miter limit that never converted the join

The `h` had a jagged chevron where its arch springs off the stem. The `e` had a
black triangular spike at the end of its crossbar and a chipped, faceted terminal.

The ribbon builder offsets each sample along the averaged unit perpendicular and
scales by `1/cos(turn/2)` — a miter. Past a limit it clamped:

```ts
scale = halfWidth / Math.max(cosHalf, RIBBON_MITER_COS_MIN)
```

`RIBBON_MITER_COS_MIN = 0.5` is the standard miter limit in disguise: the SVG
ratio is `1/sin(θ/2)` for the angle *between* segments, which is `1/cos(turn/2)`
in this file's convention, so cos-min 0.5 is `stroke-miterlimit: 2`.

What was missing is the other half of that specification. When the limit is
exceeded, a stroker **converts the join** — to bevel or round. It does not merely
shorten the miter. Clamping the magnitude while keeping *one shared offset vertex*
is not a join at all: at a hairpin that vertex has to be on both sides of the
ribbon at once, so the strip folds through itself.

And at a true reversal the two normals cancel exactly, so the old code took this
branch:

```ts
// Truly degenerate vertex (180° reversal or no valid neighbors).
// Reuse previous vertex's perp if available; else zero.
perpX[i] = i > 0 ? perpX[i - 1] : 0
```

A perpendicular that points the wrong way for the outgoing segment. That is the
notch and that is the spike.

**Handwriting is made of these.** A pen retraces its own line at the top of an
`h`, in the crotch of an `n`, at the crossbar-to-bowl turn of an `e`. The cusp is
not an edge case in this application, it is the letterform — which is a fair
summary of why the output read as machined.

The fix expresses a round join in the strip's own vocabulary. Over the limit, the
single sample is replaced by a **fan of frames that share a centreline point while
the perpendicular rotates through the turn**. The ladder topology is unchanged —
there are just more rungs at the corner — and at a hairpin the fan sweeps a half
turn on each side, so the two columns together trace the rounded blob a pen
actually leaves when it doubles back.

## 6. The rim: segments, not size

Desk Doodles' note is the finding:

> *"the old 0.02 hairline bevel left the camera-facing face meeting the side wall
> at a hard 90° — under any rig the face reads as a flat cut-out. A fatter
> 3-segment bevel gives the rim a curved band that catches the key light and
> carries the form (the 'pressed cookie' read)."*

The mechanism is specular. A one-segment chamfer replaces one 90° crease with two
~45° creases — the highlight still terminates at a hard line, and two hard lines
read as machined. Several segments give the rim a band of continuously-varying
normal, so the highlight runs *along* it and dies out. That gradient is most of
what separates "drawn mark given volume" from "CNC part".

Free Stroke already had the size right. Desk Doodles maps 800 px to 8 world units;
Free Stroke maps the canvas's longest side to 3, so absolute lengths convert
×0.3 — and DD's `EXTRUDE_BEVEL_SIZE = 0.05` × 0.3 = **0.015**, which is exactly
`DEFAULT_EXTRUDE_PARAMS.bevelSize`. The two registers had agreed on bevel size all
along. The cross-check is what confirmed the conversion factor.

What was missing was segments — and `ExtrudeParams.bevelSegments` **already
existed**, defaulted to 2, was type-checked, was listed in the interface, and was
**never read by the builder**. Every bevel was one flat chamfer no matter what the
field said. `ribbonProfileRows` reads it now, and the default moved to DD's
`rounded` 3. At `segments = 1` it emits byte-identically the four rows the old
chamfer produced, so the previous look is still reachable rather than deleted.

## 7. One tolerance instead of two guessed counts

Two fixed numbers governed curve quality: `RIBBON_CAP_SEGMENTS = 8`, and nothing
at all for joins. Both are now derived from a single error tolerance.

A cap and a round join are both circular arcs of radius `halfWidth`. The sagitta —
the gap between the true arc and the chord replacing it — is `r·(1 − cos(φ/2))`.
Holding that to a fixed fraction of the radius gives `φ_max = 2·acos(1 − tol)`, so
segment count follows from the angle actually being swept: a gentle join gets one
segment, a hairpin gets eleven.

This is the same error-driven rule the Rod engine already used for its tube rings
(explainer 09, "curvature-adaptive tube sampling from the sagitta"). The ribbon was
the last builder still on fixed counts. `RIBBON_ARC_FACET_TOLERANCE = 0.01` puts a
180° cap at 12 columns, close to the 14-segment cap tessellation Desk Doodles uses.

## 8. What the numbers say

`geometry-baseline.mjs --compare=baseline,after`:

- **Rod: byte-identical on all eight shapes.** Untouched, as required — another
  agent owned it this pass.
- **Inflate: identical vertex and triangle counts** on all eight. Untouched.
- **Extrude: ~+100 % vertices.** The rounded profile went from four rows to eight,
  which exactly doubles the strip, plus the join fans. This is the deliberate
  price of the curved rim; the largest export in the net went 263 KB → 526 KB,
  comfortably inside the budget the rod-export pass established.
- **Solid: mixed, and both directions are the fix.** `zigzag/solid` fell **−76 %**
  (decimate-before-smooth removing the staircase the old order preserved), while
  the multi-mark fixtures rose (`openC` +110 %, `twoStrokes` +67 %) because marks
  that used to be discarded now exist.

`verify-gates.mjs`: all gates pass, 0 console errors, rebuild counts unchanged.

`assert-form-orbit.mjs` — and the point of it is that it fails on the old frames:

| assertion | before | after |
|---|---|---|
| separate marks stay separate masses | **FAIL** — 1 mass | PASS — 5 |
| circle silhouette has no facet ladder | **FAIL** — 40 facet vertices | PASS — 1 |
| square keeps its corners | PASS — 4 | PASS |
| extrude control: fixture is 5 marks | PASS | PASS |
| smoother ran without falling back | PASS | PASS |
| decimation collapsed the staircase | 1336 → 60 → 466 points | same |

The two controls passing in *both* columns is the load-bearing part. If the square
had rounded, the circle fix would have been a blur.

## 9. What is still wrong

Honest, and deliberately not fixed here:

- **Extrude does not fuse overlapping strokes.** The remaining faint seam on the
  `h` stem is two independent ribbon meshes interpenetrating. It is a union
  problem, not a join problem, and union across strokes is Inflate's territory —
  which another agent owned during this pass. Extrude's *within-stroke* joints
  are fixed; its *between-stroke* overlaps are not.
- **`useStrokeMeshes`' dependency array omits `bevelSize` and `bevelSegments`**
  (`viewport-3d.tsx:175`), and the comment directly above it says every engine-read
  slider value must be listed or "preview will silently use a stale cached
  geometry". `bevelSegments` was harmless while nothing read it. It is read now.
  No UI exposes it yet, so the trap is armed and latent rather than live; adding a
  Bevel-profile control without also fixing that array will produce a control that
  does nothing until something else forces a rebuild.
- **The draft-taper port did not land.** `applyDraftTaper` /
  `EXTRUDE_DRAFT_AMOUNT` transfer cleanly as a geometry post-process, but Desk
  Doodles applies them to a closed slab around its own bbox centre. On a
  per-stroke ribbon the same operation tapers each letter toward its own centre,
  and whether that reads as "molded" or as "wrong" is a judgement that needs
  frames and Sebs, not a compile. Shipping it dark would have added exactly the
  kind of unexercised parameter this pass spent its time removing.
- **Hole contours skip the sub-cell snap.** They are traced in a *cropped* mask
  whose coordinates do not index the full-size coverage field. Passing it anyway
  would be a coordinate bug; they get the reordered decimate→smooth chain only.

## 10. The mechanism, restated

Explainers 01–09 name a class: *correct code that renders wrong*. This pass found
three more instances and one new generator.

The three instances are familiar in shape. A parameter that exists, is typed, is
defaulted, and is never read (`bevelSegments`). A guard that silently returns the
worst possible output (`smoothLatticeLoop`'s area and self-intersection
fallbacks both returned the raw staircase, with no signal — now counted in
`CONTOUR_SMOOTH_DEBUG` and logged). A comment that describes an intent the code
does not implement (`renderStrokeToMask`'s "merged").

The new generator is the interesting one, and it is worth adding to the list:

**A bug that destroys a distinction makes every downstream decision about that
distinction untestable — and therefore permanently invisible.**

Solid's largest-component filter was wrong from the day it was written. No test
caught it, no comment questioned it, no counter reported it. It could not be
caught, because for its entire life the rasteriser guaranteed that there was only
ever one component. Fixing the rasteriser is what *created* the failing case. The
practical consequence for verification: **fixing an upstream bug should be
followed by re-running the downstream checks, not just the one you were aiming
at** — because the state space the downstream code has actually been exercised on
just changed, and everything past the fix is now, in effect, untested.

Which is also the argument for the fixture set at the top of this document. The
word is the subject; the circle is the defect; the square is the control. Two
frames and a diff would have shown none of it.
