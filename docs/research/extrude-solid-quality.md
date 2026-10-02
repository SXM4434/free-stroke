# Research — Extrude + Solid visual quality (the "machine wrote it" pass)

The brief: *"I think the Free Stroke app has some serious geometry issues in general…
look at all the weird joints, it doesn't look like handwriting, it looks like some
stupid machine wrote it — the edges and overlaps, the geometry gets all weird."*

Previous passes proved the engines did not *regress*. Nobody had proved they look
good. This is the research behind the pass that did.

Standing instruction for this pass, from Sebs: **"we have the code and the engine,
so just port it over. DO NOT RECREATE WHEN WE HAVE THE CODE."** So the primary
"source" here is not a paper — it is a sibling codebase that already solved these
problems and whose output is considered acceptable. The papers below are what that
codebase's solutions are built on, recorded so the constants are traceable to
something other than taste.

---

## 0. The primary source: Desk Doodles

**What it is.** `~/Desktop/Projects/desk-doodles` — a separate app (ConFigMakeathon
build, Vite + React + three.js) that carries the same four geometry modes: Rod,
Extrude, Inflate, Solid. Everything lives in one file,
`src/app/lib/geometry3d/strokeTo3d.ts` (2147 lines).

**Why it is the reference.** It is downstream of Free Stroke — its own comments say
so:

> `// ── Rod character — PORTED from Free Stroke (2026-06-12) ──`
> `// PROVENANCE: ~/Desktop/Projects/free-stroke origin/main lib/geometry-engines.ts`
> — strokeTo3d.ts:116

It took Free Stroke's Rod tuning, then spent its own build cycles on the *silhouette*
problems Free Stroke never got to. Those cycles produced three things worth taking
back:

1. `EXTRUDE_BEVEL_PROFILES` — a bevel **profile family** (sharp / soft / rounded),
   where "rounded" is a multi-segment curved band rather than a single flat chamfer.
2. `applyDraftTaper` + `EXTRUDE_DRAFT_AMOUNT` — a molded/pressed side-wall option.
3. The **contour chain**: rasterise → marching squares → **decimate** → **corner-aware
   multi-pass Chaikin**, plus the specific decimation epsilon that makes it work.

**Unit conversion.** Desk Doodles maps an 800px canvas to 8 world units
(`WORLD_SCALE = 0.01`). Free Stroke maps the canvas's *longest* side to 3 world units
(`normScale = 3 / max(w, h)`), so on a ~1000px canvas ≈ 0.003 units/px. Absolute
world lengths therefore convert **DD → Free Stroke by ×0.3**; radius-relative and
angle-valued constants port verbatim. (This is the same conversion Desk Doodles
documented in the other direction — it multiplied Free Stroke's absolute lengths by
8/3 when it took Rod.)

Sanity check that the conversion is right: DD's `EXTRUDE_BEVEL_SIZE = 0.05`
× 0.3 = **0.015**, which is *exactly* Free Stroke's existing
`DEFAULT_EXTRUDE_PARAMS.bevelSize`. The two apps already agree on how big a bevel
should be. What Free Stroke was missing was not the size — it was the **segments**.

---

## 1. Chaikin's corner-cutting algorithm

**What it is.** Given a polygon, replace every edge `AB` with the two points at 1/4
and 3/4 along it. Repeat. Each pass doubles the vertex count and cuts every corner.

**What it does.** In the limit the sequence converges to a **quadratic B-spline** of
the original control polygon — the corner-cut sequence and the de Rham curve
construction are the same object. So it is not an ad-hoc blur: it is spline
evaluation by subdivision, which is why it is stable, local, and cannot introduce
new self-intersections (every new point lies strictly inside an existing edge).

**What we used it for.** Both codebases use it to take the polygonal contour that
comes out of a raster boundary trace and make it read as a drawn curve rather than a
polygon. The important detail is *how many passes*: a **single** pass on an N-gon
gives a 2N-gon, which at grazing angles still catches the key light as a ladder of
flats. Convergence to the spline needs several.

**The corner problem, and angle-limited Chaikin.** Plain Chaikin cuts *every* corner,
so a drawn square comes out with four rounded corners — the smoothing erases
intent. The path-smoothing literature answers this with **adaptive / angle-limited**
corner cutting: skip vertices whose turn angle exceeds a threshold (and/or bound the
cut size), so deliberate sharp corners survive while gentle staircase turns round
out. Desk Doodles' `markCorners` is exactly this, with one addition described in §3.

