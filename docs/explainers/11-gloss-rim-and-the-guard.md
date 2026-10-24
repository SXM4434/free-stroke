# 11 — The gloss rim, and a guard that made things worse

> ### 🟢 ONE CORRECTION AND ONE CLEARANCE, 2026-08-07 — no finding in this file moves
>
> A lane came here to check whether this file's bevel numbers were built on a
> measurement that was never taken. **They were not, and saying so is the point of
> this note** — "we checked and it was fine" is a finding, because it is what stops
> the next lane checking it again. Corrected in place with the original kept: *a
> corrected investigation is worth more than a tidy one.*
>
> **1 · CLEARED — every number in this file came from a real instrument.** §2's
> `rimTurnMeanDeg 90`, `rimTurnAlternationRatio 0.987`, `rimSplitGroups 1976 of
> 1976` and §4's `6.16 / 0.046 / 740` are all `__geomDebug.probeNormals()`, which
> exists and returns them; they are in the **`probe`** field of
> `docs/verification/gloss-rim/*/probe.json`, filled, on disk. §5's vertex and
> triangle counts are the geometry regression net's. Nothing here rests on the
> field corrected below.
>
> **2 · 🔴 BUT THE `band` FIELD BESIDE THEM IS A MEASUREMENT THAT WAS NEVER TAKEN,
> AND §8 SENDS YOU STRAIGHT AT IT.** `verify-gloss-rim.mjs:299` reads
> `window.__geomDebug?.normalHistogram` — a name that appears **nowhere in this
> repo**, not in `components/`, not in `lib/`, not in `app/`. The optional read
> makes it `null` rather than a throw, so **`band` is `null` in every cell of every
> `probe.json` this tool has ever written: 52 of 52, across seven labels**
> (`after` · `before` · `rim_after` · `allmodes-before` · `bevel_after` ·
> `bevel_final` · `rim_after2`). Three lines above that read, the tool's own comment
> says what the field was for: *"That in-between band IS the bevel. A die-cut rim
> scores 0."* The member that exists is **`probeNormals()`**.
>
> **What §8's first bullet should have said.** It says Solid has "no band of
> intermediate normal between them" and points at
> `docs/verification/gloss-rim/after/word_solid/`. The claim is TRUE and it is
> `probeNormals()`'s — `splitGroups` equal to `uniquePositions` at `meanSplitDeg
> 90`. It should have named that instrument, because a reader who opens the
> `probe.json` sitting beside those frames finds `band: null` and has no way to tell
> a bevel that measured zero from a census that was never run. **A null is not a
> zero, and this file gave a reader every reason to read it as one.** The sentence
> is left exactly as written below, with a marker at it.
>
> The bevel band was, separately, measured properly — by
> `__geomDebug.probeDihedral()`'s `mixed` bucket, which is a real member with real
> output in `docs/verification/gloss-rim/probe_dihedral.json`. Explainer 13 §4
> (*"`mixed` — a cap face meeting a wall face. **This is the bevel**"*, `:121`) and
> explainer 16 §2 (`:120`) are built on that, not on this. **`normalHistogram` was a
> second implementation of a question `probeDihedral` already answers**, which is
> why nobody has missed it for as long as it has been returning nothing — and which
> is the contract's §17.5 inside a debug channel: one place of truth, or two, one of
> them empty.
>
> **3 · The H1 read `# 10` until today.** This file is explainer 11; `10` is
> *Extrude + Solid silhouettes*, a different document. Recorded rather than quietly
> swapped, because the same slip is live in explainer 25 (whose H1 still reads
> `# 24 ·`) and the record of how often it happens is worth more than the tidy
> version.

Two things in this pass. One is a measurement habit: **judging geometry on a matte
material is judging it with the evidence turned off.** The other is what that habit
had been hiding — a fidelity guard in the Solid contour smoother whose failure mode
was to emit the *worst* geometry the pipeline can produce, silently, on a whole
class of ordinary marks.

---

## 1. Specular is a derivative operator on the normal field

