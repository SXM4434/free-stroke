# Screen-space style layers — what makes them read, and what makes them weak

Scope: `lib/texture-shader.ts`, `lib/dither-shader.ts`, `lib/ascii-shader.ts`,
`lib/style-shader.ts` and the parts of `lib/style-system.ts` that configure
them. This pass asked a question earlier passes did not: **does it look good** —
not "did it change pixels".

Everything below is either **MEASURED** (a number from a frame captured in this
pass, with the file it came from) or **DERIVED** (arithmetic from the shader
source, shown) or **OPEN** (a question a source should settle and that this pass
did not settle). Nothing is asserted from a source that was not read.

---

## 0. The test bed, and why the old one could not find these faults

`verify-style.mjs` proves an effect changed pixels. `verify-style-craft.mjs`
(previous pass) shoots the real viewport at 2× and builds contact sheets, which
is much better — but it drives the three machines through their **raw
parameters** at one harness-chosen setting.

A rail preset does not work like that. It writes only its own family's fields,
so the **material comes from somewhere else entirely**: choosing a geometry mode
chooses the material (`MODE_MATERIAL_DEFAULTS`).

| mode | default material | ink luminance, layers off (0–255) | σ |
|---|---|---|---|
| solid | `matteClay` | 133.4 | 18.2 |
| extrude | `glossyPlastic` | 158.3 | 38.7 |
| rod | `ink` | 125.6 | 65.6 |
| inflate | `softGel` | 155.2 | 33.3 |

MEASURED — `docs/verification/screen-layers/before/report.json`, ink region of
the macro crop, each engine on its own default material.

So the new harness (`scripts/verify/verify-screen-layers.mjs`) shoots **real
preset × real per-mode default material × all four modes**, and adds two
measurements the repo did not have:

- `dOff` — mean |Δ| against the same frame with every layer off. Low means the
  option does nothing. This is "hard to notice", as a number.
- `nnDist` — distance to the **nearest sibling in the same rail**. Low means two
  presets are the same look under two names. An effect can pass "it changed
  pixels" and still be redundant; nothing measured that before.

Two harness faults worth recording, because both produced *passing* evidence:

- **Ink was defined as "darker than 232"**, absolute. Soft Gel renders at ~230
  against ~247 paper, so the detector reported "no ink" on a frame that plainly
  contains a stroke. Ink is now paper-relative (`|L − paper| > 5`, paper measured
  as the modal stage luminance).
- **Framing once per run** let later crops drift off the form. A strip of blank
  paper scored `nnDist 0.00` and `meanDelta 0.02` — indistinguishable from "the
  whole rail collapsed" and from "the effect stopped working". Both now re-frame
  with an on-form assertion (`ink ≥ 0.12`) and retry.

---

## 1. The tone window is positioned in absolute luminance. The subject's
## luminance is chosen somewhere else.

This is the root cause behind most of the "goes flat" complaints.

Both post-lighting screens (dither, ASCII) map luminance onto a 0..1 ramp
through one shared helper, `fsToneWindow(lum, exposure, contrast)` in
`style-shader.ts`: exposure slides a window's centre, contrast sets its
half-width. Both ends were absolute display values.

DERIVED, from the shader as it stood: at the default dial position (0.5) the
half-width was `mix(0.62, 0.07, 0.5) = 0.345`, so the window spanned 0.69 of the
tone range. Against the measured σ above, that is **4.9× the Solid engine's
spread** and 2.7× Extrude's. A quantiser whose window is five times the range of
what it is quantising spends its whole ramp on tones the subject does not have,
so every cell lands on the same level.

That is exactly what the frames showed. MEASURED:

- `before/sheets/solid_dither_macro.png` — halftone dots all the same size
  across the whole form. No modelling at all.
- `before/sheets/solid_ascii_macro.png` — all five ASCII presets render as one
  uniform weave; one character everywhere.

And the OFAT sweep says the same thing from the other direction. MEASURED,
`sweep/sheets/sweep_solid_dotMatrix.png`, exposure × contrast on a halftone: dot
size only begins to **vary across the form** at contrast 0.8 (half-width 0.18).
Every cell at contrast 0.2–0.5 is uniform wallpaper. The good region sat at the
extreme end of the dial, so no preset was reaching it.

**Then the overshoot, which is the more useful half of the finding.** Narrowing
the range to `0.34..0.02` — the width Solid's σ asks for — sent three of the
five Extrude presets **entirely to paper**: Dot Matrix, Hard Threshold and Pixel
Signal rendered as blank white ribbons, and that rail's mean `nnDist` collapsed
21.1 → 8.0, because every screen converges on the same blown-out silhouette once
the body tone sits above the window.

