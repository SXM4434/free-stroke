# Animation tools on `/`: the design

Research-and-design lane, 2026-09-25. No product code changed. Nothing was opened in a browser.

His ruling today: "Okay we're bringing basically everything back, right?" (`docs/rulings/2026-09-25-animation-comes-back.md`).
His ask from 08-05: "keyframing, editing any of the motion of the strokes ... as if you were someone in control of the pen through a motion tool."

**Not reached, because the lane hit its 150k context gate:** the web research on Theatre.js, After Effects Trim Paths and graph editor, Rive, Cavalry, Jitter, Figma Smart Animate and Spline, and the GSAP skill. Nothing below about those tools was checked this session. The base recommendation is argued from our own code, which was read. The Theatre.js check is written out in §6 for the next lane to run before Phase 3.

---

## 1 · What the app already has, and what each feature reuses

### The one clock, as it runs today

```
wall ms ──PlaybackController──> clock 0..1 ──cadence──> ──easeReveal──> playhead 0..1
   (viewport-3d.tsx:7331-7464)                (7215)

playhead ──revealDistanceFraction──> beat 0..1 (how far the pen has travelled)
             (pen-reveal.ts:168)

beat ──windowAt──> [lo, hi] in schedule space S       (stroke-schedule.ts:413)
S(a) per triangle = revealKeys remapped by the schedule (stroke-schedule.ts:889, 1065)
drawn set = triangles with lo < key <= hi = a contiguous range of a sorted array
```

Export asks for the same chain frame by frame: `host.seek(easePlayhead(f.clock))` and `host.setSceneTimeMs(f.timeMs)` (`lib/export/recorder.ts:7-8`, `:51`, `:164`). A planned frame carries a linear `clock` and nothing else (`lib/export/frame-plan.ts:187-206`). So anything that is a pure function of `clock` exports deterministically with no change to `lib/export/`.

### What each piece is, with the line that says so