Every geometry judgement this project has made about Solid was made on
`matteClay`. Not by choice — by default. `handleModeChange` applies
`MODE_MATERIAL_DEFAULTS`, and that table says:

```ts
extrude: "glossyPlastic",
solid:   "matteClay",
```
— `lib/style-system.ts:803`

`verify-form-orbit.mjs` drives `setMode` and nothing else, so every Solid frame in
`docs/verification/form-orbit/` is a matte frame. That is not a small bias.

A Lambertian surface integrates incoming radiance over the whole hemisphere. Its
shaded value is a smooth functional of the normal, so a discontinuity in the normal
field moves the pixel by a few percent — a shading defect arrives attenuated. A
glossy surface reflects a narrow lobe: the shaded value tracks the *reflection
vector*, so the same discontinuity can swing the pixel from black to white across
one edge. Roughly: matte responds to the normal, gloss responds to its derivative,
and every artefact we care about here — facets, staircases, creases, quantisation
ripple — is a defect *in the derivative*.

So the rule that comes out of this pass: **a form is judged on gloss.** If it reads
clean under a mirror lobe it reads clean under everything; the converse is false,
and we had been living in the false direction.

`scripts/verify/verify-gloss-rim.mjs` is that judgement made repeatable. It sets
the material explicitly, **after** `setMode` (mode change stamps the mode default
over anything set earlier), then **reads the state back and refuses to capture if
it did not take**. That readback is not paranoia; this project has already shipped
one harness that passed while its clicks were landing on a `<span>`.

---

## 2. What gloss showed

The `crossing` fixture — two thin bars overlapping at a shallow angle, i.e. the
literal "the edges and overlaps, the geometry gets all weird" complaint — came
back like this:

Every rim vertex a 90° step. A comb. Not a ripple, not a facet ladder on a curve:
the raw 512-cell marching-squares contour, extruded and lit.

The live probe agreed, exactly:

| `crossing` / solid | before |
| --- | --- |
| `rimTurnMeanDeg` | **90** |
| `rimTurnMaxDeg` | 90 |
| `rimTurnAlternationRatio` | **0.987** |
| `rimTurnSample` | `90, −90, 90, −90, 90, −90 …` |
| `rimSplitGroups` | 1976 of 1976 |
| vertices / triangles | 5928 / 3948 |

A contour that turns exactly ±90° at every single vertex is not a contour that has
been smoothed badly. It is a contour that was never smoothed at all.

---

## 3. The guard was the bug

`smoothLatticeLoop` (`lib/solid-mask.ts`) is the ported decimate-then-smooth chain
from Desk Doodles — snap to the coverage isoline, RDP-decimate at 1.4 cells, then
corner-aware multi-pass Chaikin (see `docs/research/extrude-solid-quality.md` §2
for why that order and not the reverse). It ends with two fidelity guards: the
smoothed loop must keep 90–105% of the exact loop's area, and must not
self-intersect. On failure:

```ts
CONTOUR_SMOOTH_DEBUG.areaFallbacks++
return exactLoop            // ← the raw lattice staircase
```

The console said so, once, per build:

```
[v0-solid] CONTOUR SMOOTH FALLBACK: area 1.067
```

1.067. The guard's ceiling is 1.05. It missed by seventeen thousandths, and the
price of missing was **the entire outer contour reverting to the maximally
faceted output the pipeline can generate.**

That is the actual defect, and it is a design defect rather than a numerical one:

> **A guard whose failure mode is the worst available answer is worse than no
> guard.**

Without the guard the crossing would have been smoothed 6.7% fat — a departure of
well under a mask cell on a form 2 world units wide, which nobody would ever see.
With the guard it was rendered as a comb.

### Why a thin form overshoots and a fat one does not

RDP's epsilon is absolute — 1.4 grid cells — but the damage it does is relative to
the local half-thickness. On the circle (half-width ~90 cells) 1.4 cells is a
rounding error. On the crossing's bars (half-width ~8 cells) it is ~17% of the
half-width, so the decimated polygon cuts straight across the concave notch where
the two bars meet, and the subsequent Chaikin passes bulge the result outward.
Area up 6.7%.

