---
name: storyboarding
description: Plan an animation as key shots, then breakdowns, then in-betweens — instead of as durations and easing curves. Use when motion is "not ugly, just lame", when a beat feels smooth but weightless, when asked to storyboard or choreograph a sequence, or before building any hero/marquee animation. Diagnoses a missing MOMENT and proves it from measurement rather than opinion.
---

# Storyboarding

A storyboard is **not a picture of the finished thing.** It is an instrument for
finding out whether a sequence works *before* anyone animates it.

Full sourcing — Williams, Thomas & Johnston, Whitaker/Halas/Sito, Beiman, Pixar —
lives in `docs/research/storyboarding.md`. A worked example, with measurements,
is `docs/hero-beat-storyboard.md`. This is the method.

## When this applies

Reach for it when motion has been built as a **parameter model** — durations,
easing curves, camera dials — with no board behind it. The symptom is specific
and worth learning to recognise:

> *"not ugly, just lame"*

**Not ugly** means the execution is fine. **Lame** means it has no dramatic
weight — it simply *becomes*, and at no instant does anything *happen*. That is
not a tuning problem and no amount of curve-fiddling fixes it. It is a missing
key shot.

The tell in code: the whole beat is one or two scalars ramping on one curve.
Count the degrees of freedom. If everything on screen is driven by the same
number, nothing is caused by anything else, and nothing has its own timing.

## The one question

Not *"how do we get from A to B smoothly."* That is usually already solved.

> **Where is the moment, and what happens at it?**

**A key shot is defined by being a moment** — an instant with a genuine before
and after. A card flip has one: the edge-on instant, where the face vanishes and
something else is there when it returns. A cross-fade has none, which is why
cross-fades are forgettable.

## The order — and it is not negotiable

Going straight to in-betweens produces something tunable and dramatically
incoherent. Work in this order:

1. **KEY SHOTS** — what the sequence is *about*.
2. **BREAKDOWNS** — the passing position between two keys. Never the midpoint.
3. **IN-BETWEENS** — everything else, with frame counts.

Williams: a key is *"the storytelling drawing… the drawing that shows what's
happening in the shot."* Not the prettiest frame — the one that carries the
information.

### 1. Key shots

Each key shot states **four things**:

- **What is on screen**
- **Where the camera is**
- **What the mark / subject is doing**
- **Why this shot exists** — and if you cannot answer this, it is an in-between
  with ambitions. Delete it.

**The admission test** (Whitaker/Halas/Sito, p. 54):

> *"A held drawing can usually be extracted from the animation and works when
> framed and hung on the wall, whereas most animation drawings do not."*

If you could not freeze and print it, it is not a key shot.

**Name shots for what they tell, never for the phase they belong to.** "K3 — THE
EDGE" is a shot. "crossfade" is a parameter. Renaming a phase after its
storytelling job is often the first thing that exposes it has none.

**Grade every panel in silhouette.** Disney: *"Work in silhouette so that
everything can be seen clearly."* Value gates cannot see shape errors — a flat
render can pass every luminance test while having the wrong outline entirely.

### 2. Breakdowns

The load-bearing idea, and the one most often skipped:

> *"If the breakdown or passing position is wrong, all the inbetweens will be
> wrong too."* — Williams

> *"the WRONG way to do break down drawings is to put a drawing exactly in the
> center… that creates EVEN SPACING between your drawings, and it looks very
> mechanical."* — BAM Animation

So: **find where the half-way pose actually sits, as a percentage of the move.**
Do not assume, and do not choose — *measure it off a move that already works.*
In the worked example the numbers came out as:

| | half-way pose at |
|---|---|
| a card turn that reads as an event | **87%** of the move |
| a fade that reads as lame | **42%** of the move |

That gap *is* the difference between an event and a fade. 42% is even spacing.

**Watch for compounding cushions.** If the underlying law is already non-linear
(`|cos θ|` is already slow at the ends and fast in the middle), easing on top of
it stacks two cushions and the move goes draggy at both ends with a blink in the
middle. Solve for where the half-way pose lands rather than eyeballing the curve.

### 3. In-betweens — write an exposure sheet

One row per run of frames. Columns: **frames · t · n · shot/action · notation ·
where it falls in the whole**. The director's shorthand
(Whitaker/Halas/Sito, p. 19):

```
─────  hold          ∿  action
  ◠    anticipation  ✕  must happen on this exact frame
```

Rules worth carrying:

- **Two frames, not one, for a moment.** At 30 fps one frame is 33 ms and reads
  as a dropped frame; two is 67 ms and reads as a beat. The dwell is what makes
  it an event rather than a glitch.
- **Twos only while the camera is parked.** *"It is dangerous to animate on
  double frames during a table move or camera track"* — combining doubles and
  singles under a camera move produces jitter. Camera moves go on ones.
