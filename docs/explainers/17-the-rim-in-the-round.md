# 17 — The rim in the round: three defects that were not the same defect

Explainer 16 fixed Rod's bead and gave Solid the bevel it never had, and left
three items measured but not done. This is the pass that did them. The through
line is the one thing that was easy to get wrong here: **the same number, 90
degrees in the `mixed` bucket, had three different causes in three engines, and
only one of them was a missing bevel.** A fix that transferred would have been a
fix that missed.

---

## 1. Inflate's rim was the ink taper's shoulder, not a bevel and not marching cubes

### What it was reported as, and why that reading was wrong

The handoff recorded `cap max 16.5–38.1`, `mixed max 85–90` on all four fixtures,
with the diagnosis *"the marching-cubes surface meeting its own dome caps"*.

Two things are wrong with that. `DEFAULT_INFLATE_PARAMS.fusion` is **`loft`**, so
the default Inflate path is a swept elliptical tube and there is no marching
cubes in it at all — the implicit polygoniser is the other, opt-in strategy. And
the crease is not at the dome/body junction either. Measured with the crease
census extended to say *where*, the worst edges on **every** fixture land on the
same three rings — the last start-cap ring, the first body ring, the second —
and both offending faces are real, with `degenerateTriangles: 0`.

Those three rings are the ink taper's shoulder.

### The mechanism, from the code and confirmed in the numbers

`inflateInkWidthProfile` is Desk Doodles' capsule profile, ported:

```
r(x) = tip + (1 − tip)·sin(πx/2)^0.8      tip = 0.035/0.22 = 0.159
```

The exponent is **below 1**, which is the ported decision — their comment is
"capsule read, not football", fuller shoulders. It also means

```
dr/dx ∝ x^(−0.2)  →  ∞   as x → 0
```

The profile leaves the tip **vertically**. So the first ring step out of the tip
raises the radius by a large fraction of a radius while the centreline advances
one sample spacing, and a ring placed square across the centreline turns the wall
by `atan(Δr/Δs)`. On `circle`, measured from the mesh: Δaxial 0.0008, Δradial
0.0126 world — **86 degrees**, against the 85.26 the census reported. The
hemisphere cap was then built at the **local** radius, i.e. 0.159 r, so a small
nub was welded onto a wall flaring at nearly a right angle. That collar is the
defect, and on `glossyPlastic` it reads as a hard chisel point with a shoulder
line around the stem — a sharpened pencil, not ink.
`docs/verification/gloss-rim/rim_after/crops/inflate_tip_BEFORE.png`.

Two fixes that look obvious and are both wrong:

- **Sample it finer.** Subdividing between two rings whose radii are linearly
  interpolated adds vertices to a straight generatrix and changes no crease at
  all. And because the slope is unbounded at the tip, no spacing makes the first
  step shallow.
- **Raise the exponent to 1.** That bounds the slope — and re-derives a ported
  constant, which is the one thing the port's own header forbids. It also only
  moves the number: at exponent 1 the first flare is still ~43 degrees.

### The fix is the construction: rings are the envelope of the balls

A swept tube of varying radius has a well-defined smooth boundary — the boundary
of the **union of balls** along the centreline, the canal surface. Differentiating
`|p − c(s)|² = r(s)²` with respect to `s` (arc length, so `|c′| = 1`) gives
`(p − c)·T = −r·r′`, so the characteristic circle sits at

```
centre − r·r′·T          radius   r·√(1 − r′²)
```

— tilted toward the narrow end and shrunk, not square across the curve. Two
consequences, and they are exactly the two halves of the defect:

1. The band between consecutive circles is the tangent cone of both balls, so the
   crease across a ring is the change in **slope** — a second difference of `r` —
   instead of the slope itself. An unbounded first derivative stops producing an
   unbounded crease.
