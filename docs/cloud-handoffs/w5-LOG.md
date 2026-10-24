# CL-W5 · assert-workspaces W5, the Animate save missing before Reset

Branch claude/w5, clone ~/.fs-lanes/cl-docs, server :3146 (own, nohup, pid in this log).

## Plan
1. Probe on my server: switch to Animate and toggle in the same frame vs. a frame later; read whether
   the Animate save lands. Count rAFs between the gate's two evaluates.
2. Cause is the product if the load fit's frame callback (dock-shell.tsx fitDock under loadFitRef,
   from fitAsLoad) rewrites loadedJson after a change made since the load, so save() skips it.
3. Product fix: the load fit absorbs only its own change; a change made after the load stays a change.
   Must-fail arm restores the old order. Gate stays a person's speed only if the product is fine.
4. Gates: assert-workspaces (all rows), assert-rearrange 21/21, assert-maximize 26/26, tsc at 6.

## Log
Server: `next dev -p 3146`, nohup from this clone, pid 45033 (listener child 45041). Every run was
refused unless the served chunk `components_25dc32ce._.js` held `fitSwallow`, a string only this tree has.

**Cause: the product.** `components/dock-shell.tsx` fitDock, under loadFitRef (the load fit that
fitAsLoad schedules a frame after the switch), wrote `loadedJson` from the layout as it stood. A change
made between the switch and that frame was folded into the baseline, so save() saw `now === loadedJson`
and skipped it. Probe, same task as the switch, headless, 2 runs per change:
- old order (`fitSwallow`): toggle view3d moved, not saved 2/2; dock.open export moved, not saved 2/2
- fixed: both moved and saved 4/4
- the gate's own order on this machine had 2 frames between switch and toggle, so it passed either
  way; the red came where no frame fell between the two evaluates.

**Why the sweep's must-fail was blind:** inside the switch's frame the rail's `shown` still reads
Style, so `toggle("style")` hid an already hidden Style: no change. Not a defect, since no person can
click a rail that has not drawn yet, so W5 now waits 200 ms before its toggle.

**Fix:** the load fit takes the layout as loaded only while it is still the loaded one
(`untouched`, read before the fit moves anything). Must-fail arm `fitSwallow` keeps the old order.
New row W5b switches and opens Export in the same task; the arm turns it red.

**Results:** assert-workspaces 17 of 17 (W5 PASS + FIRED, W5b PASS + FIRED on `fitSwallow`),
assert-rearrange 21 of 21, assert-maximize 26 of 26, tsc 6 errors (unchanged).