Nothing is wrong with the epsilon in general. It is wrong *for that loop*. Which
tells you what the fix is.

---

## 4. The fix: search the trade-off, don't abandon it

The epsilon is not a constant of nature. It is a **fidelity/smoothness dial**:
coarser collapses more staircase and departs further from the traced mask. The
area guard measures precisely that departure. So when the guard rejects a result,
the answer is to move along the dial — not to throw the loop away.

```ts
const CONTOUR_DECIMATE_EPSILON_LADDER = [1.4, 0.9, 0.55, 0.3, 0]
```

Coarsest first; take the first rung that clears both guards. Two properties make
this safe rather than merely permissive:

- **The floor is not the staircase.** Rung `0` means *no decimation* — snap plus
  corner-aware Chaikin. That is essentially what this file did before the
  decimate-first reorder, so the ladder can only ever land somewhere between "as
  good as the port" and "as good as what preceded the port".
- **The guards are unchanged.** The 90–105% band and the self-intersection test
  still hold on whatever comes out. Nothing is accepted that the old code would
  have called unfaithful; the difference is only what happens *after* a rejection.

The raw loop is still the terminal fallback. It now requires **every** rung to
fail, instead of the first one.

Measured, live:

| `crossing` / solid | before | after |
| --- | --- | --- |
| `smoothed` loops | 0 | **2** |
| `areaFallbacks` | 2 | **0** |
| accepted epsilon | — | 0.55 cells (2 rungs rejected) |
| `rimTurnMeanDeg` | 90 | **6.16** |
| `rimTurnAlternationRatio` | 0.987 | **0.046** |
| vertices | 5928 | **740** (−87%) |
| triangles | 3948 | **724** |

---

## 5. The one that mattered more than the crossing

The geometry regression net moved on exactly **one** of its eight shapes, and it
was not a shape anyone had been worrying about:

| | before | after |
| --- | --- | --- |
| `tick/solid` vertices | 492 | 384 (−22%) |
| `tick/solid` triangles | 324 | 380 (+17%) |
| every other shape × every mode | — | **byte-identical** |

`tick` is a six-point mark 0.13 world units tall. A dot on an *i*. A comma. An
apostrophe. A tittle. **The smallest real unit of handwriting**, and it had been
rendering as a pixelated staircase blob — on matte, too; this one never needed
gloss to be visible, it just needed somebody to zoom in.

The vertex/triangle signature is diagnostic on its own. Before, vertices (492)
badly exceeded triangles (324): the wall builder allocates two extra vertices at
every *hard* junction (turn > `WALL_CREASE_DEG`), and a lattice staircase is
nothing but hard junctions. After, 384 ≈ 380 — a smooth rim with almost no
creases. The same fix, landing on a second fixture, visible in a count.

---

## 6. What "the form didn't move" is allowed to mean

The obvious fidelity check — did the silhouette shift? — is where this pass nearly
produced its own false evidence, twice.

**First false positive.** Measuring the ink bounding box from the captured PNGs
gave `0.9205` for the before series. That is not an aspect ratio of anything in the
scene; it is 799/868, the canvas itself. Part of the earlier run had been captured
with DEV capture mode off, so those PNGs are opaque — every pixel passes an alpha
test and the "ink bounding box" is the whole frame. A fidelity number that is
secretly the canvas dimensions would have passed happily in the other direction
too.

The fix was to stop measuring fidelity in pixels and read the geometry regression
net's own bounding boxes instead: eight shapes instead of one, world units instead
of pixels, both sides captured under identical conditions.

**Second false positive.** With real numbers, `tick/solid` moved 4.23% in Y —
comfortably over a 2% threshold. But a *percentage* is the wrong unit for this
quantity. What is being bounded is a smoothing deviation, which is an **absolute
length** measured in mask cells. One mask cell is 3/512 ≈ 0.0059 world units;
that is 0.3% of the circle and **3.7% of the tick**. A percentage budget is
simultaneously far too loose on a big form and impossible on a small one.

