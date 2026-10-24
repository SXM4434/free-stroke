# 19 — The elbow, and the instrument that could not see it

Explainer 17 fixed Inflate's rim and left one number open:

> `square/inflate` still reads `mixed max 89.6`, at its four drawn 90-degree
> corners. […] Clipping is re-topologising, which a loft cannot do; it is what
> the implicit path is for.

That paragraph turned out to be right about the cause and wrong about the shape
of the answer, and the difference matters. The corner is not a *hard crease that
wants filleting*. **The loft passes through itself there** — and the census that
was being used to judge it is structurally incapable of saying so.

So this pass has two halves, and the second is the more valuable one:

1. **The elbow is fixed**, by routing the drawing to the surface that can
   represent it, on a predicate that is exact rather than heuristic.
2. **The instrument that missed it is fixed**, with the synthetic fold it now
   fails on — and two further defects it found on its first run, which are
   named, located and pinned rather than filed.

---

## 1. The verdict, first

**FIXED.** On `square/inflate`, at the four drawn corners:

| | loft (before) | auto → field (after) |
| --- | --- | --- |
| rays crossing more than two sheets, per corner (81², window 3.2 r) | **720 / 6 / 6 / 8** | **0 / 0 / 0 / 0** |
| max sheets crossed | **4 / 8 / 6 / 8** | **2 / 2 / 2 / 2** |
| census `mixed max` | 89.64 | 47.75 |
| census `wall max` | 89.47 | 43.54 |
| ρ_out / r — *does the drawn corner survive* | 0.351 / 1.003 / 1.031 / 1.000 | 0.360 / **1.030 / 1.034 / 1.023** |
| outer fillet / r — *is it the corner ball* | 2.13 / 1.53 / 1.52 / 0.84 | 2.31 / **1.36 / 1.53 / 1.41** |
| boundary / non-manifold / degenerate edges | 0 / 0 / 0 | 0 / 0 / 0 |
| build | 2.5 ms | 118 ms |

**Both directions, which is the part a one-sided gate would have got wrong.** A
fix that rounded the square's corners away would have driven the crease number
down just as far and would have been a worse regression than the defect. So the
assertion is two-sided: the fold must go to zero **and** ρ_out must stay at or
above 1 r. It does — 1.023 to 1.034, up from 1.000 to 1.031. The corners are
still corners; they are simply no longer corners *made out of a surface that
crosses itself*.

The frames are the actual verdict, and they are not subtle:
`docs/verification/elbow/run3/frames/{loft,auto}_c1_{high,raking}.png`. On the
loft the elbow is a faceted wedge with a black seam running diagonally across it
and a sliver of the second shell poking through the specular; on the routed
surface it is one continuous rolled knee with one continuous highlight. Twelve
frames per case, four corners × three camera elevations, glossy plastic, Metal.

Corner 0 reads ρ_out 0.36 in **both** columns. That is not the elbow and it is
not a regression — it is the taper seam, and §6 is about it.

---

## 2. What was actually wrong: `r·κ < 1` was never checked

A swept tube — the canal surface explainer 17 built — is a smooth **embedded**
surface if and only if two conditions hold:

```
|r′| < 1      the chain does not swallow its own balls
r·κ  < 1      the centreline does not turn tighter than its own radius
```

Explainer 17 established the first *by construction*: `inflateBuildBallChain`
prunes any ball contained in a neighbour, after which `|Δr| < |Δc|` holds between
every surviving pair by definition. That is a theorem about the pruned chain, not
a clamp.

**The second was never checked anywhere.** And a mark that turns inside its own
radius does not merely crease — the ring sweep drives its inner column backwards,
so the strip folds back through the surface. No ring density removes it, because
`r·κ` does not depend on sampling. `mixed max 89.6` was not a hard corner. It was
a fold, reading as a corner.

The test is written as the **exact discrete predicate on the rings the sweep
actually emits**, not as a continuous `r·κ` proxy, because a polyline's discrete
curvature depends on how the corner happened to be resampled. Between two
consecutive rings turning by `Δθ` over a centre advance `h`, each ring's
innermost point sits at `∓sin(Δθ/2)` along the chord, so the inner column
advances by