2. **The end cap falls out of the same family instead of being bolted on.** The
   terminal ball's own spherical patch, run from the junction circle (`cos α =
   ∓r′`, which is where the wall left it) to the pole one radius past the
   endpoint, is tangent to the wall by construction. There is no free cap length
   left to get wrong.

Sanity check on the formula, since it is easy to get inside-out: for a cone
`c(s) = (s,0,0)`, `r(s) = a·s`, it gives a circle at `x = s(1−a²)` of radius
`a·s√(1−a²)`, whose radius/x ratio is `a/√(1−a²) = tan(asin a)` — the cone of
half-angle `asin a`, with its apex at the origin. Correct.

This is also the surface the **implicit** path already defines: its primitives are
round cones, i.e. unions of two balls. The two strategies now describe the same
solid, which is what the builder's own "both surface strategies must read as the
same drawing" asks for.

### Why balls are pruned first, and why that removes the need for a clamp

`r′` only means anything where `|r′| < 1`; at `|r′| ≥ 1` the smaller ball is
swallowed by its neighbour and contributes no surface, and `√(1 − r′²)` goes
imaginary. Both fixtures hit this: `processStroke` can emit a near-duplicate first
sample (measured Δs = 0.0008 world on `circle` against Δr = 0.0126), which is a
ball wholly inside the next one.

So the chain is pruned by the exact containment test `|cᵢ − c_j| + rᵢ ≤ r_j`, and
after pruning `|Δr| < |Δc|` holds between every surviving neighbour **by
definition** — `|r′| < 1` is a *theorem about the pruned chain*, not a clamp
bolted on top of it. That distinction matters in this codebase specifically: a
clamp here would have been another guard whose failure mode is the worst
available answer, and explainer 16 spent two iterations on one of those.

`capRoundness`'s 0.6→1.0 squash of the dome is **gone**, not defaulted-and-ignored.
A cap shorter than one radius is not a patch of the terminal ball, so it cannot
meet the wall tangentially; the squash was part of the collar. It is reported as
1, which is the truth. Puff still drives the Z aspect, the profile exponent, the
cross-section bulge and the join softness. `capRoundness` was removed from
`inflateBuildEllipticalTube`'s options rather than left accepted-and-unread, so a
caller that still passes it fails to typecheck.

### Measured, on glossyPlastic — never on softGel

`softGel` has sheen 1.0 with a broad lobe, and a broad lobe averages over a normal
discontinuity instead of tracing it. That is why this survived so long as Inflate's
default material.

| fixture | wall max | cap max | mixed max | mixed >30 |
| --- | --- | --- | --- | --- |
| circle/inflate — before | 61.45 | 16.78 | **85.26** | 58 |
| circle/inflate — after | 33.59 | 17.81 | **34.85** | 32 / 13176 |
| tick/inflate — before | 84.69 | 32.83 | **89.31** | 78 |
| tick/inflate — after | 31.44 | 32.44 | **33.78** | 12 / 372 |
| crossing/inflate — before | 89.96 | 16.51 | **89.96** | 152 + 112 |
| crossing/inflate — after | 16.36 | 11.77 | **17.22** | **0** |

`crossing` comes out with **zero** edges creasing past 30 in any bucket. The frames
are the actual verdict:
`docs/verification/gloss-rim/rim_after/crops/inflate_tip_{BEFORE,AFTER}.png` is the
same two `l` stems, hard faceted chisel point against a smooth rolled dome, with
the taper intact in both — the tip is still narrower than the body, which is the
other direction of the test and the thing a "smooth it out" fix would have
destroyed. 72 orbit frames + video per fixture, headed, Metal, gloss.

### What is left, and it is a real limit rather than an omission

`square/inflate` still reads `mixed max 89.6`, at its four drawn 90-degree corners.
The union of balls around a polyline corner is smooth — the corner ball's spherical
wedge fills the outside — but expressing that in a swept ring sequence needs two
tangency circles per ball plus the band between them, and on the **inside** of the
elbow that band has to be clipped against the two cylinders. Clipping is
re-topologising, which a loft cannot do; it is what the implicit path is for, and
SESSION-HANDOFF already carries that recommendation. Not started, and named here
rather than left as an unexplained number.

---

## 2. `square/extrude`'s 153 non-manifold edges: the ribbon was not built as a loop

`probeDihedral` reported **153 non-manifold edges** on `square/extrude` — an edge
shared by more than two faces, i.e. the surface passing through itself — and it
was the only fixture whose worst creases sat there. Not the miter and not the
bevel: `square` is a closed loop drawn as ONE stroke returning to its own start,
so the builder put a round END CAP at the last sample and another at the first,
sweeping opposite half-discs **about the same point**. The two half-discs overlap,
their arc columns land on identical positions wherever the two sweeps' angular
steps coincide, and welding by position makes those edges four-faced. This is the
literal, measured instance of *"look at all the weird joints … the edges and
overlaps, the geometry gets all weird."*

A closed ribbon has no ends, so it needs no caps: the strip wraps from the last
frame back to the first and every sample becomes an interior mitered join.
**Nothing is snapped or moved** — the closing chord is an ordinary segment — so the
drawn shape is unchanged and only the topology is. `closed` is decided by a gap
threshold expressed in **half-widths**, because "did the pen come back to where it
started" is a question about the mark's own thickness: a gap narrower than that is
one the two caps already filled. An absolute epsilon would call a fat mark open and
a hairline mark closed at the same pixel gap. An arc-length floor stops a two-sample
tick, whose endpoints are trivially close, from being called a loop.

`square/extrude`: **153 non-manifold edges → 0.** And the fourth corner now exists
*as a corner*: the census finds `wall max 90` with `n0 = (0,1,0)`, `n1 = (−1,0,0)`
at that position, two flat walls of a square meeting at its corner, and the mesh
indices show it joining the last frame to the first.

### The seam still needed one more thing, and only the frames found it

The census went clean and the picture did not. The rounded overlap blob was gone
and a small inverted flap had appeared at the seam's **inner** corner, which the
other three corners do not have. It is invisible to every number: manifold, closed,
`wall over30` 32/6161, and a fold reads as a *small* crease under
`min(acos(d), acos(−d))` rather than a large one.

The cause is in the input. `processStroke` resamples at 4 px and **pins** the
endpoints, so the square's polyline ends `… (250,185.87) (250,181.87) (250,180)`:
a **1.87 px remainder** between the last grid sample and the pinned end. A mitred
90-degree join offsets its shared vertex by `halfWidth / cos 45° = 1.41·halfWidth`,
about 16 px of canvas at the default width — so the inner column has to travel 16 px
inward across a 1.87 px step and back out. The inner boundary reverses over one
segment, and that is the flap. The other three corners are clean for a reason worth
recording: Taubin smoothing spreads each of them over **two** samples (measured
51+30, 49.8+28, 45.1+37.7 degrees) on regular 4 px steps, while the seam corner is
pinned to a single hard 90.

So the seam is given the spacing every other join already has: while the closing
segment is shorter than half a median step, drop the sample that made it short.
Those samples lie on the straight run they came from, so nothing about the drawn
shape moves. `extrude_seam_AFTER.png` is then indistinguishable from the square's
other three corners, bevel band and all.

## 2b. Every Extrude mesh had 8–12 boundary edges, and they were T-junctions

A boundary edge belongs to exactly one face, so the shell had holes —
**consistently, on every fixture, regardless of shape**. They were T-junctions,
and the arithmetic says exactly six per cap:

The half-disc closing each cap in +Z was a fan around a NEW vertex at
`(e.x, e.y, +halfDepth)`. At an end frame the mitered magnitude is exactly
`halfWidth`, so that vertex lands precisely on the **midpoint of the chord
L[0]–R[0]**, which is an edge of the strip's own top-face quad. The chord had one
face (the strip's) and the two outermost fan spokes had one each (the fan's), and
all three are collinear: **geometry with no visible gap, topology with three
holes** — per z-face, per cap. Six per cap, twelve per ribbon. Exactly the number
measured, and exactly why it "was small enough not to show under this lighting".

The fix removes the vertex rather than adding a weld. A half-disc is convex, so a
fan anchored on one **end** of its diameter triangulates it just as well as a fan
around its centre — and that anchor is `cols[0][…]`, a vertex the strip already
shares. Its closing triangle spans the chord, so the chord gains a second face and
every spoke becomes interior. **Boundary edges 8–12 → 0 on all four fixtures**, and
the cap loses two vertices and one triangle per z-face. No new vertex exists that
could sit in the middle of somebody else's edge.

Both of these are now **gated**, not merely printed: `assert-mode-rims` asserts
manifold-ness and closure on Extrude as well as Solid. They sat measured-and-
ungated for a whole cycle because the numbers were reported and nothing read them.

---

## 3. `applyDraftTaper` is wired, about the mark's centre

It was ported and deliberately left unwired for a real reason: it shrinks the back
face toward **the geometry's own bbox centre**, and Free Stroke's Extrude emits one
geometry per stroke, so the verbatim call tapers the `h` of a word toward the `h`'s
centre and the `o` toward the `o`'s — five separate mouldings leaning five ways.
`applyDraftTaperAbout` is the same arithmetic with the centre supplied.

What the wiring needed:

- **`ExtrudeParams.sideWall`** (`straight` | `drafted`), defaulting to `straight`
  as Desk Doodles' own does, plus a control in the Extrude config strip next to
  Bevel — a **dial**, not a preset pill, because it is a property of the same
  ribbon. Reachable from `__styleHarness.setExtrude` too.
- **The pool centre, threaded from the caller.** `computeExtrudePoolCentreXY` over
  the strokes, but computed in viewport-3d from the **full** `strokes` prop and
  passed in as `PreviewParams.draftCentre` — because `useStrokeMeshes` is handed
  `animatedStrokes`, the arc-length-filtered partial, during draw-in. A centre
  derived from a partial pool travels as the reveal grows, and every letter
  already on screen would re-slant on every tick. The engine falls back to its own
  pool, which is correct for the static and export paths.
- The dep-array worry the port's note raised **is already handled**: the memo
  signature in `useStrokeMeshes` is `JSON.stringify` of the params objects, so a
  field added to `ExtrudeParams` is in the signature the moment it exists. That
  comment was written after `bevelSize`/`bevelSegments` were consumed for a cycle
  without being listed, and it paid off here.

### The assertion is the point, because the two wirings are otherwise identical

`assert-draft-taper.mjs` exists because the naive wiring and the correct one agree
on **every number the build reports**: same vertex count, same triangle count, same
per-stroke bbox, same total bbox — each letter shrinks by the same amount either
way — and on a single letter they are the same call. They differ in one place only:
which way each letter's back face moves. `__geomDebug.taperProfile()` reports each
mesh's front- and back-face centroid, and the assertion is the dot product of the
shift with that mesh's own direction to the pool centre.

Measured on `hello`, four meshes:

```
straight   |shift| 0.00000 on all four                      → the dial is real
drafted    |shift| 0.112 / 0.030 / 0.025 / 0.107
           inward  0.111 / 0.026 / 0.021 / 0.106            → all four lean IN
           inward / (dist x 0.18) in [0.65, 1.01]           → the ported amount
