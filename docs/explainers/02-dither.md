# Explainer 02 — Dither (and animated dither)

What got built in `POST_MVP_DITHER_AND_ANIMATED_DITHER_PHASE_1`, the math behind
it, and how it stays a genuinely different system from texture.

Files: `lib/dither-shader.ts` (new), `lib/style-shader.ts` (new),
`lib/texture-shader.ts` (refactored), `lib/style-system.ts`,
`components/viewport-3d.tsx`, `components/style-panel-scaffold.tsx`,
`app/page.tsx`.

Read [01 — Procedural texture](01-procedural-texture.md) first if you haven't;
this builds on the shader-injection idea explained there.

---

## 1. What dithering actually is

Dithering solves an old problem: **you have more shades than you can print.**

Imagine you can only use pure black and pure white ink, but you need to show a
grey stroke. You can't make grey. What you *can* do is put black and white
pixels next to each other in a pattern — from a distance the eye averages them
and sees grey. Half black pixels reads as 50% grey; a quarter reads as 75%
white.

That's dithering. It trades *tonal* resolution for *spatial* resolution. It is
why old newspapers, Game Boys, and 1-bit Mac art look the way they do — and that
look is exactly what you're after.

### Threshold maps: why the pattern isn't random

The naive approach is to round each pixel to the nearest available shade. That
gives you flat bands of solid colour with hard edges where the rounding flips —
ugly, and it destroys the gradient entirely.

The fix is a **threshold map**: a small tile of numbers, one per pixel position,
that says "the bar this pixel must clear to round up". Because different
positions have different bars, a region of uniform 40% grey doesn't all round the
same way — 40% of the pixels clear their bar and go white, 60% don't. The local
average is preserved, and the pattern is stable and structured rather than noisy.

The whole algorithm is one line:

```
output = quantize( luminance + (threshold(x,y) − 0.5) )
```

**The − 0.5 is not cosmetic.** The threshold values run 0 to 1, so without
centering them they'd only ever push pixels *up*, and the whole image would
brighten. Subtracting half centres the offset so it pushes up as often as down,
preserving average brightness. Wikipedia flags this explicitly as the thing
people get wrong.

---

## 2. The Bayer matrix, and how we generate it without a table

The classic threshold map is the **Bayer matrix**. Its defining property: the
numbers are arranged so that as tone increases, the pixels that turn on are
maximally spread out at every scale. You never get clumps.

It's built recursively. Start with 2×2:

```
0  2
3  1     (divided by 4)
```

To double the size, take four copies of the current matrix and add offsets to
each quadrant in the order top-left 0, top-right 2, bottom-left 3, bottom-right
1 — the same 0,2,3,1 ordering as the base tile, one level up. Repeat for as many
levels as you want. Two levels gives 4×4, three gives 8×8.

Most implementations hardcode the resulting 16 or 64 numbers in a lookup table.
We compute it arithmetically instead:

```glsl
float shift = pow(2.0, float(levels - 1 - i));
float bx = mod(floor(p.x / shift), 2.0);
float by = mod(floor(p.y / shift), 2.0);
float q = 2.0 * bx + 3.0 * by - 4.0 * bx * by;
divisor *= 4.0;
result += q / divisor;
```

Each iteration reads **one bit** of the x and y coordinate, coarsest bit first —
that bit says which quadrant you're in at that level of refinement. The
expression `2bx + 3by − 4bx·by` is just a compact way to write the quadrant table
(it evaluates to 0, 2, 3, 1 for the four bit combinations). Dividing by an
increasing power of 4 and summing builds the number base-4, digit by digit.

Why bother: **one function serves both 4×4 and 8×8** via the `levels`
parameter, with no tables to keep in sync. And adding a 16×16 later is a
one-character change.

### The other three threshold maps

| Type | Threshold source | Reads as |
|---|---|---|
| **Bayer 4×4 / 8×8** | The recurrence above | Ordered computational crosshatch |
| **Noise (IGN)** | Interleaved gradient noise | Soft, organic, less mechanical |
| **Halftone** | Distance from cell centre | Print-style dots that grow with tone |
| **Lines** | Position across the cell | Marks that grow as thickening lines |

**Halftone** is worth understanding because it's the most physical: the
threshold is *low at the centre of each cell and high at the edges*. So as tone
increases, the centre crosses its threshold first and a dot appears, then the
dot grows outward. That is literally how newspaper halftone printing works —
bigger dots for darker areas.

**A naming honesty note:** the "noise" option is *interleaved gradient noise*,
not true blue noise. Real blue noise needs a precomputed texture; IGN is the
standard cheap approximation with much better spatial distribution than a plain
random hash. The UI says "Noise threshold (IGN)" rather than claiming blue noise.