Too wide flattens. Too narrow clips. Both are the same fault: **the window is
positioned in absolute display luminance while the subject's luminance is
decided by a material the preset does not know about.** Shipped compromise:
`0.48..0.05`, the widest setting that still shows dot-size variation on Solid
while keeping Extrude's body inside the window.

**The fix that removes the compromise** — not built in this pass, deliberately,
because it changes what the dial *means*: auto-exposure. Derive the window
centre from the material actually in use, so `ditherExposure` becomes a relative
offset (± a stop around the body tone) instead of an absolute position. Two ways
in, with the honest objection to each:

1. **In-shader, from the material's own uniforms.** `diffuse` and `emissive` are
   declared before `#include <common>` in `meshphysical.glsl.js`, so injected
   code can read them. DERIVED cost: albedo predicts the rendered body tone well
   for rough dielectrics (`matteClay` #6f6457 → display luminance 0.398 vs
   rendered 0.523, ratio 1.31) and badly for glossy dark ones (`ink` #26262b →
   0.151 vs rendered 0.493, ratio 3.3), because a glossy dark surface is mostly
   specular. So albedo alone is not enough, and adding a specular estimate means
   guessing weights.
2. **CPU-side, from a measured table.** One reference tone per material,
   measured with this harness and stored beside `MATERIAL_PARAMS`. Honest and
   exact for the 14 presets; needs a re-measure whenever a material moves, and
   needs a fallback for `custom`.

Also note the colour-space trap for route 1: at the `#include
<dithering_fragment>` injection point `gl_FragColor` is already in **output
(sRGB) space, after tone mapping**, while `diffuse` is in **linear working
space**. Any comparison between them has to encode one to match the other.

**OPEN:** whether a published auto-exposure key-value method (Reinhard's
log-average luminance is the obvious candidate) transfers usefully when the
"scene" is one stroke and no histogram is available. Not read; not cited.

---

## 2. Glyph legibility and subject width are in direct conflict, and the ASCII
## rail was on the wrong side of it

DERIVED: `asciiCellSize` divides `gl_FragCoord`, which is in **framebuffer**
pixels — so the number is device pixels, and on a 2× display a 9px cell is 4.5
CSS px. The glyph inside it is a 5×5 bitfield sampled with `floor()`, so a glyph
pixel is a hard square of exactly `cell/5` device pixels. At 9px that is 1.8.

To render a 1-bit stroke *as a stroke* an on-off-on triple has to survive, which
takes ≈3 device pixels per glyph pixel — a cell of ≈15. All eleven presets on the
two ASCII rails shipped at 8–11px (1.6–2.2 px per glyph pixel) while the state
default and the Layer Stack / Fusion presets sat at 12–22. The two rails whose
entire purpose is showing glyphs were the only place that never got the fix.

MEASURED, the other side of the conflict: `sweep/sheets/sweep_rod_terminalShade.png`
— fifteen dial combinations on Rod, every one of them a dark noodle with a few
marks on it. A Rod limb is ~25 device px across at default thickness, so a
mid-teens cell gets one and a half cells to work with. **ASCII structurally
cannot render on Rod**, at any dial setting, and `binarySkin` was recommending
Rod as a best mode.

This is the family's real trade-off, and it is worth stating plainly because it
governs future work: **a dither cell can be small, because a dither mark does
not have to be identifiable as a shape. A glyph cell cannot.** So dither can
model a thin stroke and ASCII cannot — ASCII on a narrow form is a graphic
overlay, not a tonal model, and should be judged as one.

**OPEN:** the published minimum legible x-height in device pixels for bitmap
type. The ≈15 above is derived from this sampler, not from a source. Also open:
whether structure-aware glyph selection (choosing among `/ \ | _` by local
gradient angle, rather than by tone alone) would let ASCII follow a form that
its cell size is too coarse to model tonally. That is the most promising
unexplored direction in this file and it is not built.

---

## 3. Braille vs stacked combining diacritics for animation resolution

**ANSWERED, in its own document.** This strand ran long enough to deserve
separate treatment and the sources were read directly there:
[`ascii-glyph-resolution-and-temporal-stability.md`](ascii-glyph-resolution-and-temporal-stability.md).
The short version, with the numbers that matter here:

- The diacritics claim is **false for our architecture and backwards even in a
  real text renderer.** The mechanism that would turn "N stacked marks" into "N
  vertical increments" is OpenType GPOS lookup type 6 (mark-to-mark attachment),
  whose anchors live in *font tables* consumed by a shaper. We have no font and
  no shaper.
