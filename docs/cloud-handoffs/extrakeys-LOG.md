# CL-EXTRAKEYS log, 2026-10-03

Branch `claude/extrakeys` in `~/.fs-lanes/cl-gaps`, cut at the integration head e5082126d. His ruling of 2026-09-26 (docs/rulings/2026-09-26.md, "Keyframe anything, not only the draw-in"): every numeric value gets a key button. The draw-in extras (Tip highlight, Pen pressure, Duration) had none, because they are fields on the reveal envelope and `KEYABLE_PATHS` is walked from the style state. This lane gives each one a diamond and a lane. Nothing else a person sees changes.

## Plan

**Three key paths**, named the way Customize already names the fields (`envelope.tipHighlight`, `envelope.pressureReveal`, `envelope.durationSeconds`). They live in their own list, `ENVELOPE_KEY_PATHS` in lib/keyframes.ts, beside `KEYABLE_PATHS`, so `styleAt` never walks them into the style state. `isKeyPath` and the range check in `validateTrack` take both lists, so `readKeys` (lib/doc-store.ts) reloads an extra's lane with no repair and refuses one outside its range out loud.

| path | range | step | how the draw-in reads it |
|---|---|---|---|
| envelope.tipHighlight | 0 to 1 | 0.05 | per frame, at the key clock the frame samples style on |
| envelope.pressureReveal | 0 to 1 | 0.05 | per stroke, the lane at the moment that stroke starts on the take's clock. Pressure keeps each stroke's start and end, so the take's length never depends on it |
| envelope.durationSeconds | 0.5 to 30 | 0.5 | as a rate over the take, see below |

Steps are the sliders' own steps. None is a whole number, so `settleStyleSample` clamps each sample to its range and leaves it smooth.

**How Duration is keyed, and why.** Read as a length at the take's clock, a keyed Duration would make the take's length depend on itself: the take ends at the clock `t` where `t = D(t)`, and a curve can cross that line zero times or three times. So the lane is read as a rate. At each moment the take advances at the pace that would play the whole take in `D(t)` seconds: the fraction drawn by key clock `t` is `P(t) = integral from 0 to t of ds / (1000 D(s))`, and the reveal reads the take at `P(t) * takeMs`. The take lands at the one `T` where `P(T) = 1`. `T` is well defined: the integrand is positive and at least 1/30000 per ms, so `P` rises strictly and `T` is always between 0.5 s and 30 s. A flat lane at `D` lands in exactly `D` seconds, the same as the unkeyed field. Off (0) is not keyable: a lane only runs between 0.5 and 30, and a key asked for while Duration is off is refused in words beside the diamond.

The warp lives in `revealClockMs`, so the view, the camera moves, the strip and the export read it from one place. `drawProgress`, when keyed, still remaps the take on its own and wins. `keysEndMs` includes `T`, so the transport always reaches the landing.

**The diamonds.** `KeySpot` and `KeyButton` take an optional `value`: the number the click keys, read from the envelope for the extras instead of the style state. The extras do not need the Style panel's keyed context. While an extra is keyed, its slider shows the lane's value at the playhead and an edit keys at the playhead, as a keyed style slider does.

