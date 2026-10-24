# Explainer 06 — Stack-level animation

What got built in `POST_MVP_STACK_ANIMATION_PHASE_1`: the whole layer group
animating as one container.

Files: `lib/style-stack.ts`, `scripts/verify/verify-stack-anim.mjs` (new),
`scripts/verify/assert-stack-anim.mjs` (new), `lib/style-system.ts`,
`components/viewport-3d.tsx`, `components/style-panel-scaffold.tsx`.

---

## 1. Three kinds of animation that are easy to confuse

Your PRD is insistent on this distinction, and now that all three exist (or are
scoped) the difference is concrete:

| | what moves | example |
|---|---|---|
| **Per-layer** | one layer, on its own | scanlines scroll while dither sits still |
| **Stack** *(this phase)* | the group, together | the whole composition fades in |
| **Fusion** *(later)* | layers influence each other | ASCII density drives dither threshold |

The analogy that makes stack animation click: it's a **Photoshop layer group**
or an **After Effects precomp**. The contents keep their own settings and keep
doing their own thing; you're animating the container they live in.

---

## 2. How it works: two group values

Stack animation produces exactly two things each frame:

```ts
{ amount, timeOffset, frozen }
```

- **`amount`** multiplies every layer's contribution → fades and pulses.
- **`timeOffset`** is added to every layer's phase → the whole stack drifts.
- **`frozen`** tells layers to hold their current phase.

Because both apply *uniformly*, the layers keep their **relative balance**. A
preset tuned to "ASCII dominant at 0.85, others supporting at 0.3" stays in that
proportion while the group fades in — the composition arrives, rather than
rearranging itself on the way in. That's the whole reason group animation is a
separate mechanism instead of "animate all the layers at once."

### The multipliers, completed

A layer's final strength is now:

```
its own control  ×  its stack opacity  ×  GROUP opacity  ×  its timing envelope  ×  group amount
```

Five dials, five distinct meanings: *how strong is this effect*, *how much does
this layer contribute to the composition*, *how present is the composition as a
whole*, *where is this layer in its own animation*, and *what is the whole group
doing*.

**Group opacity is the one that arrived late, and it is deliberately not part of
the animation.** It is resolved in `resolveStack`, not in
`evaluateStackAnimation` (`lib/style-stack.ts`), because it is not motion — a
group can sit at 40% with nothing animating at all. Folding it into the
animation would have made a user's chosen level silently stop applying the
moment they switched the animation off, and a dial whose value quietly stops
mattering is worse than one that was never built. It is gated on
`layerStackEnabled` alone and defaults to 1, so every composition authored
before it existed resolves byte-identically.

---

## 3. The eight behaviours

- **fadeIn** — the stack arrives over ~1.2s.
- **pulse** — everything breathes together. Bottoms out at 0.45 rather than 0,
  so the composition never fully vanishes mid-cycle.
- **drift** — one shared phase offset added to every layer, so they slide in
  formation rather than at their own speeds.
- **delayAfterReveal** — the style stack lands *after* the form is drawn. Lets
  the drawing read first, then get dressed.
- **completionPulse** — a swell *above* the resting value at completion, then a
  settle back to exactly 1. Punctuation, not a state change.
- **freezeOnComplete** — layers animate during the draw, then hold their final
  frame. This is the one with a practical payoff: a still capture matches what
  the viewer last saw moving.
- **loop** — a shared PING-PONG offset on the loop clock: the stack slides out
  and comes home once per cycle. It was a *wrapped* offset in v1, and that was
  wrong twice over — between wraps it is indistinguishable from `drift` (same
  slide, same look), and AT the wrap the offset snapped N units back, which is
  only seamless for patterns that happen to be periodic in the offset. A
  there-and-back cycle is visibly a repeating figure and never jumps.
- **revealSynced** — the group IS the playhead. Strength tracks draw progress,
  and the shared offset is driven by that same 0..1 rather than by wall clock,
  so scrubbing the reveal backwards genuinely *un-builds* the stack instead of
  continuing to advance it. Its `4` is `evaluateLayerTime`'s `revealScale`
  default, so a reveal-synced GROUP travels the same distance over a full draw
  as a reveal-synced LAYER does — one named idea, one number, at both scales.

