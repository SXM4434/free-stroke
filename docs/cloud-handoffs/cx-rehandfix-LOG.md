NOT DONE

# CX-REHANDFIX

Rebase the Hand Draw port from codex/port-handfix onto refs/remotes/int/head on codex/port-handfix2. Preserve the integration schedule controls and all port behavior. No push.

## Plan

1. Replay each implementation or gate commit after 89226c543, excluding the old plan and final results log. Resolve conflicts with both behaviors present. Commit each original step separately, then count TypeScript errors with `node_modules/.bin/tsc --noEmit -p .`; required count is 6.
2. Compare touched paths in each original commit with its rebased copy.
3. Run the port log's Node and browser gates, plus assert-schedule-controls, assert-style-contracts, and assert-strip-recorded. Use only a shared browser slot and a dev server owned by this checkout. Report every gate as N of M.
4. Stop the server by exact PID, return the browser slot, remove .next, restore docs/verification, and finish this log with results and any limits.

## Replay

| Step | Original | Rebased | TypeScript errors |
|---|---|---|---:|
| Plan | | e33f9e11d | 6 baseline |
| 1 Thickness and reprocess | bebb7f87b | 1f5389bdd | 6 |
| 2 Draw-in and Window | 62d84a631 | fff2b6ecd | 6 |
| 3 Clamp at zero | b309a1f95 | 611098a53 | 6 |
| 4 Zero-length slot | c15f7e033 | ee77cb492 | 6 |
| 5 Pace key | 846eadb99 | 333be8630 | 6 |
| 6 Trailing lift edge | 911908437 | db35abe44 | 6 |
| 7 Transport pace | 1921c840d | ac481b0e8 | 6 |
| 8 Comment and cloud log | ca4c85de1 | 4c1f122ae | 6 |
| 9 Gate input path | 0714a00f5 | 7daa76e0f | 6 |
| Gate input equalization | | 608337d12 | 6 |
| Handfeel shared CDP context | | 21e1ae370 | 6 |

All 24 of 24 paths touched by the nine original commits are in their matching rebased commits. No original path is missing. The last TypeScript run still reports the same six baseline errors: one missing perfect-freehand module and five MaskSolidDiagnostics fields.

## Node gates

| Gate | Rows or assertions | Must-fails |
|---|---:|---:|
| assert-handfix | 18 of 18 | 17 of 17 |
| assert-stroke-timing | 16 of 16 | 12 of 12 |
| assert-drawin-extras-node | 26 of 26 | 40 of 40 |
| assert-fusion-chaos | 10 of 10 | 20 of 20 |
| assert-key-paths | 7 of 7 | 8 of 8 |
| assert-keyframes | 16 of 16 | 21 of 21 |
| assert-export-formats | 3 of 3 | 9 of 9 |
| assert-style-contracts | 44 of 44 | controls in its assertions |
| assert-strip-recorded | 6 of 6 | 1 of 1 |
| assert-schedule-controls | 23 of 23 | 25 of 25 |

`assert-stroke-timing` used `STROKE_TIMING_BASE=0ad6d79`, as the port log directs. The Handfix gate's pace-key mutant now matches the schedule branch's added gap signature. The schedule gate's archived schedule is compared with the same Handfix timing code on both sides; the 56 identity cases and must-fail remain. The first runs exposed these two input mismatches, and both full reruns passed after equalization.

## Browser gates

Pending shared slot. The checkout's server is on port 4177. A served page JS asset contains `clock-no-rebase-nib`, a string absent from the integration base.

Codex-Run: CX-REHANDFIX
