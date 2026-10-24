# 16 — The rim and the bead: two geometry defects, in all four modes

Sebs, twice: *"my critique for overlap and weird edges is for ALL modes"* and
*"serious geometry issues in general, in ALL the modes I checked."*

Explainers 11 and 13 found the defects and built the instruments. This is the pass
that fixed two of them and, in the course of doing so, caught a third instrument
reporting a clean result it was structurally incapable of not reporting.

---

## 1. Rod: the beads were an inverted comparison, and the census that measured
them had gone blind

`detectJoints3D` stamps a sphere wherever the centreline turns hard enough that
two consecutive tube cross-sections do not meet. Its test was

```ts
const deviation = Math.PI - Math.acos(cosAngle)
if (deviation > angleThresholdRad) { … }
```

`acos(cosAngle)` is the TURN angle: 0 on a straight run, π at a hairpin.
`π − acos(...)` is the INTERIOR angle, which is the complement. So the predicate
fired for every turn from 0° up to 140° — i.e. on a perfectly straight stretch —
and stayed silent from 140° to 180°, i.e. at the only place a joint sphere is
needed. Exactly backwards.

It had been measured before it was understood: `probeDihedral` counted **166
meshes on a two-stroke crossing** — one tube, four caps, and ~160 joint spheres
strung along two straight bars — and 190 on the `square` fixture, which has four
corners. And because there were thousands of them, `JOINT_SPHERE_SEGMENTS` had
been lowered to 8 to keep the GLB small: 45° facets, twice as coarse as the
16-sided tube the sphere is supposed to hide inside. The dihedral census measured
a **44.22° max crease on every Rod fixture, in all three buckets** — 360/8. The
bug's symptom had become the justification for the constant that made the symptom
visible.

Fixing the predicate removes the trade, so both the cap and the joint sphere now
take `RADIAL_SEGMENTS`. The rule that replaces the number: **no sphere welded into
a tube may be coarser than the tube**, or the weld itself becomes the crease.

### The census said zero, and zero was not the answer

`assert-joint-beading.mjs` exists because a fix that merely stops stamping is not
a fix — real corners must keep their joints. It measures both signs: `word`,
`loopyS` and `openC` are smooth, so beads there are spurious and must fall;
`zigzag` has seven hard corners, so its beads must survive.

First run after the predicate fix:

```
word     joints=   0  caps=34
zigzag   joints=   0  caps=9
loopyS   joints=   0  caps=2
openC    joints=   0  caps=2
```

Read at face value: the spurious beads are gone and so are the real ones — the
exact failure the fixture set was built to catch. It is not what happened. The
tell is `zigzag`, one stroke, `caps=9`: a stroke owns exactly two caps.

`__geomDebug.stats()` separated the two sphere passes **by vertex count**, on the
stated grounds that "a cap sphere is 225 verts, a joint sphere is 81, and nothing
else can land in these buckets". True when the two tessellations differed. Then
the tessellations were deliberately unified — for the good reason above — and the
discriminator collapsed: both spheres became 289 verts, the `else if` became
unreachable, and `jointSpheres` became **structurally zero on every fixture**.
`caps=9` was two caps plus seven joints, all in the cap bucket.

The fix is not two new numbers. It is to stop inferring the part from its
resolution: the meshes now carry a part tag (`FS_PART_CAP` / `FS_PART_JOINT`) and
the census reads the tag, plus an `untagged` count so that a pass which stops
being tagged shows up as a number instead of as a clean zero.

With a working instrument:

```
word     joints=   2   (from 205 — see explainer 12)
zigzag   joints=   7   seven corners, seven beads
loopyS   joints=   0
openC    joints=   0
```

Both signs hold. On the regression net (8 shapes × 4 modes) Rod drops **62–86% of
its vertices** and 55–82% of its triangles, `scribble` worst-affected at −86%,
and **Extrude, Solid and Inflate are byte-identical on all 24 of their cases**.

### The port that turned out not to be needed

The plan for this was to port Desk Doodles' joint detection, which stamps 63
spheres on the word where Free Stroke stamped 205, on the reasoning that they
detect on the SPARSE post-RDP anchors while we detect on the dense resampled
curve, so we bead every smooth arc that has no corner in it.