**Gate rows** (new `scripts/verify/assert-extra-keys-node.mjs`, Node): PATHS (each path is keyable with its range and step), ROUNDTRIP (a keyed lane saves and reloads through `readKeys` unchanged, and one out of range is refused), TIP, PRESS and DUR (the draw-in reads the keyed value at the take's clock), LAND (the landing `T` is unique and a flat lane lands at `D`). Must-fails: a path left out of the keyable list, and the draw-in reading the unkeyed field.

## Steps

| step | commit | what |
|---|---|---|
| plan | | this file |
| 1 lib + view | (this commit) | lib/keyframes.ts: `EnvelopeKeyPath`, `ENVELOPE_KEY_PATHS` (ranges and steps as in the plan), `KEY_RANGE` for `validateTrack`, `isKeyPath` takes the extras, so `readKeys` reloads them unchanged. `envelopeValueAt`, `durationFractionAt` (the rate), `durationClockAt` (its inverse, bisection), `durationLandingMs` (kept per track), `pressureAmountAt`. `revealClockMs` reads the Duration warp when drawProgress is unkeyed. `keysEndMs` includes the landing. lib/clock-rebase.ts + lib/stroke-timing.ts: `clockStrokesFor(..., keys)` and `clockTail(..., amountAt)` time each stroke at the pressure lane's amount where it starts. app/page.tsx passes `keys` (memo deps: the two lanes) and `d.keys` on the stagger path. components/viewport-3d.tsx: a keyed Tip highlight mounts the glow, and the frame reads the lane at `keyReader.clockMs()` on `frameStyleKeys`. components/key-button.tsx: `isKeyablePath` takes the extras, `KeyEnvelopeCtx`, `KeyButton` and `KeySpot` read an extra's value from it, `useKeyedEnvelope` (shown at playhead, keyed edit). tsc after this step: 9 errors (baseline 6). |

## Stopped at the context gate (152k). What is left, in order

1. **components/draw-in-timing-controls.tsx, not touched yet.** Import `useKeyedEnvelope` and `KeyEnvelopeCtx` from components/key-button. In `DrawInTimingControls`: `const { shown, keyEdit } = useKeyedEnvelope(envelope)`. Wrap the return root (the `<>` at line 154) in `<KeyEnvelopeCtx.Provider value={shown}>`; the provider must sit above the panel's Field, which draws the KeySpot. In the Duration, Pen pressure and Tip highlight blocks, the label text and the slider's `value` read `shown.X`, and `onChange` becomes `const v = Number(e.target.value); if (!keyEdit("X", v)) patchEnvelope({ X: v })`. The Speed pills' `disabled` and their note (lines 718 and 732) read `shown.durationSeconds > 0`, since a keyed Duration sets the pace.
2. **Gate**, new `scripts/verify/assert-extra-keys-node.mjs` (Node, `_ts-load.mjs`, mutants like assert-drawin-extras-node). Rows: PATHS, ROUNDTRIP (`readKeys` keeps a valid lane with no repair and drops 1.2 on tipHighlight and 0 on durationSeconds out loud), TIP (`envelopeValueAt` at 3 clocks equals the lane), PRESS (`clockTail` with `amountAt` equals `pressureTimed` per stroke at the lane's amount at its start), DUR (`revealClockMs` equals `P(t) * takeMs`; a flat lane at D is the identity on a take of D s), LAND (one landing; flat D lands at D*1000 ms). Must-fails: `globalThis.__FS_EXTRA_MUTANT = "extras-unkeyed"` (draw-in reads the unkeyed field: TIP and PRESS red), `"duration-unread"` (DUR red), and a GATE_MUTATE_FILE sabotage that drops one entry of `ENVELOPE_KEY_PATHS` (PATHS and ROUNDTRIP red).
3. **Checks**: tsc must read 6. Rerun assert-keyed-playback, assert-keyed-ranges, assert-key-paths, assert-drawin-extras-node, assert-strip-recorded and report each N of M. None has been run on this branch yet.

## Known gaps, to say in the report

- A pressure lane edit re-times strokes but does not rebase performed rows the way an envelope change does (`rebaseForClock` is not handed the keys).
- The transport runs `max(takeMs, landing, last key)`. When the take as built is longer than a keyed Duration's landing, the finished drawing holds until `takeMs`.
- With both Pen pressure and Duration keyed, each stroke's start goes through a 48-step bisection when the clock memo reruns.

## tsc: the three new errors at 1a1e80f07 (fix first)

```
components/key-button.tsx(231,56): error TS2345: Argument of type 'StyleNumericPath | EnvelopeKeyPath' is not assignable to parameter of type 'StyleNumericPath'.
components/key-button.tsx(240,51): error TS2345: Argument of type 'StyleNumericPath | EnvelopeKeyPath' is not assignable to parameter of type 'StyleNumericPath'.
components/key-button.tsx(320,51): error TS2345: Argument of type 'EnvelopeKeyPath' is not assignable to parameter of type 'StyleNumericPath'.
```

## CL-EXTRAKEYS2, 2026-10-03: finishing the lane

Plan, in order, each its own commit by pathspec:
1. lib/key-edit.ts: `withKeyAt` and `withoutKeyAt` take `KeyPath`, so key-button.tsx types. tsc back to 6.
2. components/draw-in-timing-controls.tsx: `useKeyedEnvelope`, the `KeyEnvelopeCtx` provider above the Field, sliders read `shown`, an edit keys at the playhead, Speed pills off while Duration is keyed.
3. Two calls from the controller. (a) A Pen pressure lane edit rebases performed strokes the way an envelope change does (`rebaseForClock` handed the keys). (b) While Duration is keyed, the transport ends at the later of the landing and the last key, not at the take's built length.
4. Gate scripts/verify/assert-extra-keys-node.mjs: PATHS, ROUNDTRIP, TIP, PRESS, DUR, LAND, plus REBASE and END for step 3, with the log's must-fails and one per new row.
Then tsc and each gate's N of M.

### CL-EXTRAKEYS2 stopped at the context gate (151k). Done, and what is left

| step | commit | what |
|---|---|---|
| plan | 09108e349 | the plan above |
| 1 | 0545309f1 | lib/key-edit.ts:52, :64: `withKeyAt`, `withoutKeyAt` take `KeyPath`. tsc 9 to 6. |
| 2 | 32a121536 | components/draw-in-timing-controls.tsx: imports `KeyEnvelopeCtx`, `useKeyedEnvelope` (:27); `const { shown, keyEdit } = useKeyedEnvelope(envelope)` and `<KeyEnvelopeCtx.Provider value={shown}>` round the whole return (~:157, closes ~:927); Duration, Pen pressure and Tip highlight label, value and note read `shown.X`, onChange keys at the playhead through `keyEdit` else `patchEnvelope`; Speed pills `disabled` and note read `shown.durationSeconds > 0`. tsc 6. |
| 3 | 7760dc4b6 | (a) lib/clock-rebase.ts `keysMoveClock(before, after)` (pressure lane changed, or Duration lane changed while pressure is keyed; mutant arm `pressure-no-rebase`); app/page.tsx setKeys calls `rebaseForClock({ keys })` when it says so and writes `{ keys, take: rebased }` in one undo step (gate knock `clock-no-rebase-keys`). (b) lib/keyframes.ts `keyedLengthMs(takeLen, keys)`: while Duration is keyed, `keysEndMs` (the later of landing and last key), else `max(takeLen, keysEndMs)` (mutant arm `duration-takelen`). components/viewport-3d.tsx `takeTotal = keyedLengthMs(takeLen, keys)`, and `remapsReveal` is true whenever Duration is keyed (before this, a landing shorter than the take left lengthMs = takeLen and the warp was skipped). components/stroke-strip.tsx axis and seconds read `keyedLengthMs`. tsc 6. |
| 4 | (this commit) | scripts/verify/assert-extra-keys-node.mjs written, NOT RUN: rows PATHS, ROUNDTRIP, TIP, PRESS, DUR, LAND, REBASE, END; 7 must-fails (extras-unkeyed: TIP+PRESS; duration-unread: DUR; Pen pressure entry dropped: PATHS+ROUNDTRIP; pressure-no-rebase: REBASE; setKeys drops the rebased take: REBASE; duration-takelen: END; transport ignores keyedLengthMs: END). |

**Left, in order, for the next lane:**
1. scripts/verify/assert-drawin-extras-node.mjs line 528 and the mutant at line 659 look for `disabled={envelope.durationSeconds > 0}`, which step 2 changed to `disabled={shown.durationSeconds > 0}`. Change both strings to the new text and note it in the header as an input equalization (same meaning; `shown` is the envelope unless Duration is keyed). Until then DUR-WIRED reads red and that mutant reads MISSED.
2. Run `node scripts/verify/assert-extra-keys-node.mjs`; fix what is red. Most likely to need a look: REBASE (the base slots must move more than 1 ms under a keyed pressure lane on the default reveal mode; if they do not, pick a pace mode where pressure moves the slots and say so), DUR and LAND (hold keys built as `{ ...makeKey(t, v), easeOut: "hold" }`; confirm `validateTrack` accepts them).
3. tsc (must read 6), then each N of M: assert-extra-keys-node, assert-keyed-playback, assert-keyed-ranges, assert-key-paths, assert-drawin-extras-node, assert-strip-recorded, assert-handfix. None has been run on this branch.

**Known gaps to report:** the strip's bars stay on the take's built clock; with a keyed Duration landing before the take's built length, `k = axisMs / lengthMs` is above 1 and the bars run past the axis. With both Pen pressure and Duration keyed, each stroke's start goes through a 48-step bisection when the clock memo reruns.

## CL-EXTRAKEYS3, 2026-10-03: two gate checks re-anchored

Gate files only; product code read-only. Plan, each its own commit by pathspec:
1. scripts/verify/assert-drawin-extras-node.mjs: row DUR-WIRED and its five source-text must-fails ("clockTail ignores pressure", "clockTail runs pressure at 0", "/ memo does not re-run on pressure", "/ early return ignores duration", "/ memo does not re-run on duration") point at the new clock (`clockStrokesFor(..., keys)`, `clockTail(..., amountAt)`, the memo deps in app/page.tsx). Behaviour checks where a function can be called. Target 26 of 26, 40 of 40.
2. scripts/verify/assert-extra-keys-node.mjs row REBASE: a pressure lane and take where keyed pressure really moves base slots; a performed stroke keeps its on-screen slot after `rebaseForClock({ keys })`; an edit that does not re-time strokes does not rebase. Both must-fails fire. Target 8 of 8.
Then tsc (6) and each N of M: assert-drawin-extras-node, assert-extra-keys-node, assert-keyed-playback, assert-keyed-ranges, assert-key-paths, assert-strip-recorded, assert-handfix.

### CL-EXTRAKEYS3 done

| step | commit | what |
|---|---|---|
| plan | b7a5c6833 | the plan above |
| 1 | cbfbb0d58 | assert-drawin-extras-node DUR-WIRED calls `clockStrokesFor`: the take it hands back lands at the set duration (rate 1 at 3 s, rate 2 at 7 s, keyed Pen pressure at 3 s; recorded 15554 ms), off hands back main's arrays, and the clock memo's dependency list on / holds `revealEnvelope.durationSeconds` (the deps array is cut out of the memo, so the new lane deps do not break it). Speed pills check unchanged. Mutants: clockTail's unkeyed pressure branch is `} else if (pressure > 0)` now (both clockTail mutants), the early return also waits on `!pressureKeyed`, the memo deps end in `clockNib, keys?.[...]` (both memo mutants). 26 of 26, 40 of 40. |
| 2 | d7a4dfce1 | assert-extra-keys-node REBASE: at Overlap 0 every base slot sits on a stroke boundary, which pressure keeps, so nothing moved (0.000 ms in raw, hybrid and smooth, checked). The row now runs the default reveal mode at Overlap 0.3 on strokes that start light and end firm: stroke 4's base moves 266 ms, un-rebased it shows at [5324, 6776], rebased it holds [5416, 7112]. Each of the five key edits must agree with the slots (re-timing edits move them over 1 ms and rebase; Tip lane and Duration-without-pressure leave them exactly). 8 of 8, 7 of 7. |

Checks at d7a4dfce1: tsc 6. assert-drawin-extras-node 26 of 26 rows, 40 of 40 mutants. assert-extra-keys-node 8 of 8, 7 of 7. assert-keyed-playback 10 of 10, 21 of 21. assert-keyed-ranges 3 of 3, 10 of 10. assert-key-paths 7 of 7, 8 of 8. assert-strip-recorded 6 of 6. assert-handfix 18 of 18, 17 of 17.

Noted, not changed: the drawin gate's `editFor` says "mutant text not unique" when the text is missing too, which is how the five read on arrival.
