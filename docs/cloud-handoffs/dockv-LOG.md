# LOG-DOCKV · CL-DOCKV, the dock gates on the merged tree

Branch `claude/dockv` at 68aecffd8, the integration head. On it, by hand: the dock unlock (ac4cc3a5a, b8f645222,
68aecffd8: panels drag by their tab, sashes resize, a `"locked"` must-fail arm) and CLOUD-LAYOUT steps 1 and 2
(71a0a5635, c5864ae27: the floating 3D preview sits inside the window and frames the drawing; the dock follows its
content and the maximized dock's lanes fill it). The controller resolved their conflict in components/dock-shell.tsx.

This lane changes nothing a person sees. Gate files change only for a stale locator; product code is read-only.

## Plan
1. Own server: `node_modules/.bin/next dev -p 3146` with nohup from this clone, pid logged. FS_PORT=3146 FS_HEADED=0.
   Never :3000, :9301, :9302, never BROWSER_CDP. One browser at a time, the harness's own launch (Chrome, ANGLE metal).
2. Before every gate run: the served JS must carry both `"locked"` and `"previewLoose"`, or the run is refused.
3. Run, clean and with must-fails:
   - assert-rearrange (21/21 before the merge, dock-LOG.md)
   - assert-maximize (X8 `previewLoose`, X9 `previewNoFit` from the layout steps; 15/15 on the unlock alone)
   - assert-dock-panels (R6 `nofit`, R8 `stripcut` at 1280x800; 11/11 on the unlock alone)
   - assert-hit-targets (H6 with the `locked` must-fail; 16/16 on the unlock alone)
   - assert-dock-shell `--ref=http://localhost:3146` (his :3000 is off limits), so BUFFERS and FRAMES compare the lane with itself
4. tsc stays at 6.
5. A red from a stale locator: fix the locator in the gate, say so. A red from the merge: report with numbers, no product fix.
6. After: kill the server by pid, delete .next, `git checkout -q -- docs/verification`.

Expected results for the layout rows: none recorded. docs/cloud-handoffs/layout-LOG.md holds a different session's
log (HAND-DRAW-P3); cx-port-layout-LOG.md says so and says assert-maximize and assert-dock-panels were never run
after the port ("No browser in this job"). So X8, X9, R6, R8 run here for the first time on any tree that has them.

## Log
- server: next dev -p 3146, wrapper pid 9179, listener pid 9190 (child 10646), started 2026-10-02 21:10. Stopped by those
  three pids; 0 listeners on :3146 after. `.next` deleted, `git checkout -q -- docs/verification` done.
- every gate run was preceded by a served-JS check (scratch `served-check.mjs`): the :3146 listener's cwd is this clone and
  components_5b1a168a._.js carries both `"locked"` and `"previewLoose"`. It passed before all five runs.

## Locator fix, scripts/verify/assert-rearrange.mjs
The first run refused itself: `REFUSED: the JS served at http://localhost:3146 lacks the CL-DOCK "locked" arm`. Its own
served check matched `"savemax", "locked"` side by side. On the merged tree the arm list reads
`"savemax", "previewLoose", "previewNoFit", "nofit", "stripcut", "locked"`, so the pattern missed. A stale locator from
the merge, not a product fault. The pattern now takes any arms between "savemax" and "locked"; the arm it proves is the same.

## Results, 2026-10-02 21:12 to 21:30, FS_PORT=3146 FS_HEADED=0, merged tree 26ee9e842 + the locator fix
| gate | merged | unlock alone (dock-LOG.md) |
|---|---|---|
| assert-rearrange | 21 PASS · 0 FAIL (11 rows, 10 locked must-fails fired) | 21/21 |
| assert-maximize | 19 PASS · 0 FAIL (X1-X9 + G1, 9 must-fails fired) | 15/15 (X1-X7 + G1) |
| assert-dock-panels | 17 PASS · 0 FAIL (R1-R8 + G1, 8 must-fails fired) | 11/11 (R1-R5 + G1) |
| assert-hit-targets | 16 PASS · 0 FAIL (H6 2/2, 8 px, 2/2 take the pointer; locked must-fail 0/2) | 16/16 |
| assert-dock-shell `--ref=http://localhost:3146` | CLEAN 11/11 · CONTROL sees · ARMS all fired | the same |

rearrange's numbers equal the unlock's to the pixel (R1 Drawing 872 -> 752, R2 dock 36 -> 236, R4 3D at x=780 w=732;
C1 locked 2.99% where it read 2.98%).

The layout rows, first run on any tree that has them:
- X8: inside at 1512x982, 1512x982 resized to 760x430 while maximized, 1280x720 and 900x700. previewLoose fired at
  900x700: panel and canvas 528,472..888,752, outside the window.
- X9: frame 360x216, ink 70,24..289,182, clears the edges by 24 px, spans 74%. previewNoFit fired: ink 28,0..331,211,
  clears by 0 px, spans 98%.
- R6: closed dock 271 px = header + content 271, 0 px blank, 3D view 635 px; open dock 374 px, 0 px blank, 3D 532 px.
  nofit fired: closed dock held at 374 px against content 271, 103 px blank.
- R7: maximized lanes take the height, rows 64 px, lanes end 0 px above the region's bottom. Its must-fail fired at 36 px rows.
- R8: 1280x800, 1440x900, 1512x982 each dock 271 px, 12 of 12 rows whole. stripcut fired at 1280x800 only, 10 of 12
  whole; at 1440x900 and 1512x982 the third-of-the-shell cap still holds all 12, so the arm can only bite at 1280x800.

assert-dock-shell ran with `--ref` on this lane's own server because his :3000 is off limits. BUFFERS and FRAMES
therefore compare the lane with itself and say nothing about parity with main. SURVIVES, DRAW and the four arms
(header, noReuse, onlyWhenVisible, stale) are real.

tsc: 6 errors, the baseline (perfect-freehand module, five MaskSolidDiagnostics properties).

No red from the merge: no must-fail stopped firing and no row that passed alone fails together.
