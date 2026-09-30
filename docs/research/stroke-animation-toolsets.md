# How other tools let you animate a stroke being drawn

*Twenty-five references, every one captured through the provenance gate and read
first-hand. What each one actually does — not what its marketing says — and what
it would mean here. Research behind
[`../animation-toolset-map.md`](../animation-toolset-map.md).*

**Provenance.** Every page below was captured with
`docs/system/_capture/refs-capture.mjs`'s `captureRef()`, which asserts
`response.ok()`, the error-page and Cloudflare signatures, the login wall, blank
paint and consent overlays, then writes url · status · ok · sha256 · checks to
`_capture-manifest.json`. Gate result, verbatim:

```
25/25 image(s) provenance-verified · 0 unverified · 0 bad · gate PASS
```

Files: `docs/verification/anim-map/refs/` — one `.png` and one `.txt` per ref,
same basename, plus `_contact.png` (25 labelled tiles). **I opened the contact
sheet and looked**; all 25 are the real documentation pages. Three carry honest
caveats, recorded below rather than hidden.

**What I did not get.** Adobe Animate's `frame-frame-animation.html` and
`onion-skinning.html` are both 404 — the frame-by-frame/onion-skin reference is
the weakest slot on the board and ref 14 is a fallback that covers tweening but
not onion skin. Cavalry's docs moved from `docs.cavalry.scenegroup.co` to
`cavalry.studio/docs`, and **Cavalry has no node called "Trim Path"** — its
equivalent is **Chop Path**; do not let a later reader assume the After Effects
vocabulary transfers. Refs 07 and 18 (Rive Timeline, Rive Interpolation) are
thin pages built around video embeds; the text below comes from what those pages
say in prose, and the video content was not watched.

---

## The bottom line

Read across all twenty-five, three findings decide our design, and each of them
is a convergence rather than one tool's opinion.

**1 · "One at a time" vs "all at once" is the first control every serious tool
ships.** After Effects calls it *Simultaneously / Individually*. Blender calls it
*Sequential / Concurrent*. Two tools with nothing in common landed on the same
binary because it is the first question a draw-in raises. **Free Stroke has no
answer to it at all** — it is always sequential, in capture order.

**2 · The reveal is a WINDOW, not a prefix — and this is nearly free for us.**
After Effects trims with **Start, End and Offset**; GSAP's DrawSVG takes
`"20% 80%"` and says outright *"You're not limited to starting out at a single
point along the path and animating in one direction only"*; anime.js's
`createDrawable` exposes `draw = '0 1'`, a start and an end separated by a space.
Three independent implementations, one representation. **Free Stroke's reveal is
a one-ended prefix `[0, p]`.** On our `setDrawRange` path a window is *two*
binary searches instead of one — and it buys un-draw-from-the-start, a travelling
segment, and Blender's *Shrink* and *Vanish* transitions, none of which we can
currently express.

**3 · Performing and keyframing are two views of ONE model, not two products.**
Procreate Dreams — the closest existing thing to "in control of the pen through a
motion tool" — is explicit: *"Performing records keyframes in real-time using
gestures"*, and *"You can modify any keyframes you laid down in either Perform or
Keyframe mode."* One timeline, three modes (**Compose · Perform · Keyframe**). If
we build a performance mode and a timeline as two systems, we will have built the
mistake this repo already has a name for: one idea, two implementations.

**4 · The winning architecture is a modifier owning the RULE and one keyframed
scalar owning WHEN — and I have a frame of it.** In
`blender-gp-build/contact/key-395s.png` the Dope Sheet shows the Build modifier's
own **`Factor`** channel with keys at frame 1 and ≈220. A whole word builds in from
**two keys on one channel**, because the modifier already knows the order, the
mode, the transition and the fade. That is not a compromise between directions B
and A — it is the shape a shipping tool arrived at, and it is the shape Free
Stroke's engine already has, because the reveal is driven by exactly one scalar
(`playheadRef`) that every render path reads.

And one thing worth saying because it is uncomfortable: **the reference that
matches us most closely already ships the feature we thought was ours.** Blender's
Grease Pencil Build modifier has a timing mode called **"Natural Drawing Speed:
Use the recorded speed of the stylus when the strokes were drawn"**, with a Speed
Factor multiplier and a **Maximum Gap** in seconds. That is Free Stroke's
Authentic mode plus its between-stroke air-gap handling, in a shipping tool, in
almost the same words. We are not first. What we *do* have that Blender does not
is the ability to make the user perform a new one.

