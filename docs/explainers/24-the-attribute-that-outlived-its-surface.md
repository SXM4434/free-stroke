# 24 — The attribute that outlived its surface

> ### 🔴 FIVE CORRECTIONS, 2026-08-07 — all measured, none of them changes the finding
>
> An audit lane re-ran this investigation end to end rather than reading it, and
> four things in this file are stated more strongly than the evidence supports.
> **A fifth is in §10**, from the lane that finally ran §8 item 5: the opening
> table's `indices out of range` row carries a **verdict that is simply wrong** —
> not retracted, not overstated, wrong — and the file had no category for that.
> §10 also corrects two of §8's own corrections, which is what happens when a
> table is measured on one frame and read as though it were about channels.
> They are corrected below **in place, with the original readings kept**, because
> a corrected investigation is worth more than a tidy one.
>
> **1 · §5's "After" block is read at `--dsf=2`, and never says so.** The numbers
> 93 445 / 94 323 / 100 690 are device-scale-factor 2. The repro command this
> same file documents carries no `--dsf` and the probe defaults to **1**, where
> the same run reads **23 627 / 23 846 / 25 441** — a factor of ~3.96. A reader
> following the doc gets 25 441 where the doc says 100 690 and has no way to tell
> which of them is wrong. The sheet declares `dsf 2` in its own header; the prose
> did not. **The control claim itself is exact and stands**: 93 006 / 93 445 /
> 94 323 are byte-identical on the before and the after arm, verified
> independently off both artefacts, and the same control reproduces at dsf 1.
>
> **2 · "181 times" is a symptom count, not a property of the defect.** It is how
> many frames happened to be rendered while the mark was broken, and it moves
> with how long you leave the page sitting there. A re-run of the same known-bad
> logged **256**. The message and its **warning** level are verified verbatim and
> are the part that matters; the count is presented in §1 as though it were a
> measurement, and it is not one.
>
> **3 · §6 claimed four things kept the gate's rows from passing vacuously. It
> was one row short of the truth, and the missing one was the whole point.** The
> gate could not fail with EITHER half of the fix removed — mutation-tested, 2 of
> 2 single-half mutants left all seven of its shipped-arm predicates green,
> including the mutant where the cascade was dead. §6 is rewritten below with the
> hole named and the row count corrected from 9 to 19.
>
> **4 · Two rows of the opening ruled-out table measured nothing**, and it is not
> the reasoning that is wrong — it is `setFlatten`, which returns `true` for any
> object you hand it, including a key that cannot exist. The joint break is inert
> in *both* directions on this word, and the flat-ink arm set a key that is not on
> `FlatState` at all. **§8 is new** and carries the measurement, the queued fix,
> and the gate row that has to come with it.
>
> Everything else in this file reproduces. The blank does not return, the two
> headline numbers (59 936 against 58 998) were re-measured first-hand, and the
> opening table's central claim is not only intact but is the shape of the
> answer: every candidate reads healthy because **no fragment was ever
> generated**.

The whole mark went blank between DRAW **93 %** and **94 %** and stayed gone to
the end of the beat. Free Stroke engine, the FONT word ("Any text"), wobble 0,
endpoint CLEAN — Sebs's own two dial changes.

Every reading a gate normally takes said the mark was fine:

| candidate | reading | verdict | could it have said otherwise? (§10) |
|---|---|---|---|
| the reveal fraction | 0.9452 → 0.9535, smooth, finite | not it | **yes** — 0.9706 here, 0.5095 one scrub away |
| `setDrawRange` cut to nothing | **335 820 of 359 568 indices submitted — MORE than at 93 %** | not it | **yes** — 343 890 here, 181 452 one scrub away |
| mesh hidden or culled | `visible true`, radius 1.059 | not it | ⚠ **never observed to** — every object in the census reads `true` |
| mesh moved or collapsed | world (0.276, 0.8515, 0), **byte-identical either side** | not it | **yes** — `squashY 0.72` moves it to y 0.8057 |
| material invisible | `opacity 1`, `transparent false`, `colorWrite true` | not it | **yes** — a sibling in the same census reads `opacity 0` |
| ~~indices out of range~~ | `vertexCount 59936`, `maxIndex 59935`, `firstBadIndex null` | ⚠ **the reading is true and the VERDICT IS WRONG** — see §10.2 | **no** — it audits `position` only, and the bad index was in `aFsLetter` |
| the pen carve · the pen tip | OFAT, one at a time | not it | **yes** — 9 594 px and 294 px, both directions measured |
| ~~the joint break~~ | ⚠ **this arm measured nothing** — see §8; and §10 measures WHY: the channel is live, this PLAYHEAD is not | RETRACTED | **no, here** — 0 px in both directions at DRAW 96 %, 437 px at the settled frame |

Page errors **0**. Console errors **0**.

A mark that is submitted, in the right place, at full opacity, with valid
indices, that renders nothing.

---

## 1. Why every one of those readings was true and useless

Two of them were *nearly* the answer and stopped one question short.

**`firstBadIndex null`** audits the index buffer against the `position`
attribute. That is the check everyone writes, and it is not the check WebGL
runs. **A draw is validated against every enabled attribute**, and this geometry
had three:

```
position   59 936
normal     59 936
aFsLetter  58 998        <-- the letter index the cascade rotates by
```

The moment `setDrawRange` reached an index of 58 998 or more, the draw was
`INVALID_OPERATION`. And the consequence is the part worth internalising:

> **The driver does not drop the offending triangle. It drops the whole draw
> call.**

One bad index and 119 856 triangles do not render. That single fact explains
every row in the table above at once — the geometry really was submitted, the
material really was opaque, the fragment tests really were innocent, because
**no fragment was ever generated.** From outside, "the GPU refused this call"
and "every fragment was discarded" are the same blank picture, and nothing in
the repo could tell them apart.

**And Chrome said so, on every frame it drew:**

```
[.WebGL-0x104000f3400] GL_INVALID_OPERATION: glDrawElements:
Vertex buffer is not big enough for the draw call.
```

at **WARNING** level. Every probe in this repo filtered on
`m.type() === "error"`. The message naming the defect was on the console the
whole time, and the instruments were configured not to hear it.

> ⚠ This paragraph originally read *"181 times"*, and that number is a symptom
> count rather than a measurement — **it is however many frames were rendered
> while the mark was broken**, so it scales with how long the page sits at a
> playhead past the cliff and with nothing about the defect. The same known-bad
> re-armed logged **256** on 2026-08-07, twice, in two different lanes. Chrome
> also truncates its own reporting in the same window — *"WebGL: too many errors,
> no more errors will be reported to the console for this context"* appears
> alongside these, measured — so the logged count is not even a complete count of
> the frames it is counting. **What is load-bearing here is the LEVEL, not the
> number**: `warning`, which is why every console-error check in the battery read
> zero. The 181 is kept because it is what the original run recorded.

