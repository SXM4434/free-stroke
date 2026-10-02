# 23 — The seam the slabs were hiding

Sebs, 2026-08-04, a screenshot of `letterByLetter` on the **Free Stroke** engine,
look Desk Doodles, camera dead-on, parked at **SOLID 57 %**:

> *"look how the [mesh] gets fucked on letter by letter."*

Hard-edged flat grey slabs sticking out of seven letters. A previous pass found
why those slabs exist, removed them, and left **11 gate rows ALL PASS**.

**The picture was still wrong, and the second wrong was worse than the first.**

---

## 1. What the first fix did, and why its gate could not see the rest

The cascade rotates each letter on its own beat. Inflate builds the whole word as
**one fused surface**, so there is no per-stroke mesh to label and every *vertex*
takes the letter whose ink is nearest. A triangle with one corner in the `e` and
two in the `s` therefore has one corner on one rigid body and two on another, and
the instant those two yaws differ it is stretched flat across the gap. That is a
slab.

`ownTrianglesWhole` gives every triangle a single owner, splitting vertices where
two owners meet. It works and its census is honest: **788 spanning triangles
before the split, 0 after, 550 vertices duplicated** out of ~148 000 triangles.
`assert-letter-seam.mjs` states it as a topology claim, which needs no camera and
no screenshot, and it passes.

**And a topology claim cannot see a picture.** Zero spanning triangles proves the
stretched sheets are gone. It does not prove the seam now reads as ten objects
rather than as one torn one — and it did not.

Driven at the exact state in his screenshot, the two triangle-ownership arms
disagree on a **constant 1 147 px for the whole 2.2 s solid hold**, and at 6× the
shipped arm carries a **white stippled crack straight through the `e|sk`, the
`d|l` and the `e|s` joins**:

`docs/verification/letter-seam-picture/cascade/SHEET-127.png` — left column the
parked prior, right column shipped. The slabs had been *covering the gap*.

---

## 2. The gap is arithmetic, not a raster artefact

This is the part worth understanding, because it decides the fix.

A letter's pose, in the shader (`fsLetterPose`), is a rotation about that
letter's own pivot:

```glsl
q -= piv;
q  = R * q;          // R = rotation by this letter's yaw, in the xz plane
q += piv;
```

Expand it and the pivot does not disappear — it becomes a **translation**:

```
q = R·p + (I − R)·piv
```

Two letters at the **same yaw** but **different pivots** are therefore two
**different rigid motions**. Subtract them and the ink that used to be continuous
across their join is pulled apart by exactly

```
Δ = (I − R) · (piv_A − piv_B)
```

For a rotation by θ about the vertical axis, with pivots separated along x by
`Δx`, that is

```
Δx-component  =  Δx · (1 − cos θ)
Δz-component  =  Δx · sin θ
```

The cascade lands **every** letter on one shared yaw — `letterLandYaw`, **30°** —
and then *holds it there for the entire 2.2 s SOLID beat*. So at the settled pose
every join is pulled open by `1 − cos 30° = 13.4 %` of the pivot separation in x
and `sin 30° = 50 %` in z. On this word the letters' own centres span **1.957**
world units, so the outermost pair is displaced by ~0.26 units against a stroke
half-width of about a hundredth of that.

There is a second way to say the same thing, and it is the one a designer will
recognise: **a turned word must get narrower.** A 30° turn takes 13.4 % out of
the word's width. With per-letter pivots each letter narrows *in place*, so the
word keeps its full width and the missing 13.4 % opens up **as gaps between the
letters**. The cascade's payoff was a word that never actually turned.

### Why "just close it" reduces to one answer

It is tempting to add a corrective translation per letter. Try it: to close the
seam you must add `t_L = (R − I)(piv_L − piv_word)`, and

```
R(p − piv_L) + piv_L + (R − I)(piv_L − piv_word)  =  R(p − piv_word) + piv_word
```

— rotation about the **word's** pivot. So there is no third option. **The seam is
closed if and only if every letter shares one pivot.** Not a tolerance to tune;
an identity.

---

## 3. The fix: the pivot has to arrive

