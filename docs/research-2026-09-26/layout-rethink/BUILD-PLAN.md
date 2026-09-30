# Layout rethink · build plan

**Lane LAYOUT-PLAN, 2026-09-26, on main 73cad6c39.** No app code changed. Rulings folded in: the last four
entries of `docs/rulings/2026-09-26.md` (workspaces on dockable panels with maximize, keyframe anything, the
left rail replaces A's top tabs, procedural loops keyed through their settings).

What gets built: a 48 px rail on the left switches three workspaces, **Draw, Style, Animate**. Each workspace
is a saved arrangement of dockable panels. Any panel maximizes; the maximized dock is where keyframing
happens. Every numeric style value gets a key button, and keyed values show up as lanes in the dock.

---

## 1 · Library: dockview

**Pick: `dockview-react` 8.3.1.** It is the only one of the six where I checked, on its own docs, all three
things the 3D view needs: the panel's DOM can stay alive through a move, the panel instance lives until it is
removed, and loading a saved layout can reuse the panels already open.

| | dockview | FlexLayout | rc-dock | react-mosaic | golden-layout | react-resizable-panels + own tabs |
|---|---|---|---|---|---|---|
| Version, last publish | 8.3.1, 2026-09-10 | 0.11.1, 2026-09-26 | 4.0.2, 2026-09-22 | 7.1.0, 2026-09-10 | 2.6.0, **2023-02-21** | 4.13.3, 2026-09-23 |
| License | MIT | MIT | Apache-2.0 | Apache-2.0 | MIT | MIT |
| React peer | 16.8 to 19 | 18 or 19 | >=18 | 16 to 19 | none (no React binding) | 18 or 19 |
| Min / gzip | 388 KB / **88.8 KB** (with core) | 209 / 52.7 KB | 188 / 57.3 KB (pulls lodash, rc tabs, menu, dropdown) | 134 / 39.4 KB (pulls react-dnd and 4 backends) | 128 / 29.7 KB | 41 / 13.2 KB |
| Drag to dock | yes | not checked | not checked | tiles only, not checked | not checked | **no**, we build it |
| Maximize | **checked**: `maximizeGroup`, `exitMaximizedGroup`, `hasMaximizedGroup`, `onDidMaximizedGroupChange`; panel `maximize()`, `isMaximized()`, `exitMaximized()`. Other groups hide until restore | not checked | not checked | not checked | not checked | we build it |
| Show and hide | panels add and remove; `onShow`/`onHide` hooks **checked** | not checked | not checked | not checked | not checked | we build it |
| Save a layout | **checked**: `toJSON` / `fromJSON(layout, { reuseExistingPanels })` | not checked | not checked | not checked | not checked | we build it |
| WebGL survives a move | **checked**: `renderer: 'always'` keeps the DOM alive and hidden instead of removing it; "the panel instance is only ever destroyed when it is removed from Dockview"; the docs say re-parenting an iframe reloads it and `'always'` is the fix | not checked | not checked | not checked | not checked | nothing moves, so yes, but no docking either |

Sources I read: [rendering modes](https://dockview.dev/docs/core/panels/rendering) ·
[maximized groups](https://dockview.dev/docs/core/groups/maximizedGroups) ·
[loading state](https://dockview.dev/docs/core/state/load) ·
[issue #718, the fixed-panel-pool use case](https://github.com/mathuo/dockview/issues/718) (its answer did not load).
Versions, licenses, peers and dates: `npm view`, 2026-09-26. Sizes: bundlephobia's API, same day.
Repos: [dockview](https://github.com/dockview/dockview) · [FlexLayout](https://github.com/caplin/FlexLayout) ·
[rc-dock](https://github.com/ticlo/rc-dock) · [react-mosaic](https://github.com/nomcopter/react-mosaic) ·
[golden-layout](https://github.com/golden-layout/golden-layout) ·
[react-resizable-panels](https://github.com/bvaughn/react-resizable-panels).

**Why not the others.** golden-layout has not published since February 2023 and has no React binding.
react-resizable-panels is a split-pane library: drag to dock, tabs, floating and saving would all be ours to
write and test, which is B's "biggest build" cost with nobody else's bugs fixed for us. FlexLayout and rc-dock
are live and lighter; **I did not check their maximize, save or remount behaviour**, so they are not ruled out
on merit, only on what I could confirm. If the phase 1 gate fails on dockview, FlexLayout is the next one to
test, with the same gate.

**What dockview costs.** 88.8 KB gzip, the heaviest of the six. The viewport chunk is already split off with
`next/dynamic` (`components/viewport-3d-wrapper.tsx:81`), so the shell grows and the 3D code does not.
`react-resizable-panels ^2.1.7` is already in `package.json`; whether any file imports it I did not confirm
(the grep failed on a shell glob). If nothing does, phase 1 removes it.

**The 3D view never remounts, and phase 1 proves it before anything else is built.** Three settings together:
the 3D and drawing panels render with `renderer: 'always'`; every workspace switch and every maximize goes
through `fromJSON(..., { reuseExistingPanels: true })`; the set of panel ids is fixed, so no layout ever
removes the 3D panel, it only hides it. The viewport already rebuilds its `<Canvas>` under a new key when the
GL context is lost (`glGeneration`, `components/viewport-3d.tsx:11218` to `11232`), so a remount would not
crash; it would rebuild the scene and drop state. That is the failure the gate looks for. **Fallback if the
gate fails:** the viewport renders once in a fixed layer and follows its panel's box, so neither the canvas
nor its React tree ever moves.

---

## 2 · Panels

One header style for all of them: 28 px, name on the left, maximize and hide on the right, drag from anywhere
on the header. Resize edges get an 8 px grab strip over a 1 px line.

| Panel | Wraps today | State it needs |
|---|---|---|
| **Drawing** | `DrawingCanvas`, `components/drawing-canvas.tsx:52`, mounted at `app/page.tsx:2567`. A 2D context (`drawing-canvas.tsx:256`). Its toolbar (Undo, Redo, Clear, Smoothing, Corners, Spacing) stays inside it | Already all in `page.tsx`: `rawStrokes`, `processedStrokes` (353), `canvasSettings` (403), undo state and handlers |
| **3D view** | `Viewport3DWrapper`, `app/page.tsx:2586`, into `components/viewport-3d.tsx` (`<Canvas>` at 13984). Top and Reset camera float on it as an overlay (Unity's pattern) | Already props from `page.tsx`. Keeps `renderer: 'always'` |
| **Style** | `StylePanelScaffold`, `components/style-panel-scaffold.tsx:3748`, mounted at `app/page.tsx:2452`. One panel: the 8 families as a list (Material, Texture, Dither, ASCII, Animation, Layers, Fusion, Presets), the open family's controls below, Customize (`PresetCustomize`, 3408) inside it | `styleState` (393), `setStyleStateRecorded`, `activePanelId` (1142), the `drawInTiming` bundle. `panelsOpen` (1141) goes: the rail shows and hides the panel |
| **Timeline** | The strip, `StrokeStrip` in `components/stroke-strip.tsx:217` through `TakeTimeline` (`components/take-timeline.tsx:284`) and `LiveTakeTimeline` (`viewport-3d.tsx:8104`, mounted 14438); Perform (`components/perform-take.tsx:53`, at `stroke-strip.tsx:634`); the keys and curve editor, `KeyLanes` (`components/key-lanes.tsx:506`, at `stroke-strip.tsx:666`) | The `StrokeTakeProvider` context (page level, `stroke-strip.tsx:123`) plus **viewport-only** state, listed under "Lift" below |
| **Transport** | Inline in `viewport-3d.tsx:14451` to `14680`: Play, time, scrubber, Natural / Authentic, the ±% chip, 0.5x / 1x / 2x, Draw-in toggle, Debug; the timing note at 14725 | Viewport-only, see "Lift". Not a panel of its own: it is the Timeline group's header row, so Play shows even when the dock is collapsed |
| **Draw-in** | `DrawInTimingControls`, `components/draw-in-timing-controls.tsx:73`, mounted in the dock (`viewport-3d.tsx:14698`) and again inside Style (`style-panel-scaffold.tsx:3185`) | `drawIn`, `revealWindow`, `revealEnvelope`, `flatten`, all already in `page.tsx` (413 to 423) |
| **Export** | Inline in `viewport-3d.tsx:14832` to `14960`: name, PNG and settings, Video and settings, GLB | `exportName` (10918), the in-flight flags (10917 to 10945). The handlers stay in the viewport and are already reachable from the page through `apiRef` (`exportPNG`, `exportVideo`, `exportGLB`, 13642 to 13654) |

**Not panels:** the top bar (Rod / Extrude / Solid / Inflate, Engine, Hero beat) stays a 40 px bar. The style
bar (`app/page.tsx` ~2406 to 2445, 44 px: the 8 summary pills and Show panel) goes; the Style panel's family
list does its job, and the rail does Show panel's.

**One Style panel, not eight.** Eight panels pay eight 28 px headers and eight show/hide toggles on the rail.
dockview can split a family out later at no extra build cost if he wants that. His eye decides.

### Lift out of `components/viewport-3d.tsx`

The strip, the key lanes and the transport read state that only the viewport holds. Before any of them can
render in a panel outside it, that state moves to one page-level store (a `TakeTransport` external store read
with `useSyncExternalStore`, next to `StrokeTakeProvider`), and the viewport reads the same store:

- `playing` (10987), `progressStore` (10989), `speed` (11018), `modeOverride` (11028) and so `revealMode`
  (11100), `hybridBlend` (11029), `openingRef` (11041), `drawInOpen` (11145), `timingNoteOpen` (10981),
  `debugRequested` (11271);
- derived, computed once in the store: `revealEase` (11089), `unEaseReveal`, `seamWindow` (11990),
  `totalDuration` (11314);
- export: `exportName` and the three in-flight flags.

`liveRef` already lives in the page-level context (`stroke-strip.tsx:97`), written each frame by `KeyLive`
inside the Canvas (`viewport-3d.tsx:7946`, mounted 10494). It stays as it is.

---

## 3 · Workspaces

### The rail, the one place that switches and shows

```
+----+
| Dr |  Draw             workspace
| St |  Style            workspace
| An |  Animate          workspace
|----|
| [] |  Drawing          show / hide
| () |  3D view          show / hide
| == |  Style            show / hide
| -- |  Timeline         show / hide
| vv |  Export           show / hide
|    |
| .. |  Layout: Reset this workspace
+----+
 48 px
```

- Every icon has a label, shown in a tooltip on hover with its shortcut (Radix Tooltip is already a
  dependency). After the first tooltip opens, the next ones open without the delay while the pointer stays on
  the rail. No labels in place: at 48 px they cost width.
- Each icon is a 28x28 target (macOS default) on a 36 px pitch. The current workspace and each shown panel
  get the app's active fill, black with white.
- Shortcuts proposed: 1, 2, 3 for the workspaces. **Grep the existing keydown handlers first**; `/` is the
  flip and Space is likely Play.

### Default arrangements at 1512x982

Rail 48, top bar 40, so the panels share 1464x942. Panel sizes include their 28 px header.

```
DRAW                                                        1512 x 982
+----+--[ Rod Extrude Solid Inflate | Engine | Hero beat ]----------------+ 40
|Dr  | = Drawing ======================== | = 3D view ================   |
|St  |   872 x 914 (canvas 872 x 886)     |   592 x 914                  |
|An  |                                    |   [Top] [Reset camera]       |
|----|                                    |                              |
|[]  |                                    |                              |
|()  +------------------------------------+------------------------------+
|..  | > Play 0:00 --o---------- 1x  Timeline (collapsed)          1464x28 |
+----+-------------------------------------------------------------------+

STYLE
+----+-------------------------------------------------------------------+
|    | = 3D view =================================== | = Style ======== |
|    |   1104 x 914                                  | families list    |
|    |                                               | open one below   |
|    |                                               | 360 x 914        |
|    +-----------------------------------------------+------------------+
|    | > Play ...  Timeline (collapsed)                             x28  |
+----+-------------------------------------------------------------------+

ANIMATE
+----+-------------------------------------------------------------------+
|    | = 3D view =================================== | = Style ======== |
|    |   1104 x 552                                  |   360 x 552      |
|    +-----------------------------------------------+------------------+
|    | = Timeline | Draw-in | Export ============================ [max] |
|    | > Play 0:00 --o-------- Natural  1x                           36 |
|    | strokes (strip rows)                                             |
|    | keyed lanes, 32 px rows, grouped by family       1464 x 390      |
+----+-------------------------------------------------------------------+

DOCK MAXIMIZED (any workspace)
+----+-------------------------------------------------------------------+
|    | = Timeline | Draw-in | Export ======================== [restore] |
|    | > Play ...                                                       |
|    | strip, lanes at 36 px rows, curve editor      +----------------+ |
|    |                                               | 3D preview     | |
|    |                                  1464 x 942   | 360 x 216      | |
|    |                                               +----------------+ |
+----+-------------------------------------------------------------------+
```

- **Drawing share in Draw:** canvas 872x886 is 52% of the window. Today's measured numbers: 756x890 with
  nothing open and 756x627 with Presets open (`mockups/MOCKUPS.md`); `REFERENCES.md` gives 755x449, 23%, as
  its comparison state. Either way Draw more than doubles the worst case.
- **The dock in Animate** is 390 of 982 px, 40%, the top of the 28 to 40% band every timeline tool used
  (`REFERENCES.md`, pattern 3). 326 px under the transport holds 10 rows at 32 px.
- **Drawing is hidden in Style and Animate.** One click on the rail brings it back where it was. A's small
  thumbnail is left out until he asks for it.

### How a workspace saves, and Reset

- Every layout change saves the current workspace's `toJSON()` to `localStorage` under
  `fs.layout.v1.<workspace>`, 300 ms after the last change. Every read and write sits in try/catch; with
  storage blocked the app runs on the defaults and says so once in a toast, never silently.
- Loading goes through `fromJSON(saved, { reuseExistingPanels: true })`. A saved layout that fails to load, or
  names a panel id that no longer exists, falls back to that workspace's default and says which.
- **Reset** (rail, bottom item) replaces the current workspace with its default and deletes its saved copy.
  The other two workspaces keep theirs.
- The panel ids are fixed: `drawing`, `view3d`, `style`, `timeline`, `drawin`, `export`. A hidden panel stays
  in the layout, hidden; it is never removed, which is what keeps the 3D view alive (§1).

### Maximize and restore

- **Ways in:** the maximize button on every panel header, a double-click on the header, and Shift+Space over
  the panel under the pointer (Blender 2.7's key; check nothing binds it today). **Out:** the same three, plus
  Esc.
- **What happens:** the panel takes the whole 1464x942 area. The rail and the 40 px top bar stay, since the
  rail is how you leave. When the maximized panel is not the 3D view, the 3D view floats as a 360x216 preview
  12 px in from the bottom right corner, so the result stays in sight. Everything else hides.
- **Built as a layout, not a mode:** maximize saves the current `toJSON()` in memory and loads a maximized
  layout (the one panel, plus the 3D view in a floating group) with `reuseExistingPanels`; restore loads the
  saved one back. That uses only the pieces checked in §1. dockview's own `maximizeGroup` hides every other
  group, and I did not check whether a floating group stays visible over it.
- **No animation on maximize or restore.** He will do this many times an hour (`less-is-more`), and animating
  it resizes the WebGL buffer on every frame of the transition. `emil-design-eng` was not read in this lane;
  the next lane reads it before adding any motion here.
- Maximize is not saved. Reloading while maximized comes back restored.

---

## 4 · Keyframe anything

### The model

`lib/keyframes.ts` keys seven fixed properties today: `KeyProperty` (41) and `TakeKeys =
Partial<Record<KeyProperty, Track>>` (85). The `Key`, `Track`, bezier and `valueAt` (199) stay exactly as they
are. What changes:

- **A key path** replaces the fixed union: the seven names as they are, plus any numeric leaf of `StyleState`
  (`lib/style-system.ts:352`) or of `MotionFieldKey`, named the way `PresetFieldKey` (`style-system.ts:5216`)
  already names fields: `textureSpeed`, `ditherScale`, `customMaterial.roughness`, `drawIn.overlap`.
- **`KEYABLE_PATHS`** is built once by walking `DEFAULT_STYLE_STATE` for numeric leaves, each with its range.
  The range comes from the same constants the sliders use. If a range is written inline in the scaffold
  today, lifting it into one table is part of phase K1, so a slider and a key can never disagree.
- **`validateKeys`** (160) keeps refusing an unknown name (165), now against `KEYABLE_PATHS`, and checks every
  path's range the way it checks `drawProgress` and `width` today (149 to 153). Out of range is refused with
  its reason, never clamped.
- Old documents load unchanged: the seven names keep their spelling.
- `sampleKeys` validates the whole field on every call (239). With dozens of tracks that runs every frame.
  Validate once when the keys are set, and sample without re-validating.

### How sampling feeds the style, live and in export

- `styleAt(base: StyleState, keys, clockMs): StyleState` returns `base` itself when nothing style is keyed,
  and otherwise a copy with each keyed leaf replaced by its sample.
- The viewport's main frame callback (`viewport-3d.tsx:5509`) calls it once at the top, on the key reader's
  clock (`makeKeyReader`, 7832), and every `styleState.` read inside that callback becomes a read of the
  result (for example `textureIntensity` at 5665, `textureSpeed` at 5688, `ditherScale` at 5730,
  `materialAnimationSpeed` at 6023 and 6066).
- Export already drives the same frame loop on a driven clock and samples keys per frame (12367), so export
  gets the keyed style with no second path.
- **The catch:** `viewport-3d.tsx` reads `styleState.` 143 times, and some of those reads are in render or
  memo code, not the frame. A key on a value read there would not move. Phase K2 lists every numeric path
  read outside the frame; each is either moved into the frame or its key button is disabled with the reason
  written on it. A key button that does nothing is a dead dial.
- **Editing a keyed value** at the playhead writes a key at the playhead (After Effects' rule once the
  stopwatch is on). Otherwise the next frame's sample overwrites the edit and the slider looks broken. A
  keyed slider shows the sampled value while playing.

### Procedural loops, keyed through their settings (his ruling)

- The loop runs on its own clock. Keys drive its **speed, amount, contrast and colour** over the take, never
  its phase.
- **Phase is the running sum of speed over time:** each frame, `phase += speed(clockMs) * dt`, per layer, in
  the style clock (`lib/style-clock.ts`, `evaluateLayerTime` at 320). A keyed speed change then bends the
  motion and never jumps it. Unkeyed, the sum equals today's `speed * elapsed`, so nothing moves on main.
- Export zeroes the style clock at its first frame already (the driven-clock notes at `viewport-3d.tsx:5520`),
  and steps a fixed `dt`, so the running sum is the same on every export.
- **Off is amount keyed to 0.** No separate on/off key.
- **A looping export can round the loop period to the clip:** `period' = clipMs / round(clipMs / period)`, so
  the first and last frames match. Only when the export is set to loop.

### The key button in `Field`

- `Field` (`components/style-panel-scaffold.tsx:3187`) knows its field keys (`k`). For a numeric path it draws
  a key button right after the label text, placed with the same label measuring `ScopedField` uses for the
  edited mark (`markSpot`, 3278; the F124 note at 3208), and before that mark.
- `Field` returns its children bare when there is no Customize scope (3199). The key button cannot depend on
  that scope, so it wraps outside it.
- The button: a diamond drawn at 12 px in a 24x24 hit box. Three looks: no keys (outline), keyed with a key on
  this frame (filled), keyed but not on this frame (outline with a dot). Click adds a key at the playhead, or
  removes the key under it.

### The dock lists only keyed values, grouped by family

- A style path shows as a lane the moment it has a key, under its family's header row (Material, Texture,
  Dither, ASCII, Animation, Layers, Fusion). Deleting its last key removes the lane (`compactKeys`, 181,
  already drops empty tracks).
- **The seven lanes that exist today stay visible**, as one "Draw-in and camera" group. Camera has no field
  to put a key button next to, so its lanes keep their add buttons. That is my reading of "only keyed values
  show"; his eye confirms it.

### Hit targets

| Control | Today (measured, `mockups/MOCKUPS.md`) | Built |
|---|---|---|
| Key, drawn | 12x12 add button | 10 to 14 px diamond, 12 by default |
| Key, clickable | 12x12 | at least 24x24: the whole row height and half the gap to each neighbour |
| Key row | 12 px | at least 32 px; 36 px maximized |
| Strip bar ends | 6x8 grips | at least 24 px wide hit area, the drawn grip stays thin |
| Bezier handle | not measured | 5 px dot, 24 px hit circle |
| Panel resize edge | none | 8 px grab strip over a 1 px line |

---

## 5 · Phases

Each is one lane under about 100k context, and each leaves main working and green. L1 to L6 are the layout;
K1 to K3 are the keys. **K1 touches only `lib/keyframes.ts` and can run beside L1 to L3.**

| Phase | Builds | Owns | Gate rows (must-fail) | His eye |
|---|---|---|---|---|
| **L1 · dockview shell, proven** | dockview in; today's two columns become two fixed panels (Drawing, 3D view) with no headers yet, the viewport's own dock still inside it. Nothing moves for him | `app/page.tsx` (the two-column block, ~2560 to 2590), new `components/workspace/dock-shell.tsx`, `package.json` | **GL survives:** the same canvas element and no `webglcontextlost` across a panel drag, a maximize and restore, and 20 `fromJSON` round trips (must-fail: `renderer: 'onlyWhenVisible'` or `reuseExistingPanels: false` changes the canvas element or rebuilds the scene). **Sizes unchanged:** canvas and drawing sizes at 1512x982 equal today's (must-fail: a 28 px header shrinks them). All `_lane-gates.sh` rows green | Nothing should look different |
| **L2 · lift the transport** | The `TakeTransport` store (§2, "Lift"); the viewport reads it; no visual change | `components/viewport-3d.tsx` (the state block 10981 to 11145, 11314, 11990), new `lib/take-transport.ts` | Store playhead equals the viewport's drawn clock on every frame of a 3 s play (must-fail: a `useState` copy in a panel lags by at least a frame). All dock gates green with no locator change | Nothing |
| **L3 · the dock leaves the viewport** | Timeline (strip, Perform, keys, curves), Draw-in and Export render as dockview panels; the transport becomes the Timeline group's header row; `data-take-dock` and its `pb-16` go; `lib/undock.mjs` is retired | `components/viewport-3d.tsx` (14386 to 14960 move out), new `components/workspace/timeline-panel.tsx`, `export-panel.tsx`, the locators in §5.1 | Every moved control reachable by role and name (count of the MOCKUPS inventory found, out of its total); elementFromPoint finds each control, not a toast (must-fail: the old `Toaster` offset 182 against the moved transport) | The dock under both panels, collapsed and open |
| **L4 · rail and workspaces** | The rail; Draw, Style, Animate defaults; save per workspace; Reset; the style bar and Show panel go | new `components/workspace/rail.tsx`, `workspaces.ts`, `app/page.tsx` (style bar ~2406 to 2445) | Draw to Animate to Draw returns byte-equal layout JSON; blocked storage runs on defaults and toasts once (must-fail: an unguarded `localStorage` read throws); a corrupt saved layout falls back and names why (must-fail: silent fallback); no panel under its minimum and no sideways scroll at 1280x800, 1512x982, 1600x1500 | The three arrangements at 1512x982, the rail with its tooltips |
| **L5 · maximize** | Header button, double-click, Shift+Space, Esc; the floating 360x216 preview; 36 px rows when the dock is maximized | `components/workspace/maximize.ts`, the header component | Maximize then restore returns byte-equal JSON; the canvas element is the same one throughout; the 3D frame before maximize equals the frame after restore (must-fail: a canvas remounted at 360x216 draws differently, the ANIM-3G size history noted in `scripts/verify/lib/undock.mjs`) | The maximized dock with the preview |
| **L6 · hit targets** | Rows 32 px, keys 12 px drawn with 24x24 hit boxes, strip ends 24 px, resize strips 8 px | `components/key-lanes.tsx`, `components/stroke-strip.tsx` | Measured hit box per control type, reported as pass out of total (must-fail: today's 12x12 key button and 6x8 grip fail the same check) | Grabbing and dragging a key |
| **K1 · the key path model** | `KEYABLE_PATHS`, ranges table, validate once, `styleAt`; no UI | `lib/keyframes.ts`, `lib/style-system.ts` (ranges only), `lib/doc-store.ts` (load and save) | A keyed style path samples its bezier; an unknown path is refused with its reason; an out-of-range key is refused (must-fail: clamped silently); an old doc with the seven tracks loads byte-equal | Nothing |
| **K2 · the frame reads keyed style, loops keep running** | `styleAt` at the top of the frame at 5509; phase as a running sum per layer; loop-period rounding for looping export; the list of paths read outside the frame | `components/viewport-3d.tsx` (frame at 5509 to ~6100), `lib/style-clock.ts` | **Phase continuous:** a keyed speed step 1 to 3 at 2 s moves the phase with no jump at any frame, frame-to-frame change within speed times dt (must-fail: phase computed as speed times time jumps by 4 cycles at the step). Keyed `textureIntensity` ramp changes pixels between frame 0 and frame 60, and export frame N equals live frame N (must-fail: a path read only in a memo shows no change). Unkeyed renders identical to main | A keyed texture speed ramp, filmed |
| **K3 · key buttons and keyed lanes** | The key button in `Field`; edits on a keyed value write a key; keyed lanes grouped by family in the Timeline | `components/style-panel-scaffold.tsx` (`Field`, `ScopedField`), `components/key-lanes.tsx` | Count of numeric fields with a key button equals the count of keyable paths not on K2's disabled list (names each missing one); keying adds exactly one lane in its family; an unkeyed path shows no lane; a key button's hit box is at least 24x24 | Keying a few values and watching the lanes appear |

After K3 the UX passes in `REFERENCES.md` ("UX passes to run after he picks") run in their order, with
`less-is-more` holding the veto.

### 5.1 · Gates whose locators move

Found by grep over `scripts/verify`. The patterns were grouped, so a file listed may match one pattern of its
group, not all.

- **Style bar pills, Show panel, `aria-expanded` (L4):** `assert-animation-panel`, `assert-data-safety`,
  `assert-drawin-timing`, `assert-custom-presets`, `assert-fusion-authoring`, `assert-fusion-ui`,
  `assert-hand-clock`, `assert-fusion-newborn`, `assert-motion-customize`, `assert-preset-pixels`,
  `assert-resize-settles`, `assert-still-export`, `assert-stroke-schedule`.
- **The dock's DOM, `data-animation-panel`, `data-take-dock`, `data-take-timeline`, `timing-note` (L3):**
  `assert-arm-took`, `assert-animation-panel`, `assert-key-lanes`, `assert-take-timeline`,
  `verify-timing-note`, plus most of the list above, and `lib/undock.mjs`.
- **`undock` users, retired with it (L3):** `assert-custom-presets`, `assert-key-lanes`, `assert-perform`,
  `assert-stroke-strip`, `assert-stroke-timing-browser`. Their frame and mask bases were recorded at a
  755x890 canvas and are re-based once, in L3, with before and after sizes written down.
- **Play, PNG, GLB, Reset camera (L3):** `assert-camera-frames-the-drawing`, `assert-resize-settles`,
  `assert-still-export`.
- **Sizes written into the gate (755, 890, 533, 1512) (L1, L3, L4):** `assert-animation-panel`,
  `assert-custom-presets`, `assert-fold-census`, `assert-hand-clock`, `assert-hero-windup`,
  `assert-key-lanes`, `assert-motion-customize`, `assert-perform`, `assert-resize-settles`,
  `assert-stroke-strip`, `assert-texture-anim`. Some only use 1512 as the window width.
- **What is under each control (L3):** `assert-data-safety`, `assert-export-app`, `assert-shell-states`,
  `assert-take-timeline`. `assert-shell-states` section 3 is what catches the `Toaster` offset when the
  transport moves.

---

## 6 · Risks

1. **The 3D view remounts on a move, a switch or a maximize.** The biggest one: it drops the scene and
   anything the viewport holds. L1 is built to fail on it first, before any other phase starts.
2. **Canvas size history.** `lib/undock.mjs` records that a canvas mounted at one size and shrunk draws
   differently. Every resize and every maximize now changes the canvas size. That is a product risk, not only
   a gate one, and L5's frame-before equals frame-after row is there for it.
3. **Dead key buttons.** A keyed value read outside the frame does not move. K2's list and K3's denominator
   stop a button from shipping that does nothing.
4. **A control in another workspace looks gone** (A's cost). Every panel is one click from the rail in every
   workspace, and L4's reachability count checks it.
5. **dockview's own look** fights the app's (Geist, 10 px corners, 1 px edges, black active fill). One header
   style, one grab affordance, one radius scale, checked by `interface-style-details` in the UX passes.
6. **88.8 KB gzip** added to the shell.
7. **Below 1024 px** the page stacks its two columns today (`app/page.tsx`, the note above the column
   block). How dockview behaves there I did not check. L4 sets one stacked arrangement under 1024 and leaves
   phones out of scope, as the page already does.

### His eye, or a gate

| A gate decides | His eye decides |
|---|---|
| The GL context and canvas survive every move, switch and maximize | The three default arrangements and their sizes |
| Layout JSON round trips byte-equal; Reset restores the default | The rail: icons, tooltips, what sits at the bottom |
| Hit boxes at least 24x24, rows at least 32, strip ends at least 24, counted per control type | Whether the drawing hides in Style and Animate, or shows small |
| Every current control reachable, counted against the MOCKUPS inventory | One Style panel or one per family |
| Phase continuity under a keyed speed; export frame equals live frame | Whether the seven draw-in and camera lanes always show |
| Every key button changes a pixel, or says why it is disabled | How keying feels, filmed; how maximize feels with no animation |

---

## Left for the next lane

- FlexLayout's and rc-dock's maximize, save and remount behaviour: not checked. Only needed if L1 fails.
- Whether dockview can hide a group's header (L1's "sizes unchanged" row depends on it) and whether a
  floating group shows over a maximized one: not checked.
- `emil-design-eng` not read; read it before any motion is added to panels.
- The keydown bindings for 1, 2, 3 and Shift+Space: not grepped.
- Where the slider ranges live for each style field: not located.
- Whether anything imports `react-resizable-panels`: not confirmed.