```
h − (rᵢ + rᵢ₊₁)·sin(Δθ/2)
```

and the strip folds back exactly when that is negative. Reported as a **depth**
in world units and normalised by the local radius, because "how far does the
surface reach back inside itself" is what decides whether the fold is visible or
is below one facet. `inflateChainFoldMetric`, `lib/geometry-engines.ts:5645`.

On `square`: **8 folding ring pairs, max depth 0.158 r.** On the control — a
smooth arc whose curvature radius is far above the tube radius — **0 pairs, depth
−0.268 r**, i.e. clear of the condition by a quarter of a radius.

### The routing

`fusion` gains `"auto"`, and it is the default: sweep the loft where the loft is
**provably** valid, polygonise the field where it is not.

```
wantImplicit = fusion === "implicit" || (fusion === "auto" && loftFoldingPairs > 0)
```

Three things make this a rule rather than a preference:

- **It is a theorem, not a threshold.** There is no tuned constant. `depth > 0`
  is the exact statement that the ring sweep is not injective.
- **It fires on the control in the right direction.** A routing rule that sends
  everything to the field is not a rule. The circle stays on the loft at 3 ms;
  the square goes to the field at 118 ms. Both are asserted, in both directions
  (`ROUTE-3` and `ROUTE-7`).
- **The panel cannot claim a strategy that did not run.** `fusionRequested` and
  `fusionUsed` are separate fields in `INFLATE_DEBUG`, and every assertion reads
  `fusionUsed`.

`"loft"` and `"implicit"` both remain selectable and unchanged — nothing was
removed, and a user who wants the old surface still has it by name.

### The old default's reason had already expired

The default was `"loft"` on the grounds that implicit "rebuilds every frame
during the draw-in reveal". That stopped being true in explainer 18: the reveal
is a `setDrawRange` over a build-time triangle ordering and rebuilds nothing, so
the entire cost is one build per stroke change. The comment had outlived the
thing it described, which is worth recording as its own species of defect.

---

## 3. Why the crease census could not settle this, in two independent ways

`probeDihedral` reports the angle between **adjacent triangles**. That fails here
twice over, and the two failures want different fixes.

**First: the reading is density-dependent.** A corner turns the surface by a
fixed total amount however it is expressed, so a per-edge number is really *total
turn ÷ how many edges it was spread over*. Marching cubes at r5 emits about two
edges across a 90-degree crease; 90/2 = 45, which is the ~48 the field reads. So
"the number fell from 89.6 to 47.8" is **equally consistent** with *the field
fillets the elbow* and with *the field has the identical hard crease, tessellated
finer* — and those have opposite consequences. Any verdict resting on that number
alone is a coin flip with a decimal point.

**Second, and worse: it is structurally blind to a fold.** The census scores a
shared edge as

```
min( acos(n0·n1), acos(−n0·n1) )
```

which is bounded by 90 and is **smallest when the two faces are antiparallel** —
exactly the configuration a fold produces. A flap turned back through itself
reads as a *small* crease. This is not a threshold that needs retuning; the
quantity itself throws the information away. Explainer 17 §2 records what it
cost once already: the extrude seam flap was invisible to every number the census
reports and obvious in one frame, and it was found by eye.

### The negative control, in closed form

`syntheticFoldTube` (`scripts/verify/lib/elbow-geom.mjs`) builds a tube the way
the loft builds one — rings square across the tangent — around a 90-degree corner
at a chosen centre spacing. With a constant radius the engine's own predicate
reduces to `2r·sin(22.5°) = 0.7654 r > h`, so **the spacing decides the answer in
closed form**. Two meshes, identical in every other respect including their end
caps:

| | fold depth | fold rays | crease `wall max` | crease `mixed max` |
| --- | --- | --- | --- | --- |
| spacing 0.5 r — **folded** | **+0.2654 r** | **124**, up to 6 depths | 64.38 | 90.00 |
| spacing 1.5 r — clean twin | −0.7346 r | **0** | 74.62 | 81.03 |

**The crease census moves by −10.2° on `wall` and +9.0° on `mixed`** between a
mesh that folds through itself and one that does not — less than one bevel step,
and on `wall` in the *wrong direction*. It is not merely insensitive; on that
bucket the response is inverted. That row is now asserted (`CAL-3`), so if the
census ever does become fold-aware the witness fails and gets read rather than
silently drifting.

