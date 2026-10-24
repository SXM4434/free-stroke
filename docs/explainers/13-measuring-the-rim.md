# 13 — Measuring the rim: three instruments that could not fail

Explainer 11 judged Extrude and Solid on gloss and found the guard bug. It also
recorded two numbers that turned out not to mean what they said, and a directory
of frames that turned out to contain nothing. This is the pass that checked the
instruments.

The conclusion is uncomfortable and worth stating first: **every one of the three
measurement failures below produced a confident, plausible, wrong answer rather
than an error.** None of them threw. None of them logged. Two of them wrote files
into `docs/verification/` that a reader would reasonably treat as evidence.

---

## 1. `rimTurnMeanDeg` was derived for one emission order and read under another

`__geomDebug.probeNormals` walks the index buffer and treats *consecutive
triangles* as *adjacent along the rim*, differencing their face angles:

```
for (let t = 0; t < idx.count / 3; t++) { … faceTurns.push(ang - prevAng) }
```

For Solid that assumption holds — `buildLoopWalls` emits the wall in contour
order, so triangle *t+1* really is the neighbour of triangle *t*.

For Extrude it does not. The ribbon is a strip with two opposite side walls, and
the builder interleaves them, so consecutive index triples alternate between the
left wall and the right wall of the same segment — surfaces that face
approximately opposite directions. The metric duly reported:

| fixture | `rimTurnMeanDeg` | `alternation` | sample |
| --- | --- | --- | --- |
| word/extrude | 171.19 | 0.323 | `180, -180, 180, 180, …` |
| circle/extrude | 178.01 | 0.622 | `180, 180, 180, -180, …` |
| square/extrude | 170.53 | 0.803 | `-180, 180, -180, 180, …` |
| crossing/extrude | 176.37 | 0.750 | `-180, 180, -180, 180, …` |

A perfect alternating comb at 180°, on all four fixtures, including the *circle* —
which renders as a clean ring. Read at face value this says the Extrude rim is the
most catastrophically faceted surface in the project. It says nothing at all. It is
a number correct in the frame where it was derived, consumed in a frame that no
longer holds — the same shape as every other bug this codebase keeps producing,
except that here the consumer is the instrument.

## 2. `maxRimSplitDeg` cannot fire on a shared-vertex mesh

The other half of `probeNormals` groups vertices by identical position and
measures how far apart their normals are. That detects a seam only if the seam
vertices are *duplicated*. The Extrude ribbon is a shared-vertex strip:
`duplicationFactor` is 1.00, so `groups.size === pos.count`, every group has one
member, the `list.length < 2` guard skips all of them, and `splitGroups` is 0.

So on Extrude the probe reported `maxRimSplitDeg: 0` — a *perfect* surface — for
the same geometry the other metric reported as a 180° comb. Two metrics, opposite
verdicts, both wrong, no warning. A metric that is structurally incapable of
firing reads exactly like a metric that is firing and finding nothing.

## 3. The close-up frames were blank, and the bug was in the loop header

`verify-gloss-rim.mjs` ended each unit with three rim close-ups. They were written,
committed, and are all byte-identical pure white — including across *different
fixtures*, which is the tell: `word_solid/closeup_0.png` and
`crossing_solid/closeup_1.png` have the same MD5.

```js
for (const [k, [az, el, fill]] of [
  [0, [18, 10, 0.26]],
  [1, [40, 26, 0.26]],
  [2, [8,  48, 0.26]],
].entries()) {
```

The rows already lead with their own index. `.entries()` adds a second one. So the
destructure resolved to `k = 0`, `az = 0`, `el = [18, 10, 0.26]`, `fill =
undefined` — the elevation was an *array* and the fill was `undefined`, the camera
position went `NaN`, and `orbitView` returned `true` regardless because its only
guards are on `controls` and `bounds`. Every subsequent frame in the file name
sequence looked right.

Two things made this survivable-looking for a whole session:

- **The file names were correct.** `k` was the only variable that came out right,
  and `k` is what names the file. A directory of correctly-named blank frames is
  indistinguishable at a glance from a directory of frames.
- **The comment above it was a confident, and false, explanation of why the
  approach was necessary**: *"`focusView` would be the right tool but it needs a
  world-space target, and the harness exposes bbox SIZE without a centre — an
  invented target lands the camera in empty space and writes blank frames that
  look like evidence."* Every clause of that is true. It is also not what
  happened. The blank frames came from the workaround, not from the thing the
  workaround avoided, and the comment made the blanks look expected.

---

## 4. What replaced them

**`__captureHarness.bounds()`** returns the form's world centre and radius. That
was the missing accessor the comment correctly identified; with it, `focusView`
has a legitimate target and close-ups can be framed as fractions of the form's own
radius, so the same call frames a word and a circle equally tightly. Verified
directly: at focus distances of 1.0R through 0.15R the capture canvas carries
91008, 58565, 67624, 38665 and 9191 ink pixels — real geometry at every rung.

