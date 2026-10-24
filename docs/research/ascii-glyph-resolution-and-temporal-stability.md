# Glyph resolution and temporal stability in the screen layers

*Two questions that turned out to be one. First: Sebs's proposal that **stacked
combining diacritics beat braille for ASCII animation resolution**. Second: why
so many animated presets on the dither and ASCII rails read as "weak", "hard to
notice", or "just don't do anything". The first is a dead end, and finding out
exactly why it is a dead end named the mechanism behind the second.*

---

## The bottom line

**The diacritics claim is false for our architecture, and backwards even in a
real text renderer.** The thing that would turn "N stacked marks" into "N
vertical increments" is OpenType GPOS **lookup type 6, mark-to-mark
attachment** — and its anchor positions live in *font tables*, consumed by a
shaping engine. Our glyphs are 5×5 bitfields indexed in a fragment shader
(`lib/ascii-shader.ts`, `bit = x + 5*y`). There is no font, no shaper, no
anchors, so there is no mechanism for a second mark to sit above the first.
Counted honestly, per character cell: braille gives **2 × 4 = 8** addressable
dots, our existing bitfield gives **5 × 5 = 25**, and a diacritic stack gives
**1 column × 2 standard-guaranteed zones = 2**, collapsing to **1** under the
Unicode Standard's own documented fallback. We already out-resolve braille by
3.125×. See §1–§3.

**The real bottleneck is temporal, not spatial, and it has one cause.** Every
animated screen layer was moving a *quantised index* — a threshold-matrix cell,
a glyph bit, a ramp level — rather than the continuous quantity that gets
quantised. Motion therefore arrived as: hold, hold, hold, **full-quantum jump**.
Measured at the true 120 Hz display rate, Dither Crawl was frozen for **94.6% of
frames** and then inverted with an amplitude of **45.1/255**, six times a
second. That is not a slow crawl, it is a strobe, and no change of speed fixes
it because the step size is a full quantum at any rate. See §4.

**For ordered dither matrices this is a genuine impossibility, not a tuning
problem.** What makes bayer and blue noise good dithers is that adjacent cells
hold maximally *different* thresholds. Translating such a matrix by one cell
therefore replaces every pixel's threshold with an uncorrelated value: the
pattern cannot move, it can only re-roll. §4.2 proves this from the shader
source, and §5 records the fix and the before/after numbers.

**The transferable literature is one paper, and it is not about characters.**
NVIDIA's *Spatiotemporal Blue Noise Masks* (EGSR 2022) is the correct mechanism
for the residual strobing, and it argues for a threshold *volume* over time —
not for charset exotica. §6.

---

## 1. The braille formula, exactly

