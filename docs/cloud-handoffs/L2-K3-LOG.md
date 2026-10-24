# L2 · lift the transport, 2026-09-30

Branch `cloud/layout-l2`, on the snapshot 98071c9 (main plus L1). Cloud lane, Linux container.
Stopped at the end of L2, as briefed. NOT MERGE-READY until he runs the visual checks on his Mac.
(This file replaces the ANIM-1A3 lane log that sat here in the snapshot; that one is in git history.)

## What moved

The transport state left `components/viewport-3d.tsx` for a page-level store, `lib/take-transport.ts`
(`TakeTransport`, read with `useSyncExternalStore`). `app/page.tsx` mounts `<TakeTransportProvider>`
inside `StrokeTakeProvider`. The viewport reads the same store; a host with no provider (the hero page,
`/desk-doodles`) gets a store of its own, which is the `useState` it had.

- Refs, the store's own objects, so the frame loop writes the page's numbers: `playheadRef`, `clockRef`,
  `openingRef`.
- The throttled readout, `progress` (was `progressStore`; `createProgressStore` moved with it).
- Slots, each `[value, setter]` like `useState`, updater form included, so no call site changed:
  `playing`, `speed`, `modeOverride`, `hybridBlend`, `drawInOpen`, `timingNoteOpen`, `debugRequested`,
  `exportName`, `exporting` (GLB), `exportingPng`, `exportingVideo`.
- Derived, computed by the store's functions and published after each commit, before paint:
  `totalDuration`, `takeLen`, `revealEase`, `revealMode`, `seamWindow`. `unEaseReveal` moved into the store
  file (the viewport re-exports it), which ends the import cycle `take-timeline.tsx` works around.
- Dev only: `window.__fsTransport` (playhead, clock, opening, progress, get, set, derived), for gates.

Left where it was, on purpose: `liveRef` (already page-level in `StrokeTakeProvider`), the key reader
(`makeKeyReader` closes over the store's `playheadRef`), the export panels' own settings state (scale,
fps, transparent, open flags), and every handler.

## Commits

| Step | Commit | What |
|---|---|---|
| 1 | cb07ed6 | `lib/take-transport.ts` and the provider in `app/page.tsx`. Nothing reads it yet |
| 2 | c1b2ea4 | The viewport reads play, clock, progress, speed, pace, blend and the dock flags from the store |
| 3 | a5ce88b | Export name and the three in-flight flags into the store |
| 4 | 6b24ba5 | Derived values through the store's functions and published; `unEaseReveal` moves |
| 5 | daf86f0 | New gate `scripts/verify/assert-take-transport.mjs`, the plan's L2 row |
| 6 | this commit | LOG.md |

## Behaviour notes for review

- **Remount.** The viewport takes the page's store once, at mount, and resets it silently (no notify,
  since it runs in render). So a viewport the error boundary remounts starts paused at 0 with speed 1, as
  a fresh `useState` did. L3 note: a panel that writes the store BEFORE the viewport mounts (the viewport
  is `next/dynamic`) will have that write wiped by this reset.
- **Timing of re-renders.** A store update made outside a React event (the frame loop's end-of-pass
  `setPlaying(false)`, the compare cycle's timers) now re-renders synchronously, where `useState` batched it
  into the next task. Same final state; no gate saw a difference. Inside click handlers both batch.
- **Updaters** (`setPlaying(prev => ...)` in `handlePlayPause`, which also resets the playhead) run once,
  when called. React already ran them eagerly in the common case, and StrictMode no longer double-invokes
  them in dev.

## The new gate, `assert-take-transport`

Measured on its first run: inside one frame the strokes draw first (AnimatedStrokes writes `TAKE_LIVE`)
and `PlaybackController` advances the playhead after them. So the playhead a frame draws is the one the
previous frame left in the store. That order is the app's, the same on the snapshot. The gate holds the
store to it exactly: every moving frame's drawn playhead equals the store's playhead one sample earlier.
(My first draft compared same-sample values and went red 86 of 98; that draft never landed. The committed
rows are the exact relation, and the must-fail is a reader one frame later than the store.)

Run on L2 (`FS_PORT=3138 FS_HEADED=0`): **9 PASS, 0 FAIL.** P0 paused equal; P1 89 of 89 moving frames
equal; P2 99 frames, 89 moving, span 0.176 over 3 s; M1 (a reader one frame later than the store) red on
89 of 89; M2 (the throttled readout) red on 89 of 89; S1 Play from the viewport sets the store and the
store pauses the viewport; S2 store speed 2 presses 2x, 1x clicked writes 1; D1 store length 16065 ms =
viewport 16065 ms; G1 0 page errors. It cannot run on the snapshot (no store there), by construction.

## Checks

tsc: **6 errors after every step** (5 in `lib/geometry-engines.ts`, 1 in `lib/dd-engine/handFeel.ts`),
the baseline.

### Node gates, snapshot and L2

| Gate | Snapshot 98071c9 | L2 |
|---|---|---|
| assert-keyframes | 16 of 16 rows, 21 of 21 mutants | 16 of 16 rows, 21 of 21 mutants |
| assert-key-paths | 6 of 7 rows (EXISTING red), 8 of 8 mutants | 6 of 7 rows (EXISTING red), 8 of 8 mutants |
| assert-width-keys | 12 of 12 rows, 9 of 9 mutants | 12 of 12 rows, 9 of 9 mutants |
| assert-camera-moves | 10 of 10 rows, 17 of 17 mutants | 10 of 10 rows, 17 of 17 mutants |
| assert-flip-pose | 8 of 8 rows, 10 of 10 mutants | 8 of 8 rows, 10 of 10 mutants |
| assert-stroke-timing | 0 of 1 rows (RUN red), 0 of 12 mutants | 0 of 1 rows (RUN red), 0 of 12 mutants |

The reds are the same on both sides and are not code: `assert-key-paths` row EXISTING runs
`git show 747af8fa0:lib/keyframes.ts`, and `assert-stroke-timing` archives `b0da66626`. Neither commit
exists in this public snapshot's history (the private monorepo's main is not here), so those rows cannot
run in this clone.

