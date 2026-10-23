# Explainer 04 — The shared visual timing system

What got built in `POST_MVP_VISUAL_TIMING_SYSTEM_PHASE_1`: one clock that every
animated style layer reads, replacing three hand-rolled ones.

Files: `lib/style-clock.ts` (new), `scripts/verify/verify-timing.mjs` (new),
`scripts/verify/assert-timing.mjs` (new), `lib/style-system.ts`,
`components/viewport-3d.tsx`, `components/style-panel-scaffold.tsx`.

---

## 1. Why this phase existed at all

Texture, dither and ASCII each got animation as part of their own phase, and
each one grew its own timing code. By the end there were three versions of the
same idea, with different multipliers, different reveal handling, and no shared
vocabulary:

```js
// texture
motionMode === "syncToDraw" ? playhead * 4 * speed : accumulate(delta * speed * 0.6)
// dither
syncing ? playhead * 6 * speed : accumulate(delta * speed * 6)
// ascii
motionMode === "syncToDraw" ? playhead * 8 * speed : accumulate(delta * speed * 1.6)
```

Three problems with that:

1. **It drifts.** Each new system copies whichever version was nearest and
   tweaks a constant. There's no single definition of "synced to the draw".
2. **It can't express the interesting things.** "Everything pulses together
   when the stroke finishes" is impossible when each layer only knows its own
   accumulator. So is "the texture starts, then the dither joins half a second
   later."
3. **It has no concept of an ending.** Every mode ran forever. One-shots and
   delays had nowhere to live.

Your PRD calls this out as its own phase for exactly this reason, and it's the
foundation the layer-stack and fusion phases need — fusion is *layers
influencing each other over time*, which requires them to agree on what time is.

---

## 2. The model

Every animated layer asks the same question — **"what is my phase right now?"** —
and the answer needs four inputs:

- **The clock.** One shared, monotonically advancing time for the whole scene,
  advanced once per frame before any layer reads it.
- **The sync mode.** Which clock this layer actually rides.
- **The layer's config.** Speed, phase offset, delay, loop length.
- **The reveal.** Draw-in progress, and crucially *whether it just completed*.

`evaluateLayerTime(clock, config)` returns three things:

```ts
{ time: number, amount: number, active: boolean }
```

`time` is the phase a shader uses. `active` says whether the layer should be
treated as animating. **`amount` is the piece that makes the whole thing
compose:** a 0-to-1 envelope the caller multiplies its effect strength by. That
one extra number lets a one-shot burst and a continuous scroll share the same
interface — the renderer multiplies by `amount` and never has to know which
mode is running.

---

## 3. The six sync modes

| Mode | Rides | For |
|---|---|---|
| **independent** | free-running scene time | the layer animates on its own |
| **revealSynced** | draw-in progress | the effect travels *with* the stroke as it's written |
| **strokeTimeSynced** | progress × the stroke's real duration | the gesture's own tempo |
| **delayedAfterReveal** | scene time, started at completion | style lands *after* the form |
| **completionPulse** | a decaying one-shot at completion | punctuation |
| **loopSynced** | scene time wrapped to a shared loop | several layers repeating in lockstep |

Two deserve elaboration.

**strokeTimeSynced** is the subtle one. `revealSynced` ties phase to *progress*,
so a stroke drawn slowly and one drawn quickly animate identically when
scrubbed. `strokeTimeSynced` multiplies by how long the stroke actually took, so
a leisurely gesture gets leisurely style motion. That's the difference between
"synced to the playhead" and "synced to the drawing".

**loopSynced** exists so layers can *agree*. Wrapping scene time to a shared
loop length means two layers on the same loop are always at the same point in
their cycle, and the phase at the end of a cycle equals the phase at the start —
which is what makes a seamless repeating export possible later.

### Detecting completion properly

`completionPulse` and `delayedAfterReveal` need to know the moment the reveal
*finished*, not merely that it's currently at 1. So the clock watches for the
boundary crossing:

```js
if (isComplete && !wasComplete) sinceCompletion = 0
else if (isComplete) sinceCompletion += delta
else sinceCompletion = Infinity
```

Three consequences, all wanted: a playhead parked at 1 doesn't retrigger the
pulse every frame; scrubbing backwards re-arms it so replay works; and
`Infinity` cleanly means "hasn't happened", so the modes that depend on it stay
silent rather than firing at startup.

---

## 4. The bug my own test caught

This is the best argument yet for behavioural assertions over screenshots.

I wrote `assert-timing.mjs` to check each mode behaves in its *own* pattern —
not merely that it moves. For the pulse, three assertions: silent before
completion, bursts at completion, **and returns to still afterwards.**

That third one failed:

```
PASS  completionPulse / bursts at completion — consecΔ 23.59
FAIL  completionPulse / decays back to still — consecΔ 1.14
```

The pulse was decaying — 23.59 down to 1.14, a 95% reduction — but never
actually stopping. With a 1.1-second decay constant and a cutoff at 1%, the
effect was still creeping at roughly 10% strength several seconds later. A
one-shot that never ends is not a one-shot.

Every screenshot of this looks correct. "It bursts and fades" is exactly what
you'd see. Only measuring frame-to-frame change *long after* the burst reveals
that it never reaches zero. The fix: faster decay (0.55s) and a cutoff at 4%,
well above the visible floor, giving the pulse a definite ~1.8s lifetime after
which the layer is *exactly* static — verified at consecΔ 0.00.

---

## 5. How the renderers use it now

Each of the three systems does the same four lines:

```js
const sync = resolveSyncMode(styleState.motionMode, styleState.textureSyncMode)
const t = evaluateLayerTime(clock, { animated: ..., syncMode: sync.syncMode,
                                     speed: ..., delay: ..., loopSeconds: ... })
u.uFsTexTime.value = t.active ? t.time : basePhase
u.uFsTexIntensity.value = t.amount < 1 ? intensity * t.amount : intensity
```

`resolveSyncMode` maps the coarse user-facing **Motion mode** (Off / Independent
/ Sync to Draw) onto the finer per-layer sync mode, so renderers never branch on
motionMode themselves. Choosing "Sync to Draw" promotes a layer to reveal-driven
*unless* it explicitly asked for a more specific reveal behaviour like
completionPulse — the more specific intent wins.

---

## 6. Verification

`verify-timing.mjs` captures each mode under conditions designed to expose it:
continuous modes with the reveal parked, delayed and pulse modes across a
completion event, reveal-synced both held and scrubbed.
`assert-timing.mjs` turns those into ten pass/fail assertions. All pass:

- independent and loopSynced animate freely
- delayedAfterReveal is **exactly still** during the reveal (0.00) and lively
  after (37.83)
- completionPulse is silent before (0.00), bursts (14.14), returns to still (0.00)
- revealSynced is static when the playhead is (0.00) and driven by scrubbing (32.69)

Texture and dither animation were re-captured after the refactor and still
travel, confirming no regression.

**One metric improvement:** a periodic effect that completes a full cycle within
the capture window ends where it started, and the old scoring called that
"jitters in place". Low span with *high* frame-to-frame change now reads as
"travels (periodic — returned to phase)". Only a low frame-to-frame change means
nothing is happening.

---

## 7. What this phase does not do

- No timeline and no keyframes. This is a clock, not an editor.
- Per-layer speed still lives in each layer's own panel; this phase adds the
  sync mode and delay next to it, plus one shared loop length.
- Stack-level animation (the whole group animating as one) is a later phase —
  but it will be built on this clock, which is why `amount` exists.
- Geometry, geometry animation, and export untouched. The geometry reveal
  playhead is read, never written.
