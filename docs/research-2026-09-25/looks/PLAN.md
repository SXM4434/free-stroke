# Looks plan, #5: the Material animations and the fusions

**Status: PARTIAL.** The lane hit its 150k context line and stopped here. Every spec below is written; the
Material rows and the dither/ASCII rows are grounded in code I read. The texture, glitch-impulse and
stack code paths in `lib/style-fusion.ts` I did not open, so those rows name the file and not the line.

These are specs to show him, not decisions. Nothing here has been built, filmed or judged by his eye.

## What I saw in the captures

- `night-m/after-toggle/strip_shineSweep_independent.png`: six frames of one mouse S. A white band sits on
  the top-right hump, then the bottom-left hook. It moves, but ACROSS the bounding box on a fixed diagonal,
  not along the line. On a word it would cross letters in reading order and never follow a stroke.
- `night-m/after-toggle/strip_gelShimmer_independent.png`: the same S goes slate blue, darker, then pale
  grey-white for three frames. The whole stroke changes at once. No position on the stroke differs from any
  other. That is the "tint, not motion" complaint, exactly.
- `night-s/film-fusion2/Signal-Ink.png`: cyan glass bars under a black checker whose squares are about the
  size of the stroke's width. At t=9.29 and t=14.85 the checker covers the X so fully that it reads as a
  racing flag, not a letter.
- `night-s/fullres/glitchRibbon.png`: five full-res X's, one flat cyan-black checker, identical frame to
  frame. The glass body underneath is gone.
- `night-s/film-fusion2/Pixel-Clay.png`: cream and black checker with blotchy grain. Nothing says clay.
- `night-s/film-fusion/Still-Wet.png`: near-black extruded slabs. One frame at p=1 goes pale blue for the
  whole mark. No wet-to-dry anywhere along a stroke.
- `night-s/film-fusion/Turn-Table.png`: horizontal barcode streaks. At t=4.57 the + stem stands alone as a
  tall box; at t=6.37 a pen-down dot hangs in the air as a small capsule; at t=8.25 a second one.
- `night-s/film-f14/Authentic-Draw.png`, for contrast: thin round tubes, each growing from its start.

## Why every fusion draw reads as floating slabs

**The film forced Solid and the F14 film did not.** `docs/verification/night-s/film-presets.mjs:46` calls
`__styleHarness.setMode("solid")` before every fusion pick; the F14 branch (:36-44) never sets a mode. So the
fusion sheets are Solid at its default depth against a 3/4 camera, and the F14 sheets are the page default.
GRADES.md says both were Solid; the probe says otherwise. Each fusion's own `bestModes` is rod, inflate or
extrude (`lib/style-system.ts:3883`, `:3913`, `:3940`, `:3961` says solid for Pixel Clay only).

What makes Solid read as slabs, from the frames: a thick extrusion with a flat front face where the reveal
cuts it (Solid reveals by rebuilding a clipped copy, `lib/pen-reveal.ts:34-35`), no contact with a ground,
and every pen-down dot built as its own short capsule. Two separate fixes, and they are not the same size:
1. **Film each fusion in its own best mode.** One line in the probe. It changes what the grade measures,
   not what ships. Do this first, or every fusion grade is graded on the wrong body.
2. **Round the reveal front in Solid.** Clip the stroke at the playhead and cap it with the same half-disc
   the stroke's own ends use, so the growing end reads as a nib and not a saw cut. `filterStrokesByProgress`
   in `lib/pen-reveal.ts` is where the clip happens. Solid's rebuild is about 21 ms a tick (STATUS), so this
   adds no new per-frame cost; it changes the clipped polyline, not the mechanism.

## Why five fusions bury the letters under a checker

Read in `lib/dither-shader.ts:223-269`. Four causes stack:
1. **Bayer at 2 levels on a mid-tone is a checkerboard by construction.** A 2x2 Bayer tile thresholds at
   0, 0.5, 0.25, 0.75; a tone near 0.5 lights exactly the diagonal pair, which is a checker. Signal Ink,
   Pixel Clay and Glitch Ribbon all run `ditherLevels: 2` with `bayer8` or `bayer4`
   (`lib/style-system.ts:3893`, `:3968`, `:4052`).
2. **The cell is huge for the stroke.** `ditherScale: 5` screen-locked means each threshold pixel is 5 screen
   px (`dither-shader.ts:233-234`). A stroke about 40 px wide carries eight cells across. The letter's
   silhouette has nothing left inside it but the pattern.
