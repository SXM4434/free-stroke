# Stroke width: getting the mark off the monoline

*The other half of [handwriting-variability.md](handwriting-variability.md). That
one covers where the pen goes. This one covers how thick the mark is once it
gets there — which is the part we currently do not model at all.*

---

## The bottom line

**First, the finding that reframes the complaint.** The PostScript / PDF / SVG /
Canvas stroke model is *defined* as a nib held permanently perpendicular to
travel — Kilgard quoting the PDF spec: "paint a line … **centered on the segment
with sides parallel to the segment**", and his own gloss, "a wide-but-thin 'pen
tip' that sweeps the trajectory **orthogonal to the trajectory's gradient**".
The monoline is not a defect in our code. It is written into the definition of
stroking in every graphics API any of us has ever used, and we inherited it
without noticing. See §3.4.

**Then, the fix. Implement the broad-nib model as a global affine map.** Width from stroke
direction against a fixed nib angle, no pressure involved, no new width channel:

```
half-width h(psi) = sqrt( a^2 * sin^2(psi) + b^2 * cos^2(psi) )     psi = theta - alpha
```

and in 3D you do not evaluate that formula at all — you get it for free by
pre-transforming the centreline with the inverse of the nib's own affine map,
sweeping the round tube we already sweep, and mapping the vertices back. That is
a generalisation of code `lib/geometry-engines.ts` **already contains** (the Z
pre-scale at `:5532-5545`, inverse-transpose normals and all), so the nib costs
one 3×3 matrix and no new geometry path.

**Do not route the nib through `Point.pressure`.** The existing channel caps
stroke contrast at **2.077 : 1** (measured below from our own constants). A
broad nib runs 5:1 to 10:1. The shortcut recommended in
[desk-doodles-handfeel-port.md §7](desk-doodles-handfeel-port.md) cannot express
the thing it recommends.

**Do not synthesise width from velocity.** Our two real inputs — a traced font
and an SVG — have no velocity either. The `t` we carry is a synthetic
parameterisation, so a velocity-driven width model would be a curvature model
wearing a hat, and we already have a curvature model (`inflateSynthPressures`).

**Three corrections to things that are widely believed, added in a later pass.**

1. **Pen angle and letter slant are different axes, and the founding primary
   text teaches 0°, not 30°.** Johnston's *Writing & Illuminating, & Lettering*
   (1906) names three independent degrees of freedom and collapses them onto one
   controlled quantity — the chisel edge parallel to the writing line. That is a
   **0° pen angle**. The familiar 30° is later teaching tradition. §1.3.
2. **"Faster writing presses lighter, so the line thins" is folklore.** The one
   study that measured pen force against pen-point kinematics directly reports
   that coherence "never reached a value above 0.3 in any condition" and
   concludes "pen force appears to be a separate control variable". The same
   sentence rules out the curvature route explicitly. §2.2.
3. **The swept solid is a Minkowski sum, and Minkowski sums do not cusp.** The
   `κ > 1/r` failure everybody quotes is a property of the offset *curve*, not
   of the solid. Verified here to **zero symmetric difference** on a loop where
   `κ·a = 1.667` — i.e. deep inside the regime where the offset curve has
   inverted. §4.5 corrects §4.4's fourth caveat, which was wrong as written.

And one piece of positive evidence that this whole document is aimed at a real
effect rather than a plausible one: **direction-dependent ink width identifies
individual writers at 63–95% accuracy** (§1.6).

---

## 0. What we actually have, stated precisely

Before the literature, the three facts that decide which techniques can land.

**The pressure channel is a lie, not a gap.** `PointerEvent.pressure` reports
`0.5` for a pressed mouse button, `app/page.tsx:190` bakes a constant `0.6`, and
the capture font writes none at all. The codebase already knows this — the
`INFLATE_PRESSURE_FLAT_EPS = 0.02` variance test at `geometry-engines.ts:4896`
exists precisely because `?? fallback` is silently defeated by a constant. So we
are not waiting on a stylus; we have decided we will never have one.

**Every renderer we own is a monoline.** The 2D half of the hero beat is
`ctx.lineWidth` with round caps (`lib/flat-ink.ts:104-106`,
`scripts/capture/compose.mjs:155-157`). Extrude's ribbon has a rectangular
cross-section that follows the tangent with a **constant** `halfWidth`
(`geometry-engines.ts:1400-1404`) — directional in its normals, monoline in its
silhouette. Inflate sweeps an ellipse whose axes are locked to (across-stroke,
+Z), i.e. a pen held permanently flat to the page.

**The one width model we do have is curvature-driven.** `inflateInkWidthProfile`
= a sine-eased end taper × a curvature term, both feeding a ±35% multiplier.
That is the whole of it.

---

## 1. The nib model — width from direction alone

### 1.1 The law

A broad-edged pen is a rigid convex shape dragged along a path. Its mark is the
**envelope** of that shape — in modern terms the Minkowski sum of the trajectory
with the nib. John Hobby's Stanford thesis *Digitized Brush Trajectories* (1985)
and his JACM paper are the canonical maths of it; the ACM summary of the problem
is

> finding a discrete set of pixels that approximates the envelope of a convex
> brush shape with respect to a given trajectory

The convexity requirement is not decoration — a non-convex pen's envelope has
pieces the pen can never reach, so the boundary stops being a simple offset.

This is the model METAFONT and MetaPost are built on, and the way they express
it is the whole of §4.3 in one line. From Heck's *Tutorial in MetaPost*, §4.3,
verbatim:

> You can create an elliptically shaped and rotated pen by transforming the
> circular pen. An example:
> ```
> pickup pencircle xscaled 2bp yscaled 0.25bp rotated 60
> ```

**An elliptical nib is not a new primitive — it is an affine transform of the
round one.** Note also the numbers Heck reaches for by default: `2bp × 0.25bp`
is an **8:1** nib at **60°**. Polygonal pens exist too (`makepen(p)` from a
closed path), which is the general convex-pen case; the ellipse is the case with
a closed form.

For an elliptical nib with semi-axes `a` (along the nib angle `alpha`) and `b`
(across it), travelling in direction `theta`, the **half-width measured
perpendicular to travel** is the support function of the ellipse evaluated at
the path normal:

```
psi  = theta - alpha
h(psi) = sqrt( a^2 * sin^2(psi) + b^2 * cos^2(psi) )
full width = 2 * h(psi)
```

*Verified numerically here* against a brute-force 2-million-sample maximisation
over the ellipse boundary — agreement to 6 decimal places at four
(a, b, alpha, theta) combinations. The degenerate flat nib `b -> 0` collapses to
the form usually quoted informally:

```
w(theta) = W * |sin(theta - alpha)|
```

**The contrast ratio a nib produces is exactly `a/b`**, and it is exercised at
every angle, because `sin^2 + cos^2` sweeps the whole range. No tuning curve, no
gamma, no dial: one aspect number *is* the contrast.

### 1.2 The part that gets implemented wrong

The outline is **not** the centreline offset along the normal by `h`. The
contact point also moves *along the tangent*. From the support-function
parameterisation of a convex curve — standard convex geometry, e.g. the
statement of it in the numerical-shape-optimisation literature:

> x₁(θ) = p(θ)cos θ − p′(θ)sin θ,  x₂(θ) = p(θ)sin θ + p′(θ)cos θ

i.e. `x = h·n + h'·t`. For our ellipse that tangential term is, in closed form,

```
tangential offset = ( (b^2 - a^2) * sin(2*psi) ) / ( 2 * h(psi) )
```

*Verified numerically* against brute force (6 dp). **It is not small.** For a
5:1 nib (`a=1, b=0.2`) at `psi = 45°`:

| quantity | value |
|---|---|
| perpendicular half-width `h` | 0.7211 |
| tangential offset | −0.6656 |
| ratio | **0.923** |

The contact point is displaced along the stroke by 92% of the half-width. Two
consequences, both visible:

- **Stroke ends are cut at the nib angle, not square.** The slanted entry and
  exit of an italic stem is the single most recognisable broad-nib feature, and
  it lives entirely in this term.
- On a straight run `psi` is constant, so the shift is constant and slides the
  outline harmlessly. It only bites at ends and where direction changes — which
  is exactly where handwriting lives.

An implementation that varies the width and keeps offsetting along the normal
gets a *directionally varying monoline*, not a nib. That is a real trap and it
is cheap to fall into.

### 1.2b How big the tangential term actually gets, in closed form

The 0.923 figure above is the value at `psi = 45°`. **It is not the maximum**,
and the maximum is much larger. Maximising `|h'|` over `psi` (substitute
`u = sin^2 psi`, differentiate, and the algebra collapses):

```
u* = b / (a + b)                    i.e.  sin^2(psi*) = b / (a + b)
max |h'(psi)|        = a - b
max |h'(psi)| / h(psi) = (a^2 - b^2) / (2ab)  =  (1/2)(a/b - b/a)
```

*Derived here; verified numerically* against a 20 000-point sweep, agreeing to
every digit shown:

| nib | max abs. tangential offset (a = 1) | max tangential ÷ perpendicular | same ratio at psi = 45° (§1.2's figure) |
|---|---|---|---|
| 2.5 : 1 | 0.600 | 1.05 | 0.724 |
| 3.3 : 1 | 0.697 | 1.50 | 0.832 |
| **5 : 1** | **0.800** | **2.40** | 0.923 |
| 6.7 : 1 | 0.851 | 3.28 | 0.956 |
| 10 : 1 | 0.900 | 4.95 | 0.980 |

Two things fall out. **`max |h'| = a − b` exactly**, so the contact point
sweeps the full length of the nib as direction turns — for a flat nib (`b → 0`)
the total excursion is `2a`, the whole nib. And the *ratio* peaks not at 45° but
near the hairline, where `h` is small: at a 5:1 nib the contact point can sit
**2.4 half-widths ahead of or behind** the centreline point it belongs to. The
"cut at the nib angle" look is not a subtle end-effect. It is the dominant
geometric feature of the mark near hairline directions.

### 1.2c Direction reversals and cusps

`h` and `h'` are both **π-periodic** in `psi` — verified numerically,
`max |h(psi) − h(psi+π)| = 8.9e-16`. So reversing direction does not change the
width at all: the mark is the same thickness coming back as it was going out,
which is correct, because the nib is a rigid shape and it does not care which
way it is being dragged.

The **outline**, however, is discontinuous. At a reversal `T → −T` and `N → −N`,
so the contact point `x = h·N + h'·T` maps to `h·N − h'·T`: the perpendicular
component is unchanged and **the tangential component reverses sign**. The
outline jumps by `2|h'|`, bounded by `2(a − b)`.

| pen | outline jump at an exact reversal |
|---|---|
| round (`a = b`) | **0** |
| 5 : 1 nib, worst direction | 1.60 × the semi-major axis |
| flat nib (`b = 0`) | the entire nib length, twice over |

**That is why no round-pen stroker has ever had to think about this, and why
every one of them will be wrong the moment a nib is switched on.** For a circle
`h' ≡ 0` identically, so the offset-along-the-normal shortcut is exact; the
whole error term this section is about is invisible until the pen stops being
round.

Three ways to handle it, and only one is cheap:

- **Union / Minkowski (§4.5): nothing to do.** The nib body covers the gap by
  construction. There is no reversal case, because there is no outline.
- **Outline construction: insert the arc of the nib's own boundary** between the
  two contact points. This is the exact analogue of a round cap being a
  semicircle — for a nib it is the corresponding piece of the nib's boundary.
  Skip it and the stroke has a gap of up to `2(a − b)` at every cusp.
- **Ignore it** and you get the notch that Kilgard's fourth acceptance case in
  §3.5 is specifically designed to catch.

This is not hypothetical for us. *Measured here* on
`scripts/capture/logo-strokes.json`: the worst place in our own word **turns
177.3° within 11.58 units of arc** — one current half-width — which is a
direction reversal at pen scale in everything but name.

### 1.3 Pen angle is not slant, and the primary source says 0°

Pen angle is the angle of the **nib edge** to the writing line; in our notation
it is `alpha`, and the hairline appears when travel is parallel to it
(`psi = 0`, `h = b`).

**Almost every source conflates it with something else.** "30° italic" is
routinely written as though the 30° and the italic slope were one setting. They
are two independent axes: `alpha` rotates the *tool*, slant shears the
*letterform*. You can write upright letters with a slanted pen and sloped
letters with a flat one, and historically both were done.

The book that started the modern broad-nib revival says so explicitly, and it
names **three** degrees of freedom, not two. Edward Johnston, *Writing &
Illuminating, & Lettering* (1906), verbatim:

> *The slant at which the shaft is held*, *The angle at which the nib is cut*,
> and *The tilt which may be given to the paper*: must be so adjusted, one to
> another, that the chisel edge of the nib is parallel to the horizontal line of
> the paper.

Three knobs, one controlled quantity. And the controlled quantity is
`alpha = 0`. He is unambiguous about what that buys:

> the edge of the nib is parallel with the horizontal line of the paper, and
> will therefore produce a horizontal thin stroke and a vertical thick stroke

and states it as the requirement on the whole hand:

> provided that, for writing an upright round-hand, the pen be so manipulated
> and cut as to make fine horizontal thin strokes and clean vertical thick
> strokes

The worked example is the clearest demonstration that shaft posture and pen
angle are decoupled:

> For example: if the shaft is held slanted at an angle of 70° with the
> horizontal, the nib is cut at an angle of 70° with the shaft

— a hand posture of 70°, a pen angle of 0°. And he uses "slanted pen" as the
name of a *different, historical* practice, not of his own:

> *SLANTED-PEN or TILTED WRITING.*—The forms of the letters in early writing
> indicate an easily held pen—slanted away from the right shoulder.

> The slanted pen naturally produced *oblique* thick strokes and thin strokes,
> and the letters were "tilted"

**So the Foundational hand — the thing every later source calls a 30° hand — is
in its own founding text a 0° pen-angle hand.** The 30° is teaching tradition
that accumulated afterwards. Both are real hands; they are not the same hand.

**This inverts §1.4's scoring criterion.** That section ranked pen angles by how
little of our word collapses to hairline, and 0° scored badly (16.7% of pen
travel goes hairline, against 9.5% at 30°). But Johnston *wants* the horizontal
hairline — "fine horizontal thin strokes" is the stated goal, not a cost.
Hairline travel is the effect, not the damage. Re-reading §1.4's table with that
correction, only one row is actually destructive: **90°, where 35.2% of travel
goes hairline because the near-vertical stems — a third of the word — are the
thing being erased.** Stems carry letter identity; horizontal joins do not. The
honest conclusion is that `alpha` between 0° and 45° is a *style* dial with no
legibility cost, and 90° is the only setting that breaks the word.

**Source-quality warning on the table below, stated plainly**: unlike Johnston
above, it comes from calligraphy *instruction* — teaching material, not primary
scholarship or measurement. The values are consistent across independent sources
and consistent with the geometry, but they are conventions taught to beginners,
and real scribal practice varies. Where they disagree with Johnston, Johnston is
the primary source and the table is not. Treat them as starting dial positions,
not constants.

| hand | pen angle | x-height in nib widths |
|---|---|---|
| Foundational / Round Hand | 30° — **but see Johnston above: the 1906 text specifies 0°** | 4–5 |
| Italic / Chancery | 30° (45° on diagonals) | 5 |
| Blackletter / Textura | 35–45°, taught from 40–45° | 4–5 |
| Uncial | shallow, near 10–25°, minimal variation | 3–4 |
| Copperplate | **not a broad nib** — pointed flex nib, pressure-based | — |

Copperplate is the one to keep straight: its thick–thin comes from *pressure
splaying a flexible point*, not from angle. Any "calligraphy" reference that
mixes the two will give contradictory advice, and many do.

Two independent cross-checks on the aspect ratio, both from graphics authors
rather than calligraphers, both landing in the same place as §1.4's measured
knee. Heck's default worked example reaches for `xscaled 2bp yscaled 0.25bp` —
an **8:1** nib — at **60°**. And Knuth, *The METAFONTbook*, ch. 16
("Calligraphic Effects"), verbatim:

> pensquare xscaled 30 yscaled 3 rotated 30;
>
> this pen has a rectangular boundary measuring 30 pixels × 3 pixels, inclined
> at an angle of 30◦ to the baseline.

**10:1 at 30°.** Three sources, no shared lineage, all between 8:1 and 10:1 and
between 30° and 60°. That is about as much triangulation as this parameter is
going to get.

### 1.4 What our own word says

Measured directly from `scripts/capture/logo-strokes.json` (1100 × 242, 22
polylines, 1056 segments, **3194.7 units of pen travel**), arc-length-weighted
direction census, directions taken mod 180°:

| band (canvas, +y down) | share of pen travel |
|---|---|
| 75–95° (near-vertical stems) | **33.2%** |
| 0–10° + 170–180° (near-horizontal) | 13.9% |

Feed that through the nib law and ask how much of the word collapses to hairline
(width below 30% of maximum) for a 6.7:1 nib:

| pen angle (conventional) | pen angle (canvas) | pen travel gone to hairline |
|---|---|---|
| **30°** | 150° | **9.5%** |
| 45° | 135° | 11.6% |
| 60° | 120° | 13.7% |
| 0° | 180° | 16.7% |
| 90° | 90° | **35.2%** |

**Our own traced word independently reproduces the historical 30° pen angle**
as the angle that costs the least legibility, and identifies 90° as the one that
destroys it (the stems are a third of the word; a vertical nib edge erases
them). That is a real calibration, not a borrowed number.

Aspect sweep at 30°, same trace:

| nib | mean width | 5th pct | exercised contrast | hairline travel | weight-restore scale |
|---|---|---|---|---|---|
| 10 : 1 | 0.717 | 0.197 | 5.02 | 10.1% | ×1.394 |
| **6.7 : 1** | 0.724 | 0.226 | 4.38 | 9.5% | ×1.381 |
| 5 : 1 | 0.733 | 0.260 | 3.79 | 6.2% | ×1.365 |
| 3.3 : 1 | 0.754 | 0.341 | 2.90 | **0.0%** | ×1.326 |
| 2.5 : 1 | 0.781 | 0.429 | 2.31 | 0.0% | ×1.281 |

Two numbers to take from this table. **The knee is at 5:1 → 3.3:1**: below 5:1
no part of the word goes hairline at all. And **ink weight must be restored** —
a nib's mean width over this word is ~72–75% of its maximum, so `a` has to be
scaled up by about **1.37×** or the whole word gets lighter the moment the nib
is switched on. That is the kind of change that gets mistaken for "the nib made
it worse".

### 1.5 The size finding, reversed

`desk-doodles-handfeel-port.md` closes on "the pen is enormous" — 22.58 px of
ink against a ~110–130 px cap height, about a fifth of cap height, against Desk
Doodles' ~1%.

Read as a **broad nib** that number is not enormous, it is orthodox. With
x-height ≈ 0.72 × cap, our ink is an x-height of **3.5–4.1 nib widths** —
squarely uncial/textura weight, heavier than italic (5) and at the dense end of
foundational (4–5). *This is an inference from the ratio, not a measurement of
intent*, but it reframes the finding: the pen is not too big. A 4-nib-width
x-height is a real hand. It is too big **for a monoline**, because a monoline at
that weight has no other information in it.

### 1.6 Direction-dependent width is strong enough to identify individual people

Everything above is geometry: *if* you hold a nib at an angle, *then* width
varies with direction. It says nothing about whether real writing actually
carries that signal, or whether it survives into a finished image.

It does, and the evidence is unusually hard, because it comes from a field with
an external accuracy criterion rather than an aesthetic one. Brink, Smit, Bulacu
& Schomaker, *Writer identification using directional ink-trace width
measurements* (Pattern Recognition 45, 2012), abstract, verbatim:

> As suggested by modern paleography, the width of ink traces is a powerful
> source of information for off-line writer identification, particularly if
> combined with its direction. Such measurements can be computed using simple,
> fast and accurate methods based on pixel contours, the combination of which
> forms a powerful feature for writer identification: the **Quill feature. It is
> a probability distribution of the relation between the ink direction and the
> ink width.** It was tested in writer identification experiments on two
> datasets of challenging medieval handwriting and two datasets of modern
> handwriting. The feature achieved a nearest-neighbor accuracy in the range of
> **63–95%**, which even approaches the performance of two state-of-the-art
> features in contemporary-writer identification (Hinge and Fraglets). The
> feature is intuitive and explainable and **its principle is supported by a
> model of trace production by a quill.** It illustrates that ink width patterns
> are valuable. A slightly more complex variant of Quill, QuillHinge, scored
> **70–97%** writer identification accuracy.

Four things to take from this, in descending order of how much they should
change what we build:

1. **The feature is exactly our model.** `p(width, direction)` is the joint
   distribution that §1.1's `h(psi)` generates. A nib with semi-axes `(a, b)` at
   angle `alpha` produces one specific, tightly-peaked such distribution. We are
   not inventing a plausible mechanism; we are synthesising a measured one.
2. **The variation is systematic, not noise.** You cannot identify a person from
   noise at 63–95%. Whatever makes ink width vary with direction is *stable
   within a writer and different between writers* — which is precisely the
   profile of a held-tool geometry, and precisely not the profile of anything
   driven by moment-to-moment force.
3. **It survives into the off-line image.** Quill is computed from pixel
   contours of a scan. No timing, no pressure, no stylus. That is the same
   channel we have, and the same channel §2.3 is about to say velocity is *not*
   available in.
4. **It works on modern handwriting too**, not only quill manuscripts — so the
   effect is not exclusive to broad nibs. A ballpoint held at a consistent tilt
   also lays down a direction-dependent trace.

*Honest limits on this reading.* The paper is paywalled; the block above is the
publisher's abstract, quoted verbatim, and **I have not read the body**. In
particular the "model of trace production by a quill" that it says supports the
feature is unread, so I cannot say whether it is the support-function model of
§1.1 or something coarser. The 63–95% range is also not broken down by dataset
in the abstract, so I cannot attribute the low end to the modern data or the
high end to the medieval, and point 4 above is therefore weaker than points 1–3:
what is established is that the feature works across four datasets spanning both
regimes, not that it works equally well on each.

---

## 2. Pressure and velocity

### 2.1 The channel, and its ceiling

The spec language is worth having exactly, because it is the reason the channel
is a lie rather than a gap. W3C Pointer Events, `pressure`:

> The normalized pressure of the pointer input in the range of `[0,1]`, where
> `0` and `1` represent the minimum and maximum pressure the hardware is capable
> of detecting, respectively. **For hardware and platforms that do not support
> pressure, the value MUST be `0.5` when in the active buttons state and `0`
> otherwise.**

`MUST be 0.5` — not `undefined`, not `null`. The `?? fallback` idiom is
specified out of existence.

**The same trap is set on the channel that could have given us a real nib
angle.** The spec also defines `azimuthAngle`, which is the pen's rotation about
the vertical — physically the nib angle a stylus is being held at:

> For hardware and platforms that do not report tilt or angle, the value MUST be
> `0`.

and `altitudeAngle` likewise MUST be `π/2`. So if we ever *do* support a stylus
and want the nib angle to come from the real pen, `azimuthAngle` needs the exact
same variance guard `INFLATE_PRESSURE_FLAT_EPS` already applies to pressure —
a hard `0` from every non-stylus device is indistinguishable from a pen held at
0°, which is the one angle that makes horizontals vanish. *Worth writing down
now; it is the identical bug, pre-armed, on a channel nobody has looked at yet.*

What the codebase does not surface is the **ceiling** of the width response
built on top of the pressure channel.

From `geometry-engines.ts:4805` and `:4917`:

```
r *= Math.max(1 + INFLATE_PRESSURE_INFLUENCE * 2 * (p - 0.5), 0.25)
INFLATE_PRESSURE_INFLUENCE = 0.35
```

| p | multiplier |
|---|---|
| 0 | 0.6500 |
| 1 | 1.3500 |

**Maximum expressible contrast = 1.35 / 0.65 = 2.077 : 1**, equivalent to a nib
of aspect `b/a = 0.4815`. The `0.25` floor never binds. So the "write the nib
width into `Point.pressure` and the existing profile drives it for free" route
tops out *below the weakest broad-nib hand in §1.4's table* — the 2.5:1 row —
and cannot reach the 5:1 knee. It is a legitimate 30-minute prototype and a dead
end as the shipping mechanism. Say so before someone builds it and concludes the
nib model does not work.

### 2.2 "Faster writing = lighter pressure = thinner line" is folklore

This is the intuition every implementer reaches for, it is what
perfect-freehand's `simulatePressure` encodes, and it is the obvious thing to do
with the only signal a mouse gives you. **It is not what the measurements say.**

The one study that put a force transducer in the pen and asked directly how pen
force relates to pen-point kinematics is Schomaker & Plamondon, *The relation
between pen force and pen-point kinematics in handwriting* (Biological
Cybernetics 63, 277–289, 1990). 16 subjects; a strain-gauge stylus measuring
**axial pen force (APF) over 0–10 N**, low-passed at 17.5 Hz, 10-bit; tablet at
105.2 Hz; six movement conditions (straight finger movements, wrist movements,
clockwise and counter-clockwise circling, scribbling, and cursive script). The
analysis is spectral coherence — and the authors are explicit that this is an R²:

> a single spectral coherence estimator is a coefficient of determination for
> the relationship between two variables in a specific frequency band

**The headline result, verbatim:**

> The coherence between dAPF and tangential velocity or between dAPF and angular
> velocity Vθ **never reached a value above 0.3 in any condition.**

> On the whole, **pen force appears to be a separate control variable.**

and from the abstract:

> On the whole, however, **variance in APF cannot be explained by kinematic
> variables.**

The best coherence anywhere in the study is with *wrist* velocity in circling
(0.42–0.44), and it degrades monotonically as the task gets more like writing:
0.35 for wrist movements, 0.3 for scribbling, **0.25 for cursive handwriting** —
the condition we actually care about. Coherence is highest where the movement is
least like writing.

**The same sentence kills the curvature route too**, and this one is aimed
directly at `inflateSynthPressures`:

> With regard to pure spatial factors, like points of high curvature, the data
> reveal that there is no coherence between APF and tangential velocity or
> angular velocity. Since points of low velocity and high angular velocity
> correspond to the high-curvature points, high-order inter-relationships of this
> kind can be excluded.

Angular velocity is curvature by another name. The authors checked the exact
hypothesis our shipped width model implements, and reported it absent.

**The per-writer numbers, which are the constructive half.** Table 4a, over 10
repetitions of the word *"gestaakt"* per subject (`R(APF,APF)` is the correlation
of the force *time-course* between repetitions; `R(APF,Y)` is its correlation
with vertical pen displacement):

| statistic over 16 writers | min | median | max |
|---|---|---|---|
| mean APF (g) | 57 | 96 | 212 |
| `R(APF,APF)` — replicability across repetitions | 0.11 | **0.44** | 0.77 |
| \|`R(APF,Y)`\| — coupling to the trajectory | 0.02 | **0.19** | 0.70 |

*Computed here from the paper's Table 4a.* Median R² of the force–trajectory
coupling is **0.036** — under 4% of variance — and 12 of 16 writers sit below
`|r| = 0.3`. Meanwhile mean force spans **3.7× between writers** and each
writer's force *pattern* replicates at a median 0.44 across repetitions of the
same word. The authors' own summary:

> APF patterns in cursive script reveal a moderate to high replicatability,
> giving support to the notion of a "centrally" controlled pen pressure

**Pen force is a property of the writer, replicated word to word, and nearly
uncoupled from where the pen is going.** That is exactly the shape of the
sibling doc's shared-draw rule — one draw per rendered instance, a property of
the hand, not of the stroke — arrived at from a completely independent
direction. If pressure is ever modelled here, it should be **one level per
instance with a mild replicated profile**, not a per-sample function of
kinematics.

**What is measured about speed and complexity is the opposite of the folklore.**
Table 2: cursive handwriting has mean APF 109.7 g and variance **806.4 g²** —
2.6× the next largest condition (counter-clockwise circling, 307.7 g²). It is
also the only condition where force *rises* through a trial (`b = +8 g/s`,
`r = +0.39`); every other condition decays at 1–2 g/s. The most writing-like
condition has the most force variability, not the least, and it trends upward.

**Two honest caveats, because this is the claim most likely to be over-read.**

1. **This study did not manipulate speed.** Verbatim: *"Patterns had to be
   written at a pace corresponding to normal writing speed."* What it establishes
   is that the **within-stroke** link between kinematics and force is weak — which
   is precisely the link a renderer would need, since a renderer needs width
   *along* a stroke. It does not establish what happens if you tell someone to
   write fast.
2. Between conditions the mean force does not order by speed in either
   direction. Scribbling is noted as the fastest condition (peak frequency
   4.5 Hz) and has the **lowest** mean APF (83.6 g), which is a point *for* the
   folklore; straight finger movements are slow and have among the highest
   (113.5 g), which is a point against. Amplitude differs between conditions too,
   so neither reading is safe. **The between-condition data are inconclusive; the
   within-stroke data are not.**

**So what should drive width, given no pressure channel?** **Direction.** Not
speed, not curvature. Three independent reasons, none of them aesthetic:

- It is the only signal all three of our inputs carry (§2.3 shows two of them
  have no time axis at all).
- It has a mechanism — the nib geometry of §1.1 — and independent empirical
  support in real writing at 63–95% writer-ID accuracy (§1.6).
- Both alternatives are refuted as proxies for force by the only study that
  measured force directly.

Be blunt about the shape of this answer: **it is not that direction is a better
approximation to pressure. It is that pressure was never the mechanism.** A
broad nib produces its thicks and thins with a perfectly constant force. The
width variation we are missing is geometric, and we have been looking for it in
the dynamics.

### 2.3 Can width be synthesised from velocity? — the availability problem

The reference implementation is Steve Ruiz's **perfect-freehand**, which is the
library Desk Doodles' pen-tip presets drive. Its defaults, verbatim:

| property | default | description |
|---|---|---|
| `size` | 8 | The base size (diameter) of the stroke. |
| `thinning` | .5 | The effect of pressure on the stroke's size. |
| `smoothing` | .5 | How much to soften the stroke's edges. |
| `streamline` | .5 | How much to streamline the stroke. |
| `simulatePressure` | **true** | Whether to simulate pressure based on velocity. |
| `easing` | `t => t` | An easing function to apply to each point's pressure. |

and the mechanism, verbatim:

> By default, the `getStroke` function will simulate pressure **based on the
> distance between input points**.

**That last sentence is the finding, and it is about our pipeline, not theirs.**
The velocity signal lives in the *spacing of the raw input samples*. Free
Stroke's pipeline destroys it before any width code could read it: strokes are
Taubin-smoothed and **arc-length resampled** (`lib/stroke-processing.ts`), and
`inflateResampleCenterline` resamples again at uniform `sampleSpacing`. After
that every gap is equal by construction, so a distance-based pressure
synthesiser returns a **constant**. Any velocity-driven width has to be computed
*before* resampling and carried through as a channel — which is exactly what
`inflateResampleScalar` exists to do, and exactly what nothing currently writes
into it.

Then the harder problem: two of three inputs have no velocity to preserve. The
single-stroke capture font (`scripts/capture/letters.mjs`, integer control
points) and the SVG trace are geometry with no timing at all; the `t` carried
through `stroke-processing.ts` is a parameterisation we invented. Only the live
drawing canvas has real timestamps. A width mechanism that fires on one of three
inputs is a mode split, not a feature.

There is one route that *does* recover velocity without a device: the
Sigma-Lognormal model in the sibling doc emits `v_j(t)` analytically. If we ever
run strokes through ΣΛ, velocity is a free by-product. But note what else it
emits — `phi_i(t)`, the **direction**. Which means the nib law
`w = W·|sin(phi(t) − alpha)|` is *also* free from the same model, needs no
kinematics, and works identically on the inputs that have no timing. The
direction is the cheaper signal, and it is the one that carries the calligraphic
read.

### 2.4 Curvature → width, and the double-count risk

`inflateSynthPressures` already maps turn angle → 0.5…1.0. Adding a
velocity-driven width on top would double-count, because the sibling doc's §4
records that speed and curvature are already coupled (`v = K·κ^(−1/3)`, itself
contested). Curvature-driven width is a *dwell* model — the pen lingers in a
turn — and it is a second-order effect sitting on top of a first-order one
(direction) that we do not model at all.

**§2.2 narrows what this model is allowed to claim.** If the justification for
curvature → width is *"the pen presses harder in a turn"*, that is refuted
directly: Schomaker & Plamondon checked coherence between pen force and angular
velocity and found none above 0.3 in any condition, and named high-curvature
points specifically as the case they were ruling out. If the justification is
instead *"the pen dwells, so more ink soaks into the paper"*, that is a
different mechanism — ink diffusion, not force — and I found **no measurement of
it at all** (§7). It is plausible; it is not sourced. Keep the model, keep it
small, and do not describe it as a pressure model, because the one thing we can
say about pressure is that it does not do this.

There is also a caution from the measurement literature. In a study of
handwriting legibility from stylus kinematics:

> pressure variability is significantly higher for low legibility (p < 0.01)

More width variation is not monotonically more human. Past some point it reads
as poor pen control, which is a *different* wrong answer from monoline, not a
better one.

---

## 3. Building a variable-width outline

### 3.1 The offset direction is not the normal

Given centreline `c(t)` and radius `r(t)`, the mark is the envelope of the
circle family. The defining pair, verbatim from Alcázar, Dahl & Muntingh,
*Symmetries of Canal Surfaces and Dupin Cyclides* (CAGD 2016), §2.1:

```
Σ_c,r(t) : ‖x − c(t)‖² − r²(t) = 0,                    (1a)
Σ̇_c,r(t) : ⟨x − c(t), ċ(t)⟩ + r(t)ṙ(t) = 0.           (1b)
```

> For fixed t, the first equation is a sphere and the second is a plane,
> intersecting in the characteristic circle k(t)

Equation (1b) is the whole finding: the contact point's **tangential**
component is pinned at `−r·r'/‖c'‖`, not zero. Solved for the planar case —
verbatim from Kruppa & Kunkli, *Applying Rational Envelope curves for skinning
purposes*, Eq. (1), where `y(t)` is the centre and `r(t)` the radius:

```
                   r′(t) y′(t) ± y′⊥(t) √(‖y′(t)‖² − r′(t)²)
x±(t) = y(t) − r(t) ─────────────────────────────────────────      (1)
                                 ‖y′(t)‖²
```

In tangent/normal form, which is what an implementation wants:

```
cos(psi) = −r'/‖c'‖                    (psi measured from T)
p±(t) = c(t) + r(t)·[ −(r'/‖c'‖)·T(t) ∓ sqrt(1 − (r'/‖c'‖)²)·N(t) ]
```

Sanity check: `r' = 0` gives `psi = 90°` and the classical `c ± r·N`. `r' > 0`
(widening) makes the contact point **lag backwards** against travel, which is
the correct physical behaviour of a widening tube.

The 2025 variable-radius-offset paper *OffsetCrust* states the consequence in
one sentence, and it is the sentence most implementations ignore:

> In the constant-radius case only, these displacement directions align exactly
> with the surface normals of S.

**Existence condition**, verbatim from the canal-surface paper:

> It follows from (1) that k(t) is nonempty (over the real numbers) precisely
> when ‖ċ(t)‖² ≥ ṙ(t)², degenerating to a single point if equality holds at t

Reparameterised to arc length this is the memorable `|dr/ds| ≤ 1`: **the radius
cannot grow faster than the curve advances; a taper steeper than 45° has no
envelope at all.** Below that threshold nothing on the circle's boundary is on
the boundary of the union — the disc swallows its neighbour rather than
sweeping past it.

There is a much prettier statement of the same condition, and it is the one
finding here worth remembering. The MAT curve `(c(t), r(t))` lives in Minkowski
space `R^{2,1}` with the indefinite form `x'² + y'² − r'²`, and the condition is
exactly that the MAT curve be **space-like**. Šír, *Hermite Interpolation by
Pythagorean Hodograph Curves in Euclidean and Minkowski Space*:

> Recall that the MAT of a planar domain is a space curve with space–like or
> light–like tangent vectors, where the latter ones appear only at isolated
> points, typically at vertices (points with extremal curvature) of the
> boundaries.

So the equality case `|dr/ds| = 1` is not a numerical nuisance to clamp away —
it is **where a stroke ends**, the light-like point at a curvature extremum of
the outline. A time-like MAT tangent is geometrically impossible for any real
region. A width profile that produces one is not describing a shape.

The other classical singularity is unchanged from constant-radius offsetting.
Farouki & Neff, *Analytic properties of plane offset curves* (CAGD 7, 1990):

> With appropriate sign conventions, the irregular points of the offset at
> distance d from a regular generator curve arise where the generator has
> curvature κ = −1/d.

Patrikalakis, Maekawa & Cho state it with the opposite normal orientation, via
the offset curvature `κ_d = κ/(1 − d·κ)`, singular at `d·κ = 1`. **The sources
disagree only in sign convention** — do not copy one into code written against
the other. Convention-free: *the offset is singular where the offset distance
equals the radius of curvature and the offset is on the concave side.* Real
handwriting loops — the top of an `h`, the bowl of an `e` — put `1/κ` down at
pen-width scale, so this is our normal case, not an edge case.

### 3.2 Our own taper violates the existence condition

This is a live finding about shipped code, computed from the shipped constants
(`INFLATE_TIP_FRACTION = 0.035/0.22 = 0.1591`, `INFLATE_PROFILE_EXP = 0.8`,
`INFLATE_TAPER_SPAN_DIAMETERS = 0.7`, so the taper runs over 1.40 R):

| position in taper zone | local radius | \|dr/ds\| | true ring tilt from perpendicular | radial-ring under-fill |
|---|---|---|---|---|
| 0.05 | 0.269 R | **1.252** | envelope does not exist | — |
| 0.10 | 0.350 R | **1.080** | envelope does not exist | — |
| 0.156 | 0.430 R | 0.972 | 76.4° | 76.5% |
| 0.25 | 0.549 R | 0.845 | 57.7° | 46.5% |
| 0.50 | 0.796 R | 0.572 | 34.9° | 18.0% |
| 0.75 | 0.948 R | 0.293 | 17.1° | 4.4% |

`|dr/ds| > 1` for the **first 0.195 R of arc length from each stroke end**. That
is a direct consequence of `exp = 0.8`: an exponent below 1 gives `sin(πx/2)^e`
a vertical tangent at zero, so the slope is unbounded at the tip *by
construction*. The "fuller shoulders" choice and the envelope condition are in
conflict, and nobody had checked.

The visible consequence is the second half of the table. `inflateBuildEllipticalTube`
places rings **perpendicular to the tangent** (`:5219-5229`) — the *radial*
construction, not the envelope. For a cone of slope `k` the true swept-sphere
surface is fatter than the radial one by `1/cos(asin(k))`:

| \|dr/ds\| | radial construction is this much too thin |
|---|---|
| 0.2 | 2.0% |
| 0.4 | 8.3% |
| 0.6 | 20.0% |
| 0.9 | 56.4% |

*Caveat, stated because it changes how much to believe the big numbers*: the
`cos(asin(dr/ds))` factor is the **exact** answer for a straight cone and a
**local linearisation** for a general profile. The two smoothing passes at the
end of `inflateInkWidthProfile` and the protruding cap dome both blunt the real
mesh, so treat the 46% row as an upper bound on the discrepancy, not a
measurement of it. The 18% row, at the middle of the taper where the profile is
nearly linear, is the one to trust.

**This predicts an existing, unflagged parity break between Inflate's two fusion
modes.** The implicit path builds exact round-cone SDFs
(`implicit-surface.ts:28-53`), which *are* the union of spheres, i.e. the true
envelope. The loft path builds radial rings. Both consume the same `ink` profile
(`geometry-engines.ts:5760`). So the implicit mode's stroke ends should be
measurably fatter and blunter than the loft's, by something on the order of 18%
in radius through the middle of the taper. That is a falsifiable prediction
testable with the existing capture harness, and if it holds, "which fusion mode"
is silently also "which stroke ending".

### 3.3 Self-intersection: offset, or union

Two distinct failures, and the vocabulary matters because the fixes differ.
Verbatim from Patrikalakis, Maekawa & Cho, *Shape Interrogation for CAD and
Manufacturing*, §11.2.2:

> Offset curve/surface may self-intersect **locally** when the absolute value of
> the offset distance exceeds the minimum radius of curvature in the concave
> regions

> Offset curve/surface may self-intersect **globally** when the distance between
> two distinct points on the curve/surface reaches a local minimum (i.e. the
> presence of a constriction of the curve/surface)

Local is pointwise-detectable from `κ`; global needs a pairwise search. Their
own analogy is exact: *"machining a part using a cylindrical/spherical cutter
whose radius is too large."*

The analytic route is expensive and the sources say so. Kilgard, quoting
Farouki & Neff: *"the polynomial order of the stroked boundary of a path segment
with a 2nd or 3rd order curve is substantially higher, 6th or 10th order
respectively in general."*

**The modern answer is to stop computing a clean outline.** Levien & Uguray,
*GPU-friendly Stroke Expansion* (2024), state the correctness ladder and then
the escape:

> We define **strong correctness** as the computation of the outline of a line
> swept along the segment, maintaining normal orientation, combined with stroke
> caps and joins. **Weak correctness**, by contrast, only requires the parallel
> curves (also known as 'offset curves') of path segments, combined with caps
> and the outer contours of joins.

> When the path curvature exceeds the reciprocal of the stroke half-width,
> evolute segments are required in addition to the parallel curves, as well as
> inner contours of joins when segments are short.

> The additional evolute segments and connecting lines are output twice, to make
> the winding numbers consistent and produce a watertight outline. […] **All
> winding numbers are positive, so rendering with the nonzero winding rule
> yields a correct final render.**

That is the direct answer to "can we just let the fill rule sort it out": yes,
and it is current best practice. Nehab's *Converting Stroked Primitives to
Filled Primitives* (SIGGRAPH 2020) takes the exact route instead — its stated
key insight is

> to take into account the evolutes of input outlines, in addition to their
> offsets, in regions of high curvature

— and Levien & Uguray reject it for GPU precisely because it needs "a hybrid
Newton/bisection method" to find cusps. **The sources disagree, and the
disagreement is a cost/quality axis, not a correctness one.**

Skia is the honest middle. Its stroker keeps outer and inner as separate
contours and carries this comment verbatim:

> In the degenerate case that the stroke radius is larger than our segments just
> connecting the two inner segments may 'show through' as a funny diagonal. To
> pseudo-fix this, we go through the pivot point.

and at cubic cusps it simply **stamps a disc** (`cusper.push_circle(...)`).
Cairo defaults to `CAIRO_FILL_RULE_WINDING` and lets nonzero resolve its
self-overlaps; FreeType's `FT_Stroker` likewise emits separately-oriented
"outside" and "inside" borders and combines them by fill rule, not by boolean.
**Nobody ships an intersection pass.**

### 3.4 The finding that reframes the whole problem

Kilgard, *Polar Stroking*, §2.3, on why he rejects the Minkowski/brush model:

> The brush-trajectory model 'stamps' the brush pattern all along the trajectory
> and its neighborhood whereas path rendering standards have a **wide-but-thin
> 'pen tip' that sweeps the trajectory orthogonal to the trajectory's
> gradient**. While a circular brush generates identical coverage to a path
> segment with round caps, path rendering standards support cap and joins styles
> other than round…

Read that against the PDF spec phrasing he quotes — *"paint a line … centered on
the segment with sides parallel to the segment"* — and the finding falls out:

**The PostScript / PDF / SVG / Canvas stroke model is defined as a nib held
permanently perpendicular to travel. It is a monoline by specification.** Our
strokes do not look machine-made because of a bug in our code; they look
machine-made because every stroking API any of us has ever used has the
non-calligraphic pen written into its definition. Kilgard's own description of
cusp behaviour makes it explicit:

> At an ideal cusp, the nib rotates 180 degrees at the cusp before continuing
> along the path past the cusp.

The standards nib **rotates with the path** so as to stay perpendicular to it. A
real nib is clamped to the hand and does not rotate at all. That is the entire
difference between a stroked path and a written mark, and every consequence in
this document follows from it.

The corollary is practical: since the standards model *is* the Minkowski model
for a round brush with round caps (Kilgard's own concession), and since a nib is
just a different convex brush, **the Minkowski/stamp-union route is not a
compromise for us — it is the more faithful model, and the one that never hits
an existence condition.** The lineage is old: Corthout & Pol (1991) and Fabris
et al. (1998) formulated stroking as a Minkowski sum; Turner (1983) and Hobby
(1985) as brush extrusion. Lee, Kim & Elber's *Polynomial/rational approximation
of Minkowski sum boundary curves* (1998) gives the structure — a **convolution
curve** of all point pairs with matching normal direction, from which the
Minkowski boundary is recovered by eliminating redundant parts. Note the
parallel: convolution curve ≈ untrimmed variable-width outline; "eliminating
redundant parts" ≈ the winding pass.

### 3.5 Tight loops, and a ready-made acceptance test

Tight loops are the standard failure point of production strokers, not an exotic
case. Kilgard's supplementary *Anecdotal Survey of Variations in Path Stroking
among Real-world Implementations* graded 20 shipping implementations on four
tiny-loop / cusp cases; most fail (Chrome 79 scored a C — "only the third exact
cusp case was correct"). His four criteria are directly reusable as our own
acceptance test:

> • if the loop or cusp (for the first 3 cases) is well-formed, rounded, and
> without obvious faceting or pixelation;
> • if the stroked path is free from internal pixel-scale holes;
> • if the fourth (rightmost) case has a notch without that notch being faceted
> or obviously circular; and
> • if the stroke is fully contained within the dilation of the cubic Bézier
> segments control cage by the stroke radius.

**That is a stronger argument against hand-rolling an analytic trim than any
theory in this document.** Twenty teams with more resources than us tried and
most got it wrong.

### 3.6 The platform will not help

**SVG has no variable-width stroke.** The W3C proposal
(`stroke-profile-widths` / `-positions` / `-repeat`) was never adopted into any
spec and left open the questions that matter, including path extrapolation and
what a join means when the two sides have different widths. Canvas 2D has no
equivalent. Both of our 2D renderers use `ctx.lineWidth`
(`lib/flat-ink.ts:104-106`, `scripts/capture/compose.mjs:155-157`). **The 2D half
of the hero beat cannot receive a nib without gaining a filled-outline
renderer** — the same trade Desk Doodles documented and took the other side of.

---

## 4. The 3D question: a nib-shaped cross-section on a swept tube

### 4.1 The frame problem is not our problem

The literature here is about rotation-minimizing frames — Bloomenthal's
incremental construction (Graphics Gems, 1990), Hanson & Ma's parallel transport
(1995), and the double-reflection method of Wang, Jüttler, Zheng & Liu
(ACM TOG 27(1), 2008), which is the standard because it is fourth-order accurate
where the naive projection method is second-order. All of it exists because the
Frenet frame's normal is undefined at inflections and on straight runs, and
flips through them.

**None of it applies to us.** Every Free Stroke centreline is planar (`z ≡ 0`;
the loft hardcodes `S = rot90(T)` in XY and `U = +Z`). For a planar curve the
parallel-transport frame *is* the planar Frenet frame, there is no twist, no
holonomy, and no closure defect. Worth stating plainly so nobody imports a
double-reflection RMF to solve a problem we do not have. If the geometry lock
ever comes off and strokes leave the plane, this section stops being free.

The real 3D question is the other one: **what happens when the cross-section
rotates relative to the frame.** A circular cross-section is invariant to frame
twist. A nib-shaped one is not — which is the whole point, and also the whole
difficulty.

### 4.2 The wrong way: vary `rXY` per sample

The tempting one-line change is to keep the ring perpendicular to `T` and set
`rXY = h(psi)` from §1.1. This is wrong by exactly the tangential term of §1.2.
The correct ring is not perpendicular to the tangent.

*Derivation (mine, from two standard results).* The boundary of a swept solid is
where the moving profile's surface normal is perpendicular to the sweep velocity
— the standard envelope/characteristic condition. For an ellipsoid `xᵀQx = 1`
the normal at `x` is parallel to `Qx`, so the characteristic curve for sweep
direction `d` is

```
(Q x) · d = 0     ->     x lies in the plane through the centre with normal  Q d
```

The ring is the ellipsoid's **silhouette for viewing direction `T`** — a planar
ellipse whose plane is oblique to `T` unless `Q ∝ I`. Sanity check: for a sphere
`Q = I/r²`, the plane normal is `d` itself and you recover the ordinary
perpendicular ring, which is why the circular tube has never needed this.

Because our tangent is in-plane and the nib rotates only about Z, `Q d` also
lies in the XY plane, so the ring plane always **contains** the Z axis and is
merely rotated within XY. The correction is a shear of the existing ring frame,
not a new topology.

### 4.3 The right way: make it an affine change of variables

You do not have to implement any of §4.2. Let `A` be the linear map taking the
unit ball to the nib solid:

```
A = R(alpha) · diag(a, b, hZ) · R(alpha)^T          (R = rotation about Z)
```

Then, because a Minkowski sum commutes with an invertible linear map:

```
c ⊕ A(B1)  =  A( A^-1(c) ⊕ B1 )
```

**Transform the centreline by `A⁻¹`, sweep the round tube we already sweep,
transform the vertices back by `A`.** You get, for free and exactly:

- the direction-dependent width of §1.1;
- the oblique rings of §4.2 (a perpendicular ring under `A` becomes the correct
  oblique silhouette ellipse);
- the tangential contact shift of §1.2, hence **stroke ends cut at the nib
  angle**;
- hemispherical end caps mapping to the nib's slanted end;
- and, in the implicit path, the whole thing still being an exact SDF, because
  the field is exact *in field space* and field space is where it is evaluated.

Note the interaction with §3.2: at **constant** width the loft's radial rings
*are* the exact envelope (`dr/ds = 0`), so the affine trick is exact end to end.
Layer the ink taper back on and it inherits exactly the radial error §3.2
measures — no better, no worse. The nib and the taper are independent defects.

This is not a new idea, it is METAFONT's: `pencircle xscaled a yscaled b
rotated alpha` is an affine-transformed circle, and an affine map takes
conjugate diameters of the circle to conjugate diameters of the ellipse. What is
new is noticing that **we have already built the machinery.** `Inflate`'s
implicit path pre-scales world Z so the elliptical cross-section becomes
circular, runs the isotropic field, and un-scales the vertices — with normals
transformed by the inverse transpose (`geometry-engines.ts:5532-5545`,
`implicit-surface.ts:21-25`). Extending a diagonal `diag(1,1,aspect)` to a full
symmetric 3×3 is a change of one matrix, and the one classic bug in the pattern
(normals need `A⁻ᵀ`, not `A`) is already handled and already commented.

### 4.4 What this costs, honestly

Four caveats, all real:

1. **The nib angle must be global.** `A` is one matrix for the whole drawing. A
   nib angle that drifts along the stroke breaks the change of variables and
   forces §4.2's per-ring construction. A real calligrapher does hold the angle
   roughly constant, so this is a modest loss — but it means the natural
   "humanise it" move (jitter the nib angle) is not free, and by the sibling
   doc's shared-draw rule it should be **one draw per rendered instance**
   anyway, which *is* compatible with a global `A`. Convenient, and not a
   coincidence: both facts come from the same place, that pen posture is a
   property of the hand, not of the stroke.
2. **Fillets become anisotropic.** The smooth-min radius `k` is isotropic in
   field space, so in world space it becomes an ellipsoidal fillet. This is
   already true of the existing Z pre-scale, so it is not a new defect — but at
   a 5:1 nib the anisotropy is 5× rather than the current ~1.5×, and the closed
   form the fusion assertion checks (`sqrt(2)·(r + k/6)`) is stated in field
   space and will need re-reading before it is trusted in world space.
3. **Sampling density is measured in the wrong metric.** Arc-length resampling
   and the curvature-adaptive ring placement run on the pre-transformed
   centreline, so strokes travelling in the nib's thin direction get sampled as
   though they were their transformed length. Mild, and correctable by scaling
   the spacing.
4. **The lofted tube may fold where it did not before** — *and this caveat was
   originally written wrong; see §4.5.* The classic condition is `r > 1/κ`; under
   the nib the effective radius in the thick direction is `a`, not the old
   `radiusXY`, so if `a` is raised by the 1.37× weight-restore factor of §1.4,
   tight loops that were previously clean can fold **in the ring-lofted
   parametrisation**. The implicit path is immune. §4.5 shows this is not a
   near-miss or a lucky property of unions: the *shape* has no such failure at
   all, at any nib size, and the condition being quoted is a fact about offset
   curves rather than about solids.

### 4.5 The swept solid is a Minkowski sum, and Minkowski sums do not cusp

This is the section that decides the architecture, so it is worth being exact.

**The claim.** For a nib held at a fixed orientation *in world space* — which is
what a hand does, per §3.4 — the inked region is exactly

```
C ⊕ K  =  { c + k  :  c ∈ C,  k ∈ K }
```

the Minkowski sum of the trajectory `C` (a point set) with the nib `K` (a
compact convex set). **There is no moving frame in this expression.** No Frenet
frame, no rotation-minimizing frame, no parallel transport, no cross-section
being carried along anything. The tangent does not appear. `K` is a constant.

This is not a reformulation for convenience; it is the older and more rigorous
of the two lineages. Kilgard, *Polar Stroking*, §2.3, verbatim:

> Corthout and Pol [1991] were the first to formulate a rigorous stroking
> definition based on the Minkowski sum of a trajectory and a brush and used it
> to reason about algorithms for stroking PostScript. Fabris et al. [1998]
> further refined the underlying theory to implement a more efficient algorithm.

Kilgard rejects it — but read *why* he rejects it, because his reason does not
apply to us:

> However this model does not capture the path stroking behavior of PostScript
> and similar standards.

His requirement is standards compliance. Ours is the opposite: §3.4 established
that the standards model is a monoline *by definition*, and that its
perpendicular-to-travel nib is the thing we are trying to escape. **Kilgard's
disqualifying objection to the Minkowski model is our reason for choosing it.**

**Why the cusp condition evaporates.** The `κ > 1/r` result is about the offset
*curve*. Farouki & Neff, quoted in §3.1, say it precisely: *"the irregular points
of the **offset**…"*. An offset curve is a parametrisation — the map
`t ↦ c(t) + r·N(t)` — and that map can self-intersect, reverse, and cusp while
the region it is trying to describe stays a perfectly ordinary set. The
Minkowski sum of any point set with a convex body always exists, is always
well-defined, and its boundary is a *subset* of the untrimmed offset. The
singularities are exactly the parts of the offset curve that are not on the
boundary. **`κ > 1/r` is a statement about a parametrisation failing, not about
a shape being impossible.**

*Verified here numerically, in the regime where the offset curve has fully
inverted.* Circular centreline of radius `R = 3`; elliptical nib `a = 5`,
`b = 1`, `alpha = 30°`, so `κ·a = 1.667` — well past the singular threshold, and
the inner parallel curve has radius `R − a = −2.0`, i.e. negative. Two
independent constructions on a 340×340 grid:

| construction | area |
|---|---|
| direct union of 3000 nib stamps along the centreline | 107.055 |
| affine change of variables of §4.3 (`A(A⁻¹C ⊕ B₁)`) | 107.055 |
| **symmetric difference** | **0 cells** |

The hole is closed (the centre point is inside under both constructions), the
two routes agree exactly, and neither notices that the offset curve has
inverted. The same check on a round pen (`R = 3`, `r = 5`) recovers the analytic
`π(R+r)²` to 0.000%.

**So §4.3's affine trick is not merely valid at small nib sizes — it is valid
everywhere the union is, which is everywhere.** The doc previously argued the
trick from algebra; it is now also checked in the one regime where a reader
would reasonably doubt it.

**METAFONT shipped this design in 1986, and enforces convexity for exactly this
reason.** Knuth, *The METAFONTbook*, ch. 16, verbatim:

> The distinction between pens and future pens would make no difference to a
> user, except for another surprising fact: **All of METAFONT's pens are convex
> polygons**, even the pens that are made from `pencircle` and its variants!

> You can define pens of any convex polygonal shape by saying '`makepen p`',
> where `p` is a cyclic path. […] This path must have the property that it turns
> left at every key point (i.e., `z`ₖ₊₁ must lie to the left of the line from
> `z`ₖ₋₁ to `z`ₖ, for all `k`), unless the cycle contains fewer than three key
> points; furthermore the path must have a turning number of 1

Convexity is checked *structurally*, at pen-construction time, by a left-turn
test at every vertex. It is the only precondition, and once it holds the sweep
cannot fail. That is a 40-year-old production system agreeing that the pen shape
is where the risk lives and the trajectory is not.

Two further details worth stealing:

- **METAFONT polygonalises everything.** *"the pens you get from `pencircle
  scaled 20` and `pencircle xscaled 30 yscaled 20` are polygons with 32 and 40
  sides, respectively"*. An exact ellipse is not required; a convex polygon with
  enough sides is what actually ships. For us that means the nib does not have
  to stay analytic if a polygonal one is ever more convenient.
- **METAFONT emits self-crossing geometry and fills it**, which is the same
  answer §3.3 reached from Levien & Uguray. From ch. 13, on `addto … contour`
  with a pen — note that here the convexity being discussed is of the
  **trajectory** `p`, not of the pen `q`, which is a distinction worth keeping
  straight:

  > `p` is converted to another path that "envelopes" `p` with respect to the
  > shape of `q`; this modified path is digitized and filled as before. (The
  > modified path may cross itself in unusual ways, producing **strange squirts
  > of ink** as illustrated earlier. But it will be well behaved if path `p`
  > defines a convex region, i.e., if a car that drives counterclockwise around
  > `p` never turns toward the right at any time.)

  "Strange squirts of ink" is Knuth's name for the winding-number artefact that
  Levien & Uguray solve by emitting evolute segments twice so that *"all winding
  numbers are positive"*. Same problem, same era-appropriate answer, thirty-eight
  years apart.

**How much this matters for our actual word.** *Measured here* on
`scripts/capture/logo-strokes.json`, using mean curvature over a sliding
arc-length window rather than a three-point estimate (the three-point estimate
is badly scale-dependent on a traced polyline — it ranged 4.0–9.0% across
estimation steps of 1–3 units, which is why it is not the number reported):

| window length | share of pen travel with mean κ > 1/d, `d = 11.29` (current half-width) | same, `d = 15.59` (nib `a`, weight-restored) |
|---|---|---|
| 0.5 d | 9.08% | 11.81% |
| **1.0 d** | **3.35%** | **5.43%** |
| 2.0 d | 0.19% | 1.52% |

Read at the natural scale (window = the offset distance itself), **3.4% of the
word's pen travel is already in the regime where the offset construction is
singular, rising to 5.4% once the nib is enlarged to restore ink weight.** The
worst location turns 177.3° within one half-width. These are the places an
outline-based stroker produces holes and spikes, and they are the places the
union route does not have a case for.

*Caveat on those percentages, stated because the earlier estimate moved so
much*: mollified curvature is scale-dependent by nature and the table shows it
moving by a factor of ~18 across a 4× window range. The **ordering** is robust
(the nib case is always worse than the current case) and the **existence** of
the regime is robust (the 177.3° turn is not an artefact of any window). The
specific percentage is a scale-conditional quantity and should be quoted with
its window.

---

## 5. Ranked: what changes the machine read

Ordered by *effect on the machine-made read, divided by cost*. Items 1–3 are the
ones that change the answer to Sebs's complaint; everything below 4 is polish or
insurance.

1. **The nib, as an affine change of variables** (§4.3, verified in the hard
   regime in §4.5). Largest effect on the thing being complained about, and the
   smallest diff of anything in this document because the transform machinery
   already exists and is already correct. **Cost: one 3×3 matrix, one
   weight-restore constant (×1.37), two dials.** Nothing else in this list is
   close on either axis.

   On the starting dial positions, §1.3 changes the earlier recommendation.
   Aspect: **5:1**, unchanged — that is §1.4's measured knee and it agrees with
   METAFONT's and Heck's 8:1–10:1 to within the precision the parameter
   deserves. Angle: expose it as a **named two-preset dial**, because 0° and 30°
   are two different real hands and not a right and a wrong answer.
   **0° = Foundational**, the angle Johnston's 1906 text actually specifies —
   hairline horizontals, maximum stem weight, the most obviously "written" of the
   two. **30° = the later teaching convention** — everything gets some width,
   nothing goes fully hairline. Default to 30° for the logo (13.9% of our travel
   is near-horizontal joins, and 0° erases all of it), but the 0° preset is the
   historically-primary one and should be one click away, not absent. Only 90° is
   actually forbidden: it erases the near-vertical stems, which are 33.2% of the
   word.
2. **Build the nib on the union/implicit path, not the loft** (§4.5). The
   architectural decision, and it is now evidence-backed rather than a
   preference. The solid has no `κ > 1/r` failure at any nib size; the ring-loft
   parametrisation does, over 3.4–5.4% of our own word's pen travel at the
   natural measurement scale. This also makes item 3 moot on that path.
3. **Fix the taper to satisfy `|dr/ds| ≤ 1`** (§3.2). Free — a change to one
   exponent and one span constant — and it removes a region where the surface
   currently has no well-defined envelope. Also closes the loft/implicit parity
   break.
4. **Ring construction on the envelope rather than radially** (§3.1). Only
   matters where `|dr/ds|` is large, which after (3) is nowhere, and on the
   implicit path it never arises. **Do (2) and (3) instead of (4).**
5. **Nib-angle perturbation, one draw per instance.** Small, correlated,
   compatible with the affine trick, and it is the difference between "a
   calligrapher wrote this" and "a plotter with a nib wrote this". Perfectly
   constant pen angle is its own machine tell. §2.2 now supplies an independent
   reason to shape it this way: the one force variable that was measured turned
   out to be a **writer-level** quantity (3.7× spread between writers, median
   0.44 self-replication within one), which is exactly a one-draw-per-instance
   parameter.
6. **Curvature-driven dwell** — already implemented. Leave it, cap it, and
   **stop calling it pressure** (§2.4). Its force justification is refuted by
   direct measurement; only the ink-diffusion reading survives, and that one is
   unsourced.
7. **A filled-outline 2D renderer**, built as a self-overlapping stamp union
   filled nonzero, never as a trimmed offset (§3.3, §3.5). Necessary if the flat
   half of the hero beat is to match the 3D half. Real work, no platform help
   (§3.6), and it buys nothing in 3D. Grade it against Kilgard's four criteria.
   **If it is built, it must handle the reversal discontinuity of §1.2c** —
   inserting the nib's own boundary arc between the two contact points — or it
   will have gaps of up to `2(a − b)` at every cusp, and our word has a 177.3°
   turn inside one half-width.
8. **A variance guard on `azimuthAngle`**, if a stylus is ever supported. Ten
   lines, and it forecloses an already-armed repeat of the flat-pressure bug
   (§2.1).
9. **Velocity-driven width.** Works on one of three inputs, and §2.2 says the
   thing it is a proxy for does not behave that way. See below.

## 6. Dead ends, and why

- **Routing the nib through `Point.pressure`.** Ceiling of 2.077 : 1 (§2.1).
  Prototype only.
- **Synthesising width from velocity.** Two objections, and the second is new.
  *Availability*: two of our three inputs have no time axis at all, so the model
  returns a constant on them (§2.3). *Validity*: the within-stroke coherence
  between pen force and tangential velocity **never exceeds 0.3 in any
  condition**, and the authors conclude pen force "appears to be a separate
  control variable" (§2.2). Even with a perfect velocity signal, it is not a
  proxy for the thing it is standing in for.
- **Curvature as a proxy for pressure.** Same source, same measurement, stated
  even more directly: high-curvature points were the specific case the authors
  ruled out (§2.2, §2.4). Curvature-driven width can be defended as an
  ink-diffusion dwell effect; it cannot be defended as a force model.
- **Treating `κ > 1/r` as a reason not to enlarge the nib.** It is a property of
  the offset-curve parametrisation, not of the swept solid, and it does not
  constrain the union/implicit route at all (§4.5, verified at `κ·a = 1.667` with
  zero symmetric difference). Choosing a smaller nib to stay "safe" would be
  paying real contrast for an imaginary constraint.
- **Rotation-minimizing frames / double reflection.** Solves twist on non-planar
  curves. Every stroke we have is planar (§4.1) — and under §4.5 there is no
  moving frame in the construction at all, so this is doubly irrelevant.
- **Reading "30° italic" as one setting.** Pen angle and letterform slant are
  independent axes and the sources conflate them constantly. Johnston's own
  worked example is a 70° shaft posture producing a 0° pen angle (§1.3). Any dial
  that couples them will be wrong in a way that is hard to diagnose later.
- **Analytic offset trimming.** Degree 6 (quadratic) to degree 10 (cubic)
  boundaries, resultants and real-root isolation, Newton/bisection cusp finding
  — and twenty shipping implementations still mostly fail Kilgard's four
  tight-loop cases (§3.3, §3.5). Emit overlapping geometry and fill nonzero.
- **SVG/Canvas variable-width stroke.** Does not exist. The W3C proposal was
  never adopted (§3.6).
- **Copperplate-style pressure swells.** That look comes from a flexible pointed
  nib splaying under force. With no force channel there is nothing to drive it,
  and faking it from curvature produces swells in the wrong places — pointed-pen
  swells fall on downstrokes regardless of curvature.
- **Per-stroke nib angle.** Breaks the affine trick (§4.4) and violates the
  sibling doc's shared-draw rule for the same underlying reason. §2.2 adds a
  third, independent reason: the analogous measured quantity is a writer-level
  variable, not a stroke-level one.

---

## 7. What I could not verify

Listed because a documented gap is worth more than a confident sentence, and
because two of these are things a later reader would otherwise assume were
checked.

**Sources I could not read.**

- **Brink et al. 2012 (the Quill paper) is paywalled.** Everything in §1.6 comes
  from the publisher's abstract, quoted verbatim. I have **not read the body**.
  Consequences: the "model of trace production by a quill" that the abstract says
  supports the feature is unread, so I cannot say whether it matches §1.1's
  support-function model or something coarser; and the 63–95% range is not broken
  down by dataset, so the claim that the effect holds on modern (non-nib)
  handwriting rests on the datasets being listed, not on a per-dataset number.
  Axel Brink's PhD thesis would likely resolve both and I could not reach the
  Groningen repository (HTTP 403) in this session.
- **Two speed→force experiments cited in an earlier research pass — "222 g vs
  200 g" and "1.4–1.5 N → 1.7 N" — could not be re-located.** WebSearch budget
  was exhausted before I started, and neither OpenAlex nor Semantic Scholar
  surfaced them from a dozen query formulations. **Those two numbers are
  therefore not sourced in this document and should not be quoted from it.** The
  claim they were supporting — that the "faster = lighter" folklore is wrong —
  is independently established in §2.2 by Schomaker & Plamondon, which is a
  stronger source anyway because it measures the *within-stroke* relation rather
  than a between-condition mean. But if the specific figures matter, they need
  finding again.
- **Johnston's page numbers are second-hand.** The wording in §1.3 was retrieved
  twice, independently, from the Project Gutenberg transcription (ebook 47089)
  and agreed both times, so I trust the quotations. The page attributions
  (pp. 43, 65, 66–67) came from the same retrieval and I did not verify them
  against a scan of the 1906 printing.
- **I did not read Johnston end to end.** §1.3 says the 1906 text specifies a 0°
  pen angle and does not prescribe 30°. The first half of that is directly
  quoted. The second half is *absence of evidence from a targeted search*, not a
  proof of absence, and later editions of the book differ from the first.

**Claims made here that rest on reasoning rather than measurement.**

- **The ink-diffusion justification for curvature→width has no source at all**
  (§2.4). I looked for a measurement of ink spreading as a function of pen dwell
  time and found none. It is a plausible mechanism and it is currently the only
  surviving defence of a model we already ship, which is an uncomfortable place
  for it to be.
- **Nothing here is measured on real handwriting of ours.** The Quill result says
  direction-dependent width exists in scanned writing; we have no scanned writing
  to check our own numbers against, so the nib parameters in §1.4 are fitted to a
  *traced logo*, not to a hand.
- **The mollified-curvature percentages in §4.5 are scale-conditional.** They move
  by ~18× across a 4× window range. The ordering and the existence of the regime
  are robust; the specific percentage is not, and it is quoted with its window
  for that reason. The earlier three-point curvature estimate was worse (4.0–9.0%
  across estimation steps of 1–3 units) and was discarded rather than reported.
- **The `|tang|` and reversal results in §1.2b/§1.2c are mine**, derived from the
  standard support-function parameterisation and checked numerically, not taken
  from a source. `max |h'| = a − b` and `max |h'|/h = (a²−b²)/(2ab)` are almost
  certainly known; I did not find them stated anywhere, and did not search hard,
  because verifying them was cheaper than finding them.

**Things that remain unrun, not unknown.**

- **The predicted implicit-vs-loft stroke-end parity break** (§3.2) — that
  implicit stroke ends should be ~18% fatter in radius through the middle of the
  taper — is a falsifiable prediction with an existing capture harness, and it
  has still not been run.
- **No frames.** This is a research document and nothing in it has been rendered.
  Every recommendation here is subject to the standing rule that visual claims
  are settled by looking at frames, and none of them has been.

---

## Sources

**Calligraphic primary sources**
- [Johnston — *Writing & Illuminating, & Lettering*, 1906 (Project Gutenberg ebook 47089)](https://www.gutenberg.org/cache/epub/47089/pg47089.txt) — the three-degrees-of-freedom passage, "the chisel edge of the nib is parallel to the horizontal line of the paper", the 70°-shaft worked example, and "slanted-pen or tilted writing" as a *historical* practice. The primary text for the claim that Foundational is a 0° pen-angle hand
- [Knuth — *The METAFONTbook*, 1986](https://www.ctan.org/pkg/metafont) — ch. 13 (the envelope, "strange squirts of ink", the convex-trajectory condition) and ch. 16 "Calligraphic Effects" ("All of METAFONT's pens are convex polygons", `makepen`'s left-turn test, `pensquare xscaled 30 yscaled 3 rotated 30`)

**Nib and envelope**
- [Hobby — *Rasterizing Curves of Constant Width*, JACM 36(2), 1989](https://dl.acm.org/doi/10.1145/62044.62045) — the canonical convex-pen envelope
- [Hobby — *Digitized Brush Trajectories*, Stanford PhD, 1985 (STAN-CS-85-1070)](https://searchworks.stanford.edu/view/4603254)
- [Heck — *Tutorial in MetaPost*, §4.3](https://mirror.gutenberg-asso.fr/tex.loria.fr/prod-graph/heck-metapost2003.pdf) — "You can create an elliptically shaped and rotated pen by transforming the circular pen"
- [Hoekwater — *MetaPost paths and pairs*, ConTeXt meeting 2021](https://articles.contextgarden.net/journal/2021/48-92.pdf) — elliptical pens must be based on `pencircle`; polygonal pens are the other kind
- [Support-function parameterisation of a convex body](https://arxiv.org/pdf/2203.06981) — `x = p·n + p′·t`
- [Ghosh — *Support Function Representation of Convex Bodies*, CVIU 1998](https://www.sciencedirect.com/science/article/abs/pii/S1077314298906749)

**Envelopes and variable-radius offsets**
- [Alcázar, Dahl & Muntingh — *Symmetries of Canal Surfaces and Dupin Cyclides*, CAGD 2016](https://arxiv.org/pdf/1611.06768) — equations (1a)/(1b) and the existence condition `‖ċ‖² ≥ ṙ²`
- [Kruppa & Kunkli — *Applying Rational Envelope curves for skinning purposes*](https://arxiv.org/pdf/1911.06906) — the solved planar envelope, Eq. (1)
- [Choi, Choi & Moon — *Mathematical theory of medial axis transform*, Pacific J. Math. 181(1), 1997](https://msp.org/pjm/1997/181-1/pjm-v181-n1-p02-p.pdf)
- [Šír — *Hermite Interpolation by PH Curves in Euclidean and Minkowski Space*](https://www.karlin.mff.cuni.cz/~sir/papers/Dresden.pdf) — the space-like MAT condition
- [Farouki & Neff — *Analytic properties of plane offset curves*, CAGD 7, 1990](https://research.ibm.com/publications/analytic-properties-of-plane-offset-curves)
- [Farouki & Neff — *Algebraic properties of plane offset curves*, CAGD 7, 1990](https://research.ibm.com/publications/algebraic-properties-of-plane-offset-curves)
- [Patrikalakis, Maekawa & Cho — *Shape Interrogation for CAD and Manufacturing*, §11.2](https://web.mit.edu/hyperbook/Patrikalakis-Maekawa-Cho/node220.html) — local vs global self-intersection
- [*OffsetCrust: Variable-Radius Offset Approximation with Power Diagrams*, 2025](https://arxiv.org/abs/2507.10924)
- [Lin & Rokne — *Variable-radius offset curves and surfaces*, Math. Comput. Modelling 26(7), 1997](https://www.sciencedirect.com/science/article/pii/S089571779700188X) — paywalled; same result as Kruppa & Kunkli Eq. (1)

**Stroking**
- [Kilgard — *Polar Stroking*, SIGGRAPH 2020](https://arxiv.org/pdf/2007.00308) — the perpendicular-nib definition of standards stroking
- [Kilgard — *Anecdotal Survey of Variations in Path Stroking among Real-world Implementations*](https://arxiv.org/pdf/2007.12254) — the four-case acceptance test
- [Nehab — *Converting Stroked Primitives to Filled Primitives*, SIGGRAPH 2020](https://w3.impa.br/~diego/publications/Neh20.pdf) · [code](https://github.com/diegonehab/stroke-to-fill)
- [Levien & Uguray — *GPU-friendly Stroke Expansion*, 2024](https://arxiv.org/html/2405.00127v2) — strong vs weak correctness, "all winding numbers are positive"
- [Lee, Kim & Elber — *Polynomial/rational approximation of Minkowski sum boundary curves*, GMIP 60(2), 1998](https://www.academia.edu/735207/Polynomial_rational_approximation_of_Minkowski_sum_boundary_curves)
- [tiny-skia stroker (port of Skia `SkStroke.cpp`)](https://docs.rs/tiny-skia-path/latest/src/tiny_skia_path/stroker.rs.html) · [Skia original](https://github.com/google/skia/blob/main/src/core/SkStroke.cpp)
- [Cairo fill rules](https://www.cairographics.org/manual/cairo-cairo-t.html) · [FreeType `FT_Stroker`](https://freetype.org/freetype2/docs/reference/ft2-glyph_stroker.html)
- [W3C SVG WG — *Proposals/Variable width stroke*](https://www.w3.org/Graphics/SVG/WG/wiki/Proposals/Variable_width_stroke) — never adopted
- [SVG Strokes specification draft](https://svgwg.org/specs/strokes/)

**Frames and sweeps**
- [Wang, Jüttler, Zheng, Liu — *Computation of Rotation Minimizing Frames*, ACM TOG 27(1), 2008](https://dl.acm.org/doi/10.1145/1330511.1330513)
- [Hanson & Ma — *Parallel Transport Approach to Curve Framing*, Indiana TR 425, 1995](https://legacy.cs.indiana.edu/ftp/techreports/TR425.pdf)
- Bloomenthal — *Calculation of Reference Frames along a Space Curve*, Graphics Gems, 1990

**Pressure, velocity, measurement**
- [Schomaker & Plamondon — *The relation between pen force and pen-point kinematics in handwriting*, Biological Cybernetics 63, 277–289, 1990](https://www.ai.rug.nl/~lambert/papers/pen-pressure.pdf) ([DOI](https://doi.org/10.1007/BF00203451)) — **the primary source for §2.2.** "never reached a value above 0.3 in any condition"; "pen force appears to be a separate control variable"; Tables 2, 3 and 4a
- [Brink, Smit, Bulacu & Schomaker — *Writer identification using directional ink-trace width measurements*, Pattern Recognition 45(1), 162–171, 2012](https://doi.org/10.1016/j.patcog.2011.07.005) ([abstract, open](https://research.rug.nl/en/publications/writer-identification-using-directional-ink-trace-width-measureme)) — the Quill feature, 63–95% / QuillHinge 70–97%. **Paywalled; abstract only — see §7**
- [W3C Pointer Events Level 3 — `pressure`, `azimuthAngle`, `altitudeAngle`](https://www.w3.org/TR/pointerevents3/) — the `MUST be 0.5` / `MUST be 0` defaults
- [steveruizok/perfect-freehand](https://github.com/steveruizok/perfect-freehand) — `simulatePressure: true`, pressure from "the distance between input points"
- [*Analyzing handwriting legibility through hand kinematics*, Frontiers in AI, 2025](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2025.1426455/full) — "pressure variability is significantly higher for low legibility (p < 0.01)"
- [Effectiveness of Pen Pressure, Azimuth, and Altitude Features for Online Signature Verification](https://link.springer.com/chapter/10.1007/978-3-540-74549-5_53) — EER 3.61% with pressure+inclination vs 5.79% without

**Type**
- [Google Fonts Knowledge — *Contrast*](https://fonts.google.com/knowledge/glossary/contrast)
- [Bruinsma — *Parametric type design in the era of variable and color fonts*, 2025](https://arxiv.org/abs/2502.07386)

**Measured here, not sourced**
- Direction census and nib sweeps over `scripts/capture/logo-strokes.json`
- Numerical verification of the nib width law, the tangential contact offset, and
  the envelope tilt/under-fill tables
- The `2.077 : 1` pressure-channel ceiling, from `INFLATE_PRESSURE_INFLUENCE`
- The `|dr/ds| > 1` taper-zone violation, from the shipped Inflate constants
- **§1.2b** — the closed forms `max |h'| = a − b` (at `sin²psi = b/(a+b)`) and
  `max |h'|/h = (a²−b²)/(2ab)`, derived and checked against a 20 000-point sweep
- **§1.2c** — π-periodicity of `h` and `h'` to 8.9e-16, and the `2|h'|` outline
  discontinuity at a direction reversal
- **§4.5** — `C ⊕ A(B₁) = A(A⁻¹C ⊕ B₁)` checked on a 340×340 grid at
  `κ·a = 1.667`: zero symmetric difference, both areas 107.055
- **§4.5** — the mollified-curvature census of `logo-strokes.json` (3.35% / 5.43%
  at window = offset distance) and the 177.3°-in-one-half-width worst case
- **§2.2** — the per-writer summary statistics computed from Schomaker &
  Plamondon's Table 4a (median `R(APF,APF)` 0.44, median `|R(APF,Y)|` 0.19,
  median R² 0.036, 12 of 16 writers below `|r| = 0.3`, mean-force spread 3.72×)