---

## 2. How the attribute outlived the surface

Two mechanisms, each correct on its own, and nobody owned the seam between them.

**One — the geometry is refilled in place.** `lib/implicit-defer.ts`
`adoptBuffers` (:428-431) hands an off-thread rebuild to the screen by writing
it into the **live** `BufferGeometry`:

```ts
geo.dispose()
geo.setAttribute("position", new THREE.BufferAttribute(b.positions, 3))
geo.setAttribute("normal",   new THREE.BufferAttribute(b.normals, 3))
geo.setIndex(new THREE.BufferAttribute(b.indices, 1))
```

That is not a shortcut, it is the entire mechanism: React cannot see a
`Float32Array` swap, so the mark holds its last good surface and then changes,
instead of freezing for 600 ms. The same contract the pen field uses.

**Two — a consumer writes a third attribute onto that object.**
`components/viewport-3d.tsx` stamps `aFsLetter` — which letter each vertex
belongs to — from an effect:

```ts
useEffect(() => {
  letterPivotsRef.current = letterMap
    ? buildLetterGeometry(meshes, strokes, letterMap, canvasWidth, canvasHeight)
    : null
}, [meshes, strokes, letterMap, canvasWidth, canvasHeight])
```

whose own comment said it *"re-fires exactly when a rebuild produces new geometry
to stamp."* **A refill produces no new geometry object.** None of those five
dependencies moves when the worker lands, so the effect does not re-fire, and
the attribute survives — describing a surface that has been replaced, addressed
by an index buffer built for a different one.

`ownTrianglesWhole` then makes the lengths diverge rather than merely stale: it
splits vertices at letter boundaries (explainer 23), so the stamped attribute is
`previousVertexCount + previousSplit` while `position` is
`newVertexCount + newSplit`. Two numbers that have nothing to do with each other.

Walking Sebs's own sequence and reading the buffers after each step
(`scripts/verify/_probe-lane3-when.mjs`):

```
0 load (traced)    position 74576   aFsLetter 74576    ok
1 engine=free-stroke position 74576 aFsLetter 74576    ok
2 word=font        position 59164   aFsLetter 59164    ok
3 wobble=0         position 58918   aFsLetter 59258    LONGER  — renders, letters wrong, silent
4 endpoint=clean   position 59936   aFsLetter 58998    SHORTER — 181 rejected draws, mark gone
```

### The three outcomes, and only one of them looks like a bug

- new count **<** the stale attribute → renders, every letter index wrong, **silent**
- new count **=** the stale attribute → renders, every letter index wrong, **silent**
- new count **>** the stale attribute → **the driver drops every draw**

Step 3 is the silent one, and it was there in every session: the cascade was
rotating vertices by letter indices measured on a surface that no longer
existed. Step 4 is the one Sebs could see. **The visible defect was the least bad
of the three.**

### Why the first build is safe, and why traced looked clean

A slot's first build never defers (the same rule the pen field states: nothing
that reads the field immediately may read a stale one). So a page that loads and
scrubs is always consistent — which is why the whole verification battery was
green. It takes a *second* build, off-thread, to create the mismatch, and a
second build only happens when a dial moves.

`--word=traced` "swept clean" for the same accidental reason step 3 did: the
vertex count happened to move the harmless direction.

---

## 3. Why the dials were the key, and why the previous lead was wrong

The strongest available lead was that wobble 0 + endpoint CLEAN are the pair
that **resizes the pen field**, and that this was therefore the eraser bug's
neighbourhood (`MORNING-BRIEF.md` §1). That is a good inference from a real
precedent and it is not what this was.

The pen field was measured across the cliff and never moves:

```
93.50 %  INK 23988   field 1114x183  tex 1114x183   penBox [-0.805, 1.028, 0.465, -2.840]
93.75 %  INK     1   field 1114x183  tex 1114x183   penBox [-0.805, 1.028, 0.465, -2.840]
```

Identical. The dials matter for a different reason that happens to coincide:
**they are the dials that trigger a REBUILD.** Wobble and endpoint both produce a
new stroke array, which is what sends the implicit build to the worker. The pen
field resizing and the geometry rebuilding are two consequences of one gesture,
and the previous lead attached the defect to the wrong one.

The distinction is worth keeping, because it changes what a battery has to do to
catch this class: not "move a dial that resizes a texture" but **"move a dial
that rebuilds the surface, then look again."**

---

## 4. The measurement that separated it, in three steps

Each step is here because the one before it left an alternative standing.

**Step 1 — is it the fragments, or the draw?** The previous sweep turned each
fragment test off one at a time and none of them brought the mark back, which
correctly exonerated none of them: OFAT cannot attribute a defect that fires in
two passes at once, and three passes sharing one input is exactly that shape. So
the full power set was driven
(`scripts/verify/_probe-lane3-blank-tail.mjs`):

```
ARM  shipped              ink        1 px    carve 0.70 tipOn 1
ARM  carve OFF            ink        1 px    carve 0.00 tipOn 1
ARM  tip OFF              ink    23727 px    carve 0.70 tipOn 0
ARM  carve + break OFF    ink        1 px    carve 0.00 tipOn 1
ARM  ALL THREE OFF        ink    31173 px    carve 0.00 tipOn 0
```

Only arms with the tip OFF render. (The previous lane read `tip OFF → 1 px`; on
this build it reads 23 727, and the four tip-on/tip-off arms split 4–4 with no
exceptions.)

**Step 2 — but "tip off" changes two things.** It disables the fragment test AND
it pulls the `setDrawRange` boundary back, because the front margin is
`tipOn ? radiusArc * max(2, nose + 1) : 0`. One knob, two effects, is an
uninterpretable arm.

They were separated by holding the playhead still and growing **only** the
margin, using `setPenTipShape({nose, taper})`. Growing `nose` adds triangles and
makes the fragment test *strictly more permissive* (`back = (1 − nose) · radiusArc`
goes negative, which subtracts from the tested quantity). So if the mark dies as
`nose` grows, the fragment test cannot be the cause:

```
nose 2.00   front 0.959376   tris 111560   back -0.004705   INK  24002
nose 2.50   front 0.961729   tris 111761   back -0.007058   INK      1
```

The playhead never moved. It is the drawn triangle set.

**Step 3 — which is not the same as "those triangles are bad".** Read off the
live buffers, the 201 triangles that enter are ordinary: 0 non-finite, 0
degenerate, max edge 0.0071 on a mark 1.56 across. What matters about them is not
their geometry but the **indices** they carry — the first ones past 58 998.

