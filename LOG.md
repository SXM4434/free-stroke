MERGE-READY

# CLOUD-SCHEDULE log, 2026-10-02

Branch `cloud/schedule`, cut from the integration snapshot `2cc9e98` (main plus the dockview layout, keyframe anything, Hand Draw phase 3, the carve fix). Coverage item 13 (rows 14, 31, 32, 33) and plan 3b (Stagger), in `lib/stroke-schedule.ts` and `lib/stroke-timing.ts`. Five steps plus one review fix, one commit each, each pushed. Nothing under `docs/thinking` or `docs/verification` is touched. The harness that ran this lane also names `claude/stroke-schedule-controls-wrxpad` as its working branch; the same commits are mirrored there, nothing else.

Every control is off by default, and off is byte for byte today: row IDENTITY in the new gate compares schedules, keys, slots, lifts, `sampleTake` spans, the cull's front, performed holds and the tip field against `2cc9e98` itself (56 schedule and take cases on the hero and every engine-node shape).

## Steps

### 1 · 724f952 · Stagger preset (plan 3b)
- `withStagger(take, baseSlots, { gapMs })` writes each stroke's `delayMs` so starts fall `gapMs` apart in base order. The first stroke keeps its start. Speed, ease and a performed pace are kept. A held-back stroke is left alone and still lands last. Under Ripple the carry is taken out, so the starts land where asked either way. Delays are whole ms.
- **Stagger** in Geometry Animation (`lib/style-system.ts`), `stagger: { gapMs: 50 }`, applied by `applyMotionPresetById` against the base slots of the clock the preset sets, inside the same `edit()`: one undo step.
- A **Stagger** button in the strip's row, through `commit`.

### 2 · dcc7b92 · Per-stroke reverse (row 31)
- `StrokeTiming.reverse`. A reversed stroke runs from its far end in the same slot on the same pace: arc `a` arrives when its mirror `from + to - a` did. It flips the schedule's Direction again, so on top of Direction "All" the stroke runs forward.
- The keys, `sampleTake`, `timedFront`, `performedHolds` and the tip field all read it. Perform is handed the effective direction, and a re-take keeps the flag.
- **Reverse** in the stroke block (next to Hold back) and in the strip's row for the selected bar. The session reader keeps the field and names junk.

### 3 · c4f6dc3 · Stagger curve (row 14)
- `staggerStarts(m, gapMs, ease)`. Even is `k * gapMs`. With an ease, the same total spread is laid out along it, so the first and last starts stay where Even puts them. An overshooting curve is clamped and never runs a start backwards.
- In the strip: the gap in ms and a curve picker (Even, Ease in, Ease out, Ease in-out) beside Stagger. The row now wraps instead of pushing the strip sideways.

### 4 · b5a3c3b · Max gap (row 32)
- `StrokeTimingTake.maxGapMs`. The pauses are the gaps in the ink, found the way `takeLiftsMs` finds them. That covers a lift inside a slot (the Hand clock) and a gap a row opens (a delayed held-back stroke) as well as gaps between slots.
- Each pause longer than the cap plays in the cap. This is a time warp on the take's clock that is the identity across ink, so no stroke draws faster.
- `rawSlots` keeps the uncut clock that the per-stroke maps read; `slots` and `takeMs` are cut. A max gap with no rows still times the take.
- **Max gap** toggle and its ms in the strip (150 ms when first turned on). The session reader keeps it and names junk.

### 5 · 18c0466 · Tap order (row 33)
- Order **Tap order** (`"tapped"`) with `DrawInParams.taps`. Tapped strokes draw in tap order, a group where its first-tapped member was tapped, and untapped ones follow as drawn.
- Taps are cleaned against the stroke count and read only under Tap order, so every other order gives today's object. They are carried in the schedule's `sig`.
- In the Order block: one chip per stroke. A tap puts it next and shows its place, a second tap takes it out, Clear empties the list, and each tap selects the bar in the strip. The session reader keeps the taps and names junk.

