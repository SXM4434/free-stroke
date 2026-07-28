# Explainer 01 — Procedural texture (and animated texture)

What got built in `POST_MVP_TEXTURE_AND_ANIMATED_TEXTURE_PHASE_1`, how it works,
the math behind it, and why it was built this way rather than the obvious way.

Files: `lib/texture-shader.ts` (new), `lib/style-system.ts`,
`components/viewport-3d.tsx`, `components/style-panel-scaffold.tsx`,
`app/page.tsx`.

---

## 1. The problem in plain terms

You wanted a pattern living on the surface of the 3D stroke: grain, scanlines,
bands, contours, bubbles. Not a different material, not dither, not ASCII — a
*pattern*.

The obvious way to put a pattern on 3D geometry is an image file wrapped around
the model. That approach fails here, and understanding why explains the whole
design.

### Why the obvious way doesn't work: UVs

To wrap an image around a 3D model, every point on the model's surface needs to
know which pixel of the image belongs to it. That mapping is called a **UV
coordinate** — a pair of numbers between 0 and 1 saying "this point on the mesh
corresponds to *this* spot on the flat image". Think of a paper label wrapped
around a bottle: UVs are the instructions for how the flat label maps onto the
curved surface.

Free Stroke's geometry has no usable UVs. Solid is built by rasterizing your
stroke into a pixel mask, finding its outline, and extruding that outline.
Inflate is built by lofting an elliptical tube along your stroke path. Neither
process produces a sensible flat unwrapping — there is no "label shape" that
these forms were cut from. An image-based texture on them would smear, tile
incoherently, or simply not appear.

So instead of looking up a pattern from an image, we **compute** the pattern
from the 3D position of each point on the surface. No UVs required.

---

## 2. What a fragment shader is (skip if you know)

When the GPU draws your stroke, it runs a tiny program **once per pixel** that
decides that pixel's final color. That program is a *fragment shader*
("fragment" ≈ pixel). It is written in GLSL, a small C-like language.

The key mental shift: you don't draw shapes in a shader. You write a function
that answers "given a point on the surface, what color is it?" and the GPU calls
it for millions of points in parallel. That is exactly why computing a pattern
mathematically is natural here — each pixel independently works out its own
pattern value from its own position.

