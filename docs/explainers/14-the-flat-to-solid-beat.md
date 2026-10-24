# 14 — The flat→solid beat

*How the hero word stops being a drawing and becomes an object, why it is one
mesh rather than two layers, and what that removes.*

Research: [`research/hero-2d-to-3d-transition.md`](../research/hero-2d-to-3d-transition.md)

---

## 1. What was missing

`/desk-doodles` had every beat of the hero choreography except the one the
product is about. The word was inflate tubes from frame one; the draw-in was
those tubes appearing head-on; the beat named `crossfade` was a still dead-on
frame. There was no flat state, so there was no transition, so the pitch — *a
drawn mark becomes a three-dimensional object* — never happened on screen.

Sebs: *"Right now it ALL looks 3D."*

## 2. The idea

The flat state is **not a second layer.** It is the same mesh, through the same
camera, driven to render as a drawing:

| | flat | solid |
|---|---|---|
| depth | `scale.z ≈ 0` | `scale.z = 1` |
| albedo | black | the preset's ink |
| emissive | the ink, intensity 1 | the preset's (none) |
| env / reflectivity / clearcoat / sheen / metalness | 0 | the preset's |
| fresnel rim | 0 | 0.55 |
| contact shadow | 0 | 0.32 |

Every one of those is a lerp on the surface that is *already there*. Nothing is
added and nothing is swapped. The beat is two dials — `flat` and `depth` — on one
object.

**Why the albedo has to go black.** Emissive alone sits *on top of* the lit
diffuse response, so the flat state would be ink plus shading — a lit form with a
glow, brighter where the light falls. Zeroing the albedo removes the diffuse term
entirely and leaves emissive as the only contributor: one value across the whole
surface, independent of every light in the rig and of the surface normal.

Measured: **standard deviation 0.00 across 9,534 interior pixels.** Not
approximately uniform. A single value inside a hard silhouette, which is what a
filled 2D shape *is*. The lit tubes head-on — the thing this replaces — measure
5.8.

## 3. What this removes

The previous attempt was the obvious one: a 2D ink canvas over the WebGL canvas,
composited with `mix-blend-mode: darken`. It was disabled behind a flag because
fitting the flat word to the 3D form's measured footprint never landed — the
screen showed two words, and the handoff read as one vanishing while another
appeared elsewhere.

The research doc lays out why measuring harder could not have fixed it: four
independent sources of disagreement (two coordinate systems, a quantised
downsampled bbox probe, a stroke-weight mismatch of about 11% by construction,
and a build-settle race), all of which have to be right *simultaneously at one
instant*, with no error budget, because a 2px offset at the handoff is visible.

Driving the form itself does not solve registration. It makes it **unavailable**:

> There is one object, so there is nothing for it to be misaligned with.

That is the whole argument for this build. Asserted rather than assumed — with
the camera parked through the handoff, the silhouette's centre moves **0.00px**
and its width steps **0.00px** across 30 consecutive frames.

Desk Doodles never solved this either. Its shipped flip is a CSS `scaleX`
card-turn that hard-swaps the two faces at the edge-on midpoint, specifically so
they are never on screen together — its own source says showing both "looked like
a double-image + pop", and its craft audit still lists this beat as unbuilt and
CRITICAL. So the flip is not a transition to port; it is a well-made way of
hiding that there wasn't one. What *did* port is its timing (§5).

## 4. Why the ink never washes

Desk Doodles' brand law is that tonal range comes from light and mark density and
never from washing the ink out. The film enforces it with a darken-union, because
its predecessor — an alpha lerp — turned the word into a pale ghost at the
midpoint (two partially-transparent black layers over a light ground can only
make grey) and, worse, read as a cross-dissolve: one image fading out while a
*different* image fades in.

One mesh has no union to take. The value is protected differently: the flat state
is an emissive floor, and the beat *raises* the surface into light rather than
fading anything. There is no midpoint where two things are both half-present, so
there is no midpoint that can be grey. Gated anyway — no frame of the handoff is
lighter than where it settles (peak mean 43.8, settled 43.8).

## 5. The choreography

`crossfade` is renamed **`emerge`**, and the rename is the point: a crossfade is
two images swapping, which is the one read this beat must never have.

```
draw    2.60s   flat ink writes itself in, dead-on
breath  0.50s   flat, still
emerge  0.54s   the mark gains depth, then catches the light   ← the beat
tilt    0.70s   the volume it just gained is what the camera reveals
…       anticipation → standup → orbit → hold, unchanged
```

