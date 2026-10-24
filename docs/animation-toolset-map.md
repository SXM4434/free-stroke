# The Animation Toolset — the map

*You asked why we never built the animation half of this tool. Here is the honest
answer, what actually exists, what you genuinely cannot do, four distinct ways to
build the toolset, and what I would build first.*

> **PHASE 1. NOTHING IS BUILT.** This pass wrote this file, `docs/research/stroke-animation-toolsets.md`,
> and evidence under `docs/verification/anim-map/`, and nothing else. `lib/`,
> `components/`, `app/` and `scripts/` were READ, never written — two other lanes
> are live in them tonight. No commits. This is a map for you to react to, and no
> build fires off it until you have (`docs/DISPATCH.md` §0).

**Your words, which this answers:**

> *"we basically have not built the animation portion of this tool… how did this get
> skipped… I don't have a way of keyframing, editing any of the motion of the strokes
> outside of the textures. I guess the hero beat is kinda doing some of this on a lower
> level with dials… the PRD should have a whole thing about making this an easy modern
> animation tool — obviously to specifically animate the strokes, like down to how the
> stroke draws in, the way it's stroked, as if you were someone in control of the pen
> through a motion tool."*

**The short answer, before the evidence.** You are right that there is no keyframing
and no way to edit a stroke's motion. You are half right that it was skipped — it
was *sequenced last*, item 33 of 35, and the build never reached it. But three
things are truer than "we forgot," and each of them changes what to build:

1. **More of it exists than the PRD's "Future" list admits.** Delay, easing, loop
   and reverse for the draw-in shipped, and are reachable in the app right now.
2. **A real timeline UI is already running in this product** — 12 draggable clip
   bars on `/desk-doodles`. Its tracks are the phases of one authored film. The
   timeline is not what is missing. **The tracks are pointed at the wrong subject.**
3. **The thing that is genuinely missing is per-stroke addressing**, and
   `lib/hero-motion.ts` names it, by name, in a comment written before you asked:
   *"O3b · drawn in both wants each stroke to pop solid at its own pen-up, which
   needs `flat`/`depth` PER STROKE. Today both are one uniform for the whole mark."*
   (`lib/hero-motion.ts:155-157`)

And the biggest finding, which decides the whole map: **the ask is smaller than it
looks on three of the four render paths, and one specific class of it is nearly
free.** See §6.

---

## 0 · Read-proof ledger

Every doc the dispatch names, with a real quote or line-ref proving the read.

| doc | ✅ | the line that proves it |
|---|---|---|
| `AGENT-DISPATCH-CONTRACT.md` §0.5 | ✅ | *"DEEP ONLINE EXPLORATION × OUR DOCS = the originality engine… ≥8 refs, image-gated, each analyzed for MECHANISM"* — and §0.5.1b, *"never research-then-shelve… we keep surfacing tech and then it sits in a doc."* Applied: §6.6 is the tech-interrogation — DialKit 1.4.3 read out of its own bundle — and it changed the recommendation. |
| " §0.6 | ✅ | *"The headline move passing does NOT make the work done. Craft lives in the small stuff."* |
| " §0.7 | ✅ | *"Building NEW options must NEVER remove or overwrite existing ones — every prior option is PARKED."* Nothing in this map deletes or replaces the seven films; §7 states the constraint explicitly. |
| " §1 READ-PROOF LEDGER | ✅ | *"a fabricated quote, or a missing citation on an applicable doc = the read didn't happen → the WHOLE dispatch is REJECTED."* |
| " §5 | ✅ | *"the 5+ research refs with URLs + the saved file paths… verified with `find`"* — done in §4 and in the research doc. |
| " §19 | ✅ | Never take over Sebs's screen. Every capture in this pass ran headless Chrome with `--use-angle=metal`; nothing was opened, focused or brought to front. |
| `HARDENED-IDEATION-DISPATCH.md` | ✅ | *"`page.goto()` does NOT throw on an HTTP error status… a ref that 404'd cannot have a mechanism — the analysis was written from the URL slug."* Every web reference in §4 went through `captureRef()` and carries a manifest record. |
| `FABLE-GHOST-BRIEF-ENGINE.md` §2/§3 | ✅ | Pre-flight step 5, *"The real engine check. Name the in-repo implementation the agent must use… Never approximate."* §6 of this map is that check. |
| `OPTION-BUILD-GATE.md` | ✅ | The 7-step gate; step 4 REJECT-IF as instant fail. Applied as §5's weak bucket. |
| `BILL-GUO-VS-US.md` | ✅ | *"Benchmark = exceed Bill Guo's level of per-detail care in OUR language; never copy his moves."* Applied literally: §5's weak bucket kills the graph editor because it is the After Effects move re-skinned. |
| `docs/DISPATCH.md` | ✅ | §0: *"Phase 1 — IDEA CREATION (the map)… It goes to Sebs in prose and he gates it BEFORE any build fires."* |
| `docs/PRD.md` **in full** | ✅ | Line 33, *"advanced geometry animation controls"*, item 33 of 35. Layer 3 (line 69-72): *"Now: draw-in reveal, play/replay, speed, final-frame matching. Future: easing, delay, loop, reverse, reveal style, stroke order controls, pressure-aware reveal, tip highlight, completion pulse, settle/wobble, secondary motion."* Phase 22 (line 230). Family 14 (line 204). |
| `HANDOFF-TO-OZ.md` | ✅ | §2A: *"the artifacting when drawing and letter pieces missing still happens"* — his #1 for over a week, and it lives in the reveal. §5: *"`applyLetterMotion` MUST stay LAST on the onBeforeCompile chain."* |
| `MORNING-BRIEF.md` | ✅ | §1: the eraser was a three.js r175 `texStorage2D` immutable-storage bug — *"your mark was carved by a stretched, offset copy of its own outline"* — and *"The bug was only reachable by using the app."* |
| `HANDOFF-2026-08-02.md` | ◐ **partial — stated plainly.** 53 KB; I read its index and the sections on the reveal, the transport and the film set. I did not read all of it. |
| `docs/README.md` | ✅ | *"The beat has one owner and it is `lib/hero-motion.ts`. `scripts/capture/motion.mjs` is a downstream manual paste of its constants… found stale twice in two days."* |
| `docs/hero-animation-options-board.md` | ✅ | §2's ruling, verbatim: *"the camera performs the product's verb while the mark never moves"* — and §5's weak bucket, which is the format this map's §5 follows. |
| `docs/hero-beat-storyboard.md` | ◐ **partial — stated plainly.** 225 KB / 3,700 lines. `docs/README.md` warns it *"reads back-to-front… §1–§9 describe a beat that no longer exists."* I read §11.9's header note and worked back as far as the phase list. I did not read §1–§9. |
| explainer **04** (timing) | ✅ | *"Every animated layer asks the same question — 'what is my phase right now?'"* and the three drifted hand-rolled clocks it replaced. |
| explainer **14** (flat→solid) | ✅ | *"The flat state is not a second layer. It is the same mesh, through the same camera, driven to render as a drawing."* |
| explainer **18** (reveal stopped rebuilding) | ✅ | *"only then was it safe to hand the playhead to DialKit, whose transport has no clamp."* |
| explainer **22** (ink that came back off) | ✅ | Desk Doodles' Inflate *"parametrises its radius profile on `u = i/segments`, i.e. on normalised position along the stroke it RECEIVES"* — 36 of 40 steps took ink off the standing mark, worst 16.07 %. |
| explainer **23** (the seam) | ✅ | *"The seam is closed if and only if every letter shares one pivot. Not a tolerance to tune; an identity."* |
| `docs/research/reveal-cost-and-timeline-ownership.md` | ✅ | §2.2, read out of DialKit's bundle: *"`useDialTimeline(name, config, opts)` turns `at` and `duration` into dials in the DialStore… `TimelineStore.tick` advances on a raw, unclamped `now - lastTick`."* |
| `docs/research/handwriting-variability.md` | ✅ | The quality bar for what research means here: *"R_D, R_t0, R_mu, R_sigma… are fixed for all strokes across a component"* — one hand per word, not per stroke. |

