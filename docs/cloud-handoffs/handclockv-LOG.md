# LOG-HANDCLOCKV · CL-HANDCLOCKV, 2026-10-02

Two browser gates on the integration head cf8ed6918, after the Hand Draw rebase fixes
(CLOUD-HANDFIX findings 1 to 6 and 8) and the draw-in extras landed. Product code read-only.
Only a stale locator in a gate may change.

## Plan

1. Server on the head: `next dev -p 3146` in this clone, nohup, pid written below. Before the run,
   fetch the served JS and find a string only the head has (from lib/tip-highlight.ts, new since 628bd43dd).
   No string, no run.
2. `FS_PORT=3146 FS_HEADED=0 node scripts/verify/assert-hand-clock.mjs`. Every row and must-fail.
   If R11 is red: are the stamped lifts now 120 ms or more, and does the row's 120 ms bar match
   what lib/camera-moves.ts and lib/stroke-timing.ts define a lift to be. The bar stays as is.
3. Base worktree of 628bd43dd under .wt/base with an APFS copy of node_modules (cp -Rc), served on 3147.
   Prove it serves the base (head-only string absent, a base-only string present).
   `--phase=base --base-file=<scratchpad>/drawin-base.json` on 3147.
4. Default phase on 3146 reading that file. 33 verdict rows, 11 must-fail arms.
5. tsc stays at 6.
6. Teardown: kill every server by its pid and children, remove .wt/base, delete .next,
   `git checkout -q -- docs/verification`. Commit results by pathspec. No push.

Browser: scripts/verify/lib/browser.mjs normal launch (Chrome, --use-angle=metal), no BROWSER_CDP,
not :9301/:9302. One browser at a time.

## Results

Servers: head `next dev -p 3146` (wrapper pid 53458, listener 53487, cwd this clone), base
`next dev -p 3147` in .wt/base at 628bd43dd (wrapper 53459, listener 53494). Proof before each run: the
served JS on 3146 holds `clock-no-rebase-drawin` (1 hit), 3147 holds 0; both hold `clock-no-rebase`.
All stopped by pid, .wt/base removed, .next deleted, docs/verification restored. tsc: 6 errors, unchanged.

### assert-hand-clock.mjs, head 16c41d344 + gate fix d89204489: exit 0

13 of 13 rows green, 13 of 13 must-fails fired, 0 page errors.

First run (gate as found) was stopped: R12 crashed in every context, `Failed to fetch dynamically
imported module /__fsexport/index.js`, and R11 read `move not found`. Two gate fixes, no product change:
- EXPORT_MODULES listed 6 of lib/export's modules; index.ts and encoders.ts now import `gif` and
  `webm-alpha`. The list now matches assert-export-live's 8.
- R11 clicked the Camera picker with the dock closed. The key lanes live in the dock's timeline since L3.
  R11 now calls openDock(timeline) before and hideDock after. The 120 ms bar is unchanged.

R11 after the fix: rate 3.333, 11 stamped lifts [90 73 82 43 174 89 74 65 52 59 67] ms, 1 of 120 ms or
more, move offered, 1 turn [1792.8-1967.2], worst end 0.000 ms. The lifts did not change; the red was the
dock. The bar matches the code: camera-moves.ts orbit-lifts uses `opts?.minLiftMs ?? 120` and no caller
passes minLiftMs; stroke-timing.ts takeLiftsMs returns every gap between ink pieces with no minimum.

### assert-drawin-extras.mjs: base exit 0, lane exit 1

Base phase on 3147 wrote 8 frames, 6 presets, 0 page errors. Lane phase on 3146: 32 PASS, 1 FAIL of 33
verdict rows; 11 of 11 must-fail arms fired; 0 page errors.

FAIL `TIP 2 ON at 0.45`: glow 0 px changed, centre NaN; new ink 97 px at (240, 439); heads [].
`window.__fsTipGlow` reports no head at 0.45, so the renderer had no mid-stroke head to light
(tip-highlight.ts headsFromSpans keeps a stroke only while its reach is strictly inside 0..1). The same row
at 0.7 passes: 1695 px, 14.2 px from the new ink, bar 23.2. Not a locator, left as is. Not checked: whether
0.45 sits in a pen lift on this take. The row was ported unrun from 52982e8.
