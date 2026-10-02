# 08 — The hero beat, and the two registers

*What `/desk-doodles` is, the motion model behind it, and why the same engine
can wear two opposite looks.*

---

## 1. The problem this solves

Desk Doodles' entire pitch is one motion beat. Its own direction doc states it
plainly:

> **★ THE HERO BEAT — 2D → 3D (5–8s, the centerpiece).** The flat ink doodle
> ANTICIPATES (tenses), then **stands up off the page** into its 3D form with
> ease-in → overshoot → settle, then a slow auto-orbit that HOLDS the best ¾
> angle. This is the whole pitch — give it the most seconds, the cleanest
> framing, a beat of silence/hold.

Until now that beat lived only in `scripts/capture/motion.mjs` as constants
consumed by an offline pipeline: `capture-run.mjs` drives the real 3D scene to
one pose per output frame, grabs a PNG each time, and `compose.mjs` plays them
back into a WebM. That is the correct architecture for *producing* a film and a
hostile one for *tuning* it — every adjustment to a duration or an easing costs
a full headed capture run before you can see it.

Timing is not a thing you reason about. It is a thing you feel, adjust, and feel
again. So the beat needed a surface where the loop is a slider drag rather than
a capture run.

## 2. The model — `lib/hero-motion.ts`

The choreography is re-expressed as a **pure function of elapsed time**:

```ts
sampleHeroMotion(params, tSec) -> { phase, az, el, fill, reveal, squashX, squashY }
```

Given a time it returns the complete pose: where the camera is, how far in the
draw-in is, and what the anticipation squash is doing. Nothing is stateful, so
scrubbing backwards is as valid as playing forwards, and the same function
serves both the live preview and `cameraProgram()`, the per-frame list the
capture consumes.

Defaults are byte-equal to `motion.mjs`, so the tuner and the film start from
the identical program.

### The eight beats

| Beat | Default | Frames @30 | What it is |
|---|---|---|---|
| `draw` | 2.6s | 78 | The ink scratches itself in, dead-on. Flat 2D. |
| `breath` | 0.5s | 15 | Stillness. Cuts land on motion, never on stillness. |
| `crossfade` | 0.28s | 8 | Flat ink hands off to the 3D form, **dead-on**. |
| `tilt` | 0.7s | 21 | The page tips back; the mark is revealed *lying* on it. |
| `anticipation` | 0.36s | 11 | Compress, then hold the tension. |
| `standup` | 1.4s | 42 | Ease-in → overshoot → settle. The money move. |
| `orbit` | 3.2s | 96 | Slow drift into the ¾. |
| `hold` | 0.9s | 27 | The beat of silence. |

298 output frames, 9.93s. Everything from the crossfade to the end of the orbit
— 178 frames — is one continuous captured camera run.

### The camera arc, and why it is an *elevation* move

This is the part that took two attempts to get right, and it is worth being
precise about because the first version was wrong in a way that read fine in
the numbers.

The first build moved the camera from azimuth 26° to 34° at a fixed 12°
elevation. Every number in its manifest was truthful — the overshoot fired at
28.6°, the settle landed at 26.0°. And the move did not read at all: the frame
before the move and the frame after it were nearly the same image. Eight degrees
of azimuth is a *lean*, not a stand-up.

"Stands up off the page" is a claim about the relationship between the mark and
the surface it was lying on. To read, the start must look like *lying on a
surface* and the end must look like *standing in space*, distinguishable in a
single glance. That requires an elevation arc:

```
lie:    el 65°   — looking down at a heavily foreshortened form on the page
stand:  el 10°, az 30°  — near eye level, the standing ¾
hold:   el 10°, az 38°  — the money angle the orbit drifts to
```

The `easeInOutBack` curve then becomes *physical* rather than decorative: its
counter-dip presses the form flatter against the page (el → 70.5°) before the
launch, and its overshoot swings past vertical (el → 4.5°) before rocking back
to 10°. The curve's shape and the story are the same shape.

### The push