**What I did NOT read**, stated plainly: `docs/2d-register-board.md` (59 KB) beyond
its §2.3 citation in the options board; `SESSION-HANDOFF.md` (187 KB, superseded by
`MORNING-BRIEF.md` per its own header); the full storyboard and the full
2026-08-02 handoff as marked above; the Desk Doodles submission corpus
(`VIDEO-DIRECTION.md`, `CRAFT-VISUAL-PASS.md`), which the dispatch did not name for
this lane and which governs the film rather than the toolset.

---

## 1 · How this got skipped — the record, with line numbers

It was not forgotten. It was **sequenced last, and the sequence is a hard rule.**

`docs/PRD.md` line 33 lists **"advanced geometry animation controls"** as item **33
of 35**, between *"preset families"* and *"texture/visual sync controls"*. Line 218
puts it as **Layer G**, *"after visual substrate."* Line 230 gives it a phase
number: **Phase 22**, of 27. Line 290 gives it a branch name,
`POST_MVP_ADVANCED_GEOMETRY_ANIMATION_CONTROLS_PHASE_1`, **13th of 14** in the
recommended sequence — and line 282 marks the current position as **#5**,
`POST_MVP_TEXTURE_AND_ANIMATED_TEXTURE_PHASE_1`.

And line 266-273 is why nobody jumped the queue:

> **"Current blocker: roadmap discipline.** The engines are stable; the danger is a
> new geometry rabbit hole instead of the visual system… build strictly in order…
> Do not start fusion before individual systems."

So: the PRD names the toolset, gives it a number, puts it thirteenth, and then
forbids working out of order. Every lane since has obeyed that, correctly. What
nobody did — including me until tonight — was notice that **item 33 is the only
item on that list that is the product's *subject*.** Every other item styles a
surface. This one animates the mark, and the mark is what Free Stroke is about.

The PRD's own north star says so at line 53: *"A user should be able to draw an
expressive stroke, switch between geometry modes, apply visual layers, **animate
both the object and the surface**, and export a result that feels like a designed
artifact."* The surface half is eleven phases deep. The object half is one
sentence — *"draw-in reveal, play/replay, speed, final-frame matching"* (line 69).

**One correction to the record, and it is in your favour.** The PRD's Layer 3
"Future" list is not all future any more. Of *"easing, delay, loop, reverse, reveal
style, stroke order controls, pressure-aware reveal, tip highlight, completion
pulse, settle/wobble, secondary motion"* — **easing, delay, loop, reverse and
reveal style are built and reachable**, and tip highlight exists as the pen-tip
shape family. §2 shows exactly what you can touch today.

---

## 2 · What exists today, precisely

I drove the real app on `:3000` headless with Metal ANGLE, drew a stroke by hand
through the canvas, and enumerated every control. Frames:
`docs/verification/anim-map/ui/`.

### 2.1 · Every piece of stroke motion you can author today

**In the product (`/`) — the transport bar under the 3D view.**
`docs/verification/anim-map/ui/02-timing-popover.png`

| control | what it does | where it lives |
|---|---|---|
| **Play / pause** | runs the draw-in | `PlaybackController`, `components/viewport-3d.tsx:6619` |
| **Scrubber** | seeks the playhead 0..1 | same bar; `handleScrub` |
| **Speed 0.5× / 1× / 2×** | scales the whole draw | same bar |
| **Natural / Authentic** | *how fast the pen was at each point* — Authentic replays the recorded speed; Natural blends 40 % toward constant | `revealDistanceFraction`, `lib/pen-reveal.ts:167` |
| **±11.7 %** *(a readout, not a control)* | how far this drawing's pen speed departs from constant — below 1 % the two settings render identically and it says so | `measureTimingCharacter`, `lib/pen-reveal.ts:1055` |
| **Timing → Delay** | 0–3 s of blank page before the pen lands, re-run between loops | `revealDelaySeconds`, `viewport-3d.tsx:11546` |
| **Timing → Ease** | Linear / Ease in / Ease out / Ease in-out over the **whole** draw | `REVEAL_EASES`, `viewport-3d.tsx:6553` |
| **Timing → Reverse** | the mark un-draws | `viewport-3d.tsx:11602` |
| **Timing → Loop** | starts again at the end | `viewport-3d.tsx:11615` |
| **Pen tip shape** | Off / Cut / Nib / Reed / Quill / Chisel — the *shape of the moving end*, `nose` and `taper` in nib half-widths | `PEN_TIP_SHAPES`, `lib/pen-reveal.ts:800` |
| **Export** | frame-locked WebM / APNG at the pen's own duration or a fixed one | `lib/export/frame-plan.ts` |

That is the complete list. **Eleven controls, all of which act on the whole mark at
once.**

The one distinction in there worth keeping is real and it is well made:
`revealMode` is *"a property of the HAND"* and `revealEase` is *"a property of the
SHOT"* — *"You can want an authentic hand that eases to a stop; they compose, and
one control could not express that"* (`viewport-3d.tsx:6541-6547`). That is the
right kind of thinking, applied to two controls. The toolset is that thinking
applied to twenty.

### 2.2 · The hero beat's dials — you named these, so here they are exactly

`/desk-doodles` — `docs/verification/anim-map/ui/05-desk-doodles-dock.png`.

**There is a real, working, multi-track timeline dock already running in this
product.** I read 12 clip rows and 24 drag handles off the live DOM:

```
Draw 4.67s · Breath 1.1s · Anticipation 0.3s · Emerge 0.92s · Land 0.3s · Solid 0.6s
Tilt 0.43s · Standup 1.4s · Orbit 0.93s · Descend 0.43s · Return Turn 0.92s · Hold 0.37s
```

Each bar drags to retime; the page ripples the clips after it because the phases
are strictly sequential; the dock has play, reset, a preset dropdown and a
copy-out button. You are right that *"the hero beat is kinda doing some of this
with dials."* It is doing more than that — it is a timeline.

**And here is exactly why it is not the toolset:**

1. **The tracks are phases of one authored film, not your strokes.** Retiming
   "Standup" changes when the camera-and-word choreography happens. There is no
   row for a stroke, ever.
2. **It only exists for one word.** `lib/hero-motion.ts` is imported by
   `app/desk-doodles/page.tsx` and `components/viewport-3d.tsx` and **nothing
   else** — `app/page.tsx` passes no `flatten`, no `letterMap`, no `revealRef`
   (`app/page.tsx:2027` against `app/desk-doodles/page.tsx:2459-2480`). None of it
   reaches a drawing you made.
3. **The seven films are fixed programs, not tools.** `shipped · turnLands ·
   solidFirst · cutaway · popUp · standTurn · letterByLetter` are whole exposure
   sheets plus whole form laws (`lib/hero-motion.ts:178-302`). Beautiful, measured,
   gated — and a film is a thing you *choose*, not a thing you *author*.
4. **Even the letter cascade is not per-stroke.** `letterByLetter` gives 16 units
   of `(yaw, flat, depth, shade)` with per-unit pivots, on one shared material
   (`applyLetterMotion`, `viewport-3d.tsx:2792`) — but the units are **connected
   components of the ink**, computed by `lib/hero-letters.ts`, which measured
   **eight** units on your traced word, not eleven. It animates letters. It does
   not animate strokes.