### Browser gates

Environment, all outside the repo and written here so nobody mistakes it for the Mac:

- Google Chrome could not be installed: the proxy returns 403 for dl.google.com. The gates pin
  `channel: "chrome"`, so `/opt/google/chrome/chrome` is a symlink to the pre-installed Playwright
  Chromium 141.0.7390.37. `--use-angle=metal` does nothing on Linux; WebGL is software. Frame hashes are
  this machine's, never the Mac's.
- The sandbox's `lsof` cannot read the dev server's process, so `lib/server-commit.mjs` said "no listener".
  A stand-in `lsof` on PATH (scratchpad, not committed) answers its two queries (listener pid, cwd) from
  `/proc`. The gate's own checks (git head, dirty tree, base sha) are unchanged.
- Two dev servers, both `next dev -H 127.0.0.1`: the unchanged snapshot on :3000 (the reference), L2 on
  :3138 from a worktree of this branch.
- Base files the gates record against "main" were recorded against the snapshot where the gate allows it
  (perform: `--phase=base --base=98071c9`), and stay uncommitted under `docs/verification/`, per the public
  repo rule.

| Gate | Snapshot 98071c9 | L2 | Same? |
|---|---|---|---|
| assert-take-timeline | 20 PASS, 1 FAIL | 20 PASS, 1 FAIL | yes. The FAIL is E2, frame rate with the strip live: 35.9 and 34.8 rAF/s against a bar of 50, software GL |
| assert-stroke-strip | 17 PASS, 1 FAIL | 17 PASS, 1 FAIL | yes, row for row. The FAIL is row 0, "no drag vs main 3a211a36d": its base must be recorded on a pre-dock main, which is not in this clone |
| assert-perform, 4 runs each | 9/5/1 SELF, 10/4/1, 9/5/1, 10/4/1 (PASS/FAIL/SELF) | 10/5, 11/4, 11/4, 11/4 | the same four rows red on both; row 8 red once on L2, chased below |
| assert-dock-shell, 3 sizes, arms | against itself: CLEAN 8/11, arms all fired | against the snapshot: CLEAN 9/11, arms all fired | see below |
| assert-dock-shell `--size=834x1112 --only=clean`, twice each | self: 6/7, then 7/7 | against the snapshot: 5/7, then 7/7 | see below |
| assert-take-transport | cannot run (no store) | 9 PASS, 0 FAIL | new |
| assert-key-lanes | NOT RUN | NOT RUN | refuses: row 11's base is pinned to commit ea31c5b38, not in this clone |
| assert-animation-panel | NOT RUN | NOT RUN | "no baseline: run this gate on main first": needs `main-popover-baseline.json` from a main that still has the Timing popover, not in this clone |

**assert-dock-shell.** Full run, L2 against the snapshot: BUFFERS equal at all three sizes; FRAMES
byte-identical at 1512x982 (after reset c7ef9916) and 1280x800 (at load 9a51cec4, after reset
1519974d); controls see; SURVIVES (a), (b), (c) and DRAW pass; every must-fail arm fired. The two clean
misses:
- SURVIVES (d), the 3D panel hidden as a tab and moved back, comes back 756 or 1512 wide instead of
  755.5. It fails the same way on the snapshot against itself, so it is not L2's; the gate was written on
  the Mac and this may be the Linux layout. Not investigated further.
- FRAMES at 834x1112, after reset: snapshot d44cc8a7, L2 8cffb272. Chased with two more clean runs at 834
  each way. The snapshot against itself drew **8cffb272** in its second run, the same frame L2 drew, and
  L2's second run is byte-identical to the snapshot (7/7). In the snapshot's first self-run both loads came
  up with the 3D canvas at 834x361 instead of 834x217, and L2's first 834 run had the snapshot at 361 and
  itself at 217. That is L1-4's open item (the 834 canvas size at load depends on timing), on the snapshot
  itself, here more often than once in six. Not L2.

**assert-perform.** Its base was recorded against the snapshot (`--phase=base --base=98071c9`, exit 0).
Red on both sides in every run: 1b inflate, 1b extrude, 1b solid and row 2. Row 1b rod is red in 2 of 4
snapshot runs and green in 4 of 4 L2 runs: it flips on the unchanged snapshot, so it is this machine's
timing. Row 8 (no performance: take, slots and 18 frames equal the base, before and after an Esc) is
graded only on L2 (on the snapshot it compares the tree to itself and prints SELF), and the snapshot's
SELF line still reports its own comparisons: after Esc equal in 4 of 4.

**Row 8, one red on L2, chased.** On L2, row 8 was red in the first of four runs, "after Esc false" (the
18 frames before Esc matched, 9 of 9 on Rod and Inflate; the frames grabbed after opening Perform on
stroke D, performing to 0.6 and pressing Esc did not). It did not come back in three reruns. The gate does
not say which frame differed, so I wrote a probe (a scratch copy of the gate's setup that runs only row 8's
sequence: fresh undocked page, the logo, the 18 frames, Perform on D to 0.6, Esc, the 18 frames again,
each compared frame by frame to the base) and ran it 15 times on each server. It is not committed.

| | before Perform, runs with a frame off the base | after Esc, runs with a frame off the base |
|---|---|---|
| L2 | 1 of 15 (Inflate at progress 0) | 0 of 15 |
| Snapshot 98071c9 | 2 of 15 (Inflate at progress 0, both times) | 0 of 15 |

So on this machine the Inflate frame at progress 0 sometimes differs from the base on a fresh page with
nothing performed, on the unchanged snapshot as often as on L2, and it is one of the 18 frames row 8 grabs
after Esc too. That is the likeliest reading of the one red. It is not proven, because the red run did not
name its frame. L2 did not show it more often than the snapshot (1 of 15 against 2 of 15; too few runs to rank them). The Inflate progress 0 grab varying at
load is the snapshot's own, and worth its own look on the Mac.

