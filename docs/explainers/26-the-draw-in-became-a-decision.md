# 26 — The draw-in stopped being a transcript

Map: [`docs/animation-toolset-map.md`](../animation-toolset-map.md) (gated 2026-08-04).
Research: [`docs/research/stroke-animation-toolsets.md`](../research/stroke-animation-toolsets.md).
New file: `lib/stroke-schedule.ts`. New gate: `scripts/verify/assert-stroke-schedule.mjs`.

Sebs, 2026-08-04:

> *"we basically have not built the animation portion of this tool… I have no way
> of keyframing, editing any of the motion of the strokes outside of the
> textures… as if you were someone in control of the pen through a motion tool."*

He was right. Until this pass every control in the product shaped the draw-in's
**clock** — play, scrub, speed, delay, ease, reverse, loop, and the pen's own
recorded speed. Not one of them could say **which part of the mark draws when**.
The order was capture order, permanently; two strokes could not draw at once; a
stroke could not be held back and landed last. The mark's own timing was a
transcript, and the only thing you could do to a transcript is replay it faster.

This is step 1 and step 2 of the map's build order — the schedule model, and
`DRAW IN` with `order`, `overlap` and `align` on top of it. They ship together
because a model with no dial on it is `/desk-doodles` again: *"a whole motion rig
your own drawing cannot reach."*

---

## 1. Four reveals, and the one that decides the cost

`lib/pen-reveal.ts`'s header names four rendering mechanisms over one clock, and
"per-stroke timing" is a different-sized job on each of them:

| path | how it reveals | what a schedule costs there |
|---|---|---|
| **Rod** | `setDrawRange` off its own per-stroke clock (`viewport-3d.tsx:6272-6332`) | already per-stroke — change where the number comes from |
| **Desk Doodles · Inflate** | one mesh per stroke, keys baked into each stroke's own arc span (`dd-engine/adapter.ts:566-583`) | change the span |
| **Free Stroke · Inflate (implicit)** | ONE fused marching-cubes surface, per-triangle keys counting-sorted at build, one `setDrawRange` prefix + a per-fragment pen-tip test | **a key remap and a re-sort** |
| **Solid · Extrude · Inflate loft** | REBUILD from an arc-length-clipped copy of the strokes (`filterStrokesByProgress`) | generalise one clip to a per-stroke array |

The third row is the whole reason this was affordable. `revealKeys[t]` is the
playhead at which triangle `t` becomes drawn; the array is ascending and the
index buffer is sorted to match, so the draw is `lower_bound(keys, playhead)`.
**A prefix of a sorted array is exactly the set of triangles whose key ≤ the
playhead** — so any schedule that is monotone in the playhead is expressible by
rewriting the key values and re-sorting. Zero shader work. Zero geometry
rebuild. No new render path. The sort is the counting sort explainer 18 already
pays for, measured there at **39 ms once** against a ~600 ms build; here it runs
on a dial change, never per frame.

And the fourth row is why nothing in this pass is allowed to rebuild.
`measure-implicit-cost.mjs` on the hero word:

```
 reveal   wall(ms)
  0.05       24.5
  0.50      246.7
  1.00      531.5
```

A ramp, not a cliff, already over a frame budget at five percent of the word,
and one draw-in asks for ~120 of them inside 2.6 s. **Anything the animation
system does has to be an attribute, a uniform, or a reorder of an existing
buffer.**

---

## 2. The model: a translation, at one slope

A schedule is a **per-stroke translation of the arc axis at slope 1**, then one
global normalisation. Stroke `i` covers as-drawn global arc `[a_i, b_i]` of
length `L_i`; the schedule gives it an unnormalised start `u_i`, so it occupies
`[u_i, u_i + L_i]`; with `T = max(u_i + L_i)`:

```
S(a) = (u_i + (a − a_i)) / T          for a inside stroke i
```