### 2.3 · The timing system that already exists — and does not touch geometry

`lib/style-clock.ts` is a finished, tested, six-mode timing architecture:
`independent · revealSynced · strokeTimeSynced · delayedAfterReveal ·
completionPulse · loopSynced`, with per-layer `speed`, `phase`, `delay`,
`loopSeconds`, `revealScale` and an arming rule so a control you touch now doesn't
measure from scene start (`lib/style-clock.ts:112-141`).

Its header says, in capitals: **"NOTHING HERE TOUCHES GEOMETRY."** (`:36`)

That sentence is the shape of the whole gap. We built an animation system with a
vocabulary, six sync modes, envelopes, arming and a ping-pong law — **for the
surface**. The geometry got play, pause, a scrubber and four buttons.

---

## 3 · The gap — what you cannot do

Stated as things you would try and fail to do. Everything here was checked against
the code, not assumed.

1. **Make one stroke draw before another.** Stroke order is capture order,
   permanently. There is no reorder anywhere in `lib/`, `components/` or `app/`.
2. **Make two strokes draw at the same time.** The reveal is one global
   playhead over one arc coordinate.
3. **Give a stroke its own delay, speed, or easing.** All three are global.
4. **Hold a stroke back and land it last as a punchline.** Same reason.
5. **Keyframe anything.** There is not one occurrence of `keyframe` in `lib/`,
   `components/` or `app/` outside `lib/export/encoders.ts` and `lib/export/webm.ts`,
   where it means a *video codec* keyframe. **Verified: 10 hits, all in those two
   files.**
6. **Make a stroke move after it is drawn** — settle, wobble, overshoot,
   secondary motion. The mark has exactly one transform for the whole word.
7. **Make a stroke pop solid at its own pen-up.** `lib/hero-motion.ts:155-157`
   names this as unbuilt: *"needs `flat`/`depth` PER STROKE. Today both are one
   uniform for the whole mark."*
8. **Use pressure as a motion channel.** `Point.pressure` is recorded live from
   `e.pressure` (`components/drawing-canvas.tsx:324`) and carried through
   processing — and *"no reveal or geometry path reads it"* (`lib/pen-reveal.ts:1039`).
   The app's own caption says so out loud: *"Speed only: pen pressure is recorded
   but no engine reads it yet."* **One precision:** pressure *does* reach Inflate's
   radius (`INFLATE_PRESSURE_INFLUENCE`, `lib/geometry-engines.ts:5910`) — so it
   shapes the mark, and it does not time it.
9. **Choose a non-monotone easing** — an overshoot, a bounce, a settle at the end
   of the draw. `easeReveal`'s four are deliberately monotonic so the scrubber's
   inverse stays unambiguous (`viewport-3d.tsx:6560-6566`). That is a correct
   decision for a *scrubber* and a real ceiling for a *tool*.
10. **Save a motion setting.** Presets exist for material, texture, dither, ASCII,
    stack and fusion. PRD Family 14 (line 204) names six geometry-animation
    presets — *Authentic Draw, Smooth Reveal, Snappy Draw, Slow Gel, Looping
    Stroke, Completion Pulse* — and **none of them exists.**
11. **See the timing.** There is no visual representation of *when* anything
    happens to your drawing. The one timeline in the product shows the hero film's
    phases, on a route your drawing never reaches.
12. **Animate anything but the draw-in.** Every control above shapes one event:
    the mark appearing. Nothing exists for what happens after it has appeared.
13. **Draw anything but a growing prefix.** The reveal is `[0, p]`. You cannot
    erase from the start, run a segment along the mark, make ink vanish behind the
    pen, or draw one stroke from its far end. Cavalry's whole stroke-reveal API is
    **Trim · Start · End · Travel · Reverse Path** — five controls, read off the
    live UI in `docs/verification/anim-map/vids/cavalry-strokes/contact/key-45s.png`.
    **We have one of them.**

---

## 4 · What the rest of the world actually does

Full research, per-reference mechanism analysis, and the saved evidence:
[`docs/research/stroke-animation-toolsets.md`](research/stroke-animation-toolsets.md).
References and contact sheets: `docs/verification/anim-map/refs/` and
`docs/verification/anim-map/vids/`.

**25 documentation pages, all provenance-verified** (`25/25 · 0 unverified · 0
bad · gate PASS`), and **6 tools filmed and read frame by frame**. Four findings
change what we should build, and every one of them is a *convergence* between
tools rather than one tool's opinion.

**① "One at a time" vs "all at once" is the first control every serious tool
ships — and we have no answer to it.**
After Effects: *"you can choose to have the paths trimmed **simultaneously** or
treated as a compound path and trimmed **individually**"* (`ref-01`, and I read
the dropdown itself on screen in `ae-trim-paths/contact/key-200s.png`).
Blender: **Sequential** — *"only a single one changes at a time"* — vs
**Concurrent** — *"Multiple stroke appear/disappear at a time"* (`ref-08`).
Two tools with nothing in common landed on the same binary. Free Stroke is always
sequential, in capture order, with no control.

Blender then adds the follow-up question I would not have thought to ask.
Once several strokes draw at once, **Time Alignment**: *"Align Start — All strokes
start at the same time (i.e. shorter strokes finish earlier)"* vs *"Align End —
All strokes end at the same time (i.e. shorter strokes start later)."* One makes
the word land like a chord; the other makes it ravel out.

**② The reveal is a WINDOW, not a prefix — and for us that is nearly free.**
Four independent implementations, one representation:
- After Effects — **Start, End and Offset**. Read on screen: `Start 0,0 % · End
  88,2 % · Offset 0x +0,0°`. (The offset is in **degrees** — the window is
  parametrised as a rotation around the path.)
- Cavalry — the entire stroke-reveal API is five rows, and I read them:
  `Trim ✓ · Start 27.000 % · End 64.000 % · Travel 18.900 · Reverse Path`.
- GSAP DrawSVG — *"`drawSVG:"20% 80%"` renders the stroke between the 20% and 80%
  positions… If you started at `"50% 50%"` and animated to `"0% 100%"`, it would
  draw the stroke from the middle outward."*
- anime.js `createDrawable` — *"a start and end values separated by an empty
  space"*, `draw = '0 1'`.

