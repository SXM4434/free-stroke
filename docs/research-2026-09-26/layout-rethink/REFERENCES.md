# Layout rethink · references

LAYOUT-REFS lane, 2026-09-26. Research only: no app code changed, no winner picked.

**The problem in one number.** With Presets open, the drawing panel is 755x449 at a 1512x982
window: 339k of 1,485k pixels, **23% of the screen**. He said "one-fourth of the screen", and the
measurement agrees. The style drawer pushes both canvases down, and the dock stacks five tools
under the 3D view, so every new control has taken room from the canvas.

**What I looked at.** 21 images opened with the Read tool. 16 of them show real editor UI and
are saved in `refs/`. The other 5 were marketing art with no UI in them (named per tool below).
Everything under "Saw" comes from an image I opened. Anything else is marked as coming from docs,
from source code, or as not checked.

---

## Tools

### Rive · `refs/rive-animate-mode.png`
**Saw:** a **Design | Animate** segmented switch at the top right, next to Export. Animate mode
keeps the Hierarchy panel (left, about 22% of the width) and the inspector (right, about 20%), and
adds a timeline across the bottom **about 39% of the window height**. The stage between them gets
about **29% of the window**. Beside the timeline sits a list of animations and state machines, and
an Interpolation panel appears on the right once a key is selected. Keys are small grey pentagons
of about 20 px in a 2816 px retina capture, so **about 10 pt** (my estimate), on rows about 35 pt tall.
**For Free Stroke:** one switch in a fixed corner changes which panels exist, and the stage stays
put. Rive's keys are as small as ours; its rows are taller.

### Procreate Dreams · `refs/procreate-dreams-timeline.jpg`
**Saw:** the stage fills the whole width and about 60% of the screen height. The timeline sits
below with tracks that show thumbnails of their content, about 45 pt tall (estimated from the
iPad frame). A floating pill at the bottom holds three modes: **Compose, Perform, Keyframe**. A
**Theater** button hides the timeline and gives the whole screen to the stage. "Edit Flipbook"
opens frame-by-frame drawing in place, on the track.
**For Free Stroke:** Dreams draws and animates in one app, and the answer is modes on the
timeline, not more panels. Perform is a mode there too. Track rows are about 3 times taller than
a desktop dope sheet's, because fingers need it.

### Jitter · `refs/jitter-design-animate.png`
**Saw:** a **Design | Animate** segmented control at the top of the right panel, each half about
half the panel wide. Below it is the inspector for the selected layer. The help center says
Design mode edits the layer's lasting state and Animate mode adds timed actions on top of it
(help.jitter.video, "Design and Animate modes").
**For Free Stroke:** a second tool that splits "what it looks like" from "how it moves" with
one switch. Jitter puts the switch in the inspector, Rive puts it in the title bar.
Not useful: `jitter.video` homepage image was a wordmark, no UI.

### Cavalry · `refs/cavalry-keys.png`
**Saw:** a frame from the docs GIF of the Time Editor. Keys are grey diamonds about **17 px** in
a 922 px wide capture (8 to 9 pt if that capture was 2x; I could not tell). Keys on one attribute
join with a **keybar**: solid when the value changes, dotted when it holds. Layer bars sit in
their own rows, about 32 px tall.
**For Free Stroke:** the keybar is a bigger target than the key. You can grab the span between
two keys to move both, so the diamond does not have to carry every drag.
Not useful: `highlights-1.webp` from the Cavalry homepage was canvas art, no UI.

### After Effects · `refs/after-effects-default.png`
**Saw:** the Default workspace (Wikipedia screenshot, 724 px wide). The composition viewer takes
**about 35% of the window**; the timeline spans the bottom about **28% of the height**; a right
column stacks Preview, Properties, Align, Audio and Effects & Presets as collapsible sections.
**Workspace tabs** sit at the top right: Default, Review, Learn, Small Screen, Standard,
Libraries, and a `>>` overflow.
**For Free Stroke:** After Effects names whole arrangements and puts them one click away.
"Small Screen" is a workspace, which admits the default does not fit every window.

