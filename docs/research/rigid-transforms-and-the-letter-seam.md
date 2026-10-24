# Rigid transforms, shared pivots, and why the letter seam tore

**What this is for.** The `letterByLetter` cascade turns each letter of the word
on its own axis. At the settled pose it left a white crack through three of the
joins (explainer 23). This is the reading behind that fix: what a "rotation about
a pivot" actually is as a map, why two of them at the same angle are *not* the
same motion, and what the graphics literature already knows about geometry that
straddles two transforms — because this is a known family with a known name, and
we landed on the same side of it that the field did.

Searched and read 2026-08-04. Sources saved to `docs/research/_sources/`.

---

## 1. The one piece of algebra the whole fix rests on

A rotation "about a pivot" is not a rotation. It is a rotation **plus a
translation**, and the translation is a function of the pivot:

```
q = R·(p − piv) + piv
  = R·p  +  (I − R)·piv
   └────┘    └──────────┘
   the       a CONSTANT offset that
   rotation  depends only on the pivot
```

This matters because of what it says about *two* letters:

> Two letters rotated by the **same** `R` about **different** pivots are two
> **different** rigid motions. They differ by the constant
> `(I − R)·(piv_A − piv_B)`.

Ink that was continuous across their join is therefore pulled apart by exactly
that vector. For a yaw θ about the vertical axis and pivots separated along x by
`Δx`:

```
gap in x  =  Δx · (1 − cos θ)
gap in z  =  Δx · sin θ
```

Two consequences we relied on:

- **The gap is zero iff `R = I` or the pivots coincide.** There is no third way
  to close it. Any corrective translation you add reduces algebraically to
  rotating about the shared pivot (worked through in explainer 23 §2).
- **The gap scales with `(I − R)`.** So it must vanish as the yaw unwinds — which
  gave us a falsifiable prediction *before* the fix existed, and the measurement
  matched it: the pre-fix A/B disagreement went **1147 → 889 → 297 → 64 → 4 → 0**
  through `returnTurn` as the shared yaw returned to 0.

The designer's version of the same fact: **a turned word has to get narrower.**
A 30° turn takes `1 − cos 30° = 13.4 %` out of the width. If each letter turns
about its own centre, each letter narrows *in place* and the word keeps its full
width — so the missing 13.4 % has to go somewhere, and it goes into the gaps
between the letters.

---

## 2. This is a named problem: skinning

Character animation has had this exact problem for thirty years, under the name
**skinning**: a mesh vertex sits near a joint and is influenced by two bones,
each with its own transform. The standard method, **Linear Blend Skinning
(LBS)**, blends the transforms:

```
v' = Σ wᵢ · Tᵢ · v          (weights wᵢ sum to 1)
```

The SIGGRAPH 2014 course *Skinning: Real-time Shape Deformation*
(`_sources/siggraph-2014-skinning-direct-methods.pdf`) states the artefacts and,
more usefully for us, states when they **cannot** occur:

> When a single bone influences a vertex (weight = 1.0 for one bone, 0 for
> others), rigid transformation is **exact**. Artifacts arise **only** when
> multiple bones influence the same vertex — the linear blending of
> non-commutative transformations produces unphysical results.

That sentence maps onto our surface one-to-one:

| skinning | our cascade |
|---|---|
| bone | letter |
| joint region between two bones | the ink at a letter join |
| a vertex weighted to two bones | a triangle whose corners have two owners |
| candy-wrapper / collapsing joint | the flat grey slabs Sebs photographed |
| single-bone (rigid) binding | whole-triangle ownership |

**We took the rigid-binding side of that trade deliberately**, and the source
comment in `viewport-3d.tsx` already argued it on craft grounds before any of
this was read: a blend "makes the boundary geometry a rubber sheet between two
objects, which is the read the board rejects," whereas whole triangles "give each
letter a rigid shell." The literature agrees on the mechanism and adds the reason
it is also the *only* exact option: rigid binding has no blend to be wrong.