`__inflateProbe.attrCensus()` asks the question `revealState()` never had:
every attribute's length against the largest index the submitted range reaches.
It answered on the first run.

---

## 5. The fix

Two halves, because the defect has two halves.

**One — a refilled geometry may not keep a per-vertex attribute from the build
before it.** `lib/geometry-engines.ts`, in the `onSettled` that already exists
to patch what the in-place refill invalidates:

```ts
const dropped = dropStaleImplicitAttrs(r.geometry)
```

**Dropped, not resized.** A fresh marching-cubes run produces a completely
different vertex ordering, so a stale attribute is not merely the wrong length —
it is the wrong value at every index, which is the silent half of §2. Resizing
it would have fixed the crash and preserved the corruption.

That comment block was already one item short of correct. It said:

> *"what React cannot see, and therefore what has to be patched by hand, is the
> draw-in's arc-length table"*

`revealKeys` was the first such thing. `aFsLetter` was the second, and nobody
added it. The list is now closed by construction: anything the build did not
write is removed.

**Two — the stamp has to follow the surface.** Dropping alone would leave the
cascade with no letters after any dial change, so the viewport re-stamps when it
sees a mismatch — in the **frame loop**, before anything reads the geometry:

```ts
const la = g.getAttribute(FS_LETTER_ATTR)
if (la && la.count === pos.count) continue
restampLetters()
```

Two integers and a comparison in the common case; the expensive re-stamp runs
exactly once per refill. It is deliberately not another effect: the thing it
reacts to is invisible to React *by construction*, so any dependency list would
have the same hole the last one had.

### After

```
0 load (traced)      position 75126   aFsLetter 75126   short none
2 word=font          position 59164   aFsLetter 59164   short none
3 wobble=0           position 58998   aFsLetter 58998   short none
4 endpoint=clean     position 60118   aFsLetter 60118   short none

GL "not big enough": 181  ->  0
```

The 101-step sweep that found it, re-run on the same state, **at `--dsf=2`**:

```
worst single step: 0 px lost      ink at 100 %: 100 690 px      (dsf 2)
```

Before: `94 323 → 1` at the 93→94 % step, and 1 px for every step after.
Picture: `docs/verification/drawin-vanish/lane3-closed/SHEET-blank-tail-CLOSED.png`,
whose header declares the same `dsf 2`.

> ⚠ **EVERY INK NUMBER IN THIS SECTION IS AT `--dsf=2`, AND IT DID NOT SAY SO.**
> The repro command documented in
> `docs/verification/drawin-vanish/BLANK-TAIL-FONT-WORD.md` carries no `--dsf`
> and `_probe-drawin-vanish.mjs` defaults to **1**, so a reader following the doc
> gets a quarter of these numbers and no way to tell which run is wrong. The
> same sweep at dsf 1 reads **23 627 / 23 846 / 25 441** at 92 % / 93 % / 100 %
> — a factor of ~3.96, which is the raster and nothing else. Both arms are on
> disk: `lane3-fs-font-AFTER/` is 2560×2004, `lane1-fs-font-tail-dsf1/` and
> `laneD-audit/` are 1280×1002. **An ink count with no raster beside it is not a
> reading**, and this is the second time in this repo a pixel claim has had to be
> re-attached to its device scale factor.

The frames at 92 % and 93 % are **unchanged** by the fix — 93 445 and 94 323 px
on both arms — which is the control that says this changed the tail and nothing
else. **That control is exact and it is the strongest single line in this
section**: the two numbers are byte-identical on the before and the after arm,
re-verified independently off both artefacts, and the same control reproduces at
dsf 1 (23 627 and 23 846, byte-identical to the dsf-1 before arm). The fix moved
the tail and nothing ahead of it, to the pixel, at both rasters.

---

## 6. The gate, and the hole it was written for

`scripts/verify/assert-drawin-attrs.mjs` — **19 rows, ALL PASS.**

> ⚠ **IT WAS 9, AND WITH 9 IT COULD NOT FAIL ON HALF THE FIX.** §6.5 below is
> the correction; read it before trusting the four numbered claims under it,
> which were true and insufficient.

The claim is not "the font word draws". It is **every per-vertex attribute spans
the index buffer, at every dial position** — and the gate gets there by
*driving the dials*: it clicks the engine pill, clicks the word pill, drags the
wobble slider, clicks CLEAN, and reads the buffers after each.

That is the whole point of it. The mismatch cannot exist on a page that is loaded
and scrubbed, because the first build never defers. **A sweep that never moves a
dial cannot see this class**, and it is the second time that hole has cost this
project a week — the r175 `texStorage2D` eraser bug lived in exactly the same
one.

Four things keep the rows from passing vacuously:

1. **Non-vacuity is asserted first.** The walk must actually have rebuilt the
   surface — `4 distinct vertex counts across 5 steps: 75126 → 75126 → 59164 →
   58998 → 60118`. A page that ignored every dial would trivially keep a matching
   attribute, and would now fail this row instead of passing the next one.
2. **The driver's own verdict is read**, not inferred from pixels — console
   messages at *every* level, because the message that named this defect is a
   warning.
3. **The picture is checked too**, at the playhead that was blank.
4. **The known-bad is the parked prior, re-armed** —
   `setLetterStampFollowsRefill(false)` + `setRefillDropsStaleAttrs(false)`, the
   code that shipped, both asserted to have actually taken. It reproduces the
   original defect exactly:

```
KNOWN-BAD is REJECTED — short ["aFsLetter (58998 <= maxIndex 59935)"]
                      · rejected draws 256 · ink at 97 % 1 px
```

Same 58 998. Same blank.

---

## 6.5. Four was one short, and the missing one was the whole point

Every claim in §6 is true. The gate drives the dials, the non-vacuity row is
real, the console is read at every level, the known-bad is the parked prior and
not a synthetic. And with all four of those in place **the gate stayed ALL PASS
with either half of §5's fix deleted.**

It was found by mutation rather than by reading, which is the only way this class
is ever found. One line did it — the old `:207`:

```js
final.attrs.position === (final.attrs.aFsLetter ?? final.attrs.position)
```

`?? final.attrs.position` **compares `position` with itself when the attribute is
absent.** So the one state the second half of the fix exists to prevent — the
letter attribute gone entirely — evaluated as `59936 === 59936` and read green.
Measured, both arms, seven predicates each:

```
MUTANT A · ensureLetterStamp DISABLED   (drop ON  · stamp OFF)
  :207 PASS  position 59936 · aFsLetter (ABSENT)   <- compares position with itself
  letterCensus: withAttr 0 · 0 distinct letters    <- THE CASCADE IS DEAD
  >>> the gate would read: ALL PASS

MUTANT B · dropStaleImplicitAttrs DISABLED (drop OFF · stamp ON)
  :207 PASS  position 60118 · aFsLetter 60118
  0 of 6 in-place refills dropped anything          <- the silent class is reachable again
  >>> the gate would read: ALL PASS
```