### Blender · `refs/blender-workspace-tabs.png`, `refs/blender-dope-sheet.png`
**Saw:** workspace tabs across the top bar: Layout, Modeling, Sculpting, UV Editing, Texture
Paint, Shading, **Animation**, Rendering, Compositing, Scripting, and `+`. Each tab is a full
arrangement of areas. The dope sheet shows round keys on rows about 18 px tall (estimated), with
channel names in a column about 250 px wide.
**Source code, not a screenshot:** in `keyframes_draw.cc` the key icon is
`U.widget_unit * 0.5`, which is **10 px at 1.0 UI scale**, and the default theme sets the graph
editor's `handle_vertex_size = 5`. Blender's keys are small on purpose, and the UI Scale
preference makes all of it bigger at once.
**For Free Stroke:** workspaces as tabs, each owning the whole window. Blender also lets any area
fill the window (Toggle Maximize Area, Ctrl+Space; from Blender docs, not re-checked here).
Not useful: the Grease Pencil intro image was a viewport render with no UI, so Blender's 2D
Animation workspace is **not seen** in this lane.

### Spline · `refs/spline-timeline.png`, `refs/spline-timeline-illustration.jpg`
**Saw** (YouTube thumbnail of Spline's own timeline video, real UI with a title over it): the 3D
canvas runs **edge to edge behind floating rounded panels**. Objects on the left, properties on
the right, a toolbar pill at the top center, and a timeline panel across the bottom about **28% of
the height**. The timeline rows carry **the property values inline** (Position x, y, z fields
inside the row), key spans are rounded bars about 15 px tall, and a big "+ Animate" button sits
under the rows. The playhead has a labelled chip ("0.49"). The second file is a Codrops
illustration, not the UI: fat blue key handles on a dark bar.
**For Free Stroke:** Spline is the nearest cousin (3D result, web app). It floats panels over a
full-bleed viewport instead of cutting the window into boxes.

### Figma · `refs/figma-ui3.jpg`
**Saw:** UI3 from Figma's own blog. The canvas takes **about 70% of the width at full height**.
Left and right panels are about 15% each. Tools moved to a **floating toolbar at the bottom**. The
right panel opens on **Design | Prototype** tabs. A sidebar button at the top left collapses the
left panel.
**For Free Stroke:** Figma's modes (Design, Prototype, Dev Mode) swap the inspector's contents
and keep the canvas. The UI3 redesign exists to give the canvas more room.
Figma Draw (a fourth mode for illustration) is **not seen**: I did not open its images.

### Framer
**No image.** The help URLs I tried were dead, and I did not reach a real screenshot of Framer's
effects or animation UI. Left for the next lane.

### Apple Motion · `refs/apple-motion.jpg`
**Saw:** the full window from Apple's Motion guide. Inspector on the left (about 27% of the
width), Layers list next to it (about 17%), canvas at top right taking **about 26% of the
window**, transport bar under the canvas, and a timeline across the bottom **about 34% of the
height** with rows about 31 px. Toolbar buttons at the top left toggle Library, Inspector and
Project Pane; HUD is its own button top right.
**For Free Stroke:** Motion is the "panels on panels" we have now, done carefully. It still
leaves the canvas a quarter of the window. Its fix is the toolbar toggles: one button per panel,
always in the same place.

### Keynote
**Not researched.** Budget went to tools with timelines.

### Toon Boom Harmony and Adobe Animate
**No usable image.** Toon Boom's product-page image (`N1-1.png`) was character art with no UI. I
downloaded the Wikipedia screenshot of Adobe Animate (424 px wide) but did not open it, so I say
nothing about it. Left for the next lane.