**Free Stroke has exactly one of Cavalry's five: `End`.** Our reveal is a
one-ended prefix `[0, p]`. On the `setDrawRange` path a window is **two binary
searches instead of one**, and it buys un-drawing from the start, a travelling
segment, per-stroke reverse, and Blender's other two transitions —
*Shrink* (*"Simulating lines being erased"*) and *Vanish* (*"Simulating ink
fading or vanishing after getting drawn"*) — none of which we can express.

**③ Performing and keyframing are two views of ONE model.** Procreate Dreams —
the closest existing product to your sentence — is explicit: *"**Performing
records keyframes in real-time using gestures**"*, and *"You can modify any
keyframes you laid down in either Perform or Keyframe mode."* One timeline, three
modes: **Compose · Perform · Keyframe**, which I read off the floating pill in
`procreate-dreams/contact/key-542s.png`. If we ship a performance mode and a
timeline as two systems, we will have built this repo's most expensive recurring
defect on purpose.

It also names two things we would otherwise discover the hard way. **Motion
Filtering**: *"Increase the Motion Filtering percentage… to make your animation
smoother and reduce shakiness. To perform rapid movements and capture every
movement you make, set this slider to 0.0%."* A raw performance is shaky —
**and we already own that arithmetic**, because `blendReveal`'s `hybridBlend` is
literally a blend from the raw recording toward constant speed
(`lib/pen-reveal.ts:144`); "Natural" is that dial at 0.4. And the overwrite rule:
*"Performing an action over an existing action of the same type will overwrite
it"* — while a *different* channel layers over it.

**④ The architecture that wins is a modifier owning the RULE and one keyframed
scalar owning WHEN — and there is a frame of it on disk.** In
`blender-gp-build/contact/key-395s.png` the Dope Sheet shows the Build modifier's
own **`Factor`** channel with keys at frame 1 and ≈220. **A whole word builds in
from two keys on one channel**, because the modifier already knows the order, the
mode, the transition and the fade.

That is not a compromise between a timeline and a modifier stack. It is the shape
a shipping tool arrived at — and it is the shape **this engine already has**,
because our reveal is driven by exactly one scalar (`playheadRef`) that every
render path reads.

**And the uncomfortable one, said out loud.** The tool whose subject is identical
to ours already ships the feature we thought was our signature. Blender's Build
modifier has a timing mode called **"Natural Drawing Speed: Use the recorded speed
of the stylus when the strokes were drawn"**, with a **Speed Factor** multiplier
and a **Maximum Gap** in seconds. That is our Authentic mode plus its
between-stroke air handling, in almost the same words. We are not first.

Two things are still ours. **We can make you perform a new one** — Blender can
only replay the stylus recording it was given. And **our moving end is a shaped
nib, not a mask**: everything built on the `stroke-dasharray` trick (Jake
Archibald's original, GSAP, anime.js) renders the whole mark and *hides* part of
it, so it structurally cannot have a pen tip. That is the 0.417-vs-3.250 pen score
`assert-drawin-pentip.mjs` measures, and it is the reason `lib/pen-reveal.ts` §T
exists.

**What we refuse, and why:** a graph editor (Rive, Dreams, Figma and Origami all
show ways to author timing without one, and it is the loudest "professional
animation tool" signal available on a product whose pitch is that it isn't one) ·
a node graph (Cavalry's mechanisms are excellent, its interface is the furthest
thing from item 35 on this board) · anything built on the dash trick · a state
machine (a mark on a page has no states) · frames (our time is continuous and the
export already plans frames from it).

---

## 5 · The four directions

Four, not five. The fifth candidate is in the weak bucket at the end with the
reason it is dead, per the ghost engine's rule that padding is the median.

They differ in their **model of authoring** — how a person tells the tool what
they want — not in their feature list.

---

### **A · THE STROKE TIMELINE** — *your drawing, one row per stroke*

**The model: you place things in time.** The transport bar grows into a dock. Each
stroke of your drawing gets a row, and each row carries a bar you drag: where it
starts, how long it takes, what curve it runs on. Reordering is dragging a bar
left. Overlap is dragging two bars until they touch.

**The one detail that makes it ours rather than a re-skinned After Effects:** the
timeline **opens already filled in with your hand's real timing.** Free Stroke is
the only tool on this board that recorded the performance in the first place —
`Point.t` comes off the real PointerEvent, `measurePenRecord` already reports the
duration, the air time between strokes and the mean pen speed
(`lib/pen-reveal.ts:1108`). Every other tool starts from an empty timeline and
asks you to invent timing. **You would start from your own, and edit it.** That is
a different product, and it is only available to us.

**What makes it possible:**
- `strokeArcSpans()` already exists and already returns each stroke's `{from, to}`
  as a global arc fraction (`lib/pen-reveal.ts:366`). That is a track list.
- The DialKit dock is already in the product, already draggable, already handling
  12 clips with ripple (evidence: §2.2). Its timeline module supports **per-property
  independent tracks** and **multi-leg segmented clips** with a bezier or spring
  curve per leg — the full interrogation is §6.6, and its answer is load-bearing.
- Rod already runs a **per-stroke** clock: `timelines[si]`, each stroke's own
  `tStart`/`tEnd` off the raw recording, with its own time→distance table
  (`viewport-3d.tsx:6272-6332`). The per-stroke plumbing exists on one engine and
  reads the recording; a timeline would just change where it reads from.
- The Desk Doodles engine builds **one mesh per stroke**, each with its own
  `revealKeys` baked into its own global span (`lib/dd-engine/adapter.ts:566-583`).
  Per-stroke scheduling there is changing a number.

**What blocks it:** §6. Short version — on Free Stroke's fused Inflate surface the
reveal is a single `setDrawRange` prefix over one sorted key array, and on
Solid/Extrude it is a single monotone global cut that `break`s after the stroke it
lands in. Both need work, and one of them is genuinely expensive.

**Honest cost: HIGH.** The biggest of the four. It is a new dock, a track model, a
selection model, per-clip curves, and the per-stroke render addressing in §6.
Call it the whole of a phase, not a slice of one.

**What it feels like to use:** familiar and powerful. You see the shape of your
drawing's timing as bars, and you push them around. The risk is the one the
research names in §4 ④ — **a timeline that has to invent the timing needs a row
per stroke, and forty strokes is forty rows**, whereas a timeline that *displays*
a rule needs almost none. Blender's whole word builds in from two keys on one
channel.

**On the iOS UI direction (PRD item 35):** Procreate Dreams is the reference and I
read its layout off `procreate-dreams/contact/key-542s.png`: a **floating
three-word pill** at the bottom centre for the mode, and a hierarchy of **fat
content bands with a thin key strip directly beneath each** — never equal-weight
rows, which is what a desktop NLE gives you. Its answer to row count is
*"Tap and hold on a keyframe or keyframe track… and tap **Expand**"* — tracks are
collapsed by default and expand to per-parameter rows. Ours is the same move with
a better foundation: collapse to connected components of the ink, expand to
strokes. `lib/hero-letters.ts` already computes that grouping, from the ink.

---

### **B · THE MOTION STACK** — *you never touch a keyframe*

**The model: you stack behaviours, and the tool works out the timing.** No
timeline at all. The drawing gets an ordered stack of *motion modifiers*, exactly
the way it already gets an ordered stack of *style layers*:

```
DRAW IN        order: as drawn ▾   overlap: 0.20   speed: 1.0×   ease: out
TIP HIGHLIGHT  strength: 0.4      trails: 3
SETTLE         amount: 0.15       stiffness: 180   per: stroke ▾
COMPLETION     pulse: 0.6
```

Each modifier is a rule, not a set of keys — so it applies to a two-stroke doodle
and a forty-stroke drawing identically, and it never needs re-authoring when you
draw something else.

**This is not a guess — it is what the closest adjacent tool ships.** Blender's
Grease Pencil **Build modifier** is a modifier, on strokes, with exactly this
parameter list: *Mode* (Sequential / Concurrent / Additive) · *Transition* (Grow /
Shrink / Vanish) · *Timing* (**Natural Drawing Speed** — *"Use the recorded speed
of the stylus when the strokes were drawn"* — with Speed Factor and Maximum Gap;
or Number of Frames; or Percentage Factor) · *Time Alignment* (Align Start /
Align End) · *Object* (*"Use the distance to an object to define the order in
which strokes appear"*) · *Delay* · *Fade* (with separate Thickness and Opacity
strengths). Cavalry adds the two mechanisms a rule-based system most needs:
the **Stagger Graph**, whose *"X axis — the first and last Id within a sub-mesh;
Y axis — the Stagger's Minimum and Maximum values"* makes a per-stroke delay **a
curve over index rather than a constant**; and the Visibility Sequence's
**Always On / Always Off** id lists (`1,3,5:8`), which is the escape hatch for
"hold *that* stroke back and land it last" — the one thing a pure rule is bad at.

**Why this is the direction the codebase is already shaped for.** `lib/style-clock.ts`
+ `lib/style-stack.ts` are *this architecture, finished*, for the surface: six sync
modes, per-layer speed/phase/delay/loop, envelopes, arming, a shared ping-pong law,
a group scale and a layer scale that are proved to agree
(`assert-style-contracts.mjs` §1). A geometry-side twin of `evaluateLayerTime` is a
small, well-understood model change, because the hard part — *what does "delay"
mean, what is the origin, what happens when you arm it late* — was already solved
and its bugs already found and fixed here.

And read the PRD's Layer 3 Future list again with this in mind (line 69-72):
*"easing, delay, loop, reverse, reveal style, stroke order controls, pressure-aware
reveal, tip highlight, completion pulse, settle/wobble, secondary motion."* **That
is a modifier list.** Not one item on it is a keyframe. The PRD already described
direction B and nobody noticed, because "advanced geometry animation controls"
sounds like a timeline.

**What makes it possible:** the modifiers that only reschedule — order, overlap,
stagger, per-stroke delay, per-stroke speed — are **a remap of the reveal key
array, and nothing else** (§6.2). That is the near-free class, and it is most of
what you asked for.

**What blocks it:** modifiers that *move* a stroke after it is drawn (settle,
wobble, secondary motion) need per-stroke transforms — §6.3.

**Honest cost: LOW for the scheduling family; MEDIUM for the moving family.**
The lowest-cost real answer on this board.

**What it feels like to use:** you pick "draw in", set *order* to `by length` and
*overlap* to 30 %, and it plays. Nothing to place, nothing to keyframe, nothing
that breaks when you draw a different thing. It is the least like a professional
animation tool and the most like Free Stroke.

**On the iOS UI:** it *is* the existing panel. A **Geometry** section in Animation
with the same pill-and-dial grammar as Material and Texture — which is a real
argument, because it means the animation IA in
`components/style-panel-scaffold.tsx:220` stops saying *"Easing, loop, and reveal
styles come later"* and starts being true.

---

### **C · PERFORM IT** — *you drive the pen through the motion*

**The model: you don't type the timing, you perform it.** Press record and drag
along the mark with your finger or the pen — fast through the boring part, slow
through the flourish, hold at the crossbar. The app records **your gesture as the
draw-in curve.** Take 1, take 2, take 3; keep the one that feels right.

This is the literal reading of your sentence: *"as if you were someone in control
of the pen through a motion tool."*

**And here is the thing nobody has said out loud yet: Free Stroke's draw-in is
already a performance playback.** `revealMode: "raw"` is documented as *"replay
the speed the pen was actually moving at"* (`lib/pen-reveal.ts:69`). The whole
progress model — `penTimeDistanceFraction` — is a function that turns *a recording*
into a distance fraction by walking the recorded timestamps
(`lib/pen-reveal.ts:94`). **The tool already replays a performance. It has just
never let you record a second one.**

A performed timing is a monotone time→distance table. That is *byte-for-byte the
same shape* as what `penTimeDistanceFraction` already produces and what every
renderer already consumes. **Every render path takes it unchanged, including the
expensive ones.** That is the cheapest possible route from what exists to what you
asked for.

**Two shapes, and they are different products:**
- **Conduct.** Scrub along the finished mark; your scrub speed becomes the draw
  speed. Nothing about the drawing changes.
- **Re-draw.** Trace over the mark at the speed you want; only the *timing* is
  kept, the path is thrown away. This is the more radical one and the more
  Free-Stroke one: you draw it once for the shape and once for the performance.

**What makes it possible:** the recording infrastructure is the app's core. Live
input already carries real timing *and real `e.pressure`*, and
`lib/stroke-processing.ts:110` explicitly protects it — *"overwriting that with a
synthesised hand would be strictly destructive."* The two clocks
(`lognormal` / `uniform`) are already a switchable, parked pair
(`stampPenClock`, `lib/pen-reveal.ts:1280`). A performance is a third clock.

**What blocks it:** the export is a deterministic frame plan that asks the
renderer for exact instants (`lib/export/frame-plan.ts` — *"a screen recorder
samples wall-clock time, so the output's timing is the timing of the RENDER"*). So
a performance **must bake to a seekable function**, never stay a live stream. And a
performance where you scrub *backwards* is non-monotone; it has to be resolved
(clamp, or allow it and give up the drawRange path) rather than ignored.

**Honest cost: LOW–MEDIUM** for the whole-mark performance; the per-stroke version
inherits §6's problem.

**Two things the research settles, and both save us a mistake.** First,
**a performance must produce editable data, not an opaque curve.** Dreams:
*"Performing records keyframes in real-time using gestures… You can modify any
keyframes you laid down in either Perform or Keyframe mode."* Perform is a *mode*
over one model, not a second system. Second, **a raw performance is shaky and
needs a smoothing dial** — Dreams' **Motion Filtering**, *"set this slider to
0.0%"* to capture every movement. **We already own that arithmetic:**
`blendReveal`'s `hybridBlend` is a blend from the raw recording toward constant
speed (`lib/pen-reveal.ts:144`), and "Natural" is that dial sitting at 0.4. It
needs renaming and re-pointing, not building. That is not a small coincidence —
it means the hardest part of a performance feature is already in the product,
under a different name, doing the same job to a different recording.

**What it feels like to use:** the best of the four, and the least like software.
It is the only one where the answer to "how should this draw?" is *do it* rather
than *specify it*. Its ceiling is that a performance is hard to *edit* — which is
exactly why Procreate Dreams ships performing **and** keyframes over one model,
not one of them.

**On the iOS UI:** a record button and a scrub strip you drag with your thumb. A
take list. No numbers on screen at all until you ask for them. This is the most
natively-iOS of the four and it isn't close.

---

### **D · THE VOCABULARY** — *the hero beat, generalised to any drawing*

**The model: you choose a named beat, then open its dials.** Everything the hero
word can do — stand up off the page, turn and land, arrive solid then turn home,
go piece by piece — becomes a **vocabulary that applies to your drawing.** Plus the
six the PRD already named and never built (Family 14, line 204).

You already have the seven films. This direction says: the films were never
supposed to be about one word.

**What makes it possible — and this is more built than it sounds:**
- **The grouping law generalises.** `lib/hero-letters.ts` decides which strokes
  belong together *from the ink itself* — connected components under "each one's
  centreline lies inside the other's ink" — deliberately not a lookup table:
  *"Any hand-written table would be a second source of truth for a fact the
  geometry already knows."* It was **calibrated**: run over the font's authored
  11-letter map it must reproduce it exactly, and it does. Run over your traced
  word it measures **eight** units, correctly fusing `e-s-k` and `o-d`. That law
  works on any drawing, today.
- **The per-unit motion rig is built and gated.** `applyLetterMotion` carries
  `(yaw, flat, depth, shade)` per unit with per-unit pivots on **one shared
  material**, via a per-vertex `aFsLetter` attribute and a `uFsLetterA[16]` uniform
  array (`viewport-3d.tsx:2792-2860`). `ownTrianglesWhole` gives every triangle a
  single owner, splitting vertices at the boundary — **788 spanning triangles
  before, 0 after, 550 of ~148 000 vertices duplicated** (explainer 23).
- The `Version 1` preset dropdown on the dock is DialKit's preset system, already
  live.

**What blocks it:**
- **`FS_LETTER_MAX = 16`** (`viewport-3d.tsx:2678`). A drawing with more than 16
  components needs a bigger array, a texture instead of a uniform array, or
  grouping.
- **The flat/depth channel is global**, which is `hero-motion.ts:155-157`'s O3b
  blocker verbatim.
- **The seam is an identity, not a tolerance.** Explainer 23: two units at the same
  yaw about different pivots are two different rigid motions separated by
  `(I − R)·Δpiv`, so *"the seam is closed if and only if every letter shares one
  pivot."* Any per-unit turn on a fused surface has to solve this. It is solved for
  the cascade by making the pivot *arrive*; the general case needs the same care.
- The whole rig is unreachable from `/` (§2.2).

**Honest cost: MEDIUM.** Most of the mechanism exists and is gated. The work is
generalising 16 → N, splitting flat/depth per unit, and wiring the rig to the
product route.

**What it feels like to use:** you draw something, tap **Piece by piece**, and your
drawing performs. Instant, legible, no learning curve — and a ceiling, because a
vocabulary is a finite set. It is the direction that gives the most delight per
hour of build and the least authorial control.

**On the iOS UI:** the existing preset rail, unchanged. This is the only direction
that needs no new interaction model at all.

---

### The weak bucket — named, with the reason each is dead

Not counted. Recorded so nobody builds one by accident.

| candidate | why it is dead |
|---|---|
| **A curve / graph editor** (bezier handles on a value-vs-time graph) | This is the After Effects move, and `BILL-GUO-VS-US.md`'s standing rule is *"exceed the level, never copy the moves."* It is also redundant: DialKit already gives a **bezier or spring curve per clip leg** through a control it renders itself, and a spring with `stiffness/damping/mass` is more legible to a designer than two tangent handles. A graph editor would be the single loudest "this is a professional animation tool" signal on a product whose whole pitch is that it isn't one. |
| **Nested comps / a layer tree / an NLE** | Free Stroke is not a compositor. `lib/style-stack.ts` already carries the one layering idea this product needs and it is about *surface*, not time. Two layering systems with different meanings is this repo's most expensive recurring defect, stated in its own words (`style-clock.ts:265-269`). |
| **Per-point keyframing** (keys on individual points of a stroke) | The processed hero word is 1 030 points. Points are a *resampling artefact* — `processStroke` re-spaces them at 4 px and the count changes when you move the spacing slider. Keying a thing that the pipeline is free to renumber is keying nothing. |
| **A separate "animation mode" route** | `/desk-doodles` is already the cautionary tale: a whole motion rig that a user's drawing cannot reach. Whatever gets built goes in the product, on the drawing the user made. |
| **Recording the screen for export** | Already ruled out with a source and a reason (`frame-plan.ts`: Spline's own docs, *"Instead of relying on recording the screen, it renders defined animations for maximum precision"*). Anything the toolset produces must survive the deterministic frame plan. |
| **Rebuilding geometry per keyframe** | Measured: 24 ms at 5 % of the word, **531 ms at the whole of it**, and one draw-in asks for ~120 of them inside 2.6 s — *"about 31 seconds of build work inside a 2.6-second beat"* (`reveal-cost-and-timeline-ownership.md` §1.2). Not shippable. §6.4. |

---

## 6 · What is genuinely hard here, in engine terms

This is the section that decides the cost of everything above. All of it was read
first-hand tonight.

### 6.1 · The global-arc-fraction question — the answer is *four different answers*

The brief asked whether `revealKeys` being a global arc fraction makes per-stroke
timing a small change or a re-architecture. **It is neither, because there is no
single reveal.** `lib/pen-reveal.ts`'s own header names four mechanisms and one
clock, and they have four different answers:

| render path | how it reveals today | per-stroke **schedule** (order · overlap · stagger · delay · speed) | per-stroke **transform** (turn · settle · pop solid) |
|---|---|---|---|
| **Free Stroke · Rod** | per-stroke `setDrawRange` off `timelines[si]` — each stroke's own recorded `tStart`/`tEnd` and its own time→distance table (`viewport-3d.tsx:6272-6332`) | **already per-stroke.** Change where the clock comes from. | each stroke is its own mesh — a per-mesh transform |
| **Desk Doodles engine · all modes** | **one mesh per stroke**, each with its own `revealKeys` baked into its own global span via `bakeRevealKeys(geo, span.from, span.to)` (`dd-engine/adapter.ts:566-583`) | **trivial.** Change the span. | per-mesh transform |
| **Free Stroke · Inflate** (implicit fusion) | ONE fused surface; per-triangle `revealKeys` counting-sorted at build time; one `setDrawRange` prefix + a per-fragment pen-tip test (`viewport-3d.tsx:6177-6247`) | **a key remap + a re-sort** — §6.2 | **the hard one** — §6.3 |
| **Free Stroke · Solid / Extrude** | REBUILD every tick from `filterStrokesByProgress`, a single monotone global arc cut that walks strokes in order and `break`s after the one it lands in (`lib/pen-reveal.ts:231-343`) | needs the clip generalised from one scalar to a per-stroke array — **no extra cost, because it already rebuilds**; the rebuild itself is the problem (§6.4) | per-mesh, but the mesh is rebuilt anyway |

So "per-stroke timing" is a small change on two paths, a medium change on one, and
gated behind a known cost problem on one.

### 6.2 · The near-free class — and it is most of what you asked for

**The reveal's per-triangle key array is a general-purpose "when does this piece
appear" channel, and it does not care whether the schedule is the pen's.**

`revealKeys[t]` is the playhead value at which triangle `t` becomes drawn, the
array is ascending, and the index buffer is counting-sorted to match. The draw is
`lower_bound(keys, playhead)` — a prefix.

**A prefix of a sorted array is exactly "the set of triangles whose key ≤ the
playhead."** So *any* per-stroke schedule that is monotone in the playhead is
expressible by rewriting the key values and re-sorting. That includes:

- **reorder** — permute the spans;
- **overlap** — let two strokes' key ranges interleave; the sort handles it;
- **per-stroke delay, per-stroke speed, per-stroke easing** — a piecewise map;
- **stagger, "by length", "by position", random order** — all of the above.

**Zero shader work. Zero geometry rebuild. No new render path.** The re-sort is
the counting sort the reveal already pays for, measured at **39 ms, once**, on a
build that costs ~600 ms (`reveal-cost-and-timeline-ownership.md` §1.5).

**Two honest costs, named rather than glossed:**

1. **There are two consumers of the schedule, not one.** The pen tip's boundary is
   a *per-fragment* test against the tip field's `arc` channel — `when = arc +
   (1 − nose)·√(1 − ρ²) + taper·ρ` (`lib/pen-reveal.ts:446`). If the key array is
   remapped and the tip field is not, **the nose detaches from the boundary.** The
   tip field is a `Float32Array` of two channels per texel; the remap is one pass
   over it and it must be the *same* remap. This is a real trap and it is exactly
   the class of bug this repo keeps finding — one idea, two implementations.
2. **A prefix cannot express un-drawing.** A schedule where stroke 3 disappears
   while stroke 5 draws is not monotone and this mechanism cannot do it. That is
   fine for a draw-in. It is a hard wall for anything that plays a stroke
   backwards on its own.

### 6.3 · The genuinely hard part — per-stroke *transforms* on the fused surface

Free Stroke's Inflate is one marching-cubes surface. To turn, settle or pop one
stroke without dragging its neighbours you need three things, and **all three exist
already, built for letters:**

1. **A per-vertex owner attribute** — `aFsLetter`, read by a `FS_LETTER_MAX = 16`
   uniform-array lookup on one shared material (`viewport-3d.tsx:2837-2857`). The
   stroke version is `aFsStroke` and the identical mechanism.
2. **Whole-triangle ownership with a boundary vertex split** — `ownTrianglesWhole`
   (`viewport-3d.tsx:3481`), because a triangle straddling two owners stretches
   into a flat grey slab the instant the two poses differ. Census: **788 → 0
   spanning triangles, 550 vertices duplicated** out of ~148 000.
   ⚠ The index buffer is rewritten **in place** so triangle *order* is untouched —
   because `revealKeys` is parallel to that order. Any new owner channel inherits
   that constraint.
3. **The seam, which is an identity and not a tolerance.** Explainer 23:
   `Δ = (I − R)·(piv_A − piv_B)`, so *"the seam is closed if and only if every
   letter shares one pivot."* The cascade solves it by making the pivot **arrive**.
   A per-stroke version has to solve it again, and there is no third option.

Plus one hard limit: **16 units**. A drawing with 40 strokes does not fit a
`uniform vec4[16]`. The options are a data texture instead of a uniform array,
per-owner draw calls, or grouping strokes into ≤16 units — for which
`lib/hero-letters.ts` is already the law.

And one process constraint that must be in any build brief:
**`applyLetterMotion` MUST stay LAST on the `onBeforeCompile` chain** — its whole
mechanism is that its `<project_vertex>` replace lands after the joint break has
assigned `vFsBreakWorld` (`HANDOFF-TO-OZ.md` §5, `hero-motion.ts:164-176`).

### 6.4 · The rebuild cost — the number to know before proposing anything

A timeline that rebuilds geometry per keyframe is not shippable here, and the
numbers are on disk:

```
 reveal   wall(ms)      grid dims       active     sdfEvals
  0.05       24.5      37×102×19        37,206    1,020,070
  0.50      246.7     260×125×20       302,983   16,421,909
  1.00      531.5     522×140×21       606,162   34,904,719
```

*"It is a RAMP, not a cliff… At five percent of the word a rebuild already costs
24 ms, over a 60 fps frame."* One draw-in asks for ~120 of them inside 2.6 s —
**about 31 seconds of build work inside a 2.6-second beat**
(`reveal-cost-and-timeline-ownership.md` §1.2). All four candidate mitigations were
measured and all four failed; the fix was to stop rebuilding at all.

**The rule this gives the toolset:** *anything the animation system does must be
expressible as an attribute, a uniform, or a reorder of an existing buffer — never
as a rebuild.* Every direction above was written against that rule.

### 6.5 · The export constrains the whole design

`lib/export/frame-plan.ts` decides up front exactly which instants it wants and
asks the renderer for each in turn, however long it takes — because *"a screen
recorder samples wall-clock time, so the output's timing is the timing of the
RENDER, not of the animation."* Consequences:

- **The whole animation must be a pure function of one scalar clock.** No live
  state, no accumulator that only exists while playing.
- **It must be seekable at any instant**, not only forwards.
- The plan currently has exactly three phases (`lead` / `draw` / `hold`) and a
  timebase of `pen` or `fixed`. A toolset whose timeline is longer than the pen's
  recording needs a third timebase, or `fixed` becomes the only honest choice —
  a small, real piece of work that is easy to miss.

### 6.6 · DialKit — can it host authored keyframes, or is it a scrubber?

The brief asked this because the answer decides whether the timeline surface is
bought or built. **It is not a scrubber. It is a real multi-track, multi-leg
animation system with editable curves — and its own documentation says you are
supposed to remove it before you ship.** Read out of
`node_modules/dialkit/dist/`, version **1.4.3**.

**What it can do** (`dist/index.d.ts:277-397`):

- **Three clip shapes, mutually exclusive.** A simple `from`/`to` clip; a **`steps`**
  clip — *"Sequential legs on one row — a segmented bar; boundaries retime legs"*;
  or a **`props`** clip — *"Independent per-property tracks"*, each with its own
  `from`, `to`, `duration`, `delay` (*"Offset from the clip's `at` in seconds"*),
  `transition` **and its own nested `steps`**.
- **A real curve per leg.** `TransitionConfig` is a spring
  (`stiffness / damping / mass / bounce / visualDuration`) **or** a cubic-bezier
  easing (`duration` + a four-number `ease`). And it is genuinely integrated, not
  approximated: `dist/timeline/index.js` carries `cubicBezierProgress` with a
  Newton–Raphson solve falling back to bisection, and `springProgress` with a
  computed `springSettleDuration`.
- **Scrub-accurate interpolated values.** Each clip publishes `current` —
  *"Values interpolated through the clip's curves at the current playhead… the
  element is exactly at this point in time whether playing, paused, or
  scrubbing."* Under the hood: `evalPropAtPos` picks the leg containing the
  position, then `interpolateResolved(step.start[prop], step.to[prop],
  sampleCurve(step.curve, within))`. It interpolates numbers, hex colours and
  nested objects.
- **Per-clip `loop`**, a timeline-level `loopStart` (*"Loop wraps back to this
  time, not 0 — clips before it play once (intro-then-idle)"*), presets, and
  persistence.

**So: yes, it can host authored keyframes** — in the shape of *segmented clips*
(a leg has a duration and a curve), not *point keys with tangent handles*. For a
draw-in schedule that is the right shape, and it is more than enough.

**Three limits, and they are the reason it does not simply become the toolset:**

1. **Tracks are declared in code, not added by a user.** The clip and track set
   comes from the `config` object handed to `useDialTimeline(name, config)`. A
   user cannot create a row. A drawing's rows would have to be *generated* from
   the strokes each time the drawing changes — possible, and a live question about
   key stability that a build has to answer, not a given.
2. **The transport has no clamp.** `TimelineStore.tick` advances on a **raw,
   unclamped** `now - lastTick`. `docs/research/reveal-cost-and-timeline-ownership.md`
   §2.2 records what that cost: the page's old rAF loop carried `MAX_STEP = 0.25`
   *"whose entire purpose was to stop the 1.1s stall from skipping the 0.54s
   emerge… **The stall had to die before the timeline could own the playhead.**"*
   Any surface with a slow frame must not hand this library the clock.
3. **🔴 DialKit's own design intent is that it is REMOVED for production.** Its
   copy-out feature generates this text, verbatim from the bundle
   (`dist/index.js` ≈ :48812):

   > *"TODO(production): DialKit's `clip.current` values are the scrubbable
   > authoring preview. Replace them with equivalent real Motion animations using
   > the tuned timeline timings and transitions, then remove `useDialTimeline` and
   > `<DialTimeline />`."*

**That third point is the answer, and it changes the recommendation's shape.**
DialKit is a **developer's tuning dock** — the right surface for *us* authoring a
hero beat, which is exactly what it is doing on `/desk-doodles` and why that
wiring was correct. It is the **wrong** surface for an end-user animation toolset
in a shipped product, by its own author's instruction. (`DialRoot` and
`DialTimeline` do take a `productionEnabled` flag, so it *can* ship — but shipping
a tool against its stated lifecycle is a bet, not a plan.)

**What this means for the map:** direction A's dock is **built, not bought.** We
should steal DialKit's data model — clips with legs, a curve per leg, a `current`
that is exact under scrubbing — because it is well made and we have already proved
it works here. We should not plan the product's animation UI as a DialKit panel.

### 6.7 · One live defect this lane must not walk into

Your **#1 open complaint for over a week** lives inside the reveal, not beside it:
*"the artifacting when drawing and letter pieces missing still happens"* — an
already-finished letter is eaten by the letter arriving beside it, and heals when
that neighbour completes (`HANDOFF-TO-OZ.md` §2A). The live hypothesis is that a
partially-drawn neighbour is a **different implicit field** from both an absent one
and a finished one.

**Any per-stroke reveal makes this worse before it makes it better**, because it
multiplies the number of moments when a neighbour is mid-draw. Whichever direction
you pick, that defect is a prerequisite, not a parallel task.

---

## 7 · What stays

Per `AGENT-DISPATCH-CONTRACT.md` §0.7, nothing here deletes or replaces anything:

- **All seven films stay reachable, with their ids and behaviour intact** —
  `shipped · turnLands · solidFirst · cutaway · popUp · standTurn · letterByLetter`.
  Direction D *adds* a vocabulary beside them; it does not fold them into it.
- **Natural / Authentic / Smooth stay.** They are the pen's own speed law and no
  authored timing replaces them — a performance or a timeline sits *over* them, the
  same way `revealEase` already does.
- **The parked priors stay**: `PEN_TIP_SHAPES.chisel`, `TIP_FIELD_REACH_PRIOR`,
  `timeStrokesUniform`, `PARKED_PHASES`.

---

## 8 · The recommendation

**Build B (the motion stack) as the model. Ship C (perform it) as a MODE over that
same model, never as a second system. Let A (the timeline) be a VIEW of it, not
the thing that invents it. Take D whenever a film is worth generalising, not as a
phase.**

**And the research changed one thing about this, so it is worth saying which.**
I went in expecting the honest answer to be "a timeline is the real answer and a
modifier stack is the cheap one." It is not. The frame in
`blender-gp-build/contact/key-395s.png` shows the Build modifier's **`Factor`**
channel with **two keys on one row**, and a whole word building in off them —
because the modifier already knows the order, the mode, the transition and the
fade. **The modifier owns the rule; one keyframed scalar owns when.** That is not
a compromise between A and B. It is the architecture, shipping, and it is the one
this engine already has, because our reveal is driven by exactly one scalar
(`playheadRef`) that every render path reads.

The rest of the reasoning:

- **B is the direction the codebase is already shaped for.** We built exactly this
  architecture for the surface and wrote *"NOTHING HERE TOUCHES GEOMETRY"* at the
  top of it (`lib/style-clock.ts:36`). The PRD's own Layer 3 Future list is a
  modifier list, not a keyframe list. And §6.2 says its scheduling half is a key
  remap and a counting sort — the cheapest real answer on the board, on every
  render path.
- **C is the one nobody else can build — and it is a mode, not a product.** Every
  tool in §4 asks you to *specify* timing; Free Stroke is the only one that already
  *recorded* it. But Dreams settles the shape: *"You can modify any keyframes you
  laid down in either Perform or Keyframe mode."* Perform must write into the same
  schedule B owns, or we will have built one idea twice on purpose.
- **A is right and it is not first.** A timeline that has to *invent* timing needs
  a row per stroke; a timeline that *displays* a rule needs almost none. **A
  timeline with nothing to show is a worse product than no timeline.** Build the
  schedule model first and the dock becomes a view.
- **D is a garnish, not a phase.** Its ceiling is a finite set of named beats. It
  is the fastest delight and the least authorship, and it is best spent one film at
  a time once the model underneath is real.

### The smallest first slice that would let you feel it

**One modifier: `DRAW IN`, with three dials — `order`, `overlap` and `align`.**

- **What it does.**
  `order` — as drawn *(default, unchanged)* · reversed · by length · by position ·
  random-with-seed. *(Blender's Sequential ordering plus its "distance to an
  object" idea, which for us is "distance from a point you tap.")*
  `overlap` — 0 = strictly one at a time *(Sequential / Individually)*, 1 = every
  stroke draws across the whole beat *(Concurrent / Simultaneously)*, and a
  continuous blend between, which neither reference offers.
  `align` — Start or End, live only when `overlap > 0`: *"shorter strokes finish
  earlier"* versus *"shorter strokes start later."* Blender ships this as a
  separate control for a reason; it is the difference between a word that ravels
  out and a word that lands like a chord.
- **Why it is the right slice.** It is the single item on the PRD's Layer 3 list
  closest to your sentence — *"stroke order controls"* — it is the first control
  every serious tool ships (§4 ①), and it is the first thing in this app's history
  that makes the draw-in **an authored decision instead of a transcript.**
- **What it costs.** A remap of `strokeArcSpans()` → the key array → a re-sort,
  and the same remap over the tip field's `arc` channel. **No new render path, no
  shader work, no rebuild.** It works on all four engines: trivially on Rod and
  Desk Doodles, by key remap on Inflate, by generalising the clip on Solid/Extrude.
- **What it proves.** The moment `order: reversed` renders correctly, the entire
  scheduling half of directions A, B and C is proven on every engine at once —
  because they are all the same remap with a different author.
- **What it must ship with.** A gate whose negative control is `order: as drawn ·
  overlap 0` producing a **byte-identical** render to today's, and a **filmed**
  check that `overlap > 0` actually puts two pen tips on the page at the same
  instant. A green row that cannot fail is the lie this repo keeps paying for.

**And the obvious second slice, named now because it is cheap and it is the other
half of §4 ②:** make the reveal a **window** rather than a prefix — `start` and
`end` instead of one `progress`, plus `travel` and a per-stroke `reverse`. That is
Cavalry's entire stroke-reveal API, it is two binary searches instead of one on
the `setDrawRange` path, and it hands us Blender's *Shrink* and *Vanish*
transitions for nothing.

---

## 9 · The picks that are yours

Nothing below is defaulted. Each has a recommendation and what the other branch
costs.

**Pick 1 — which model leads.** Rec: **B, then C.** What choosing **A first**
costs: the biggest build on the board before anything is visible, and a real
chance of shipping a dock with two rows in it. What choosing **C first** costs: the
most delightful thing first and the least reusable — a performance is hard to edit,
and you would want B's model within a week of using it. What choosing **D first**
costs: the fastest visible win and a ceiling you hit immediately.

**Pick 2 — the unit of animation: stroke, or group?** A stroke is what your hand
did. A group (connected components, `lib/hero-letters.ts`) is what a *viewer* sees
as one thing — and on your traced word it measured **eight** units where the ink
fused `e-s-k` and `o-d`. Rec: **group by default, stroke on request.** It keeps the
row count human, it matches what reads as one object, and it is already computed
from the ink rather than from a table. Cost: a stroke that fuses into a neighbour
cannot be animated alone without splitting the group, and you would sometimes want
to.

**Pick 3 — does the timeline ever appear?** Rec: **yes, but as a view of the
stack, not as the authoring model** — the modifiers stay the source of truth and
the dock draws what they produce, so a drawing with 40 strokes still has 4
modifiers. Cost: some things are genuinely easier to say by dragging a bar than by
setting a rule, and you would occasionally hit that.

**Pick 4 — does authored motion override the recorded timing, or ride it?**
Rec: **ride it.** The pen's own hesitations stay underneath and the modifier
reshapes *when each stroke's beat happens*, not *what happens inside it* — the same
compose-don't-replace rule `revealEase` and `revealMode` already follow. Cost: two
timing systems stacked is one more thing to explain, and a strong enough authored
timing will bury the hand it is riding on.

**Pick 5 — how far past the draw-in does v1 go?** Rec: **not at all.** Ship the
scheduling family first (order, overlap, delay, per-stroke speed and ease) and
leave settle, wobble and secondary motion for a second pass, because they need the
per-stroke transform work in §6.3 and that is where the seam identity and the
16-unit cap live. Cost: "animation" will still mean "how it appears" for one more
phase, and the mark still won't move once it has arrived.

**Pick 6 — does this go in the product route or a lab first?** Rec: **the product
route, `/`.** `/desk-doodles` is the standing proof of what happens otherwise — a
whole motion rig your own drawing cannot reach. Cost: it lands in the surface
you use daily, so it has to be right on the first pass rather than parked.

**Pick 7 — is the iOS pass part of this, or after it?** The PRD puts the iOS
control panel at item 35, *after* item 33. Rec: **after, with one exception** —
whichever direction wins should be laid out to a thumb from day one, because a
dock or a record button designed for a mouse does not survive being re-laid-out
later. There is no iOS-UI doc in this repo yet; item 35 is one line of the PRD and
nothing else. That is worth knowing before anyone treats it as a spec.
