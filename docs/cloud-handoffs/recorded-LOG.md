# CL-RECORDED

Two pills in the draw-in panel were both called Recorded. The Clock row's Recorded plays the timestamps you drew with. The Timing row's Recorded plays the take without the strokes you timed one by one in the strip.

Name picked for the Timing row's pill: **Skip timings**. It says what the pill does, and "timings" is already the word the Timing help line uses for the strip rows ("Your timings are kept in the strip"). It holds under either clock, where something like "As recorded" would still read as the Clock row's meaning.

Plan:
1. Rename TAKE_TIMING_LABELS.recorded in lib/stroke-schedule.ts. The stored value `recorded` and every key stay, so saved documents keep loading.
2. Fix every string that names it: both Timing help lines in components/draw-in-timing-controls.tsx and the set-aside note in components/stroke-strip.tsx, plus any tooltip or aria label.
3. Run the Node gates that read these strings and change only an expected label where it named the old word.
4. tsc stays at 6.