---

## 1 · Blender — Grease Pencil **Build** modifier

`ref-08-blender-gp-build-modifier` · docs.blender.org/manual/en/latest/grease_pencil/modifiers/generate/build.html

**The single most relevant reference on this board.** Its subject is literally
ours: hand-drawn strokes, drawn in over time. And it is a **modifier**, not a
timeline — you never place a key.

**The mechanism, verbatim from the page I saved:**

> *"The Build modifier makes strokes appear or disappear in a frame range to
> create the effect of animating lines being drawn or erased."*

| parameter | what it actually does |
|---|---|
| **Mode** | *Sequential* — "Strokes appear/disappear one after the other, but only a single one changes at a time." *Concurrent* — "Multiple stroke appear/disappear at a time." *Additive* — "Builds only the strokes that are new compared to last keyframe." |
| **Transition** | *Grow* — "Shows points in the order they occur in each stroke… (Simulating lines being drawn.)" *Shrink* — "Hide points from the end of each stroke to the start, from last to first stroke. (Simulating lines being erased.)" *Vanish* — "Hide points in the order they occur… (Simulating ink fading or vanishing after getting drawn.)" |
| **Timing** | *Natural Drawing Speed* — **"Use the recorded speed of the stylus when the strokes were drawn."** Only available in Sequential and Additive. With **Speed Factor** ("The recorded speed is multiplied by this value") and **Maximum Gap** ("The maximum gap between strokes in seconds"). Alternatives: *Number of Frames* (a fixed budget) and *Percentage Factor* ("Manually set a percentage factor to control the amount of the strokes that are visible", 0..1). |
| **Time Alignment** *(Concurrent only)* | *Align Start* — "All strokes start at the same time (i.e. shorter strokes finish earlier)." *Align End* — "All strokes end at the same time (i.e. shorter strokes start later)." |
| **Object** | "Use the distance to an object to define the order in which strokes appear." |
| **Delay** | "Number of frames after each Grease Pencil keyframe before the modifier has any effects." |
| **Fade** | Factor, plus separate **Thickness** and **Opacity** strengths, plus a **Weight Output** assigning a weight to points that have started/finished the fade. |

**Four things here I would not have invented:**

- **Time Alignment is not the same question as Mode.** Once several strokes draw
  at once you must decide whether short strokes finish early or start late, and
  it changes the read completely: *Align End* makes the whole word land together
  like a chord; *Align Start* makes it ravel out. This is the kind of second-order
  control that separates a real tool from a demo.
- **Maximum Gap.** Replaying recorded stylus timing means replaying the pauses,
  and a real pause between strokes can be seconds. Clamping it is required, not
  optional. Free Stroke already measures this exactly — `measurePenRecord`'s
  `airSec`, *"Time the pen spent OFF the page… the sum of the gaps"*
  (`lib/pen-reveal.ts:1091`) — and does not clamp it or expose it.
- **Order by distance to an object.** Spatial ordering rather than temporal.
  Ours would be "order by distance from a point you tap" — a genuinely playful
  control that costs a sort.
- **Fade splits thickness from opacity.** The leading edge is not a hard boundary;
  it has its own two-channel treatment. Free Stroke's answer to the same question
  is better and is already built — the pen-tip field's per-fragment nose and
  taper (`lib/pen-reveal.ts:391-489`) is a shaped nib rather than a fade — but the
  *idea* that the moving end needs its own parameter group is confirmed by both.

**What it means here.** This is direction B, shipping, in the closest adjacent
product. Its whole parameter list maps onto the PRD's Layer 3 "Future" list almost
term for term. It is the strongest available evidence that a modifier — not a
timeline — is the right primary model for stroke draw-in.

**Why it is not simply copied.** Blender's build is per-*point* along each stroke
with no shaped moving end, no pen-tip geometry, and no per-fragment boundary; its
"natural drawing speed" replays a stylus recording but has nothing like our
Sigma-Lognormal reconstruction for strokes that never had one
(`lib/pen-kinematics.ts`). We would take the *parameter model* and keep our own
mark quality.

---

## 2 · After Effects — **Trim Paths**

`ref-01-ae-trim-paths` · helpx.adobe.com/after-effects/using/shape-attributes-paint-operations-path.html

**The mechanism, verbatim (line 262 of the saved text):**

