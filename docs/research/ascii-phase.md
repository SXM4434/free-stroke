# Research — ASCII phase

Sources consulted while building `POST_MVP_ASCII_AND_ANIMATED_ASCII_PHASE_1`.

---

## 1. "Creating an ASCII Shader Using OGL" — Codrops

**Link:** https://tympanus.net/codrops/2024/11/13/creating-an-ascii-shader-using-ogl/

**What it is.** A walkthrough of building an ASCII effect as a WebGL shader.

**What it does.** Supplies the key idea we adopted: **encode each character as
bits in an integer instead of using a font or a texture atlas.** A 5×5 character
is 25 bits; bit index `x + 5*y` says whether that pixel of the glyph is filled.
The article's `character()` function converts a position inside a cell into a
bit index and tests it. It also shows the grid setup — divide `gl_FragCoord` by
the cell size and floor it — and a brightness-to-character ladder.

**What we used it for.** The entire glyph-storage strategy. Shaders have no text
rendering, so this sidesteps needing a font atlas, an extra texture binding, and
UV coordinates our geometry doesn't have.

**A useful validation.** The article lists `15255086` as the encoding for its
`o`-like glyph. Our independent generator (`scripts/gen/glyphs.py`) produces
exactly `15255086` for our `0` glyph, which confirms our bit convention
(`x + 5*y`, y increasing downward) matches the established one. That check is
worth more than eyeballing the tables.

**Where we diverged.** The article hardcodes its glyph integers inline. We
generate ours from readable ASCII-art strings in Python, so the bitmaps are
reviewable as pictures rather than magic numbers, and adding a character means
drawing it rather than computing a constant.

---

## 2. "Efecto: Building Real-Time ASCII and Dithering Effects with WebGL Shaders" — Codrops

**Link:** https://tympanus.net/codrops/2026/01/04/efecto-building-real-time-ascii-and-dithering-effects-with-webgl-shaders/

**What it is.** A more recent article covering both effects together, from the
authors of a tool that ships them.

**What it does.** Three things we took:

1. Confirms the procedural-glyph approach over atlases, with the memorable
   framing: *"shaders don't have fonts. You can't just call `drawText()`.
   Everything has to be math."*
2. Notes that **each ASCII cell is independent**, so unlike some effects it
   parallelises perfectly on the GPU — no neighbour lookups required.
3. The brightness convention: *"Darker regions get denser characters, lighter
   regions get sparser ones."*

**Where we deliberately inverted their convention.** That density mapping
assumes dark characters printed on a light page. Free Stroke renders a dark ink
object where the glyph pixels are the *lit* part of the surface, so denser glyph
= more lit pixels = brighter. We therefore map **bright → dense**, which is the
same perceptual logic applied to an inverted medium. Getting this backwards
would have made highlights vanish and shadows glow.

---

## 3. Rec. 709 luma coefficients

**What it is.** The standard weights for converting RGB to perceived brightness:
`0.2126 R + 0.7152 G + 0.0722 B`.

**What we used it for.** Choosing a character from a pixel's brightness requires
knowing what "brightness" means perceptually. A plain average of R, G and B
would badly misjudge — the eye is roughly ten times more sensitive to green than
to blue. Both the dither and ASCII systems use these weights, so they agree on
what "dark" means.

---

## The finding that isn't in any source

Neither article addresses the case that actually broke our first implementation:
**a near-black subject.** Both assume a full-range image where luminance spans 0
to 1. Free Stroke's ink occupies roughly the bottom 15% of that range, so
feeding raw luminance into a character ramp selected only the two sparsest
glyphs, and the entire form rendered as empty space.

The fix is an exposure step: divide luminance by a reference value that
represents "bright" *for this subject* before mapping to the ramp. The Density
control is that reference. This is documented in
`docs/explainers/03-ascii.md` §4, since it is the kind of thing that will recur
every time a screen-space effect meets dark ink.

---

## No visuals saved from these sources

Both are text/code articles. Our visual record is
`docs/verification/ascii-v1/` (20 stills, 96 motion frames) plus
`docs/verification/stack-v1/` (the four-step layering series).
