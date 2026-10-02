# Research — Dither phase

Sources consulted while building `POST_MVP_DITHER_AND_ANIMATED_DITHER_PHASE_1`.

---

## 1. "Ordered dithering" — Wikipedia

**Link:** https://en.wikipedia.org/wiki/Ordered_dithering

**What it is.** The reference description of the ordered-dithering algorithm and
the Bayer threshold matrix.

**What it does.** Gives two things we needed exactly:

1. **The recursive Bayer matrix formula.** Starting from the 2×2 matrix
   `[[0,2],[3,1]]/4`, each larger matrix is built by taking four copies of the
   previous one and adding offsets 0, 2, 3, 1 to the top-left, top-right,
   bottom-left and bottom-right quadrants respectively (then rescaling). Each
   step quadruples the resolution of the threshold ordering.
2. **The application formula**, including a detail that is easy to miss:
   `c' = nearest_palette_colour(c + r × (M(x,y) − 1/2))`. The **− 1/2** matters —
   the article notes explicitly that without it "this lack of normalization
   slightly increases the average brightness of the image", because an
   all-positive threshold offset only ever pushes pixels one way.

**What we used it for.** Our `fsBayer` implements that recurrence directly. We
evaluate it arithmetically per pixel rather than storing a lookup table: reading
one bit of x and one bit of y per refinement level, coarsest first, and
accumulating base-4 digits produces exactly the same matrix. Two levels gives
4×4, three gives 8×8, from one function. The `− 0.5` from point 2 is in our
shader as `(fsThr - 0.5)`, which is why our dither preserves the stroke's
average brightness instead of washing it out.

---

## 2. "The Art of Dithering and Retro Shading for the Web" — Maxime Heckel

**Link:** https://blog.maximeheckel.com/posts/the-art-of-dithering-and-retro-shading-web/

**What it is.** A detailed practical walkthrough of implementing dithering in
WebGL/three.js specifically (not generic image processing).

**What it does.** Covers the parts the Wikipedia article doesn't:

- **Indexing the matrix in screen space** using pixel coordinates and modulo, so
  the threshold tile repeats across the viewport.
- **Luminance via Rec. 709 weights** — `dot(color, vec3(0.2126, 0.7152, 0.0722))`.
  These weights reflect how much each channel contributes to *perceived*
  brightness: the eye is far more sensitive to green than to blue, so a naive
  average of R, G and B would misjudge which pixels are "dark".
- **Combining the threshold with quantization** — add the threshold to the
  colour first, then snap to the nearest level.
- The observation that larger matrices give finer dithering, and that matrix
  size is the better control than separate pixelation.

**What we used it for.** The luma weights, the screen-space tiling approach, and
the threshold-then-quantize ordering are all taken from here. Our cell-size
control is effectively the "scale the coordinate before tiling" idea, which lets
the user get chunky dither from a small matrix without changing matrices.

---

## 3. Interleaved Gradient Noise — Jorge Jimenez (via common shader practice)

**What it is.** A cheap per-pixel noise function widely used in real-time
rendering as a substitute for a true blue-noise texture. Formula:
`fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))))`.

**What it does.** Produces a threshold pattern whose values are well distributed
in *space*, not just in value — neighbouring pixels tend to get well-separated
thresholds. That's the property that makes blue noise look pleasant. Plain white
noise (an ordinary hash) clumps, which reads as dirty TV static.

**What we used it for.** Our `blueNoise` dither type. **Honest naming note:** this
is not true blue noise — real blue noise requires a precomputed void-and-cluster
texture. IGN is the standard cheap approximation. The UI therefore labels it
"Noise threshold (IGN)" rather than claiming blue noise, and the preset that
uses it is called "Soft Dither".

---

## 4. Martins Upitis — "GLSL 8x8 Bayer matrix dithering"

**Link:** http://devlog-martinsh.blogspot.com/2011/03/glsl-8x8-bayer-matrix-dithering.html

**What it is.** An early, much-copied GLSL implementation of 8×8 Bayer
dithering, using a hardcoded lookup of the 64 matrix values.

**What we used it for.** Cross-checking our arithmetic `fsBayer` against a known
table-driven implementation — the quadrant offsets we use (0, 2, 3, 1) produce
the same ordering. We chose the arithmetic version because one function then
serves both 4×4 and 8×8 with a parameter, instead of shipping two lookup tables.

---

## No visuals saved from these sources

All four are text/code references. The visual record for this phase is our own
`docs/verification/dither-v1/` — 24 stills and 72 motion frames of the technique
applied to Free Stroke's actual geometry, which is more useful than a generic
dithered photograph.
