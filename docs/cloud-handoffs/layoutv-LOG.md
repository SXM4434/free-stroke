CL-LAYOUTV, 2026-10-02. The browser half of CX-LAYOUTFIX.

Branch claude/layoutv, cut at c1dd91c77. Gate files only. dock-shell.tsx gets three mutant arms in its existing list and nothing else.

Plan

1. Three rows in scripts/verify/assert-maximize.mjs, after X9, each with a must-fail:
   - X10 RAIL CLICK WHILE MAXIMIZED. 1512x982, reset Draw, maximize Drawing, hover the rail's Timeline until its tooltip reads "show", click it. Maximize ends, six panels present, Timeline, Drawing and 3D view visible, Style hidden. Then reset Draw, maximize Drawing, click Drawing while it reads "hide": maximize ends, Drawing hidden, six panels present. Must-fail `railAfter`: restore first, then flip from the restored layout.
   - X11 CROSSING 1024 PX CLEARS MAXIMIZE. Reset Style, maximize Style, viewport to 1023 wide and back to 1512. Maximize null, no maximize button with aria-pressed true, Style's header button says "Maximize Style". Hide Style from the rail, wait 600 ms, `fs.layout.v1.style` holds Style's group at `visible: false`; reload, six panels, Style still hidden, maximize null. Must-fail `lgKeepMax`: the lg handler leaves maxRef set.
   - X12 A SAVE DOCKVIEW THROWS ON. Draw's default plus one floating group whose id is a number. layoutProblem passes it (checked in Node first), dockview's fromJSON throws "group id must be of type string". Reload: the warning toast is on screen and says Dockview could not load it, six panels back. Reload again: the page loads, six panels. Must-fail `nocatch`: the catch rethrows, the same as no catch.
2. My own server, `next dev -p 3146`, pid written here. Every gate run is refused unless the served JS carries `railAfter`, a string only this tree has.
3. Runs: assert-maximize whole, assert-rearrange (21 of 21 before), tsc (6 before).

Results

Server: `next dev -p 3146` from this clone, nohup pid 17541, listener pid 17631. The preflight passed before every run: devcheck said 1 of 1 listener on :3146 serves this clone, and 1 of 41 served chunks carried `railAfter`. Both pids were killed by number at the end, 0 listeners left, `.next` deleted, docs/verification checked out.

- X10 clean PASS. Timeline read aria-pressed false and tooltip "show" with Drawing maximized; after the click maximize was null, 6 panels, Drawing, 3D view and Timeline shown, Style hidden. Drawing read pressed and "hide"; after the click maximize null, 6 panels, Drawing hidden. Must-fail `railAfter` FIRED on the Timeline click: Timeline came out hidden. The Drawing click held under the mutant, as the handoff predicted, since restore and flip land on the same answer there.
- X11 clean PASS. After 1023 px and back: maximize null, 0 pressed maximize buttons, Style's button reads "Maximize Style". The rail hid Style, the save holds Style's group at `visible: false`, and the reload came back on Style with 6 panels, Style hidden, maximize null. Must-fail `lgKeepMax` FIRED: maximize still "style", 1 pressed button, the label "Restore the layout". The save half held under the mutant, because the rail click restores before it hides.
- X12 clean PASS. The save is Draw's default plus `floatingGroups: [{ data: { id: 7, views: [] } }]`. layoutProblem passes it; dockview throws "group id must be of type string". The reload showed the toast "The saved Draw layout was not loaded. Dockview could not load it (dockview: group id must be of type string). Draw opens on its default arrangement." with 6 panels back. The next reload loaded with 6 panels, and the toast showed again (1), because the bad save is still in storage: the fallback does not overwrite it until the next real change. Must-fail `nocatch` FIRED: the harness never came up within 45 s, no toast.

Whole gates

- assert-maximize: 24 of 25. The one red is X8 clean, the sub-case "1512x982 resized to 760x430 while maximized": float missing. 760 px is under the 1024 px breakpoint, so CX-LAYOUTFIX fix 2 now ends maximize on that shrink, and there is no preview to place. X8's other three sizes pass and its must-fail fires. X8's resize input (assert-maximize.mjs line 363) predates the fix and needs a ruling: keep the shrink above 1024 px, or grade the 760 case as maximize ended. Not changed here.
- assert-rearrange: 21 of 21.
- tsc --noEmit -p .: 6 errors, the same 6 (perfect-freehand, five MaskSolidDiagnostics fields).