`fill` is a camera distance multiplier where **smaller means closer**. It
descends across the move — 1.0 lying, 0.86 standing, 0.80 held — for a reason
learned the same way: in the first build the orbit carried the word *away* from
the viewer, so the payoff frame was the smallest frame in the sequence. The
hero beat has to arrive at its most present. The held frame is now the closest
and largest frame of the whole shot.

### The curves

**`easeInOutBack(t, c1)`** — the stand-up. Slow ease-in launch, fast middle,
overshoot, settle. At the classic `c1 = 1.70158` the over/undershoot is about
±10%, the bottom of the "keep bounce subtle" band. The dial exposes `c1`
directly: at 0 the curve degenerates to a plain ease-in-out with no anticipation
and no overshoot, which is a useful thing to be able to hear the absence of.

**`driftEase(t, cut)`** — the orbit. Constant velocity for the first `cut` of
the beat, then decelerating to *zero*. The camera genuinely stopping is what
makes the hold read as a held pose rather than a pause in a pan.

**`drawEase(t, blend)`** — the draw-in. Mostly linear, because handwriting is
near-constant pen speed, with a soft touch-down and lift from the sine
remainder.

### The tilt had to become a real camera move

This page is what proved it. The offline film used to fake the tilt with a 2D
affine squash: interpolate the flat raster's bounding box onto the lying pose's
bounding box, which is a pure vertical scale. Every number was right — the
footprint at the end of the tilt matched the 3D lying pose to the pixel — and it
still did not read. A vertical scale has **no perspective in it**. There is no
near-edge-larger-than-far-edge, so nothing in the image says *receding*; the word
just reads as condensed, like a font squashed to 50%.

Driving the same elevation arc live here, at el 65°, the word genuinely reads as
lying on the ground plane, because the perspective projection gives it a near
edge larger than its far edge for free. So the capture now follows the live
model: the tilt, the anticipation and the stand-up are all captured camera
frames, and the flat→3D crossfade moved to *before* the tilt.

Measured on the composited films over the warm ground, taking the width of the
top 22% of the word versus the bottom 22%:

| | near/far width | reads as |
|---|---|---|
| 2D affine squash | 0.98 | flat — no trapezoid at all |
| captured camera, el 65° | 1.11 | a real ground-plane trapezoid |

### Why the crossfade moved to *before* the tilt

Because elevation 0 is the one pose where the two silhouettes agree. Face-on, the
3D form's outline is as close to the flat drawing as it will ever get, so that is
the cheapest possible instant to claim they are the same object. It used to
happen mid-tilt, where the flat layer was a 2D squash and the 3D was already at
el 68° — the two images at their *most* different exactly when they had to be
one. The bounding boxes at the handoff, measured:

| | last flat frame | first 3D-dominant frame |
|---|---|---|
| crossfade mid-tilt (old) | 861 × 93 @ (944, 537) | 835 × 106 @ (941, 538) |
| crossfade dead-on (now) | 835 × 196 @ (960, 538.5) | 833 × 196 @ (960, 538.5) |

Everything after that frame is then a genuine 3D camera move.

### What stays compositor-side, and why that is legitimate

Only the draw, the breath, and the **anticipation squash**. The squash is a 2D
vertical scale applied to a *3D render*, anchored at the word's bottom edge so it
presses down into the page. That is fine where the tilt was not: a squash is a
deformation of the object, which a 2D scale can honestly express. A tilt is a
change of viewpoint, which it cannot.

The consequence to know: the squash shows in the captured film and not in the
live camera preview. The page says so rather than letting you wonder why the dial
looks inert.

## 2b. The word

Two sources, switchable:

- **Traced** — `scripts/capture/logo-strokes.json`, the logo as actually drawn.
- **Any text** — laid out with `layoutWord` from `scripts/capture/letters.mjs`,
  the same single-stroke font the capture uses, so typed text lands in the same
  letterforms the film would draw rather than in a lookalike.

Font text is scaled so the laid-out word spans the traced logo's coordinate
width (1100 units). This matters more than it looks: the inflate rasteriser's
line weight is relative to *stroke coordinate space*, so without the rescale the
tube weight would drift thicker on short words and thinner on long ones. Fixing
the span fixes the ink weight.