3. **The ink end goes to 4.5 % of the body colour** (`dither-shader.ts:266`, `fsTint * 0.045`). Half the
   cells are near black, whatever the body is. That is why glass, clay and signal all look the same.
4. **Screen-locked, so it swims.** A screen-locked matrix under a turning or growing mark slides across the
   form. Lucas Pope names this "a wiggling mess of pixels" and spent months pinning his to the view.

Code Bloom and Scanline Balloon read best (GRADES 14 and 24) because Code Bloom uses blue noise at scale 2
with 3 levels, and Scanline Balloon uses no dither at all. That is the in-repo control: the same letters,
without a 2-level Bayer, stay legible.

## The shared change most looks need: an along-stroke coordinate on the fragment

Four of five Material animations tint the whole stroke because they are CPU-side material parameters.
`evaluateMaterialAnimation` in `lib/style-system.ts:5392-5560` writes one `MaterialParams` per frame, so
every fragment gets the same value. Only Shine Sweep reaches the shader, and its band runs along a fixed
object-space XY direction (`lib/texture-shader.ts:229-235`, `dot(n, dir)`), so it crosses the drawing
instead of following the line.

Motion along a stroke needs every vertex to know how far along its stroke it sits. The repo already stamps a
per-vertex attribute by nearest ink: `aFsLetter`, written by `restampLetters` and kept in step with refills
by `ensureLetterStamp` (`components/viewport-3d.tsx:3072`, `:4436-4447`). The same nearest-ink search returns
the arc position of the nearest centreline point for free. Stamp it as a second attribute, `aFsArc`
(0..1 within the stroke), plus `aFsArcAbs` (seconds on the pen clock, from `ProcessedStroke.points[].t`),
and pass both to the fragment through the existing onBeforeCompile composer (`lib/style-shader.ts:180`).
Rod already has it for free in TubeGeometry's `uv.x`; Inflate DESK has it in the builder's uv V
(`lib/pen-reveal.ts:26-28`); Solid and the Inflate implicit surface need the stamp.

Two things it must also do, from the explainers the repo already paid for: be dropped on refill with the
other stale attributes (`lib/geometry-engines.ts:5951`, `IMPLICIT_OWN_ATTRS`), and be re-stamped from
`ensureLetterStamp`'s check, or it repeats explainer 24's "vertex buffer is not big enough" failure.

**This one attribute unlocks rows 1, 2, 3, 4, 5, 7 and 10 below.** It is the cost that the ranking amortises.

## The looks

Each row: what it should do, the shader approach, and where it lives now. References are at the bottom, with
what each was used for.

### 1. Shine Sweep (Material, graded 22)
**Spec.** One soft highlight rides each stroke from its start to its end, at a steady pace, then the next
stroke's. A letter shows the light entering at the pen-down end and leaving at the lift, like a finger
running along a bent wire. The band is about a third of a letter's height long, and nowhere does the whole
stroke brighten at once.
**Shader.** Keep the two-lobe band and the mirror pull (`lib/texture-shader.ts:254-300`). Replace the
distance term `along = dot(n, dir)` (`:233`) with `along = aFsArc`, and advance `uFsSweepPos` on the style
clock. For a word, run the band on `aFsArcAbs` so it follows pen order. CPU side unchanged
(`lib/style-system.ts:5403-5408`).

### 2. Gel Shimmer (Material, graded 10)
**Spec.** A slow wave of inner glow travels along the stroke, as if a bubble of light is being pushed
through gel. Two or three soft bright zones per stroke, drifting toward the pen's end at about one stroke
length every three seconds. The rest of the stroke keeps its normal gel shading, so the letter's shape
stays readable at every frame.
**Shader.** Move the emissive breath out of the CPU case (`lib/style-system.ts:5414-5441`) into a fragment
term: `glow = pow(0.5 + 0.5 * sin(6.28 * (aFsArc * 2.5 - t * 0.35)), 3.0)`, multiplied by the sheen colour
and a facing term, so the glow sits in the thick middle of the tube. Hold the CPU sheen at a constant level
instead of oscillating it.

