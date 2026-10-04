# PERSTROKE handoff, 2026-10-04

Same commits as `cloud/perstroke`. Full record and owner questions: LOG.md.

## Done
- 27fd455 `lib/landing-motion.ts`: per-stroke landing math (spring from DESK_DOODLES.motion, settle from the lab's pop-in, pulse from style-clock's envelope, wobble, stagger). Gate `scripts/verify/assert-landing-motion.mjs`.
- 8eb5ab3 viewport: each stroke's group posed after it lands; transport extended by the landing tail (the flip's mechanism). Off writes nothing.
- 1d77279 Completion Pulse implemented; Landing block in the draw-in controls; saved with the session; Customize and Reset.
- eae6821 LOG.md.

## Left
- Not seen in a browser (lane had none). Needs a browser gate on `__fsTake.get().landing`.
- Inflate's fused surface lands as the whole mark only; per stroke there needs a per-vertex stroke index.
- Owner calls: spring 420 vs 360 ms; whether strokes should spring; keying landing values (needs a default plus scaffold sliders); per stroke on Inflate.

## Gates
- tsc 6 (baseline 6). keyframes 16/16, width-keys 12/12, camera-moves 11/11, flip-pose 8/8.
- key-paths 6/7 and stroke-timing 0/1: same as the unchanged snapshot (they read commits missing from this one-commit history).
- assert-landing-motion (new): 23/23 rows, 28/28 must-fails caught.
- 18 other Node gates identical to the snapshot; drawin-2d-parity is out of memory on both.