The font is plain ESM because node runs it directly for the capture with no
build step, so TypeScript reads it loosely; the call site narrows the result
rather than letting `any` leak into the rest of the page.

## 3. Why the crossfade is a darken-union, not a fade

Worth recording because the wrong version shipped first and looked plausible.

The flat→3D handoff was originally an alpha lerp with a warm veil over the
midpoint. Watching it frame by frame over the warm ground, the word became a
pale translucent ghost at the midpoint before resolving back to black.

Two things were wrong. First, it violates the ink-black law — Desk Doodles'
brand rule is that tonal range comes from light and mark density and *never*
from washing the ink out. Second, and worse: a cross-dissolve reads as one image
fading out while a different image fades in, which destroys the single thing the
beat exists to say — that the flat mark and the 3D form are the same object.

The cause was compositing, not timing. Two partially-transparent black layers
over a light ground can only produce grey; the veil then lightened it further.
The fix:

```
outAlpha = max(alpha3D, alphaFlat × fadeOut)      ink held at #1a1a1a
```

A darken-union. At every instant the union of the two inks is fully ink-black —
the silhouette morphs as flat-only slivers retire and tube fringes arrive, but
the *value* never lifts. The transition being nearly invisible is the point.

Measured on the current film over the warm ground, across the eight crossfade
frames: the darkest ink pixel goes from 17.3 (flat `#1a1a1a`) to 4.9 and stays
there — it gets *darker*, because the 3D tube has shadowed undersides. The mean
ink value is flat at 55.5–56.1 for the whole handoff, with no midpoint
excursion. There is no grey and no ghost.

One residual, and it is a pen-weight question rather than a compositing one: at
the same bounding box the 3D silhouette covers 48,229 px against the flat
drawing's 38,872 — the tube reads about 11% heavier in linear stroke width than
`INK_DIAMETER_IN_STROKE_SPACE = 22` draws. So the mark gains a little heft at the
handoff. It was invisible while the crossfade happened mid-tilt, where nothing
was comparable; dead-on it is measurable. Raising that constant to roughly 26–27
would close it, and `compose.mjs` re-fits the flat drawing to the captured
footprint by measurement, so the bounding box would stay matched automatically.
Left alone here because how heavy the pen is, is a brand call and not a bug.

## 4. The registers — `lib/registers.ts`

The same engine can wear two opposite looks, and both are legitimate, so both
are switchable rather than one being hardcoded.

**Desk Doodles** is one warm-graphite ink, matte, where tonal range is earned
from light and mark density and never from hue. Its own north-star says *"It's
ALL ONE PENCIL … 3D must carry the SAME pencil-sketch character: a matte
black/grayscale SKETCH … NOT a glossy lit black solid that kills the sketch
feel."*

**Free Stroke** is the opposite instinct: gloss, metals, iridescence, and the
screen-space style stack. Its default `ink` is a dark glossy gel-ink, charcoal
rather than pure black *specifically so* the hard clearcoat highlight has a
surface to sit on.

A register is a value table — palette, type, spacing, motion character, pill
radius, material preset, default geometry mode — not a component. That is what
makes it portable back into the real Desk Doodles app rather than being a
lab-only skin.

### The one number that forced a new preset

Free Stroke already had a `matteClay` preset, and it turns out to be
**parameter-for-parameter identical** to Desk Doodles' — roughness 1.0, zero
metalness, zero clearcoat, reflectivity 0.08, envMapIntensity 0.12. The only
difference is colour: `#6f6457` clay-tan versus `#2A2622` warm graphite. This is
not a coincidence; Desk Doodles forked this exact preset and re-coloured it to
its single ratified ink, and its source says so.

So the register could almost have been expressed as the existing `matteClay`
with a colour override through `customMaterial` — except `CustomMaterial` cannot
override `reflectivity`, and the custom base pins it at 0.5. On a
roughness-1.0 surface that is the difference between an index of refraction of
about 1.5 and about 1.07 — a visible grazing-angle specular that would have
quietly made the register read glossier than Desk Doodles ever renders. Hence a
real `deskDoodles` preset carrying the full parameter set.