**0.54s is ported, not chosen.** It is Desk Doodles' own `FLIP_MS = 540`
(`DeskDoodlesHome.tsx:637`) — the one number in their flip tuned by eye against
this exact gesture. The old `crossfade` was 0.28s, sized to *hide* a swap; far
too short to *show* a change of state.

### Two things change, and not together

- **Depth** — the mark stops being zero-thickness. A physical event.
- **Light** — the surface stops being a constant value and starts being shaded.
  An optical consequence of the first.

Firing them simultaneously reads as a switch being thrown. The light lags the
depth by **80ms**, inside the 30–80ms band that a group entrance is staggered by
for the same reason: it makes the light read as *caused by* the volume rather
than coincident with it.

### The depth swells

`easeOutBack`, overshoot 0.1 — the ink puffs about 10% past full thickness and
rocks back. Matter arriving has weight; a depth that eases straight to its final
value reads as a value being set.

`easeOutBack` and **not** `easeInOutBack`, which the stand-up uses. This is an
*entrance*, and an entrance that starts slow spends its most-watched moment doing
nothing. The stand-up is the opposite case — a body gathering itself before a
committed move — and keeps its ease-in. Two events, two curves, deliberately.

### The light outlasts its own beat

The flat→lit lerp runs 0.70s on Desk Doodles' own flip curve,
`cubic-bezier(0.45, 0, 0.2, 1)`, finishing about a third of the way into the
tilt. That is deliberate and it is the part that makes the beat legible.

Head-on, **depth is nearly invisible** — a tube seen down its own axis has the
same outline whether it is 1mm or 10mm thick. Volume only becomes legible when
the viewpoint rakes. So the surface is still resolving as the camera starts to
move, and the emerging highlights are something the tilt *reveals* rather than
something it arrives to find already finished.

### Depth scales about the form's own Z centre

Not the world origin. Scaling about the origin would slide the mark toward the
camera as it thickened, and under a perspective projection that is a change of
on-screen *size* — the word would breathe at the one moment it has to hold
perfectly still. Pinning the centre means the front half advances exactly as far
as the back half retreats.

## 6. Where it lives

| File | What it owns |
|---|---|
| `lib/hero-motion.ts` | `sampleEmerge()`, `easeOutBack`, `cubicBezierEase`, `ddFlipEase`. One continuous function of time, so scrubbing backwards lands on exactly the state playing forwards did. |
| `components/viewport-3d.tsx` | `FlatState`, and the flat-state block in `AnimatedStrokes`' frame loop. |
| `components/studio-rig.tsx` | one documented port change: `opacityScale` on the contact shadow. |
| `app/desk-doodles/page.tsx` | samples the beat, passes `flatten`, three new dials. |

Two implementation notes that are not obvious from the code:

**The flat state must be the LAST material write of the frame.** Everything above
it re-pins the surface from the preset base or the animation evaluator *every
frame*; an override applied anywhere earlier is overwritten before it reaches the
GPU.

**It is a prop, not a dev harness.** The register toggle and the reveal are
driven through `window.__*Harness` because this is a tuner page, and those
harnesses are `NODE_ENV !== "production"` only. The flat state is the *product*.
A beat that only exists behind a non-production window global is a beat no
visitor ever sees.

The depth group wraps `exportGroupRef` rather than living inside it, so a GLB
pulled mid-beat is still the real solid object.

## 7. A dropped frame was deleting the beat

The most instructive bug here, and it had nothing to do with the transition.

The page stalls about **1.1s** at the instant the draw-in completes: the hero
word's implicit-fusion surface builds at full complexity for the first time.
Pre-existing — it reproduces identically with `flatten` removed, and the partial
builds during the draw are cheap (the page holds 73fps through all of it).

Playback was anchored to the wall clock, `t = (now - startWall) / 1000`. That is
the textbook shape and it is a trap: after a stall, the next frame to run reads a
timestamp 1.1s later and renders **that** pose. The emerge is 0.54s and sits
inside the window, so it was never rendered at all. Measured phase spans:

```
draw     0 .. 2889     breath  3884 .. 3886  (2ms)
emerge   never observed
tilt     5044 .. 5054  (10ms)
```

`breath` → `tilt`, centrepiece skipped — while frame-by-frame scrubbing showed it
perfectly correct. **This is exactly the "it randomly switches to 3D" symptom,
reached from a completely different direction than the one that was being
debugged.**