That is the whole model. `order` permutes which `u` each unit gets; `overlap`
lerps every `u` from its sequential value toward its concurrent one; `align`
decides whether the concurrent value is `0` (everything starts together, so a
short unit finishes early) or `maxLen − len` (everything lands together, so a
short unit starts late) — Blender's **Time Alignment**, in Blender's own words.

Three things fall out of it, and every cheap thing below is one of them.

### 2.1 · The default is the identity, exactly

At `order: asDrawn` + `overlap: 0`, `u_i = a_i` and `T = 1`, so `S(a) = a` for
every `a`. `identity` is **computed** on the tracks, not declared — and every
consumer short-circuits on it. At the shipped default **not one line of this
feature executes**: the keys are untouched, the index buffer is untouched, the
tip field is untouched, Rod keeps its own clock and Solid keeps
`filterStrokesByProgress`.

That is the negative control the map demands, and it is a property of the wiring
rather than of a test. Measured anyway, because a property nobody measured is a
claim: **40 of 40 rendered frames byte-identical**, five engine arms × eight
playheads, captured before the feature existed and again on the finished build.
The instrument was calibrated first — two independent runs of the capture on the
unchanged build also came back 40 of 40, so a sha256 comparison here is a test
that *can* fail.

### 2.2 · The slope is one number, and that is what saves the pen tip

🔴 **The trap the map flags in red.** The reveal has **two** consumers, not one.
The `setDrawRange` prefix is a per-triangle cull; the actual boundary is a
per-fragment test against the tip field's `arc` channel:

```
when = arc + (1 − nose)·√(1 − ρ²) + taper·ρ            (lib/pen-reveal.ts:446)
```

Remap the keys and not the field and **the moving nose detaches from the stroke
it is drawing** — one idea with two implementations, which is this repo's most
expensive recurring defect.

`nose` and `taper` are lengths along the mark, quoted in arc fraction through
`radiusArc`. Under a general remap they would need a per-texel scale, i.e. a
third channel on the field and a shader change. They do not need one here,
because `dS/da = 1/T` is **a single constant for the whole word**. So the fix is:
the field's `arc` channel takes the *same* `scheduleArc`, and then two uniforms
are multiplied — `back` and `taper` by `scale`, `arcToLocal` by `1/scale`. The
`setDrawRange` front margin takes the same factor for the same reason.

`uniformSlope` is computed on every schedule rather than assumed, so a later
step that introduces a per-stroke **speed** — which genuinely does break it —
cannot do so silently and leave the nose quietly wrong.

**Proved, not argued.** With the tip off, the mark is exactly the drawRange
prefix; a tip that rides the schedule must land on top of that, and one that does
not is reading the recording's arcs against the beat's playhead. On the fused
surface at `order: reversed`, playhead 0.44:

```
IoU(tip on, tip off)   scheduled 0.9499      identity control 0.9819
KNOWN-BAD (setTipRidesSchedule false)   0.0000
```

The known-bad is not a synthetic mutant — it is the code that would exist if the
second consumer had been forgotten, parked as a dial so the defect stays
re-renderable.

### 2.3 · Un-drawing is still impossible, and that is honest

`S` is increasing inside every stroke, so the drawn set stays a prefix and a
schedule where stroke 3 disappears while stroke 5 draws is **not representable**.
That is fine for a draw-in and it is a hard wall for the reveal-as-a-window
(`start`/`end`/`travel`/per-stroke reverse) that is step 3. The wall is left
standing and visible rather than papered over: the model asserts monotonicity
inside every track, on every schedule it can produce.

---

## 3. What rides the beat, and what rides the stroke

The playhead handed to a scheduled reveal is unchanged — it is still
`revealDistanceFraction(strokes, t, mode, blend)`, the hand's own monotone
time→travel curve, and `playheadRef` is still the single scalar every render
path reads. **The modifier owns the rule; one keyframed scalar owns when.** That
is the architecture the Blender Build modifier's Dope Sheet frame settles
(`docs/verification/anim-map/blender-gp-build/contact/key-395s.png`: two keys on
one `Factor` row, and a whole word builds in), and it is the one this engine
already had.

