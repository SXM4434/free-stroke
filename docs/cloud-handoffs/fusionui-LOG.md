# LOG-FUSIONUI · claude/fusionui from 4c126362b

assert-fusion-ui has two "visible without scrolling" rows (6b) red on the integration head, green on main. 806b2c909 added 3 dials (Chaos, Reveal, Tip shimmer), the Completion and Pause hold pill rows, and a key diamond per dial, so the Fusion panel body grew.

## Plan
1. Run the gate at 1512x982 and 1280x800 on my own server (:3146, this clone, fitSwallow proven in the served JS first).
2. For each clipped dial: its y against the scroll body, what holds it (the scroll container, its overflow and max-height), and whether a wheel scroll inside the panel brings it on screen.
3. Rule: product (a control nobody can reach, no scroll box) or gate (the panel scrolls; the row demands one screen). Weigh the gate's claim against "more controls, not fewer" (docs/rulings/2026-09-26.md).
4. Fix where it belongs, with a must-fail that brings the cause back. If it is a look call, stop and write options with numbers.
5. Rerun assert-fusion-ui (all rows), assert-fusion-chaos (10 of 10), assert-hit-targets (16 of 16), tsc at 6.

## Results
Measured on my server :3146, fitSwallow proven in the served JS before the runs.

**Where the dials sit.** The scroll body is `div.fs-panel-enter` (style-panel-scaffold.tsx:4060), docked: `flex-1 min-h-0 overflow-y-auto`, no max-height, scrollHeight 1325. Dial positions do not move with the window: row 1 (Speed, Link, Swing) labels at y 738, tracks at 758; row 2 (Chaos, Reveal, Tip shimmer) labels at 876, tracks at 896 and 913. Body bottom: 902 at 1500x950 (the gate's size), 934 at 1512x982, 752 at 1280x800. A real wheel inside the panel reaches every dial at all three sizes (scrolled 696, 664, 846).

**What was red.** At 1500x950 Tip shimmer's track (913) and all three row-2 labels sit below 902. Plus a second gate bug: fdbe89da9 filtered `STYLE_KEY_META` on `m.family === "fusion"`, but `family` is an object, so DIALS came back empty and the self-check, the button sum and the dial count were red too. Fixed to `m.family.id`.

**Ruling: GATE.** No control is unreachable; the panel is a scroll box and the wheel reaches every dial. The row demanded every dial and its explanation on one screen of a fixed panel. Under "more controls, not fewer" (2026-09-26), with space coming from workspaces and a dock that maximizes, that claim cannot hold as controls keep landing, so it is replaced by two claims that keep its reason:
- OPEN: at open, no scroll, the first dial row (label, track, explanation) is on screen. This is the defect the row was written for, a panel that ended before the dials.
- REACH: a real mouse wheel inside the panel brings each dial fully on screen.
Must-fails, applied in the page and undone: a body cut above the dials fails OPEN and still passes REACH; a body clipped below row 1 with `overflow-y: hidden` leaves Chaos, Reveal and Tip shimmer unreached. The gate also takes FS_VIEWPORT=WxH (default 1500x950).

**Gates.** assert-fusion-ui 53 of 53 at 1500x950 and at 1512x982, both must-fails firing. assert-fusion-chaos 10 of 10, 20 of 20 mutants. assert-hit-targets 16 of 16. tsc 6.

**His call: 1280x800.** OPEN fails, 52 of 53. The body ends at 752; row 1 labels start at 738, so only their names show and the tracks (758) and explanations sit below the fold. Every dial is still reached by wheel. 806b2c909 added its rows AFTER the original dial grid, so row 1's position predates it; by that reading main misses the same way at 1280x800. Inferred from the diff, not measured on main. Options, none picked:
- A. Leave it. 467 px of picker, relationships, drives and caption sit above the dials; the space comes from the workspace layout and the maximized dock.
- B. Move the two dial grids above the picker. Every dial on screen at open in a 481 px body if the grids stay under about 300 px, but the picker and relationship pills then fall below the fold at short windows instead.
- C. A fade at the body's bottom edge while scrollHeight > clientHeight (1325 > 479 here), so the scroll is visible without moving any control. It does not put the dials on screen.
