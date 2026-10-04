# CLOUD-EXPORT handoff, 2026-10-04

Branch `claude/export-formats-gif-webm-glb-yfwhh2`, on the integration snapshot `2cc9e98`. Full log in `LOG.md` (line 1: NOT MERGE-READY).

## Done
- Ported the 2026-09-30 export-formats lane (`claude/export-formats-implementation-rs226x`): animated GIF, transparent WebM (VP9 alpha stream), animated GLB of the draw-in. Commits dcf7ad5, 8d894f5, 2c5340c, 6ee665b, fbc0a93 (from 3b36b94, 998f74f, b038238, 5c02fb8, 371bf32). My own first GIF (f41fd55) is reverted in bd8c968.
- Controls carried into the dock's Export panel (`components/workspace/export-panel.tsx`): GIF, Anim GLB, and WebM or APNG under Transparent.
- New gate `scripts/verify/assert-export-formats.mjs` (864bdf4).

## Gates on this branch
- tsc: 6 errors, the baseline.
- assert-export-formats: 3/3 rows, 6/6 must-fails caught.
- assert-export-gif 8/0, assert-export-webm-alpha 4/0, assert-export-glb-anim 11/0, assert-export-encoders 8/0, assert-export-plan 12/0.
- The same as the unchanged snapshot: assert-keyframes 16/16, assert-width-keys 12/12, assert-camera-moves 11/11, assert-flip-pose 8/8.
- assert-key-paths 6/7 and assert-stroke-timing 0/1 are red on the snapshot too. They read main-history commits (747af8fa0, b0da66626) that this one-commit snapshot lacks.

## Left
- Run the browser gates on this tree: assert-export-gif-app, assert-export-webm-alpha-app, assert-export-glb-anim-app, assert-export-app. Compare each with its own run on 2cc9e98. If they match, flip LOG.md line 1 to MERGE-READY.
- Run assert-key-paths and assert-stroke-timing in a clone with main's history.