> *"Animate the **Start, End, and Offset** properties to trim a path to create
> results similar to results achieved with the Write-on effect… If the Trim Paths
> path operation is below multiple paths in a group, then you can choose to have
> the paths trimmed **simultaneously** or treated as a compound path and trimmed
> **individually**."*

Two mechanisms in one sentence:

- **Start / End / Offset is a window with a phase.** Not a progress scalar. Offset
  rotates the window's position along the path, which is what makes a *travelling
  segment* — a comet, a chase — rather than a growing line. Free Stroke cannot
  express any of that today.
- **Simultaneously vs Individually**, arrived at independently of Blender's
  Sequential/Concurrent. Note the framing though: in AE it is *"treated as a
  compound path"* — the individual case works by pretending the group is one path,
  which is **exactly how Free Stroke's global arc coordinate already behaves.** Our
  default is AE's *individually*; the mode we lack is *simultaneously*.

The same page also documents `stroke-dasharray`'s ancestor — *"The Offset property
determines at what point on the path the stroke begins… Animate the Offset property
to create a moving trail of dashes"* — and **Wiggle Paths**, which is worth one
line because of how it is described: *"The distortion is auto-animated, meaning
that it changes over time without the need to set any keyframes or add
expressions."* Auto-animated as a first-class idea; Free Stroke's `wobble-field.ts`
is the static version of the same thought.

---

## 3 · After Effects — **Write-on**

`ref-02-ae-write-on` · helpx.adobe.com/after-effects/using/generate-effects.html
⚠ **Honest caveat:** the saved PNG shows the top of the Generate-effects index
(4-Color Gradient), not the Write-on section. The saved `.txt` carries Write-on,
**Brush Position** and **Brush Time Properties**; the rest of my read is from the
Trim Paths page's own cross-reference to it (ref 01), not from a Write-on page I
looked at. Stated so nobody credits this ref with more than it holds.

The mechanism worth recording is the *distinction*, which AE itself draws:
Write-on animates a **brush position over time** and paints where it went; Trim
Paths animates **a window over an existing path**. Two different answers to "draw
this on."

**Free Stroke sits on the Write-on side and does not know it.** Our reveal is
driven by *where the pen was at time t*, recovered from real recorded timestamps
(`penTimeDistanceFraction`). That is a brush-position animation whose keyframes
were recorded by a hand rather than typed. It is the more expensive model and the
more honest one, and it is why our draw-in can have a shaped nib and a dasharray
cannot.

---

## 4 · Lottie — Trim Path, and the support matrix

`ref-03-lottie-trim-path` · lottiefiles.github.io/lottie-docs/shapes/
`ref-25-lottie-supported-features` · airbnb.io/lottie/#/supported-features

Lottie's schema lists **Trim Path** as a *modifier* with the two-letter type code
`'tm'`, alongside Repeater, Rounded Corners, Pucker/Bloat, Twist, Merge, Offset
Path, Zig Zag. Shapes carry a `d` attribute — *"Direction the shape is drawn as,
mostly relevant when using trim path"*.

Two things worth taking:

- **Trim is a modifier in the file format, not a property of the shape.** The
  serialised form of "how this draws in" is a small object in a modifier list.
  That is a good shape for our export/save story, and it is what direction B
  would produce naturally.
- **`d` — the drawing direction is data.** Which end a stroke draws *from* is a
  per-shape flag. Free Stroke has no such flag; a stroke always draws from the end
  the pen started at. "Reverse this one stroke" is one boolean and it is missing.

The support matrix (ref 25) is the sobering half: trim path's support varies by
platform and renderer. The lesson for us is one we already learned the expensive
way in `lib/export/frame-plan.ts` — **a motion feature that the export cannot
reproduce is a demo, not a feature.**

---

## 5 · Cavalry — Chop Path, Duplicator, **Stagger**, **Visibility Sequence**

`ref-04-cavalry-chop-path-trim` · `ref-05-cavalry-duplicator` · `ref-21-cavalry-stagger` · `ref-24-cavalry-visibility-sequence` · cavalry.studio/docs

Cavalry's model is a **node graph of behaviours over sub-meshes with IDs**, and it
is the richest per-item scheduling vocabulary on the board.

**Stagger** — *"Generate sequential values between a minimum and maximum… A
Stagger is useful when used with a sub-mesh such as a Duplicator or Text Shape."*
The saved page gives the table outright: Count 5, Min −100, Max 100 →
`0:−100  1:−50  2:0  3:50  4:100`.