And on the real thing, which is the point: on `square/inflate` at
`fusion: "loft"` the census reports **boundary 0, non-manifold 0, degenerate 0** —
every structural number says the shell is clean — while the predicate reports 8
folding ring pairs and the ray census finds 24 rays crossing up to 6 distinct
depths. A folded shell that passes every existing structural gate.

### The fix: a different question, asked of the same buffers

Not a better threshold — a second instrument. How many sheets does a −Z ray
cross?

```
a closed embedded shell     every ray hits 0 or 2
a folded shell              rays over the fold hit 4, 6, ...
```

Four details are load-bearing, and each one is a defect avoided:

- **Per connected component.** A fold is one shell passing through *itself*. Two
  crossing strokes in Rod / Extrude / Inflate-loft are two shells passing through
  *each other*, which is documented behaviour of those modes. A whole-drawing
  count cannot tell them apart and would have fired on `crossing` in three modes
  on day one — and a gate that cries wolf gets switched off, which is how a real
  fold would then ship. `dumpMeshes` concatenates with indices rebased, so the
  components are recovered in Node by union-find over the index buffer.
- **Distinct depths, not hit counts.** See §4 — this is what separates a fold
  from a cap plane covered twice.
- **Silhouette triangles are dropped.** A triangle whose plane contains the ray
  projects to a sliver; the ray lies *in* its plane, so counting it is float
  noise. A swept tube is full of them — every ring plane contains Z.
- **The origins are jittered by an irrational fraction** so a ray cannot land on
  a shared edge, where both triangles contain it and a clean mesh reports 4.

The census is calibrated in both directions before any row is believed: it must
fire on the synthetic fold, stay silent on its clean twin, agree with the shipped
`probeDihedral` when mirrored onto the real buffers (mixed 67.39 vs 67.39, wall
90.00 vs 90.00, 1360 triangles either way), and fire on the real known-bad.

---

## 4. What the new census found that is NOT the elbow

It fired on six of sixteen fixture/mode rows on its first run. **A new instrument
that immediately finds six new defects is the exact shape of an instrument with a
false-positive mode**, so every flagged ray was opened up and classified by
mechanism before any of it was called a defect
(`scripts/verify/_probe-fold-truth.mjs`, evidence in
`docs/verification/fold-census/truth2/`). None were false positives, and they are
not one defect — they are two, neither of them this pass's:

**A · The closed-loop seam (Rod, Inflate).** A stroke that returns to its own
start gets an end cap at the last sample and another at the first, sweeping about
the same point, so the two caps interpenetrate. This is the *same* defect
explainer 17 §2 fixed for Extrude — "a closed loop built with two overlapping
caps" — and Rod and Inflate never got the treatment. Located, not inferred:
`circle/inflate` fires at [1.203, 0.137] and the circle fixture's seam is at
[1.216, 0.153]; the hits are at four distinct depths (0.0576 / 0.0213 / −0.0213 /
−0.0576) with `|n.z|` 0.75 / 0.31 / 0.31 / 0.75 — two dome surfaces crossing.
13 rays. `square/rod` fires at [−0.269, 0.824]; the square's first corner is
[−0.281, 0.827]. 1 ray.

**B · The rim assembly overlapping itself (Solid, Extrude).** The extra hits are
the cap plane (`|n.z|` = 1) plus a **bevel ring** (`|n.z|` = 0.96593 = cos 15°,
one step of a 3-segment quarter round) 0.9 % of the depth below it — the cap and
the first bevel ring cover the same plan region. On `square/extrude` three bevel
rings are crossed at one mitred corner (`|n.z|` 0.966 / 0.966 / 0.707), which is
the inner offset folding over itself. Counts: `circle/solid` 53, `square/solid` 4,
`crossing/solid` 1, `square/extrude` 5.

**Class A is now FIXED** (§4b). Class B is diagnosed to one call and not fixed
(§7). Both were **pinned to their measured counts** in a `KNOWN_OPEN` ledger
first, because "measured and ungated" is exactly how *every Extrude mesh has 8–12
boundary edges* sat unread for a whole cycle (explainer 17 §2b). A new fold
anywhere fails. A row getting worse fails. A row getting *better* also fails,
loudly — which is how the ledger got updated when class A closed rather than
quietly over-permitting for the next reader.