### 3. Roughness Pulse / wet ink behind the pen (Material, graded 12; also Still Wet, graded 14)
**Spec.** The ink is wet and glossy right behind the pen and dries to matte over about 1.5 s. While a stroke
draws, a glossy dark tail follows the nib; after the pen leaves, the gloss retreats from the start toward
the end. At rest the whole mark is dry, and a replay wets it again. Still Wet is the same effect with the
darker body, so the two share one mechanism.
**Shader.** Per fragment: `age = uFsPlayhead - aFsArcAbs`; `wet = 1 - smoothstep(0.0, 1.5, age)`. Inside
the lights block, mix roughness toward 0.05 and colour toward 0.55x by `wet`, the same levers the CPU case
uses now (`lib/style-system.ts:5444-5470`, `scaleHex`) but per fragment. Still Wet's preset is at
`lib/style-fusion.ts:1212`; its completion glow is the one-frame pale-blue flash in the sheet, and it should
go.

### 4. Completion Flash (Material, graded 8)
**Spec.** When a stroke finishes, a short bright pulse runs back along it from the lift to the start in
about 250 ms, then fades. When the last stroke finishes, the pulse runs the word once. It re-arms on every
play from 0.
**Shader.** Keep the envelope (`lib/style-system.ts:5472-5511`) but feed it to the fragment as a travelling
front: `front = 1 - since / 0.25`, glow where `abs(aFsArc - front) < 0.08`. The re-arm is the CPU fix GRADES
already names; the travelling front is the look.

### 5. Signal Flicker (Material, graded 15)
**Spec.** Faulty neon: most of the stroke holds a steady glow while short segments drop out and come back,
and the dropouts sit at different places on each stroke. A dead segment is never longer than a fifth of a
stroke, so a letter never vanishes.
**Shader.** Hash `floor(aFsArc * 8.0)` with a time bucket `floor(t * 6.0)` to decide which segments are out,
and a 5 % chance per bucket of a whole-stroke blink for the event. Replaces the whole-mark `drop` multiplier
(`lib/style-system.ts:5514-5530`).

### 6. Signal Ink, Pixel Clay, Glitch Ribbon: the checker (fusion, graded 10, 12, 12)
**Spec.** The pattern lives in the shading, not on top of the letter. Lit faces stay mostly clean, the
pattern gathers only in the shadowed flank and the far edge, and the silhouette keeps a solid rim one or two
pixels wide. From across a room the word reads first and the texture second.
**Shader.** In `lib/dither-shader.ts:223-269`:
- 3 levels, not 2, and blue noise (IGN is already type 3, `:162`) for Signal Ink and Pixel Clay; keep Bayer
  only where a regular grid is the idea (Glitch Ribbon).
- Scale 2 instead of 4 to 5.
- Ink end at 0.35 to 0.45 of the body tint instead of 0.045 (`:266`), so a dark cell is a shadow of the
  body, not black.
- Mask the pattern by `1 - facing` so it thins to nothing on the lit front face, and add a solid rim from
  the same `fsNdV` the form term already reads (`:245`).
- Object-lock instead of screen-lock (`:233-235` already has the object branch), so the pattern rides the
  turn and stops swimming.
Presets at `lib/style-system.ts:3877-3903`, `:3953-3986`, `:4038`.

### 7. Glitch Ribbon: the break as the event (fusion, graded 12)
**Spec.** Most of the time the ribbon is clean signal glass. Every 2 to 3 s, one band of the word tears:
a horizontal slice shifts sideways by a few pixels, its red and blue split apart, and it snaps back within
120 ms. The tear lands in a different place each time and never covers more than a third of the word's
height.
**Shader.** A post pass or a fragment term on screen y: `slice = step(0.97, hash(floor(gl_FragCoord.y/12),
floor(t*8)))`, offset x by `slice * 6px`, and sample R and B from ±2 px. Gate it on the existing impulse
drive (glitch impulse in `lib/style-fusion.ts`, not opened this lane). Drop the always-on checker to the
row 6 settings so the break has a clean body to break.

### 8. ASCII Rubber and Code Bloom (fusion, graded 11 and 14)
**Spec.** The characters should read as characters and follow the form. Glyphs at 16 to 20 px cells, picked
by shape along edges (`/`, `|`, `_`) so the letter's outline is drawn in characters; plain dots in the
flat interior. The shine rides the glyph scroll as a band crossing a letter, never a whole-letter swap to
black and white.
**Shader.** `lib/ascii-shader.ts` (522 lines, only its size read this lane). Cell size 13 to 18 in the
presets (`lib/style-system.ts:3925`, `:3997`). Shape-vector pick is Alex Harri's method; a cheaper cut is to
choose between four edge glyphs by the screen-space normal direction and use the luminance ramp only
inside. The whole-letter swap in ASCII Rubber is the stack or the fusion link flipping a letter's
state; trace it in `lib/style-fusion.ts` before specifying the fix.