The consequence, stated plainly rather than glossed: **under a non-identity
schedule the hand's pacing stays attached to the BEAT, not to the stroke.** A
reordered stroke draws at the pace the beat is at, not at its own recorded pace.
Carrying a stroke's own duration into a new slot needs the pen record re-timed
per stroke, which is a different quantity from anything this pass computes.

Blender hits the same wall and says so in its own documentation: *"Natural
Drawing Speed: Use the recorded speed of the stylus when the strokes were
drawn"* is **"Only available in Sequential and Additive"** — never in
Concurrent. Ours is the same restriction one step earlier, and it is in the
panel copy rather than left for a user to discover.

---

## 4. The unit is a group, and the group is the ink's own

Sebs's pick 2: *"both — group by default, stroke on request."* His traced word
measures **eight** units, not eleven letters, because his hand fused `e-s-k` and
`o-d`.

`lib/hero-letters.ts` already decides that from the ink — connected components
under *"each one's centreline lies inside the other's ink"* — and was calibrated
against the font's authored map. The schedule uses it directly: a unit's members
keep their relative offsets inside the unit's slot, so opening a group to its
strokes adds rows without moving ink.

It is skipped entirely at the default, because `asDrawn` takes every stroke's own
recorded span and **a grouping cannot change what the recording was**. That is
also what keeps the identity exact for both unit modes.

---

## 5. What the gate is, and the three known-bads it carries

`scripts/verify/assert-stroke-schedule.mjs` — **27 rows, ALL PASS.**

Six of them are model rows in plain node (`_ts-load.mjs`), because the claims are
exact and a raster could only approximate them:

- the default schedule is the identity, computed;
- at the identity the new rebuild clip is `filterStrokesByProgress`'s output
  **point for point, to nine decimals, at 19 playheads** — the row that caught
  `strokeProgressAt` returning a `Float32Array` and landing a geometry cut at
  `x = 289.99999165` where the double is `290`;
- `S(a)` is monotone inside every track, at one slope;
- the tip field's `2` sentinel — *"nothing reached here"* — passes through
  untouched, because a remapped sentinel would ink the paper;
- the re-sort is **index-order-only**: the same triangles, ascending keys,
  exactly reversible — with a **known-bad permutation** carrying one duplicated
  slot, which must be rejected.

The rest drive the real UI. The panel is opened by clicking the transport bar's
own button, the control set is read off the DOM, and `Reversed` is **clicked**
rather than set — because *"a whole panel in this repo once rendered zero
controls while harness assertions passed."*

The three known-bads, each required to fail:

| known-bad | what it re-renders | measured |
|---|---|---|
| `setTipRidesSchedule(false)` | the map's red trap: the field left in the recording's arcs | IoU **0.0000** against 0.9499 |
| a duplicated slot in the permutation | a silently dropped triangle | triangle multiset changes |
| `assert-drawin-attrs`'s parked pair, re-run | the blank tail (explainer 24) | 256 rejected draws, 1 px of ink |

And the claim the map insists must be **filmed** rather than stilled — that
`overlap > 0` puts two pen tips on the page at the same instant — is filmed
(`docs/verification/stroke-schedule/film/`), watched back, and measured. The
measurement is the **separation** of the growing places, not their count: the
fused surface fragments a single stroke's growth wherever a later stroke crosses
it (the triangles at a crossing take the later stroke's key, so a hole opens and
heals — the standing artifacting defect, map §6.7), and a bare count reads two
for one pen.

```
overlap 0    growth separation 176 px     one place
overlap 1    growth separation 395 px     two places, floor 241 px (mark diag 962 px)
```

`film-overlap100/f040.png` is the picture: **three** shaped noses on the page at
once — the horizontal, the arc and the X — each on its own ink.

---

## 6. Two things the sweep found that were not the subject

