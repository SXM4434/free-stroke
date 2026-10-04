# CLOUD-K2LIVE handoff

Branch: claude/keyed-style-playback-3r6jcq (from cloud/k2live, d38fec4). Full detail: LOG.md (first line MERGE-READY).

Done (one commit each, all pushed): REVIEW.md Review 1 findings 1 (the viewport, the video, the GIF and the GLB read keyed style; loops read through loopPhaseAt), 2 (style keys survive a reload), 5 (refusal words beside the diamond; a preset keeps its other keys), 6 (Twos in export), 7 (the key clock reads the frame loop's playhead), 10 (whole-number steps and the range clamp, which also closes D6 and D7), 11 (a remount notifies the store).

Left: findings 3, 4, 8, 9 (another session's). Pre-existing reds, the same on the base: assert-key-buttons B1 (ditherAngle has no key button), assert-key-paths EXISTING (747af8fa0 is missing from the clone), assert-export-glb-anim-app (stops at a hidden button), the crash law taking the dev page down. assert-key-lanes needs a docs/verification baseline and was not run.

Gates (tsc 6 = baseline):
- assert-keyed-playback (Node, new): 10/10 rows, 21/21 mutants
- assert-keyed-ranges (Node, ported): 3/3, 10/10
- assert-key-paths: 6/7 (EXISTING), 8/8
- assert-keyframes: 16/16, 21/21
- assert-keyed-playback-live (browser, new): 17 PASS 0 FAIL
- assert-keyed-style: 15 PASS 0 FAIL (with --ref; K4 identical to base)
- assert-take-transport: 9 PASS 0 FAIL
