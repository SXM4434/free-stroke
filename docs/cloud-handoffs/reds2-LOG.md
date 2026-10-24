# LOG-REDS2 · claude/reds2 from 7c976c2b1

Green on main, red on the integration head. Each red is judged product or gate before anything changes.

## Plan
1. assert-drawin-curve: `locator('[data-selected]').nth(5).click()` times out (gate line 245). Find what covers or hides bar 5 on this tree.
2. assert-form-channel: Lit object, then Flat ink, then back to Lit object leaves a 20,050 px change; main leaves 0. The turn row reads 0 degrees. Suspect the product.
3. assert-fusion-ui: six sliders where the gate types three. Derive the count from the fusion code, keep the self-check.
4. assert-workspaces W5: the Animate save is missing before Reset. Check the failed-load overwrite against W5's setup.
5. assert-preset-pixels: retire the Family-14 NON-SELECTABLE control with a header note, as assert-hero-k7-intact retired `terminals`.
6. Reruns on integrate's stored evidence: assert-custom-presets, assert-resize-settles. Copies are untracked and removed at the end.

Server: next dev -p 3146 from this clone, pid logged below. Browser: the harness's own launch, headless.

## Results
Stopped at the 150k context line. Before-run on :3146 (proof: railToggleRef served), logs in
/private/tmp/claude-501/-Users-sebs/2a1d3d28-4efb-4862-bdf3-64238bb23149/scratchpad/reds2/<gate>.before.log.

1. drawin-curve: reproduced, 12 of 13. `[data-selected]` nth(5) is stroke-bar-5 in components/stroke-strip.tsx:546; the click never lands. Cause NOT found yet. Next: run scratchpad/reds2/_reds2-drawin.mjs (copy into scripts/verify first); it prints bar 5's rect, elementFromPoint and the full click log.
2. form-channel: reproduced, 6 of 8. After Flat ink, the JS click on "Lit object" and the mouse click on Turn both change nothing (BACK equals FLAT, 20,050 px; Turn stays 0). Cause NOT found yet. Next: scratchpad/reds2/_reds2-form.mjs prints every `[aria-label="Draw-in timing"]` node, its pressed pills and Turn after the Lit object click.
3. fusion-ui: GATE, stale count. 806b2c909 added 3 dials and the Completion and Pause hold rows (6 pills); keyed Fields add a key button per dial. 29 -> 41 buttons, 3 -> 6 sliders. Fixed in fdbe89da9, NOT yet rerun. Still open: the two "visible without scrolling" rows; the gate now prints which dials are clipped. Decide product or gate from that.
4. workspaces W5: my run FIRED the must-fail (layout changed) but no Animate save existed before Reset; the sweep was BLIND (no change). Timing, not CL-X8SAVE: f17c985bb only sets replaceBadRef in loadLayout's catch. Hypothesis, unproven: W5 toggles straight after switch with no settle; fitAsLoad's rAF (dock-shell.tsx:921 -> :796) rewrites loadedJson after the toggle, so save() at :739 sees now === loadedJson and skips. Next: rerun W5 with a settle between switch and toggle; if green, the product swallows a change made inside the load fit.
5. preset-pixels: GATE, expired control. Retired with header note in 4c711dd54 (9 of 9 Family-14 members have a take, measured). Member-for-member row kept with a must-fail. After-run result: see scratchpad/reds2/assert-preset-pixels.before.log (it ran the edited file).
6. Evidence: 12 files copied from integrate (list: scratchpad/reds2/copied.txt). All three bases the gate names (ea31c5b38, 5519dba0f, 8583f6f0f) and resize/main-hashes.json exist in integrate. Results: scratchpad/reds2/summary.before.txt.

Run results after the stop (server 90442 stopped by pid, .next deleted, copies removed, sparse tree reapplied, status clean):
- preset-pixels (edited file): 26 of 26 pass, RETIRED line printed, the new must-fail fires.
- custom-presets on integrate's bases: 47 of 48 graded pass, 1 fail: 
- resize-settles: not run; the run was stopped at the context line.