**`fusion: "auto"` builds lofts, and the interesting path is one dial away.**
`DEFAULT_INFLATE_PARAMS.fusion` is `"auto"`, which *"sweeps the loft where the
loft is provably valid"*. On an ordinary drawing that means plain Inflate on `/`
is one mesh per stroke with **no `revealKeys` at all** — `revealState().frac`
null, `__heroPenTip` null, no pen tip anywhere — and reveals by rebuilding. So a
sweep that captured only the `auto` arm would have called four render paths five
and never touched the fused surface the whole `setDrawRange` argument is about.
`inflate-implicit` is a separate arm in the capture for that reason.

**`geometry-baseline.mjs` cannot be aimed at a lane.** It hard-codes
`http://localhost:3000` and does not read `FS_PORT`, against a `docs/DISPATCH.md`
§3 that says *"One knob, one name."* A `--save=` taken inside a lane measures the
canonical tree. The substitute here is stronger for this particular question
anyway: the schedule never rebuilds geometry, the re-sort is proved
index-order-only in node with a known-bad, and the default render is proved
byte-identical on every engine.

---

# Part 2 — the reveal became a window

*Step 3 of the map's build order. Steps 1 and 2 are above; nothing in them is
replaced.*

New in this pass: `RevealWindowParams` and `windowAt` in `lib/stroke-schedule.ts`,
a `reverse` dial on `DrawInParams`, an `arcMap` on `buildTipField`, a second
fragment test in `applyPenTip`, and 23 more rows on the same gate.

Sebs gated the map; §8 named this slice before it was built:

> *"make the reveal a **window** rather than a prefix — `start` and `end`
> instead of one `progress`, plus `travel` and a per-stroke `reverse`. That is
> Cavalry's entire stroke-reveal API, it is two binary searches instead of one
> on the `setDrawRange` path, and it hands us Blender's *Shrink* and *Vanish*
> transitions for nothing."*

Every clause of that turned out to be true, and one of them turned out to have a
price step 2 had already quietly paid on credit. §11 is that.

---

## 7. The model: an interval, not a prefix

The drawn set was `{ x : S(x) ≤ playhead }`. It is now

```
{ x : lo < S(x) ≤ hi }
```

and `grow` is the mode that pins `lo` at 0 for every playhead, which is the
prefix, which is what shipped. Four modes, one length:

| pill | `[lo, hi]` | what it is |
|---|---|---|
| **Grow** | `[0, d]` | the prefix. **The identity.** |
| **Travel** | `[d(1+L) − L, d(1+L)]` | a segment of length `L` running the whole mark |
| **Vanish** | `[d, 1]` | Blender's *Vanish* — the ink you laid **first** goes first |
| **Shrink** | `[0, 1 − d]` | Blender's *Shrink* — the ink you laid **last** goes first |

`length` is live only under `travel`, and the panel disables it elsewhere rather
than leaving a control on screen that cannot act — explainer 06 §3's rule, the
one `align` already follows at `overlap 0`. The gate clicks through it in both
directions and reads `disabled` off the DOM.

**The beat drives the edges; the edges are not keyframed.** Cavalry exposes
`Start` and `End` as two animatable properties and we deliberately do not,
because `lib/export/frame-plan.ts` requires the whole animation to be a pure
function of one scalar — *"a screen recorder samples wall-clock time, so the
output's timing is the timing of the RENDER"* — and two independently keyframed
edges are two clocks. It is also the architecture the map's research settled:
the Build modifier's Dope Sheet frame is **two keys on one `Factor` row**, and
*"the modifier owns the rule; one keyframed scalar owns when."*

### 7.1 · One window for the word, and what that buys

The interval lives in the beat's space, not per stroke — so `overlap` and the
window compose without either knowing about the other. At `overlap 1` every unit
occupies the same stretch of `S`, so one travelling window puts a travelling
segment on **every unit at once**. A per-unit window would have been a second
scheduling model beside the first, which is this repo's most expensive recurring
defect written down in its own words.

---

## 8. The trailing edge, and the law that was chosen because it can be checked