### LottieFiles Creator · `refs/lottie-creator-timeline.png`
**Saw:** from LottieFiles docs. A thin tool rail and a layers panel on the left, properties on the
right, the canvas in the middle at **about 47% of the window**, and the timeline across the bottom
about **32% of the height**. **Scene tabs** (Main Scene, Fish, Plant, Bowl) sit on top of the
timeline. The transport is a **floating pill under the canvas**, not part of the timeline. Each
property on the right has its own key diamond.
**For Free Stroke:** transport floats with the stage it plays, and keying lives next to the value
you are changing.

### DaVinci Resolve · `refs/resolve-inspector-keys.jpg`
**Saw:** the Edit page inspector: every animatable property has a **diamond plus `<` `>` arrows**
to jump to the previous or next key, right next to the value. The viewer's motion path shows
keys as dots you can drag in the picture.
**Not seen:** the page bar (Media, Cut, Edit, Fusion, Color, Fairlight, Deliver) where each page
takes the whole window. The hero image I opened (`reel-en`) was a video poster. What I say about
pages below comes from Resolve's documented layout, not from an image.

### Krita · `refs/krita-timeline.png`
**Saw:** the Animation Timeline docker as a strip across the bottom of the drawing app, with the
Onion Skins docker beside it. Frame cells are about 7x12 px in a 1000 px wide doc image, the
smallest targets in this set. Transport, frame number and speed sit in the docker's own header.
**For Free Stroke:** Krita adds animation to a painting app by docking one strip. It works, and
the targets are too small to love.

### Workspace and docking systems (added mid-lane)

**VS Code · `refs/vscode-layout.png`. Saw:** an **activity bar** (thin icon column far left) that
picks what the side bar shows, the side bar, editor groups split side by side, a bottom **Panel**
with tabs (Problems, Output, Terminal, Ports), and a status bar. Four layout toggle buttons at the
top right show or hide the primary side bar, the panel and the secondary side bar, plus a
Customize Layout menu. A beginner cannot lose a panel for good: each toggle sits in a fixed place.

**Unity · `refs/unity-docking.png`. Saw:** tabbed docked windows (Hierarchy, Scene, Game,
Inspector, Project, Console), windows torn off to **float** (two Search windows at left), a
**layout dropdown** at the top right reading "Default", and **overlays inside the Scene view**: a
vertical tool strip and a "Cameras" preview float over the 3D view instead of taking a panel.

**After Effects and Blender:** covered above. Both save arrangements as named workspaces.

**Figma UI3:** covered above. Its answer to crowding is fewer boxes, not more.

**Resolve pages:** not seen in an image (see above).

---

## Hit targets for dense editors

| Source | Number | Checked how |
|---|---|---|
| Apple HIG, Accessibility | macOS **28x28 pt default, 20x20 minimum**. iOS and iPadOS 44x44 default, 28x28 minimum. visionOS 60x60. tvOS 66x66. | Read from the HIG's own JSON, 2026-09-26 |
| WCAG 2.2, 2.5.8 Target Size (Minimum), AA | **24x24 CSS px**, or smaller if a 24 px circle around each target touches no other target | From the standard; not re-fetched this lane |
| WCAG 2.2, 2.5.5 Target Size (Enhanced), AAA | 44x44 CSS px | Same |
| Material Design | 48x48 dp touch target, visual can be smaller | From Material docs; not re-fetched |
| Blender source | key icon 10 px at 1.0 UI scale; bezier handle 5 px | `keyframes_draw.cc`, `userdef_default_theme.c`, read 2026-09-26 |
| Fitts's law | time to hit grows with log2(distance / width + 1) | Standard model |

**What this means for keys.** The pro tools draw keys at 10 px and get away with it because a
click selects the nearest key and rows are the real target. The rule to take: **draw the key at
10 to 14 px, and make its hit area at least 24x24** (the whole row height, and half the gap to
each neighbour). By Fitts, going from a 10 px to a 24 px target at a 400 px reach drops the index
of difficulty from about 5.4 to 4.1 bits, roughly a quarter less aiming. Bezier handles get the
same treatment: small dot, 24 px hit circle. Panel edges you drag to resize need an 8 px grab
strip even when the line you see is 1 px.