The Unicode Standard specifies this normatively in §21.1 "Braille"
([ch21.pdf, p. 828](https://www.unicode.org/versions/Unicode15.0.0/ch21.pdf)).
The dot-to-weight layout, verbatim from the standard, in **octal**:

```
1  ●●  4          weights:      1  ●●  10
2  ●●  5                        2  ●●  20
3  ●●  6                        4  ●●  40
7  ●●  8                      100  ●●  200
```

> "The 256 Braille patterns are arranged in the same sequence as in ISO/TR
> 11548-1, which is based on an octal number generated from the pattern
> arrangement." … "The octal number is obtained by adding the values
> corresponding to the dots present in the pattern."

Converted to bits:

```
codepoint = 0x2800 + Σ 2^(d−1)   over raised dots d ∈ {1..8}
```

with a grid mapping that is the reason every implementation ships a lookup table
instead of arithmetic — column-major over the 2×3 six-dot core, with the fourth
row **bolted on at bits 6–7**:

| | x = 0 | x = 1 |
|---|---|---|
| y = 0 | dot 1 → bit 0 | dot 4 → bit 3 |
| y = 1 | dot 2 → bit 1 | dot 5 → bit 4 |
| y = 2 | dot 3 → bit 2 | dot 6 → bit 5 |
| y = 3 | dot 7 → **bit 6** | dot 8 → **bit 7** |

Verified twice. The standard's own worked example: DOTS-1247 = 1₈ + 2₈ + 10₈ +
100₈ = 113₈ = 75 = 0x4B → U+284B, and the code chart
([U2800.pdf](https://www.unicode.org/charts/PDF/U2800.pdf), p. 286) reads
"284B BRAILLE PATTERN DOTS-1247". And
[drawille](https://github.com/asciimoo/drawille) — the origin of the whole
family of braille terminal renderers — encodes exactly this table:

```python
pixel_map = ((0x01, 0x08), (0x02, 0x10), (0x04, 0x20), (0x40, 0x80))
braille_char_offset = 0x2800
self.chars[row][col] |= pixel_map[y % 4][x % 2]
```

Our `braille` charset (`ASCII_CHARSET_INDEX.braille = 5`) is well-founded and the
formula is cheap. Nothing here needs changing.

## 2. Why the diacritics trick cannot survive our architecture

The mechanism that makes stacked marks *stack* is GPOS lookup type 6. From the
[Microsoft OpenType GPOS spec](https://learn.microsoft.com/en-us/typography/opentype/spec/gpos),
verbatim:

> "Mark-to-mark attachment defines the position of one mark relative to another
> mark… every mark1 glyph has an anchor attachment point… Each mark2 glyph
> defines an anchor point for each class of mark1 marks… **To combine the mark
> glyphs, the placement of the mark1 glyph is adjusted such that the relevant
> attachment points coincide. Advance widths are not affected.**"

The anchors live in `Mark1Array` / `Mark2Array`: **font tables**. Per-mark
vertical advance is therefore a property of the *font*, not of the *character*.
Our pipeline has no font and no shaper — a glyph is 25 bits, split lo(13)/hi(12)
because GLSL `highp` holds integers exactly only to 2²⁴
(`lib/ascii-shader.ts:17-20`). So "stack a diacritic" can only mean *author a
5×5 bitfield that looks like a stack*, i.e. choose bits. The character identity
buys nothing, because nothing downstream reads a character.

The standard is blunt that even real renderers only approximate this. §5.13
opens ([ch05.pdf, p. 222](https://www.unicode.org/versions/Unicode15.0.0/ch05.pdf)):

> "This discussion assumes the use of proportional fonts… Various techniques can
> be used with monospaced fonts. In general, however, **it is possible to get
> only a semblance of a correct rendering for most scripts in such fonts.**"

Stacking *order* is specified — the inside-out rule, §5.13 — but that is an
ordering, not a metric. Depth is explicitly bounded (p. 227):

> "a number of different heights of glyphs can be chosen to allow stacking of
> glyphs, **at least for a few deep**. (When these bounds are exceeded, then the
> fallback methods can be used.)"

And the fallback destroys the premise outright. Figure 5-7 "Fallback Rendering"
names three methods, of which **Simple Overlap** "uses a **default fixed
position** for an overlapping zero-width nonspacing mark" — every mark in the
stack lands in the same place. Guaranteed added positions: zero.

## 3. The resolution arithmetic

Marks have zero advance width (§5.13, p. 226: "Because the nonspacing mark has a
zero advance width, the composed character sequence will automatically have the
same width as the base character"). A stack is therefore **one column wide**;
braille is two. The stack forfeits the x axis, which is fatal for animation,
because animation is 2-D motion.

Vertically the encoding offers position *classes*, not levels. The complete
general repertoire, from
[PropertyValueAliases.txt](https://www.unicode.org/Public/UCD/latest/ucd/PropertyValueAliases.txt):
200 ATBL, 202 ATB, 214 ATA, 216 ATAR, 218 BL, **220 B (Below)**, 222 BR, 224 L,
226 R, 228 AL, **230 A (Above)**, 232 AR, 233 DB, 234 DA, 240 IS. There is no
combining class for "second above", and §5.13 (p. 226) states the hard
constraint: *"Two characters that have the same combining class values cannot be
given distinct internal weights."*

| scheme | addressable dots / cell | states / cell | bits / cell |
|---|---|---|---|
| braille U+2800–28FF | 2 × 4 = **8** | 2⁸ = 256 | 8.00 |
| **our 5×5 bitfield** | 5 × 5 = **25** | 2²⁵ = 33,554,432 | **25.00** |
| N stacked marks, standard-guaranteed | 1 × 2 = **2** | 4 | 2.00 |
| N stacked marks, Simple Overlap fallback | 1 × 1 = **1** | 2 | 1.00 |

25 / 8 = **3.125×**. The diacritic stack is 8× worse than braille in the
guaranteed case and 12.5–25× worse than what we already have.

**And our spatial bottleneck is not the container, it is how little of it we
use.** The braille ramp exercises 7 of those 2²⁵ states (`fsRampMaxFor(5) = 6.0`
→ ramp length 7), i.e. log₂ 7 ≈ **2.81 bits of 25**. Ramp depth and the
per-pixel-vs-cell-mean luminance limitation noted at `ascii-shader.ts:22-29` are
the real spatial work. Neither is touched by choosing different characters.

### 3.1 What actually breaks when you stack marks anyway

Not speculation — bugs from a mainstream terminal:

- [kitty #8318](https://github.com/kovidgoyal/kitty/issues/8318): 45
  `VARIATION SELECTOR-16` characters after an emoji cause a **stack buffer
  overflow** in `encode_utf8`.
- [kitty #8332](https://github.com/kovidgoyal/kitty/issues/8332): kitty **hangs**
  above 4096 combining characters in one cell (4095 is fine).
- [kitty #8533](https://github.com/kovidgoyal/kitty/issues/8533) publishes
  `kitten __width_test__` failures against Unicode grapheme test data: kitty
  master **0**, kitty 0.41.1 **45**, wezterm **179**, foot **186**, konsole
  **280**, iTerm2 **289**, gnome-terminal **317**, xterm **371**, Apple Terminal
  **479**. Cell-splitting of combining sequences is not portable, by measurement.

## 4. The real finding: animating a quantised index

### 4.1 The measurement that exposed it

Nothing in the repo could see this, because the existing motion harness
(`verify-screen-layers.mjs --only=motion`) samples with `page.screenshot()` at
150–500 ms per frame. At 2–6 fps a pattern advancing ~2 threshold cells per
second **aliases**: Dither Crawl measured a perfect two-state alternation there
(Δ = 0.0, 24.0, 0.0, 24.0 …, with 24 of 55 consecutive pairs bit-identical),
which looks like a total strobe but is partly an artifact of the sampling rate.
You cannot judge motion at 4 fps.

`scripts/verify/assert-layer-flicker.mjs` (added by this pass) samples *inside*
the page on `requestAnimationFrame`, reading a **native-resolution** crop of the
densest ink, and holds 120.1 fps over 300 frames. Two false conclusions it
produced before it was correct, both worth recording because both are easy to
repeat:

1. **Compositing onto transparency.** The r3f canvas is created with
   `alpha: true` and its paper colour is a CSS background on the *element*.
   `drawImage` copies only the drawing buffer, so the paper read as rgb(0,0,0),
   mean luminance came out at 5.1 on a paper-white viewport, and the ink mask was
   empty — every preset reported "DEAD".
2. **Downsampling below the feature size.** Drawing 700×768 into a 128×128
   buffer is a 5.5× box filter, and an ASCII glyph bit is `cellSize/5` = 3.6
   device px, i.e. 0.65 px in that read. Glyph Scroll measured span 0.011 over
   three seconds — "completely dead" — while a screenshot pair 1.4 s apart
   plainly differed. **Glyph Scroll was never broken; the ruler was.** Dither
   Crawl survived the same downscale only because a 2-level bayer step inverts
   large contiguous areas, which no box filter can hide.

### 4.2 Why translating an ordered matrix cannot work

`fsDitherThreshold` (`lib/dither-shader.ts`) splits cleanly in two:

- **Discontinuous in the coordinate:** `bayer4`/`bayer8` (`fsBayer`, an ordered
  matrix indexed by integer cell) and `blueNoise` (`fsIGN(floor(co))`).
- **Continuous in the coordinate:** `halftone`, `lines`, `dotScreen`, `hatch`,
  `crosshatch`, `diamond` — smooth functions of position.

The motion is applied identically to both, one line before the lookup:

```glsl
fsDCo += vec2(uFsDitDirX, uFsDitDirY) * uFsDitTime;
```

For the continuous family that is genuine travel with sub-pixel increments. For
the ordered family it is not motion at all, and the reason is the *defining
property* of an ordered dither: **adjacent cells hold maximally different
thresholds** — that is what spreads quantisation error. Translate by one cell and
every pixel's threshold becomes an uncorrelated value; translate by less than one
cell and, because the index is a `floor`, *nothing happens*. Hold, invert, hold.
Translation by a full period returns the identical pattern, so the whole
behaviour is a cycle through N uncorrelated states, N = the matrix period. There
is no speed at which that is smooth.

### 4.3 The measurements, all four modes' worth of theory in one table

Solid engine, 300 frames at 120.1 Hz
(`docs/verification/layer-flicker/before/flicker-report.json`):

| preset | type / motion | frozen frames | p95 jump | updates/s | verdict |
|---|---|---|---|---|---|
| Dither Crawl | bayer4, **translated** | **94.6%** | **45.1** | 6.4 | STROBE |
| Diagonal Matrix Drift | bayer8, **translated** | **73.6%** | 15.1 | 31.7 | JUDDER |
| Threshold Sweep | bayer8, **bias motion** | 48.8% | **1.04** | 22.1 | smooth |

Threshold Sweep is the control, and it settles the argument: *same matrix, same
shader*, but it animates the **continuous** tone bias with `ditherDirection:
"static"`, and its worst frame moves 1.04/255 where Dither Crawl's moves 45.1.
The rail contained both the disease and its cure, side by side, unnoticed.

The prediction and the measurement agree exactly: the only two presets on the
rail that translate an ordered matrix are the only two that fail.

### 4.4 The same arithmetic, elsewhere

The pattern generalises, which is what makes it a root cause rather than a bug:

- **ASCII glyph translation** steps in 1/5-cell quanta, because the glyph is
  sampled as `fsGlyphPixel(fsIdx, floor(fsCellUV * 5.0))`. Slow Code Crawl is
  frozen 68% of frames for this reason. Here the quantisation is *correct* — a
  character should have crisp bit-cells — so the remedy is rate, not continuity:
  38 steps/s reads as motion, 8 would not.
- **`revealDensity` was the same bug, and was already fixed by the same move.**
  It used to be `fsLevel = floor(fsLevel * reveal + 0.5)` — animating the
  quantised ramp *index*, which is bit-identical to no animation whenever the
  playhead rests at 1, and which advances in whole ramp steps while the draw-in
  runs. It now multiplies the **continuous** tone before quantisation
  (`fsALum *= clamp(uFsAscReveal, 0.0, 1.0)`). That single edit is the general
  remedy in miniature: *animate the value, not the index*. It was applied to one
  behaviour out of seven.
- **Terminal Flicker is the honest exception.** Frozen 89.3% of frames, 12.9
  updates/s, travel ratio 1.86 — by the numbers a strobe, and it is meant to be
  one. `floor(uFsAscTime * 8.0)` is a deliberate tick. The rule is "animate the
  value, not the index" *unless the index is the idea*.

## 5. What changed, and the after numbers

Both translating presets moved to continuous screens; ordered matrices now
appear only **still** (bayerClassic, pixelSignal) or animated **through the
bias** (Threshold Sweep).

| preset | before | after |
|---|---|---|
| Dither Crawl → `dotScreen`, speed 0.5 → 0.25 | frozen 94.6%, p95 45.1, stepiness 19.0, travel 2.2 | frozen **0%**, p95 **3.99**, stepiness **1.32**, travel **18.4** |
| Diagonal Screen Drift → `hatch`, speed 1.5 → 0.3 | frozen 73.6%, p95 15.1, stepiness 4.08 | frozen **6%**, p95 14.5, stepiness **3.34**, travel 7.9 |

Speeds came down because a continuous screen's velocity is finally meaningful:
cell screens multiply scale by 2.4 in the shader, so Dither Crawl's scale 3 is a
7.2 px lattice, and the old speed 0.5 crossed three lattice periods a second — a
shimmer, not the "drifts slowly" it advertises. 0.25 gives 1.5 periods/s ≈
0.09 px per frame at 120 Hz. Diagonal Screen Drift's scale 5 is a 12 px hatch
period; 1.5 crossed nine periods a second, which on a regular line pattern is
where travel becomes wagon-wheel shimmer.

Frames and video:
`docs/verification/screen-layers/qualitypass/` (before) and
`qualitypass-after/` (after), plus real-time recordings under
`docs/verification/layer-flicker/*/video/`.

## 6. Temporal stability: the one transferable paper

The residual amplitude in Diagonal Screen Drift (p95 14.5) is per-cell
independent quantisation, and the primary source on that is
[Spatiotemporal Blue Noise Masks](https://research.nvidia.com/publication/2022-07_spatiotemporal-blue-noise-masks)
(Wolfe, Morrical, Akenine-Möller, Ramamoorthi; EGSR 2022), verbatim:

> "Current methods of applying different blue noise masks to each rendered frame
> result in either white noise frequency spectra temporally, and thus poor
> convergence and stability, or lower quality spatially."

Their construction retains spatial blue noise while distributing values "well
… over time", giving blue-noise spectra "in both the spatial and temporal
domains" and "increased stability when filtered temporally". That is exactly our
failure mode stated in someone else's vocabulary, and it prescribes a threshold
**volume** — a 3-D mask sampled by (x, y, frame) — rather than a translated 2-D
one. It is the principled next step for `blueNoise`, and notably it does *not*
recommend anything about charsets.

## 7. Honest dead ends

- **"Bad Apple" written analysis does not exist.** The canonical stress test is
  real as a lineage — 10+ terminal renderers on GitHub (`trung-kieen/bad-apple-ascii`,
  `FelipeFMA/BadAppleBash`, `Ubuntufanboy/bad-apple`, `leafyao8621/badapple`,
  and others), plus the drawille family in node/php/ruby/lua/bash/nim/clojure —
  but every one is README-and-code only. **No author reports crawl, strobing,
  temporal dithering or per-frame flicker.** No numbers, no observations. The
  test is folklore, not literature; if we want that data we have to measure it
  ourselves, which is what §4 does.
- **ASCII-specific temporal literature is absent.** The canonical character-cell
  paper — [Structure-based ASCII Art](https://ttwong12.github.io/papers/asciiart/asciiart.html),
  Xu, Zhang & Wong, ACM TOG 29(4), SIGGRAPH 2010 — is purely still-image and
  does not discuss animation, video or flicker at all. Its contribution is an
  alignment-insensitive shape-similarity metric, orthogonal to our problem.
- **UAX #15 not quoted.** I could not extract usable verbatim text from
  [tr15](https://www.unicode.org/reports/tr15/); the normative substance came
  from the UCD data file and Core Spec §5.13 instead. The claim that equal-ccc
  marks retain relative order follows from the Canonical Ordering Algorithm being
  a *stable* sort, and is consistent with §5.13, but is not quoted from UAX #15.
- **UNVERIFIED:** Bénard/Bousseau/Thollot, "State-of-the-Art Report on Temporal
  Coherence for Stylized Animations" (CGF 2011), which likely defines the
  flickering/popping/sliding taxonomy we are informally using, was
  **unreachable** — hal.science 403, maverick.inria.fr 404, labri.fr refused,
  Wiley 403. Not cited, because not read.
- **Not attempted:** whether a `dotScreen` crawl and a `halftone` static screen
  are distinguishable enough to justify both. `nnDist` in
  `verify-screen-layers.mjs` is the tool for that question and this pass did not
  run the stills sweep.

---

## Sources

[Unicode Core Spec ch. 21 (§21.1 Braille)](https://www.unicode.org/versions/Unicode15.0.0/ch21.pdf) ·
[Unicode Core Spec ch. 5 (§5.12–5.13)](https://www.unicode.org/versions/Unicode15.0.0/ch05.pdf) ·
[U+2800 code chart](https://www.unicode.org/charts/PDF/U2800.pdf) ·
[PropertyValueAliases.txt](https://www.unicode.org/Public/UCD/latest/ucd/PropertyValueAliases.txt) ·
[OpenType GPOS](https://learn.microsoft.com/en-us/typography/opentype/spec/gpos) ·
[drawille](https://github.com/asciimoo/drawille) ·
[kitty #8318](https://github.com/kovidgoyal/kitty/issues/8318) ·
[kitty #8332](https://github.com/kovidgoyal/kitty/issues/8332) ·
[kitty #8533](https://github.com/kovidgoyal/kitty/issues/8533) ·
[kitty text-sizing protocol](https://sw.kovidgoyal.net/kitty/text-sizing-protocol/) ·
[Spatiotemporal Blue Noise Masks](https://research.nvidia.com/publication/2022-07_spatiotemporal-blue-noise-masks) ·
[Structure-based ASCII Art](https://ttwong12.github.io/papers/asciiart/asciiart.html)
