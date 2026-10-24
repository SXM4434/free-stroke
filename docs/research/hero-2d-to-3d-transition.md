# The 2D→3D hero transition — what Desk Doodles actually shipped

*Research for the hero beat's flat→solid handoff. Read before touching it: the
obvious build has already been tried twice and failed both times, for the same
reason.*

---

## 1. The question

Desk Doodles' pitch is one beat: a flat drawn mark becomes a three-dimensional
object. Sebs's note on the state of it was exact:

> "The animation needs to transition in a cool way — like the flip, or better —
> from the 2D flat text to the 3D. Right now it ALL looks 3D."

He was right, and the reason was structural rather than aesthetic: **there was no
2D state at all.** The hero word was inflate tubes from the first frame, and the
draw-in was those tubes appearing head-on. With no flat state there is no
transition, so the product's whole claim never happened on screen.

The standing instruction is to port rather than rebuild: *"I said port over ALL
of the Desk Doodles stuff. We have the code and the engine — just port it over.
DO NOT RECREATE WHEN WE HAVE THE CODE."* So the first question was not "how
should this be built" but "what does Desk Doodles already do here".

## 2. What Desk Doodles actually does — and the thing worth knowing

Desk Doodles' homepage does flip its object between 2D and 3D, and the flip is a
CSS card-turn:

```
animation: dd-cardflip 540ms cubic-bezier(0.45, 0, 0.2, 1) both
```

`FLIP_MS = 540` (`DeskDoodlesHome.tsx:637`, curve at `:672`). The keyframes drive
`scaleX` down to about 0.04 — edge-on — dwell there across roughly 48–52% of the
timeline, and come back out. There is a brightness dip to 0.94 through the middle.

**The two faces are hard-swapped at that edge-on midpoint.** The 2D mark is
removed and the 3D render is inserted in a single frame, at the one instant when
the element is a vertical line one pixel wide and nothing can be seen. Their own
source says why: showing both at once "looked like a double-image + pop".

That is the finding that matters, and it inverts the brief. The flip is not a
solved 2D↔3D transition to be ported — it is a **very well-executed way of
hiding that the transition was never solved.** The edge-on dwell exists to give
the swap somewhere to happen unseen. Desk Doodles' own craft audit agrees:
choreographing this beat is still listed there as unbuilt and CRITICAL.

Two consequences:

- There is no registered flat→solid handoff in the canonical repo to copy. What
  *can* be ported is the flip's **timing** — 540ms and
  `cubic-bezier(0.45, 0, 0.2, 1)` are values tuned by eye against exactly this
  gesture — and its ink, `INK_3D_DEFAULT = '#2A2622'`.
- There is **no unlit or flat render mode** in their 3D path to inherit. Their
  materials are all lit (`matteClay` and relatives). The single precedent for an
  unlit surface anywhere in the engine is a hull shader that writes
  `gl_FragColor = vec4(u_ink, 1.0)` directly — which is, usefully, exactly the
  shape of what a flat state needs.

## 3. Why the two-layer build fails, twice

The obvious build is a flat 2D ink layer over the WebGL canvas. It was tried here
(`lib/flat-ink.ts` + a `mix-blend-mode: darken` composite) and abandoned behind a
disabled flag. The compositing half was right — see §4 — and it failed on
**registration**: the flat word had to be fitted to the 3D form's on-screen
footprint, that fit never landed, and the screen showed two words. The handoff
then read as one vanishing while another appeared somewhere else, which is the
worst possible outcome for a beat whose entire assertion is *these are the same
object*.

Measuring harder did not fix it and could not have. The pipeline between the two
layers has at least four independent places to disagree:

1. Two renderers with two coordinate systems (stroke space; WebGL world space).
2. A bounding-box probe of the WebGL buffer, downsampled to 320px for cost, so
   quantised to ~0.3% of width — and luminance-gated, so it also has to not
   mistake the ground plane, the grid, or the **contact shadow** for ink.
3. Stroke weight: the 2D line width is `INK_DIAMETER_IN_STROKE_SPACE = 22`
   scaled by footprint, while the 3D silhouette is the polyline dilated by the
   tube radius. These are different numbers by construction — measured on the
   film at a matched bounding box, the 3D silhouette covers 48,229px against the
   flat drawing's 38,872, about 11% heavier.
4. A settle race: the hero word's implicit-fusion build takes a few hundred ms,
   so a footprint measured too early measures a different object.