---

## 4b. Class A, closed: a mark that comes back to its start has no ends

Extrude learned this in explainer 17 §2. Rod and Inflate had not. The fix is the
same shape in both, and the closure predicate is **ported, not re-derived** —
`inflateChainIsClosed` carries Extrude's own constants (gap ≤ 0.75 half-widths,
arc ≥ 4 half-widths) so one drawing cannot be a loop in one mode and not in
another.

| | before (`capped`) | after (`wrapped`) |
| --- | --- | --- |
| `circle/inflate` fold rays | **13** | **0** |
| `square/rod` fold rays | **1** | **0** |
| Rod cap spheres at a closed seam | 2, centres **0.50–0.70 r** apart | **0** |
| `square/inflate` seam corner ρ_out | **0.360** | **0.992** |
| …the other three corners | 1.0297 / 1.0338 / 1.0230 | **unchanged to 1e-6** |
| loop width uniformity (72 angular bins) | 0.43 % | **0.06 %** |
| `openArc`, `tick`, `crossing` | — | **byte-identical, both engines** |

Three things this took that the first attempt did not have:

- **The wrap pair is a ring pair.** `inflateChainFoldMetric` now tests the
  last→first join like any other, or the fix would have created the one seam its
  own gate could not see.
- **The seam must not be fed by a stub.** Porting only the *closure* half took
  `square/rod` from 1 fold ray to **3, at up to 6 sheets, all still within
  0.4–1.0 tube radii of the seam corner**. `processStroke` pins endpoints, so a
  closed square's polyline ends on a 1.87 px remainder, and a swept body cannot
  turn a corner inside one short step. Extrude's `dropSeamStub` rule — drop
  trailing samples while the closing chord is under half a median step — is now
  shared by all three engines. The closure was right and incomplete, which is the
  same trap explainer 17 §2 hit: the census went clean and the picture did not.
- **The crossing bulge had to learn the loop is one body.** With the linear
  index test, a wrapped `circle` came out **+22 % fat at the seam** — the bulge
  was scoring the seam as a self-crossing. Cyclic separation, with the same
  "~3 radii of arc is one piece" threshold the implicit path's `runGap` uses.
  Without that, the fix would have swapped a self-intersection for a visible
  bulge.

**The look change, because this half is not a defect and is Sebs's call.** On
`capped` a closed mark thins to `INFLATE_TIP_FRACTION` — 0.159 of full radius —
where the pen started and stopped, so a closed square read with three sharp
corners and one pinched, rounded-off one. On `wrapped` it is full width the whole
way round and the fourth corner is a corner like the others. The argument for
`capped` is that a real pen does leave a lift mark; the argument against is that
it was being applied to a mark the drawing says is closed, and that it was
delivered by two interpenetrating domes rather than by a taper anyone designed.
Both are parked and selectable: `__styleHarness.setInflate({ loopEnds: "capped" })`
and `__rodTuning.loopEnds = "capped"`.

**And the other direction is asserted, not assumed.** An open arc whose ends come
near each other is byte-identical under both settings; an open stroke still
tapers to exactly the same 0.8453 end/mid half-width it did before. A fix that
flattened a genuine taper would be a worse regression than the defect it
removed.

---

## 5. Two instruments that were reporting numbers, and one that was measuring nothing

### The 620-degree turn

The first version of the corner probe reported a **620-degree turn** on a
synthetic whose fillet is zero by construction. That claim was inherited from a
lane that died, and a citation is not evidence — so the old method was rebuilt
from its description and re-run
(`scripts/verify/_probe-elbow-turnwidth.mjs`):

```
   q/r    OLD turn(deg)   OLD fillet/r    rho_max/r   rho<0 samples   NEW fillet/r
   0.00     619.6875       0.9454           3.17          134           0.0000
   0.10     619.6875       0.9405           3.17          134           0.1000
   0.25     619.6875       0.9330           3.17          134           0.2489
   0.50     619.6875       0.9206           3.17          134           0.4955
```

