# 11 — Screen-layer quality: the window, the cell, and three dead animations

The three screen-space layers — texture, dither, ASCII — had all been verified to
*change pixels* and to *not regress*. Nobody had checked whether they look good.
This pass did, on the material each engine actually ships with, and found that
the two complaints ("they're just weak", "hard to notice or they don't do
anything") are mostly **two mechanisms wearing many costumes**.

Companion research, with every measurement and its source frame:
[`research/screen-space-layer-quality.md`](../research/screen-space-layer-quality.md).

---

## The thing that made all of this findable

A rail preset writes **only its own family's fields**. So a dither preset never
chooses a material — the *geometry mode* does:

```
rod → ink        extrude → glossyPlastic
solid → matteClay  inflate → softGel
```

Every earlier harness drove the three machines through their raw parameters at
one setting the harness picked. That answers "can this shader make a pattern". It
cannot answer "does this preset look good", because the preset's whole job is to
be a set of numbers that suits a surface it will meet later.

So the new harness shoots **real preset × real per-mode default material × four
modes**, and adds one measurement the repo had never taken:

> **nearest-sibling distance** — how far a preset is from the closest *other*
> preset on the same rail.

That number is the difference between "this effect works" and "this effect is
worth having". An option can change pixels convincingly and still be the option
above it under a different name. Once you can see that number, "the options are
weak" stops being taste and starts being a measurement you can chase.

---

## 1. A tone window five times too wide for its subject

Dither and ASCII are both quantisers: take a luminance, land it on a 0..1 ramp,
step it. The landing is one shared helper — a **window**, where exposure slides
the centre and contrast sets the half-width.

Both were absolute display values. The subject's luminance is not.

| mode / material | ink luminance | σ |
|---|---|---|
| solid / matteClay | 133.4 | **18.2** |
| extrude / glossyPlastic | 158.3 | 38.7 |
| rod / ink | 125.6 | 65.6 |
| inflate / softGel | 155.2 | 33.3 |

At the default dial the window was 0.69 wide — **4.9× Solid's σ**. Picture a
ruler five times longer than the thing you are measuring: every reading is the
same mark. That is a halftone whose dots are all one size, and an ASCII rail
where every charset resolves to one repeated character. Both were exactly what
the frames showed.

The useful part came from **overshooting the fix**. Narrowing the window to the
width Solid's σ asks for sent three of Extrude's five dither presets *entirely to
paper* — the lighter body tone now sat above the window's top — and that rail's
nearest-sibling distance collapsed 21.1 → 8.0, because once everything clips,
every screen converges on the same blank silhouette.

**Too wide flattens. Too narrow clips. Same fault both times:** the window is
positioned in absolute luminance while the material is chosen elsewhere. What
shipped is the widest setting that still shows dot-size variation on Solid while
keeping Extrude's body inside the window — a compromise across four materials,
and a compromise *by construction*.

The real fix is auto-exposure: derive the centre from the material in use so the
dial becomes a relative offset. It is deliberately **not** in this pass, because
it changes what the dial *means* and ten Layer Stack and Fusion presets have
hand-tuned absolute values (0.18 on ceramic, 0.9 on ink) that would all need
re-deriving. The research doc works through both routes and the reason the
obvious one — read the material's albedo in the shader — under-predicts by 3.3×
on a glossy dark surface.

This also explains something that looked like a separate bug. The same dither
*models the form* inside a Layer Stack preset and *goes flat* on its own rail.
Not two behaviours: the stack preset pins a material **and** an exposure together
as one composition, so it has information the rail does not. Same shader, same
numbers available, different amount known.

## 2. A glyph cell is in device pixels, and every ASCII preset was under the floor

`asciiCellSize` divides `gl_FragCoord`, which is in **framebuffer** pixels. So
the number is device pixels, and on a 2× display a 9px cell is 4.5 CSS px. Inside
it a 5×5 bitfield is sampled with `floor()`, so one glyph pixel is a hard square
of `cell/5` device pixels — **1.8 at 9px**.

A 1-bit stroke needs an on-off-on triple to survive, so ≈3 device pixels per glyph
pixel, so a cell of ≈15. All eleven presets on the two ASCII rails shipped at
8–11px. The state default and the Layer Stack and Fusion presets were all at
12–22. **The two rails whose entire purpose is showing glyphs were the only place
that never got the fix.**

Raised to 16–20. The before/after macro sheets are the whole argument: five
indistinguishable grey weaves become `+` marks, `1`s, shade blocks, bracket
marks and a dot field. Nearest-sibling distance on the Solid ASCII rail rose
12.1 → 17.9 at its worst pair, and the number of distinct tone levels present
rose almost everywhere (Inflate 8 → 10, 9 → 11) — more of the ramp is actually
in use.

**And the cost, which is the more interesting half.** A bigger cell means fewer
cells across a narrow limb. On Rod — a ~25 device px tube — a mid-teens cell gets
one and a half cells to work with, and fifteen dial combinations all render the
same dark noodle with a few marks on it. **ASCII structurally cannot render on
Rod.** One preset was recommending Rod as a best mode; it no longer does.

That is the family's real trade-off, and it is worth carrying forward:

> A dither cell can be small, because a dither mark does not have to be
> identifiable as a shape. A glyph cell cannot. So dither can model a thin
> stroke and ASCII cannot — on a narrow form ASCII is a graphic overlay, not a
> tonal model, and should be judged as one.

## 3. Three animated presets that were not animating

All three were **timing-origin faults in disguise** — the same family this repo
already documented as "time-based effects need an explicit origin". Three new
costumes for it:

**Completion Pulse Dither could not pulse.** It set the coarse `motionMode` but
never `ditherSyncMode`, and `resolveSyncMode` maps `syncToDraw` onto
`revealSynced` for any layer that hasn't opted into something more specific. So
it resolved to the same mode as the preset above it. Measured before: **byte-
identical to the static Dot Matrix preset on all four engines**, matching to
three decimals. It read its mode from the wrong control surface. After: span
62.8, peak 20.3, **rest 0.0** — it pulses, and it stops.

**Reveal Glyphs was arithmetically a no-op at rest.** `floor(level * reveal +
0.5)` on an already-integer level is the identity whenever the playhead rests at
1 — which is the state the entire rail is browsed in — and it stepped in whole
ramp levels while the draw ran. Moved to act on the *continuous* tone before
quantisation: span **106.5**, the largest travel of any animated ASCII preset,
and a smooth density build in the frame strip. It had been measuring its effect
after quantisation, where the origin's resting value is the identity.

**Character Cycle flashed the whole form dark.** Every cell walked the ramp in
lockstep, so the entire form hit the ramp's **blank glyph simultaneously** —
roughly every 3.3s. The numbers name the shape of it: mean frame delta 7.9 with a
**peak of 43.7 and a floor of 0.0** — long stillness, one enormous jump. A global
luminance flash is the first thing an animation review fails, and nothing about
"characters change in place" requires them to change *together*. Offsetting the
ramp phase per cell by a hash:

| | before | after |
|---|---|---|
| mean frame Δ | 7.92 | 8.09 |
| **sd** | **12.699** | **2.349** |
| **max** | **43.723** | **15.837** |
| min | 0.000 | 4.335 |

Same amount of motion, no blink. `dit_crawl` and `asc_flicker` unchanged to three
decimals in the same build, so the fix is scoped to one branch.

---

## Two things the harness itself got wrong, both of which *passed*

Worth recording, because a verification bug that produces passing evidence is
more dangerous than the bug it was looking for.

**Ink was "darker than 232", absolute.** Soft Gel renders at ~230 against ~247
paper, so the detector reported *no ink found* on a frame that plainly contains a
stroke — and the Inflate leg of the run died on it. Ink is now paper-relative,
with paper measured as the modal stage luminance.

**Framing once per run** let later crops drift off the form. The result was a
strip of blank paper scoring `nnDist 0.00` and `meanDelta 0.02` — numbers
indistinguishable from "the whole rail collapsed" and from "this effect stopped
working". I nearly chased the second one. Both paths now re-frame with an on-form
assertion and retry.

And one metric was simply missing: **a slow effect and a dead one are identical
in a frame-to-frame delta.** Threshold Sweep moves the tone bias on a 4.8s
period — mean frame Δ 1.41, which reads as broken, while its total travel is
32.7. `spanDelta` (furthest any frame gets from frame 0) is now measured
alongside, and it is what separates "slow" from "dead".

---

## What is still weak

- **Texture on a glossy dark material is invisible.** Rod's texture rail measures
  `dOff` 1.0–4.1 across all twelve presets, against the repo's own stated
  perceptual floor of 2. Thirteen cells in the contact sheet, one silver tube,
  thirteen times. This is the *same fault* explainer 01 records as fixed:
  bidirectional albedo modulation plus a roughness swing still loses to a
  near-mirror clearcoat sitting on top of it. Next lever is the clearcoat layer
  itself.
- **The exposure compromise**, above — the shipped window is a compromise across
  four materials because a constant cannot be anything else.
- **Terminal Flicker never travels** (span 7.76, smallest in the family). Its hit
  rate is a fixed 14% of cells, and the cell-size fix cut the cell count ~4×, so
  ~4× fewer cells flicker than when that constant was chosen. Left alone rather
  than guessed at.
- **Every animated preset moves on the integer cell lattice**, so motion is a
  series of one-cell jumps, and doubling the cell size doubled each jump.
- **The braille-vs-diacritics question is open**, and so is whether
  structure-aware glyph selection (choose among `/ \ | _` by local gradient
  angle, not by tone) would let ASCII follow a form its cell size is too coarse
  to model. That is the most promising unexplored direction in this family.
