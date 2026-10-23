# Explainer 03 — ASCII (and animated ASCII)

What got built in `POST_MVP_ASCII_AND_ANIMATED_ASCII_PHASE_1`, how characters
get drawn without a font, and the two bugs that only rendered frames could have
caught.

Files: `lib/ascii-shader.ts` (new), `scripts/gen/glyphs.py` (new),
`lib/style-shader.ts`, `lib/style-system.ts`, `components/viewport-3d.tsx`,
`components/style-panel-scaffold.tsx`, `app/page.tsx`.

Read [01 — Texture](01-procedural-texture.md) and [02 — Dither](02-dither.md)
first; this is the third system and the contrast with them is the point.

---

## 1. The three systems, side by side

You now have all three of the visual primitives your PRD separates, and it's
worth seeing them together because the difference is structural, not cosmetic:

| | operates on | produces | injects |
|---|---|---|---|
| **Texture** | the surface's material properties | a pattern | before + during lighting |
| **Dither** | the final shaded tone | graphic marks from thresholds | after lighting |
| **ASCII** | the final shaded tone | character glyphs | after dither |

Texture changes what the object *is made of*. Dither changes how its tone is
*printed*. ASCII changes what it's *drawn with*. Three different questions, so
three different machines — which is exactly the distinction your PRD insists on.

---

## 2. Drawing letters with no font

A shader has no text. There is no `drawText()`, no font file, no string type.
Everything is arithmetic on numbers. So how do you draw an `@`?

**You store the character as a picture made of bits.**

Take a 5×5 grid. Each of the 25 squares is either filled or empty — one bit. An
`@` might be:

```
. # # # .
#   . . #
#   # . #
#   . . .
. # # # .
```

Number the squares 0 to 24 (left to right, top to bottom) and set a bit for each
filled square. Now the whole character is a single integer. To draw it, each
pixel works out which of the 25 squares it falls in, then asks "is that bit
set?" If yes, it's part of the letter.

That's the entire technique. No font, no texture, no memory beyond one number
per character.

### Why the glyphs are generated, not typed

Those integers are unreadable — `14997294` tells you nothing about what
character it is or whether you got it right. So `scripts/gen/glyphs.py` defines
each glyph as ASCII art:

```python
g("at", "01110", "10011", "10101", "10010", "01110")
```

and computes the integer. The bitmaps stay reviewable as pictures, adding a
character means drawing one, and a typo is visible instead of silent.

**The generator validates itself.** The Codrops article that describes this
technique publishes `15255086` as the encoding for its `o` glyph. Our generator
independently produces exactly `15255086` for our `0`. Matching a published
constant confirms our bit convention is right — much stronger evidence than
squinting at output.

### The precision trap

A fully-filled 5×5 block sets all 25 bits: 33,554,431. GLSL's highest-precision
floats represent integers exactly only up to 16,777,216 (2²⁴). **A full block
would be silently corrupted** — no error, just a wrong character, and only for
the densest glyphs.

So every glyph is stored as two numbers: the low 13 bits and the high 12 bits,
each comfortably inside the safe range. The bit test picks whichever half holds
the bit it needs. This is the kind of bug that would have looked like "the
darkest characters render oddly sometimes."

---

## 3. Choosing which character

Each cell needs a character. The rule: **brighter cell, denser character.**

Sort the characters by how much ink they use — space, then `.`, `:`, `-`, `=`,
`+`, `*`, `#`, `%`, `@`. That's a ramp. Measure the cell's brightness, scale it
by the ramp length, round, and you have your index.

**One inversion worth flagging.** Traditional ASCII art maps *dark* to *dense*,
because it's black characters on white paper — more ink means darker. Free
Stroke is the opposite: glyph pixels are the *lit* part of a dark object, so more
glyph means *brighter*. We map bright → dense. Copying the traditional
convention would have made highlights vanish and shadows glow — right technique,
inverted result.

### An honest limitation

Proper ASCII effects average brightness over the whole cell, so every pixel in
that cell agrees on the character. That requires reading neighbouring pixels,
which needs a **post-process pass** — render the scene to a texture, then run a
second shader over it.