- Dots per cell, counted honestly: braille **8** (2 × 4), our existing bitfield
  **25** (5 × 5), a diacritic stack **2**, collapsing to **1** under Unicode's
  own documented fallback. We already out-resolve braille by 3.125×.
- Which confirms, from the source side, the conclusion §2 reached from the
  measurement side: the constraint on our glyph layer was never the alphabet, it
  was **device pixels per glyph pixel.**

That document also supersedes part of §4 below with a sharper root cause, and it
records the one thing this document's motion numbers get wrong — see the note at
the top of §4.

**"Bad Apple" as a reference test:** looked for, and it does **not exist as
written analysis.** Ten-plus terminal renderers on GitHub, README-and-code only;
no author reports crawl, strobing or flicker, with or without numbers. It is
folklore, not literature. Details and the list in the sibling document's §7.

---

## 4. Animated presets: three faults, and what they share

> **Read the frame rate before trusting the numbers in this section.** These come
> from `page.screenshot()` at roughly 4 fps, and a pattern advancing ~2 threshold
> cells per second **aliases** at that rate. The sibling document re-measured the
> same presets with an in-page `requestAnimationFrame` sampler holding 120.1 Hz
> and found the sampling had been hiding the severity: Dither Crawl is frozen for
> **94.6% of frames** and then inverts by 45.1/255, six times a second. The
> faults identified below are real and the fixes are verified, but for anything
> about *smoothness* the 120 Hz report is the authority, not this one. You cannot
> judge motion at 4 fps.

MEASURED, `after/motion-report.json`, 64 frames per cell, Solid, headed Chrome +
Metal ANGLE. Videos under `after/video/*.mp4`.

**a. A one-shot that could not fire.** `completionPulseDither` set `motionMode:
"syncToDraw"` but never `ditherSyncMode`. `resolveSyncMode` maps `syncToDraw`
onto `revealSynced` for any layer that has not opted into a more specific
reveal behaviour, so it resolved to *the same mode as the preset above it* and
never pulsed. Measured before: byte-identical to the **static** Dot Matrix
preset on all four engines — `dOff` 48.034 / 22.434 / 9.809 / 37.642, matching
Dot Matrix to three decimals on every one. After `ditherSyncMode:
"completionPulse"`: span 62.8, peak frame delta 20.3, and **rest 0.0** — it
pulses and it stops.

**b. A reveal animation that was arithmetically a no-op at rest.**
`revealDensity` did `fsLevel = floor(fsLevel * reveal + 0.5)` on an
already-integer level: bit-identical to no animation whenever the playhead rests
at 1 (the state the whole rail is browsed in), and stepping in whole ramp levels
while the draw ran. Moved to act on the continuous tone before quantisation.
After: span **106.5**, the largest travel of any animated ASCII preset, rest 0.0,
and the build reads as a smooth density ramp in
`after/sheets/motion_asc_reveal_strip.png`.

**c. A global luminance strobe.** `characterCycle` advanced every cell's ramp
position in lockstep, so the whole form passed through the ramp's **blank glyph
simultaneously** — a full-frame flash to dark roughly every 3.3s. Visible in
`after/sheets/motion_asc_cycle_strip.png` (f6 dense, f12 almost empty, f36
dense, f42 empty). Signature in the numbers: mean 7.9 with peak 43.7 and floor
0.0 — long stillness punctuated by one enormous jump. Fixed by offsetting the
ramp phase per cell by a hash.

| | before | after |
|---|---|---|
| mean frame Δ | 7.92 | 8.09 |
| **sd** | **12.699** | **2.349** |
| **max** | **43.723** | **15.837** |
| min | 0.000 | 4.335 |

It moves just as much and it no longer blinks. Control: `dit_crawl` and
`asc_flicker` are unchanged to three decimals across the same build, so the fix
is scoped to the one branch.