Measured, that is not what the 3.3× was. **Desk Doodles' `detectJointPositions`
carries the same inverted predicate** — it is a verbatim port of this function,
including the bug (`lib/dd-engine/strokeTo3d.ts`, and its own comment says
"VERBATIM PORT of free-stroke detectJoints3D"). Their 63 beads are spurious too;
there are just fewer anchors to fire on. So sparse-anchor detection is not the
mechanism, and porting it now would make things worse: on a smooth arc of radius
R, RDP anchors at ε ≈ 0.9 tube-radii are spaced ~√(8εR) apart and each junction
turns ~√(8ε/R) radians, which clears 40° for any curl tighter than ~R = 8 tube
radii — a curve that does not pinch and does not want a bead.

Recorded rather than built, per the standing rule about not shipping a judgement
nobody made. What the corrected dense-curve predicate is genuinely blind to is a
gentle real corner: a 60° turn spread over three resample steps is 20° per step
and detects nothing. The principled predicate is not an angle at all — a joint is
needed exactly where the centreline's local curvature radius falls below the tube
radius, which is the quantity that decides whether consecutive cross-sections
meet, and the adaptive tube sampler already computes curvature. That is a
derivation, not a port, and it is the next thing here if the beads ever read wrong
on a soft corner.

---

## 2. Solid had no bevel at all, and now has the same rim as Extrude

`probeDihedral`'s `mixed` bucket is a cap face meeting a wall face — the bevel.
Before:

| fixture | mixed mean | mixed max | over 30° |
| --- | --- | --- | --- |
| Extrude (ported 3-segment profile) | 15.4° | 30.1° | a minority |
| circle/solid | **90.0°** | **90.0°** | every edge |
| square/solid | **90.0°** | **90.0°** | every edge |
| crossing/solid | **90.0°** | **90.0°** | every edge |

A spike at exactly 90 on every edge of every fixture. Desk Doodles' own comment on
`EXTRUDE_BEVEL_SIZE` says the profile is *"Shared by Extrude + Solid"*; this repo
had ported the Extrude half, because DD gets its Solid bevel free from
`THREE.ExtrudeGeometry` and Free Stroke's H3 assembles caps and walls by hand (it
has to — it carries hole walls, preview/export parity and partial-reveal
rebuilds).

After:

| fixture | mixed mean | mixed max | wall max | cap max |
| --- | --- | --- | --- | --- |
| tick/solid | 15.88° | **30.0°** | 15.0° | 15.0° |
| circle/solid | 15.25° | **30.0°** | 15.0° | 15.0° |
| square/solid | 19.2° | 67.4° | 90° | 21.1° |
| crossing/solid | 16.5° | 89.3° | 78.2° | 35.7° |

`tick` and `circle` land on Extrude's signature exactly: ~15° mean, 30° max — three
steps of a quarter circle at `segments: 3`. The two remaining maxima are at genuine
sharp contour corners (the `square`'s four drawn corners; the `crossing`'s notch,
where the silhouette reverses), where a hard crease is the correct answer. That is
also why the gate's `max` assertion still reads FAIL there and should be read
against the count, exactly as explainer 13 says: one legitimate corner raises
`max`, a faceted curve raises the count — and the count fell from 100% of edges to
33–35%.

The frames are the actual verdict.
`docs/verification/gloss-rim/after/crossing_solid/closeup_1.png` is a near-black
flat cap meeting a cream wall at an absolutely hard terminator — a paper cutout.
`docs/verification/gloss-rim/bevel_final/` is the same geometry with a graded
highlight band running along every edge: the "pressed cookie" read DD's comment
describes. 72 orbit frames + video + 3 closeups per fixture, glossy, headed, Metal.

### The construction, and the two things that are easy to get backwards

The bevel needs an **inward offset of the traced contour**, the one operation this
pipeline had avoided. `docs/research/extrude-solid-quality.md` §7 sets out why it
is not a bisector displacement on a handwriting silhouette: the form is thin, so
an offset that is a rounding error on a bowl is a large fraction of a stem and can
invert it; the contour has concavities, which is where a naive offset
self-intersects; and holes must offset the other way.