**What the literature does not say, and we had to derive.** The skinning
artefacts are about *deformation quality* inside a blend region. Ours was
different: with a rigid binding there is no deformation error at all — instead
the two rigid shells **separate**, because they are two different motions. The
survey material we found (dual-quaternion skinning and friends) is entirely aimed
at making the *blend* better; none of it addresses "the binding is rigid and
correct and the parts have come apart," because in a character rig the bones
share a joint by construction. Our letters do not share anything until we make
them. That is why the fix is a converging **pivot**, not a better blend.

---

## 3. Why dual quaternions were not the answer here

DQS (dual-quaternion skinning) is the standard upgrade: blend rigid transforms as
dual quaternions instead of blending matrices, which keeps the blended transform
rigid and kills the candy-wrapper. It is genuinely the right tool for a character
arm.

It is the wrong tool here, for two reasons that are ours and not the field's:

1. **It solves the blend, and we do not want a blend.** DQS would give a smooth
   rigid interpolation *through* the join — which is the rubber-sheet read the
   board rejects. The film's claim is that each letter is its own object.
2. **It does not close the settled seam.** At the settled pose every letter is at
   the same yaw, so any blending scheme returns that same yaw — about whichever
   pivots you gave it. The gap is a property of the *pivots*, not of the blending
   method, so no interpolation scheme removes it.

Stated plainly because it is worth keeping: **the seam was never a blending
problem.** It looked like one for as long as the symptom was slabs.

---

## 4. What we built, in one line each

- `LetterState.settle` — a scalar per letter, 0 = turn about my own centre,
  1 = turn about the word's. Held at 0 through the first half of each flip, eased
  to 1 by the end of it.
- The pivot handed to the shader is `lerp(own, word, settle)`, computed on the
  CPU. **The lerp is on the pivot, never on the result** — interpolating two
  posed points would shrink the letter mid-flip; a moving pivot keeps every frame
  an exact rigid motion.
- At `settle = 0` the rotation is the identity, so the pivot is unobservable and
  the glide is free where it starts. At `settle = 1` every landed letter shares
  one axis, so the settled rank is one rigid motion — and a rigid motion of a
  continuous surface is continuous, which is a theorem rather than a tolerance.

---

## Sources

- [SIGGRAPH 2014 Course — *Skinning: Real-time Shape Deformation*, direct
  methods](https://skinning.org/direct-methods.pdf) — the LBS formula, the
  candy-wrapper and collapsing-joint artefacts, and the statement that rigid
  single-influence binding is exact and artefacts arise **only** under multiple
  influence. Saved: `_sources/siggraph-2014-skinning-direct-methods.pdf`.
- [Bulging-free dual quaternion skinning — *Computer Animation and Virtual
  Worlds*](https://dl.acm.org/doi/10.1002/cav.1604) — DQS removes the
  candy-wrapper and preserves volume, at the cost of a joint-bulging artefact.
  Read for the trade-off only; not used, for the reasons in §3.
- [*The skinning in character animation: A
  survey*](https://francis-press.com/uploads/papers/cG4LVr6lQiYEurCzBzzuVCkbV6taxZ4kEYJKgLAz.pdf)
  — background on the LBS/DQS family and hybrid schemes.
- [dualQuaternionSkinning — side-by-side LBS vs DQS
  implementation](https://github.com/ishmeetkohli/dualQuaternionSkinning) — the
  cylinder-twist demonstration of the artefact.

⚠ **Honest scope note.** These are read for MECHANISM and vocabulary. None of
them is a reference we built *from* — the fix is derived from our own transform
algebra (§1), and the literature's contribution is the confirmation that rigid
binding is the exact option and the name of the family we are in. The
image-gate / ≥8-saved-reference standard in `HARDENED-IDEATION-DISPATCH.md` is
aimed at option and treatment *ideation*, where the risk is a derivative visual
idea; it does not bind a root-cause fix to a shader transform, and stretching it
to one would have produced padding rather than evidence.