| machinery | file:line | what it gives us |
|---|---|---|
| per-stroke tracks | `lib/stroke-schedule.ts:498-521` | `ScheduleTrack { stroke, unit, from, to, start, end, reverse }`, one per stroke, `start < end` always |
| the schedule build | `lib/stroke-schedule.ts:608-815` | order, overlap, align, unit and reverse produce every track's `[start, end]`, normalised by one `T` |
| the map a triangle is keyed by | `lib/stroke-schedule.ts:889-914` | `scheduleArc`: affine inside a track today |
| per-stroke progress | `lib/stroke-schedule.ts:1037-1052` | `strokeProgressAt(sched, playhead)`, what Solid, Extrude, Inflate and Rod rebuild from |
| the window | `lib/stroke-schedule.ts:413-447` | grow, travel, vanish, shrink as one interval over S |
| the "not keyframed" comment the ruling voids | `lib/stroke-schedule.ts:232-242` (the ruling cites 228-234; it has drifted) and again at `:99-102` | "Two independently keyframed edges would be two clocks." Wrong: a key curve sampled from `clock` is still one clock |
| the tip's nose and taper | `components/viewport-3d.tsx:6576-6596` | `back`, `taper`, `arcToLocal` multiply by ONE `ts.scale` for the word |
| the uniform-slope guard | `lib/stroke-schedule.ts:524-549`, `:784-803` | says out loud that per-stroke speed breaks the one-scale tip |
| the tip field | `lib/pen-reveal.ts:535`, `:908-920` | two channels per texel, `arc` and `rhoN`; no slope channel |
| the playback envelope | `lib/stroke-schedule.ts:368-391` | mode, cadence, ease, delay, loop, reverse for the whole take |
| the controls | `components/draw-in-timing-controls.tsx:1-21`, `:51` | one component, two doors: the Timing popover and the Animation tab (`components/style-panel-scaffold.tsx`) |
| the strip on `/` | `components/take-timeline.tsx:13-21`, mounted at `components/viewport-3d.tsx:7306` | one row per unit, one bar per stroke, axis in real seconds via a 129-sample inverse (`:226-264`). Read-only by his 08 pick 3 |
| the draggable dock | `app/desk-doodles/page.tsx:32`, `:1347-1350` | `useDialTimeline` from `dialkit` 1.4.3 (MIT, already in `package.json:48`): drag a clip to move, drag an edge to retime, scrub, play |
| dialkit's own warning | `node_modules/dialkit/dist/index.js:1211` | `TODO(production): DialKit's clip.current values are the scrubbable authoring preview` |
| the hero channels | `lib/hero-motion.ts:3461-3500` | `HeroSample { az, el, fill, reveal, flat, depth, yaw, pitch, squashX, squashY }` as a pure function of `tSec` (`sampleHeroMotion`, `:3733`) |
| a bezier ease | `lib/hero-motion.ts:2115-2165` | `cubicBezierEase(x1, y1, x2, y2)`, Newton plus bisection |
| the channels `/` already reads per frame | `lib/flat-ink.ts:2338-2420`, `components/viewport-3d.tsx:6104` | `FlatState { ink, depth, yaw, pitch, shade }` through `flattenSrc` |
| the camera on `/` | `app/page.tsx:1317`, `:1376-1381` | `api.orbitView(az, el, fill)` and a spin rate |
| recorded time per point | `lib/stroke-processing.ts:20-25` | `Point { x, y, t }`: every stroke carries its own pace |

### What each of the five reuses

1. **Stroke timeline.** The tracks, `scheduleArc`, the sorted-key prefix, `strokeProgressAt`, the strip's rows and its seconds axis, the Timing controls. New: per-stroke overrides on top of the schedule, a slope channel in the tip field, and drag on the strip.
2. **Perform it.** Point timestamps and the Phase 1 per-stroke timing. A take he performs is written into the same `StrokeTiming` rows, so nothing downstream learns a new shape.
3. **Keys and curves.** `cubicBezierEase`, the `HeroSample` channel list, `FlatState` and `orbitView` as the places a sampled value lands, and dialkit's drag-and-scrub dock as the reference for the editor's feel.
4. **Custom under presets.** The doc store that already keeps `drawIn`, `revealWindow` and `revealEnvelope` (`app/page.tsx`, `lib/doc-store.ts`). A preset becomes a filled take; "custom" is the same take, opened.
5. **Camera.** `orbitView`, the hero's camera reasons (`app/desk-doodles/page.tsx`, `BEAT_NOTES`), and Phase 3's camera channels.

---

## 2 · The recommendation: our own keyframe model, on our clock

**Build a small keyframe model in `lib/` and sample it from `clock`. Do not put Theatre.js under the reveal.**

The reason is the reveal itself, and it holds whatever Theatre.js turns out to cost. Our draw-in is not a property a library can tween. It is a per-triangle key baked once per dial change, a re-sorted index buffer, and a tip field whose texels hold arrival positions (`stroke-schedule.ts:44-50`, `viewport-3d.tsx:5947-5975`, `:4955-5030`). Per-stroke timing has to be written INTO those keys, because that is what keeps the draw a binary search per frame instead of a rebuild. No outside timeline does that for us; we would still write the bake, and then keep a second copy of time in the library's sequence. That is the second clock the old comment was afraid of, arriving by the side door.

Export already works the way we need: a frame is a `clock`, the host seeks to it (`recorder.ts:164`). A model that is `sample(take, clockMs)` exports with zero change to `lib/export/`.

Where a library still earns its place: the **curve editor UI** in Phase 3. That is a solved problem (graph editors are hard to get right), and `one-system` and `use proven solutions` both point the same way: our clock and our data, someone else's editor widget if one fits. Theatre.js Studio is the obvious candidate and is the thing §6 says to check. dialkit already gives us drag-to-retime clips, under MIT, and is already installed.

---

## 3 · The data model

Everything is one document field, `take`, stored beside `drawIn`, `revealWindow` and `revealEnvelope`.

```ts
// lib/take.ts  (new, zero React, zero three)

type Ease =
  | { kind: "preset"; id: "linear" | "in" | "out" | "inOut" }
  | { kind: "bezier"; x1: number; y1: number; x2: number; y2: number }