§7's recommendation is to offset through the field the contour came from, because
an isoline of a scalar field cannot self-intersect and, where the form is thinner
than 2d, the isoline simply does not exist so the bevel vanishes instead of
inverting. `insetLoopAgainstMask` is that idea in the form that keeps a **1:1
vertex correspondence** with the source loop — which is what lets the bevel band be
a plain quad strip and lets the cap keep its existing triangulation, so the
triangle count, the hole topology and every H2 number are unchanged and the bevel
cannot quietly alter which holes exist. Each vertex moves along its exact miter
vector, with a miter limit; the displacement is then clamped by probing the same
raster the contour was traced from.

**Backwards thing one: the tangents.** The ring profile is

```
inFrac(u) = 1 − sin(u·π/2)        z(u) = halfDepth − bz·(1 − cos(u·π/2))
```

At the cap plane the XY rate is maximal and the Z rate is zero, so the band leaves
the cap *tangentially* — that is what makes the cap-to-bevel crease ~0 rather than
a second hard line one step in. At the wall it is vertical, so it meets the wall
tangentially too. Swap the sin and the cos and you get a band that meets the cap
AND the wall at 45°: three creases instead of one, which is worse than the die-cut
edge it replaces.

**Backwards thing two: the inward direction is the LEFT normal for BOTH loop
types.** Not a coincidence, and it is the same fact the existing wall-winding note
depends on: the outer loop is CCW and holes are CW precisely so right-perp always
points out of the body, hence left-perp always points into it. Holes offset
outward, into their own wall, with no special case.

When the bevel is off — profile disabled, no room in Z, or the cap could not be
mapped onto the rings — the ring table collapses to two rings at ±halfDepth with
zero inset, which is vertex-for-vertex the vertical wall this block built before.
The un-bevelled assembly is not a second code path that can rot; it is this one
with the profile switched off. And it is reported: `h3BevelStatus` is `ROLLED`,
`CUT_CAP_NOT_MAPPABLE` or `CUT_DISABLED`, alongside the achieved fraction, the
starved-vertex count and the flip-repair count — because a silently un-bevelled
rim is indistinguishable from a bevelled one in every other number this build
reports.

### The guard was noise before it was a guard — twice

The first clamp asked one question: *is the disc of radius 0.9r around the offset
point entirely material?* A direct reading of "at least r inside", and at this
scale a coin flip. The bevel is `EXTRUDE_BEVEL_PROFILES_FS.rounded.size` = 0.015
world, which on a 512-cell raster spanning 3 world units is **2.6 cells**. On a
straight boundary the offset point sits exactly r inside, so the disc's nearest
sample sits 0.26 of a cell inside, and rounding to the nearest cell decides the
answer. Result: `mixed max 90` survived on all four fixtures — a scatter of
vertices starved to zero all over otherwise-fat forms, each leaving a 90° crease
behind. The bevel was right and the guard was noise.

Replaced by two tests, each at a radius the raster can answer: a **ray** along the
displacement (the thin-stem test — exact regardless of r, because it does not
depend on measuring a margin) and a **ring at 0.5r** for margin.

That still left `max 90` on three of four fixtures, for a second, sharper version
of the same mistake. The contour vertices ride the **50%-coverage isoline** — that
is what `snapLoopToCoverage` puts them on — so roughly half of them sit in a cell
whose binary value is *background*. Every probe sample within about a cell of the
vertex therefore reads "outside" for a vertex that is on the surface by definition,
every rung fails, and the offset lands on zero. Samples closer than one cell to the
vertex are now not consulted, and an offset smaller than one cell is accepted
without probing — it cannot cross anything the raster is able to see. That is what
took `circle/solid` from `max 90` to `max 30`.

Both are the same lesson, and it is the lesson of explainer 13 with the sign
flipped: there, instruments answered questions they could not answer and their
answers looked clean. Here a *guard* did, and its answers looked like defects.
**Do not ask a discrete field a question finer than its cell.**

---

## 3. Cost

Only Solid moved, on all 8 shapes: vertices ×2, triangles ×4 (two rings became
eight, so four times the strips; the cap shares the ring-0 vertices rather than
owning its own block, which is why vertices only doubled). Rod, Extrude and
Inflate are byte-identical. `verify-gates.mjs`: ALL GATES PASS, 0 console errors,
export works in all four modes, and no mode rebuilds geometry on a style change.

---