### Review fix · 2699c17 · the viewport's copy of the take
`components/viewport-3d.tsx` rebuilds the take field by field before building the timed schedule. It named neither `reverse` nor `maxGapMs`, so steps 2 and 4 moved the strip and the export sampler but not the stage, which is how ANIM-2C once lost `performed`. Both now ride through, with knockouts `reverse` and `maxGap` for browser must-fails. `__fsTake.set` takes `{ maxGapMs }`. New source row STAGE-FIELDS reads the field names off the interfaces with the TypeScript parser and requires the copy to read each one.

Rod: while a row is reversed or a max gap cuts something, Rod takes the `sampleTake` spans, as a reordered schedule does, because its own pen time through `[t0, t1]` cannot express either.

## Checks

Every Node check below was run on a worktree of each commit, and again on `2cc9e98` unchanged. The lane's numbers match the snapshot's on every check except the new gate.

| check | `2cc9e98` (unchanged) | lane head `2699c17` |
|---|---|---|
| tsc | 6 errors (5 geometry-engines, 1 handFeel) | 6, same 6 |
| assert-keyframes | 16/16 rows, 21/21 mutants | 16/16, 21/21 |
| assert-key-paths | 6/7, 8/8 (EXISTING red) | 6/7, 8/8, same red row |
| assert-width-keys | 12/12, 9/9 | 12/12, 9/9 |
| assert-camera-moves | 11/11, 20/20 | 11/11, 20/20 |
| assert-flip-pose | 8/8, 10/10 | 8/8, 10/10 |
| assert-stroke-timing | 16/16, 12/12 (with `STROKE_TIMING_BASE=2cc9e98`, see below) | 16/16, 12/12 |
| **assert-schedule-controls** (new) | n/a | **23/23 rows, 25/25 mutants** |
| assert-style-contracts | 5 FAILED of 44 (EXISTING) | 5 FAILED of 44, the same 5 |
| assert-preset-registry | 61/61 | 61/61 |
| assert-param-guards | ALL PASS | ALL PASS |
| assert-drawin-monotone | 16 rows ALL PASS | 16 rows ALL PASS |
| assert-export-window --model | 12 PASS, 0 FAIL | 12 PASS, 0 FAIL |

Per step, the same set ran on each commit: 724f952, dcc7b92, c4f6dc3, b5a3c3b and 18c0466 all match the snapshot on every check. The new gate stood at 5/5 rows and 5/5 mutants after step 1, 10/9 after step 2, 12/11 after step 3, 17/17 after step 4 and 22/23 after step 5.

**assert-stroke-timing and its base.** The gate pins its IDENTITY base to `b0da66626`, which is not in this snapshot (one commit) or in `origin/main`. Run as written, it fails at RUN on the unchanged snapshot (0/1 rows, 0/12 mutants). It has an override for exactly this, `STROKE_TIMING_BASE=<rev>`. With `2cc9e98` it is 16/16 and 12/12 on the snapshot and on every lane commit, which makes its IDENTITY row "no rows is byte for byte the lane's starting point". No bar moved.

### assert-schedule-controls (new), every row with a must-fail shown firing

`node scripts/verify/assert-schedule-controls.mjs`. Node only, through `_ts-load.mjs`, on the hero's real keys and its real pace (`paceFromCurve` over `revealDistanceFraction`, built the way the strip builds it).