### Direction is the SIGN of speed, and only four behaviours can use it

`stackAnimationSpeed` is signed: the magnitude is the rate, the sign is the
PRD's "direction" control. One field rather than two, because the group's
motion is a single scalar phase offset and a separate `direction` enum would
have been a second dial multiplying into the same number — the "two dials, one
lever" shape this repo has already had to unpick once.

But the sign only *means* anything where the behaviour produces an offset.
`drift`, `loop` and `revealSynced` slide the whole stack, and running them
backwards is a genuinely different read. Every other behaviour is an amplitude
over time, and a negative amplitude clock is not a direction — it is a fade that
never arrives (`fadeIn` with a raw negative speed returns `min(1, negative/1.2)`,
clamped at 0 forever, i.e. an invisible stack that looks like a broken preset).
Those branches take the magnitude only, and the panel *disables* the Direction
control on them rather than leaving a control on screen that does nothing.

---

## 4. The bug the assertions caught (again)

`fadeIn` failed its assertion:

```
FAIL  stack fadeIn / presence changes across the fade — 66.3 -> 67.5
```

Barely any change across the whole fade. The cause was a genuine design mistake,
not a test artifact: **the fade measured from scene start.** `clock.elapsed` is
seconds since the scene mounted. By the time anyone actually enables fadeIn,
that's already many seconds — far past the 1.2s fade — so the group is at full
strength before the first frame renders. The feature was invisible in exactly
the situation where you'd use it.

The fix: measure from when the behaviour was **armed**, not from scene start.
The viewport tracks a key of `(enabled, behaviour)` and stamps `clock.elapsed`
whenever it changes, then passes `sinceArmed`. Now "fade in" fades in — and
`drift` and `loop` also start from a sensible phase instead of an arbitrary one.

After the fix: presence 90.2 → 73.6 across the capture window, a clear change.

This is the second time a "measure from when?" mistake has hidden inside
correct-looking code (the first was completion detection in
[the timing system](04-timing-system.md)). Worth watching for: **time-based
effects need an explicit origin, and "scene start" is almost never it.**

---

## 5. freezeOnComplete, and why it needed a phase snapshot

Freezing can't just stop advancing the clock — the clock is shared, and other
things read it. Instead, when freeze engages the viewport snapshots each layer's
*current* phase and pins the uniforms to those values until the freeze lifts:

```ts
if (groupAnim?.frozen) {
  if (frozenPhaseRef.current === null) {
    frozenPhaseRef.current = { tex: ..., dit: ..., asc: ... }
  }
} else {
  frozenPhaseRef.current = null
}
```

Capturing on the *transition* rather than every frame is what makes it a freeze
rather than a stutter, and clearing on release lets replay work.

Verified: consecutive-frame change 61.46 during the reveal, **0.00** after. Not
"nearly still" — identical frames.

---

## 6. Verification

`assert-stack-anim.mjs`, 6/6 pass:

| Assertion | Result |
|---|---|
| fadeIn presence changes across the fade | 90.2 → 73.6 |
| pulse oscillates | consecΔ 54.98 |
| drift slides | consecΔ 44.89 |
| delay absent during reveal, present after | 93.3 vs 67.6 |
| freeze animates during the reveal | consecΔ 61.46 |
| freeze is EXACTLY still once complete | consecΔ 0.00 |

Note the mix of measurements. Motion questions ("does it oscillate") use
frame-to-frame change; presence questions ("did the group fade in") use mean
luminance over the object's pixels, because *how much of the effect is present*
is not the same question as *is it moving*. Using the wrong measure would have
passed a broken fade.

All previous suites still pass: 20/20 gates, 10/10 timing, 9/9 stack.

---

## 7. What this phase does not do

- No per-layer stagger *within* a group behaviour (a cascade where layers arrive
  one after another). The PRD's `cascade` idea fits here later; `delay` already
  exists per-layer if you want it manually.
- No stack-level blend or masking.
- Fusion — layers influencing each other — is deliberately still absent. That is
  the next major phase and the one where this project becomes more than a
  layer stack.
- Geometry, geometry animation, and export untouched.