**Free Stroke's current key size: not measured in this lane.** A grep for key size constants in
`src` came back empty and I stopped there. The next lane should measure the rendered key and its
hit box before any direction is built.

---

## Patterns

1. **One switch changes the task, the stage stays.** Rive and Jitter (Design | Animate), Procreate
   Dreams (Compose, Perform, Keyframe), Figma (Design, Prototype, Dev Mode). The switch swaps the
   panels around the stage; the stage never moves.
2. **Named workspaces own the whole window.** Blender tabs, After Effects workspace tabs, Resolve
   pages (docs only), Unity's layout dropdown. Each task gets an arrangement built for it,
   including ones with no drawing surface at all.
3. **The timeline is one full-width band at the bottom, 28 to 40% of the height.** Rive 39%,
   Motion 34%, Lottie Creator 32%, After Effects 28%, Spline 28%, Dreams about 40%. No tool I saw
   splits the timeline into stacked sub-panels; Graph and dope sheet swap in the same band.
4. **Panels float over a full-bleed canvas, or collapse to nothing.** Figma UI3, Spline, Unity
   overlays, Lottie's transport pill, Dreams' Theater button.
5. **Every panel has one show/hide control in a fixed place.** VS Code's four layout toggles,
   Motion's toolbar buttons, Figma's sidebar button. Nobody finds a panel by scrolling.
6. **Key where you edit the value.** Resolve's diamond with `<` `>`, Lottie Creator's diamond per
   property, Spline's values inside the timeline row. The timeline is for timing, not for finding
   the property.
7. **Keys are drawn small and hit big; spans are grabbable.** Blender 10 px keys, Rive about
   10 pt, Cavalry keybars, Spline's rounded span bars. Touch tools (Dreams) go to about 45 pt rows.
8. **Any area can take the whole window, and a small preview follows.** Blender's maximize area,
   Dreams' Theater, Unity's floating Cameras preview. Focus without losing sight of the result.

## What Free Stroke does against each pattern

1. **No task switch.** Drawing, style, timing, keys and export are all on screen at once, so each
   one gets a slice.
2. **No workspaces.** Animating still shows the drawing panel, which he said an animator may not
   need.
3. **The timeline is five stacked sections** (timing strip, Perform, key lanes with a curve
   editor, transport, Draw-in settings) under the 3D view only, not across the window. The
   band is split instead of swapped.
4. **Panels push, they do not float.** The style drawer pushes both canvases down; nothing
   overlays the 3D view.
5. **No fixed show/hide per panel.** Sections open and close inside the dock and the drawer.
6. **Keying happens only in the lanes,** which is why grabbing keys matters so much: there is no
   second way in.
7. **Key size not measured** (see above). He says they are hard to click, and that is the ruling
   until a measurement says why.
8. **No maximize, no picture-in-picture.** The drawing panel cannot grow past its slice.

---

## Three directions

All sizes at a 1512x982 window. Today, for comparison: drawing panel 755x449, 23% of the window.
**Every direction keeps every current control** and says where more go.

### A · Workspaces: one task takes the whole window
From pattern 2 and 1: Blender tabs, After Effects workspaces, Resolve pages, Rive and Jitter's
switch. Three tabs in the top bar: **Draw, Style, Animate**. Export is a button in the top bar of
every workspace that opens a sheet.

