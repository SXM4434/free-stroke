DONE

# CX-PORT-FLAKES

Port the four commits from `refs/cloudrun/flakes` in order, one cherry-pick commit per source commit, with `-x` and `merge.renames=false`. Resolve conflicts by keeping the cloud change and the integration branch behavior.

1. `dc2a0fac4`: driven clock for assert-drawin-timing. Run `tsc --noEmit -p .`; expected baseline is 6 errors.
2. `08e8b5091`: driven clock for assert-perform. Run tsc.
3. `9bf285755`: Inflate pause tip hold and perform row 1c. Preserve the current Vanish trailing-edge tip hold and perform row 8 canvas sizing. Run tsc.
4. `7e2dc06c3`: row 1b left-out cap and Extrude must-fail. Run tsc.
5. Run the four requested Node gates, count each result, compare the touched-file inventory, and write the browser lane's rows and expected readings here.

Browser gates are assigned to the Claude lane in the job brief. No browser or dev server in this job.

## Port results

- Plan: `cb0d9301f`.
- `dc2a0fac4` ported as `de4cfc456`; tsc: 6 errors, the existing baseline.
- `08e8b5091` ported as `050984246`; tsc: 6 baseline errors.
- `9bf285755` ported as `21b6ff500`; tsc: 6 baseline errors. Conflict resolution kept the integration lift hold on the leading and Vanish trailing edges, added the cloud pause still on the leading edge, and kept row 8's early canvas sizing beside cloud row 1c.
- `7e2dc06c3` ported as `52fb93997`; tsc: 6 baseline errors. The row 1b cap is the cloud's tighter 3.5%; the integration branch's 5 px wide arm remains.

## Checks

- `assert-handfix`: first run 17 of 18 rows, 17 of 17 mutants caught. Only F3-BEFORE failed because its default pre-fix commit `0ad6d79` is absent from this clone. Reran with `HANDFIX_BASE=2cc9e989f`, the available pre-fix snapshot: 18 of 18 rows, 17 of 17 mutants caught. F3-BEFORE then exercised the old clamp defect.
- `assert-stroke-timing`: 16 of 16 rows, 12 of 12 mutants caught.
- `assert-schedule-controls`: 23 of 23 rows, 25 of 25 mutants caught.
- `assert-drawin-extras-node`: 26 of 26 rows, 40 of 40 mutants caught.
- `node --check` passed on both ported browser gates; `git diff --check` passed. The cloud range touched three files: `components/viewport-3d.tsx`, `scripts/verify/assert-drawin-timing.mjs`, `scripts/verify/assert-perform.mjs`. All three are present in this port's changed-file list. No cloud-touched file is missing.

## Browser lane handoff

No browser gate was run here. The job assigns browser gates to the Claude lane. Run the full `assert-perform.mjs` and `assert-drawin-timing.mjs` against a server proven to serve this checkout, using the shared headless browser. Record each gate's full N of M.

- `assert-perform` row 1a: the driven page clock should record a roughly 1000 ms dwell; the performed flat run should agree within one frame and two sample bins. Row 2 should show a re-performance with no spurious long pause from a slow frame.
- `assert-perform` row 1b on Inflate, Extrude and Solid: stroke D should stay still for the performed dwell, with both edges within one frame of the flat run. The left-out share must stay at or below 3.5%; the 5 px wide arm must exceed 3.5%. Inflate must no longer release about 281 ms early.
- `assert-perform` row 1c on all three engines: every 40 ms read through the dwell should have the same inked pixel set as the middle. The linear, unpaced slot must change pixels and make the paired arm fire. On Inflate, `FS_GATE_MUTATE=tip-no-pausestill` must make rows 1b and 1c red; the cloud measurement was 5 of 26 reads differing under the mutant, versus 0 of 26 with the still.
- `assert-perform` row 8: size the canvas to main before injecting strokes. With a valid clean main base, Rod and Inflate should each match 9 of 9 frames, before and after Escape. `PERFORM_FIT=late` must make row 8 fail. A SELF or NOT COMPARED result is not a main comparison.
- `assert-drawin-timing` section F default rows: the driven clock advances 40% of the pass, so the moving sample should read near 0.4, strictly inside 0.2 to 0.8, while playing and ahead of its pre-play head. Clock and playhead should agree within 1e-9 at defaults. The frozen-transport sabotage must fail the moving-sample control. Run the whole gate and report its assertion count.

No dev server was started here, and `.next` did not exist. `git checkout -q -- docs/verification` could not match that path in this sparse checkout; the directory was absent and the working tree stayed clean. Browser renders and their must-fails remain for the Claude lane to measure.
