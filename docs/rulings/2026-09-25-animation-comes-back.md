# 2026-09-25: the animation tools come back, all of them

**His words:** "Okay we're bringing basically everything back, right? These smaller calls, things you can decide."

This overrules every agent ruling that took an animation feature out without him. Each of these is void:

- `docs/animation-toolset-map.md:357` refused a graph editor, a node graph, a state machine and frames,
  on the grounds that "a product whose pitch is that it isn't" a pro animation tool. He never said that.
- `docs/animation-port-audit.md:307` (N10): "A curve editor, a layer tree, per-point keys, a separate
  animation route ... Recorded here so nobody proposes one."
- `lib/stroke-schedule.ts:228-234`: the comment that says the reveal's edges are not keyframed on purpose.
  "Two independently keyframed edges would be two clocks" is wrong. A keyframed curve is sampled from the
  one clock, and export stays a pure function of it.
- `docs/hero-animation-options-board.md:178` cut every camera move "permanently". He asked for camera moves
  that ease and have a reason. They come back on those terms.
- The refusal of easing on the draw-in (`docs/RUN-QUEUE.md:986`, `write-on-timing.md:17-18`).

**What comes back, in build order:**

1. **A stroke timeline on `/`.** One row per stroke. Drag each stroke's start and end. Each stroke gets its
   own speed, ease and delay, and any stroke can be held back to land last.
2. **Perform it.** He draws the pen's motion himself, and the take keeps his timing.
3. **Keyframes and a curve editor.** Keys on draw progress, width, depth, turn and camera, with a curve he
   shapes between the keys.
4. **Custom under every preset.** Every preset opens into its full editable controls, and he can save his own.
   This is the 07-28 plan's reserved list: Custom Geometry Animation, Material, Texture, Dither, ASCII,
   Stack and Fusion Animation.
5. **Camera moves, eased and for a reason.**

All of it lives in the main app on `/`, not only on the hero page.

**Calls he handed to the controller, decided:**

- Reed tip taper: 3.5 was tried and **reverted to 1.6** the same day. On the current tip field 3.5 reopens
  the o/D slit (4 px against 0). It comes back only once the taper's handling of a stroke's start is fixed.
- Travel true wrap: the first pass writes in from an empty page and every later pass wraps; the head moves
  one steady speed per pass.
- Solid line: **stays at its default.** The word reads as one solid; the e's eye stays parked.
- The five re-derived gates: closed-loops merges now; the other four merge once their open red is fixed.

The record behind this: `docs/research-2026-09-25/animation-asks/` (106 asks: 22 built, 32 partial, 45 not
built, 7 unknown).