**Identical to four decimal places while the thing being measured moves by half a
tube radius.** The whole reading spread is 0.0000° of turn and 0.0248 r of
fillet, against a 0.5 r input change. An instrument whose reading does not move
when its subject moves is measuring nothing.

**The broken formula, named: a polar window about the corner with a FIXED launch
radius.** The armpit of a 90-degree elbow is bounded by two walls *parallel to
the legs*, so about the corner

```
ρ(φ) = √2·r / (cos φ ∓ sin φ)
```

which is 1.414 r on the bisector and **diverges as φ → ±45°**: 2.79 r at 24°,
3.86 r at 30°, 11.47 r at 40°. The probe launched from a fixed 3.2 r, so past
|φ| ≈ 24° **the launch point is inside the solid**, the "first surface met coming
inward" is a wall on the far side of the corner, and `start − t` goes negative —
134 of 401 samples. The reconstructed contour then teleports across the corner
and back, twice per window.

Bisecting the window proves it, rather than asserting it:

```
   span(deg)   turn(deg)   rho<0
       40        619.69      134
       30        599.06       44
       24         90.00        0      <- exactly the true answer
       20         90.00        0
       10         90.00        0
```

At 24° — the first span that stays outside the divergence — the same code returns
**exactly 90.00**, the correct answer. All 529.69° of artefact is the polar frame.
**And that corrects the inherited diagnosis**, which blamed unsigned `acos`
accumulation as a co-cause: on an exact synthetic the straight walls contribute
zero, measured at 0.00° on a straight strip with the identical window. Unsigned
turning is still wrong — on a real facetted mesh its error can only ever be
positive — but it is not what produced the 620.

The replacement reads the profile as a graph over the axis **perpendicular to the
bisector**, from a straight launch line, provably outside the solid: single-valued
by construction, with no divergence to walk off. It recovers 0.10 → 0.1000,
0.25 → 0.2489, 0.50 → 0.4955.

### `capRoundness`, `blend`, and names that match behaviour

Two dials were reporting things they did not do; explainer 17 removed the first.
The second is `blend`, and nobody had measured it.

---

## 6. What `blend` actually does — established on numbers, then found in the source

**The dial:** `blendK = blend × radiusXY` (`geometry-engines.ts:6261`), and the
field's own scale is `baseRadius = radiusXY × bulgeScale` (`:6316`), so in units
of the radius the field is built at,

```
k / r_field = blend / bulgeScale = 0.8395 × blend      (at the default Puff)
```

**It acts BETWEEN RUNS ONLY, and that is not a detail — it is the reason blend
cannot soften a drawn corner.** §2b of `lib/implicit-surface.ts` hard-mins a
stroke's own consecutive capsules, because smin-folding ten overlapping samples
inflates every stroke by roughly `k/2` for reasons of sampling rather than shape.
A *run* is a maximal span of one stroke whose sample orders are within
`runGap = max(4, ceil(3·radiusXY / sampleSpacing))` (`:6268`) — about three radii
of arc. Two legs meeting at a drawn corner are consecutive samples of one stroke,
so they are one run, so they hard-min, so **k does nothing there**.

Measured on `square`, and the square carries its own control: corner 0 is the
seam, where the stroke's end meets its own start — orders ~120 apart, far beyond
`runGap`, therefore two runs.

| | corner 1 | corner 2 | corner 3 | corner 0 (the seam) |
| --- | --- | --- | --- | --- |
| ρ_in/(√2 r) at b = 0 vs b = 1 | **0.00000** | **0.00000** | 0.00178 | **0.08582** |

Three drawn corners agree to four decimals across the dial's entire range; the
seam moves by 0.086. **That is the control that proves the dial is alive** — a
"blend does nothing" result with no case where it does something is
indistinguishable from a dead dial.

And where it acts, it acts by exactly the predicted amount. At an armpit the two
walls are equidistant, so `smin = min − k/6`, and the isosurface sits at
`ρ = √2·(r + k/6)`:

| | k/r | predicted ρ_in/(√2 r) | measured |
| --- | --- | --- | --- |
| b = 0.55 | 0.4617 | 1.0770 | **1.0779** |
| b = 1.00 | 0.8395 | 1.1399 | **1.1322** |