## Could not run, and why

- `assert-key-lanes`, `assert-animation-panel`: bases pinned to commits or trees this clone does not have
  (above). L2 changed no DOM, so their locators are untouched.
- `assert-key-paths` row EXISTING and all of `assert-stroke-timing`: need main commits 747af8fa0 and
  b0da66626 in git history.
- `assert-stroke-strip` row 0: base must come from a pre-dock main.
- The Mac's own renderer, real Chrome and the Metal ANGLE flag: none here. **He runs the visual checks.**

## For his Mac

Nothing should look different. Worth a look: Play, Pause and scrub; 0.5x, 1x, 2x; Natural and Authentic;
Draw-in open, closed and Esc; the timing note; Debug; PNG, Video and GLB export (the in-flight labels);
the compare cycle, if it is still reachable. And `assert-take-transport` once on the Mac's own server.

## What L3 needs

- Read the store, never copy it: `useTakeTransport()` for the store, `useTransportSlot(store, key)` for a
  slot, `useProgressValue(store.progress)` for the readout, `useTransportDerived(store)` for
  `totalDuration`, `revealEase`, `revealMode`, `seamWindow`, and the refs straight off the store.
  `unEaseReveal` imports from `lib/take-transport.ts` now, no cycle.
- Still in the viewport, and needed by the dock when it leaves: the readouts the transport row renders
  (`timingCharacter`, `timingSummary`, the selected-row readout); the envelope setters (`patchEnvelope`,
  `setRevealMode` and friends), which write the page's document through props, so a panel can call the
  page's handlers directly; `handlePlayPause` and the scrub handler, which reset the playhead and the
  opening pass (move them onto the store, one implementation, not a copy in the panel); the compare
  cycle; the export panels' settings state (scale, fps, timebase, open flags). The export handlers are
  already on `apiRef`.
- The reset-at-mount note above: once panels outside the viewport exist, decide whether a write made
  before the viewport mounts should survive.
- `data-take-dock`, `pb-16` and `lib/undock.mjs` are untouched; L3 retires them per the plan, with the
  gates in §5.1.


# LAYOUT L3 to L6, K2, K3 · cloud session, 2026-09-30 (branch cloud/layout-l3)

Chained after L2 (cloud/layout-l2): waited, polling every 5 minutes, until L2's LOG.md said L2 was done (01b8d33, seen 06:34 UTC), then branched cloud/layout-l3 from it and pushed. L3 was built in a worktree meanwhile and rebased onto 01b8d33. Build plan: docs/research-2026-09-26/layout-rethink/BUILD-PLAN.md. Rulings read: the last entries of docs/rulings/2026-09-26.md (workspaces on dockable panels with maximize, keyframe anything, B's rail with labels, loops keyed through their settings).

