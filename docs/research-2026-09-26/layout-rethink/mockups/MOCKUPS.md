# Layout mockups

**Status, 2026-09-26, lane LAYOUT-MOCKUPS-2:** 8 boards and `sheet.png` are rendered. The first sheet was
looked at and fixed once (see "Fixed after the first look"). The re-rendered sheet has not been opened yet.

## What is here

| File | What it is |
|---|---|
| `probe.mjs` | Read-only. Loads :3000 headless at 1512x982, draws the logo, screenshots, lists every control |
| `capture-inventory.mjs` | Read-only. Opens each of the 8 style families, then Keyframes and Draw-in, and records every control. Also sets the logo transform the mockups should use |
| `parts/app-default.png` | The app today with the logo, nothing open |
| `parts/app-preset-open.png` | Presets drawer open |
| `parts/app-dock-open.png`, `parts/real-dock-open.png` | Dock with Keyframes and Draw-in open |
| `parts/inventory-default.json`, `parts/inventory-open.json` | Every control, its label and its box |

Run either script with `FS_HEADED=0 node <file>` from the repo root. Both use `scripts/verify/lib/browser.mjs` and close their own browser.

## Measured on the live app, 1512x982

- **Keys:** 7 lanes (Draw, Depth, Turn, Orbit, Tilt, Distance, Width). **Rows are 12 px tall and each add-key button is 12x12.** The research file had this as "not measured".
- **Timing strip:** 12 bars, one per stroke, on 12 px rows. The grips at each end are 6x8.
- **Keys are scrolled out of sight.** With Keyframes open, the lanes sit under the 12-row strip inside one scroll box, so you have to scroll to find them.
- **Drawing panel:** 756x890 with nothing open. With Presets open, the drawer pushes it down to 756x627 and the 3D view to 756x270.
- **Dock:** 732x281 closed. With Keyframes and Draw-in open it is 732x545.
- **Look:** Geist; 12px/500 buttons with 10px corners; black fill with white text for the active choice; pills with fully round corners, a 1px `#e5e5e5` edge and 11px text; muted text `#737373`; white page and light grey 3D view. The app loads Geist through `next/font/google`, and the font is not in `node_modules`. The mockup HTML needs Geist from Google Fonts.

## Every control today, and the panel that holds it

- **Top bar:** Rod / Extrude / Solid / Inflate, Engine (Desk Doodles / Free Stroke), Hero beat.
- **Style bar:** Material, Texture, Dither, ASCII, Animation, Layers, Fusion, Preset, and Show panel. Each pill opens one drawer with all 8 families listed down its left side. Presets has a Family select plus 13 presets (Ink, Soft Gel, Matte Clay, Glossy Plastic, Rubber, Signal, Ceramic, Chalk, Chrome, Gold, Wax, Neon, Iridescent).
- **Drawing toolbar:** Undo, Redo, Clear, Smoothing, Corners, Spacing.
- **3D toolbar:** Top, Reset camera.
- **Export:** name field, PNG and its settings, Video and its settings, GLB.
- **Dock:** strip (drag bars and ends), Perform, Ripple, total time; Keyframes (7 lanes with add-key buttons, Camera menu); transport (Play, time, scrubber, Natural / Authentic, the ±% chip, 0.5x / 1x / 2x, Draw-in, Debug); the speed note; Draw-in body (Order, Overlap, Start / End together, Groups / Strokes, direction, Ends: Grow / Travel / Vanish / Shrink, Window length, Lit object / Flat ink, Turn, Delay, easing, Ones / Twos, Reverse / Loop).

## Plan for the next lane

**Build.** Put all 8 states in one `mockups.html` as 1512x982 boards. Render each board with `locator.screenshot` at DPR 2, then make `sheet.png` with A, B and C in rows.

