# 18 — The reveal stopped rebuilding, and the timeline took the clock

Research: `docs/research/reveal-cost-and-timeline-ownership.md`.

Four bugs on `/desk-doodles` and one long-standing ask. They turned out to be
one story, because the last bug is what made the ask unsafe.

---

## 1. Two toggles that made no sense (survived a revert)

The header carried two segmented pills, adjacent, identically styled,
unlabelled, whose options were the SAME TWO WORDS in OPPOSITE ORDER —
`Desk Doodles | Free Stroke` immediately followed by `Free Stroke | Desk
Doodles`. One is the visual register, one is the geometry-engine family. Nothing
on screen said which, and the mirrored order made their two active states read
as a contradiction rather than as two independent choices.

A previous agent was cut off mid-revert. **The fix survived**: `ENGINE_FAMILIES`
in `lib/engine-registry.ts` lists Desk Doodles first, matching `REGISTER_ORDER`,
with a comment tying the two orders together; the page wraps both in a labelled
`PillGroup`. Verified through the DOM rather than by reading the source:

```
PASS  both pills are LABELLED — Look: Desk Doodles | Free Stroke   Engine: Desk Doodles | Free Stroke
PASS  both pills list their options in the SAME order
```

## 2. Two transports disagreeing (survived a revert)

The viewport drew its own play button, scrub bar and seconds readout of the
STROKE timeline (~4.6s) directly under the page's beat transport (10.20s). Two
playheads, two scrub bars, one frame.

Also survived: `Viewport3DWrapper` takes `chromeless`, the hero passes it, and
the viewport's own animation controls and readout are suppressed. The page owns
time. Asserted as a count, not a look — exactly one `input[type=range]` and
exactly one Play/Pause inside the stage column.

## 3. The phase readout that looked like a lie (survived a revert)

It displayed `STANDUP` while showing `el 65.1° · fill 1.000` — the LYING
elevation and the lying distance.

The readout was not lying. The stand-up BEGINS at the lying pose, and
`easeInOutBack`'s anticipation dip goes very slightly negative first, which is
why 65.0 reads as 65.1 and 1.000 as a hair over 1. What was missing was HOW FAR
INTO the phase the playhead was; without it, a boundary reads as a
contradiction. The readout now carries its own progress (`STANDUP 29%`), in the
text and in `data-hero-phase-t`.

This one matters beyond cosmetics because it is the small version of how "the
gates pass" and "it doesn't work" stayed simultaneously true.

## 4. The 1.1s stall — the real one

### The measurement came first

`scripts/verify/measure-implicit-cost.mjs` runs the real engine in plain node
(none of this touches WebGL; `_ts-load.mjs` loads `geometry-engines.ts`
verbatim). On the hero word at the resolution the hero pins:

```
 reveal   wall(ms)     march  normals  +audit
  0.05       24.5       14.9      8.1     1.4
  0.50      246.7      141.9     94.5     9.6
  1.00      531.5      293.7    205.3    31.5
```

**A ramp, not a cliff** — cost is linear in revealed arc length (full/half =
2.15×), and it is already over a frame budget at five percent of the word. One
draw-in asks for about 120 of these inside 2.6 seconds. The reason the page did
not visibly run 12× over budget is that the work starves its own successor: the
reveal only advances on a rendered frame. What a viewer saw was the LAST rebuild,
at full word, uninterrupted.

The split is march 55% / normals 39% / audit 6% / acceleration grid ~0%.

### Which is why none of the four candidate fixes worked

`resolution: 3` still costs 158ms — ten frames. A signature cache does nothing
for the first play. Building at mount does nothing for a draw-in that by
construction needs a different surface every tick. Building progressively is the
defect. The research doc has the arithmetic for each.

### The fix: stop rebuilding

Rod has never rebuilt anything — it orders its tube rings by arc length at build
time and animates with `setDrawRange` and a binary search. The reveal is a
rendering problem, and the codebase already had the mechanism.

Marching cubes does not hand you an arc-length ordering, so
`lib/implicit-surface.ts` §6 derives one: every output vertex takes the arc
position of its nearest capsule (`CapsuleField.nearestIndex`, reusing `eval`'s
own bucket walk), every triangle takes the **max** over its three vertices, and
the index buffer is counting-sorted into ascending key order. `revealKeys` rides
out on `StrokeMeshData`; `AnimatedStrokes` binary-searches it and calls
`setDrawRange`. Zero geometry work per frame.

Surcharge: **39ms once**, on a build that already cost 600ms and now happens
once instead of 120 times.

### The cut at the pen tip, and why it does not show