### A register also carries its light

An earlier version of this page swapped the **surface** and the **chrome** and
stopped there, and said so in the UI. It was not enough, and the reason is worth
keeping: Desk Doodles' 3D look is not only matteClay — it is matteClay *under a
specific studio setup*. Swapping the material alone gets the surface right and
the light wrong, and what you get is the correct ink rendered as a flat black
cut-out.

So the rig came across too. It was **ported, not rebuilt** — `STUDIO_ENV`,
`StudioRig`, `applyRimGlow`, `CONTACT_SHADOW` are Desk Doodles' own code, copied
into `components/studio-rig.tsx` with their constants and their comments intact.
Those comments are the record of measured failures: an environment palette that
was once warmed for the paper world and re-entered through the clearcoat channel
as a tan flood (rgb(142,118,91) on a glossy slab, Δr−b 50), a key panel that a
wide sheen lobe mirrored as milk-chocolate across a flat face, a rim strength of
1.9 that washed the ink body grey. Re-deriving the rig from a description of it
would have thrown all of that away and kept only the numbers' current values.

Free Stroke's own rig — the nine-panel environment with the hard slat structure
that makes chrome read as chrome — moved into the same file beside it, unchanged.

The register therefore carries a `lighting` field, and it is a **switch**, not a
parameter table:

```ts
lighting: { rig: "desk-doodles-studio", rim: true, contactShadow: true }
```

Choosing between two whole rigs keeps the register portable (everything here is
still data) without pretending that a rig is reducible to a handful of numbers.

Four pieces do the work, and each earns its place:

| Piece | Why it exists |
|---|---|
| Hemisphere (warm sky / paper-bounce ground) | Stands in for light bouncing off white paper. |
| **Near point light, decay 2** | A directional shades a flat camera-facing face perfectly uniformly — constant N·L. That is *exactly* the featureless-blob read. A nearby point light varies with position, so a flat face gets a real gradient. |
| Baked dark ink-family environment | Specular reflection bypasses albedo, so any hue here lands at full strength no matter how black the base is. It is de-warmed on purpose. |
| Fresnel rim + contact shadow | The rim makes an ink-black silhouette legible at any size; the pool makes the form an object *above* paper rather than a mark *on* it. |

Two props of the contact shadow had to be moved off drei's defaults, and both
are documented at the component: `frames` (Desk Doodles bakes once, which is
deterministic for a static form but captures an empty scene when a draw-in
animates visibility) and `near` (drei blurs through a helper plane at the world
origin, which is behind the shadow camera when the form is framed above y=0 —
the pool then vanishes silently). Both were caught by measuring the ground
luminance under the form, not by reading the source.

## 5. Transferring a tune back to the capture

`scripts/capture/motion.mjs` is plain ESM run by node with no build step; this
is TypeScript compiled by Next. They cannot import each other, so the honest
move is to make the transfer explicit and mechanical rather than pretend it is
automatic. `toMotionMjsSource(params)` emits a paste-able constants block, and
the page has a **Copy motion.mjs constants** button.

Tune live → paste → re-capture.

## 6. Verification

Verified headed (`--use-angle=metal`, never headless — headless silently pauses
the rAF loop here) by driving the page's **own** scrub slider and register
toggle, not the harness, because a past bug shipped where harness assertions
passed while the panel rendered zero controls.

- 24 dials mount; the register toggle, transport, phase ruler and readout all
  render and update.
- Scrubbing the full timeline in 26 steps drives the real WebGL scene: the word
  reads flat and dead-on during the draw and breath, strongly foreshortened and
  lying on the ground plane through the tilt and anticipation, and standing in
  ¾ with real depth through the orbit and hold.
- The timeline lands exactly on the hold target — az 38.0°, el 10.0°, fill
  0.800.