We're injecting into the *material* shader, where a pixel can only see itself.
So the character is chosen from per-pixel brightness. In practice this is fine:
the shaded stroke varies smoothly and the ramp has only 3–10 steps, so nearly
every cell resolves to one character. A cell sitting exactly on a brightness
boundary can show two half-characters. True cell-averaging is a post-process
phase, noted in the panel's future controls rather than quietly pretended.

---

## 4. The bug that mattered (again): dark subjects

The first implementation was correct and produced **almost nothing** — a dark
stroke with a few specks.

The cause is the same family as the texture bug, and it will keep recurring:
**Free Stroke's subject is near-black.** A shaded ink stroke has luminance
around 0.05–0.25. Feeding that into a ramp expecting 0–1 means every cell lands
in the bottom two entries: space and `.`. The form renders as empty.

Two fixes:

**Exposure.** Divide luminance by a reference value representing "bright *for
this subject*". The Density control is that reference — lower it and dimmer
pixels start counting as bright, selecting denser characters. This rescales the
subject's actual range onto the full ramp.

**Contrast, gently.** My first attempt over-corrected: with a hard contrast
expansion every cell saturated to the *densest* glyph, and the stroke became a
flat mesh — technically ASCII, visually useless. The variation between
characters *is* the effect, so contrast must expand enough to use the ramp and
not so much that it collapses to one end. The multiplier came down from ~3.0 to
~1.1.

**Separation.** Lit glyph pixels were `surface × 1.35` — but 1.35 times
near-black is still near-black, so characters were invisible against their own
background. Now, as in dither, the colour is divided by its own luminance to
recover the hue, then brightness is set explicitly: bright for glyph pixels,
near-black for the rest. Material presets stay distinguishable rather than all
collapsing to white.

Three iterations, each one only visible in captured frames. Reading the code
would have told you all three versions were "working".

---

## 5. Animated ASCII: five things that actually differ

Your PRD warns against presets that are one effect at five speeds. Each
behaviour here moves a genuinely different part of the system:

- **Scroll** — offsets the whole grid, so characters travel across the form.
- **Rain** — offsets each *column* by a different amount, using a hash of the
  column index as its speed. Columns fall independently, which is the
  falling-code look; a uniform downward scroll would just be Scroll rotated.
- **Cycle** — leaves the grid still and advances the *character index* over
  time, so glyphs change in place, walking up the ramp.
- **Flicker** — hashes cell position against a time tick; when the hash clears a
  threshold that cell jumps to a random glyph. Only a fraction change per tick,
  so it reads as an unstable terminal rather than static.
- **Reveal density** — character density follows draw-in progress, so the text
  thickens as the stroke is written.

Verified as distinct by frame measurement: scroll, rain, cycle and flicker all
show real frame-to-frame movement, at clearly different magnitudes.

---

## 6. Gates

- **Geometry never rebuilds** — 30 style changes per mode (texture + dither +
  ASCII combined), build count flat on all four.
- **All four modes respond** — every mode × charset well above the perceptual
  floor (17.1 to 100.4).
- **Charsets are distinct from each other** — pairwise check passes on every
  mode; closest pair is classic vs custom, still clearly separated.
- **Animations move** — all four measured cells.
- **Taxonomy holds** — an ASCII preset writes only `ascii*` state, asserted
  through the real preset-selection path.
- **All three systems stack** — texture + dither + ASCII simultaneously, with no
  geometry rebuild, no console errors, and export still working. Evidence in
  `docs/verification/stack-v1/` as a four-step series.
- **Exports unaffected** on all four modes.

---

## 7. What this phase does not do

- No custom character strings yet (Custom ASCII is reserved).
- No true cell-average sampling — needs a post-process pass.
- No colour modes or background fill.
- No ASCII baking into exported GLB.
- Geometry, geometry animation, and export geometry untouched.

**One observation for the layer-stack phase:** with all three systems on at
default strengths the result is legible but dark. Tasteful stacking defaults —
one dominant graphic layer with the others supporting — are explicitly that
phase's job, and the stack series gives it a baseline to work from.