**And the gate never called `letterCensus()` at all**, so nothing in it could see
a cascade with no letters to rotate by — which is exactly what half the fix
exists to prevent.

### Why no reading of the picture could have caught either one

This is the part worth keeping. The 2×2 nobody had run says the two halves are
not two attempts at one fix; they close **different classes**, and neither one's
absence shows up in the mark:

| | drop | stamp | ink at 97 % | rejected draws | aFsLetter | letters |
|---|---|---|---|---|---|---|
| shipped | ON | ON | 24 763 | 0 | 60 118 | 11 |
| drop only | ON | OFF | **24 763** | **0** | **ABSENT** | **0** |
| stamp only | OFF | ON | **24 763** | **0** | 60 118 | 11 |
| known-bad | OFF | OFF | 1 | 256 | 58 998 | 12, one of them empty |

**Either half alone closes the blank.** Both single-half arms render the
identical picture to shipped, with zero rejected draws. So every row the gate
had — the ink rows, the console row, the `short` row — is structurally unable to
separate them, and adding more rows of that kind would have been more green that
could not fail.

- **The DROP closes the SILENT class.** With it on, the attribute is deleted on
  every refill, so `ensureLetterStamp`'s `if (la && la.count === pos.count)
  continue` can never short-circuit. With it off, a refill whose new count
  happens to *equal* the stale count skips the re-stamp and keeps values that are
  wrong at every index — §2's step-3 outcome, which renders a picture nobody can
  tell is wrong.
- **The STAMP keeps the CASCADE alive.** Drop-only leaves `aFsLetter` absent. The
  mark is perfect and the cascade has nothing to rotate by.

### What the rows read instead

Ten new rows, and the two that carry the weight read the **stamp** and the
**mechanism** rather than the picture:

- `letterCensus()` is now read, three ways: the attribute is **PRESENT** (a
  separate row from whether it matches — merging those two is what made the old
  one unfalsifiable), the cascade still has ≥ 2 distinct letters, no triangle
  straddles two letters, and every letter id is a real number. The last of those
  is calibrated by the known-bad, which grows a **12th letter that stringifies
  empty** — the stale buffer being read past its end — alongside thousands of
  triangles whose three vertices disagree (2 452 and 3 018 on two runs; the count
  depends on which rebuild the arm is caught after, the zero on every healthy arm
  does not).
- **The refill's own drop counter.** `INFLATE_DEBUG.staleAttrDrops` increments
  only when `dropStaleImplicitAttrs` actually deleted something, and that
  function returns `[]` *before* deleting when the half is off, so the counter
  cannot move. The row is "every in-place refill cleared the attribute it did not
  write", paired with a non-vacuity row that requires refills to have happened at
  all. Shipped reads **4 of 6**; stamp-only reads **0 of 6** while rendering a
  correct picture. That is the only signal available for a half whose absence is
  invisible by construction.

And the known-bad is now **three** arms, not one — both-off, drop-only,
stamp-only — each asserted to have taken and each required to be rejected, so
the gate re-proves on every run that it can fail on each half separately.
`--mutate=stamp-off` and `--mutate=drop-off` arm one half *before* the walk and
invert the verdict, which is the falsification an outside reader can run in one
command.

The general lesson is the one this repo keeps paying for, and it is not "write
more rows":

> **A fix with two halves needs a gate that can fail on each half alone.** A gate
> that only ever arms both priors together is testing the pair, and a pair is one
> claim wearing two names.

---

## 7. What this costs everyone else, and it is the general lesson

**An in-place refill invalidates everything the object was carrying, not just
the parts the refill wrote.** This repo has now built three of these — the
implicit geometry, the pen field, the tip field — all for the same good reason,
all with the same shape. Each one is a place where an object's contents change
without its identity changing, which is precisely the change React cannot see
and therefore precisely the change no dependency list will catch.

The rule that falls out:

> **If you refill an object in place, you own everything on it — including what
> someone else put there.**

And the smaller one, which cost the most time here:

> **Auditing indices against `position` is not auditing indices.** WebGL
> validates against every enabled attribute. `firstBadIndex null` was true, and
> it was an answer to a question nobody should have been asking on its own.

---

## 8. What this defect's instrument still allows — ~~QUEUED, not fixed~~ **DONE, 2026-08-07 — see §9**

§2's ruled-out table is the most-cited thing in this file, and **two of its
twelve rows measured nothing.** Not because the reasoning was wrong — because the
harness function those rows drive accepts anything you hand it.

`components/viewport-3d.tsx:9144`:

```ts
setFlatten: (o: Partial<FlatState> | null) => {
  setFlatOverride(o)
  return true
},
```

**It returns `true` for `{__laneDBogus: 0}`** — a key that cannot exist —
measured. `Partial<FlatState>` is a compile-time type and this is a
`page.evaluate` boundary, so the object crosses as JSON and carries no check at
all. Its two immediate neighbours deliberately do not behave this way, and they
say why in their own comments:

- `setPenTip` (`:9148`) *"returns false on an unknown name so a sweep cannot
  silently measure the same arm four times, which is exactly how an OFAT sweep
  reports four identical frames as four options."*
- `setPenTipShape` (`:9156`) *"returns false on anything that is not two finite
  non-negative numbers, so a sweep cannot capture one arm twice under two
  labels."*

`setFlatten` is the one that skipped that lesson, **and it is exactly how
`{flat: 0}` became a published verdict.** `flat` is not one of `FlatState`'s
thirteen keys — counted first-hand off `viewport-3d.tsx:870`, whose names run
`:872`–`:1174`: **ink · depth · color · yaw · pitch · shade · shadow · squashX ·
squashY · jointBreak · penCarve · lit · letters**. The arm set nothing, the frame
was identical to the one before it, and the row reported *"not it"* about a path
it had never touched.

Re-run on the fixed build with a negative control — the bogus key, which must
move zero pixels and does:

```
shipped (baseline)                    ink 24542   changed      0
CONTROL · a key that cannot exist     ink 24542   changed      0   <- the floor
flat 0 + depth 1 (THE RETRACTED ROW)  ink 24542   changed     18
  …isolated: flat 0 alone             ink 24542   changed      0   <- DEAD KEY
  …isolated: depth 1 alone            ink 24542   changed     18
jointBreak 0                          ink 24542   changed      0   <- AT THE FLOOR
  …opposite: jointBreak 1             ink 24542   changed      0   <- INERT CHANNEL
