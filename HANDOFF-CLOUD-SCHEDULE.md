# HANDOFF: CLOUD-SCHEDULE (stroke schedule controls)

Full log: LOG.md (first line MERGE-READY). Branches cloud/schedule and claude/stroke-schedule-controls-wrxpad hold the same commits.

## Done
- 724f952 Stagger preset (Geometry Animation) + strip button: 50 ms delays between strokes, one undo step.
- dcc7b92 Per-stroke reverse (StrokeTiming.reverse), stroke block + strip.
- c4f6dc3 Stagger curve (Even, Ease in, Ease out, Ease in-out) + gap ms in the strip.
- b5a3c3b Max gap (StrokeTimingTake.maxGapMs), a time warp on pauses, strip toggle + ms.
- 18c0466 Tap order (order "tapped", DrawInParams.taps), stroke chips in the Order block.
- 2699c17 Review fix: the viewport's take copy now carries reverse and maxGapMs.

## Gates (Node, at head, each matches the unchanged snapshot 2cc9e98)
- tsc 6 errors (baseline).
- assert-keyframes 16/16, 21/21; assert-key-paths 6/7, 8/8 (existing red); assert-width-keys 12/12, 9/9; assert-camera-moves 11/11, 20/20; assert-flip-pose 8/8, 10/10.
- assert-stroke-timing 16/16, 12/12 with STROKE_TIMING_BASE=2cc9e98 (its pinned base b0da66626 is not in this repo).
- New assert-schedule-controls 23/23 rows, 25/25 must-fails.
- assert-style-contracts 5 failed of 44 (same 5 as the snapshot); preset-registry, param-guards, drawin-monotone, export-window --model all pass.

## Left
- No browser gate run: the controls have never been clicked or seen. Run the stroke-strip, stroke-timing-browser, take-persists, motion-customize, preset-pixels and hit-targets gates.
- Known limits: Perform under Max gap stores early; dragging a bar end over a cut pause writes a slightly wrong speed; the pen tip on a reversed stroke is unchecked by eye.
- Owner questions in LOG.md: canvas tapping, live vs one-shot stagger, Max gap default 150 ms, which meaning of reverse.