- **Contrast is the whole point.** *"Timing gains meaning through contrast. A
  fast action feels fast because something before it was slow."* Budget the
  holds explicitly — they are content, not dead air.
- **A hold only reads as a hold if something stopped.** A camera that decelerates
  to *almost* zero has not stopped, and the frame reads as a pause in a pan.

## Prove the diagnosis; do not assert it

A diagnosis you can prove from existing instrumentation is far stronger than an
opinion, and it survives the conversation where someone disagrees. Three
independent routes, in order of force:

1. **The stated intent.** Grep the source comments. Beats that lack a moment
   very often say so in writing — *"the transition being near-invisible is the
   point"* is a design goal, and you cannot tune your way out of a design goal.
2. **The gates.** Read what the existing pass/fail tests actually assert. A gate
   named *"the change is gradual, not a cut"* is **a formal upper bound on
   drama**, and if it passes with room to spare, the beat is lame by contract.
3. **The pixels.** Measure the encoded output per frame — do not read the
   source. Two ~50-line tools do it (`docs/storyboard/tools/`):
   - `measure.mjs` — per frame: ink count, bbox, centre, mean luminance.
   - `segment.mjs` — collapses that into MOVING / STILL runs, so the beat
     structure falls out of the pixels instead of the source.

   Report **duration · % held still · number of moments**. A beat with 0 moments
   and 9% stillness against a reference with 2 moments and 45% is not a matter
   of taste.

**Composite over the real paper/background before measuring.** Films with alpha
decode to black by default; measuring that gives nonsense. And measure the
subject's **dark core**, eroded a few px, so antialiasing on the boundary is not
counted as shading — the flatter and harder-edged the mark, the more spread its
edge contributes.

## When the gates and the storyboard disagree

They will, and this is the highest-value moment in the whole method.

Run the *reference* — the version that demonstrably works — against the
*current* gates. In the worked example the original card flip **failed** two
gates, because its moment is a single-frame collapse of the silhouette's extent.

> **The gates as written would reject the only thing in the project that has a
> moment.**

That proves the fault is in the criterion, not in the film. Then separate what
the gate conflated. Here the fix was surgical:

| clause | verdict |
|---|---|
| centre must not jump (**registration**) | **keep, and tighten** — this must always hold |
| extent must not jump (**continuity**) | **delete** — this is exactly what a moment breaks |
| "the change is gradual" | **invert** — require a moment instead |

The replacement gate is not "allow a jump". It is *"allow the **extent** to jump
only while the **registration** holds perfectly"* — which is precisely the
difference between a card turning and two layers swapping.

**Add a stillness gate if none exists.** Value gates are common; stillness gates
are rare, and "the camera never actually stops" is a frequent, invisible defect.

## Check every adjacency

A board that reads shot-by-shot but cannot get *between* the shots is not a
board. Tabulate every K→K+1 and answer honestly. The failures cluster:

- **Inverted order** — anticipation firing *after* the event it anticipates.
  That is a hiccup, not a wind-up, and it is usually free to fix.
- **Nothing to release into** — a wind-up whose payoff is a fade. The broken
  promise is a large part of what "lame" names.
- **Cutting from an unreadable shot** — if the subject is illegible for a beat,
  you cannot cut out of it. Check bbox legibility across the approach.
- **The sequence stops rather than ends** — a missing return/bookend. Going one
  way asserts a conversion; coming back asserts an identity.

Also check that the code you are boarding is the code that ships. Orphaned
timeline modules with zero importers are common; storyboarding one is wasted work.

## Thumbnails are not optional

**Prose alone is not a storyboard.** Ship annotated sheets alongside the doc:

- **Key shots** — one panel per shot, using *real frames* where they exist, each
  with its camera position and a one-line "why this shot exists".
- **Timing** — reference / current / proposed on one scale, moments marked.
- **The moment, in real frames** — the actual consecutive frames at the event,
  same crop, same scale, with the measured numbers on them. This is the single
  most persuasive artifact; it ends arguments.
- **Breakdowns + exposure sheet** — spacing charts in the notation (keys
  circled, breakdown underlined) and the frame-by-frame table.

Generate them programmatically (`@napi-rs/canvas` + `ffmpeg` frame extraction)
so they can be regenerated when numbers change. Keep the generator in
`docs/storyboard/tools/`.

Practical notes: canvas has no font fallback for `→ ★ ∿ ✕ ¾` — they render as
boxes, so use ASCII in text and draw glyphs as vectors. Give every note a fixed
column; notes that float after a variable-width bar run off the sheet.

## Close honestly

End with **what is decided because it is measured** and **what is not decided**
— the taste calls, listed as questions for the person whose call it is. A board
that pretends to have settled a taste question will be ignored on the one thing
it got wrong.

And say plainly whether anything was built. A board is a planning document; if
no code changed, write that down.