---

## 3. Why dither injects at a different place than texture

This is the part that makes them genuinely different systems rather than two
flavours of the same thing.

- **Texture** modulates what the surface *is* — its colour and its roughness —
  **before and during** lighting. It changes how light interacts with the
  material.
- **Dither** takes the **final shaded pixel**, after all lighting, tone mapping
  and colour conversion have run, and reduces it to fewer tones.

In shader terms:

```
  ... texture injects here (albedo) ...
  ... lighting runs ...
  ... texture injects here too (roughness → affects the highlight) ...
  ... tone mapping, colour space ...
  ... dither injects HERE, dead last ...
```

Stack both and you get "a patterned surface, then rendered in limited tone" —
which composes correctly. If dither ran earlier it would get re-lit and lose the
crisp two-tone quality that makes it read as dither at all.

### One material, one hook, many systems

A three.js material has exactly one `onBeforeCompile`. Since texture and dither
must both live on the same shared material, `lib/style-shader.ts` is a single
composer that stitches each system's GLSL into the right chunk. Each system
still owns its own module, its own uniforms, and its own state — the separation
your PRD demands is preserved in the code structure, not just in intent.

---

## 4. Colour: keeping materials distinguishable

A subtlety. The obvious way to output dither is pure black or pure white. But
then every material preset produces an identical image — Soft Gel and Matte Clay
would be indistinguishable, which throws away the entire material system.

So instead of replacing the colour, we **separate the pixel into hue and
brightness**, quantize only the brightness, and re-apply the original hue:

```glsl
vec3 fsTint = fsCol / max(fsLum, 0.001);   // colour with brightness divided out
vec3 fsDithered = fsTint * fsQ;            // re-apply quantized brightness
```

Dividing a colour by its own luminance leaves its *character* — the ratio
between channels — with the overall brightness normalised away. Multiplying by
the quantized tone puts brightness back at one of the allowed levels. A warm
material still dithers warm.

The **Amount** slider then blends between smooth shading and full dither, so it
can sit anywhere between "subtle tonal breakup" and "full 1-bit graphic".

---

## 5. Animated dither: threshold motion, not pattern motion

Your PRD is specific that animated dither ≠ animated texture. Animated texture
*moves a pattern*. Animated dither *moves the thresholding system*. We implement
two genuinely different behaviours:

**Matrix crawl** (when a direction is chosen). We offset the coordinate used to
look up the threshold, so each pixel samples a different cell of the map over
time. The dither structure travels across the frame while the underlying tone
stays put.

**Threshold-bias sweep** (when direction is "static"). There's nowhere to travel,
so instead we oscillate the *bias* — the whole threshold rises and falls. Every
pixel is simultaneously getting easier or harder to light up, so tone opens and
closes in place, like an aperture. Verification frames show this clearly: frame
0 is sparse white dots on black, frame 11 is an open checkerboard.

**Sync to Draw** replaces the oscillation with reveal progress: the threshold
starts high and opens as the stroke draws in, so the dither "develops" with the
drawing.

---

## 6. Gates

- **Geometry never rebuilds.** Every dither control is a uniform write. Verified
  by counting geometry builds across 20 style changes per mode (texture and
  dither combined): rod 3→3, extrude 5→5, solid 6→6, inflate 7→7.
- **All four modes respond.** Every mode × threshold-map combination measured
  well above the perceptual floor (22.8 to 119.8 mean change versus the
  dither-off baseline).
- **The five types are distinct from each other.** A new pairwise check
  compares each variant against every other variant within a mode, not just
  against "off" — this is the check that would have caught the old "all the
  material presets look the same" problem. Closest pair is Bayer 4×4 vs 8×8
  (same family, different resolution), still clearly distinct.
- **Animation moves.** All three animated cells show real frame-to-frame change.
- **Taxonomy holds.** A dither preset writes only `dither*` state — asserted,
  and asserted through the *real* preset-selection function the UI calls, not a
  parallel test path.
- **Exports unaffected.** All four modes still produce healthy GLB files.

---

## 7. What this phase does not do

- No dither baking into exported GLB. Dither is a screen/preview effect;
  exported geometry is untouched.
- No palette quantization to specific colours (the current system quantizes
  brightness and preserves hue). A true palette mode belongs with the layer
  stack or fusion work.
- No custom threshold map upload. Custom Dither is reserved.
- ASCII remains unimplemented — that's the next phase, and it is a third
  distinct machine: glyphs, not thresholds and not patterns.