```

**And it was proved able to fail.** Rewired temporarily to the verbatim
`applyDraftTaper`, three of the four assertions fire: `|shift|` collapses to
≤0.002 on every mesh (each letter shrinking about its own centre moves its own
centroid nowhere), two meshes lean the wrong way, and the ratio goes to ~0.
Rewired to a wrong-but-plausible centre (the origin), the amount assertion fires on
its own. The fixture is a **word** for this reason: on one stroke the two wirings
are the same call, so a single-letter fixture is a test that cannot fail.

---

## 4. The census scored a triangle with no normal as exactly 90 degrees

Found while diagnosing item 1, and it is explainer 13's lesson with the sign
flipped again — this time the instrument's numeric failure mode was
*indistinguishable from the defect it measures*.

`probeDihedral` pushed `{x:0, y:0, z:0}` for a zero-area triangle and then guarded
with `if (!n0 || !n1) continue`, which never fires: `{x:0,y:0,z:0}` is a truthy
object. The zero normal flowed into the arithmetic, `dot` came out 0, so
`min(acos(0), acos(−0))` returned **exactly 90**, and `|0| < 0.4` typed the phantom
face as a **wall** — so one degenerate triangle beside a cap face manufactured a
`mixed max 90`, the precise signature of a die-cut rim.

It happened not to be firing here (`degenerateTriangles` is 0 on all sixteen
cases, which is how we know Inflate's 90s were real geometry). It would have been
indistinguishable if it had been. Degenerates are now counted as a number a reader
can see, their edges are not registered at all, and **`no degenerate triangles` is
its own assertion** on every case.

Three more instrument corrections fell out of this pass:

- **`worst` — where, not just how big.** The census now reports the top six edges
  per bucket with their midpoints, both face normals, and both faces as vertex
  indices *and* positions. Inflate's rim had to be diagnosed by inference before
  this, and the inference was wrong. Six edges of nine numbers each.
- **`cap is flat` had been failing on all four modes on every fixture since the
  bevel landed.** It read `cap.max < 5` under the comment "two near-flat faces must
  be coplanar", which was true when the `cap` bucket held only the cap plane. The
  bucket is `|n.z| > 0.9` for both faces — *within* 25.8 degrees of the plane, not
  on it — so the moment Extrude and then Solid grew a rolled rim, the shallowest
  bevel ring landed in this bucket carrying its ~15 degrees per step. Measured now:
  15.0 on circle/solid and circle/extrude, which is one step of a 3-segment quarter
  round and is the rim **working**. Nobody re-derived the number because the pass
  that added the bevel reported `verify-gates` (a different script) as its
  all-pass, and a FAIL line that has always been there stops being read. Restated
  as what the bucket can actually answer — shallow, not buckled — at 45.
- **The rim assertions are two-sided, per shape AND mode.** `square/{extrude,
  solid,inflate}` and `crossing/solid` (the notch where the merged silhouette
  reverses) own real corners, so there the assertion is that the corner **survived**
  — max above 60 — while the faceting count stays low. Elsewhere it is that the max
  is below 75. A one-sided "max must be small" gate is satisfied by a fix that
  rounds the drawn corners off, which is worse than the defect. `rod` is excluded
  from the corner claim entirely: a tube has no corner feature in its surface, it
  carries a corner as a **bead**, and `assert-joint-beading` is the script that owns
  that.
- **And the census is calibrated before it is believed.** `assert-mode-rims` now
  begins by pointing itself at a rim that is a hard 90 by construction —
  `bevelEnabled: false`, Desk Doodles' `sharp` profile — and refuses to report
  anything unless it comes back over 80. It reads **90.00 off / 30.00 on**. Every
  instrument this project has trusted and then caught was one that had never been
  run against a known-bad input.
- **`assert-joint-beading` gained a `--holdsteady` mode.** `--compare` asserts that
  a *fix landed*: spurious beads must fall. Run on two labels that are both already
  fixed, it reports "spurious beads did not fall" three times — a clean
  no-regression result that reads exactly like a broken one. Same trap, one level
  up: a comparator derived for a before/after pair, consumed on an after/after
  pair. A later pass proving Rod untouched asks the other question, and gets
  `word 2, zigzag 7, loopyS 0, openC 0 — held`.

---

## 5. The decision this pass did NOT build

Explainer 16 recorded that Desk Doodles' `detectJointPositions` carries **the same
inverted predicate, verbatim** (`lib/dd-engine/strokeTo3d.ts`, whose own comment
says it is a verbatim port of `detectJoints3D`) — so their 63 beads on the word were
spurious too; they simply had fewer anchors to fire on. It correctly declined to
port their sparse-anchor detection, since on a smooth arc of radius R, RDP anchors
at ε ≈ 0.9 tube-radii are spaced ~√(8εR) apart and each junction turns ~√(8ε/R)
radians, which clears 40 degrees for any curl tighter than ~R = 8 tube radii — a
curve that does not pinch and does not want a bead.

**That remains not built, deliberately, and it is Sebs's call.** The corrected
dense-curve predicate is genuinely blind to one thing: a *gentle* real corner, a 60
degree turn spread over three resample steps is 20 degrees per step and detects
nothing. The principled replacement is not an angle at all — a joint is needed
exactly where the centreline's local curvature radius falls below the tube radius,
which is the quantity that decides whether consecutive cross-sections meet, and the
adaptive tube sampler already computes curvature. That is a derivation, not a port.
Recorded rather than shipped, per the standing rule about not shipping a judgement
nobody made.

Worth noting that item 1's fix is the same idea one dimension over: the reason the
canal surface works is that it asks whether consecutive *balls* contain each other
rather than asking an angle to stand in for it.

---

## 6. Cost and regression

`geometry-baseline.mjs --compare=bevel_after,rim_final`, 8 shapes × 4 modes:

- **Rod: byte-identical (`=`) on all 8.** **Solid: byte-identical on all 8.**
- Extrude: 0% to −4% vertices/triangles. The −4% is `closedO`, which is a closed
  loop and no longer carries two end caps; the rest is the two cap-centre vertices
  and one triangle per z-face that the T-junction fix removed.
- Inflate: −1% to −38%. The −38% is `tick`, a 6-point mark that is mostly cap: its
  swallowed balls are pruned and its cap ring count is now adaptive to how much of
  the terminal sphere the cap actually covers, instead of a fixed seven.

`verify-gates.mjs`: **ALL GATES PASS**, 0 console errors — geometry-rebuild gate
flat in all four modes, export non-empty in all four, taxonomy clean.
`assert-mode-rims.mjs`: **ALL MODE-RIM ASSERTIONS PASS**, calibration included.
`assert-draft-taper.mjs`: **ALL PASS**. `assert-joint-beading --holdsteady`: **PASS**.
Typecheck: **51 errors, the same 51 as the baseline**, all pre-existing and all in
`solid-vector.ts` / the `MaskSolidDiagnostics` surface / one `viewport-3d` nullable.

Frames and video: `docs/verification/gloss-rim/rim_after/` (72 frames + mp4 + 3
closeups per fixture, inflate and extrude, glossy, headed, Metal),
`docs/verification/gloss-rim/rim_after2/` (extrude re-shot after the seam-stub fix),
`docs/verification/gloss-rim/rim_after/crops/` (the four before/after crops that are
the actual verdict), `docs/verification/draft-taper/wired/{straight,drafted}/`
(36 frames + mp4 each), `docs/verification/geometry/rim_final/`.