The leading edge is a cut through the finished surface, not a rounded pen tip —
the cap triangles at a stroke's far end sort last. It is one stroke-width wide,
it is moving, and it only exists during the draw beat, where the mark is driven
to near-zero depth anyway. Checked on frames at 3× magnification, not argued:
`docs/verification/hero-transition/drawrange/`.

### What had to be proved

A reveal that ran backwards, popped whole strokes, or leaked triangles ahead of
the pen would still be fast and would still look like drawing.
`scripts/verify/assert-implicit-reveal.mjs` compares the two mechanisms on the
property that defines a reveal — which part of the plane is inked — at six
playhead positions. Worst disagreement **0.52% of the word width**.

It also proves the surface is untouched: byte-identical positions, byte-identical
normals, the same set of 147,452 triangles, only reordered. Without that, every
measurement this project takes on the Inflate surface would silently have been
measuring a different object.

And it carries a negative control — the same comparison with the reveal keys
reversed, which must FAIL, and does, at 100%. An agreement test that cannot fail
proves nothing.

### The result, in real time, through the page's own Play button

| | before | after |
|---|---|---|
| worst frame | ~1100ms | **16.7ms** |
| median frame | — | 8.3ms |
| frames over 100ms | ≥1 | **0** |
| frames on the 0.54s emerge | 0 (skipped) | **65** |

---

## 5. DialKit, and why it needed §4 first

`dialkit@1.4.3` was installed, unwired, and had been pruned back out of
`node_modules` by an `npm install` (it was never in `package.json`). It is now a
real dependency alongside its `motion` peer.

**The eight phases are eight clips, and the timeline owns them.** `HeroBeats` is
derived from `tl.<phase>.duration`; the playhead is `tl.time`; play/pause/seek
are the timeline's. The page's own state is `Omit<HeroMotionParams, "beats">`,
so a second copy of a beat is not discouraged — it is unrepresentable. The
panel's Beats section has no sliders; it reports the live values and says where
to drag.

`at` is derived, not authored: the phases are strictly sequential and
`hero-motion.ts` lays them out by cumulative sum, so the page writes that sum
back into DialKit's store whenever it disagrees. Dragging a clip's edge ripples
the clips after it. Dragging its body snaps back, which is correct — there is no
meaning to moving a phase without reordering, and the order is fixed.

**Why this could not have landed before the stall was fixed.**
`TimelineStore.tick` advances on a raw, unclamped `now - lastTick`. The page's
old rAF loop carried a `MAX_STEP = 0.25` clamp whose entire purpose was to stop
the 1.1s stall from swallowing the 0.54s emerge — the timeline used to jump from
`breath` straight to `tilt`, which is exactly the "it randomly switches to 3D"
symptom, arrived at from a completely different direction. Handing the clock to
a library with no clamp would have reintroduced that on the first long frame.
The clamp is gone because there is nothing left to clamp.

Verified by driving the real dock: locate the ORBIT clip by DialKit's own
`title`, grab its `[data-edge="end"]` handle, drag it, and require the PAGE's own
readout to follow — `orbit 3.200s → 2.080s`, total `10.20s → 9.08s`. Then
"Revert to captured values" restores both.

---

## 6. Gates

- `verify-gates.mjs` — **ALL GATES PASS**, 0 console errors. Rebuild counts flat
  across 30 style changes in all four modes; export non-empty in all four.
- `verify-hero-page.mjs` — 20/20, 0 console errors.
- `assert-implicit-reveal.mjs` — all assertions pass, negative control rejects.
- Typecheck at the **51-error pre-existing baseline**.

### Pre-existing, NOT caused here

`assert-inflate-fusion.mjs` reports 21/23, failing `D2` and `D4`. Both failures
are the single `blend 0` data point — the hard-union control, where there is no
smooth minimum and so no `k/6` law to obey (armpit 1.7605 vs the 1.6847 the law
predicts, 4.5%; and that same outlier is what breaks D4's monotonicity between
blend 0 and 0.25). It is marching-cubes discretisation at a hard crease.

That this pass did not cause it is not an argument, it is a measurement: the
reveal work is proved index-order-only, byte-for-byte, by
`assert-implicit-reveal.mjs`.

### Also fixed in passing

`AnimatedStrokes` read `strokeMeshData.jointFractions.length` on the same line
that guarded the very next access with `?.[ji]`. `jointFractions` is optional, so
that was a real throw waiting for any Rod mesh built without joints — not just a
type complaint. It was the one error separating the tree from its 51-error
baseline after this pass; fixing it puts the count back exactly on 51.
