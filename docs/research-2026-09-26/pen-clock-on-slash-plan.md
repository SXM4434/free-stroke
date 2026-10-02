# The pen clock on `/`, a build plan, 2026-09-26

Read-only planning lane on main at `95f724f87`. Nothing was built, run or opened. Every line number below
was read on that commit.

**Recommendation.** Add a Geometry Animation preset, **Hand Draw**, backed by one new field on the reveal
envelope, `clock: "recorded" | "hand"`. When the field says `hand`, one memo in `app/page.tsx` re-stamps the
strokes' timestamps with `stampPenClock` itself, upstream of the viewport, the stroke strip and the take
provider. Every clock reader on `/` then gets the hand without being edited. When the field says
`recorded`, the memo hands back the same arrays, so the take is byte-identical to main.

The ask it closes is his most repeated one: *"teh hwoel reason im usuing the free stroke ap was for its
drawing anaimtion"* (ledger row 36), and *"recreating will nevr fele right diecet usuage alway will"* (row 8).
The benchmark is ruled: *"Desk Doodles' draw-in is the benchmark"* (`docs/rulings/2026-08-01.md:8`), and the
09-25 ruling puts all of it on `/` (`docs/rulings/2026-09-25-animation-comes-back.md`, "All of it lives in
the main app on `/`").

---

## 1. How each page builds its clock today

Both pages share the same reveal. The one difference is **where each point's `t` comes from.**

### `/`

1. **The strokes.** He draws on `DrawingCanvas` (`app/page.tsx:2468`), and the pointer's own timestamps
   become `rawStrokes`. `processStroke` (`lib/stroke-processing.ts:971`) resamples them and carries `t`
   along. With hand-feel off it returns the resample untouched (`:994`), so geometry never reads `t`.
   The dev inject path bakes a flat 16 ms per point and 120 ms per gap (`app/page.tsx:1685-1686`), the same
   metronome Desk Doodles measured at r = 0.9986 (`app/desk-doodles/page.tsx:152-155`).
2. **The take's length.** `takePenMs = penMsOf(rawStrokes)` (`app/page.tsx:734`) goes to
   `StrokeTakeProvider` (`:1790`), which is where the strip reads `penMs` (`components/stroke-strip.tsx:87`,
   `:215`). The viewport computes its own from the same array: `penMs` (`components/viewport-3d.tsx:11280`)
   and Scene's `computedDuration` (`:9444`).
3. **Time to distance.** `revealDistanceFraction` (`lib/pen-reveal.ts:168`) calls
   `penTimeDistanceFraction` (`:95`), which walks the processed points' `t` and returns how much arc the pen
   had covered. `raw` (Authentic) plays that. `hybrid` (Natural) blends it toward an even pace per stroke,
   `penStrokeEvenFraction` (`:239`). Lifts hold only while `liftsLandBetweenStrokes` (`:207`) says the slots
   are as drawn.
4. **The pace table.** `paceFromCurve` (`lib/stroke-timing.ts:147`) samples that curve once. Then
   `buildTimedSchedule` (`:346`) lays the strip's rows over it and returns the slots and `takeMs`. The
   viewport builds it at `components/viewport-3d.tsx:9457-9487`, and the strip builds its own copy the same
   way from the strokes the viewport hands it (`components/stroke-strip.tsx:221-230`, rendered from
   `components/viewport-3d.tsx:14381-14387`).
5. **Per frame.** With a timed take: `timedRevealKeys` (`components/viewport-3d.tsx:6412`) and `sampleTake`
   (`:6538`). Without one: `revealDistanceFraction` straight off the playhead (`:6292`, `:6339`).
6. **Keys.** `revealClockMs` (`lib/keyframes.ts:265`) remaps the clock through the drawProgress track before
   the take reads it (`components/viewport-3d.tsx:7840`).

### Desk Doodles, through `stampPenClock`

1. `buildTracedStrokes` (`app/desk-doodles/page.tsx:173`) calls
   `stampPenClock(polylines, clock, { nibDiameter: HERO_INK_WIDTH_PX, dropSubNibStubs: true })` (`:175`).
   The font path calls it at `:380` with stubs kept, because a font's short strokes are authored dots.
2. `HERO_INK_WIDTH_PX` is `computeSolidEffectiveThicknessPx(DEFAULT_SOLID_PARAMS.thickness)`, defined just
   below `buildFontStrokes`.
3. The page memoises the stamped set (`:1546-1551`), runs `processStroke` over it (`:1622`), and from there
   the reveal is the same `revealDistanceFraction` `/` uses.
4. `stampPenClock` (`lib/pen-reveal.ts:1732`) is the one entry point. `"uniform"` routes to
   `timeStrokesUniform` (`:1461`), the parked 12 ms per point prior kept as the negative control.
   `"lognormal"` routes to `timeStrokesByPenModel` (`:1624`).

### What the pen model computes that `/` does not

| | pen model | `/` today |
|---|---|---|
| **One hand for the word** | `drawHandState(opts.handSeed)` once (`pen-reveal.ts:1632`), so every stroke shares one set of hand parameters | whatever device he drew with |
| **Speed inside a stroke** | `reconstructPenKinematics` per stroke, coarticulation 0 and ink modulation 0, gives a duration and a `timeNorm` per point (`:1638-1657`). Sigma-Lognormal: each submovement starts and ends at zero speed | a mouse's speed, or a flat 16 ms per point from inject |
| **Lifts by distance** | `humanLiftsMs` (`:1692`): 90 to 150 ms inside a letter, 150 to 300 between letters, 300 to 600 between words (`LIFT_BANDS_MS`, `:1682`). Where a lift sits in its band is the travel across it, top of band at 8 nibs (`:1689`) | the gap his hand took to move the mouse, or a flat 120 ms |
| **The nib** | sets the letter map (`assignLetters` at nib width) and the lift travel. Its effect on stroke durations is **not measured here** | not read by the clock |
| **Landing** | a stroke's first ink goes down at zero speed and builds | first ink at whatever speed the pointer had |
| **Short strokes** | under 3 points keeps 12 ms per point rather than an invented curve (`:1638`, `:1650`) | n/a |

---

## 2. What the viewer sees differently

*"Smooth but weightless"* is a draw-in with no moments. The hand model gives four, and `/` has none of them
on an injected word and only accidental ones on a mouse take.

| key shot | what you see with the hand | what `/` shows |
|---|---|---|
| **K1 · THE TOUCHDOWN** | the ink creeps for its first few pixels, then runs | full speed from the first pixel |
| **K2 · THE CORNER** | the stroke slows into the k's elbow and picks back up. The line looks like it decided to turn | one speed through the corner, which reads as a plotter |
| **K3 · THE LIFT, IN THREE LENGTHS** | a short beat inside a letter, a longer one between letters, the longest at the word space. The pause alone tells you where a letter ends | 120 ms everywhere on inject. On a mouse take, long uneven gaps that follow the mouse, not the letters |
| **K4 · THE RUN-OUT** | the tail slows as it lands, then stops | stops dead |

K2 and K3 carry the weight. K3 is also the only still moment in the take, and per the storyboarding skill a
hold only reads as a hold if something stopped. The build lane measures both, off the pixels, before and
after: **% of the take held still, count of lifts, and where each stroke's half-arc pose lands as a % of its
slot.** An even clock puts that pose at 50% on every stroke, which is the mechanical spacing. I did not
measure what the hand gives.

---

## 3. The wiring

### Where it plugs in

**`app/page.tsx`, one memo, three reads switched.** Not the viewport. The strip gets its strokes through
the viewport but its `penMs` from the page (`:734`), so a swap inside the viewport would leave the strip's
seconds axis on the recorded length while its slots moved to the hand. At the page both change together.

```ts
// after rawStrokes / processedStrokes, beside takePenMs
const clockNib = computeSolidEffectiveThicknessPx((solidParams ?? DEFAULT_SOLID_PARAMS).thickness)
const clocked = useMemo(() => {
  if (revealEnvelope.clock !== "hand") return { raw: rawStrokes, processed: processedStrokes }
  const stamped = stampPenClock(
    processedStrokes.map((s) => s.points),
    "lognormal",
    { nibDiameter: clockNib },            // dropSubNibStubs stays OFF, see below
  )
  const processed = processedStrokes.map((s, i) => ({ ...s, points: stamped[i].points }))
  return { raw: stamped, processed }
}, [rawStrokes, processedStrokes, revealEnvelope.clock, clockNib])
```

Then:

- `takePenMs` (`:734`) reads `clocked.raw`.
- `viewportStrokes` (`:1256`, the non-crash branch) reads `clocked.processed`.
- `Viewport3DWrapper rawStrokes=` (`:2487`) reads `clocked.raw`.
- `DrawingCanvas` (`:2468-2469`) keeps the recorded arrays. The input canvas is the recording.

Everything downstream follows with no edit: Scene and the 3-up compare (`components/viewport-3d.tsx:13889`,
`:14000`), the strip (`:14383`), `penMs` and `exportMs` (`:11280`), video export (`:13585`), and the
"no speed variation" note under Natural and Authentic (`measureTimingCharacter`, `:11177`).

### Why the processed points, and why stubs stay on

- **Processed points in, processed points out.** `stampPenClock` returns the points it was given with a new
  `t`, so x and y are the rendered points exactly and geometry cannot move. It also matches Desk Doodles'
  input: the trace is already on a 4 px arc-length grid (`app/desk-doodles/page.tsx:152-153`), and `/`'s
  processed strokes sit on the spacing grid. Stamping the raw mouse points and re-running `processStroke`
  would feed the model pointer jitter.
- **`dropSubNibStubs` must stay off.** The take is keyed by stroke index (`lib/stroke-timing.ts:95-100`).
  Dropping a stroke renumbers every row after it with no error, the same hazard the option's own comment
  names for fonts (`lib/pen-reveal.ts:1485-1492`).
- **The build lane must confirm** that every `rawStrokes` read in the viewport uses only `t`.
  `useTimeline` (`components/viewport-3d.tsx:898`) reads the min and max `t`. I did not trace the rest.

### Inputs `/` supplies

| input | value | why |
|---|---|---|
| polylines | `processedStrokes[i].points` | above |
| clock | `"lognormal"` | the model, never the uniform prior |
| `nibDiameter` | `computeSolidEffectiveThicknessPx(base thickness)` | the number the strip already uses for its letter map (`stroke-strip.tsx:219`, `take-timeline.tsx:307`). Base thickness only, never the keyed width track, or the clock would change under its own playback |
| `handSeed` | omitted | one default hand, so the take and its export are deterministic |
| scale | none | `/`'s strokes and the nib are both in canvas px, the space `humanLiftsMs` and the kinematics expect |

### How it is offered, three options

**A · A Geometry Animation preset plus a `clock` field. Recommended.**
- `RevealEnvelopeParams` gets `clock: "recorded" | "hand"` (`lib/stroke-schedule.ts:376`), default
  `"recorded"` in `REVEAL_ENVELOPE_DEFAULTS` (`:392`). Doc-store reads a missing field as `recorded`, so old
  docs open unchanged.
- A new entry in `GEOMETRY_ANIMATION_PRESET_DEFS` (`lib/style-system.ts:4664`):
  `drawIn { order: "asDrawn", overlap: 0, align: "start", unit: "stroke", reverse: "off" }`,
  `revealWindow { mode: "grow", length: 0.25 }`,
  `envelope { mode: "raw", clock: "hand", ease: "linear", delaySeconds: 0, loop: false, reverse: false }`.
  Mode is `raw` because Natural would blend the hand toward an even pace and flatten K2.
  Description: *"A modelled hand writes it: slower into corners, quicker through curves, a short lift inside
  a letter and a longer one between words."*
- The preset path spreads the defaults under every patch (`app/page.tsx:1407`), so clicking Smooth Reveal
  after Hand Draw goes back to `recorded` without every preset having to name the field.
- Custom under every preset (ruling item 4): the same field shows as a **Clock: Recorded / Hand** toggle in
  the envelope controls (`components/draw-in-timing-controls.tsx`), through `handleRevealEnvelopeChange`
  (`app/page.tsx:695`), so it is one undo step and rides the saved doc.

**B · A third pace pill beside Natural and Authentic.** `RevealMode` (`lib/pen-reveal.ts:78`) is read at
about thirty places in the viewport alone, and in the strip and `take-timeline.tsx`. Worse, it is the wrong
axis: the hand is a clock, and Natural and Authentic are ways of reading a clock. Natural over the hand is a
real combination that a third pill would rule out.

**C · The hand as the default clock.** It breaks "off is byte-identical to main", and it breaks Authentic
Draw's own promise, *"Your hand's own pace and order, nothing shaped. The recording, played back."*
(`lib/style-system.ts:4671`). Whether Hand Draw becomes the default is his call, after he has seen it.

**Why A.** Presets are how `/` already offers motion (`resolveMotionPreset`, `lib/style-system.ts:4744`), the
field sits on the one axis it belongs to, and it leaves Natural and Authentic meaning what they mean today,
applied to whichever clock is chosen.

---

## 4. Every interaction

### The stroke strip

Rows are relative. `delayMs` is a shift from where the schedule put the slot, `speed` a ratio against the
base pace (`lib/stroke-timing.ts:69-86`).

- **Delay and speed drags.** No code change. Under the hand the base slot is the hand's slot, and a +200 ms
  drag stays +200 ms from it. Toggling the clock keeps each dragged row's offset and moves its base. That is
  what a relative row means.
- **Hold back.** Lands after the hand's last stroke. No change.
- **Ripple.** The carry is walked over slots (`withPerformed`'s loop, `:884-903`, and the build). No change.
- **Seconds axis.** Follows, because both its strokes and its `penMs` switch at the page.

### Perform, whose own take must win

**This is the one that breaks without new code.** A performed row stores
`delayMs = f.t0 - B0` and `speed = (B1 - B0) / (f.t1 - f.t0)` against the base slots at the moment of the
take (`withPerformed`, `lib/stroke-timing.ts:876-905`). Swap the clock under it and B0 and B1 move, so the
slot he performed moves and stretches.

- **Fix.** A pure `rebasePerformed(take, oldBaseSlots, newBaseSlots)` in `lib/stroke-timing.ts`: read each
  performed row's absolute `[t0, t1]` under the old slots, then call `withPerformed(take, newBaseSlots,
  fits)` with those. Base slots come the way the strip computes them
  (`components/stroke-strip.tsx:241-242`). It runs in the same edit as the clock change, one undo step.
- The pace inside a performed slot needs nothing: `performed` already replaces the clock's pace and ease
  inside the slot (`:78-84`).
- **Perform under the hand clock** works unchanged. Its base slots come from the hand's pace.

### Keys: the drawProgress remap in `revealClockMs`

Keys are stored in absolute ms. `revealClockMs` maps a drawProgress value `p` to `p × takeMs`
(`lib/keyframes.ts:265-269`), so a key at 0.4 still shows the drawing at 40% of the hand's take. Camera,
depth, turn and width keys stay at their ms, and `keysEndMs` (`:276`) keeps the timeline long enough for a
key past the new end.

**Keys are not rescaled on a clock change.** A preset that rewrote his keys would be a silent edit. He sees
them against the new length on the key lanes and moves them if they no longer fit.

### Camera moves keyed off the lifts, "Turn in the lifts"

`orbit-lifts` (`lib/camera-moves.ts:204-230`) reads the slots **once, when applied**, and bakes keys.
Lifts under `minLiftMs` 120 ms are skipped (`:211`).

- Applied under the hand clock: between-letter and between-word lifts are 150 ms or more, so any word with
  two letters gives it lifts to turn in. Most within-letter lifts, 90 to 150 ms, fall under 120 and do not
  turn. That is right: a turn inside a letter would slide the line.
- Applied before a clock change: the baked keys now turn while the pen draws. **The build lane checks
  whether the take records which move made its camera keys.** If it does, re-apply the move on a clock
  change, in the same undo step. If not, the camera lane shows *"Turn in the lifts was placed for the
  recorded timing. Apply it again."* I did not check which is true.

### Inflate's shader holds, `uFsTipHold`

The holds come only from performed rows: flat runs of 50 ms or more (`PERFORMED_HOLD_MIN_MS`,
`lib/stroke-timing.ts:837`) through `performedHolds` (`:839`) into the bake
(`components/viewport-3d.tsx:5418`, eight slots, `TIP_HOLD_MAX` at `:2587`). The hand clock has no pen-down
stops, so with no performed rows the list stays empty, the same as today. With performed rows the holds
ride their slots, which the rebase keeps where they were.

### Export

Export reads the viewport's `processedStrokes` and `exportMs` (`components/viewport-3d.tsx:11276-11280`,
`:13585`), both switched upstream. GLB and PNG geometry cannot change because x and y do not. Video plays
the hand clock. The clock lives on the envelope, so a saved doc reopens on its own clock.

### What does not change

`app/desk-doodles/page.tsx` keeps calling `stampPenClock` itself. Row 37, stroke order that follows how a
hand writes the letter, is not touched: the hand clock times the order he drew.

---

## 5. Gates and new rows

Each row names its must-fail. A row with no must-fail is not a gate.

| # | gate | passes when | must-fail |
|---|---|---|---|
| PEN-1 | **It is the pen model, not a copy** | clock `hand`: every processed point's `t` on `/` equals `stampPenClock(points, "lognormal", { nibDiameter })`, and `revealDistanceFraction` on `/`'s strokes equals it on the stamped set at N = 64 sampled clock fractions, to 1e-9 | a knockout that stamps with `"uniform"` diverges at one sample or more. Static half: `timeStrokesByPenModel` and `humanLiftsMs` are defined only in `lib/pen-reveal.ts`, and `app/page.tsx` imports `stampPenClock` |
| PEN-2 | **Off is main** | clock `recorded`: `viewportStrokes` is the same reference as `processedStrokes`, `takePenMs` is equal, and export frame hashes for Authentic Draw and Smooth Reveal on the fixture match main at `95f724f87` byte for byte | a knockout that ignores the field and always stamps changes the hashes |
| PEN-3 | **Geometry holds** | hand against recorded: every point's x and y equal, GLB buffer equal | stamping raw points and re-running `processStroke` with hand-feel on moves points |
| PEN-4 | **No stroke disappears** | stroke count and every row's stroke index equal across the toggle | the fixture carries a tap shorter than one nib, such as an i's dot. Turning `dropSubNibStubs` on drops it and the gate goes red |
| PEN-5 | **The strip matches the stage** | strip `slotsRef` equals the viewport's `timed.slots` under the hand clock, to 1 ms | leave the provider's `penMs` on the recorded `rawStrokes` (`app/page.tsx:734`) and the slots split |
| PEN-6 | **Lifts land in three lengths** | on a two-word fixture, each screen hold at a stroke boundary equals `humanLiftsMs(...).ms[k]` within one frame, and the medians order within-letter < between-letters < between-words | the uniform clock shows a flat 60 ms at every boundary |
| PEN-7 | **Perform wins** | perform one stroke, toggle the clock both ways: its absolute slot `[t0, t1]` holds within 1 ms and `performed` is identical | skip `rebasePerformed` and the slot moves |
| PEN-8 | **Keys hold their meaning** | a drawProgress key at 0.4 shows 40% of the arc under the hand take, and every key's `tMs` is unchanged by the toggle | a knockout that rescales keys by the length ratio |
| PEN-9 | **Presets own the field** | Hand Draw then Smooth Reveal leaves `clock` at `recorded` | drop the defaults spread at `app/page.tsx:1407` and the hand leaks into Smooth Reveal |
| PEN-10 | **The camera turns only in lifts** | "Turn in the lifts" applied under the hand clock: yaw speed is zero inside every stroke slot, plus or minus one frame | apply under recorded, swap the clock, skip the re-apply: yaw moves inside a slot. The same check catches the stale-keys case |
| PEN-11 | **Shortest stroke on screen** (row 40) | measured and reported: the shortest stroke's screen time under the hand clock with neutral rows | the uniform clock on the stub fixture shows the flat-clock minimum. A speed row can still push any stroke under 100 ms, so this reports a number rather than claiming row 40 closed |

Ledger rows 8, 36, 38 and 39 move to PRESENT only after PEN-1 to PEN-7 pass **and** he has watched it on his
own drawing. Row 40 moves on PEN-11's number. Row 37 stays UNKNOWN.

---

## 6. Risks, and whose call each is

**Biggest risk: Perform.** Performed rows are relative to the base slots, so a clock swap silently rewrites
the one take he performed by hand. PEN-7 and `rebasePerformed` exist for this.

**Second: the strip and the stage split.** The strip's strokes come through the viewport and its length
comes from the page. Plugging in at the page closes it, PEN-5 proves it.

**Third: his mouse strokes as model input.** The model was tuned on a trace and a font. A jittery mouse path
may segment into submovements oddly. Only his eye on his own drawings can say.

**Fourth: the weight dial retimes the lifts.** The nib sets the letter map and the lift travel, and the model
says so on purpose, *"Write the number down and it is wrong the moment the weight dial moves"* (the stub
block above `subNibStubCensus`, `lib/pen-reveal.ts:1580`). Pinning the clock's nib to the default thickness
is the other option.

**Fifth: cost.** `reconstructPenKinematics` runs per stroke on every edit. The build lane times the memo on
the 22-stroke fixture and on a 200-stroke drawing before shipping.

**Sixth: stale camera keys** after a clock change, above.

| a gate decides | his eye decides |
|---|---|
| clock equality, off is main, geometry, stroke count, strip parity | whether Hand Draw writes like a hand on his own marks |
| lift lengths against the model, Perform's slot, keys, preset ownership | whether the weight dial should retime the lifts |
| camera yaw inside slots, shortest stroke | whether Natural over the hand should be offered |
| | the preset's name, and whether it becomes the default |

**Nothing was built.** This is a plan. The files a build lane touches: `app/page.tsx`,
`lib/stroke-schedule.ts`, `lib/style-system.ts`, `lib/stroke-timing.ts`, `lib/doc-store.ts`,
`components/draw-in-timing-controls.tsx`, and `lib/camera-moves.ts` only if the move id is not already
stored.