- [Chaikin's Algorithms for Curves — Kenneth I. Joy, On-Line Geometric Modeling Notes (UC Davis)](https://www.cs.unc.edu/~dm/UNC/COMP258/LECTURES/Chaikins-Algorithm.pdf) — the corner-cut construction and the quadratic B-spline limit.
- [Convergence analysis of corner cutting algorithms — ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0378475420300197) — the general convergence result for the corner-cutting class.
- [`corner_clip` — adaptive Chaikin, boundaries R package](https://boundaries.r-euclid.com/reference/corner_clip.html) — the adaptive variant: "ignore vertices with very obtuse angles and set an upper bound on how big the cut can be". This is the angle-limited idea in a shipped API.
- [Path Smoothing with Chaikin — Keith Maggio](https://keithmaggio.wordpress.com/2018/05/29/math-magician-path-smoothing-with-chaikin/) and [Chaikin's Algorithm in Generative Art — thrly](https://thrly.com/blog/chaikin-smoothing/) — practical pass-count intuition.

---

## 2. Simplify BEFORE you smooth — the finding this pass turns on

**The claim.** For a contour that came out of a raster (marching squares, boundary
edge trace, any lattice walk), you must **decimate first and smooth second**. The
reverse order does not work.

**Why.** A raster boundary emits one vertex per lattice edge, so a diagonal arrives
as a **staircase**: a periodic sawtooth with a fixed step size, not noise. Chaikin
is a *local* operator — it cuts each corner toward its immediate neighbours. Run on a
staircase, it rounds every individual step into a little scallop but leaves the
staircase's **period and amplitude intact**: you get a rippled edge instead of a
stepped one. The ripple is what reads as "chewed" or "wavy" on a silhouette. Running
Douglas–Peucker afterwards then *re-inserts* corners at the ripple extremes, because
those are the farthest points from their chords.

Decimating first collapses the staircase — a step's deviation from the local chord is
a fraction of a cell, so an epsilon above that removes whole runs of steps at once —
and hands Chaikin a coarse polygon whose vertices are actual shape, not quantisation.
*Then* the multi-pass corner-cut converges to a real curve. A genuine corner survives
the decimation for the same reason: it is the farthest point on its segment, so RDP
always keeps it, and the corner-aware pass then pins it.

- [Parallelized Generation and Smoothing of 2D Contour Lines — CMU 15-618 final report (Mahr)](https://dmahr1.github.io/618-final/report.html) — states it directly: *"It is necessary to perform simplification before smoothing in order to output reasonable results."* Also the source for the vertex-per-lattice-segment characterisation of marching-squares output.
- [Simplification of contour lines, based on axial splines — Int. J. Geographical Information Science](https://www.tandfonline.com/doi/full/10.1080/13658816.2023.2193969) — why plain Douglas–Peucker is a poor *finisher* for smooth curves (it is a good decimator, a bad smoother). Reinforces the split of roles: RDP removes quantisation, a spline operator produces the curve.
- [The improved Douglas-Peucker algorithm based on the contour character — IEEE](https://ieeexplore.ieee.org/document/5981173/) — DP can introduce self-intersection on contours; the guard belongs after the whole chain, not between the stages.
- [Staircase-Aware Smoothing of Medical Surface Meshes](https://www.researchgate.net/publication/220833514_Staircase-Aware_Smoothing_of_Medical_Surface_Meshes) — the same problem one dimension up (marching cubes), and the same conclusion: staircase is *structured* error and must be treated as such, not blurred.

**Where Free Stroke sat.** `lib/solid-mask.ts:461 smoothLatticeLoop` did
`chaikinClosed × 3` **then** `dpSimplifyClosed(0.45px)` — smooth-then-simplify, the
order the literature says does not work, and the order Desk Doodles explicitly moved
away from. Its own comment records the move:

> *"The gentle 0.6 epsilon leaves the marching-squares staircase intact on a circle
> (max per-vertex turn ~45° — the facet read Sebs sees), and a single Chaikin pass
> barely dents it. Re-decimating the contour at ~1.4 cells collapses the staircase
> steps (max turn → ~20°) so the subsequent multi-pass corner-aware Chaikin can
> rebuild a TRUE smooth curve."* — strokeTo3d.ts:233

**The epsilon.** `SOLID_SMOOTH_DECIMATE_EPSILON_CELLS = 1.4`, in **grid-cell units**
so it scales with resolution. It has to clear a single step's deviation
(~0.25–0.35 cell) with margin, and stay well under any real feature. Free Stroke's
mask is 512 across (vs Desk Doodles' 144), so one cell is a different absolute size —
which is precisely why the constant is expressed in cells and not in pixels.

---

## 3. Corner detection through a raster: the two-way test

Plain angle-limited Chaikin has a failure mode on **rasterised** input that it does
not have on vector input. Marching squares quantises a clean 90° corner into a
**two-step ~45° chamfer**: no single vertex clears a 60°-ish pin threshold, so the
corner is not detected and gets rounded away.

Desk Doodles' `markCorners` (strokeTo3d.ts:1493) answers this with two independent
qualifications:

1. **DIRECT** — the vertex's own turn ≥ `pinRad`. Catches a clean vector corner.
2. **CONCENTRATED** — the vertex plus its sharper neighbour sum to ≥ `pinRad`
   *while* the next ring out (±2) is nearly flat. Catches the raster-chamfered
   corner: a short high-turn cluster bordered by straight runs.

The flatness test is what stops a coarse circle from being pinned everywhere. A
regular polygon turns *uniformly* — the ±2 ring is just as bent as the centre — so it
fails the flatness test and rounds normally. Only the cluster peak pins (local max),
so the corner stays one crisp vertex instead of a preserved flat chamfer.

Constants (all angle-valued, so they port verbatim):
- `CONTOUR_CORNER_PIN_RAD = 1.05` rad ≈ 60°. A square turns π/2 ≈ 1.571 at each
  corner; a circle on a 14–28-gon contour turns ≪ 1.05 per vertex. 60° sits in the
  gap: anything sharper than a hexagon corner is treated as deliberate.
- `CONTOUR_SMOOTH_PASSES = 3` — takes a 14-gon to ~64 points on the rounded stretches.
- `CONTOUR_SMOOTH_MAX_POINTS = 192` — a circle rim reads perfectly smooth by ~96
  points; the cap stops a dense input contour exploding the mesh.
- flat threshold = `pinRad × 0.5` — comfortably between a straight run (~0) and
  uniform curvature (~pinRad/k per vertex).

---

## 4. Bevel profile: why a rim needs segments, not just size

Desk Doodles' own note (strokeTo3d.ts:166) is the finding:

> *"the old 0.02 hairline bevel left the camera-facing face meeting the side wall at a
> hard 90° — under any rig the face reads as a flat cut-out. A fatter 3-segment bevel
> gives the rim a curved band that catches the key light and carries the form (the
> 'pressed cookie' read)."*

The mechanism is specular, not geometric. A single-segment chamfer replaces one 90°
crease with two ~45° creases — the highlight still terminates at a hard line, and two
hard lines read as *machined*. A multi-segment bevel gives the rim a band of
continuously-varying normal, so the specular runs **along** the rim and dies out
smoothly. That gradient is most of what separates "drawn mark given volume" from
"CNC part". Free Stroke's `ExtrudeParams` already carries a `bevelSegments` field —
it just was never read by the builder (see the explainer).

`EXTRUDE_BEVEL_PROFILES` makes the three useful points on that axis discrete rather
than a continuous dial, which matters because the interesting values are not evenly
spaced: `sharp` (off — die-cut), `soft` (1 segment — cut corner), `rounded`
(3 segments — the curved band).

---

## 5. Rasterising a POOL of strokes vs a single polyline

Not a Desk Doodles port — a defect this pass found — but the fix follows Desk
Doodles' model, so it belongs here.

Desk Doodles' `rasterizePoolLoops` (strokeTo3d.ts:1610) loops over strokes and
stamps each one **independently** into the shared grid:

```ts
for (let i = 0; i < pool.length; i++) {
  if (closed && !loopSelfIntersectsXY(pool[i])) scanlineFillPolygon(grid, …, pool[i])
  stampInkBody(grid, …, pool[i], inkRadius)     // per stroke
}
```

Union happens in the **grid** — overlapping ink merges into one mass because both
strokes set the same cells, and nothing is drawn between them.

Free Stroke's Solid concatenated every stroke's points into one flat array
(`strokesToTestStroke`) and rasterised that as a single Canvas2D path
(`renderStrokeToMask`: `moveTo` at `i === 0`, `lineTo` for everything after). That is
union-by-concatenation, which is not union: it draws a **full-thickness straight bar
from the end of each stroke to the start of the next**. See the explainer for what
that looked like.

The canonical fix is the standard one for rasterising a multi-subpath figure —
`moveTo` at the start of every subpath, one `stroke()` for all of them — which is
also what Desk Doodles' per-stroke stamp loop amounts to.

---

## 6. What we did NOT take

- **Desk Doodles' Extrude builder itself.** DD extrudes a *closed loop* through
  `THREE.Shape` + `ExtrudeGeometry`. Free Stroke's Extrude is a *ribbon swept along
  an open centreline* — a genuinely different mode (calligraphic, direction-bearing),
  and the one Free Stroke's Width/Depth calibration is tuned for. Porting DD's
  builder would delete a mode, not improve it. What ported is the **profile** and the
  **taper**, both of which are independent of how the sweep is generated.
- **`smoothClosedOutline`'s Catmull-Rom branch** (≥9 anchors → centripetal spline).
  It exists to keep DD's 2D↔3D round-trip in the same shape family as DD's own 2D
  renderer, which Free Stroke does not have. The corner-aware branch — the part that
  fixes facets — is what ported.
- **Anything in the Inflate or Rod paths.** Owned by another agent during this pass.

---

## 7. The Solid bevel: an inward offset of a mask-derived contour

**The gap, measured.** `__geomDebug.probeDihedral` (new this pass — see
`docs/explainers/13-measuring-the-rim.md`) reports, for the `mixed` bucket where a
cap face meets a wall face:

| mode | mixed mean | mixed max | edges over 30° |
| --- | --- | --- | --- |
| Extrude (ported rounded profile, 3 segments) | 15.4° | 30.1° | a minority |
| Solid | **90.0°** | **90.0°** | **all of them** |

Not "mostly 90" — a spike at exactly 90 on every fixture. Solid's H3 assembly
(`lib/solid-mask.ts`, `EXTRUDE_FROM_FLAT_CAP_WITH_HOLES`) writes the front cap at
`+halfDepth`, the back cap at `−halfDepth`, and a vertical wall between them. There
is no bevel construction in it. Desk Doodles' own comment on `EXTRUDE_BEVEL_SIZE`
says the profile is *"Shared by Extrude + Solid"*; this repo ported the Extrude half.

**Why it is not a copy-paste.** Desk Doodles gets its Solid bevel free, because DD's
Solid goes through `THREE.ExtrudeGeometry` with `bevelEnabled`. Free Stroke's Solid
assembles caps and walls by hand — it has to, because it carries hole walls,
preview/export parity, and partial-reveal rebuilds that `ExtrudeGeometry` cannot
express. So the bevel has to be built, and building it needs the one operation this
pipeline has so far avoided: an **inward polygon offset** of the traced contour.

**Why an inward offset is the hard part.** Three.js's own beveller shrinks the cap
by `bevelSize` and flares back out to the true outline at `bevelThickness` below it.
On a convex blob that is a per-vertex bisector displacement and nothing more. On a
*handwriting silhouette* it is not:

- The form is thin. A stem's local half-width can be a handful of mask cells, and
  an absolute offset that is a rounding error on a bowl is a large fraction of a
  stem — the same absolute-vs-relative mismatch that made the decimation epsilon
  need a ladder (§5b). An offset larger than the local inradius **collapses** the
  polygon and inverts it.
- The contour has concavities (crossings, the inside of an `e`), and inward
  offsetting is exactly where a naive bisector offset self-intersects.
- Holes must offset the *other* way. Shrinking material means the outer contour
  moves in and every hole contour moves out, and a hole that grows into the outer
  contour changes topology.

**The leads worth reading before writing any of it.** Recorded as leads, not as
citations — this pass ran out of search budget before any of them could be checked,
so nothing below should be treated as verified:

- **Straight skeleton / offset events.** The exact object underlying polygon
  offsetting: the offset polygon is well-defined until an *edge event* or *split
  event*, at which point the topology changes. The literature to look for is
  Aichholzer & Aurenhammer's straight-skeleton work and the CGAL
  `Straight_skeleton_2` package, which computes the full event structure and can
  therefore offset *past* the point a bisector method breaks. Heavier than needed
  here, but it is the thing that says where a naive method's validity ends.
- **Clipper2's `ClipperOffset`.** The shipped, battle-tested answer: offsets with
  join types (miter / round / square), a miter limit, and — crucially — it resolves
  the self-intersections the raw offset produces by re-running a boolean union on
  the result. That last step is the part a hand-rolled bisector offset lacks. This
  repo already depends on `polygon-clipping`, which does the booleans but *not* the
  offsetting; whether the offset can be expressed as boolean operations on it, or
  whether Clipper2 should be added, is the first thing to settle.
- **Offsetting via the distance field.** The contour here is *already* derived from
  a raster with a coverage field (`snapLoopToCoverage`). An inward offset of `d` is
  the isoline at coverage-distance `d` — so the offset could be traced from the
  same grid the outline came from, at the same resolution, using marching squares
  again. This is topologically safe by construction (an isoline of a scalar field
  cannot self-intersect) and it handles the thin-stem case correctly and
  automatically: where the form is thinner than `2d` the isoline simply does not
  exist, and the bevel locally disappears rather than inverting. Given that the
  rasteriser, the coverage field and the marching-squares tracer are all already in
  `lib/solid-mask.ts`, **this is probably the right answer for this codebase** and
  it is a smaller change than adding an offsetting library.

**What the guard must be, whichever is chosen.** The same shape as §5b's ladder,
for the same reason: the bevel size is a fidelity/appearance trade, not a constant.
Try `EXTRUDE_BEVEL_PROFILES_FS.rounded.size`; if the offset loop self-intersects,
inverts its signed area, or lets a hole reach the outer contour, step the size down;
if every rung fails, emit the current un-bevelled wall — and *say so in
diagnostics*, because a silently un-bevelled rim is indistinguishable from a
bevelled one in every number the build currently reports.

**What has landed.** `lib/dd-extrude-relief.ts` carries Desk Doodles'
`EXTRUDE_BEVEL_PROFILES`, `EXTRUDE_DRAFT_AMOUNT` and `applyDraftTaper` verbatim,
with the ×0.3 world-scale conversion applied in a separate `_FS` constant so the
conversion stays auditable. ~~The Solid consumer above is not written.~~

**UPDATE — the Solid consumer is now written.** `insetLoopAgainstMask` in
`lib/solid-mask.ts`, consumed by the H3 ring-stack assembly. See
`docs/explainers/16-the-rim-and-the-bead.md` §2 for the measured before/after and
the two mistakes it took to get the guard right. Summary of the choices, against
the three candidates above:

- **It took the distance-field family, not Clipper2 and not a straight skeleton** —
  §7's own recommendation, for §7's reason (an isoline cannot self-intersect, and
  a form thinner than 2d loses the bevel rather than inverting it). It probes the
  binary mask directly rather than tracing a new isoline with marching squares,
  because tracing would produce a loop with its own vertex count and its own
  topology, and the correspondence between that loop and the original is what the
  bevel band needs. Probing keeps a **1:1 vertex correspondence**, so the band is a
  quad strip and the cap keeps its existing triangulation — triangle count, hole
  topology and every H2 diagnostic are unchanged by construction.
- **The guard is a per-vertex ladder, not a whole-form one** (`OFFSET_LADDER =
  [1.0, 0.66, 0.33, 0.12]`), so the failure mode is local and gradual: the rim
  degrades from a roll to a cut over a few vertices where the form is genuinely too
  thin, instead of a whole silhouette snapping back to a die-cut edge. §7 asked for
  "step the size down; if every rung fails, emit the current un-bevelled wall" — the
  whole-form version of that is the shape of guard this repo keeps getting burned
  by, and the local version is strictly better here because thinness is a local
  property.
- **The thing §7 did not anticipate, and the one that cost two iterations:** the
  probe radius is 2.6 raster cells, and the contour rides the 50%-coverage isoline,
  so about half the contour vertices are in a cell whose binary value is
  background. Any offset guard on this contour has to refuse to consult samples
  closer than one cell to the vertex, or it starves vertices in the middle of fat
  forms and each one leaves a 90° crease. Whoever builds the marching-squares
  version instead will meet the same fact from the other side.

Still not done, and now separable: an inward offset that can survive a **split
event** — where the offset loop should become two loops because the form pinches.
Neither the per-vertex method nor a naive isoline trace expresses that; it is the
straight-skeleton lead above, and nothing in the current fixture set needs it.

---

## 8. Correction to §6: the draft taper had NOT landed

§6 above says *"What ported is the profile and the taper."* The profile ported; the
taper did not — it is recorded as not-landed in `SESSION-HANDOFF.md`, and the
research doc was written as though the plan had been executed. Flagged here rather
than edited above, because a research document that quietly revises its own claims
is worth less than one that shows where it was wrong.

It has now landed as **code** (`lib/dd-extrude-relief.ts`) but is deliberately
**not wired**. The reason is a semantic mismatch that a verbatim port would hide:
`applyDraftTaper` shrinks toward *the geometry's own bbox centre*, and Desk Doodles
hands it one pooled slab, whereas Free Stroke's Extrude emits one geometry per
stroke. Called per geometry it would taper each letter toward its own centre, so
the `h` and the `o` of a word would lean in different directions — five separate
mouldings instead of one mark. `applyDraftTaperAbout` in the same file is the same
arithmetic with the centre supplied; wiring it needs the aggregate bbox of the mark,
a `sideWall` dial, and Sebs's eye on whether "moulded" is wanted at all.

**UPDATE — it is now wired, `straight` by default.** `ExtrudeParams.sideWall`
(`straight` | `drafted`), a dial in the Extrude config strip beside Bevel, and the
centre supplied as `PreviewParams.draftCentre` from `computeExtrudePoolCentreXY`
over the whole mark. Two things the paragraph above did not anticipate:

- **The centre must come from the caller, not from the engine's own input.** During
  draw-in, Extrude rebuilds from an arc-length-filtered PARTIAL of the strokes, so
  a pool centre derived from "whatever this call was handed" travels as the reveal
  grows and re-slants every already-drawn letter on every tick. viewport-3d
  computes it from the FULL strokes prop.
- **"Sebs's eye" needs a measurement to be an eye ON something.** The naive
  per-geometry wiring and the correct one agree on vertex count, triangle count,
  per-stroke bbox and total bbox, and on a single letter they are the same call —
  so `assert-draft-taper.mjs` measures each mesh's back-face centroid displacement
  and asserts its dot product with that mesh's direction to the pool centre.
  Rewired temporarily to the verbatim `applyDraftTaper`, three of its four
  assertions fire. See explainer 17 §3. The remaining judgement — whether
  "moulded" is wanted as a default — is still Sebs's, and the default is still
  `straight`, which is also Desk Doodles' own.

---

## 9. Inflate's rim: the canal surface, and why §7's family did not apply

Recorded here because the obvious move — reuse §7's answer — is wrong, and the
reason is worth keeping.

§7 solved Solid's die-cut rim with an inward offset of a mask-derived contour.
Inflate's `mixed max 85–90` looks like the same number and is not the same defect.
Measured with the crease census extended to report WHERE (explainer 17 §1), the
worst edges on every fixture sit on the ink taper's shoulder, and the mechanism is
in the ported profile itself:

```
r(x) = tip + (1 − tip)·sin(πx/2)^0.8        exp = 0.8 < 1
⇒  dr/dx ∝ x^(−0.2) → ∞  as x → 0
```

The profile leaves the tip vertically, so the first ring step turns the wall by
`atan(Δr/Δs)` — 86 degrees measured on `circle`. There is no bevel missing and no
contour to offset. There is also no sampling fix: subdividing between two rings
whose radii are linearly interpolated adds vertices to a straight generatrix and
changes no crease at all.

**The object that does apply is the canal surface** — the boundary of the union of
balls swept along the centreline. Its derivation is short enough to show rather
than cite, which is this repo's rule after a citation it had not checked ended up
in a code comment. With `|c′| = 1`, differentiating `|p − c(s)|² = r(s)²` in `s`:

```
−2(p − c)·c′ = 2 r r′   ⇒   (p − c)·T = −r r′
```

so the characteristic circle lies in the plane at signed distance `−r r′` from `c`
along `T`, with radius `√(r² − (r r′)²) = r√(1 − r′²)`. The cone check: for
`c(s) = (s,0,0)`, `r = a s`, this gives a circle at `x = s(1 − a²)` of radius
`a s √(1 − a²)`, ratio `a/√(1 − a²) = tan(asin a)` — the cone of half-angle
`asin a`, apex at the origin. Correct.

Three properties are why this is the right family here, and each one replaces
something that had to be guessed before:

1. The band between consecutive circles is the tangent cone of both balls, so the
   crease across a ring is a **second** difference of `r`. An unbounded first
   derivative stops producing an unbounded crease, without touching the ported
   profile constant.
2. The end cap is the terminal ball's own spherical patch from `cos α = ∓r′` to the
   pole one radius out, **tangent to the wall by construction** — so there is no
   free cap length. The `capRoundness` 0.6→1.0 squash that existed before is
   geometrically incompatible with tangency and is gone.
3. `|r′| < 1` is required for validity, and it is obtained as a **theorem, not a
   clamp**: prune any ball contained in a neighbour (`|cᵢ − c_j| + rᵢ ≤ r_j`), after
   which `|Δr| < |Δc|` holds between every surviving pair by definition. §7's own
   guard needed two iterations precisely because it was a clamp asking a discrete
   field a question it could not answer; there is nothing to tune here.

This also **unifies the two Inflate strategies**: the implicit path's primitives are
round cones, i.e. unions of two balls, so the loft and the field now describe the
same solid rather than two approximations of different things.

**Unverified leads, recorded as leads.** Canal surfaces / envelopes of sphere
families are standard classical differential geometry, and the "union of round
cones, smooth-min'd" formulation is standard signed-distance-field practice — the
implicit path in this repo already uses it. Nothing external was consulted while
writing this section; the derivation above and the cone cross-check are the whole
of its warrant.

**Still not done, and it is a genuine limit of the loft.** At a real polyline corner
the union of balls is smooth on the outside (the corner ball's spherical wedge), but
expressing that needs two tangency circles per ball plus the band between them, and
on the INSIDE of the elbow that band must be clipped against the two cylinders.
Clipping is re-topologising, which a swept ring sequence cannot do — it is what the
implicit path exists for. `square/inflate` therefore still reads `mixed max 89.6` at
its four drawn corners, and the assertion for that case is deliberately that the
corners SURVIVED rather than that the max is small.

**UPDATE — done, and the paragraph above is right about the cause and wrong about
the shape of the answer.** See §10 below and `docs/explainers/19-the-elbow-and-the-fold.md`.
The elbow is not a hard crease wanting a fillet: the loft **passes through itself**
there, and `mixed max 89.6` was a fold reading as a corner. The missing condition is
the OTHER half of the embedding theorem — `r·κ < 1`, never checked anywhere — and
`fusion: "auto"` now routes on it.

---

## 10. The elbow: not a crease, a fold — and the census that could not say so

§9 closed on `square/inflate` reading `mixed max 89.6` at its four drawn corners and
called it "a genuine limit of the loft". The limit is real. The *description* was
wrong in a way that mattered, because it named the wrong quantity to fix.

### 10.1 The missing half of the theorem

A canal surface is smooth and **embedded** iff

```
|r′| < 1        the chain does not swallow its own balls
r·κ  < 1        the centreline does not turn tighter than its own radius
```

§9 established the first as a theorem (pruning contained balls). **The second was
never checked in this codebase at all.** Where it fails, the ring sweep drives its
inner column backwards and the strip folds back through the surface — and no ring
density removes it, because `r·κ` does not depend on sampling. `square/inflate`
violates it at all four corners: 8 folding ring pairs, max depth 0.158 r.

Written as the exact discrete predicate on the rings the sweep emits rather than as
a continuous `r·κ` proxy, because a polyline's discrete curvature depends on how the
corner was resampled: between consecutive rings turning by `Δθ` over a centre advance
`h`, the inner column advances by `h − (rᵢ + rᵢ₊₁)·sin(Δθ/2)`, and folds when that is
negative. `inflateChainFoldMetric`, `lib/geometry-engines.ts:5645`.

### 10.2 Why no crease census could have settled it

Two independent reasons, both structural:

- **Density.** A dihedral angle between adjacent triangles reports *total turn ÷ how
  many edges it was spread over*. Marching cubes at r5 emits ~2 edges across a
  90-degree crease, so 90/2 = 45 — which is the ~48 the field reads. "89.6 → 47.8" is
  equally consistent with *the field fillets the elbow* and with *the field has the
  identical hard crease, tessellated finer*.
- **Sign.** `min(acos d, acos −d)` is smallest when two faces are ANTIPARALLEL, which
  is what a fold produces. A folded flap reads as a *small* crease. Measured on two
  synthetic tubes identical but for a spacing that decides the fold in closed form:
  the census separates a folded shell from a clean one by **−10.2° on `wall`** (the
  wrong direction) and **+9.0° on `mixed`** — less than one bevel step. And on the
  real folding mesh it reports boundary 0, non-manifold 0, degenerate 0.

The replacement is a different question, not a better threshold: **how many sheets a
−Z ray crosses, per connected component, counting DISTINCT depths.** Per-component
because a fold is one shell through itself while two crossing strokes are two shells
through each other (documented behaviour of the per-stroke modes); distinct depths
because a cap plane covered twice is a triangulation overlap, not a fold. Calibrated
against a synthetic fold, its clean twin, the shipped `probeDihedral` mirrored onto
the same buffers, and the real known-bad.

### 10.3 A prediction from `stroke-width-models.md` §3.2, closed

That doc predicted this from the other side, before any of it was measured:

> `|dr/ds| > 1` for the **first 0.195 R of arc length from each stroke end**. […]
> This predicts an existing, unflagged parity break between Inflate's two fusion
> modes.

The taper half of that prediction is what explainer 17 fixed (the canal-surface
construction). **The curvature half — `r·κ` — is this pass**, and it is the same
sentence one term over: §3.1's existence condition `‖ċ‖² ≥ ṙ²` is about the radius
growing faster than the curve advances, and `r·κ < 1` is about the curve turning
faster than the radius allows. Both are conditions for the envelope to exist; only
one had ever been checked. §4.5's conclusion — *"Build the nib on the union/implicit
path, not the loft… The solid has no `κ > 1/r` failure at any nib size; the ring-loft
parametrisation does"* — is now confirmed on our own fixture rather than on the
literature: the loft folds at 0.158 r depth where the field does not fold at all.

That also settles a live question for the nib work: **the ring-loft cannot carry a
nib at any aspect above ~1**, because the weight-restore factor (×1.37) raises the
effective radius in the thick direction and pushes more of the word past `r·κ = 1`.
§4.5 measured 3.35 % of the logo's pen travel already in that regime at the current
half-width, rising to 5.43 % at the nib's `a`. The routing built here is what makes
that safe: those marks leave the loft automatically.

### 10.4 What the fold census found that is NOT the elbow

Two further defect classes, neither of them the elbow, both pre-existing, both
measured here for the first time and pinned to their exact counts:

- **The closed-loop seam (Rod, Inflate) — FIXED.** A stroke returning to its own
  start got two end caps sweeping about the same point, which interpenetrate — the
  same defect explainer 17 §2 fixed for Extrude, which Rod and Inflate never
  received. `circle/inflate` 13 rays -> **0**, `square/rod` 1 -> **0**, Rod's two
  cap spheres at 0.50–0.70 r apart -> **none**, and the square's seam corner goes
  from ρ_out 0.360 to 0.992 while the other three are unchanged to 1e-6. It needed
  three things beyond the closure itself: the wrap pair tested by the fold
  predicate, Extrude's seam-stub rule ported too (closure alone took `square/rod`
  from 1 fold ray to 3), and the crossing bulge made cyclic (without it a wrapped
  circle came out **+22 % fat at the seam**). The taper change on a loop is a look
  decision and both behaviours are parked and selectable — `loopEnds`.
- **The rim assembly overlapping itself (Solid, Extrude) — diagnosed, not fixed.**
  Localised to the cap RE-TRIANGULATION the bevel path switches on: bevel off reads
  0 folds on every fixture, bevel on fires only on fixtures WITH A HOLE, and the
  offending triangles have all three vertices on the band but span 45° of arc
  (a 0.6-unit chord across an 0.087-wide band). Three causes tested and eliminated
  — opposing insets crossing (band 0.0868 vs 2×bevel 0.030), duplicated end points
  (504 triangles for 504 points = n + 2h − 2), unnormalised winding (already
  +2.1187 / −1.7304). Remaining candidate: earcut's intersection-curing fallback on
  a thin 504-vertex annulus; the fix is to reuse H2's triangulation with an index
  map instead of recomputing. `circle/solid` 53, `openArc/solid` 59,
  `square/solid` 4, `crossing/solid` 1, `square/extrude` 5 — pinned.

### 10.5 Leads not taken

Recorded as leads, unverified — nothing external was consulted for this section:

- **Sweep self-intersection is a solved problem in the CAD literature** and the term
  to search is *self-intersection of canal/pipe surfaces*, alongside the trimming of
  the offset's non-boundary parts. The Minkowski route in `stroke-width-models.md`
  §4.5 sidesteps it entirely — the union of balls has no failure at any curvature —
  which is exactly why the field is where a folding mark gets sent rather than
  something being repaired on the loft.
- **Whether the routing should be per-STROKE rather than per-DRAWING.** Today one
  folding stroke sends the whole drawing to the field. Per-stroke routing would keep
  the cheap path for the letters that deserve it, but the two surfaces would then have
  to meet where strokes touch, and a hybrid seam is its own defect class.

---

## 11. The rim's two axes, and the third iteration of the same guard

§7 built the inward offset and §7's own guard needed two iterations. This is the
third, and it is worth recording as a *pattern* rather than as another bugfix,
because all three are the same sentence applied at the wrong radius.

### 11.1 The rule was right; the radius was not

*Do not ask a discrete field a question finer than its cell.* The guard applied
that at **one cell**. Two quantisations stack and one cell does not cover them:

```
Math.round to the nearest cell centre       up to √2/2 = 0.707 cell of error
componentMask thresholded AT cell centres   up to 1 cell inside the 50 % isoline
                                            ------------------------------------
                                            1.707 cells, before the contour
                                            smoother moves the vertex at all
```

Measured over all 1329 contour vertices of the five standard fixtures — walk
inward and find the first depth past which the binary mask reads material
continuously — the worst misread is **1.950 cells**, and a floor of 2.00 leaves
**zero**. The shipped 1-cell floor left 117.

The general form, which is the part worth keeping: **a binary field derived by
thresholding a coverage field at cell centres cannot answer a containment
question within ~1.7 cells of the coverage isoline, no matter how the query is
phrased.** Either raise the floor above that, or ask the coverage field with
interpolation instead of asking the thresholded one.

### 11.2 A quarter-round has ONE size, and this one had two

The deeper defect, and the one no guard could have fixed: the bevel's XY inset
was per-vertex and its Z drop was a per-**ring** constant. A vertex clamped to a
fraction `f` of the requested offset therefore still dropped the full height, and
the band's slope is

```
atan( dz / (inFrac step × achieved inset) )
```

which is the designed 15.0° at `f = 1` and **65.9° at `f = 0.12`**. Feeding the
same `f` to both axes makes the slope invariant — `atan(f·dz / (0.5·f·inset))`
has no `f` in it — so the rim narrows toward a cut instead of standing up as a
cliff, which is the graceful failure §7 specified and did not get.

This is the same shape of error as `capRoundness`'s squash in §9: a profile whose
two axes were allowed to disagree, so the surface could not meet its neighbour
tangentially. There it was the cap and the wall; here it is the two axes of the
same quarter-round.

### 11.3 A fold repair that did not know how far the fold went

`dist *= 0.5`, up to three passes, regardless of how far the offset edge had
actually reversed — so two adjacent vertices could come out at 1.0 and 0.25, and
three passes could run out with the fold still there. Scaling both endpoints by a
common `s` puts the offset edge at `o + s·(v_j − v_i)`, so *retain `KEEP` of the
original projected length* is one linear equation:

```
(o + s·D)·o = KEEP·|o|²    ⇒    s = (KEEP − 1)·|o|² / (D·o)
```

`KEEP` is bounded from both sides — over-correction above, slivers below — and
the sweep bottoms at 0.10 (`openArc/solid` mixed max 75.49 / **69.86** / 71.24 /
73.22 / 75.11 at KEEP 0.05 / 0.10 / 0.20 / 0.35 / 0.50).

### 11.4 Leads not taken

Recorded as leads, unverified — nothing external was consulted for this section:

- **Offsetting through the coverage field rather than the thresholded mask.** The
  module already has `coverage` (it hands it to `smoothLatticeLoop`), so a
  bilinear "is coverage ≥ 0.5 here" predicate would remove the blind radius
  entirely instead of budgeting around it. It needs the component restriction
  carried across, which is why it was not done here.
- **A distance transform instead of a per-vertex ladder.** The quantity the
  ladder is groping for is the distance to the medial axis, which one EDT over
  the same raster computes exactly and continuously for every vertex at once. It
  would replace the ladder, the ray, the ring and the flip repair with one field
  lookup — and, being continuous, could not produce the neighbour discontinuity
  that was this defect's whole mechanism.