penCarve 0                            ink 32185   changed   9594   TOOK
penTip off                            ink 24287   changed    294   TOOK
```

**Two rows measured nothing** — the flat-ink path (a key that does not exist; the
only thing that acted was `depth: 1`, at 18 px, and the verdict was written about
"the flat-ink path") and the joint break (inert in *both* directions on this
word, so a row turning it off could not have come out any other way). **A third
is not evidence**: `ink 0` moves 82 px, 0.33 % of a 24 542 px mark, because

> ⚠ **THREE CORRECTIONS TO THE PARAGRAPH ABOVE, all measured 2026-08-07 and all
> in §10.** ① *"the only thing that acted was `depth: 1`, at 18 px"* — with the
> validator in, the object is refused WHOLE and its valid half no longer applies,
> so **that arm now reads 0 px and the setter returns `false`.** The 18 px is
> kept because it is what the pre-validator build recorded. ② `depth: 1` is not a
> reliable calibration arm anywhere: it moves 0 px on `/` (§9.3), 18 px here, and
> 8 698 px on the same surface once the camera leaves elevation 0. ③ *"the joint
> break … inert in both directions on this word"* is true at THIS PLAYHEAD and
> false about the channel: `jointBreak 1` moves **437 px** at the settled flat
> frame of the same word on the same page. **The row could not have come out any
> other way, and the reason is the playhead rather than the channel** — which is
> a different repair from the one this section proposes.
during the draw the mark is squashed to `scale.z 0.004` and "flat ink" and "lit
form" are nearly the same picture. The arm reached the render; it is far too weak
to exonerate anything. Three rows are sound: `penCarve 0`, `penTip off`, and the
two together.

The point is not the two rows. It is that **the original table had no
opposite-value arm anywhere in it**, and without one a 0-change reading cannot
distinguish *"the arm did not reach the render"* from *"the state was already
what the arm asked for."*

### The fix, written out because whoever takes it should not have to re-derive it

`components/viewport-3d.tsx` belongs to another lane, so this is queued rather
than applied — two live lanes may never hold one file.

1. **Validate the keys.** Give `FlatState`'s thirteen names a runtime array
   beside the type so the two cannot drift (the pattern `IMPLICIT_OWN_ATTRS` in
   `geometry-engines.ts:5634` already uses, and for the same stated reason:
   *"kept beside the switch so the two cannot drift"*). Return `false` if `o` is
   not `null` and any own key of it is not in that array. Copy the comment shape
   from `setPenTip` — the rule is the sentence, not the code.
2. **Validate the values, per key — they are not all numbers.** ~~Ten~~ **ELEVEN
   (⚠ see §9.2 — this arithmetic is wrong, and the sentence above it names all
   thirteen correctly; the validator was built from the corrected count)** of the
   thirteen are numeric and should reject anything non-finite (`setPenTipShape`
   is the precedent); `color` is a `string`; `letters` is a `readonly` array of
   objects. A blanket `typeof v === "number"` would reject two legitimate
   channels, which is the "widen an exemption, never the rule" trap in the other
   direction — a validator that is wrong about a real key gets deleted the first
   time it blocks someone.
3. **Keep `null` meaning "clear"** — that is the documented contract at `:9140`
   and callers rely on it.
4. **The gate row that must come with it**, or this recurs: a sweep row that
   calls `setFlatten({<a key that cannot exist>: 0})` and **requires `false`**.
   The negative control is the point of the change; without the row the change is
   one refactor away from being reverted. It belongs beside the OFAT arms that
   drive `setFlatten`, and it needs no browser state beyond a loaded page.
5. **Then re-run the §2 table** with an opposite-value arm on every channel, and
   correct the two rows above rather than deleting them.

⚠ **And one stale line in the same file, while it is open.**
`viewport-3d.tsx:9176-9184` carries a correction note saying
`assert-carve-graze.mjs` *"has never existed"* and that the control is therefore
*"currently UNGATED."* **Both halves of that are now false.** The note was true
when it was written at 21:29 on 2026-08-04 and false by 21:34 — the file exists
(12 188 bytes, 2026-08-04 21:34), it is listed in `docs/README.md:263`, and both
batteries pick it up off the directory.

It is not merely present, it works. Run bare on 2026-08-07 it emits **9 rows, ALL
PASS**, and it was mutation-tested from a second lane: **blind arms → exit 1;
swapped arms → exit 1 on 6 of 6.** It reproduced the file's own 2026-08-04 header
table bit-identically, on a different bundler, five days later. So the sentence
*"this control is currently UNGATED, and saying so is the point of the
correction"* should now read that the gate exists, passes, and can fail.

That is worth more than a typo fix, because the note is itself an instance of the
class it was written about: **a correction that goes stale is indistinguishable
from the error it corrected.** It currently tells a reader a gate is missing when
that gate is green and falsifiable, which is how a working control gets rebuilt
by someone who believed the comment. Whoever opens this file for the `setFlatten`
change should fix this line in the same pass — it is four lines away.

---

## 9. §8, done — and three things §8 itself had wrong

The queue is cleared. `setFlatten` validates, the gate row exists, and the stale
line four lines away is fixed. All three were exactly where §8 said they were.

**Three of §8's own claims did not survive being built**, and each one is the
same class as the defect §8 was written about — a number or a channel that was
true somewhere else.

### 9.1 · The fix

`FLAT_STATE_KEYS` sits beside the interface with the thirteen names, and
`isValidFlatState` checks **per key**: eleven numeric channels reject anything
non-finite, `color` must be a `string`, `letters` must be an array whose entries
carry four finite numbers and an optional finite `settle`. `null` still means
*clear*. The object is refused **WHOLE** — the same rule `setPenTipShape`
follows, and the reason is §8's own: `{flat: 0, depth: 1}` applying its valid
half is precisely how an arm moves the mark while the row reports a verdict
about the key that did nothing.

§8 asked for the array to be *"kept beside the type so the two cannot drift"*,
citing `IMPLICIT_OWN_ATTRS`. That is a comment, and a comment is a request. Here
the drift is closed by the **compiler**:

```ts
type _FlatKeyMissing = Exclude<keyof FlatState, (typeof FLAT_STATE_KEYS)[number]>
type _FlatKeyExtra   = Exclude<(typeof FLAT_STATE_KEYS)[number], keyof FlatState>
const _flatKeysExhaustive: [_FlatKeyMissing, _FlatKeyExtra] extends [never, never] ? true : never = true
```

Mutation-tested in both directions rather than read: dropping `"lit"` from the
array takes `tsc` from **6 → 7** with the error on that line; adding `"flat"` to
it does the same; reverting gives 6 and **byte-identical** `tsc` output. A
fourteenth channel added to `FlatState` and not to the array is now a build
error, not a validator that quietly rejects a real key.

### 9.2 · Correction — it is ELEVEN numeric, not ten

§8 item 2 says *"Ten of the thirteen are numeric."* Counted off the interface it
is **eleven**: `ink · depth · yaw · pitch · shade · shadow · squashX · squashY ·
jointBreak · penCarve · lit`. Thirteen minus `color` (a string) minus `letters`
(an array) is eleven, and §8's own list in the paragraph above it names all
thirteen correctly — the arithmetic in the following paragraph is what slipped.
Small, and it is the kind of number a validator gets built from.

### 9.3 · 🔴 Correction — `depth: 1` is INERT on `/`, and it caught the new row

§8's re-run reports `depth: 1` as the one thing that acted in the retracted arm,
at **18 px**. That reading is from `/desk-doodles` with the hero pose. The gate
row built for §8 item 4 lives on `/`, and there the same arm reads **0 px** —
because the host already renders this surface at `depth 1`, so the arm asks for
the state it is already in.

The first version of the calibration row used `{depth: 1}` for exactly the
reason §8 recommends it, and **failed on its first run**. Measured on `/` at
playhead 0.50, baseline = no override:

| arm | moved |
|---|---:|
| `depth 1` | **0** |
| `ink 0` | **0** |
| `penCarve 1` | **0** |
| `lit 0` | **0** |
| `depth 0.004` | 43 444 |
| `ink 1` | 44 058 |
| `shade 0.6` | 44 045 |
| `yaw 25` | 41 895 |
| `squashY 0.7` | 75 122 |

Four of the eleven numeric channels are at the floor on this surface. That is
§8's own closing sentence arriving from underneath — *"a 0-change reading cannot
distinguish 'the arm did not reach the render' from 'the state was already what
the arm asked for'"* — and it means **a channel's OFAT verdict is a property of
the surface it was taken on**, not of the channel. The calibration is now
`{flat: 0, ink: 1}` refused against `{ink: 1}` accepted: same shape as the
historical defect, with a control that cannot read zero for the wrong reason.

### 9.4 · The row §8 asked for is eight rows, and it is not where §8 put it

§8 item 4 asks for *"a sweep row that calls `setFlatten({<a key that cannot
exist>: 0})` and requires `false`"*, beside the OFAT arms that drive
`setFlatten`. Those arms live in `_probe-laned-ofat.mjs` and
`assert-hero-flatstate.mjs`, neither of which was this lane's file, so the rows
went onto `assert-stroke-schedule.mjs` §14 — the gate this lane owns, which
already loads the page and drives this harness.

**One row would have been unfalsifiable, and the accept row is the one that
matters.** A blanket `typeof v === "number"` passes the reject row perfectly and
silently breaks `color` and `letters` — §8's own *"widen an exemption, never the
rule"* trap, running the other way. So:

```
PASS  setFlatten({<a key that cannot exist>: 0}) returns FALSE          <- §8 item 4
PASS  …every other malformed object is refused too                      10/10
PASS  …and the sweep still ACCEPTS all THIRTEEN real keys plus null     14/14
PASS  …a REFUSED object sets nothing — unchanged to the pixel           0 px
PASS  …CALIBRATED — the same comparison sees {ink: 1}                   43 599 px
PASS  the setFlatten known-bad ACTUALLY TOOK                            validates true -> false
PASS  …and the KNOWN-BAD REPRODUCES THE DEFECT                          returned true · moved 43 599 px
PASS  …and the known-bad was DISARMED                                   validates back to true
```

The known-bad is **not a synthetic mutant**: `setFlattenValidates(false)` parks
the setter that shipped, and the gate arms it inline, measures, and disarms — so
the control runs on the **bare invocation** rather than behind a flag no sweep
passes (explainer 31 §1). Armed, `setFlatten({__laneMBogus: 0})` returns `true`
and `{flat: 0, ink: 1}` moves 43 599 px while returning `true`. That is the
retracted row, exactly: an arm that set nothing it was asked about, moved the
mark, and published *"not it"*.

`assert-stroke-schedule.mjs` is **60 rows, ALL PASS**, six known-bads.
`assert-drawin-attrs.mjs` — the gate whose whole subject is this file — is **19
rows, ALL PASS**, all three known-bad arms rejected, reproducing §6.5's table
(58 998 · 256 rejected draws · 1 px · spanning 3 018 · a twelfth letter that
stringifies empty).

### 9.5 · The stale line, and it is fixed

Verified first-hand rather than taken from §8: `assert-carve-graze.mjs` exists
(**12 188 bytes, mtime 2026-08-04 21:34**), is listed at `docs/README.md:263`,
and imports `HERO_URL` from `lib/dev-server.mjs` — so it is one of the thirteen
browser gates explainer 27 §1 measured as *unable* to grade the wrong tree. Run
bare on 2026-08-07: **9 rows, ALL PASS, exit 0.**

The note is rewritten to keep the original correction **quoted**, with the date
it was true and the date it stopped being true, because deleting it would lose
why the line is watched. Its falsification (the mutation arms) is **cited, not
re-run**, and the note now says which half is which.

### 9.6 · ~~What is still open~~ — **BOTH CLOSED, 2026-08-07. See §10.**

- ~~**§8 item 5 — re-run the §2 table with an opposite-value arm on every
  channel.**~~ **DONE — §10.** Not done here: it lives in `_probe-laned-ofat.mjs`,
  another lane's file. §9.3's table is the input it needs and says which four
  channels are at the floor on `/`. ⚠ With the fix in, that probe's
  `{flat: 0, depth: 1}` arm now returns `false` and applies nothing, so its
  "18 px" reading becomes 0 — the arm was always a lie and now says so.
  **Predicted here, measured there: it reads 0 px, setter `false`.**
- ~~**`assert-hero-flatstate.mjs` should carry the same negative control**~~
  **DONE — §10.5.** …on the surface whose subject `FlatState` actually is. One
  row, no browser state beyond a loaded page. Not this lane's file. **It took
  ten, and the reason is the same reason §9.4 needed eight: one row would have
  been unfalsifiable.**

---

## 10. The table, re-run with an opposite-value arm on every channel

§8 item 5, done. `scripts/verify/_probe-laned-ofat.mjs`, on the **fixed,
validating** build, in the state the table was taken in — Free Stroke · the FONT
word · wobble 0 · endpoint CLEAN · DRAW 96 % on `/desk-doodles`, read off the
live DOM, headless Chrome with `--use-angle=metal`, dsf 1, stage grab
**1280 × 1001** (`grabInfo()` reports `canvasesInDocument 1 ·
firstUnderContainer true`, so the capture can say what it grabbed).
Artefacts: `docs/verification/laneq-ofat/{laneQ-draw96,laneQ-breath,laneQ-breath-el35}/ofat.json`.

**The noise floor is 0 px** — the shipped frame captured twice is byte-identical
— and the impossible-key control sits on the floor and now says why:

```
shipped (baseline)                      ink 24542   changed     0   setter —
shipped (repeat — the noise floor)      ink 24542   changed     0   setter —
CONTROL · a key that cannot exist       ink 24542   changed     0   setter FALSE
flat 0 + depth 1  (THE RETRACTED ROW)   ink 24542   changed     0   setter FALSE
  …isolated: flat 0 alone               ink 24542   changed     0   setter FALSE
  …isolated: depth 1 alone              ink 24542   changed    18   setter true