The pen tip's boundary is a per-fragment test against the tip field's `arc`
channel. A prefix needs one; a window needs two. The first draft mirrored the
nib for the second — `−taper·ρ − back·√(1−ρ²)` — on the reading that un-drawing
is a pen running backwards.

That is a defensible idea and it is the wrong one, for a reason worth keeping:

> **Ink vanishes in the order it was laid.** So the set of texels the
> evaporation front has passed at `lo` is exactly the set the *drawing* front
> had passed at `lo` — same texels, same `when`.

Reuse `fsWhen` and the window becomes literal set subtraction:

```
W[lo, hi]  =  P(hi) \ P(lo)
```

where `P` is the prefix the app already shipped. **That is an identity a raster
can be held to**, and the gate holds it to exactly that — a `travel` frame at one
playhead against the difference of two `grow` frames taken at that window's own
two edges. A mirrored nib would have made the two differ by the nose's own shape
at both ends and left the claim as an argument.

```
IoU(travel, grow(hi) \ grow(lo))   0.9494        against the prefix itself   0.4288
```

Two more things fall out of reusing the scalar. `fwidth(fsBsd) == fwidth(fsTsd)`
exactly — they differ by a constant and `fwidth` is a difference — so the
trailing ramp reuses the leading one's screen derivative and costs one subtract
and one `min`. And the whole block sits under `uFsTipTrailOn`, a **uniform**, so
it is uniform control flow (the same argument `uFsTipOn` rests on) and at the
default the leading assignment is textually the last thing that touches
coverage.

---

## 9. Each edge proved on its own

The dispatch's bar: *"a window has the same trap twice — the `arc` channel must
take the window at both ends, or the nose detaches at the `start` edge, the
`end` edge, or both. **Prove each edge separately.**"*

The isolation is exact rather than approximate, and it is one line of set
algebra each.

**The leading edge** — `travel ∪ grow(lo) == grow(hi)`. Every pixel the trailing
edge could get wrong lies below `lo`, and every such pixel is already in
`grow(lo)`, so the union swallows the trailing error entirely. Nothing but the
leading boundary can move this number.

**The trailing edge** — the EXCESS, `|travel \ (grow(hi) \ grow(lo))|`. With the
leading edge proved, the only thing that can put ink outside the expected set is
the trailing boundary.

```
LEADING    union IoU               0.9792
           …under order: reversed  0.9991      KNOWN-BAD setTipRidesSchedule(false)  0.2938
TRAILING   excess                   0.47 %     KNOWN-BAD setTipTrailsWindow(false)   8.23 %   (17.5×)
```

The leading-edge known-bad has to carry a real schedule, because
`setTipRidesSchedule(false)` is **inert at the identity by construction** — a row
that ran it at the default would have passed while proving nothing.

---

## 10. Reverse, and why it costs the tip nothing

`reverse` is `off` / `all` / `alternate`, per unit. It lives on `DrawInParams`
and not on the window, and the distinction is the whole reason the file is split
that way: a window is an interval **over** `S`; a reverse changes `S` itself.

Three things had to survive it.

**The slot stays ordered.** A reversed track still has `start < end`; only the
direction the arc axis runs through it flips. So a window test on the output is
still an ordered comparison and the drawn set is still a contiguous range of a
sorted array.

**`uniformSlope` had to be re-derived, and it was silently wrong first.** Step 2
computed `(end − start)/len`, which is `+1/T` by construction and therefore
cannot see a sign — it would have reported "uniform" for a track whose real slope
is `−1/T`, which is precisely the silent pass that field exists to make
impossible. It is now sampled off `scheduleArc` itself, signed, and the two facts
are reported separately: the magnitude in `uniformSlope`, the sign in
`reversedCount`.

**And the magnitude is all the tip needs.** `nose` and `taper` are LENGTHS along
the mark quoted in arc fraction, and a length converts by `|dS/da|` whichever way
the pen is running. Working it through: under a reverse the pen point passes a
texel at `a_pass = a_first − √(R²−ρ²)` in recording arc, and `dS/da = −scale`, so
`S_pass = S_first + scale·√(R²−ρ²)` — **the same formula**. So `back` and `taper`
take the same multiply they already took, and the shader is unchanged.