| row | what it holds | must-fail(s), all CAUGHT |
|---|---|---|
| IDENTITY | every control off: 56 cases byte-identical to `2cc9e98` | an empty take builds a timed schedule |
| STAGGER | k-th start = first + 50k ms (whole-ms delays, 0.446 ms worst), lengths kept | stagger gap ignored |
| STAGGER-RIPPLE | same under Ripple | stagger forgets the ripple carry |
| STAGGER-KEEP | speed and ease kept, held-back stroke still last | stagger writes neutral rows |
| STAGGER-PRESET | the preset exists, 40 to 60 ms, equals `STAGGER_GAP_MS` | preset at 500 ms |
| CURVE | in, out, in-out starts on the ease (0.497 ms worst), up to 211 ms from Even | curve ignored |
| CURVE-ENDS | ends kept, starts in order, overshoot and Ripple included | curve read without its clamp |
| REV-KEYS | arc arrives at its mirror's time; other strokes and the slot unchanged | keys ignore reverse; reverse dropped when rows are read |
| REV-DIRECTION | reverse on top of Direction "All" runs forward again | both of the above, and spans/front ignore reverse |
| REV-CLOCK | `sampleTake` = live keys, grow and travel, 60 clocks, Direction off and alternate | keys ignore reverse; spans ignore reverse |
| REV-FRONT | the cull's front walks a reversed stroke from its far end (24604 checks, 0 left out) | spans and front ignore reverse |
| GAP-CAP | 11 lifts on the hero (37 to 149 ms), cap 75 cuts 3, the others are exact, take loses exactly the cut; a cap above every lift is today exactly | max gap ignored; lifts read before the cut; cut to 0 |
| GAP-INK | every key moves up by the cuts before it, nothing else (94472 triangles, 0.0002 ms worst) | ignored; left out of the keys |
| GAP-ROWS | a pause a row opens is capped (held-back +2000 ms lands 80 ms after) | ignored; cut to 0 |
| GAP-CLOCK | `sampleTake` = live keys through the warp, with rows, Ripple and a reversed stroke (11.3M checks, 0 disagree) | ignored; not undone in the sampler; left out of the keys |
| TAP-ORDER | taps 3, 0, 7 draw first, the rest as drawn | taps ignored |
| TAP-GROUP | a group goes where its first-tapped member was tapped | taps ignored; placed by its last tap |
| TAP-CLEAN | junk taps dropped, repeats once, taps under other orders change nothing | taps read raw; taps read under every order |
| TAP-SIG | the cache key follows the taps | taps left out of the key |
| STAGE-FIELDS | the viewport's take copy reads every row and take field (source check) | copy drops reverse; copy drops max gap |
| DOC-GAP | max gap survives save and load, junk named | reader drops max gap |
| DOC-TAPS | taps survive, junk dropped and named | reader drops taps |
| DOC-REVERSE | reverse survives, junk named | reader drops reverse |

## What I could not run

- **No browser** in this lane, as asked. None of the controls has been clicked or seen. Not run: assert-stroke-timing-browser, assert-stroke-strip, assert-stroke-schedule, assert-take-persists, assert-motion-customize, assert-preset-pixels, assert-hand-clock, assert-data-safety, assert-custom-presets, assert-hit-targets and the browser half of assert-export-window. Chromium is not installed here, and `assert-stroke-schedule` stops at launch on the snapshot itself.
- Unproven without a page:
  - Stagger as one undo step.
  - The strip row's wrap at narrow widths, and whether the hit-target gate still likes it.
  - The stroke chips in the Order block.
  - That the stage draws a reversed stroke and a capped gap the way the Node rows say (the knockouts `reverse` and `maxGap` exist for that browser row).
- assert-preset-pixels and assert-motion-customize count the Geometry Animation pills; Stagger is a new pill. Whatever they expect will have to be read on a browser run.

## Known limits, stated

- The pen tip's nose on a reversed stroke is baked through the timed map, the same path the schedule's Direction "All" already takes. So it matches Direction's look, whatever that is. Not looked at.
- Under a max gap that cuts a lift inside a slot (Hand clock), dragging that bar's end in the strip reads the cut length as the stroke's length, so the speed it writes is a little off. Between-slot gaps (Recorded clock) are exact.
- Perform while Max gap is on records on the cut clock and stores against the uncut base slots, so a performed stroke after a cut pause lands early by the cut. Turn Max gap off to perform, or this needs a follow-up.

## Questions for the owner

1. Tap order: is a row of numbered chips in the Order block enough, or do you want to tap the strokes on the canvas itself? That is viewport work and needs a browser lane.
2. Stagger writes delays once, so moving the gap or the curve afterwards means pressing Stagger again. Do you want the stagger to stay live instead, as a setting on the take?
3. Max gap's first value is 150 ms (the hero's longest lift on the Natural pace is 149 ms; Hand's word space is 174 ms). Is that the right default?
4. Reverse runs a stroke backwards on its own timing profile laid over the mirrored path, which is Cavalry's Reverse Path. The other reading plays the stroke's film backwards in time, so its hesitations come in reverse order and an ease-out becomes an ease-in. Which one is "reverse this one stroke"?