## Environment, and what could not run here
- Linux cloud container, 4 cores, no GPU. `pnpm install --frozen-lockfile` ok. `npx playwright install --with-deps chromium` ok. Google Chrome (the `channel: "chrome"` that scripts/verify/lib/browser.mjs pins) could NOT be installed: dl.google.com is refused by the egress proxy. So `/opt/google/chrome/chrome` was symlinked to Playwright's bundled Chromium 141, outside the repo; browser.mjs is untouched. `--use-angle=metal` does nothing on Linux: WebGL runs on SwiftShader. All browser gates ran with FS_HEADED=0 against this session's own `next dev`: :3138 serves the unchanged base (the L2 head) from the main checkout, :3139 serves the lane from a worktree.
- Every number below is this machine's, lane against base on this machine, never against Mac numbers.
- Google Fonts are refused by the proxy too, so every "no console errors" row fails on base and lane alike (`net::ERR_TUNNEL_CONNECTION_FAILED`).
- rAF runs at about 30 to 35 ticks/s here, so rows with a frame-rate bar (assert-take-timeline E2, bar 50) fail on base and lane alike.
- Gates that need a base recorded on an old commit refuse here: this snapshot is one squashed commit, so ea31c5b38, 3a211a36d, 1051bc8e1, a8c03f2c8, 45ed049fc and main's shas do not exist. assert-key-lanes, assert-perform, assert-resize-settles and assert-drawin-curve exit 2 before reading the page; assert-stroke-strip row 0 and assert-stroke-timing-browser 6a print "base file missing".
- assert-custom-presets, assert-hand-clock and assert-motion-customize need `jiti`, assert-camera-frames-the-drawing needs `sharp`; neither is in package.json, and installing either would change the lockfile, so these crash on import here.
- ffmpeg was installed with apt (outside the repo) partway through; assert-export-app still fails its two film rows on base and lane alike ("declared NaNs": the browser's WebM carries no duration ffprobe reads here).
- assert-export-window films every schedule through the real export; on SwiftShader one film takes minutes and a run did not finish in 15 minutes on either tree (it was mid-way, all rows so far PASS, when stopped). Its one moved locator (Video now in the Export tab) is fixed but the run is NOT done here. assert-stroke-timing-browser likewise did not finish in 15 minutes on base, and needs a base file from 1051bc8e1.
- assert-animation-panel needs main-popover-baseline.json, recorded on a main that still had the Timing popover: not runnable here.

## L3 · the dock leaves the viewport
What changed:
- `components/dock-shell.tsx`: a third dockview group under the Drawing and the 3D view holds three panels as tabs, Timeline (strip, Perform, keys, curves, timing note), Draw-in and Export. Its header is the transport row, then the tabs, then a fold chevron; the other groups keep their headers hidden. The dock loads folded to its 36 px header (the Draw arrangement of §3); any tab click opens it to a third of the shell (220 px at least, or the height it last had), the chevron folds and opens it, a drag on its edge sizes it. Draw-in's tab keeps the old button's contract (`data-animation-drawin`, `aria-expanded`, the summary of what is set beside it) and follows the store's `drawInOpen` both ways, so the Animation drawer's "Show in dock" and Escape still work.
- `components/workspace/dock-hosts.tsx`: each dock panel registers an empty host element; `components/viewport-3d.tsx` portals its controls into them and keeps every piece of state and every handler it had (export handlers, compare cycle, plan note). No behaviour moved out of the viewport, only markup.
- `components/workspace/timeline-panel.tsx` (TransportRow, LiveTakeTimeline, TimingNote, DrawInBody) and `components/workspace/export-panel.tsx` (name, PNG and settings, Video and settings, GLB): the JSX cut out of viewport-3d.tsx (its old lines 14362 to 15113), unchanged in what it renders and writes. Docked, Export's two settings cards open under the bar inside the panel instead of over the 3D view. The scrubber got an accessible name, "Playhead".
- `data-take-dock` and its `pb-16` are gone; the 3D canvas fills its panel (755.5 x 854 folded, x 593 with the dock open, at 1512x982). Top and Reset camera float on the 3D view, as §2 says. With no dock on the page (a host without the shell) the viewport still draws its old floating card; chromeless hosts draw neither.
- `app/page.tsx`: the Toaster's bottom offset is `var(--fs-toast-offset, 182px)`, published by the shell as the dock's top edge plus the 88 px the drawing's bar needs. A fixed number cannot clear a dock that folds and opens.
- L1's half-pixel split had to move: with the dock below, the two columns are a nested row and dockview rounded 756.5 to 756, which made the 3D buffer 756 wide against main's 755. The width is now carried like the stacked height already was (group floored, the half pixel put back in CSS vars).
- `scripts/verify/lib/undock.mjs` is retired. `scripts/verify/lib/dock.mjs` replaces it with the page's own operations: `hideDock` (the dock group hidden; the canvas is dockless main's 755x890 at 1512x982, checked within 1 px as undock did) for pages that grab frames against a dockless base, and `openDock` (Timeline tab open, the strip visible and hit at its centre) for pages that drive the strip. Users moved: assert-custom-presets, assert-key-lanes, assert-perform, assert-stroke-strip, assert-stroke-timing-browser, `_probe-customize-delete.mjs`.
- Locators moved: assert-take-timeline and verify-timing-note open the Timeline tab; assert-still-export and assert-export-app open the Export tab; assert-dock-shell compares the two canvases with no dock beside them (lane: dock hidden; reference: the old undock stylesheet, kept in the gate for pre-L3 reference trees only) because no L3 page has main's canvas sizes any more.
- New gate `scripts/verify/assert-dock-panels.mjs` (the plan's L3 rows).

L3 checks (lane = this commit on :3139, base = the L2 head 01b8d33 on :3138, same machine, FS_HEADED=0):
- tsc: 6 errors (5 lib/geometry-engines.ts, 1 lib/dd-engine/handFeel.ts), the baseline.
- NEW assert-dock-panels: 11 of 11. R1 59 of 59 inventory controls reachable one tab away and hit at their centre; R2 a toast covers no control, dock open on each tab; R3 same GL canvas, 0 contexts lost across fold, open and the three tabs; R4 Show in dock opens a folded dock on Draw-in, Escape goes back; R5 the canvas fills its panel folded and open; G1 0 page errors. Must-fails, all FIRED: nodock (2 of 59 reachable), toast182 (covers Lit object, Flat ink), nosync (Draw-in controls do not show), a context lost on purpose is seen.
- lib/dock.mjs `--self`: openDock and hideDock PASS; arms DOCK_MUTATE=nohide and =noopen each THREW.
- assert-dock-shell `--ref` the base: base (against itself) CLEAN 9 of 11 (FRAMES 834x1112 after reset differs, SURVIVES (d) comes back 755.5 to 756, both on the unchanged base), all four arms fired. L3: CLEAN 11 of 11, CONTROL sees, all four arms fired (header, noReuse, onlyWhenVisible, stale). The half-pixel fix is what made BUFFERS equal (before it the 3D buffer was 756 wide).
- assert-take-transport: 9 of 9 on base, 9 of 9 on L3.
- assert-take-timeline: 20 PASS 1 FAIL on base, 20 PASS 1 FAIL on L3; the one is E2, rAF 35.5 and 36.3 ticks/s against a bar of 50 (this machine).
- assert-stroke-strip: 17 PASS 1 FAIL on both; the one is row 0, base file missing.
- assert-drawin-timing, three paired runs: base 1, 2, 1 failures; L3 1, 2, 1 (the console row every time, a CONTROL coverage row in run 2 on both). In the first batch one L3 run died with React's "Maximum update depth exceeded" under `setPlaying` from the harness (stack in the run log: forceStoreRerender from the store's set); 5 more L3 runs and 4 base runs did not show it. Not reproduced, not explained: flagged below.
- verify-timing-note: racy on this machine on both trees (the grab is 220 ms after each seek and SwiftShader is slower). Base PASS 1 of 3 runs, L3 0 of 3, the failing case changing from run to run on both. Must-fail TIMING_NOTE_MUTATE=noopen THREW (through the crop guard: a never-opened dock leaves the note below the window).
- assert-shell-states: 19 pass 4 fail on base and on L3, the same four rows. The quota row reads a toast still on its way in (translateY 147.75 px held over 6 s here, both trees): base COVERED Keyframes, Play; L3 COVERED the drawing's Spacing slider. Settled, the L3 quota toast sits at y 1188 to 1336 of 1460 and covers nothing; the base one settles at 1130 to 1278.
- assert-still-export: 1 row failed on both (console, Google Fonts). assert-export-app: 7 PASS, the 2 film rows fail on both. assert-data-safety: 130 of 134 on both (the same 3.1 and 3.3 rows). assert-debug-surface-fenced: PARTIAL on both (production channel not reached in dev). assert-arm-took: 9 of 11 on both (exemption drift in files L3 does not touch). assert-layer-flicker: red on both, a calibration CONTROL each time (base at the gd_partial guard, L3 at cal_smooth / cal_strobe); timing-bound here.
- Not run here (see Environment): key-lanes, perform, resize-settles, drawin-curve (old base commits), custom-presets, camera-frames-the-drawing (packages), animation-panel (popover baseline), export-window and stroke-timing-browser (not finished). Their L3 edits are the locator and undock moves listed above; the dock helpers they now call were shown firing on their own.