```

Every other number Lane D recorded reproduces byte-for-byte on a different tree
five hours later: 24 542 · 32 185/9 594 · 24 287/294 · 24 489/82 · 19 126/8 262 ·
31 918/9 853.

### 10.1 · What a row has to do to be evidence, and the reading that says so

An arm has to change the picture. That is necessary and it is **not sufficient**,
and this run added the reading that separates the two: **the pair diff.** Each
channel is driven to a LOW and a HIGH value, and the number that decides the
verdict is not "did each arm move the shipped frame" but **"do the two arms
differ FROM EACH OTHER"**. Two arms that each move 25 000 px against the baseline
and are byte-identical to one another have measured their PARTNER key, not the
channel — which is precisely what `{flat: 0, depth: 1}` did, and no
against-baseline reading can see it.

| channel | low arm | high arm | low vs shipped | high vs shipped | **low vs high** | verdict |
|---|---|---|---:|---:|---:|---|
| `ink` | 0 | 1 | 82 | 0 | **82** | live; the high arm asked for the state it was in |
| `depth` | 0.004 | 1 | 0 | 18 | **18** | live; the low arm asked for the state it was in |
| `yaw` | −25° | +25° | 6 296 | 6 316 | **82** | live both — see the note below |
| `pitch` | −25° | +25° | 3 121 | 3 099 | **48** | live both — see the note below |
| `shade` | 0 | 0.6 | 0 | 24 699 | **24 699** | live; the low arm asked for the state it was in |
| `shadow` | 0 | 1 | 0 | 0 | **0** | **inert here** — and not inert, §10.4 |
| `squashX` | 0.72 | 1.18 | 26 704 | 31 130 | **32 663** | live both |
| `squashY` | 0.72 | 1.18 | 18 167 | 14 550 | **24 962** | live both |
| `jointBreak` | 0 | 1 | 0 | 0 | **0** | **inert here** — and not inert, §10.3 |
| `penCarve` | 0 | 1 | 9 594 | 8 262 | **15 083** | live both |
| `lit` | 0 | 1 | 0 | 0 | **0** | **inert here** — and not inert, §10.4 |
| `color` | `#d02020` | `#101010` | 25 461 | 25 461 | **25 461** | live both |