three.js already has a large, well-tuned fragment shader for realistic surfaces
(the one that gives you the ink's highlights and reflections). We did not
replace it. We spliced our pattern math into it.

### How the splicing works

three.js assembles its shaders out of named snippets, which appear in the shader
source as lines like `#include <map_fragment>`. Before compiling, it hands us the
whole thing as a string via a hook called `onBeforeCompile`. We find a snippet by
name and replace it with itself plus our code. That's it — it's text
substitution on the shader source, done once, before compilation.

We inject at exactly two points, and the choice of those two points is the most
important decision in this phase (section 5 explains why).

---

## 3. The math: how each pattern is generated

Everything starts with one function that turns a coordinate into a
random-looking number.

### The hash

```glsl
float fsHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
```

Read it right to left:

- `dot(p, vec2(127.1, 311.7))` collapses the 2D coordinate into a single number
  by multiplying x and y by two unrelated constants and adding them. Unrelated
  constants matter: if they shared a common factor, different coordinates would
  collide onto the same value and you'd see a visible grid.
- `sin(...)` wraps that number into the range −1 to 1, but very rapidly — a tiny
  change in input swings the output wildly.
- `* 43758.5453123` multiplies by a large ugly number, so the result lands
  somewhere unpredictable.
- `fract(...)` keeps only the fractional part (the bit after the decimal point),
  discarding the whole number. Since the value before it was enormous and swings
  fast, what remains looks like noise between 0 and 1.

This is not true randomness — it is completely deterministic, the same
coordinate always gives the same result. That determinism is what we want: the
pattern is glued to the surface and doesn't flicker frame to frame.

### Value noise: from speckle to organic

A raw hash gives you TV static — every point unrelated to its neighbors. For
organic patterns (bubbles, contours) you need smooth variation. That's **value
noise**:

1. Lay an imaginary grid over the surface.
2. Hash the four grid corners surrounding your point — four random values.
3. Blend between those four values based on where you sit inside the cell.

The blend is where the interesting detail lives:

```glsl
vec2 u = f * f * (3.0 - 2.0 * f);
```

`f` is your position inside the cell (0 to 1). If you blended linearly using `f`
directly, the pattern would show a faint square grid — because at each cell
boundary the *rate* of change jumps abruptly, and human vision is very good at
spotting that. The expression `f*f*(3-2f)` is **smoothstep**: an S-curve that
starts flat, accelerates, and ends flat. Because its slope is zero at both ends,
neighboring cells hand off to each other with no visible seam.

That one line is the difference between "noise" and "obvious grid".

### The five patterns

| Pattern | Math | Reads as |
|---|---|---|
| **Grain** | `fsHash` on a coarsely floored coordinate | Film-grain speckle |
| **Noise** | Two octaves of value noise (one broad, one fine) | Soft organic blobs |
| **Scanlines** | `sin` of the y coordinate, contrast-boosted | Thin repeating lines |
| **Bands** | `sin` of y at a much lower frequency | Broad soft stripes |
| **Contour** | Value noise sliced at evenly spaced levels | Topographic map lines |

The contour one deserves a note because it's the cleverest and it's what makes
Solid look like wood grain. Take a smooth noise field — think of it as a
landscape with hills and valleys. Multiply by 5 and take the fractional part:
this repeats 0→1 five times as you climb, so the value resets at five different
"elevations". Then `min(fr, 1.0 - fr)` measures distance to the nearest reset
point, and `smoothstep` draws a thin line wherever that distance is small. The
result is contour lines exactly like elevation lines on a hiking map — they
follow the shape of the underlying noise, so they curve and swirl organically.

### Screen space vs object space

The pattern coordinate comes from one of two sources, which is the **Lock mode**
control:

- **Object** — the raw vertex position, before any camera transform. The pattern
  is welded to the geometry, so orbiting the camera moves the pattern with the
  object, like real material.
- **Screen** — the pixel's position on screen. The pattern stays fixed to the
  viewport while the object moves through it, which reads as a graphic overlay
  printed on glass.

Both are one line of shader code; the choice is entirely aesthetic.

---

## 4. Animation: why it costs almost nothing

Animating the pattern is a single addition:

```glsl
fsCo = fsCo * uFsTexScale + fsDir * uFsTexTime;
```

We slide the coordinate we sample at. Sampling a fixed pattern at a moving
position looks identical to a moving pattern — the same trick as sliding a sheet
of paper under a stencil.

`uFsTexTime` is a uniform (a value the CPU sets, constant across all pixels for
that frame). Each frame we add a little to it, so the pattern travels. Direction
comes from a unit vector, so horizontal / vertical / diagonal are just different
vectors.

**Sync to Draw** swaps the clock: instead of accumulating elapsed time, the
value is driven by the draw-in reveal progress. The pattern then travels *with*
the stroke as it's drawn rather than running on its own schedule.

---

## 5. The bug that mattered, and what it teaches

The first implementation only darkened the surface color where the pattern was
strong. Verification measured how much each mode actually changed:

```
extrude/contour     1.94    TOO SUBTLE
extrude/scanlines   5.54    reads (barely)
```

Extrude was nearly invisible. The cause is worth internalizing because it will
recur in the dither and ASCII phases.

**Darkening near-black does nothing.** Extrude defaults to a glossy near-black
plastic. Multiply an almost-black color by 0.5 and you get... almost black. The
pattern was mathematically applied and visually absent.

More fundamentally: on a glossy dark surface, almost none of what you see is the
surface *color*. What you see is **specular reflection** — light bouncing off
the surface into your eye. Look at a black car: you don't see black, you see
reflected sky and streetlights. So a pattern that only edits color is editing
the one thing that isn't visible.

Two fixes:

1. **Bidirectional color.** Let the pattern lighten as well as darken. On dark
   ink there's room to go up but nowhere to go down.
2. **Modulate the reflection itself.** The pattern now nudges **roughness** —
   how polished the surface is. Low roughness gives a tight mirror highlight;
   high roughness spreads it into a broad sheen. Varying roughness across the
   surface makes the *highlight* carry the pattern, which is exactly what's
   visible on glossy materials. We also modulate clearcoat roughness, the
   separate glossy layer sitting on top (like lacquer over paint) that glossy
   presets use.

For this to work the injection point matters. Roughness is finalized inside the
lighting snippet, so we inject immediately after it — modifying it earlier would
get overwritten.

Result:

```
extrude/contour     1.94 → 10.74    reads
extrude/scanlines   5.54 → 18.92    reads
```

Every mode/pattern combination now passes. **This is the case for the
frames-verified rule.** The code was correct both times. Only rendered pixels
revealed that one version was invisible.

---

## 6. The gate: why nothing rebuilds

The PRD requires style changes to never rebuild geometry — otherwise dragging a
slider would re-run the mask/contour/loft pipeline and stutter.

The design guarantees it. All five patterns live in **one** shader, selected by a
numeric uniform acting as a switch. Changing pattern, scale, intensity,
contrast, speed, direction, or lock mode writes a uniform value. It does not
create a material, does not change the shader text, does not recompile, and
never touches React state that geometry depends on.

Verified by counting actual geometry builds across 10 style changes per mode:

```
rod       2 → 2      extrude   4 → 4
solid     5 → 5      inflate   6 → 6
```

Flat everywhere.

---

## 7. Keeping the systems separate

Your PRD is emphatic that texture, dither, and ASCII are different systems. This
phase holds that line:

- Texture only ever writes `texture*` state. A texture preset cannot enable
  dither or ASCII — asserted in the gate script, not just intended.
- Texture is **pattern**. Dither will be **threshold** (reducing tone to graphic
  marks). ASCII will be **glyphs**. They may look adjacent; they're different
  machines.
- The debug panel states it outright: `textureIsNotDither: YES`,
  `textureIsNotAscii: YES`.

---

## 8. What this phase does not do

- No texture baking into exported GLB files. Export geometry is untouched;
  patterns are preview-only, matching the PRD's "preview first, bake later".
- No blend modes, rotation, per-axis scale, or a second texture layer — those
  belong to the layer stack phase.
- No custom texture editor. Custom Material exists; Custom Texture is reserved.
- Geometry, geometry animation, and export logic were not modified. The only
  export-adjacent change was extracting the GLB builder into a shared function
  so the verification harness exercises the identical code the button does.