**`grab(file, { requireInk: true })`** counts non-transparent pixels *before* it
writes the PNG and throws if the frame is empty. The first version of this guard
read `document.querySelector("canvas")`, which is the 2D *drawing* canvas — always
inked, so the guard would have passed for any 3D frame whatsoever. It now selects
the largest canvas, which is the 1920×1080 capture target. A guard that cannot
fail is not a guard, and this one nearly shipped as one.

**`__geomDebug.probeDihedral()`** replaces the two blind metrics with the physical
quantity specular actually traces: the angle between the two faces that share an
edge. Edges are keyed by **rounded position pair**, not by vertex index, so the
result is independent of emission order, of winding, and of whether vertices are
welded — the three assumptions that broke the old metrics. It buckets by where the
edge lives, because the three buckets have different correct answers:

- `wall` — both faces near-vertical. The rim. Must be smooth.
- `cap` — both faces near-flat. Must be ~0.
- `mixed` — a cap face meeting a wall face. **This is the bevel**, and its `max` is
  the number that says whether the rim is a roll or a cut.

It also reports `boundaryEdges` and `nonManifoldEdges`, which nothing measured
before.

---

## 5. What the working instrument found

Same four fixtures, glossy material, one run:

| fixture | wall mean / max / >30° | mixed mean / max | boundary | non-manifold |
| --- | --- | --- | --- | --- |
| word/solid | 4.7 / 15 / 0 | — | 0 | 0 |
| circle/solid | 0.70 / 2.18 / 0 | **90.0 / 90.0** | 0 | 0 |
| square/solid | 4.74 / 90 / 8 | **90.0 / 90.0** | 0 | 0 |
| crossing/solid | 2.78 / 73.16 / 6 | **90.0 / 90.0** | 0 | 0 |
| word/extrude | 4.6–5.6 / 15–39 | 15.4 / 30.1 | 12 | 0 |
| circle/extrude | — | — | — | — |
| square/extrude | 4.11 / 51 / 26 | 15.26 / 60.24 | 8 | **153** |
| crossing/extrude | 4.12 / 15 / 0 | 15.18 / 30.12 | 12 | 0 |

Three findings, in order of how much they matter.

### 5a. Solid's rim is a die-cut edge — confirmed, and now quantified

`mixed mean 90, max 90, over30 = every edge in the bucket`. Not "mostly 90" — the
distribution is a spike. The Solid H3 assembly writes the front cap at `+halfDepth`,
the back cap at `−halfDepth`, and a vertical wall between them, and there is no
bevel construction anywhere in it.

Explainer 11 §8 already called this out from `probeNormals`. What is new is that
the number is now unambiguous: `probeNormals` measured 90° *normal splits*, which
a reader can dismiss as a shading choice. `probeDihedral` measures 90° *geometry*,
which cannot be dismissed. Compare Extrude, which got the ported profile this
cycle: `mixed mean 15.4, max 30.1` — a three-step band, ~15° per step, exactly the
rounded profile's `segments: 3`.

Desk Doodles' own comment on the constant says the profile is **"Shared by Extrude
+ Solid."** Free Stroke ported half of it.

### 5b. `square/extrude` has 153 non-manifold edges

An edge shared by more than two faces means the surface passes through itself.
Nothing had ever measured this. The square fixture is a closed loop drawn as a
single stroke that returns to its start, so the ribbon overlaps itself at the seam
— and `square/extrude` is also the only fixture with `wall max 51°` and `mixed max
60.24°`, i.e. its worst creases are at that overlap. This is a direct, measured
instance of *"look at all the weird joints … the edges and overlaps, the geometry
gets all weird."*

### 5c. Every Extrude mesh has 8–12 boundary edges

A boundary edge belongs to exactly one face: the surface has a hole. Twelve of
them on every ribbon, consistently, regardless of fixture. The ribbon is not
closed. It is small enough not to show under this lighting, but it is why an
exported GLB is not watertight, and it will show the moment anything does a
solid-boolean or a thickness operation on it.

---

## 6. The structural point

All three instrument failures are the same failure the code has: **a value derived
under one set of assumptions, consumed under another, with nothing at the boundary
that checks.** `rimTurn` assumed contour-ordered indices. `maxRimSplit` assumed
duplicated seam vertices. The close-up loop assumed its rows did not already carry
an index.

The fix in each case was not a better number. It was **removing the assumption**:
key edges by position rather than by order; measure the physical crease rather than
a proxy that depends on how the mesh was written; give the loop the index instead of
manufacturing a second one.

And the general form, which is the same conclusion §4 of this repo's audit reached
about the product code: *the verification harness is code, and its failure modes are
not automatically loud.* Two of the three failures above wrote artefacts into
`docs/verification/`. An instrument that fails silently does not merely fail to
find defects — it manufactures evidence that there are none.