Each is fixable. All four have to be right *simultaneously, at one instant*, or
the beat dies — and there is no error budget at all, because a 2px offset at the
handoff is visible as a jump. This is not a bug that was nearly fixed; it is an
architecture with no margin.

The film gets away with it because `compose.mjs` composites **offline**, where it
can measure the captured frame it is actually compositing onto and re-fit by
measurement with no race and no live camera. That is a genuinely different
problem, which is why `lib/flat-ink.ts` stays.

## 4. The one thing from the film that is right, and stays right

The film's flat→3D handoff was originally an alpha lerp with a warm veil. It
shipped, and it was wrong twice over: the word became a pale translucent ghost at
the midpoint (two partially-transparent black layers over a light ground can only
make grey), which breaks Desk Doodles' ink-black law; and a cross-dissolve reads
as one image fading out while a *different* image fades in, destroying the single
thing the beat exists to say.

The fix was a **darken-union**:

```
outAlpha = max(alpha3D, alphaFlat × fadeOut)
```

At every instant the union of the two inks is fully ink-black. Measured across
the eight crossfade frames, the darkest ink pixel goes 17.3 → 4.9 and stays —
it gets *darker* — and the mean ink value is flat at 55.5–56.1 with no midpoint
excursion.

The principle generalises past the technique: **the value must never lift during
the handoff.** Any build has to satisfy that, whether or not it composites two
layers. The build documented in `explainers/14-` satisfies it by having only one
layer to composite, and it is asserted rather than assumed
(`scripts/verify/assert-hero-transition.mjs`, gate 4).

## 5. What the 3D path can be driven to

The decisive question for sidestepping registration entirely: can the existing
engine render the form as a drawing?

Yes, and nothing new has to be built to do it. A `MeshPhysicalMaterial` renders
as a single constant value — no gradient, no highlight, no dependence on normal
or light — when:

- `color` (albedo) is black, so the diffuse term is zero;
- `emissive` is the ink at `emissiveIntensity = 1`, so emissive is the only
  contributor;
- `envMapIntensity`, `reflectivity`, `clearcoat`, `sheen` and `metalness` are
  zero, so no specular path can put a highlight on it;
- the ported fresnel rim's `uRimStrength` is zero — a rim light is a statement
  that the silhouette is the grazing edge of a solid, which is the one claim a
  drawing does not make.

And depth is a transform, so it collapses with a `scale.z`. Both are continuous
lerps on the surface and geometry that are *already there* — no second material,
no second mesh, no second layer.

Measured on the result: **standard deviation 0.00 across 9,534 interior pixels.**
Not approximately uniform — exactly uniform, which is what a filled 2D shape is.
The lit tubes head-on, the defect this replaces, measure 5.8.

## 6. Reference values, ported

| Value | Source | Used for |
|---|---|---|
| `540ms` | `DeskDoodlesHome.tsx:637` (`FLIP_MS`) | the emerge beat's duration |
| `cubic-bezier(0.45, 0, 0.2, 1)` | `DeskDoodlesHome.tsx:672` | the flat→lit curve |
| `#2A2622` | `INK_3D_DEFAULT` | the register's ink |
| `uRimStrength = 0.55` | `applyRimGlow`, already ported | the rim's full-strength value |

## 7. Two things measured that changed the build

**A flat fill measures as heavily shaded if you measure its outline.** The first
version of the assertion read every pixel under a luminance gate and failed a
render that is visibly, provably flat — sd 25.8, spread 147. The cause is
antialiasing: a hard-edged black silhouette on pale paper has a boundary ramp
that takes every value between ink and paper, so *the flatter and harder-edged
the mark, the more spread its edge contributes.* Eroding the mask by 3px before
measuring drops the ramp and leaves the surface. Worth knowing generally: any
statistic over a luminance-gated mask is measuring the edge unless it was told
not to.

**A dropped frame can delete a beat.** The page stalls ~1.1s at the instant the
draw-in completes, because the implicit-fusion surface builds at full complexity
for the first time (pre-existing; it reproduces with the flat state removed).
Under a wall-clock playhead — `t = (now - startWall) / 1000`, the textbook shape
— the next frame to run reads a timestamp 1.1s later and renders *that* pose.
The emerge is 0.54s and sits inside that window, so it was never rendered at
all: `breath` → `tilt`, centrepiece skipped, while frame-by-frame scrubbing
showed it perfectly correct. Accumulating with a clamped step fixes it; the clamp
must sit above ordinary frame time or it becomes a feedback spiral (measured at
`1/15s`: 73fps → 6.9fps, the draw unfinished after 12 seconds).