**The trap, stated as a number.** At `k = 0` the armpit is a hard crease *by
construction* (the union of two cylinders) and the field still reports an
apparent fillet — of **0.62 / 0.76 / 0.91 marching-cubes cells** (cell = 0.2 r).
That is the resolution floor, not a shape. It is precisely the reading that would
have been mistaken for "the implicit path fillets the elbow", and it is the third
reason the crease census could not settle this.

---

## 7. What is NOT done, and why it is a decision rather than an omission

**Class B — the rim assembly overlapping itself — is diagnosed to one call and
NOT fixed.** It is localised, not hand-waved: with the bevel off, every Solid
fixture reads **0 fold rays and 0 coplanar rays**; with it on, only the fixtures
that have a HOLE fire (`tick`, the sole hole-free fixture, reads 0 either way).
The offending cap triangles have all three vertices ON the band (radii 0.757 /
0.808 / 0.809 against a band of 0.741–0.828) but span 45 degrees of arc — a chord
of ~0.6 world units across a band 0.087 wide, i.e. straight over the hole. So it
is the cap RE-TRIANGULATION the bevel path switches on, not the bevel band and
not the inset offsets.

**Three candidate causes were tested and eliminated by measurement**, which is
the part worth keeping:

1. *The two opposing insets crossing.* The band is 0.0868 against 2 × bevelXY =
   0.030, so they cannot meet. A half-thickness probe rule was implemented,
   measured to change nothing on any fixture, and **reverted** — keeping it would
   have shipped an unexercised guard, which is a green row that cannot fail.
2. *A duplicated end point shifting the index space.* Measured: outer 248 points,
   hole 256, no duplicate ends, 504 triangles for 504 points — exactly
   `n + 2h − 2`, so structurally correct.
3. *Unnormalised winding.* `ShapeGeometry` forces outer CCW and holes CW before
   triangulating and this call does not — but measured, the loops are **already**
   correctly wound (outer +2.1187, hole −1.7304). Normalising is also not free to
   add blindly: reversing a loop here invalidates the `[shapePts, …orderedHoles]`
   index space the cap is mapped through.

The remaining candidate is earcut's own intersection-curing fallback, which is
permitted to emit overlapping triangles, on a 504-vertex thin annulus. The fix is
to make the bevel path reuse H2's triangulation with an index map — which is what
that block's own comment already claims happens — instead of recomputing. It is
**not visible** (two coplanar triangles with the same normal render as one, and
the bevel ring beneath them is hidden), but the shell is not a valid solid for
export or boolean use. Pinned at its exact count so it cannot get worse.

**Non-manifold edges on the implicit path: measured properly, and my earlier
framing of it was wrong.** It is not a `blend 0.55 × resolution 5/7` interaction.
Swept over 8 resolutions × 3 blends on `square/inflate`:

```
res 3   blend 0 -> 79    blend 0.55 -> 0     blend 1 -> 79
res 4   blend 0 -> 6     blend 0.55 -> 0     blend 1 -> 2
res 4.5 blend 0 -> 0     blend 0.55 -> 2     blend 1 -> 0
res 5   blend 0 -> 0     blend 0.55 -> 9     blend 1 -> 0
res 5.5 blend 0 -> 0     blend 0.55 -> 4     blend 1 -> 0
res 6   blend 0 -> 6     blend 0.55 -> 2     blend 1 -> 4
res 7   blend 0 -> 16    blend 0.55 -> 8     blend 1 -> 16
res 8   blend 0 -> 20    blend 0.55 -> 8     blend 1 -> 16
```

No monotone dependence on either dial — the worst row is the LOWEST resolution.
Boundary edges are 0 and degenerate triangles are 0 everywhere, so the surface is
closed; a handful of edges are shared by more than two faces. That is the
signature of the **standard marching-cubes ambiguous-configuration case**:
whether a cell hits one depends on where the isosurface falls relative to the
grid, which shifts arbitrarily with cell size and with k. The fix is a
topologically-correct MC variant or a dual method — a polygoniser replacement,
not a tweak — and the shipped default reads 0. Verdict: **out of scope, on
evidence, and the dial-specific story it was filed under was wrong.**

---

## 8. Cost, and the honest bit about the regression net