Accumulating with a clamped per-frame step fixes it, and turns a *skip* into a
slow-motion hiccup. A hero beat that occasionally takes 11 seconds instead of 10
is fine; one that omits its centrepiece on slower hardware is not.

The clamp value matters. At `1/15s` it became a feedback spiral — each clamped
frame slows the timeline, which holds the reveal at a higher completion for
longer, which makes the next rebuild dearer: **73fps → 6.9fps, and the draw beat
unfinished after 12 seconds.** At 0.25s it never engages on a frame the page can
actually render, so playback is unchanged on hardware that keeps up, and it caps
the damage at a quarter second when it does engage. Every phase now renders.

A warm-up pass — building the finished form once on mount to pay the cost against
a still frame — was tried and **removed**: measured against the clamp alone it
changed the emerge's screen time from 284ms to 310ms, which is noise. The clamp
does all the work.

The underlying stall is a real, separate defect: the implicit build should not
cost a second. It is logged rather than papered over.

## 8. Verification

```bash
node scripts/verify/verify-hero-transition.mjs      --label=after
node scripts/verify/assert-hero-transition.mjs      --label=after
node scripts/verify/assert-hero-reduced-motion.mjs
```

Headed Chrome, Metal ANGLE, never headless. Driven through the page's **own**
transport — the `data-hero-play` button and the `data-hero-scrub` slider — not a
state-injection harness. Positional selectors were tried first and silently
picked up the 3D viewport's own playback slider, which is a different timeline in
the same `<main>`: the capture scrubbed a 1-second draw-in instead of the
10-second beat and reported success.

Artifacts in `docs/verification/hero-transition/after/`:

| | |
|---|---|
| `hero-beat-realtime.mp4` | the beat playing in real time, the page's own rAF loop |
| `emerge.mp4` + `emerge/*.png` | 72 frames across the 1.3s handoff window |
| `emerge-zoom.png` | 6 frames, tight crop, nearest-neighbour — the surface itself |
| `scrub.mp4` + `scrub/*.png` | 110 frames, the whole timeline |
| `frame-one.png` | the acceptance test, at rest |
| `realtime-sheet.png` | 30 cells across the real-time pass — the whole beat at a glance |

`hero-beat-realtime.mp4`, `realtime-sheet.png` and `emerge-zoom.png` are derived
from `play.mp4` and `emerge/` by post-processing, not written by the capture
script. To regenerate after a re-capture (the trim offset is the session length
minus the real-time pass, so re-check it rather than reusing 46.5):

```bash
cd docs/verification/hero-transition/after
ffmpeg -y -ss 46.5 -i play.mp4 -c:v libx264 -pix_fmt yuv420p hero-beat-realtime.mp4
ffmpeg -y -i hero-beat-realtime.mp4 \
  -vf "crop=1120:700:0:66,fps=1.8,scale=330:-1,tile=5x6" -frames:v 1 realtime-sheet.png
ffmpeg -y -pattern_type glob -i 'emerge/00{00,12,18,24,33,45}.png' \
  -vf "crop=340:170:510:270,scale=iw*3:ih*3:flags=neighbor,tile=2x3" -frames:v 1 emerge-zoom.png
```

`before/` is kept as the **negative control**, and it is what makes the gates
mean anything: it fails the two flat gates (1/3). Thresholds are calibrated
against it rather than guessed.

| Gate | Measured |
|---|---|
| flat beat renders as ONE VALUE | sd **0.00** over 9,534px (< 1; lit tubes head-on: 5.8) |
| flat beat has NO specular highlight | spread **0.0** (< 8; lit tubes head-on: 65.6) |
| held ¾ still has real tonal range | sd 8.4, spread 102.4 |
| ink never washes past the settled value | peak 43.8 vs settled 43.8 |
| silhouette never jumps, camera parked | centre **0.00px**, width **0.00px**, 30 frames |
| the change is gradual, not a cut | span 11.0, largest single step 1.2 |
| console clean | 0 errors |

**7/7.** The scrub gates are measured on stills, so they judge the beat's
*content*. What it does on the page's own clock is a separate question, below.

### What the beat actually does in real time

The gates above scrub the timeline; they cannot see the effect of the §7 stall,
because scrubbing has no clock. So the real-time recording was measured too — ink
statistics and silhouette per video frame, with the page's own `az / el / fill`
readout scraped alongside as ground truth for where the timeline had reached.

