# CL-TRACE2: are the two reds on integrate/cloud-1001 comparison inputs, not product defects

Branch claude/trace2 from 92ea77631 (integrate/cloud-1001). Main 8583f6f0f. Product code read-only.

## Plan
1. assert-perform row 8. Reading to prove or kill: 40dbf09c9 refits the camera once the 3D canvas
   settles, and reads the ortho zoom from the canvas height then (934 at 1512x982); dock-size's
   sizeToMain only puts the canvas at main's 755.5x890 after that. Probes: row 8 on 0670c89c8 and on
   40dbf09c9 at the gate's window, then 40dbf09c9 with the window that gives 890 before the refit.
   If that reads 9 of 9, the gate sizes the canvas to main's before the strokes land.
2. assert-custom-presets, Customize box. Seen in the two saved boxes (1262x275.5 each): on the branch
   the Cell size slider has a dark focus ring; on main Threshold bias and Lock mode are grey, under a
   fade. Reading: focus and a scroll fade are inputs. Probe: blur, same scroll on both containers.

## Probes