```
DRAW                                                    1512 x 982
+--[ Draw | Style | Animate ]------------------------[Export]--+ 44
|                                    |                         |
|   DRAWING PANEL                    |   3D VIEW               |
|   900 x 938                        |   612 x 938             |
|                                    |                         |
|                                    |                         |
+------------------------------------+-------------------------+

STYLE
+--[ Draw | Style | Animate ]------------------------[Export]--+
|                                          | FAMILIES (8, list)|
|   3D VIEW  1152 x 938                    | open family's     |
|                                          | controls below,   |
|                                          | scrolls           |
|                              [drawing]   | 360 wide          |
+------------------------------------------+-------------------+

ANIMATE
+--[ Draw | Style | Animate ]------------------------[Export]--+
|                                                              |
|   3D VIEW  1512 x 560                          [drawing]     |
|                                                              |
+--------------------------------------------------------------+
| play  pace  speed  | Timing | Perform | Keys | Curves | Draw-in|  36
| labels 200 | band 1312 wide: the chosen tab fills it          |
|            | key rows 32 tall                                  |
+--------------------------------------------------------------+ 378
```

- **Drawing panel:** 900x938 in Draw (57% of the window, 2.5x today). Absent in Animate, as he
  asked; a small thumbnail in the corner jumps back to Draw.
- **3D view:** 612x938 in Draw, 1152x938 in Style, 1512x560 in Animate.
- **Style families:** own workspace, a right column of 360 px. The drawer that pushes canvases
  down goes away.
- **Timing strip, Perform, keys, curves, Draw-in:** tabs in one bottom band in Animate. One fills
  the band at a time (pattern 3), instead of five stacked.
- **Key hit target:** 24x32 (visual 12 px, rows 32).
- **Room for more:** each workspace has its own full column or band, so new style controls land in
  Style and new timing controls land in Animate without touching the drawing panel.
- **What it costs:** you cannot draw and watch the timeline in the same view. A stroke fix while
  animating is a switch to Draw and back. Three arrangements to build, test and keep in sync at
  every window size. A control that lives in another workspace is invisible until you switch, so
  a beginner can think it is gone.

### B · One layout with dockable panels and saved arrangements
From patterns 5 and 2: VS Code's activity bar and toggles, Unity's docking and layout dropdown,
Blender areas, After Effects panels. Every tool becomes a panel with a 28 px header you can grab,
drag to a dock zone, tab with another panel, float, or hide. A **Layout** menu holds presets
(Draw, Animate, Review) plus **Save arrangement** and **Reset layout**.

```
DEFAULT ARRANGEMENT                                     1512 x 982
+-----------------------------------------[Layout v][Export]---+ 40
|R | = DRAWING ===============  | = 3D VIEW ================   |
|A |   732 x 614                |   732 x 614                  |
|I |                            |                              |
|L |                            |                              |
|  +----------------------------+------------------------------+
|48| = Style | Timing | Perform | Keys | Curves | Draw-in ====  |
|  |   dock 1464 x 300, one tab at a time                      |
+--------------------------------------------------------------+
  rail icons: Draw, Style, Animate, Export (click = show/hide)
```

- **Drawing panel:** 732x614 by default (30%, 1.3x today). Dock collapsed: 732x914 (45%).
  Maximized: 1464x914 (90%).
- **3D view:** 732x614 by default, can be dragged anywhere, including full width over the dock.
- **Style families:** a tab in the dock by default; can be dragged out to a right column.
- **Timing, Perform, keys, curves, Draw-in:** tabs in the dock, or split side by side if he drags
  them apart.
- **Key hit target:** 24x28 in the default dock (rows 28), larger when the dock is dragged taller.
- **Room for more:** unlimited. Any new tool is another panel.
- **What it costs:** the biggest build of the three: drag zones, tabbing, floating, min sizes,
  saving, reset, all at every window size. Every panel pays a 28 px header. A user can hide the 3D
  view or drag panels into a mess, so Reset and locked presets are required, not optional. The
  test matrix becomes every arrangement times every window size. The default is only as good as
  its preset, and the default here is still busy.