`assert-elbow.mjs`: **ALL PASS** — 7 closed-form calibrations including two
known-bad outer joins (a miter spike at ρ_out 1.414 and a corner rounded away at
0.586), the ray caster calibrated on every case, 8 routing assertions, 5 blend
assertions, and the smooth-arc control.

`assert-fold-census.mjs`: **ALL PASS** — 6 calibrations, 16 fixture/mode rows,
deterministic across three consecutive runs.

Typecheck: **51 errors, the same 51 as the baseline**, all pre-existing.

**A measurement this pass discarded rather than adjusted.** Two
`geometry-baseline --save` runs reported *GEOMETRY DIED* on six of thirty-two
cases — `nearTouch/{extrude,solid,inflate}` and `zigzag/{extrude,solid,inflate}`
at verts 0 — while `exportBytes` stayed byte-identical to the previous baseline on
five of the six. Geometry that has died does not export the same bytes. The cause
was a **sibling lane saving `components/viewport-3d.tsx` at 11:52:14 and
`lib/hero-motion.ts` at 11:53:05, inside the run's window**: every harness here
drives one shared Next dev server, and a save fast-refreshes the 3-D scene
mid-capture. Both runs are discarded, not adjusted, and
`scripts/verify/_run-clean.mjs` now stamps the mtimes of every file this lane does
not own before and after a run and fails it if any moved — so that class of
poisoned evidence announces itself instead of becoming a checkpoint.

---

## 9. Corrections and closures — 2026-07-31, later the same day

Appended rather than edited in place. Everything above stands as it was written;
these are the four things a later pass measured that change what a reader should
believe.

### 9.1 Class B is CLOSED, and §7's proposed fix was a no-op

§7 left "the rim assembly overlapping itself" diagnosed and not fixed, with the
remaining candidate named as *earcut's intersection-curing fallback*, to be fixed
by *reusing H2's triangulation with an index map — which is what that block's own
comment already claims happens.*