Which is the good news. §11 is the bill.

---

## 11. 🔴 The finding: `min` and a remap do not commute

Step 2 remapped the tip field's `arc` channel **after** the bake
(`remapTipFieldArc`). That is exact for every schedule step 2 could produce, and
step 3 breaks it — not at the edges, but structurally.

The `arc` channel is **a minimum over the samples that cover a texel**. Its own
note says why:

> *"`arc` is the SMALLEST arc among the samples that actually ink the texel…
> at a crossing the nearest centreline is often the LATER stroke, and keying on
> it would un-draw ink the pen had already laid."*

`min` and a remap commute only while the remap is **increasing over the whole
word**. `order`, `overlap` and `align` all keep it increasing *inside* a stroke,
so remap-after was sound. A per-unit **reverse** does not: the sample that is
first in beat time is the one with the **largest** recording arc. Remap the
minimum and the texel is keyed to when the nib **last** covered it instead of
when it **first** did — off by the nib's own sweep, one diameter.

The symptom is the map's red-flagged trap arrived at from underneath: the moving
nose sits beside the ink instead of on it.

### The fix is a bake, and it is two flops

`scheduleArcCoeffs` returns the schedule as `[m0, m1]` per stroke — the map is
**affine inside a stroke**, so its two coefficients are constant for every one of
that stroke's segments and hoist clean out of the texel loop. `buildTipField`
takes them as `arcMap` and folds them into the arc **before** the minimum is
taken. Null at the identity, so the shipped raster takes no branch at all.

Cost: a rebake instead of a remap, on a schedule change — never per frame,
against a bake the file already measures at ~35 ms.

### It is parked, not replaced, and it is a known-bad

`remapTipFieldArc` stays exported and reachable behind
`setTipFieldBake(false)` (`TIP_FIELD_SCHEDULE_BAKE`), so every frame captured
under it is still re-renderable — and step 2's path becomes step 3's third
known-bad, required to fail:

```
under reverse: all, playhead 0.44
  595 px drawn ONLY by the baked field        8 px drawn only by the remapped one
  ink 43 593 vs 43 006                        749 px differ
```

**Short, never long** — which is the signature of a texel keyed to the last
covering sample rather than the first, and which is what makes it a test rather
than a reading: if the bake were the broken half, the containment would run the
other way.

### What could not be measured, stated plainly

The first version of that row measured stroke A1's **leftmost inked column** and
read **x = 0 on both arms**. `frontView(0.8)` frames this fixture edge to edge on
the 799 px canvas (`canvasWidth = innerWidth / 2`), so the mark's bbox is
`x 0..798` and **both boundaries are clipped**. An absolute edge position is not
available in this framing. The claim was restated in the form the framing does
support — containment — rather than the band being nudged until a number
appeared.

---

## 12. What the raster and the film say

**The claim a prefix cannot make.** Step 2's filmed claim was two pen tips at one
instant, measured as the separation of the growing places. Step 3's is a
different claim and needed a different quantity: a prefix can only **add** ink,
so what a window has to show is ink being **removed**, and removed somewhere else
than it is being added.

```
                      added      removed    edges apart     floor
grow                  15 163            0         —             —
travel (L = 0.25)     23 792       11 587       434 px       241 px   (mark diag 962 px)
```

`grow` removing exactly zero is also the raster's own restatement of
`assert-drawin-monotone`'s claim, arrived at from the other side.

**Two binary searches, read off the buffer rather than argued.**

```
setDrawRange start:   grow [0]      travel [35961]
```

A window implemented by culling from the front only would pass every visual row
and fail that one.