### C · Stage plus inspector, with maximize and a floating preview
My own, from patterns 6, 7 and 8: Resolve and Lottie's per-property keys, Figma UI3's calm
inspector, Blender's maximize area, Dreams' Theater, Unity's floating Cameras preview. One fixed
layout, no modes and no docking. The style drawer becomes an **inspector column** on the right
that never pushes anything. Every panel has a **maximize** button (and a key) that gives it the
whole window, and a **floating 3D preview** follows you into a maximized panel so the result
stays in view.

```
DEFAULT                                                 1512 x 982
+-----------------------------------------------------[Export]-+ 40
| DRAWING  606 x 662     [max] | 3D VIEW  606 x 662   [max]| INS |
|                              |                          | PEC |
|                              |                          | TOR |
|                              |                          |     |
+------------------------------+--------------------------+ 300 |
| play pace speed | Timing | Perform | Keys | Curves [max]|     |
| dock 1212 x 280                                         |     |
+---------------------------------------------------------+-----+

KEYS MAXIMIZED
+--------------------------------------------------------------+
| play pace speed | Timing | Perform | Keys | Curves   [restore]|
| labels | key rows 36 tall                  +---------------+ |
|        |                                   | 3D PREVIEW    | |
|        | curve editor at full height       | 360 x 240     | |
|        |                                   +---------------+ |
+--------------------------------------------------------------+
```

- **Drawing panel:** 606x662 by default (27%, 1.2x today, and it never gets pushed down).
  Maximized: 1512x942 (96%, 4.2x today).
- **3D view:** 606x662 by default; 360x240 floating preview when another panel is maximized;
  full window when it is the one maximized.
- **Style families:** the inspector column, 300 px: eight families as a list, the open one expands
  its controls below, and the column scrolls. Keys for a style value sit next to the value, with
  `<` `>` to jump between keys (Resolve, Lottie).
- **Timing, Perform, keys, curves, Draw-in:** tabs in one dock band, one at a time; maximize it and
  the band takes the whole window.
- **Key hit target:** 24x28 in the default dock, **32x36 maximized** (visual 14 px).
- **Room for more:** the inspector scrolls, the dock takes tabs, and maximize gives any panel the
  whole window when a task needs it.
- **What it costs:** maximize is easy to miss; Blender's is famously under-used, so the button has
  to sit on every panel header. The floating preview covers part of whatever is maximized. The
  default is still a three-way split, only 1.2x today's drawing panel, so the gain lives in a
  button he has to press. The inspector takes 300 px of width at all times.

---

## UX passes to run after he picks

These judge the build, in this order:

1. **`less-is-more`** holds the veto. For every panel, header, button and toggle: does it earn its
   pixels in the chosen direction.
2. **Hit-target audit,** measured, not eyeballed. Every key, bezier handle, span bar, panel edge
   and header grab: hit box at least 24x24 CSS px (WCAG 2.5.8), 28x28 for buttons (macOS HIG
   default). Report the count that pass out of the total, per control type.
3. **Canvas share** at 1280x800, 1512x982 and 1600x1500, with each panel open and closed one at a
   time against the clean default (OFAT). The drawing panel's share must beat today's 23% in the
   state he uses most.
4. **`interface-style-details`**: one header style, one grab affordance, one radius scale, one
   material across every panel. Floating panels and docked panels must not look like two apps.
5. **Progressive disclosure:** with every panel closed, can he still find each of the current
   controls in one click. Count reachable out of total.
6. **`persona-usability`** with a first-run persona: draw, style, animate, export without
   instructions, and log every place they stalled.
7. **Fitts timing:** time to grab a key and move it 10 frames, before and after, on the same take.
8. **`rams-design-principles`** as the last read on what should not exist.

---

## Left for the next lane

- Real screenshots not captured: Framer, Toon Boom Harmony, Adobe Animate (downloaded, not
  opened), Figma Draw, Resolve's page bar, Blender's 2D Animation workspace, Keynote.
- Free Stroke's own key size and hit box: not measured.
- Material and WCAG numbers are standard values I did not re-fetch today.