**The comment was TRUE.** `buildMaskSolid`'s H3 block reuses H2's index buffer
through `toFront`/`toBack` (`lib/solid-mask.ts:2446` — "Reuses the H2
triangulated cap as the +Z front face"), and the recompute it does under the
bevel is handed the SAME argument objects H2 was handed. Measured by intercepting
`ShapeUtils.triangulateShape` for one build (`_probe-h2-index-reuse.mjs`), on the
two fixtures that carry a hole:

```
capFit "source"   same ARG OBJECTS true   outer positions identical   index buffers identical
                  circle  0 of 1512 indices differ      square  0 of 255 differ
capFit "inset"    same ARG OBJECTS false  max vertex move 0.01503 (= bevelXY)
                  circle  812 of 1512 differ            square  239 of 255 differ
```

So the proposed fix would have changed nothing. The real defect was one step
earlier: the cap was **triangulated on the source contour and drawn at the
contour inset by the bevel**, and the inward offset narrows the outline
underneath a chord earcut was entitled to emit. It is fixed by triangulating the
loops the cap is actually drawn at (`SOLID_TUNING.capFit`), and `assert-cap-fit.mjs`
gates it with the parked `"source"` behaviour as the negative control — which
still reproduces the recorded defect exactly (198/228/14/37/0 overlapping cap
pairs, 53/59/4/1/0 fold rays).

Both directions, on every fixture: vertex positions byte-identical (0 of 12096
floats differ on `circle`), triangle and cap-triangle counts unchanged, silhouette
bounds unchanged, hole topology unchanged, and the bevel's own signature identical
(`circle` cap mean 3.84 max 15, wall 4.27/15, mixed 15.25/30). `closedO` keeps its
through-hole and `openArc`/`openC` stay open in all four modes under BOTH cap-fit
settings, measured as a per-component Euler characteristic (0 = torus, 2 = sphere).

**And §7's "hole" story was wrong.** `openArc/solid` (59 rays) and `crossing/solid`
(1) have no hole at all — measured: their caps come back `n − 2` triangles for `n`
points, and `triangulateShape` is never called with a hole for either.

### 9.2 `square/extrude` — the same limit the loft hit, one parametrisation over

The one row still open, and it is now proven rather than asserted. Asked without
any ray casting — do the ribbon's TOP-face triangles overlap each other?
(`_probe-extrude-topface.mjs`)

```
square/extrude   chamfer off   288 overlapping pairs   per corner 29 / 85 / 85 / 89
square/extrude   chamfer on    182                     per corner 18 / 53 / 53 / 58
circle/extrude   either          0        tick/extrude either   0
```

The double cover is there with the chamfer OFF and the chamfer REDUCES it, so the
chamfer is not the cause; it sits at all four corners and nowhere else; and the two
corner-free fixtures read 0, which is the control. The mechanism is closed form: a
mitred join's shared vertex has its foot `halfWidth·tan(turn/2)` back along each
leg, and the strip folds when that exceeds the adjacent step — measured in
half-widths, back-travel 1.000 / 0.478 / 0.464 / 0.415 against steps 0.4275 /
0.4056 / 0.3903 / 0.3965. Negative at all four.

No clamp closes it. At 45–51° per sample the miter ratio is 1.08–1.11, an order of
magnitude inside `RIBBON_MITER_COS_MIN`, so the limit never engages — and that
constant's own comment already says why clamping would not help: *"Clamping the
magnitude while keeping ONE shared offset vertex is not a join at all."* The
spec-correct response is to CONVERT the join, which this builder does past the
limit; an inner overshoot needs it converted on ONE SIDE ONLY, i.e. two inner
vertices where the strip has one. That is a variable-arity strip — re-topologising
`buildContinuousRibbonStripGeometry`, which the chamfer rows, the closure, the
caps, the T-junction fix and the draft taper all index uniformly — and it removes a
sliver at the inner corner of **every join in every letterform**. Same limit as the
elbow, same answer: the mark would have to be built as the boolean union of its
segment rectangles, which is what the Solid path already does. **A look decision
for Sebs, not a repair.**

### 9.3 §8's "assert-elbow: ALL PASS" was stale by the time it was written

§4b changed the seam from a 0.159 r tip to a full-width corner, and §6's blend
table was taken on the seam BEFORE that. Re-measured in plain Node, corner 0 at r5:

```
loopEnds   b=0      b=0.55   b=1.00
capped     1.0464   1.0779   1.1322     <- §6's table, to four decimals
wrapped    1.0748   1.0958   1.1466     <- what ships
```

The three drawn corners are unchanged across that pair, which is the control that
says only the seam moved — and at b=0 the seam now reads the same as they do
(1.0748 against 1.0732/1.0786/1.0907), i.e. it has become a corner like the others.
So the geometry is right and `BLEND-3` was calibrated on a build that no longer
ships; it failed at b=0.55 by 0.0038.

**The tolerance was also under the instrument's own floor.** `BLEND-1` proves k
cannot reach a drawn corner, so the continuum value there is exactly 1 at every
blend — and the field reads 1.073–1.091. That excess is the marching-cubes floor,
in the same units, four to six times the 0.015 being demanded of the seam, and
sweeping r4–r8 it does not decay monotonically (0.0596 / 0.0748 / 0.0348 / 0.0517 /
0.0397 at k=0): the ambiguous-cell phase, exactly as §7 records for the
non-manifold sweep. The row is now three: never below the closed form, never above
it by more than the floor the same run measures, and — at b=1.00, where the
prediction clears the floor — the original tight 0.015, unchanged. With a negative
control on the same predicate that rejects a dead, a half-strength and a doubled
dial.

### 9.4 `assert-taper-envelope.mjs` was an `assert-` script that asserted nothing

No `check` in the file. It printed its table, printed a verdict, and exited 0
whichever way the numbers went — and had been printing `NOT CONFIRMED` for a whole
cycle with nothing reading it. The reading is the right one and it is a fix
landing: `stroke-width-models.md` §3.2 predicted the two fusion modes would
disagree by ~18% through the taper because the loft placed rings perpendicular to
the tangent, and explainer 17 §1 rebuilt the loft AS the canal surface, so the
predicted parity break is closed — measured 0.981, worst station 1 px of 39/40.
It is gated now, in pixels (the unit the alpha profile actually reads), with the
pre-canal-surface radial construction as the negative control: mean predicted
ratio 2.130, rejected.
