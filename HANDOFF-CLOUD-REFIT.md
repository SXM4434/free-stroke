# CLOUD-REFIT handoff

Branch `claude/fix-camera-refit-race-fqep03`, from `cloud/integrate-1001` (2cc9e98). Full detail in LOG.md.

## Done
- 2b08d48: app/page.tsx refits the camera once the 3D canvas has settled (6 stable frames on a ResizeObserver, canvas caught up with its container, 600 frame ceiling), once, never per resize. `ViewportApi.canvas()` added. Must-fail hook `window.__fsRefitTimer = "fixed"` (dev only).
- fc84100: new gate scripts/verify/assert-refit-settles.mjs, 6 logo loads at 834x1112 and 1512x982.
- 0418788: LOG.md (MERGE-READY).

## Gates
- assert-refit-settles: 8/8 verdicts, fix arm green at both sizes, must-fail fired at both sizes (6 different zooms each).
- assert-tsc-baseline: holds, 6 errors.
- assert-no-em-dashes: 7 rows PASS.

## Left
- The natural 188 to 217.72 px race does not reproduce on this tree headless; the gate drives the growth. Confirm once on the Mac at 834x1112.
- Not run: assert-camera-frames-the-drawing (needs `sharp`), assert-dock-shell and assert-resize-settles (need a main reference server and a docs/verification base), assert-gate-integrity. The new gate is not in control-manifest.json.