**Real parts to capture next.**
- The drawing logo: clip page x 78, y 396, 600x192 from the default layout, using the logo transform in `capture-inventory.mjs`. Centre it in each drawing panel on white.
- The 3D view at each size. Set the R3F wrapper (the canvas's grandparent) to `position:fixed; inset:0`, then call `setViewportSize` for each size: 612x934, 1152x934, 1512x556, 732x586, 1464x424, 606x662 and 360x216.
- Real strip timings: read the bar boxes from `[data-take-timeline]`.

**Rebuild in HTML.** Build the dock sections in the app's own styles, with real labels and real timings. They have to be drawn at the new row heights, which is the fix being shown. Keys are drawn at 12 to 14 px. The app has no keys set, so any keys you add are examples; say so on the sheet.

| State | Drawing | Timeline or dock | What shows |
|---|---|---|---|
| A Draw | 900x934 | none (play pill on the 3D view) | 3D view 612x934; form and camera tools float on the 3D view |
| A Style | 216x120 thumbnail | none | 3D view 1152x934; a 360 px family list with Presets open |
| A Animate | hidden | 1512x378 | 3D view 1512x556; Keys tab with 32 px rows |
| B default | 732x586 plus a 28 px header | 1464x328 | rail with show/hide icons; dock tabs with Keys active at 28 px rows |
| B animating | hidden | 1464x490 | Timing panel beside a 420 px Draw-in panel; 3D view 1464x424 |
| B drawing | 1464x886 | a 28 px header | Layout menu open, with arrangements, a show/hide check per panel, Save arrangement and Reset layout |
| C default | 606x662 | 1212x280 | Keys at 28 px rows; 300 px inspector with Presets open |
| C dock maximized | hidden | 1512x942 | Keys at 36 px rows and a curve editor; **faint 32x36 click areas drawn on the keys**; floating 3D preview 360x216 |

**Annotations.** Use one colour for annotations, apart from the UI: a blue for size labels and click areas. Put each label chip in a corner that covers nothing. Use the bottom-left corner on C dock maximized, where the preview sits bottom-right.

**What each direction costs.** Copy the costs from `../REFERENCES.md`, "Three directions", into this file under each state once the PNGs exist.

**Do not pick a winner.**

## What he is looking at

Open `sheet.png` (rows A, B, C) or the full-size boards in `png/`. Every board is 1512x982 at DPR 2. The blue chip
in each corner names the direction and state, and its two sizes are measured from the page at render time, not typed.
Keys on the lanes are examples; the app has none set.

- **A · Draw** (`png/A-draw.png`): the drawing gets 900 of the 1512 px, the 3D view sits beside it with the form and camera tools floating on it and a small play pill, and there is no timeline.
- **A · Style** (`png/A-style.png`): the 8 families run down a 360 px column with Presets open, the 3D view fills the rest, and the drawing shrinks to a 216x120 thumbnail.
- **A · Animate** (`png/A-animate.png`): no drawing. The 3D view spans the top and a full-width timeline sits below on its Keys tab, with one strokes row and 7 key lanes at 32 px.
- **B · Default** (`png/B-default.png`): panels on a grey workspace, each with a 28 px header to drag, maximize or hide. The rail on the left shows or hides each panel. Drawing and 3D view side by side, the timeline docked below on its Keys tab.
- **B · Animating** (`png/B-animating.png`): the drawing panel is hidden. The 3D view spans the top, and the timeline sits beside a 440 px Draw-in panel, with key rows at 36 px.
- **B · Drawing** (`png/B-drawing.png`): the drawing panel maximized, the timeline collapsed to its header, and the Layout menu open with three arrangements, a show check per panel, Save arrangement and Reset layout.
- **C · Default** (`png/C-default.png`): drawing and 3D view side by side on the stage, a 280 px dock under them on its Keys tab, and a 300 px inspector on the right with Presets open.
- **C · Dock maximized** (`png/C-dock-max.png`): the timeline takes the whole window. The 12-row strip, 7 key lanes at 36 px with the 32x36 click areas drawn in blue, and a Turn curve; a 360x216 3D preview floats bottom right.

## How it is built

`build.mjs` writes one HTML page per state from shared parts (`mock.css` is the only stylesheet), renders each from
`file://` in its own headless Chrome, then builds the sheet. `extract.mjs` cut the 3D form out of `parts/app-default.png`
and keyed out its #fafafa ground. The drawing is drawn as vectors from `scripts/capture/logo-strokes.json`, the same
strokes the app was fed, because the captured panel clips the word. Stroke bars use those strokes' point counts,
scaled to the 13.1 s take. Run: `FS_HEADED=0 node docs/research-2026-09-26/layout-rethink/mockups/build.mjs`.

The render prints, per board, any text overflowing its box, anything under the label chip, and any stroke bar end
narrower than 24 px.

## Fixed after the first look

- The drawing was a crop of the live panel and read "Desk Doo"; it is now the full word from the stroke file.
- The one-row strip read as a barcode: numbers removed from the bars, ends and grip lines made quieter.
- Debug and the speed note moved behind one More button in the transport.
- Perform and Ripple left B Default, which shows keys only; they belong with the strokes.

## Not done

- The re-rendered `sheet.png` and boards have not been opened. Open the sheet first and check the chip corners.
- The costs from `../REFERENCES.md`, "Three directions", are not copied in under each state.
