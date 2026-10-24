# LOG-DOCK · CL-DOCK, panels can be rearranged

His ruling, 2026-10-02: "Just make sure we can always rearrange the different windows and stuff."

Before: `components/dock-shell.tsx` mounted DockviewReact with `disableDnd` and `locked`. On dockview 8.3.1
`locked` disables every splitview, and `.dv-splitview-disabled > .dv-sash-container > .dv-sash` gets
pointer-events none, so no panel could be moved or resized. Only the rail's show/hide was left.

## Plan
1. Drop `disableDnd` and `locked`. Keep both behind one must-fail arm, `__fsDockMutant = "locked"`, so a gate
   can put the old dock back. Update the PanelTab comment.
2. New gate `scripts/verify/assert-rearrange.mjs`, real pointer input only (page.mouse down, stepped move, up):
   a tab dragged into another group and the layout read back; the Drawing | 3D sash and the sash above the
   dock dragged, both sizes measured; a reload reads the same layout; the 3D canvas is the same node and
   draws non-blank pixels after the move; maximize still fills. Must-fail: the "locked" arm, every drag row red.
3. `assert-hit-targets` H6 also asks that the sash takes the pointer (pointer-events, elementFromPoint),
   with the same "locked" must-fail.
4. Rerun assert-dock-shell, assert-maximize, assert-hit-targets, assert-dock-panels. tsc stays at 6.

Server: own `next dev -p 3146` from this clone, pid logged below. Never :3000, :9301, :9302.

## Log
- server: next dev -p 3146, pid 6395, started 2026-10-02 20:54
- unlock: cebbf6f84 (components/dock-shell.tsx). gate: f3ac6e38e (assert-rearrange.mjs, assert-hit-targets.mjs H6).
- every gate run was preceded by a served-JS check: :3146 serves components_5b1a168a._.js carrying `"savemax", "locked"`.

## Results, 2026-10-02 21:07, FS_PORT=3146 FS_HEADED=0
assert-rearrange: 21 PASS · 0 FAIL
```
PASS  R1   Drawing | 3D sash resizes  :  sash at x=920 (pointer-events auto); Drawing 872 -> 752 (-120), 3D 592 -> 712 (+120)
PASS  R2   the sash above the dock resizes  :  sash at y=946 (pointer-events auto); dock 36 -> 236 (+200), Drawing 898 -> 698 (-200)
PASS  R3   3D tab dragged into the Drawing group  :  one group holds drawing+view3d; layout changed
PASS  R4   3D tab dragged onto the right edge  :  Drawing g-drawing at x=48 w=732, 3D 1 at x=780 w=732
PASS  C1   3D canvas survives both moves, never blank  :  same node true/true, context lost 0; first frame after R3 2.32% non-background, after R4 4.14%
PASS  S1   rail hides and shows the moved 3D view  :  hid true, shown again true, own group true
PASS  M1   maximize fills after the move, restore returns the layout  :  3D 1464x934 in 1464x934; draws 1.66%; restore equal in every value, key order only (.panels keys drawing,style,timeline,drawin,export,view3d -> drawing,view3d,style,timeline,drawin,export)
PASS  W1   Style and Animate: a sash and a tab move  :  style: Style 360 -> 440 px, Style joined the 3D group true; animate: Style 360 -> 440 px, Style joined the 3D group true
PASS  P1   each workspace keeps its own moved layout  :  Draw came back as moved; not the default arrangement (groups, views and sizes)
PASS  P2   a reload comes back on the moved layouts  :  workspace draw; Draw same groups, views and sizes; Style as moved; 3D draws 3.56%
FIRED R1   must-fail: locked dock: Drawing | 3D sash  :  sash at x=920 (pointer-events none); Drawing 872 -> 872 (0), 3D 592 -> 592 (+0)
FIRED R2   must-fail: locked dock: sash above the dock  :  sash at y=946 (pointer-events none); dock 36 -> 36 (+0), Drawing 898 -> 898 (0)
FIRED R3   must-fail: locked dock: 3D tab into a group  :  3D in g-view3d, Drawing in g-drawing; layout UNCHANGED
FIRED R4   must-fail: locked dock: 3D tab onto an edge  :  Drawing g-drawing at x=48 w=872, 3D g-view3d at x=920 w=592
FIRED C1   must-fail: locked dock: canvas through the moves  :  same node true/true, context lost 0; first frame after R3 2.98% non-background, after R4 2.97%
FIRED S1   must-fail: locked dock: rail after the move  :  hid true, shown again true, own group true
FIRED M1   must-fail: locked dock: maximize after the move  :  3D 1464x934 in 1464x934; draws 1.16%; restore byte-equal
FIRED W1   must-fail: locked dock: Style and Animate drags  :  style: Style 360 -> 360 px, Style joined the 3D group false; animate: Style 360 -> 360 px, Style joined the 3D group false
FIRED P1   must-fail: locked dock: per-workspace layout  :  Draw came back as moved; IS the default arrangement (groups, views and sizes)
FIRED P2   must-fail: locked dock: reload of the moved layout  :  workspace draw; Draw same groups, views and sizes; Style as moved; 3D draws 4.09%
PASS  G1   the lane pages threw nothing  :  0 pageerror events
```
assert-hit-targets: 16 PASS · 0 FAIL (H6: 2/2 (8 px; 2/2 take the pointer); locked must-fail 0/2 (0/2 take the pointer))
assert-maximize: 15 PASS · 0 FAIL
assert-dock-panels: 11 PASS · 0 FAIL
assert-dock-shell: CLEAN 11/11 PASS · CONTROL sees · ARMS all fired. Run with --ref=http://localhost:3146: his :3000 is off limits to this lane, so
BUFFERS and FRAMES compared the lane with itself and say nothing about parity with main. SURVIVES, DRAW and the arms are real.
tsc: 6 errors (baseline 6).

Not changed, for his eye: dockview's own drop overlay (the box that shows where a dragged tab will land) is unstyled
by this lane. A sash follows the pointer 1:1 with no easing, which is right for a direct drag.