- Both registers render and are visibly different: Desk Doodles matte graphite
  with no specular, Free Stroke with clear gel-ink highlights.
- Zero console errors beyond two unrelated 404s for a missing static asset.

### The rig, measured

`scripts/verify/verify-register-light.mjs` captures both registers across six
orbit poses at `/desk-doodles`; `scripts/verify/assert-register-light.mjs` turns
four of the rig's own signatures into pass/fail rather than checking that
"something changed" — a material swap alone would satisfy that, and a material
swap alone is the thing this replaced.

| Signature | What it proves | Measured |
|---|---|---|
| Ground strip under the form darkens | The contact shadow is pooling in the Desk Doodles register and absent in Free Stroke | 249.27 → 247.78 |
| Luminance spread across the ink, head-on | The form is not a flat black cut-out at the one pose where a directional-only rig collapses it | stddev 26.2 over 19.5k px |
| Spread of R−B across the form | The two *environments* are doing different work: Free Stroke returns banded blue and tan, Desk Doodles' de-warmed panels return nothing | 15.6 (FS) vs 3.2 (DD) |
| Silhouette minus body luminance | The fresnel rim is live and edge-selective. Calibrated by switching `rim` off and re-measuring, so the threshold separates a real rim from "a lit tube has a bright edge anyway" | 62.9 with the rim, 53.4 without, interior moved 1.3 |

Plus a guard that the Free Stroke register kept its own look (ink mean 84.6
against Desk Doodles' 34.4) and that the console stays clean. `verify-gates.mjs`
passes unchanged: geometry never rebuilds on a style change in any of the four
modes, every mode still exports, zero console errors.

**One real bug was found and fixed this way.** The first build used
`minHeight: 100vh` on the page shell, which let the flex row grow to its tallest
child — the control column — making the WebGL canvas about 1000 CSS px tall and
framing the word off screen. Height-bounding the shell and giving the control
column its own scroll box fixed it. It would not have been visible from the code
or from a passing assertion; it was visible in the frames.

### The film itself

Verified by compositing the alpha WebM over the warm ground `#E9B44C` with
ffmpeg and reading the frames — on a dark or transparent background the ink is
misjudged. Every frame of the new film and of the previous one was extracted and
compared.

- The captured run holds together: consecutive-frame alpha deltas are exactly
  zero through the crossfade and the anticipation (camera parked, as designed),
  ramp up and back down through the tilt, cross zero once mid-stand-up where
  `easeInOutBack`'s counter-dip reverses, and decay to 51 px at the hold. No
  stale or dropped frames — the 90 ms per-frame settle is enough.
- The squash releases without a pop: word height runs 98 → 93 (compress) → held
  → 96 → 97 → 98 → 102 → 103 across the release, with the bottom edge pinned at
  y 584 the whole time.
- Stand-up, orbit and hold are unchanged from the previous film (mean per-pixel
  difference 0.07–0.17 on matched frames). The money move did not move.
- One seam is inherited, not new: the last stand-up pose and the first orbit
  pose are identical by construction, so there is one duplicated frame (33 ms)
  at that boundary. It lands on the settle, where stillness is wanted.

## 7. Known next step, not built

**The tuner has no flat-ink phase.** In the film, the draw-in is a 2D raster of
flat ink and the handoff to 3D happens at the crossfade. Live, the draw beat is
the 3D inflate reveal seen dead-on — there is no compositor, so there is nothing
rendering flat ink.

For tuning camera timing this is fine and arguably better, because the whole
timeline becomes one continuous camera program. But it means two things the
tuner cannot currently show you: the anticipation squash (compositor-side), and
the flat→3D handoff itself.

Closing that would mean rendering a real flat-ink layer over the viewport during
the draw beat, in Desk Doodles' own 2D register — `perfect-freehand` at
`size 4, thinning 0.5, smoothing 0.7, streamline 0.78`, drawn as a filled
polygon in `#121110`, not as a stroked polyline. That is a genuine build with a
design decision inside it (how faithfully should a tuner mirror the film's
compositing?), so it is recorded here rather than half-started.
