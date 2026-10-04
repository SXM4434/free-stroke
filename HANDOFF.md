# CLOUD-REFIT handoff

Branch `claude/fix-camera-refit-race-i61c4j`, based on `cloud/integrate-1001` (2cc9e98). Full detail is in LOG.md (MERGE-READY).

## Done
- 2b08d48: app/page.tsx refits the camera once, after the 3D canvas size holds for 6 frames (ResizeObserver plus rAF, ceiling 600 frames), never per resize. viewport-3d.tsx gains a read-only `ViewportApi.canvas()`. The must-fail is `window.__fsRefitTimer = "fixed"` (dev only).
- fc84100: gate `scripts/verify/assert-refit-settles.mjs`, 6 loads of the logo at 834x1112 and 1512x982.
- 0418788, a766ce3: LOG.md, including an independent rerun in a fresh container.

## Gates (headless Chromium 141, own next dev)
- tsc: 6 errors, the baseline. assert-tsc-baseline: 4/4 PASS.
- assert-no-em-dashes: 7/7 PASS, 0 across 142 files.
- assert-refit-settles: exit 0, 8/8 verdicts hold. Fix arm: one zoom and one frame hash per size, 1 refit per load. The must-fail fired at both sizes (6 zooms, 6 hashes).

## Left
- One run on the Mac at 834x1112, to see the natural canvas growth race. Headless, the gate has to drive the growth.
- Not run here: assert-camera-frames-the-drawing (sharp is missing), assert-dock-shell and assert-resize-settles (they need a main reference server and a docs/verification base).
- Register assert-refit-settles in scripts/verify/lib/control-manifest.json.
- No PR opened.