Questions for the owner (L3):
1. The dock loads folded to its 36 px header, which is the Draw arrangement of §3 and gives both canvases the height; the strip shows after one click on its tab. Before L3 the strip showed by default in the 3D column. Keep folded, or open by default? (L4's workspaces make this per workspace: Animate opens it.)
2. Draw-in and Export are tabs beside the Timeline, so Draw-in open hides the strip (it did not before, when it opened under it inside a taller dock). Fine as tabs, or should Draw-in sit beside the Timeline as its own group, as in mockup B-animating?
3. The one "Maximum update depth exceeded" run in assert-drawin-timing (above) did not come back in 9 more runs. Worth watching on the Mac.


## L4 · the rail and the workspaces
What changed:
- `components/workspace/rail.tsx`: B's 48 px left rail (his ruling), not A's top tabs. Top: Draw, Style, Animate. Then show / hide for Drawing, 3D view, Style, Timeline, Export. Bottom: Reset layout. Every icon's label is its accessible name and shows on hover and focus in a tooltip to the right, with the workspace shortcut (1, 2, 3); after the first tooltip the next open with no delay while the pointer stays on the rail (Radix `skipDelayDuration`). No labels in place: at 48 px they would cost the width the rail exists to save, which is the "on hover where space is tight" half of his ruling. Targets 28x28 on a 36 px pitch; the current workspace and each shown panel get the app's black active fill.
- `components/workspace/workspaces.ts`: the three defaults as dockview JSON built for the shell's size (Draw: Drawing 872 of 1464 beside the 3D view, dock folded; Style: 3D view beside Style 360, Drawing hidden, dock folded; Animate: 3D view and Style over the dock open at 390 px of 982, or 40% of the shell). Fixed panel and group ids; a hidden panel stays in the layout, hidden, never removed. Below 1024 px one stacked arrangement in every workspace, never saved. Storage helpers, every call in try/catch.
- `components/dock-shell.tsx`: the shell is the rail plus the panels. Workspaces load with `fromJSON(..., { reuseExistingPanels: true })` over the panels already open. Every change saves the current workspace to `fs.layout.v1.<workspace>` 300 ms after the last one, and only a change: a save that would write the layout exactly as it was loaded is skipped, so Reset (default loaded, save deleted) leaves no save behind until the next real change. Showing or hiding a group fires no dockview layout event, so the rail's toggle saves itself. Blocked storage: the app runs on the defaults and says so once in a toast. A saved layout that names a panel this build lacks, lacks one, places one twice or does not parse: the default loads and a toast names why. 1, 2, 3 switch workspaces (not while typing, not with a modifier; no keydown handler in app/ or components/ bound a digit). Today's half-pixel split (`holdTodaysSplit`) is no longer the page's; it runs only under `workspace.today()` on the harness, for assert-dock-shell.
- The Style panel is the sixth panel: `StylePanelScaffold` with `docked`, a column the height of its panel, the eight families in two columns over the open one. `app/page.tsx`: the style bar (the 8 summary pills and Show panel) and the drawer's open flag are gone.
- Gate locators moved off the style bar (`scripts/verify/lib/dock.mjs` gains `openStyle(page, family)` and `closeStyle(page)`): assert-custom-presets, assert-fusion-authoring, assert-fusion-ui, assert-fusion-newborn, assert-hand-clock, assert-motion-customize, assert-resize-settles, assert-data-safety, assert-animation-panel, assert-drawin-curve, assert-preset-routing.
- `hideDock` on a page with the rail: the two canvases alone at today's split. It cannot reach main's 755x890 any more (the rail takes 48 px and the style bar's 44 px went to the canvases), so there it checks the canvas fills its panel and prints its size; a row comparing against a pre-L4 frame base fails on its own and needs its base re-recorded on this layout. Pages without the rail keep undock's 755x890 check.
- New gate `scripts/verify/assert-workspaces.mjs` (the plan's L4 rows plus the rail).
- The style bar's status line did not go with it: each family in the Style panel's list shows its current value under its name (Material / Ink, Layers / 3 layers, Preset / Solid Cutout), built exactly as the pills were. assert-preset-routing's G rows now read that list. One text changed with the move: the Material value's fallback for a preset id the list does not know read an em dash and now reads "Unknown" (the house rule on dashes).

L4 checks (lane = this commit on :3140, base = L3 on :3139, same machine):
- tsc: 6, the baseline.
- NEW assert-workspaces: 15 of 15. W1 Draw changed (dock 300 px), to Animate and back: 1213 bytes, byte-equal. W2 blocked storage: 0 page errors, 1 toast, opened on Draw's default. W3 a Style save naming a panel "ghost": Style's default loads, one toast names it. W4 no panel under its minimum and no sideways scroll, 3 workspaces x 1280x800, 1512x982, 1600x1500. W5 Reset restores Animate's default and deletes its save; Style's save kept. W6 same canvas, same context, 0 lost across Draw, Style, Animate, Draw and a Reset. W7 9 rail buttons named, 28x28, 36 px pitch inside each group, every label in its tooltip; 3 goes to Animate, 1 to Draw, a 2 typed in the filename field stays text. G1 0 page errors. Must-fails, all FIRED: nosave (round trip differs), unguarded (the page throws "The operation is insecure"), silent (0 toasts), a 2000 px page and a 2000 px minimum (1 and 4 findings), the changed layout reads as different from the default, noReuse (canvas and context replaced, 1 lost), a stripped label.
- lib/dock.mjs `--self` on L4: openDock, hideDock (731.5x934, the rail's layout), openStyle PASS; openStyle on a missing family FIRED; DOCK_MUTATE=nohide and =noopen each THREW.
- assert-dock-panels 11 of 11 and assert-take-transport 9 of 9, on base and on L4.
- assert-take-timeline 20 PASS 1 FAIL (E2, rAF) on both. assert-still-export 1 row failed (console) on both. assert-data-safety 130 of 134 on both, the same four. assert-preset-routing 30 of 33 on both, the same three (setSpin(0) settle and its CONTROL, measured in px of drift). assert-fusion-ui, assert-fusion-authoring, assert-fusion-newborn: the same pass counts (43, 29, 30) and the same failing rows on both. assert-fusion-combo-ui exit 0 on both.
- assert-shell-states 19 pass 4 fail on both, the same rows. On L4 the quota toast, read mid-entry as on L3, sits over the Drawing's bar (Smoothing, Corners, Spacing: the Draw arrangement centres the bar under the toast). Settled it is at y 1188 to 1336 of 1460 and the bar at 1379: clear.
- assert-dock-shell `--ref` L3: SURVIVES (a) to (d) and DRAW PASS, CONTROL sees, all four arms fired. BUFFERS and FRAMES FAIL at all three sizes, by the plan's design: with the rail and without the style bar the two canvases are 731x934 against the reference's 755x890 at 1512x982 (615x752 against 639x708 at 1280x800, 786x531 against 834x509 at 834x1112), so no frame can be compared. See question 3.
- Not run here: assert-custom-presets, assert-hand-clock, assert-motion-customize (jiti), assert-resize-settles and assert-drawin-curve (old base commits), assert-animation-panel (popover baseline). Their locator moves are listed above; `openStyle` was shown working and firing on its own.

Questions for the owner (L4):
1. The three arrangements at 1512x982 (his eye): Draw is Drawing 872 and 3D view 592 over the folded dock; Style is 3D view 1104 and Style 360; Animate is 3D view and Style over a 390 px dock. The Drawing is hidden in Style and Animate (one click on the rail brings it back).
2. The rail's Export button shows the dock on its Export tab; pressed again it goes back to the Timeline tab (Export is a tab of the dock, not a panel of its own). Right, or should Export be its own panel?
3. assert-dock-shell's BUFFERS and FRAMES (L1's "the canvases render what main renders") cannot hold against any pre-L4 tree now. Proposal: record their reference on this layout once he has seen it, then hold later phases to that. His call, since it re-bases a gate.
4. The family values under each name are the old style bar's status line; with the Style panel hidden (Draw) nothing on screen says what is on. Enough, or does he want a compact status somewhere in Draw?
5. The dock's folded header is 36 px, not the plan's 28: the transport's 28 px Play button needs 36 with its padding. The top bar measures 48 px here, not the plan's 40; L4 did not change it.

## L5 · maximize, the dock above all
What changed:
- `components/dock-shell.tsx`: every panel has the one 28 px header §2 describes, its name on the left, maximize and hide on the right (`PanelTab`, `DockHeaderActions`); the dock's header (the transport and the tabs) has maximize beside the fold chevron. Ways in: the header button, a double-click on a header (off its buttons), Shift+Space over the panel under the pointer. Out: the same three, and Esc. Nothing bound Shift+Space before (grepped); Space alone is untouched.
- Built as a layout, not a mode (§3): maximize keeps `toJSON()` in memory, hides every other group and, unless the maximized panel is the 3D view, moves the 3D view into a floating group 360x216 at 12 px from the bottom right (dockview's `tabbar` drag handle, so no 22 px titlebar eats the preview; its edge is a ring, not a border, so the canvas keeps the whole 360x216). Restore loads the kept layout with `reuseExistingPanels`. No animation either way (§3). Maximize is never saved; a reload while maximized comes back restored. A workspace switch, a Reset or a rail toggle restores first. Top and Reset camera are not drawn over the preview.
- The dock maximized marks the root `data-fs-dock-max`, which L6's key rows read to draw at 36 px.
- `components/workspace/workspaces.ts`: the panels' header tab component, and headers shown. `workspace.today()` (assert-dock-shell only) still hides them, so its "header" arm keeps meaning something.
- `disableFloatingGroups` is off (the preview is a floating group); dragging stays off (`disableDnd`), so nothing else can float.
- New gate `scripts/verify/assert-maximize.mjs`.

L5 checks (lane = this commit on :3140, base = L4 on :3139):
- tsc: 6.
- NEW assert-maximize: 15 of 15. X1 maximize then restore byte-equal for the Drawing, the 3D view, Style and the dock, in Draw and in Animate (8 of 8). X2 the same canvas and context throughout, 0 lost, the frame after restore equal to the frame before (6a19c46dcca8cae2 both). X3 the dock maximized: the 3D canvas 360x216, 12 px from the bottom right, on top, the rest hidden. X4 header button, double-click, Shift+Space in and out, Esc out; Shift+Space typed in the filename field does nothing. X5 a reload while maximized comes back restored on the layout from before. X6 the 36 px row mark only while the dock is maximized. X7 every panel's 28 px header with its name and a maximize button, the dock's 36 px one too. G1 0 page errors. Must-fails, all FIRED: restoreDefault (3 of 8 round trips differ), noReuse (canvas and context replaced, 1 lost, the frame differs), nopreview, nokeys, savemax, the row mark read with the dock not maximized, the headers under today().
- Paired, base and lane identical: assert-workspaces 15/15, assert-dock-panels 11/11, assert-take-transport 9/9, assert-take-timeline 20/1 (E2), assert-data-safety 130/134, assert-shell-states 19/4 (the quota toast read mid-entry), assert-preset-routing 30/33, assert-fusion-ui (same rows), assert-still-export (console row).
- assert-dock-shell `--ref` L4: CLEAN 10 of 11. BUFFERS and FRAMES PASS at all three sizes against L4 (the first phase since L3 whose reference has the same chrome), SURVIVES (a), (b), (c) and DRAW PASS, all four arms fired. SURVIVES (d) FAILS: after the 3D view is parked as a hidden tab behind the Drawing and moved back out, its canvas keeps the 1464 px width it had in the tab (its container is 731.5 px; R3F's measure missed the shrink). It fails the same way on L4 (`--ref` L4 against itself, 6 of 7 clean, run just now), and passed once on L4 in the L4 batch, so it is not L5's; it needs strokes on the page to show. The move is not one the product can make (dragging is off; the rail hides groups rather than tabbing them): measured on both trees across Style, Animate, Draw, maximize and restore, the canvas always matched its box. Flagged below.

Questions for the owner (L5):
1. The maximized dock with the floating preview (his eye). The preview keeps the camera as it was (so the frame after restore is the frame before), which crops the mark at 360x216 when the 3D view was tall. Refit the camera in the preview, or keep it as is?
2. SURVIVES (d) in assert-dock-shell (above): a stale R3F size after a hidden-tab move, on L4 and L5. Not reachable in the product today; worth fixing before dragging is ever turned on.

## L6 · hit targets
What changed (BUILD-PLAN.md §4 "Hit targets", the table's six controls):
- `components/key-lanes.tsx`: a key row is 32 px, 36 px while the dock is maximized (L5's `data-fs-dock-max`, watched, so a maximize redraws the rows). A key is drawn as a 12 px diamond (an 8.5 px square turned 45 degrees) in a hit box the whole row tall and 24 px wide. The add-key button is a square 24x24 hit box with its rounded hover plate inside it (a rounded corner is not hit in Chrome, so a 24 px rounded button answers over less than 24x24). A bezier handle is a 5 px dot in a 24 px hit circle.
- The lanes' label gutter is 84 px, was 72: the 24 px add button and 14 px from it to the track, so a key at 0 s (its hit box centred on the track's edge, reaching 12 px into the gutter) never touches the button, and the label keeps room for "Distance". The strip's label column is the same constant, so the two axes still line up.
- `components/stroke-strip.tsx`: each bar end has an invisible 24 px handle, 12 px into the bar (a third of a bar shorter than 36 px, so its middle still moves it) and 12 px outside; at the axis's own edge the handle shifts inside the axis and keeps its 24 px. The drawn grip stays the thin 2 px line. A handle on a bar too short to resize moves the bar, as the bar's own ends do. The bar's hover and grip hint follow the row, so hovering a handle lights the bar it grabs.
- `components/workspace/dock.css`: the resize edges between panels are 8 px grab strips around the same 1 px line (dockview places its sash for 4 px; the strip is widened 2 px each way about the same centre).
- Must-fail switch `__fsHitMutant = "old"` (read once, set only by the gate): today's sizes on every control.
- New gate `scripts/verify/assert-hit-targets.mjs`. Locator moves: `assert-key-lanes` reads the time axis from the key's own track instead of assuming a 72 px gutter, and opens the dock's Export tab before its Video button (that button moved into the tab in L3, and row 10 threw at it on L5); `assert-stroke-strip` opens the Animation family through `openStyle` (its "Animation" style-bar pill went in L4, and it threw at that step on L5). Both breakages were found in this batch, on the base as on the lane.

L6 checks (lane = this commit on :3140, base = L5 on :3139):
- tsc: 6.
- NEW assert-hit-targets: 15 of 15 on the lane. H1 7/7 rows 32 px, 7/7 at 36 maximized. H2 9/9 keys drawn 12 px. H3 9/9 keys hit at all 25 points of a 24x24 grid. H4 7/7 add buttons the same. H5 24/24 bar ends hit at all 9 points across 24 px. H6 2/2 edges 8 px. H7 2/2 bezier handles, a 5 px dot and all 17 points of a 24 px circle. G1 0 page errors. Must-fails, all FIRED with `__fsHitMutant = "old"`: 0/7 rows, 0/9 drawn (9.9 px), 0/9 keys, 0/7 add buttons, 0/24 ends, 0/2 edges (4 px), 0/2 handles (9/17 points, 7 px dots). On the base the same gate fails H1 to H7 (8 PASS, 7 FAIL: the must-fail rows pass there because the base is today's sizes).
- What the gate found on the way, and fixed: a key at 0 s covered the first add button's right edge (the gutter change above); the add button's rounded corners were not hit; the first bar's start and the last bar's end lost the half of their handle outside the axis (the shift above).
- Paired, the same gate script against both servers where a locator moved:
  - assert-maximize 15/15 both; assert-workspaces 15/15 both; assert-dock-panels 11/11 both; assert-take-timeline 20 of 21 both (E2, the SwiftShader frame rate, 26.2 and 29.5 ticks/s against a bar of 50).
  - assert-stroke-strip, with its locator fixed: 17 of 18 both, rows 1 to 7b PASS (the ripple, resize and undo rows included; each is a paired row with its knockout), row 0 FAILS on both (its base file is recorded on 3a211a36d, not in this snapshot).
  - assert-key-lanes, with its locators fixed, run from a scratch copy that skips only row 11's missing base (its base is recorded on ea31c5b38, not in this snapshot) and names the server by path (lsof cannot see listeners in this sandbox), and waits longer for the export's download: 15 of 16 on both, rows 1 to 10 and 12 to 16 PASS with their must-fails fired (row 10: export matches live, 0 of 413 frames differ in state or pixels, twice). Row 11 has no base on either tree.
- Not run: assert-drawin-curve (reads 45ed049fc's `lib/stroke-timing.ts`, not in this snapshot) and assert-resize-settles (its hashes are recorded on a8c03f2c8); both exit before reading the page, on the base as on the lane. The curve handle's hit circle is H7 above; the resize edges are H6.

Questions for the owner (L6):
1. The lanes' label gutter grew from 72 to 84 px so the 24 px add button and a key at 0 s do not touch (his eye).
2. A bar at the axis's own edge shorter than about 36 px has no body left to grab between its two 24 px end handles; it can still be moved from either end handle (which moves it when it is too short to resize) or the keyboard.

## K2 · the frame reads keyed style, loops keep running
What changed (BUILD-PLAN.md §4 "How sampling feeds the style" and "Procedural loops, keyed through their settings", §5 row K2; his ruling that keys drive a loop's speed, amount, contrast and colour, never its phase):
- `components/viewport-3d.tsx`: the main frame callback reads `styleAt(styleState, keys, clockMs)` once at its top, on the key reader's clock (the transport's playhead times the keyed length, the clock export drives too), and every `styleState.` read in the callback is that sample. With no style value keyed it is the doc's own object, so an unkeyed page draws what it drew. The custom material's base is rebuilt per frame when a `customMaterial.` value is keyed (the memo'd one holds the doc's values).
- The key reader now exists when any track has a key, style tracks included. Before, a doc keyed only on style values had no reader, so nothing would have sampled them (found building K2).
- A keyed loop speed runs as a sum (`lib/style-clock.ts`, `runningLayerTime` for the texture, dither and ASCII layers, `runningSum` for the material loop and its sweep): each frame the phase moves by this frame's speed times the base's change, so a speed step bends the motion and never jumps it. The sum restarts where a constant speed would be when the layer re-arms or the clock goes back (an export re-basing it). An unkeyed speed keeps `speed * time` exactly.
- `lib/keyframes.ts` `KEY_DISABLED`: the keyable paths no key drives, each with its reason, left out of the frame's sample (`framedKeys`); K3's key buttons show them disabled with that reason. Their keys still pass `validateKeys` (K1's contract). The list: `texturePhase`, `stackAnimationPhase` (a loop's phase is never keyed); `textureDelay`, `ditherDelay`, `asciiDelay` (a delay moves where the loop starts, so a keyed delay would jump it); `styleLoopSeconds` (a keyed loop length moves every looping layer to another point in its cycle); `stackAnimationSpeed`, `fusionAnimationSpeed` (the stack's loop and fusion's drives still run as speed times time inside `lib/style-stack.ts` and `lib/style-fusion.ts`; a sum there is a larger change, left for a later phase).
- The paths read outside the frame (the plan's list): after K2, none that moves a pixel. Checked path by path: every other keyable value is read inside the callback, the stack's opacities through `resolveStack(styleState)` and fusion's amounts through `evaluateFusion(styleState, ...)`, both called from the frame with its sample, and the material written from the frame's base every frame. The reads left outside are the debug overlay's text and the material's first build, which the frame overwrites.
- `lib/style-system.ts`: `evaluateMaterialAnimation` takes an optional `travel` (the summed phase) in place of `time * speed`.
- Must-fail switch `__fsKeyMutant` (read once, never in production): "memo", "speedxtime", "nodisable".
- New gate `scripts/verify/assert-keyed-style.mjs`.

K2 checks (lane = this code served from a second worktree on :3141, reference = L6 on :3140):
- tsc: 6.
- NEW assert-keyed-style: 13 of 13. K1 a keyed texture speed step 1 to 3 at 2 s: every frame's phase change is its speed times its clock change, worst error 0.00% over 38 frames; FIRED with "speedxtime" (a 3571% jump at the step). K1m the same for the material loop, 0.00% over 44 frames; FIRED (5798%). K2 textureIntensity keyed 0 to 1 after the take: the two frames differ and drew 0 and 1; FIRED with "memo" (identical frames, drew 0.5 and 0.5). K3 a real Video export: 12 of 12 sampled export frames draw what live draws; FIRED shifted one frame (0 of 11). K4 no keys: the lane's frames byte-equal L6's; FIRED with a 0.05 key (frames change). K5 texturePhase keyed (disabled): the frame equals the unkeyed one; FIRED with "nodisable". G1 0 page errors.
- The gate's first run had K2's must-fail BLIND: it compared playhead 0 with playhead 1, which the draw-in alone tells apart. The row now samples two points after the take, where the mark is whole at both; that run is the one above.
- Not run for K2: the paired regression batch (the change is inside the frame callback and reads the doc's own object when nothing style is keyed, which K4 shows byte-equal).

Questions for the owner (K2):
1. Loop-period rounding for a looping export (BUILD-PLAN.md §4) is not built: the export has no "loop" setting beyond the seamless Travel, so which exports count as looping is his call.
2. The stack's and fusion's speeds are on the disabled list rather than made into running sums (a larger change inside lib/style-stack.ts and lib/style-fusion.ts). Worth doing next, or leave them unkeyable?

## K3 · key buttons and keyed lanes
- New `components/key-button.tsx` (key button, placement after the slider label, keyed-edit helper), `lib/style-key-meta.ts` (family and label per path). `Field` in `components/style-panel-scaffold.tsx` draws the button for a single keyable value; the custom material sliders place their own. Editing a keyed value writes a key at the playhead in the same undo step (`app/page.tsx`). `components/key-lanes.tsx` lists keyed style values under their family headings; unkeyed values show no lane.
- tsc: 6. New gate `scripts/verify/assert-key-buttons.mjs`, one run on :3140: 11 of 12, all 5 must-fails FIRED. B1 FAILS: 29 of 30 buttons, ditherAngle's slider draws none (not fixed; stopped at the owner's request). B2 one lane added under Texture, B3 no unkeyed lanes, B4 24x24 hit boxes, B5 an edit keys at the playhead, B6 the three looks, G1 0 page errors.
- Not run for K3: the paired regression batch.
- Question: the take's seven lanes always show; only style values are keyed-only. Keep that?
