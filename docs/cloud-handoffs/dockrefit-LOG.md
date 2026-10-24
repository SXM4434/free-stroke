# LOG-DOCKREFIT, CL-DOCKREFIT lane, 2026-10-03

One product bug. Opening and closing the dock's Draw-in tab with no edit moves the 3D
view: its canvas is 838 px tall before Draw-in is first opened, 573 px after the first
return to Timeline, 735 px after the second and every later one (CL-FORM probe). The
ruling (docs/rulings/2026-09-26.md): the dock follows its content. Same content, same
height, every time.

Plan:
1. On my own server (:3146, nohup, pid logged, proof string in the served JS), log per
   frame after each tab switch: the dock's height, timelineNaturalPx's parts (panel box,
   each scroll region's scrollHeight, clientHeight and cap) and the canvas height. Find
   which read differs between the 1st and 2nd return, and why.
2. Fix it in components/dock-shell.tsx at the cause; add a mutant arm that brings it back.
3. assert-dock-panels: a row near R6, Draw-in opened and shut three times, the 3D canvas
   equal (1 px) after every return; must-fail on the new arm.
4. assert-form-channel: scroll the Turn slider into view before the real click.
5. Gates: form-channel 8/8, dock-panels, rearrange 21/21, maximize 26/26, tsc at 6.

## Results, 2026-10-03

Cause: components/dock-shell.tsx, fitDock (was :787) with the content-following
effect (:1243 to :1250), from c5864ae27. On the first return from Draw-in the tab change
asks for a fit in the next frame, but the Timeline's content is not laid out yet, so
timelineNaturalPx reads null and fitTarget hands back the cap, which is Draw-in's height.
The content arrives in the same frame; the effect stores that first read and does not
refit, since `was === null` counts as no change. Later returns find the content laid
out and fit it. Logged on :3146 (bare page): fit {nat: null, target: 311} on return 1,
fit {nat: 26.75, target: 63} on return 2.

Fix (1ed69d483): while the Timeline is the tab and reads no height, fitDock waits a
frame, up to 10, and the dock does not move until it can measure. Mutant arm "nullfit"
brings the old fit back.

Heights, 3D canvas, Draw-in opened and shut with no edit:
- bare page (diag probe): before 595, 843, 843; after 843, 843, 843.
- R6b (logo drawing): nullfit 595, 635, 635; fixed 635, 635, 635.
- CL-FORM probe: before 838 (first shot), 573, then 735; after 735 in all 10 shots.

Gates on :3146, proof string "nullfit" in the served chunk before every run:
- assert-form-channel 8 of 8, both controls pass, shading restore 0 px with no re-baseline.
- assert-dock-panels 19 of 19, must-fails 9 of 9 fired (R6b new).
- assert-rearrange 21 of 21, must-fails 10 of 10 fired.
- assert-maximize 26 of 26, must-fails 13 of 13 fired.
- tsc 6 errors, the same 6 as before the fix.