**The negative control, again, and it now covers a shader change.** The `grow`
default is byte-identical to the build before step 3 existed — **48 of 48
frames**, six engine arms × eight playheads, sha256, including the fragment
shader moving from cache key `v2` to `v3`. Instrument calibrated first: two
independent runs of the capture on the unchanged build also came back 48 of 48,
and 46 of 48 frames within a run are distinct, so the comparison can see a
difference. Four pairings, all 48/48: `before/before2`, `before/after`,
`before/after2`, `after/after2`.

**And the round trip, which a window needs more than a schedule did.** The window
touches four things a schedule does not — `setDrawRange`'s offset, a second
uniform, the rebuild clip's near end, and Rod's ring offset — so any one of them
left set would leave the default rendering a window nobody asked for.
`grow → travel → reverse → back` returns the byte-identical default on **6 of 6
engines**, and non-vacuously: `travel` and `reverse` each moved the picture on
all six first.

---

## 13. The gate, and the three defects it found in itself

`scripts/verify/assert-stroke-schedule.mjs` — **50 rows, ALL PASS** (27 in step
2). Five known-bads, each required to fail:

| known-bad | what it re-renders | measured |
|---|---|---|
| a duplicated slot in the permutation | a silently dropped triangle | triangle multiset changes |
| the arc map with its **sign dropped** | step 2's remap under a reverse, in the model | 80 of 96 samples diverge |
| `setTipRidesSchedule(false)` | the field left in the recording's arcs — the **leading** edge | union IoU 0.9991 → **0.2938** |
| `setTipTrailsWindow(false)` | a one-sided test — the **trailing** edge | excess 0.47 % → **8.23 %** |
| `setTipFieldBake(false)` | remap-after-the-minimum under a **reverse** | 595 px vs 8 px, strict subset |

**Three of the first draft's rows failed, and all three were the instrument.**
Recorded because each is a class rather than a slip:

1. **`setWindow` did not settle.** It writes React state and `__revealHarness` is
   reinstalled on that state, so reading `windowAt` in the same tick returns the
   *previous* window's shape. A `travel` arm rendered at length 0.30 was compared
   against two prefixes bounded by length 0.25's edges, and a correct feature read
   as **0.7253**. Exactly the lag `seekBeat` carries its own warning about, one
   control over.
2. **The disabled-slider probe took the last `input[type=range]` in the dialog**,
   which is the *Delay* slider — never disabled. The row failed while the control
   it was aiming at worked correctly. Three sliders now carry `aria-label`s;
   *"the last one"* is a fact about layout and this was a question about a
   control.
3. **The travel-width row sampled hard-coded playheads.** A travelling window is
   only at full width once it has fully entered: the tail clears zero at
   `d = L/(1+L)` and the head reaches one at `d = 1/(1+L)`. At `L = 0.6` those
   are 0.375 and 0.625, and a hard-coded 0.3 lands in the entry ramp where the
   width is *correctly* short. Testing a derived window at a hard-coded playhead
   is the same class as a gate whose window was sized for an old beat.

---

## 14. What is still true, and what is now open

**The map's §7 holds.** All seven films are reachable with their ids and
behaviour intact; Natural / Authentic / Smooth stay and the window rides over
them; `PEN_TIP_SHAPES.chisel`, `TIP_FIELD_REACH_PRIOR`, `timeStrokesUniform`,
`filterStrokesByProgress` and now `remapTipFieldArc` and `strokeProgressAt` are
all still there and still reachable.

**Step 2's open limit is still open, and this pass says why deliberately.**
Under a non-identity schedule the hand's pacing rides the beat, not the stroke.
Step 3 does not fix it and could not have: a window is an interval over `S`, and
re-timing a stroke changes `S`'s *slope* inside that track — which is the one
thing `uniformSlope` is watching for, and the thing that would cost the tip its
third texture channel. §15 states exactly what it would take.

**A prefix could not un-draw; a window can — but not per stroke.** The window is
one interval in the beat's space, so *"stroke 3 disappears while stroke 5 draws"*
is still not representable unless the two happen to fall on opposite sides of one
boundary. That wall is lower than it was and it has not gone.