**What the three share.** All three are **timing-origin faults in disguise**, the
same family the repo already documented ("time-based effects need an explicit
origin"). (a) read its mode from the wrong control surface; (b) measured its
effect after quantisation, where the origin's own resting value is the identity;
(c) gave every cell the *same* origin when the effect only reads as motion if
they differ. In each case the code was correct and the render was wrong, and none
of them would have survived a frame check — which is why none of them had had
one.

**And there is a deeper cause underneath (b) and (c)**, found independently by the
sibling document and stated better there: every animated screen layer was moving
a **quantised index** — a threshold-matrix cell, a glyph bit, a ramp level —
rather than the continuous quantity that gets quantised. Motion then arrives as
hold, hold, hold, full-quantum jump, and no change of speed fixes it because the
step is a whole quantum at any rate. Fault (b) is that bug exactly, and its fix
(multiply the continuous tone, not the integer level) is the general remedy in
miniature. For ordered dither matrices — bayer, blue noise — it is an
*impossibility* rather than a tuning problem: the defining property of an ordered
dither is that adjacent cells hold maximally different thresholds, so translating
one by a cell replaces every threshold with an uncorrelated value. It cannot
move; it can only re-roll. That is why the two presets that translated an ordered
matrix have been changed to continuous screens.

**A fourth duplicate, found by assertion rather than by eye.** `revealDither` was
a bayer4 at scale 3 — bit-for-bit `bayerClassic`'s configuration — and its
reveal-driven bias sweep is legitimately zero once the playhead rests at 1. So at
rest it rendered **pixel-identical to a static preset on the other rail**:
cross-rail Δ **0.000** on both Solid and Extrude. Two tiles in the UI, one frame.
This is the failure mode `nnDist` was built for and still missed, because `nnDist`
only compares within a rail; `scripts/verify/assert-screen-layers.mjs` now
measures across both rails of a family. Moved to a `diamond` screen — the only
faceted option on either rail, unused by the other ten presets — so the preset is
worth looking at during the 99% of its life that is *after* its reveal. Closest
cross-rail pair afterwards: Δ 26.94 on Solid, 8.68 on Extrude.

**Also measured, and NOT fixed:**
- `thresholdSweep` has mean frame Δ 1.41 but span 32.7 — slow, not dead. This is
  why `spanDelta` had to be added: a slow effect and a dead one are identical in
  a frame-to-frame metric, and the previous pass's motion report only had
  frame-to-frame.
- `asc_flicker` span is **7.76**, the smallest in the family — it flickers but
  never travels. DERIVED cause: the hit rate is a fixed `r > 0.86` (14% of
  cells), and the cell-size fix cut the cell count ~4×, so ~4× fewer cells
  flicker than when that constant was chosen. Left alone rather than guessed at.
- Every animated preset here moves on the **integer cell lattice** (`floor()` on
  the threshold/glyph coordinate), so its motion is a series of one-cell jumps
  rather than continuous travel — and doubling the cell size doubled the size of
  each jump. `dit_crawl` shows it: sd 11.9 with a floor of 0.0.

---

## 5. Texture on a glossy dark material is still invisible

MEASURED, `before/report.json`, texture rail on Rod (`ink`): `dOff` **1.0–4.1**
across all twelve presets, with mean nearest-sibling distance **2.7**. The
repo's own `diff-frames.mjs` calls mean Δ < 2 "below the perceptual floor on a
dark subject". Look at `before/sheets/rod_texture_macro.png`: thirteen cells,
one silver tube, thirteen times. On Extrude (`glossyPlastic`) it is `dOff`
3.0–12.9, `nnDist` 6.6–8.9.

This is the *same fault* explainer 01 documented as fixed — "a texture pattern
invisible on glossy black (albedo-only modulation)". The fix then was to make the
modulation bidirectional and to also modulate `material.roughness`. DERIVED why
it is still not enough: on `ink` (albedo #26262b, clearcoat 0.9,
clearcoatRoughness 0.1, env 1.1) almost all visible luminance is the clearcoat
and environment lobe. Modulating a near-black albedo in either direction stays
near black, and the roughness swing is applied *under* a clearcoat that is
itself near-mirror.

Not fixed in this pass; the texture shader was retuned by the previous pass for
feature size and anti-aliasing and re-verifying that work was the priority. The
next lever to try is the clearcoat layer itself rather than the base roughness.

---

## 6. Sources actually read for this document

None. Every number here is a measurement from a frame captured in this pass or
arithmetic from the shader source, and each is labelled. The literature for this
family lives in the sibling document
([`ascii-glyph-resolution-and-temporal-stability.md`](ascii-glyph-resolution-and-temporal-stability.md)),
which read its sources directly and quotes them verbatim with page numbers; the
questions still open here — auto-exposure key-value methods (§1), a published
minimum legible cell size (§2), structure-aware glyph selection (§2) — are open
because nobody read a source on them, not because a source was skimmed.

This split is deliberate. The standing complaint about research in this project is
that it is a restatement of our own code wearing citations. An empty sources
section with honest measurements is worth more than a populated one that cannot be
checked — and a citation I could not verify was written into a code comment during
this pass and had to be removed, which is the exact failure the rule exists to
prevent.