/** Phase 1. One row per stroke, only for strokes he has touched. */
interface StrokeTiming {
  delayMs: number     // shift of the stroke's slot from where the schedule put it
  speed: number       // 1 = the pace it was drawn at; 2 = half the screen time
  ease: Ease          // over this stroke's own progress
  holdBack: boolean   // lands last, after every other stroke has finished
}

/** Phase 3. */
type Channel =
  | { kind: "draw"; stroke: number }        // progress 0..1 of one stroke
  | { kind: "depth" } | { kind: "turn" }    // FlatState.depth, FlatState.yaw
  | { kind: "width"; stroke?: number }
  | { kind: "camera"; axis: "az" | "el" | "fill" }

interface Key { tMs: number; value: number; out: Ease }  // `out` shapes the span to the next key

interface Take {
  version: 1
  strokes: Record<number, StrokeTiming>     // Phase 1
  performed?: PerformedTake                 // Phase 2
  tracks: { channel: Channel; keys: Key[] }[]  // Phase 3
}
```

### How it samples from the one clock

The take has a length in ms, `takeMs`, which is `max(end_i)` over the timed strokes. `clock * takeMs` is the only time anything reads.

**Draw-in (Phase 1).** For stroke `i`, the schedule gives a base slot. The overrides give a slot in ms, `[t0_i, t1_i]`: `t0 = base0 + delayMs`, `t1 = t0 + baseDur / speed`, and `holdBack` moves `t0` to the latest `t1` of the others. Inside the slot, progress is `ease_i(own pace_i(u))`, where `own pace` is that stroke's own `t` stamps, so his hesitations stretch with the stroke instead of staying behind on the beat.

The key a triangle gets is **the time it arrives**: `key(a) = t0_i + (t1_i - t0_i) * inverse(ease_i o pace_i)((a - from_i) / L_i)`, over `takeMs`. That is monotone inside every stroke, so the drawn set is still `{ key <= clock }`, still a prefix of a sorted array, still one binary search. The bake runs on a dial change and never per frame.

Under a timed take, `beat := clock` (the pace now lives in the keys), and `revealDistanceFraction` is skipped. With no row in `take.strokes`, none of this runs and the current chain is used as is. The identity path stays byte for byte, which is the negative control the schedule already relies on (`stroke-schedule.ts:52-58`).

**The tip.** Per-stroke speed makes the slope differ per stroke, which `uniformSlope` exists to flag (`stroke-schedule.ts:524-549`). The tip field gets a third channel, `|dS/da|` per texel, and the shader multiplies `back` and `taper` by it instead of the one `ts.scale` (`viewport-3d.tsx:6592-6596`). The bake already takes its minimum in scheduled space (`scheduleArcCoeffs`, `:946`); under a non-affine map the coefficients become a per-sample lookup, still at bake time.

**Keys (Phase 3).** `value(channel, tMs)` = find the two keys either side, `u = (tMs - k0.tMs) / (k1.tMs - k0.tMs)`, return `lerp(k0.value, k1.value, k0.out(u))`. A `draw` channel, where present, replaces that stroke's Phase 1 progress. Depth and turn land in `FlatState`, camera in `orbitView`, all read inside `useFrame` from refs, so nothing new re-renders React.

**Export.** Unchanged. `penDurationMs` becomes `takeMs` when a take is timed, and every frame is `sample(take, clock * takeMs)`.

---

## 4 · Where it lives on `/`

The strip is already mounted in the transport (`viewport-3d.tsx:7306`). The Timing controls already render in two doors. The layout below is drawn from the code, not from a render; the Phase 1 lane checks it against the page.

```
┌──────────────────────────────────────────────────────────────┬──────────────┐
│                                                              │ Style drawer │
│                        the mark                              │  ...         │
│                                                              │ [Animation]  │
│                                                              │  order       │
│                                                              │  overlap     │
│                                                              │  window      │
│                                                              │  ── stroke 3 │ <- Phase 1: the
│                                                              │  delay 0.20s │    selected row's
│                                                              │  speed 1.5x  │    speed, ease,
│                                                              │  ease  [out] │    delay, hold back
│                                                              │  [Hold back] │
├──────────────────────────────────────────────────────────────┴──────────────┤
│  ▶  0.5x 1x 2x   Natural/Authentic   Timing   Loop        1.84s / 4.20s     │ transport
│  0s        1s        2s        3s        4s                                 │
│  ▕█████▏                                                                    │ stroke 1
│        ▕███████▏                                                            │ stroke 2   drag body = delay
│                 ▕═══════════════▏                     <- selected           │ stroke 3   drag an end = speed
│                                   ▕███▏                                     │ stroke 4
│                                                     ▕████▏  held back       │ stroke 5
│              │ playhead                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Phase 3, opens under the strip:  ◆ keys per channel, curve between them    │
│  depth   ◆──────◆─────────◆                                                 │
│  turn         ◆──────────────◆                                              │
│  camera  ◆─────────────────────────◆         [curve]  ⌒ between two keys    │
└─────────────────────────────────────────────────────────────────────────────┘
```

The strip's rule changes on purpose. Today "nothing here may LOOK like a control" (`take-timeline.tsx:22-27`) because it could not act. Once a bar drags, it has to look draggable: a hover edge, a resize cursor, a selected state.

---

## 5 · Build phases

Each is shippable alone and sized for one lane of about 100k tokens. `viewport-3d.tsx` is 14,774 lines, so every lane greps by name and reads only the block it touches.

Every gate below measures the **picture** (pixels, or the triangle count the renderer drew), not the state it was handed. Every must-fail is a one-line sabotage of the wiring that the gate has to catch red.

### Phase 1a · the timed schedule, no UI (buildable tomorrow)

**Does:** `StrokeTiming` rows, the arrival-time keys, `beat := clock` when timed, the tip's slope channel, the doc-store field. Driven from a harness hook, `window.__fsTake.set(...)`.

**Files:** new `lib/take.ts`; `lib/stroke-schedule.ts` (timed tracks, a `timed` flag beside `identity`, strike the comment at `:99-102` and `:232-242`); `lib/pen-reveal.ts` (third tip channel); `components/viewport-3d.tsx` (the beat block near `:5936-5944`, the tip uniforms near `:6592`, the bake near `:4981`); `app/page.tsx` and `lib/doc-store.ts` (the field); new `scripts/verify/assert-stroke-timing.mjs`.

**Gates, on the real viewport:**
- **Speed moves the picture.** Stroke 3 at speed 2: its last triangle is drawn at `t1` within one frame, and at its old midpoint time its drawn count is its full count. **Must-fail:** `speed` read as 1 inside the key bake.
- **Delay moves the picture.** Stroke 3 delayed 500 ms: zero of its triangles are drawn before `t0`, and some are drawn one frame after. **Must-fail:** `delayMs` dropped.
- **Hold back.** At `takeMs - 1 frame`, stroke 5 is the only partial stroke and every other stroke is whole. **Must-fail:** `holdBack` ignored.
- **Ease.** At the middle of stroke 3's slot, its drawn fraction equals `ease(0.5)` within 2% for `out` and differs from linear by more than 10%. **Must-fail:** ease replaced by linear.
- **The nose rides.** Nose-to-ink gap under speed 2 stays inside the existing `assert-stroke-schedule` bound. **Must-fail:** the slope channel read as 1.
- **Identity.** No rows: the render is byte-identical to HEAD on every engine. **Positive control:** one row with `delayMs: 1` is NOT identical.
- **Export matches live.** `planFrames` then seek: frame N's drawn counts equal the live counts at the same clock, twice in a row. **Must-fail:** the sampler reads `performance.now()`.

### Phase 1b · the stroke timeline you can drag

**Does:** drag a bar's body (delay), drag either end (speed), select a row, the row's speed, ease, delay and Hold back in the Animation tab and the Timing popover, one Reset per stroke.

**Files:** `components/take-timeline.tsx` (pointer handling, selected row, the look of a draggable bar); `components/draw-in-timing-controls.tsx` (the selected stroke's block); `app/page.tsx` (patch handler); new `scripts/verify/assert-stroke-timeline-drag.mjs`.

**Gates:** a synthetic pointer drag of bar 3's right edge by +50% of its width changes the next frame's stroke-3 drawn count at a fixed clock, and the bar's rendered width matches `t1 - t0` within 1 px. Every control in the stroke block, moved once from default, changes a pixel hash of the mark at a fixed clock (the `silent-degradation` rule: a control that moves nothing fails). **Must-fail:** the drag handler updates the bar's CSS but never calls the patch.

### Phase 2 · perform it

**Does:** a Perform button. He picks a stroke (or the whole word), and while he moves the pen or mouse along it the take records WHEN he reached each point. His timing becomes that stroke's slot and its own pace curve. Nothing about the ink's shape changes.

**Files:** `lib/take.ts` (`PerformedTake`, the fit from a gesture to per-stroke pace); a small `components/perform-overlay.tsx`; `components/take-timeline.tsx` (a performed row reads as his); gate script.

**Gate:** a scripted gesture that dwells 1 s at stroke 3's midpoint produces a 1 s stretch where stroke 3's drawn count holds still in the render, then resumes. **Must-fail:** the recorded times discarded and the stroke's recorded pace used instead.

### Phase 3 · keys and a curve editor

**Does:** keys on draw progress per stroke, depth, turn and camera (az, el, fill), a curve between two keys that he shapes by dragging two handles. Width comes in 3b, because no live width uniform exists today (grepped: none in `viewport-3d.tsx`), and a width change is a geometry rebuild on Solid and Extrude.

**Files:** `lib/take.ts` (tracks, `value(channel, t)`); new `components/key-lanes.tsx` and `components/curve-editor.tsx` (or the library the §6 check picks); `components/viewport-3d.tsx` (write sampled depth and turn into the flatten ref, camera into `orbitView`); gate script.

**Gates:** for each channel, two keys with different values move the matching measured quantity between them: silhouette width for turn, the shaded band for depth, the mark's projected bbox for camera. Dragging a curve handle changes the value at the span's midpoint and not at either key. **Must-fail per channel:** the sampled value computed and never written to the ref.

### Phase 3b · width

Rod and Inflate first, as a vertex offset along the normal from a uniform. Solid and Extrude get it at twos through a rebuild, or wait, and the lane says which.

### Phase 4 · custom under every preset, saved as his own

**Does:** every preset in the Animation tab opens into the full take it is (timing rows, keys). Editing it makes it "Custom (from X)". Save names it and it sits in the list beside the shipped ones. Covers the 07-28 reserved list: Custom Geometry, Material, Texture, Dither, ASCII, Stack and Fusion Animation, in that order, one lane each after Geometry.

**Gate:** apply preset, change one key, save, reload: the reloaded frame at a fixed clock hashes equal to the pre-reload frame and differs from the untouched preset. **Must-fail:** save writes the preset id instead of the take.

### Phase 5 · camera moves, eased, each for a reason

**Does:** a short list of camera moves as camera-key presets on Phase 3's tracks, each with a one-line reason shown beside it (the `BEAT_NOTES` pattern). No move without a reason line. Every move eases in and out, and a hold means the camera stops.

**Gate:** per move, the camera's frame-to-frame angle change is zero across its held frames and never jumps more than the eased maximum between two frames (the "abrupt" he named on 08-01). **Must-fail:** linear ease swapped in, which the max-step check catches at the move's ends.

---

## 6 · The Theatre.js check the next lane runs before Phase 3

Not run here. Record the answers in `docs/research-2026-09-25/animation-tools/theatre.md`:
1. Licence of `@theatre/core` and of `@theatre/studio` (they may differ), from the repo, not from memory.
2. Gzipped size of core alone and of studio, from bundlephobia or a local build.
3. Can `sequence.position` be set from our clock every frame, with Theatre's own playback never started? That is the only way it fits one clock.
4. Does core run with no DOM, for a headless export check?
5. Can Studio's graph editor be mounted on data we own, or does it own the data?

If 3 and 5 are yes and the licence fits, Studio becomes the Phase 3 curve editor over our keys. If not, the editor is ours, and `cubicBezierEase` is the curve.

---

## 7 · Decided, and not decided

**Decided, because the code says so:** our clock stays the only clock; per-stroke timing is baked into the arrival-time keys; the identity path stays untouched; export needs no change; width is its own phase because nothing live carries it.

**Not decided, and it is his call:** see the one question in the handback.

Nothing was built. This is a plan.