### 9. Turn Table: brushed metal (fusion, graded 15)
**Spec.** Brushed steel whose brushing runs ALONG the stroke, so the long highlight stretches down each
stem and bends round each curve as the word turns. No horizontal barcode across the letters. The X never
washes to a ghost; its darkest face stays at least mid-grey.
**Shader.** three.js `MeshPhysicalMaterial.anisotropy` with `anisotropyRotation` taken from the stroke
tangent. Rod has a UV tangent already; Solid would need the tangent stamped beside `aFsArc`. Drop the
brushed texture intensity from 0.55 as GRADES says. Preset at `lib/style-fusion.ts:1137`.

### 10. Pixel Clay as clay (fusion, graded 12)
**Spec.** Matte warm clay, a slight oily sheen on the lit side, soft thumbprint dents that sit still on the
surface, and a visible press where the stroke starts. Colour a warm terracotta or grey-green, never cream on
black. If the pixel idea stays, it is a coarse pixel edge on the silhouette only.
**Shader.** Wrap diffuse for the soft falloff, a low-frequency noise normal in object space for the dents,
roughness about 0.7 with a 0.2 sheen. Drop dither for this look, or use it at row 6 settings on the
silhouette only. Preset `lib/style-system.ts:3953-3986`.

### 11. Scanline Balloon (fusion, graded 24)
**Spec.** Thin, low-contrast scanlines that follow the stroke's direction on a Rod and stay horizontal on
the balloon, breathing on the 5 s wave it already has. Lines at 1 to 1.5 px dark, 3 px pitch, 25 % darker
than the body, so it reads as a lit screen and not an awning.
**Shader.** Texture mode "scanlines" at `lib/style-system.ts:3946-3950`; intensity 0.75 to about 0.3, and
contrast down. Lottes-style soft scanline profile instead of a hard stripe.

### 12. Whole Cloth, Formation (fusion, graded 10 and 15)
**Spec.** Whole Cloth: three relationships, not nine, per GRADES. Formation: the dot matrix travels
visibly, one dot pitch every 0.3 s, along the stroke.
**Shader.** Whole Cloth is `fuseEverything` (`lib/style-fusion.ts:1181`); Formation at `:1171`. Formation's
travel uses `aFsArc` once it exists.

### 13. Iridescent, thin-film (no look uses it well yet)
**Spec.** An oil-slick band of colour that slides along the stroke as the word turns. Strongest on a dark
glossy body, faint on light ones.
**Shader.** three.js `iridescence: 1`, `iridescenceIOR: 1.5`, thickness range 200 to 600 nm, with a
thickness map driven by `aFsArc` so the colour bands follow the stroke instead of the view alone. The
fusion channel exists (`iridescence`, `lib/style-fusion.ts:486`).

## Ranked by visible impact per effort

Effort counts `aFsArc` once, against row 1; after that rows 2 to 5 are shader edits.

| rank | look | why this rank |
|---|---|---|
| 1 | Dither fix, row 6 (Signal Ink, Pixel Clay, Glitch Ribbon) | Five numbers and one mask in one shader. Three looks go from "racing flag" to letters. No new attribute. |
| 2 | Film fusions in their best mode | One probe line. Every fusion grade stops being measured on the wrong body. |
| 3 | Shine Sweep along the stroke, row 1 | Pays for `aFsArc`. The best-graded Material becomes the one that actually follows the line. |
| 4 | Wet ink behind the pen, row 3 (Roughness Pulse and Still Wet) | Same attribute. It is the only look that makes the draw-in itself read as a pen, which is ledger 1.1. |
| 5 | Gel Shimmer along the stroke, row 2 | Same attribute, one fragment term. From worst-graded to moving. |
| 6 | Round the Solid reveal front | Edits the clipped polyline in one function; kills the saw-cut and the floating dots. |
| 7 | Completion Flash as a travelling front, row 4 | Re-arm plus a small fragment term. |
| 8 | Scanline Balloon thinner, row 11 | Two numbers. Already the most legible; small gain. |
| 9 | Signal Flicker segments, row 5 | Same attribute, small term. |
| 10 | Glitch Ribbon tear, row 7 | New term plus tracing the impulse drive. |
| 11 | Turn Table anisotropy, row 9 | Needs a tangent; Rod only for cheap. |
| 12 | ASCII shape-aware, row 8 | The largest shader change on the list. |
| 13 | Pixel Clay as clay, row 10; iridescence, row 13; Whole Cloth, Formation | Look redesigns more than fixes. |

