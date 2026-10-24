# LOG-BROWSERB · CL-BROWSERB, 2026-10-02

Browser rows owed on the integration head 4cb001e39 after two ports, plus the draw-in TIP 2 red.
Product code read-only. Only a stale locator or sample time in a gate may change. Nothing a person sees changes.

## Plan

1. Own server: `nohup node_modules/.bin/next dev -p 3146` from this clone, pid written below.
   Before each gate run, fetch the served JS and find a string only this tree has. No string, no run.
   Gate harness launch path only (scripts/verify/lib/browser.mjs, Chrome, --use-angle=metal),
   no BROWSER_CDP, not :9301 or :9302. One browser at a time.
2. `assert-perform.mjs` full run, twice: rows 1a, 1b (Inflate, Extrude, Solid; left-out share at or
   under 3.5%, Extrude's must-fail fires), 1c (three engines), 2, 8 against main's base
   (~/.fs-lanes/integrate/docs/verification/perform/base-main.json, read only), and `PERFORM_FIT=late`
   must read row 8 red. Say if any row differs between the two runs.
3. `assert-drawin-timing.mjs` full run, section F's driven-clock rows included. N of M.
4. `assert-drawin-extras.mjs --only=tip` with the hcv base file. Read the take's stroke slots and
   lifts at playhead 0.45 through the page's harness. In a lift: move the sample to mid-stroke, keep
   the bar, show the must-fail still fires. Mid-stroke: report the tip failing, leave the row.
5. tsc stays at 6.
6. Teardown: kill the server and its children by pid, delete .next, `git checkout -q -- docs/verification`.

## Results

Server: `next dev -p 3146`, wrapper pid 80467, next-server pid 80485, cwd this clone. Before every
gate run the served chunk `components_viewport-3d_tsx_2bb4a58f._.js` held `uFsTipHoldR` (from 1c77aef38).
Stopped by those two pids; 0 listeners on :3146 after. `.next` deleted, `docs/verification` removed
(it was absent in this sparse clone; only the copied base and gate outputs were in it). tsc: 6.

Row 8 setup. The base (integrate's base-main.json, copied, read only) names main 8583f6f0f, an object
neither integrate nor this clone had, so the first perform run refused at `codeDiffers` (git diff exit 128).
Fetched that one commit into this clone, read only, from ~/Desktop/Projects/free-stroke. Nothing written there.

### assert-perform, two full runs: 18 PASS, 0 FAIL, 0 SELF each, identical row for row

- 1a: dwell on the page clock 1016.0 ms, row flat run 1014.5 ms of a 1944.0 ms slot, 390 samples, rejected 0.
- 1b Rod: stroke D held 1017.4 ms (6368.2 to 7385.6) for the 1016.0 ms dwell.
- 1b left-out share at 1 px, cap 3.5%: Inflate 27 of 1538 (1.8%), Extrude 7 of 1177 (0.6%), Solid 34 of 2288 (1.5%).
  5 px arm: Inflate 10.3%, Extrude 72 of 1177 (6.1%), Solid 11.6%, all over the cap, so each arm fires.
- 1c: 26 reads every 40 ms from 6373.8 to 7378.2 ms, 0 differ on all three engines (Inflate 715 px,
  Extrude 654, Solid 1362). Linear across the dwell changes pixels: +551, +475, +875.
- 2: rows 1 -> 1, samples 390 -> 126, speed 0.907 -> 2.827. Same in both runs; the 667 -> 354 flake did not recur.
- 8: rod 9/9, inflate 9/9 before, equal after Esc, main 8583f6f0f.
- `PERFORM_FIT=late`: row 8 FAIL, rod 0/9, inflate 0/9, after Esc false. The arm fires.

### assert-drawin-timing: ALL 26 PASS

Section F: clock 0.400000 === playhead 0.400000 at defaults, read after 672.0 ms of driven clock in a
1680 ms pass, head before play 0.000000, playing at the sample. The frozen-transport sabotage was not run.

### TIP 2 at 0.45: the sample sat in a pen lift

Take: logo-strokes, msPerPoint 12, gapMs 60, 12 strokes, 13116 ms. Stroke 4 runs 5004 to 5832 ms, stroke 5
5904 to 7596 ms. Playhead 0.45 is 5902 ms, inside that 72 ms lift. `__fsTipGlow` heads: stroke 4 at 0.44
(frac 0.93), none at 0.445 and 0.45, stroke 5 at 0.455 (frac 0.04). The 97 px of new ink was stroke 4 finishing.
Moved the row to 0.52 (6820 ms, stroke 5 at frac 0.54; its 0.50 `before` frame is inside stroke 5 too). Bar kept.
`--only=tip` after: TIP 2 at 0.52 PASS (glow 1739 px, 15.1 px from new ink, bar 23.5); 0.7 PASS (14.2 px,
bar 23.2); tip-at-start must-fail fires (36.3 px, bar 23.4); tip-dark must-fail fires (glow 0 px). 9 of 9 PASS.
Not checked: PRESENTATION 2 also names heads at 0.45 in its detail.