## 4. Appendix, 2026-08-04 — the guard was noise a THIRD time, and the rim it
guarded was a cliff

§2 above ends with *"the guard was noise before it was a guard — twice"*, and
closes on the lesson: **do not ask a discrete field a question finer than its
cell.** That lesson was right and its APPLICATION was still wrong, which is why
`assert-mode-rims` had four red rows for days, carried as *"real geometry, a look
call, not a repair"*. Three of the four were repairs. The fourth was the
instrument.

### 4.1 The guard was reading the raster one cell too shallow

The rule was applied at a radius of **one cell** — samples closer than that to a
contour vertex are not consulted, and an offset smaller than that is granted
without probing. One cell is not enough, and the bound is arithmetic before it is
measured. Two quantisations stack:

- `isMaterialWorld` rounds to the nearest **cell centre**, so a query lands up to
  √2/2 = 0.707 cell from the point actually asked about;
- `componentMask` is the coverage field thresholded **at** cell centres, so the
  outermost cell flagged 1 can sit a full cell inside the 50 %-coverage isoline
  the contour vertices were snapped to.

1 + 0.707 = 1.707 cells before the loop's own Chaikin/DP smoothing moves a vertex
off the isoline. Measured, by walking inward from all **1329 contour vertices of
all five fixtures** and finding the first depth past which the mask reads
material continuously:

```
max misread            1.950 cells
floor 1.00 cell   ->   117 vertices still misreadable      (what shipped)
floor 1.50 cells  ->    24
floor 1.75 cells  ->     5
floor 2.00 cells  ->     0
```

What it cost on `openArc/solid`: **22 of 497 contour vertices** were told "not
material" at 1.04 and 1.58 cells inside **a band 17.9 cells thick**. There is no
reading under which a point one cell inside an eighteen-cell band is outside.

### 4.2 …and the bottom rung of the ladder was a free pass

Those 22 failed every real rung and fell to the bottom of `OFFSET_LADDER`, where
`0.12 × 0.015 = 0.0018` — **0.38 of a cell** — trips the same "smaller than a
cell, cannot cross anything the raster can see" clause and is granted
**unprobed**. So the failure mode the function's own header promises — *"the rim
degrades from a roll to a cut over a few vertices"* — was not what the code did.
It degraded to 12 % and stopped, and 12 % is the worst place it could stop.

### 4.3 Because a quarter-round has ONE size, and this one had two

`inFrac` was per-vertex — it multiplies that vertex's own inset vector. `z` was a
per-**ring** constant. So a vertex at a fifth of the requested offset still
dropped the full `bevelZ`, and that is not a smaller bevel, it is a **cliff**:

```
band slope = atan( dz / (inFrac step × achieved inset) )
           = atan(0.00201 / 0.00750) = 15.0°   at full offset   (the design)
           = atan(0.00201 / 0.00090) = 65.9°   at the bottom rung
```

Which is exactly what the census reported: 64 mixed edges in the 65–70° bin, and
`mixed max 84.73` on a fixture that has no drawn corner anywhere. Feeding the
**same fraction to both axes** makes the slope invariant — `atan(f·dz /
(0.5·f·inset))` has no `f` in it — so a clamped vertex gets a smaller round of the
same shape and the rim narrows toward a cut continuously.

Two properties make that safe rather than merely nicer, and both are checks a
reader can re-run: **ring 0 is unmoved** (`1 − cos 0 = 0`, so the cap plane stays
planar and the cap triangulation is untouched), and **the wall's XY is unmoved**
(`inFrac = 0` at the widest ring, so the traced contour is exactly where it was).

### 4.4 And the flip repair was the same discontinuity one stage later

`OFFSET_FLIP_PASSES` × `dist *= 0.5` is a bisection with no idea when to stop: it
applies the same halving **regardless of how far the edge had actually
reversed**, so a vertex could land on 1/8 beside a neighbour on 1/1 — and three
passes could run out with the fold still there. Scaling both endpoints by a
common `s` moves the offset edge to `o + s·(v_j − v_i)`, so *"retain KEEP of the
original projected length"* is one linear equation:

```
(o + s·D)·o = KEEP·|o|²    ⇒    s = (KEEP − 1)·|o|² / (D·o)
```