---

## 15. The limit step 2 left open — decided, and left open on purpose

Step 2 named it and handed it forward:

> *"**Per-stroke recorded duration under a reorder.** Under a non-identity
> schedule the hand's pacing rides the beat, not the stroke… Fixing it needs the
> pen record re-timed per stroke — step 3+."*

**This is step 3+, and the answer is: not here, and the reason is structural
rather than a matter of appetite.**

A window is an *interval over* `S`. Re-timing a stroke is a change *to* `S` —
specifically to its **slope inside one track**, which is the single quantity the
whole cheap architecture rests on being one number:

```
today          S(a) = (u_i + (a − a_i)) / T          dS/da = 1/T      one constant
re-timed       S(a) = (u_i + (a − a_i)·k_i) / T      dS/da = k_i/T    one per track
```

`uniformSlope` exists to catch exactly that, it is computed rather than assumed,
and step 3 made it *signed* precisely so a reverse could not sneak past it. Doing
the re-time inside a window pass would have been the two-features-one-commit move
that makes a regression unattributable.

### What it would take, precisely

1. **The model is nearly free — about ten lines.** `scheduleArcCoeffs` already
   returns `m1` **per stroke** and nothing downstream assumes the magnitudes are
   shared; `strokeSpansIn`, `filterStrokesBySchedule` and the sort are all
   per-track already. Add `speed: number[]` to the track, multiply, done.
2. **The pen tip is the whole bill, and it is a texture format.** `nose` and
   `taper` are converted from arc fraction to beat units by *one uniform
   multiply* because the slope is one number. Per-track slopes make that a
   **per-texel** quantity, so the tip field needs a **third channel** —
   `THREE.RGFormat` → `RGBFormat`, 1.5× the field's memory, one more accumulator
   in `buildTipField`, and `uFsTipBack` / `uFsTipTaper` / `uFsTipArcToLocal`
   becoming `texture2D` reads instead of uniforms. That is the change this file's
   §2.2 has been saying it does not need, and it is the honest price.
3. **The number itself has to come from the recording, not from a dial** — if
   Sebs's pick 4 stays *"ride, don't override"*. `measurePenRecord` already
   reports each stroke's duration and the word's mean pen speed, so the
   pace-preserving multiplier is
   `k_i = (L_i / d_i) / (ΣL / Σd)` — the stroke's own speed relative to the
   word's. Authored per-stroke speed is the same machinery with the number coming
   from a slider instead, which is why the two belong in one pass.
4. **And it needs its own known-bad**, which is easy and is already implied by
   §11: a field baked at one slope and read at another puts the nose off the ink
   by the ratio of the two.

**Recommendation: it belongs with per-stroke speed, in the pass that adds it —
not with the dock and not with perform-mode.** Both of those write *into* the
schedule; this changes what the schedule can express.

---

## 16. The picks, still Sebs's

Unchanged from the map's §9 and restated because step 3 touched three of them.

**Pick 3 — does the timeline ever appear?** Rec: still **yes, as a VIEW of the
stack**. Step 3 strengthens it: the window is four pills and one slider that
describe a rule, and a dock would draw what they produce. A row per stroke would
have to invent four numbers the rule already knows.

**Pick 4 — does authored motion override the recorded timing, or ride it?**
Rec: still **ride it**, and step 3 is the first pass where that has a price
attached — §15 is the invoice. Nothing here decides it; the arithmetic is
written out so the decision can be made against a number.

**Pick 6 — product route or a lab first?** Rec: **the product route**, and it is
where this landed — the Timing popover on `/`, beside `DRAW IN`, reachable from
the transport bar a user already clicks. The gate opens it by clicking that
button and reads the control set off the DOM, because *"a whole panel in this
repo once rendered zero controls while harness assertions passed."*

**Pick 7 — the iOS pass.** Untouched. The window is four pills, one slider and
three direction pills, which is a thumb-sized control set already; nothing about
it assumes a mouse.
