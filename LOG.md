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