The timeline **freezes at 2.76s for about 1.2s of wall time**, then resumes with
two clamped 0.25s steps: `2.76 → 3.02 → 3.29`, after which it steps normally.
Consequences, and they are not what you would guess:

- **The emerge renders.** It gets ~10 video frames, about 0.36s of screen time.
  Pre-clamp it got none (§7).
- **It loses its first 0.19s** — 35% of the beat — to the second clamped step.
- **Nothing visible is lost anyway.** The frame the jump lands on (timeline 3.29)
  measures `mean 3.1, sd 1.8` — identical to the flat state before it. Because
  the light lags 80ms and then takes 0.70s, the first third of the emerge is
  *depth arriving invisibly*, which head-on has no pixels to lose. The clamp ate
  dead time.
- **The ramp that follows is smooth and monotonic**: sd `1.98 → 2.13 → 2.67 →
  3.57 → 4.44 → 5.13 → 5.37 → 5.83 → 6.35 → 6.54`, largest single step 0.90. No
  frame carries the change.
- **The silhouette holds through all of it** — bbox `540x132` constant, centre
  moving 0.5px, until the tilt starts foreshortening it (132 → 64 over the
  following 0.5s). One object.

So the stall is a **pacing** defect, not a correctness one: the viewer sees the
word finish, a pause ~2.5× longer than the 0.50s `breath` intends, then the beat.
That is the right thing to fix next, and it is the §7 implicit build, not the
beat.

### The recording window was truncating the artifact

Found while judging the above, and worth recording because the artifact looked
fine. The capture waited `total + 1.5s` of wall clock for the real-time pass —
but real-time playback of a 10.2s timeline takes **~16s** for exactly the reasons
above, so recording stopped at about timeline **7.2s**. Every video in the folder
ended mid-orbit and none contained the hold, which is the frame that proves the
form settles as an object rather than merely keeps moving.

`verify-hero-transition.mjs` now polls the page's own transport until it reports
the end, capped, instead of guessing a duration. The real-time artifact runs the
full 16.6s and lands on `10.20s / az 38.0° / el 10.0°`.

Generalises past this page: **a fixed wall-clock wait is an invalid instrument
for anything whose whole design is that it does not track the wall clock.**

### The measurement bug worth knowing

The first version of the flat-state gate failed a render that is visibly,
provably flat: sd 25.8, spread 147. The render was right and the measurement was
wrong. Antialiasing — a hard-edged black silhouette on pale paper has a
one-pixel boundary ramp that takes *every* value between ink and paper, so **the
flatter and harder-edged the mark, the more spread its own edge contributes.**
The statistic was measuring the outline and calling it shading. Eroding the mask
3px before measuring drops the ramp and leaves the surface; the bounding box is
still read from the un-eroded mask, because the silhouette *is* the outline.

Generalises: any statistic over a luminance-gated mask is measuring the edge
unless it was told not to.

## 9. Known, not built

- **The capture pipeline still composites.** `scripts/capture/motion.mjs` and
  `compose.mjs` keep the darken-union, which is correct for them — offline they
  can re-fit by measurement against the frame they are compositing onto, with no
  race and no live camera. `toMotionMjsSource()` therefore still emits
  `crossfade:` for the beat now called `emerge`, so the transfer stays
  byte-compatible. The film and the page now differ in mechanism.
- **The 1.1s implicit build.** Mitigated, not fixed (§7).
- **Reduced motion** drops the swell and the stand-up's overshoot and keeps the
  value change, per "gentler, not zero". It is not wired to a dial because it
  reads the media query directly. Now **asserted** rather than claimed
  (`assert-hero-reduced-motion.mjs`, 4/4): with the preference on, the flat beat
  still measures sd **0.00** and the hold still measures sd 8.4 / spread 102.4 —
  the pitch survives — while the stand-up's overshoot goes to zero on all three
  channels. The control run proves the gate can fail (el dips 5.5°, az 3.0°,
  fill +0.014 without the preference).

  The instructive part is *what* it had to measure. The obvious gate — does the
  ink still swell — is unmeasurable from the silhouette **by construction**: the
  swell scales depth about the form's own Z centre under a dead-on camera, so the
  outline does not move, which is the same fact the registration gate proves at
  0.00px. A first version gated on silhouette height, read 4px in *both* runs
  (that 4px was the tilt starting, not the swell), and would have failed a page
  that honours the preference perfectly. The stand-up's `backC1` overshoot does
  move the camera, so that is what carries the gate.
