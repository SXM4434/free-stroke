# CL-TLOVER · the Timeline drawn over other panels after Animate's dock was open

Stopped 2026-10-03 on the coordinator's call (usage went to interview slides). The original
source read and plan below remain as they were. A fix and row were prepared on 2026-10-22,
but the browser check has not run.

## The defect (LOG-PANELS.md on claude/panels, picture bug-timeline-over-panels-after-restore.png)

Draw, Style, Animate, open the dock, then Style with the dock folded: the Timeline (strip, Perform,
Keyframes lanes, the timing note) is painted over the 3D view and the Style panel. In the picture the
dock at the bottom is folded to its header and the Timeline sits from y 88 to about y 550, over the
3D view's top half and across the Fusion dials. Style before Animate is clean.

## The cause, as read (not yet confirmed in a browser)

dockview-core 8.3.1, `OverlayRenderContainer.attach` (node_modules/dockview-core/dist/dockview-core.js,
the class starts at line 13976; the reposition is at about 14120 to 14136):

- With `defaultRenderer: "always"` (components/dock-shell.tsx:1374) each panel's content lives in an
  absolutely placed overlay box (`.dv-render-overlay`) that dockview moves over its group every layout.
- When `entry.retainPreviousGeometry` is set and the group's content box is 0 wide or 0 high, the
  reposition returns early and keeps the last geometry. It hides the box only when
  `!panel.api.isVisible`.
- The folded dock's content box is 0 px high (the group is its 28 px header). The Timeline is the
  active tab of a visible group, so `isVisible` is true and the box stays shown at its old place.
- `retainPreviousGeometry` is set when a panel that was already positioned is attached again, which
  `fromJSON(layout, { reuseExistingPanels: true })` does on every workspace switch
  (dock-shell.tsx:961). Before Animate opens the dock the Timeline was never positioned, so there is
  nothing to retain: that is why Style before Animate is clean.
- The empty overlay box is hit-testable even where it is transparent, so hiding only our content
  inside it would still leave elementFromPoint landing on dockview's box.

Commit: the renderer and the dockview dependency both arrive in 77ccbf741 (L1 dockview shell,
2026-09-26). The commit that folds the dock to a 0 px content box was not looked up.

## Next step (the fix as planned)

1. dock-shell.tsx, the three dock panels (TimelinePanel, DrawInPanel, ExportDockPanel, lines 266 to
   286): read `collapsed` and `maximized` from DockControlContext (line 315) and set
   `data-dock-folded` on the panel root when `collapsed && !maximized && isDockGroup(api.group)`;
   re-render on `api.onDidGroupChange` so a panel dragged out of the dock is never hidden.
2. A global rule: `.dv-render-overlay:has([data-dock-folded]) { visibility: hidden !important;
   pointer-events: none !important }`. It beats dockview's inline styles only while folded, so there
   is no ordering fight with `visibilityChanged`.
3. Mutant arm `foldshow` (read once from `window.__fsDockMutant`): the attribute is never set.
4. Row R9 in scripts/verify/assert-dock-panels.mjs: rail clicks (`[data-rail-workspace]`) Draw,
   Style, Animate, open the dock on the Timeline tab, then Style and Draw with the dock folded. At the
   3D view's centre elementFromPoint is the 3D canvas, and no element under
   `[data-dock-host="timeline"]` is hit at any point of the 3D view's box. Must-fail with `foldshow`.
5. Gates after: assert-dock-panels (all plus R9 and its must-fail), assert-rearrange 21 of 21,
   assert-maximize 26 of 26, assert-workspaces 17 of 17, tsc at 6. Own server on :3146 by nohup,
   pid written down, served-JS string check before each run.

## 2026-10-22 preparation, browser check owed

In the isolated clone /private/tmp/free-stroke-tlover-4cbc8d5f from integration head
ef04da2a8, components/dock-shell.tsx marks a dock-only panel when folded and refreshes
that mark on a group change. components/workspace/dock.css hides the whole retained
overlay and its pointer events. assert-dock-panels.mjs adds R9 at 1512x982 and
1280x800, with foldshow removing the marker.

`node --check scripts/verify/assert-dock-panels.mjs` passes. `tsc --noEmit`
reports the same six baseline errors: five in lib/geometry-engines.ts and one
missing perfect-freehand in lib/dd-engine/handFeel.ts. `git diff --check` passes.
No browser row ran, so the product fix and R9 remain unverified.

Gemini 4 Argon high returned no review because its read_file permission was
denied. A no-tools API diff read found R9's first must-fail could fire merely
because foldshow removed its marker. R9 now requires the mutant's visible
overlay to take the 3D view's centre before it counts as caught. The browser
must prove that signature. The API also noted that R9 does not exercise a
panel dragged out of the folded dock; assert-rearrange covers dragging but
does not yet cover this marker. That check remains open.

## 2026-10-22 review follow-up, still awaiting browser proof

A new Gemini 4 Argon high review used the diff inline and returned four leads.
Source inspection confirmed that R9's 3D centre probe could miss an overlay
retained over the former dock area. R9 now samples the overlap between the
overlay and the Drawing or 3D panel after folding. The `foldshow` arm counts
only when the visible overlay takes one of those sampled points. A missing
marker alone cannot make the must-fail pass. R9 also settles after clicking
Timeline. The folded CSS rule now applies to overlay descendants, so a child
with its own visibility or pointer setting cannot escape the fold rule.

The other two leads remain browser questions: whether a moved dock panel keeps
the right marker, and whether the rail and Timeline click sequence opens the
dock as expected. `node --check` and `git diff --check` pass after the edit.
`tsc --noEmit` still reports exactly the same six baseline errors. R9 and the
drag path have not run in a browser, so no product verdict is recorded.

## 2026-10-23 browser checks

At 1512x982 and 1280x800, the full `assert-dock-panels.mjs` gate finished
21 PASS, 0 FAIL. R9 found the Timeline overlay visible and hit-testable while
its dock was open. After switching to Style and Draw, the folded marker was
present, the overlay was hidden with no pointer events, and it took 0 of 18
sampled hits in each workspace at each size. The `foldshow` mutant took 18 of
18 hits, so the row proves the old failure. An initial R9 check counted hits
on a retained Drawing box as bad even though the live 3D panel covered it in
Style. A focused browser probe and opened screenshot showed the 3D panel took
those nine hits. R9 now accepts either current canvas panel and still requires
zero Timeline hits.

The Timeline tab is absent from the folded dock's normal tab strip, so a
pointer drag out of that folded state could not be exercised there. A direct
`panel.api.moveTo({ group: view3d.group })` checked the group-change callback
at both sizes: `g-dock` with folded marker and hidden overlay became
`g-view3d` with no marker and a visible, hit-testable Timeline tab. This checks
the marker change but does not claim a pointer drag of that tab. The existing
`assert-rearrange.mjs` independently passed 21/21 with real pointer drags of
other panels; `assert-maximize.mjs` passed 26/26 and
`assert-workspaces.mjs` passed 17/17. All three gates' must-fail arms fired.