`KEEP` is the one free parameter and it is bounded from both sides — too large
over-corrects a fold that barely happened, too small leaves the offset edge a
sliver whose band quad has a normal made of float noise. Swept:

| KEEP | 0.05 | 0.10 | 0.20 | 0.35 | 0.50 |
| --- | --- | --- | --- | --- | --- |
| `openArc/solid` mixed max | 75.49 | **69.86** | 71.24 | 73.22 | 75.11 |
| `square/solid` mixed max | 71.38 | **71.92** | 72.91 | 74.22 | 75.36 |

### 4.5 The numbers, and the frames that are the actual verdict

| | before | after |
| --- | --- | --- |
| `openArc/solid` mixed max | **84.73** | **69.86** |
| `openArc/solid` mixed edges past 45 | **120** | **3** |
| `openArc/solid` wall edges past 30 | 18 | 3 |
| `square/solid` mixed max | 84.24 | 71.92 |
| `square/solid` mixed edges past 45 | 45 | 28 |
| `square/solid` wall edges past 30 | 45 | 39 |
| `circle/solid`, `tick/solid` | max exactly 30.00 | **byte-identical** |
| `geometry-baseline`, 8 shapes × 4 modes | — | **vertex and triangle counts identical on all 32**; three Solid cases moved export bytes by 0 % |

`docs/verification/gloss-rim/rimfix/{before,after}/arc_solid_starved0_raking.png`
is the verdict and it is not subtle: before, the cream bevel band along the arc's
inner edge collapses to nothing at every starved vertex and the highlight runs as
a ragged saw-tooth; after, it is one continuous band with one continuous
highlight. `sq_solid_c2_high.png` is the other direction — the drawn corner is
indistinguishable before and after, which is what stops this from being a fix
that rounded the corners off. 1500 × 1552, real Chrome, Metal, glossy plastic,
two elevations per feature, A/B through the real app.

All three priors are parked and individually selectable —
`SOLID_TUNING.probeBlind = "onecell"`, `flipRepair = "halve"`,
`rimProfile = "flat"` — and with all three set the census reproduces the
pre-repair numbers **exactly**: 84.73 / 84.24 / 89.25 / 30.00 / 30.00.
`scripts/verify/_arm-prior-rim.mjs` is the preload that selects them, and it is
what re-recorded `assert-cap-fit`'s two moved pins as a measurement rather than
an assumption (with the priors, its old 226/59/69 and 54/17/41 come back and the
gate is ALL PASS).

---

## 5. Rod: a fix whose reason had expired, and a corner with no bead

`detectJoints3D` drops any joint candidate within 1.25 radii of the stroke's
endpoints. Its stated reason: a bead there "causes dot artifacts" — i.e. the end
**cap sphere** is already covering that region and a second sphere on top of it
is a lump.

That reason expired in explainer 19 §4b, which stopped emitting cap spheres on a
closed loop. Nothing covers the seam any more, and the exclusion still removed
its bead. Measured on `square/rod`, one stroke, four drawn 90° corners:
**three beads**. Corner 0 — the seam — had none, nearest bead **113 tube radii**
away. It was the only corner of the four carried by the chorded tube rather than
by the corner ball, and two of the three creases anywhere on that mesh's visible
surface sat there.

The scan also cannot reach index 0 at all (it runs `1 .. n−2`), so on a closed
loop the neighbours now wrap. `circle` is the control that says the fix did not
simply start stamping beads on loops: closed, smooth, and still **0**. Parked as
`ROD_TUNING.seamJoint = "none"`, and `assert-mode-rims` requires it to fire —
`square/rod` falls back to 3 and only that row fails.

---

## 6. The instrument: three rows that could not answer their own question

**`square/rod / cap-to-wall edge is rolled, not die-cut — mixed max < 75`.**
A tube has neither a cap nor a wall. The census buckets by `|n.z|`, and a tube's
normals sweep the whole circle, so `mixed` on Rod is a diagonal band of the ring
and its max is whatever the centreline did. What the centreline does at a drawn
90° corner is **fold** — `r·κ ≥ 1` there, explainer 19 §2 — so the flap turns back
*inside* the solid. Rod's solid is exactly the union of balls of radius
`TUBE_RADIUS` along the centreline, so a point is on its visible surface iff its
distance to the centreline is `r`: a closed-form test with no raster and no
threshold. Measured that way, of `square/rod`'s **84 creases past 30°, 81 lie
strictly inside the solid**, and the worst crease anywhere ON THE SURFACE is
**38.52°**. The 83.96 the row was failing on is interior geometry.
Replaced by the claim a tube can make — over 95 % of itself the only crease is
its own tessellation (`p95 ≤ 360/RADIAL_SEGMENTS + 2`) — plus the bead row above,
which is where Rod's corner claim actually belongs.