Worse, the direction was expected: the raw lattice loop is the *outer hull* of the
mask — it steps around whole cells — so replacing it with a sub-cell-snapped smooth
contour should pull the extremes in by up to about a cell per side. The correct
assertion bounds that:

```
worst 0.0055 world = 0.94 mask cells (ceiling 2.00) — tick/solid axis1 0.13 → 0.1245
```

Sub-cell, on the shape that changed most. The right unit turned a "regression" into
a confirmation.

---

## 7. Instruments that lie when they fail

Two smaller things this pass had to fix in the witnesses themselves, both the same
shape as the bug they were watching:

- `CONTOUR_SMOOTH_DEBUG.lastInPoints / lastDecimatedPoints / lastOutPoints` were
  written **only on the success path**. After a fallback they still held the
  *previous* loop's numbers, so a reverted contour reported a healthy-looking
  `732 → 32 → 256` and read as if the smoother had worked. They are now written on
  the fallback path too, and there is a `lastFallbackReason` string.
- `probeNormals()` walks `exportGroupRef.current`, which is empty for a beat while
  a rebuild swaps meshes in. Reading it once returns `[]`, and the assertion then
  reports `undefined` — blaming the geometry for a failure of the measurement.
  `assert-gloss-rim.mjs` now polls until the group is populated.
- 🔴 **ADDED 2026-08-07 — and it is the worst of the three, because it never failed
  at all.** `verify-gloss-rim.mjs:299`'s `band` census asks for
  `__geomDebug.normalHistogram`, which has never existed, and files `null` — 52 of
  52 cells, seven labels, every run this tool has ever made. The two above are
  instruments that lied *when they failed*. This one is an instrument that was
  never able to fail, because it was never able to ask. The evidence file has a
  column for it and the column has always been empty, next to columns that are
  full. See the header, and explainer 49 for the class.

All three belong to the pattern this project keeps rediscovering: **the instrument is
code too, and its failure modes are not automatically loud.** The third adds a rung
to it — an instrument's failure mode can be to produce a well-formed nothing, which
is quieter than failing.

---

## 8. Still open

- **Solid has no bevel at all.** ⚠ *(the header's correction 2 is about this bullet:
  the claim is `probeNormals()`'s and it holds — but the `band` field in the
  `probe.json` beside these frames is `null` in all 52 cells because its census
  names a member that does not exist, so do not read that `null` as this zero.)*
  `probeNormals` reports `splitGroups` equal to
  `uniquePositions` with `meanSplitDeg 90` on *every* fixture: the flat cap meets
  the vertical wall at a hard right angle everywhere, with no band of intermediate
  normal between them. Desk Doodles' bevel-profile finding — the one Extrude got
  this cycle — explicitly says the profile is "Shared by Extrude + Solid", and
  Solid never got it. On gloss the result is a die-cut acrylic chip: a pure white
  face and a pure black wall meeting at an absolutely hard terminator, which is
  most of what still reads as "machine-made" in
  `docs/verification/gloss-rim/after/word_solid/`. Doing it properly needs an
  inward polygon offset of a mask-derived contour with holes, guarded the same way
  the smoother is — a real slice, not a constant.
- **The ladder's rungs are hand-picked.** `[1.4, 0.9, 0.55, 0.3, 0]` is a
  reasonable geometric-ish descent, not a derived sequence. A principled version
  would set the first epsilon from the loop's own local half-thickness (which the
  rasteriser knows — it is the ink radius) rather than trying and retrying.
- **Extrude's bevel band is sub-pixel at grazing angles**, so it aliases into a
  dashed line rather than reading as a rolled edge. That is a sampling problem,
  not a geometry one, and it is the reason a first pass over these frames nearly
  logged a nonexistent "serration" defect — the artefact vanished on zooming in.