> ⚠ **`yaw` and `pitch` move the shipped frame by thousands of pixels and differ
> from EACH OTHER by 82 and 48.** That is geometry, not a defect: at `depth
> 0.004` the mark is a sliver, and `cos(+θ) = cos(−θ)`, so ±25° project to
> near-mirror images. It is recorded because a pair-diff rule that did not know
> this would call two plainly live channels inert — the instrument's own version
> of the mistake this whole file is about.

### 10.2 · The twelve rows, accounted

The twelve are `BLANK-TAIL-FONT-WORD.md:98-111`. **Six are READINGS and six are
ARMS, and they fail in different ways.** A reading fails by answering a different
question; an arm fails by never reaching the render. Lane D found two rows that
measured nothing; with both directions run on every channel and a falsifiability
control on every reading, the count is **three that were never capable of being
evidence, two that are ambiguous, and seven that are.**

| # | row | kind | verdict |
|---|---|---|---|
| 1 | the reveal fraction | reading | **EVIDENCE** — true, and the instrument reads 0.5095 one scrub away |
| 2 | `setDrawRange` cut to nothing | reading | **EVIDENCE** — true, and it reads 181 452 one scrub away |
| 3 | mesh hidden / culled | reading | **AMBIGUOUS** — true, but `visible` has never been observed to read `false` on any object in the census. Nothing here can fail it. |
| 4 | mesh moved or collapsed | reading | **EVIDENCE** — `squashY 0.72` moves world y 0.8515 → 0.8057 and scale y 1 → 0.72, so the reading can say otherwise |
| 5 | material invisible | reading | **EVIDENCE** — a sibling object in the same census reads `opacity 0 · transparent true`, so those fields demonstrably can |
| 6 | out-of-range indices **killing the draw call** | reading | 🔴 **NEVER CAPABLE** — see below |
| 7 | the pen CARVE discard | arm | **EVIDENCE** — 9 594 px, opposite 8 262, pair 15 083 |
| 8 | the pen TIP discard | arm | **EVIDENCE, weak** — 294 px, 1.2 % of the mark; `setPenTip` validates its name, so the arm is known to have taken |
| 9 | both discards together | arm | **EVIDENCE** — 9 853 px |
| 10 | the joint break | arm | 🔴 **NEVER CAPABLE** — 0 px in both directions at this playhead |
| 11 | the flat-ink path | arm | 🔴 **NEVER CAPABLE** — dead key; **the setter now returns `false`** |
| 12 | the ink channel | arm | **AMBIGUOUS** — 82 px, 0.33 % of the mark; the opposite arm reads 0, so the base was already `ink 1` |

**Row 6 is the new one, and it is the most expensive of the three.** Its reading
is true — `vertexCount 59936`, `maxIndex 59935`, `firstBadIndex null`, and I
re-read all three on the fixed build (60 118 / 60 117 / `null`). **Its VERDICT is
false.** Out-of-range indices *were* killing the draw call; `firstBadIndex`
audits the index buffer against `position` and the bad index was in `aFsLetter`.
No sharpening of that row could have caught it, because the row was measuring one
of three enabled attributes and reporting about all of them. §1 and §7 already
say this in prose — *"auditing indices against `position` is not auditing
indices"* — but the table still prints **not it** beside the candidate whose name
is the actual cause, and it has printed that for three days. **A retracted row and
a row whose verdict is simply wrong are not the same defect, and this file had
only marked the first kind.**

### 10.3 · The joint break is a live channel measured on a dead playhead

§8 calls `jointBreak` an *"INERT CHANNEL"* — *"inert in both directions on this
word, so a row turning it off could not have come out any other way."* The first
half is the finding; the second half over-reaches, and the same probe on the same
page proves it:

| surface | `jointBreak 0` | `jointBreak 1` | pair |
|---|---:|---:|---:|
| DRAW 96 % of the FONT word (the table's surface) | 0 | 0 | **0** |
| the settled BREATH frame, same page, dead-on | 0 | **437** | **437** |
| the settled BREATH frame, elevation 35° | 0 | **365** | **365** |

And `assert-hero-flatstate.mjs` has asserted the channel renders since 2026-08-03
— *"jointBreak RENDERS — the junctions open a hairline of paper, 276 px of ink
became paper"* — on the second of those surfaces. **Two instruments in the same
repo held opposite verdicts about one channel, and both were right**, because the
verdict is not about the channel. The row could not have come out any other way,
and the repair is not "wire the channel"; it is "take the arm at a playhead where
the junctions exist."

That is **§9.3's law arriving a third time**, and it is now general enough to
state without a surface attached:

> **A channel's OFAT verdict is a property of the surface, the pose AND the
> camera it was taken on.** `depth: 1` reads 0 px on `/`, 18 px at DRAW 96 % and
> 8 698 px at elevation 35°. `ink 0` reads 82, 3 139 and 23 860 on the same three.
> `shadow 1` reads 0, 0 and **125 344**. An OFAT table with no surface in its
> header is not a table of channels; it is a table of one frame.

### 10.4 · `lit` reads 0 in both directions and is not a dead dial

Under DISPATCH §2.7 — *"a dial whose label does not describe what renders is a
defect — wire it or remove it"* — `lit` looks like one: 0 px in both directions on
all three surfaces. It is not.
`components/viewport-3d.tsx:6430` multiplies the whole rim term by `(1 − k)`,
where `k` is the flat-ink blend. At `ink 1` that factor is exactly zero whatever
`lit` is, so a single-key arm on `lit` asks the channel to act in the one state
where it is arithmetically switched off. Held at `ink 0`, the pair separates by
**25 390 px** at DRAW 96 %, **31 506** at the settled frame and **25 966** at
elevation 35°.

`shadow` is the same shape with a different partner, and
`assert-hero-flatstate.mjs` had already written the reason down: *"a contact pool
is a HORIZONTAL plane; at the beat's parked elevation it is edge-on."* At
elevation 35° it moves **125 344 px**.

> **A single-key OFAT arm on a gated channel is a dead arm with a live name.** It
> is the retracted row wearing different clothes: an arm that could not have come
> out any other way, reporting a verdict about the channel it names. Where a
> channel is gated, the partner is held at the value that lets it act and **the
> pair is diffed against each other**, never against the shipped frame — because
> against the shipped frame both arms move by the partner's amount and the row
> reads healthy.

With that correction, **every one of the eleven numeric channels is live on at
least one of the three surfaces, and no single surface makes all eleven live.**

### 10.5 · `assert-hero-flatstate.mjs` — the control it should have had, and why it is ten rows

§9.6's second open item, closed on the surface whose subject `FlatState` actually
is. **23 rows, ALL PASS, exit 0** (13 shipped + 10 new).

```
PASS  CONTROL · the parked surface is STILL — two frames of one state are identical   0 px
PASS  CONTROL · setFlatten({a key that cannot exist}) returns FALSE
PASS    ...and every OTHER malformed object is refused too                            11/11
PASS    ...and it still ACCEPTS all THIRTEEN real keys, plus null                      17/17
PASS    ...a REFUSED object sets NOTHING — unchanged to the pixel                       0 px
PASS    ...CALIBRATED — the same comparison SEES a legal arm            {squashY: 0.85} 18 780 px
PASS    ...and the calibration arm was CHOSEN ON THIS SURFACE, not inherited
PASS  the setFlatten known-bad ACTUALLY TOOK                              validates true -> false
PASS    ...and the KNOWN-BAD REPRODUCES THE DEFECT           returned true · moved 18 780 px
PASS    ...and the known-bad was DISARMED                                 validates back to true
```

**One row would have been unfalsifiable** — §9.4's lesson, and it is the same
lesson here: a validator that returned `false` for everything would pass the
reject row perfectly and silently break `color` and `letters`. So the accept arm
is 17 of 17 and the reject arm is 11 of 11 across every shape of wrong there is.

**And the calibration arm had to be re-picked, on a third surface, for §9.3's
reason.** At this gate's parked BREATH frame `{ink: 1}` moves **0 px** and
`{depth: 1}` moves **16 px** — both of them the arms an outside reader would
reach for, both silent, both for the right reason. The row asserts that they are
silent and that the chosen arm is not, so the day the host's defaults move, the
gate says so instead of quietly grading nothing.

**Mutation-proved rather than argued.** With `setFlattenValidates(false)` armed
before the block — the parked prior, i.e. the setter that shipped — the gate
exits **1** with three rows red: the reject row, the malformed-set row (`0/11
refused`), and `console clean`. That third one is a finding on its own: with the
validator off, `{letters: 4}` reaches the render and throws
`TypeError: firstElem.toArray is not a function` — **the validator is not only
protecting sweeps from measuring nothing, it is protecting the page from a
crash.** Reverted, the file is byte-identical and so is its output.

### 10.6 · `_probe-lane1-blank-tail.mjs` carried the same dead arm

`:194` drove `setFlatten({flat: 0, depth: 1})` under the label *"flat 0 (lit
solid)"* — the identical dead key, in the probe that produced the original
`blank-tail.json`. Three changes, and the first is the general one:

1. **The setter's return is part of the reading now.** It records only the ink
   before; an arm that never reached the render and an arm that reached it and
   changed nothing print the same number.
2. The retracted arm is **kept and labelled** `RETRACTED · flat 0 + depth 1 (DEAD
   KEY)`, and reads `setter false`. Beside it is the arm it was always trying to
   be — the flat-ink blend is `ink`, not `flat` — as `ink 0 + depth 1`, which
   takes: 24 227 px against 24 542.
3. The impossible-key control and the `jointBreak` / `ink` opposites run on the
   bare invocation.

The 90→100 % sweep on the same run loses **0 px on all ten steps** (23 323 →
25 441 monotone, `firstBad null` throughout), so the closure of §5 reproduces on
a third tree.

### 10.7 · What §10 does NOT close

- **Row 3 (`visible` / `frustumCulled`) is still unfalsified.** Every object in
  the census reads `true` and there is no harness that can set a mesh invisible,
  so nothing available here can make that reading say otherwise. It is almost
  certainly true and it is **not** certified, and the difference is the whole
  subject of this file. A `setMeshVisible` on the probe would close it.
- **Row 8 (`penTip off`) is 294 px, 1.2 % of the mark.** It took — `setPenTip`
  validates its name — but it is at the weak end, and its "opposite" is the
  shipped state by construction rather than a second driven value.
- **The `--surface=breath` arms are on the TRACED word**, not the FONT word: the
  dial walk that reaches the font word is only performed for `--surface=draw96`.
  So §10.3's 437 px is the joint break on the shipped wordmark, which is the
  right subject for that claim and is not the same subject as row 10's.