## References, and what each was used for

- Lucas Pope, Obra Dinn devlog, November 2017: https://dukope.com/devlogs/obra-dinn/tig-32/ . Used for row 6:
  the swimming problem under motion, his 8x8 Bayer for smooth shades against 128x128 blue noise for the
  rest, the sphere mapping that pins the pattern for camera rotation, and his note that a wireframe line or a
  sharp lighting change hides a boundary, which is the solid rim idea.
- Surma, "Ditherpunk": https://surma.dev/things/ditherpunk/ . Used for row 6: Bayer "very structured and
  will look quite repetitive, especially at lower levels"; blue noise has no obvious pattern.
- Alex Harri, "ASCII characters are not pixels": https://alexharri.com/blog/ascii-rendering . Used for
  row 8: luminance-only picking reads blurry; shape vectors per cell draw edges; contrast on the sampling
  vector sharpens region boundaries.
- Codrops, shape-aware ASCII in three.js (2026-09-04):
  https://tympanus.net/codrops/2026/09/04/beyond-the-luminance-ramp-a-shape-aware-ascii-renderer-in-three-js/ .
  Used for row 8: the same method on the GPU in three.js. Not opened, search summary only.
- three.js MeshPhysicalMaterial docs: https://threejs.org/docs/pages/MeshPhysicalMaterial.html . Used for rows 9
  and 13: `anisotropy`, `anisotropyRotation`, `iridescence`, `iridescenceThicknessRange`. Oil-slick numbers
  (IOR 1.5, 200 to 600 nm) from the search summary of this page; not verified against the page itself.
- Der Schmale, three.js thin-film iridescence: https://github.com/DerSchmale/threejs-thin-film-iridescence .
  Used for row 13 as a working example to read before building. Not opened.
- Jonas Johansson, clay material in Unity: https://www.jonasjohansson.dev/blog/clay-material-in-unity/ . Used
  for row 10: fingerprints and the oil catching light, vertex-noise unevenness, grey base with grain.
- NVIDIA GPU Gems ch.16, real-time SSS approximations:
  https://developer.nvidia.com/gpugems/gpugems/part-iii-materials/chapter-16-real-time-approximations-subsurface-scattering .
  Used for rows 2 and 10: wrap lighting as the cheap subsurface stand-in. Not opened, search summary only.
- Timothy Lottes CRT shader, libretro port:
  https://github.com/libretro/glsl-shaders/blob/master/crt/shaders/crt-lottes.glsl . Used for row 11: a soft
  scanline profile (hardScan) instead of a hard stripe. Not opened.
- Agate Dragon, glitch with displacement lines and RGB split:
  https://agatedragon.blog/2023/12/20/glitch-shader-effect-with-displacement-lines/ and
  https://agatedragon.blog/2023/12/24/glitch-effect-with-rgb-split/ . Used for row 7: horizontal slice offset
  per time segment, R and B offset with G fixed. Not opened.
- CSS-Tricks, how SVG line animation works: https://css-tricks.com/svg-line-animation-works/ . Used for rows 1
  to 5: dashoffset is distance along the path; the 2D version of `aFsArc`. Not opened.
- Rebelle (wet and dry paint layers): https://en.wikipedia.org/wiki/Rebelle_(software) . Used for row 3 only
  as the idea that paint has a wet layer that dries over time. Weak reference; I found no good real-time
  "ink drying behind a pen" writeup.

## Not checked

- No render was made for any spec. Every spec is untested.
- The texture shader's brushed and scanline code, `lib/ascii-shader.ts` internals, and the fusion link
  cases in `lib/style-fusion.ts` (glitch impulse, ASCII Rubber's whole-letter swap) were not read.
- Whether `restampLetters`'s nearest-ink search is cheap enough to also return arc position on the Inflate
  implicit surface (59,936 vertices on the word) was not measured.
- The five Material captures are lane M's on a mouse S, not the word; I opened two of the five strips.
- References marked "not opened" were chosen from search summaries.