**`wall is not a facet ladder — over30/n < 0.05`** and **`the rim is not a chain
of cuts — over30/n < 0.35`.** Both denominators are a function of how CURVED the
shape is: a rim needs a vertex where it turns and none where it runs straight, so
a rectangle's wall bucket holds 600 edges where a circle of the same size holds
4032 — and the numerator is the corners, which are four either way.
`square/solid` failed at 39/600 = 6.5 % with every one of those 39 edges at one of
the band's eight corners, while `circle/solid` passed at 0/4032.

The second was worse, **and its own comment said so**: *"the Extrude bevel's own
three steps land at ~30.0, so the threshold is on creases past 45"* — and then it
counted `over30`. A 3-segment quarter round creases **exactly 30.00** at every
step by construction, so `over30` is a coin flip on float noise at the design
value. `circle/solid` reads `mixed max` 30.00 with **zero** edges past 45 and
still scores 1103/4032 = **27.4 % "over 30"** — 78 % of the way to a 35 % failure
bar, on a rim that is provably perfect. There was never any headroom.

The quantity that separates the two cases is not how many edges crease but **how
many PLACES do**. A drawn corner is a place: all its creases are one XY position
stacked through the ring table. A facet ladder is not a place: it is one crease
per contour vertex, all the way round. Shipped readings — `circle/solid` 0,
`tick/solid` 0, `openArc/solid` 1, `square/solid` 7 — separate by kind, not by a
percentage, and every entry is pinned two-sided so a rounded-away corner fails as
loudly as a spread one.

**Counting groups is not enough on its own, and the calibration caught that
before any row was believed.** With the bevel off, a rim creases at every contour
vertex, so the whole ring links into ONE group and the count comes back **2** — a
die-cut rim scoring "2 places" is precisely the shape of a metric that cannot
fail. So a group is only a place if it is LOCAL, and the two cases separate by a
factor of thirty rather than by a judgement: measured over every fixture and mode,
legitimate corners/seams/tips have a group diameter of **0.0–2.0** link
distances, `circle/extrude` with the bevel off reads **69.0 and 75.4**, and
`square/extrude` **59.4–85.8**. The row asserts places = ledger **and** runs = 0.

---

## 7. `dumpMeshes` hands out LOCAL positions, and Rod is the mode that moves

Found by the mirror-agreement row above, which exists so that no number is read
off a buffer that has not been shown to describe the drawing.

`__geomDebug.dumpMeshes()` reads each mesh's `position` attribute and rebases the
indices. The viewport instantiates every Rod cap and joint sphere as its own
`<mesh position={…}>` rather than baking the translation into the geometry — so
**every sphere lands on top of every other at the world origin**. Measured on
`square/rod`: **1156 of 4029 dumped vertices sit at exactly `TUBE_RADIUS` from the
origin**, which is exactly 4 beads × (RADIAL_SEGMENTS+1)² = 4 × 289. Four
coincident spheres piled in the middle of the square, none of them at the corner
it belongs to. That is why the mirror's wall bucket comes back 1682 where the
shipped per-mesh census reads 2978: the four piles weld.

**It is not only this file's problem.** `assert-fold-census` casts its rays
through the same dump and pins `square/rod` at 0/1/1/3 — measured against a mark
PLUS a pile of coincident spheres at the origin. And it is the exact mirror of
`assert-seam`'s recorded defect D1, where the NODE harness excluded the spheres
by construction: one harness leaves them out, the other puts them in the wrong
place.

`dumpMeshes` lives in `components/viewport-3d.tsx`, which this lane does not own,
so it is **reported, not fixed**. `assert-mode-rims` asserts the defect's exact
signature instead of skipping — a skip reads as a pass — so the day the transform
is applied that row fires and the PLACES rows turn on for Rod by themselves.