If a shared pivot were used *throughout*, each letter would swing on the word's
axis instead of turning in place — the exact failure `FlatState.letters` warns
about (*"a mis-placed axis makes a letter sweep sideways instead of turning in
place"*), and the read the whole film exists to produce.

So the pivot is not fixed, it **arrives**. `LetterState` gains one channel:

```ts
/** 0 = this letter turns about its own centre, 1 = about the word's. */
settle: number
```

held at **0 across the first half of each flip** and eased to **1 by the end of
it**, on the same `easeInOutCubic` the depth already arrives on:

```ts
function letterSettle(u: number): number {
  return easeInOutCubic(clamp01((u - 0.5) / 0.5))
}
```

Three things make this cheap rather than clever:

- **At `u = 0` the rotation is the identity**, so the pivot is unobservable
  there. The glide costs nothing at the start — it can only be seen where it is
  already doing work.
- **At `u = 1` every landed letter shares the word's axis**, so the settled rank
  is one rigid motion and the seam is closed *by construction*. A rigid motion of
  a continuous surface is continuous; that is a theorem, not a measurement.
- **It never reaches the GPU.** The shader already takes a per-letter pivot
  uniform, so the interpolation happens on the CPU when that uniform is written:

  ```ts
  piv[i * 2] = own + (geo.wordX - own) * settle
  ```

  No new uniform, no new attribute, and **not one line of the carve, the joint
  break or the tip passes changed**.

Two details that are easy to get wrong:

- **The lerp is on the PIVOT, not on the result.** Interpolating between two
  posed points would shrink the letter through the middle of its own flip; a
  moving pivot keeps every frame an exact rigid motion.
- **On the return it is pinned at 1.** Every letter unwinds on one shared yaw
  there, so holding the shared axis keeps the seam closed for the whole unwind —
  and at yaw 0 the pivot stops mattering again.

The word's axis is measured in `buildLetterGeometry`, from the **same ink samples
the per-letter pivots come from, in the same frame** — deliberately not read off
the whole-word turn's `cx`, which lives in the group's *parent* frame. Two
numbers for one axis in two frames is the "one knob, two names" defect this repo
spent a session collapsing.

---

## 4. What it is worth, measured

`_probe-lane1-cascade-diff.mjs` shoots the same 155 playheads on both arms across
the whole film and reports, per frame, how many pixels disagree.

| | before | after |
|---|---|---|
| disagreement summed over `land` + `solid` (23 frames) | **26 381 px** | **0** |
| worst single frame in the settled hold | **1 147 px** | **0** |
| frames of the settled hold that differ at all | **23 of 23** | **0 of 23** |
| disagreement summed over the whole film | 57 892 px | 21 399 px |

The residue is entirely inside `emerge` — the cascade itself, where one letter
has turned and its neighbour has not. **That separation is correct and is the
film**; the settled hold is the part that had to close.

And the mechanism predicted its own signature before the fix existed: because the
gap is `(I − R)·Δpiv`, it must vanish as the yaw unwinds. The pre-fix diff does
exactly that through `returnTurn` — **1147 → 889 → 297 → 64 → 4 → 0** as the
shared yaw returns to zero. A defect that scales with `(I − R)` is a pivot
defect, and nothing else.

**Sheets:**
`docs/verification/letter-seam-picture/cascade/word-whole/zoom-127.png` (cracked)
against `docs/verification/letter-seam-picture/cascade-after/word-whole/zoom-127.png`
(closed), and the driven A/B of the fix's own control in
`docs/verification/letter-seam-picture/settle-ab/SHEET-127.png`.

---

## 5. The gate, and the invariant it was missing

`assert-letter-seam.mjs` keeps every row it had — the census is still true and
still non-vacuous — and gains the claim it could not state:

```
PASS  …and the letters really do have DIFFERENT centres, so there is something to converge — own-axis spread 1.9574
PASS  …and every letter has LANDED — one shared yaw — yaw spread 0.00e+0
PASS  …at a yaw that is not zero, so the axis is observable at all — |yaw| 0.5236 rad
PASS  THE SEAM IS CLOSED — every landed letter turns about ONE axis — live-axis spread 0.00e+0
PASS  KNOWN-BAD (each letter on its OWN axis) is REJECTED — live-axis spread 1.9574 (bar 1e-3)
```

Four things about that block are deliberate:

1. **It reads the axes the GPU was handed**, published from the frame loop
   (`__inflateProbe.letterPivots()`), not the ref that fed them. A builder that
   reports a fix it did not perform is the green-that-cannot-fail shape this repo
   has been burned by twelve times.
2. **The settled pose is found, not typed.** The transport is scanned for the
   phase by *name*. A hardcoded second is the drift class that had
   `assert-hero-transition` grading a four-day-old capture.
3. **Non-vacuity is checked in both directions.** The claim is empty if the
   letters' own centres already coincide, and empty if the settled yaw is 0 —
   because a rotation of 0 is the identity about *any* axis. `letterLandYaw: 0`
   is a real reachable arm, so that had to be asserted rather than assumed.
4. **Its known-bad is the parked prior**, `setLetterSettle(false)`, which
   re-renders the crack. It is a *uniform*, so unlike `setLetterWholeTriangles`
   it takes on the next frame and needs no rebuild — and the gate asserts it
   actually took, so a sweep cannot measure the same arm twice.

**20 rows, ALL PASS**, both known-bads rejected.

---

## 6. The lesson, and it is the same one twice

The first fix was correct, its gate was honest, its census was exact, and the
work was not done — because the thing the gate could state was not the thing
Sebs was looking at. *Zero spanning triangles* and *the seam reads closed* are
different claims, and only one of them had an instrument.

> A gate that cannot fail is the lie this repo keeps finding.
> **A gate that can fail, about the wrong question, is the subtler one.**

The eye is what caught it: the census said 0 and the picture said crack. Nothing
in the numbers disagreed with the numbers.