And then the part that matters:

> *"The Stagger Graph's axes are not fixed values, they represent: **X axis — the
> first and last Id within a sub-mesh**… **Y axis — the Stagger's Minimum and
> Maximum values**. By default, the graph is a straight line meaning that values
> are output in a linear way."*

**A stagger is a curve over INDEX, not a constant offset.** That is the elegant
generalisation, and it is directly buildable here because our strokes already have
indices: "delay per stroke" stops being a number and becomes a shape — front-loaded,
back-loaded, ease-in across the word. `anime.js` reaches the same place from the
other side, whose `stagger()` takes `start, from, reversed, ease, grid, axis,
modifier, use, total, jitter` (ref 16's own navigation) — an origin index, a curve,
and a jitter.

**Visibility Sequence** — a window over the *index* domain rather than the arc
domain:

> *"Start — Set a percentage to mark the start of the range. **End**… **Travel** —
> Incrementally offset the range by one sub-mesh at a time. **Always On** — Enter a
> comma separated list of Ids to always remain visible. Colons can also be used to
> set ranges - `1,3,5:8`. **Always Off**… **Invert** — Invert the resulting range."*

**Always On / Always Off is the pragmatic escape hatch a rule-based system needs.**
A modifier stack is elegant right up to the moment you want *this one stroke* to
behave differently, and Cavalry's answer is: let the user name it by id and pin it.
That maps exactly onto "hold that stroke back and land it last as the punchline" —
the thing direction B is otherwise bad at.

**Chop Path** (their trim-path equivalent) is *"Chop a Shape into several slices"*
with Count / Angle / Offset / Spread, and — the giveaway of the whole architecture
— *"Connect a Behaviour (e.g. Random) to affect each slice independently."*

**What it means here.** Cavalry proves the modifier model scales to real
production without a keyframe in sight, and it names the two mechanisms direction B
most needs: the stagger-as-a-curve and the per-id override list.
**What it costs:** a node graph is the least iOS-appropriate interface on this
board. We take the mechanisms, not the interface.

---

## 6 · Procreate Dreams — **Timeline and Modes**, **Performing**, **Keyframes**

`ref-11-procreate-dreams-timeline-modes` · `ref-12-procreate-dreams-performing` · `ref-22-procreate-dreams-keyframes` · help.procreate.com/dreams/handbook/

The closest product on the board to what you described, and the only one designed
for a finger.

**The three modes, verbatim:**

> *"**Compose** — organise your tracks and content, modify the arrangement on the
> Stage. **Perform** — record your input to produce keyframes for a piece of
> content… all with your input. **Keyframe** — add and edit keyframes to your
> content to modify its properties over time."*

**Performing:**

> *"Performing records keyframes in real-time using gestures. Any action you
> perform is recorded and appears underneath your content on a keyframe track…
> Tap and drag anywhere on the stage to move your content and begin performing.
> Lift your finger or Apple Pencil at any time to pause Performing… **Tap Keyframe
> or Compose to switch to either mode. You can modify any keyframes you laid down
> in either Perform or Keyframe mode.**"*

**Five mechanisms, each of which changes our design:**

1. **A performance is not a separate data type.** It *produces keyframes*, and the
   keyframe editor edits them. That kills the version of our direction C where a
   recorded performance is an opaque curve you can only re-record.
2. **Motion Filtering** — *"Increase the Motion Filtering percentage with the
   slider to make your animation smoother and reduce shakiness. To perform rapid
   movements and capture every movement you make, set this slider to 0.0%."* A raw
   performance is shaky and needs a smoothing dial. **We already have this
   arithmetic**: `blendReveal`'s `hybridBlend` is precisely a blend from the raw
   recording toward constant speed (`lib/pen-reveal.ts:144`), and "Natural" is that
   dial at 0.4. It would need renaming, not building.
3. **Overwrite semantics** — *"Performing an action over an existing action of the
   same type will overwrite it."* Takes replace, they do not layer. But also:
   *"You can perform more than once on a single piece of content. Try performing a
   scale action over the top of a recorded move performance"* — different channels
   layer, the same channel overwrites. That is the rule, and it is not obvious.
4. **Tracks collapse by default and expand to per-parameter rows.** *"The keyframe
   types Move & Scale, noise, HSB, and Lens Blur contain multiple parameters… Tap
   and hold on a keyframe or keyframe track until a context menu appears, and tap
   **Expand**."* This is the answer to "what happens when there are forty strokes":
   one row, expandable. It is the same move `lib/hero-letters.ts` already enables
   for us — group by connected component, expand to strokes.
5. **Easing is set on a track, or between two specific keys.** *"Tap and hold on a
   keyframe track to bring up options to… set the **Easings of all keyframes on
   that track**"*, and *"When a keyframe track is expanded, you can tap and hold
   between two keyframes to set the easing just between these two points."* Two
   scopes for one control, both reachable by touch, with no graph editor anywhere.

And the framing sentence for the whole iOS question: *"**The Timeline in Procreate
Dreams is designed for touch.**"* Followed by: *"Tap and hold just above the Ruler
and drag up and down to change the ratio of your Timeline → Stage area."* The
timeline is not a fixed dock; the split between it and the canvas is a drag.

---

## 7 · Rive — **States**, **Transitions**, **Interpolation**

`ref-19-rive-states` · `ref-20-rive-transitions` · `ref-18-rive-interpolation-easing` · `ref-06-rive-state-machine` · `ref-07-rive-timeline` · rive.app/docs

Rive's model is a **state machine over timelines**:

> *"**States are simply timeline animations that can play at any point in your
> state machine.**"* — with Entry, Exit and **Any State** defaults, plus Single
> Animation, 1D blend and Direct blend states.

> *"Transitions define how and when a State Machine moves from one state to
> another. A transition is made up of four parts: **Path** (the direction the
> transition travels) · **Conditions** (when it occurs) · **Properties** (how it
> behaves — 'you might set the transition duration to 0.2 seconds so the change
> between states feels smoother') · **Actions**."*

Interpolation offers exactly three types — **Linear**, **Cubic** (two draggable
handles, *"You can drag the handles as far as you want on the Y-axis"*), and
**Hold** (*"doesn't interpolate values between keys. It simply holds the current
value until the next key is reached"*) — plus a numeric field holding the four
bezier values so a curve can be copied, pasted, or defined by a design system.

**What it means here — and it is mostly a "no".** A drawing has no interactive
states; there is no *Idle → Walk* for a mark on a page. The state machine is the
wrong shape for us. Two sub-mechanisms are worth stealing:

- **A transition carries a duration.** Changing between two authored looks is
  itself a timed event, not a swap. That is the discipline the hero beat learned
  the hard way (explainer 23's seam, and the media-pop's *"two properties resolving
  on the same frame — simultaneity is itself a perceptible event"*).
- **Hold as a first-class interpolation.** A stepped read is a choice, not an
  absence of easing. Free Stroke's `easeReveal` has four curves and no hold, and
  the hero beat's "twos" exposure is the same idea living somewhere else entirely.
- **The four bezier numbers as a copyable text field** is the small,
  designer-respecting move that makes a curve a *value* rather than a gesture.

⚠ Refs 07 and 18's pages are largely video embeds ("RIVE 101" thumbnails visible
in the contact sheet); the prose above is what the pages say in text.

---

## 8 · SVG `stroke-dasharray` — the cheap version, and why we are not it

`ref-09-mdn-stroke-dashoffset` · `ref-10-jakearchibald-line-drawing` ·
`ref-15-gsap-drawsvg` · `ref-16-anime-js-createdrawable`

Jake Archibald's 2013 article is the origin of the technique and states the trick
plainly:

> *"`stroke-dasharray` lets you specify the length of the rendered part of the
> line, then the length of the gap. `stroke-dashoffset` lets you change where the
> dasharray starts. Drag both sliders up to their maximum, then slowly decrease
> the dashoffset. **Voilà, you just made the line draw!**"*

with `path.getTotalLength()` supplying the number. GSAP's DrawSVG is the same
mechanism productised — *"It does this by controlling the `stroke-dashoffset` and
`stroke-dasharray` CSS properties"* — and anime.js's `createDrawable` wraps it in
a proxy exposing one property, `draw = '0 1'`.

**Why this matters to us is the limits, not the trick:**

- **It is a mask, not a draw.** The whole mark is rendered and a dash pattern hides
  part of it. There is therefore no pen tip, no nib shape, no taper, and no
  boundary you can shape — which is precisely the defect
  `lib/pen-reveal.ts` §T exists to fix, measured: *"free-stroke 7 px terminal
  transition, pen score 0.417 — a CUT"* against Desk Doodles' nib at 3.250.
  Anything built on a dash is buying the 0.417.
- **It needs a total length and one path.** Multiple subpaths in one `d` share one
  dash cycle, so the dash walks continuously through them — which is the same
  thing as our global stroke-major arc coordinate, arrived at by accident rather
  than by design. Our version is the deliberate one and it is documented as a law
  (`lib/pen-reveal.ts` §M).
- **And both libraries expose a WINDOW.** GSAP: *"`drawSVG:"20% 80%"` renders the
  stroke between the 20% and 80% positions… If you started at `"50% 50%"` and
  animated to `"0% 100%"`, it would draw the stroke from the middle outward."*
  anime.js: *"a start and end values separated by an empty space."* Finding 2 in
  the bottom line, from two more directions.

---

## 9 · Figma **Smart Animate** — timing without a curve editor

`ref-13-figma-smart-animate` · help.figma.com/hc/en-us/articles/360039818874

> *"Smart animate looks for **matching layers**, recognizes differences, and
> animates layers between frames in a prototype… Figma takes into account both the
> layer's **name** and where it sits within the **hierarchy**."*

The mechanism is *identity by name and position*: you author two states and the
tool derives the motion. Supported properties are enumerated one at a time — scale,
position, opacity, rotation — and the guidance is behavioural rather than numeric
(*"Set the opacity of the layer to 0%, instead of toggling the layer visibility"*).

**What it means here.** It is the strongest argument for direction D and against a
graph editor: a designer authored two *states* and never touched a curve. Our
equivalent of "matching layers" already exists and is better founded — a stroke has
a real identity (its index, and its connected component from
`lib/hero-letters.ts`), so we would never need Figma's name-matching heuristic.

**Where it does not transfer:** Smart Animate interpolates between two *authored
poses*. A draw-in is not a pose difference; it is a boundary sweeping along arc
length. The model does not describe our primary event.

---

## 10 · Adobe Animate, and Origami Studio

`ref-14-adobe-animate-frame-by-frame` · `ref-17-origami-animations`

**Adobe Animate** — the weakest ref on the board, and the reason is worth
recording: the pages I actually wanted, `frame-frame-animation.html` and
`onion-skinning.html`, are both **404**. The fallback covers *"Types of
animation"* and tweening. The one thing it does establish is the vocabulary split
an animator uses — frame-by-frame versus tweened — which is the same split Dreams
draws between drawing on the flipbook and keyframing a track, and which Free
Stroke has no version of at all, because we have no notion of a *frame*.

**Origami Studio** describes its animation patches as
*"animate on patches or properties that are assigned to be fluid and reversible;
they take any changing variable and 'return it' to be smooth"*, with **Pop
Animation** (spring), **Classic Animation** (traditional easing curves) and
**Repeating Animation**. Its framing is worth one sentence: an animation is a
*filter on a value*, not a timeline entry. That is another vote for direction B —
the same value is being smoothed, whatever caused it to change.

---

## 11 · The films — six tools driven, watched frame by frame

Six clips downloaded at ≤720p with `yt-dlp`, each covered end to end by dense
contact sheets (`fps` chosen so the whole clip fits), plus full-resolution stills
of the frames where the UI is legible — because at a 260 px tile the parameter
names are not readable and *"guessing a video's content = a failed study"*.
Files: `docs/verification/anim-map/vids/<slug>/` — `.mp4`, `.info.json`, `.txt`,
`contact/dense-NN.png`, `contact/key-<t>s.png`.

| slug | what it is | duration | sheets |
|---|---|---|---|
| `procreate-dreams` | Procreate, official — *Intro to Procreate Dreams 2* | 13:24 | 6 @ 1.667 s/tile |
| `procreate-dreams-walkthrough` | angrymikko — full walkthrough (top-down screen capture) | 19:00 | 5 @ 2.381 s/tile |
| `ae-trim-paths` | MotionXP — *Tap into the FULL POWER of trim paths* | 29:26 | 5 @ 4 s + 3 dense @ 0.5 s |
| `blender-gp-build` | 25games — Build modifier, mesh **and** Grease Pencil | 7:10 | 5 @ 1 s + 3 dense @ 0.5 s |
| `rive-state-machine` | Rive, official — *Rive 101 State Machine Overview* | 2:39 | 4 @ 0.5 s/tile |
| `cavalry-strokes` | Cavalry, official — *Adding and animating Strokes* | 1:20 | 5 @ 0.2 s/tile |

Tile → timestamp: `t = ((sheet−1)·96 + (row−1)·8 + col − 1) × secs_per_tile`
(all sheets are `tile=8x12`).

**Three frames I opened and read myself.** Each claim below names what is on
screen, not what the video is about.

### `blender-gp-build/contact/key-395s.png` — **the finding that decides the architecture**

Blender 2.90.1, file `GreasePencil-BuildModifier.blend`, 2D Animation workspace.
A bearded character built from GP layers `Lines / Brille / Hair / Skin / Sketch`.
Right panel: **Onion Skinning** — Mode `Keyframes`, Opacity `0.500`, Keyframes
Before/After `1`. And at the bottom, the **Dope Sheet**:

```
Summary
▾ Stroke
  ▾ StrokeAction.001
      Factor (B…)   0.000       ◆ frame 1 ................. ◆ frame ~220
```

**The Build modifier's `Factor` is itself keyframed on a timeline.** So Blender's
answer to "modifier or keyframe?" is **both, with a clean split**: the *modifier*
owns the rule — order, mode, transition, fade, alignment — and **one keyframed
scalar owns when**. Two keys, on one channel, for a whole word building in.

That is the architecture, confirmed by a shipping tool, in a frame on disk. It is
also exactly what Free Stroke's engine wants, because the reveal is already driven
by one scalar (`playheadRef`) that everything downstream reads.

⚠ **Stated honestly:** I did not find a frame in this clip where the
Sequential/Concurrent dropdown is unambiguously readable — the GP section
(t ≈ 305–412 s) demonstrates the build *result* and the Factor keys, not the mode
enum. The Mode/Transition/Timing parameter reads in §1 come from the saved
documentation text (`ref-08`), not from this video. Also: **t = 0–304 s of this
clip is the Build modifier on 3D meshes, not Grease Pencil** — judged from the
frames, not from the title.

### `ae-trim-paths/contact/key-200s.png` — the toggle, legible

After Effects 2022, comp *Basic Trim Paths*. The layer tree reads, in full:

```
Circle ▾ Contents ▾ Ellipse 1
                    Trim Paths 1
                       Start                  0,0 %
                       End                   88,2 %
                       Offset             0x +0,0 °
                    Trim Multiple Shapes:  Simultaneously ▾
```

The viewer shows the ring open by about 12 % at the top-left and the bar below it
fully drawn. Three things I can only say because I looked:

- **Trim Paths is a modifier under the shape's `Contents`**, in an ordered stack
  with the fills and strokes — not a property of the stroke. Same architectural
  position as Lottie's `'tm'` and Cavalry's behaviours.
- **`Offset` is in DEGREES** (`0x +0,0°`), not in length or percent. The trim
  window is parametrised as a rotation around the path, which is why it wraps
  cleanly and why "offset" and "start" are genuinely different controls. I would
  have specified this wrong from the documentation alone.
- The multi-shape enum sits *beside* the three numbers, at the same level — it is
  a peer of Start/End/Offset, not a hidden preference.

### `cavalry-strokes/contact/key-45s.png` — the whole reveal API in five rows

Cavalry, scene `Jungle.cv`, Attribute Editor → **Stroke** tab for `PolygonShape 1`:

```
Width 11.300 · Cap Style Flat · Join Style Miter · Miter Limit 10.000
Dash Pattern [Dash, Gap (e.g. "4, 2")] · Dash Offset 0.000 · Align Center
Trim          ✓
Start        27.000 %
End          64.000 %
Travel       18.900
Reverse Path □
```

and the viewport shows a duplicator of rings, **each one rendered as a partial
arc**. So the complete reveal API of a serious motion tool is **five controls**:
on/off, start, end, travel, reverse. Cavalry splits AE's degree-valued `Offset`
into an explicit **`Travel`**, and `Reverse Path` is the per-shape drawing
direction that Lottie serialises as `d`.

**Free Stroke has one of those five** — a single `progress`, which is `End`.

The Scene Window in the same frame shows how the behaviours attach:

```
▾ Polygon Duplicator
    Value 1 [Shape Visibility]
      Falloff 1 [Value 1 [Shape Visibility]]
    Random 2 [Shape Rotation]
  Index To Color 1
▾ PolygonShape 1
    Random 3 [Radius]
    Random 1 [Sides]
```

Behaviours bind to a **named attribute** (`[Shape Rotation]`, `[Radius]`,
`[Sides]`) and **nest** — `Falloff` modifies `Value`, which drives Shape
Visibility. That is a modifier stack with a target, which is a more precise shape
than "a list of effects".

### `procreate-dreams/contact/key-542s.png` — what item 35 should look like

An iPad on a desk, Apple Pencil in hand. A floating three-way pill at the bottom
centre reads **Compose · Perform · Keyframe** with **Perform** active and a red
record dot. Above it, three timeline tracks: each is a **fat content band** (tall
enough to carry thumbnails) with a **thin keyframe row of red dots directly
beneath it**. A playhead crosses all three. The burned-in caption reads *"but
it'll also express flowing, natural animated"*.

Two design facts I would not take from prose:

- **The mode switch is a floating pill, not a toolbar.** Three words, centred,
  thumb-height, over the timeline it modifies.
- **The hierarchy is fat content / thin keys.** The thing you look at is the
  content; the keys are a subordinate strip. A timeline of equal-weight rows —
  which is what a desktop NLE gives you — is not what this is.

*(Frames read from the other three clips: `procreate-dreams-walkthrough` sheet-03
r9–r12 carries a **"PERFORMANCE MODE"** card at ≈612 s followed by a caption
"RECORDING IS ONLY ACTIVE WHEN YOU PERFORM AN ACTION IN REAL TIME", and sheet-04
r7–r8 a "FRAME BY FRAME ANIMATION" card at ≈830 s;
`rive-state-machine/contact/key-133s.png` shows the state graph with
`Entry → Timeline 1` plus `Any State` and `Exit` nodes, and side-tabs
**Inputs** / **Listeners**.)*

**Two capture notes for whoever films next**, because they cost this pass real
time: `/Users/sebs/Library/Python/3.9/bin/yt-dlp` (v2025.10.14) is **broken for
YouTube** — every player client fails except `android`, which caps at 360p. Use
`/opt/homebrew/bin/yt-dlp` (v2026.07.04), which delivers 720p. And this ffmpeg
build (8.1.1) has **no `drawtext` filter**, so contact sheets carry no burned-in
timestamps — hence the tile→timestamp formula above.

---

## What we take, and what we refuse

**Take:**

| from | what |
|---|---|
| Blender Build | the whole parameter model for a stroke draw-in — Mode, Transition, Timing, Time Alignment, Delay, Fade — **and the split**: the modifier owns the rule, one keyframed scalar (`Factor`) owns when |
| AE Trim Paths | Start / End / **Offset** — the reveal as a window with a phase; and *Simultaneously vs Individually* as the first-class binary |
| GSAP / anime.js | the window again, independently, and the two-number `"start end"` representation as the value type |
| Cavalry Stroke tab | the complete reveal API in five rows — **on · Start · End · Travel · Reverse Path** — read off `key-45s.png`. We have one of the five. |
| Cavalry Stagger | the stagger as a **curve over stroke index**, not a constant |
| Cavalry Visibility Sequence | **Always On / Always Off id lists** — the escape hatch a rule-based system needs |
| Cavalry Scene Window | behaviours bind to a **named attribute** and **nest** (`Falloff → Value → Shape Visibility`) — a stack with a target, not a list of effects |
| Procreate Dreams | **one model, three modes**; performance → keyframes; Motion Filtering; collapse-and-expand tracks; easing set per track or per gap, by touch, with no graph |
| Dreams, by eye | the mode switch is a **floating three-word pill**, thumb-height, over the timeline; and the hierarchy is **fat content band / thin key strip**, never equal-weight rows |
| Rive | **Hold** as a first-class interpolation; a transition carries a duration; a curve is a copyable value |
| Lottie | a draw-in serialises as a small modifier object; drawing **direction** is per-shape data |
| Figma | states, not curves — and identity that is real rather than heuristic |

**Refuse:**

- **A graph editor.** Rive, Dreams, Figma and Origami between them show four ways
  to author timing without one, and it is the loudest "professional animation
  tool" signal available on a product whose pitch is that it is not one. (Rive and
  Dreams both *offer* one and both make it optional and secondary.)
- **A node graph.** Cavalry's mechanisms are excellent and its interface is the
  furthest thing from item 35's iOS direction on this board.
- **Anything built on the dash trick.** It buys a 0.417 pen score and throws away
  the nib we spent a week measuring.
- **A state machine.** A mark on a page has no states.
- **Frames.** Free Stroke has no frame model and should not acquire one to
  imitate a 2D animation package; our time is continuous and our export already
  plans frames from it.
