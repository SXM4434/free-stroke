# CLOUD-REVIEW, 2026-10-02

Two independent read-only reviews of the snapshot `cloud/integrate-1001` (2cc9e98). No product file was changed. The snapshot is one squashed commit, so neither review could read the lane diffs (`2a16950c7..HEAD`, `--grep HAND-DRAW-P3`, `--grep CARVE-AA`); both read the current state of the named files. Findings marked "proved" were run in a scratch script outside the repo; the rest were traced through the code, not run in a browser. Rulings treated as closed: workspaces on a labelled left rail, dockable panels with maximize, keyframe anything, more controls never fewer, dead-on letters, the hand clock, the flip settling.

## Review 1: layout and keyed style

Scope: `lib/take-transport.ts`, `components/dock-shell.tsx`, `components/workspace/`, the dock and keyed-style parts of `components/viewport-3d.tsx`, `lib/keyframes.ts` (styleAt, loopPhaseAt, acceptKeys), the Field key button (`components/key-button.tsx`, `components/style-panel-scaffold.tsx`).

1. **The 3D view and export never read keyed style values.** `app/page.tsx:2517` hands the viewport the raw `styleState`; only the Style panel gets the keyed one (`KeyedStyle`, `app/page.tsx:2520-2527`). `styleAt` is called only in `components/key-button.tsx`; `loopPhaseAt` is called nowhere. Style key times still lengthen the take through `keysEndMs`.
   Input: key `textureIntensity` 0 at 0 ms and 1 at 2000 ms, play. The slider moves; the 3D view and the WebM stay at the doc value, and the take runs 2 s though the pen ended at 1 s. Sure: high (checked by grep).

2. **Style keys are dropped on every reload.** `lib/doc-store.ts:1048` `readKeys` keeps only the seven `KEY_PROPERTIES` and drops style paths as "not a keyable property"; the save path writes them (`app/page.tsx:930`).
   Input: key `textureSpeed`, reload. The key is gone and "Restored with repairs" shows (proved: `{textureSpeed, turn}` reads back as `['turn']`). Sure: high.

3. **No panel can be moved or resized, against the ruling that every panel can always be rearranged.** `components/dock-shell.tsx:1079-1080` sets `disableDnd` and `locked`. In dockview 8.3.1 `locked` disables every splitview and its CSS gives `.dv-splitview-disabled > .dv-sash-container > .dv-sash` `pointer-events: none`. Only rail show/hide is left. The header comment's "a drag on the edge between them sizes it" is false, and the 8 px L6 edges in `dock.css:74-81` cannot be grabbed. `assert-hit-targets` H6 measures sash size, not pointer-events, so it stays green.
   Input: drag the edge above the dock, or between Drawing and the 3D view. Nothing moves. Sure: high.

4. **A rail click while maximized does the opposite of its label.** `dock-shell.tsx:876` calls `restore()`, then line 886 flips visibility from the restored state, while the pressed state and show/hide label (`readShown`, 598-610) came from the maximized layout where every other group is hidden.
   Input: Draw workspace, maximize Drawing, click rail Timeline ("show"). The dock ends up hidden. Same for Drawing, 3D view, Style. Sure: high.

5. **The key button fails silently when a key is refused.** `key-button.tsx:203` and `:208` ignore the reasons `setKeys` returns (`app/page.tsx:759-766`).
   Add: the Slow Code Crawl preset sets `asciiCellSize: 26` (`lib/style-system.ts:2883`), outside 4..24; the Cell size diamond does nothing and says nothing (proved). Remove: keys 0.1 (easeOut `{x:1/3,y:-1}`), 0.15, 1 on `textureIntensity`; removing the middle one is refused because the curve would swing to -0.152 (proved), with no message.
   Related: `keyedStyleEdit` (`key-button.tsx:144`) returns null on a failed validation, and `app/page.tsx:1180-1184` then writes the style without keys, so the slider snaps back and every other keyed path in the same edit (a preset over several keyed values) loses its key. Sure: high.

6. **Video export ignores the Twos cadence.** Live playback quantises to 12 Hz under `cadence === "twos"` (`viewport-3d.tsx:8348-8351`); export seeks through `easePlayhead: (c) => easeReveal(c, revealEaseRef.current)` (`viewport-3d.tsx:13624`) with no quantising, and nothing in `lib/export/` reads cadence.
   Input: Cadence Twos, export Video at 30 fps. New reveal state every frame; live steps on twos. Sure: high.

7. **The key clock lags the 3D view.** The progress throttle at `viewport-3d.tsx:11456-11462` writes the `p` captured when its timer was armed and drops later values. `readKeyClock` (`key-button.tsx:77-79`), `KeyedStyle` and the key button read that `progress`; the frame loop reads `playheadRef`.
   Input: 2 s take, play to the end without loop. If the p=1 frame lands while a timer is pending, progress settles near 0.97: the label reads about 1.9 s and a diamond click keys at about 1.94 s while the view shows 2.0 s. A mid-play Pause is off by up to 66 ms times speed. Sure: medium-high.

8. **Crossing 1024 px while maximized leaves maximize stuck and stops saving.** The `lg` handler (`dock-shell.tsx:993-998`) reloads the layout but never clears `maxRef`. The header keeps "Restore the layout", `save()` returns early on `maxRef` (line 627) so later layout changes are silently not saved, and Restore loads the stale pre-crossing layout.
   Input: maximize Style at 1512 px, narrow below 1024, widen again, hide a panel, reload. The hide was not saved. Sure: medium-high.

9. **A saved layout can pass the check and crash every load.** `layoutProblem` (`components/workspace/workspaces.ts:165-194`) checks only panel ids and placed views; `loadLayout` (`dock-shell.tsx:757-767`) has `try/finally` with no `catch` and runs from `onReady` (line 943). All three pass `layoutProblem` (proved): a renamed `contentComponent` (dockview throws "Only React.memo... accepted"); a leaf with a numeric `data.id` (TypeError, and on a workspace switch dockview has already removed every panel, the reused 3D view included); a root of type `"leaf"` ("root must be of type branch"). The error leaves `onReady` and recurs on every reload until storage is cleared. A view id missing from `panels` passes and is silently skipped. Sure: high that these escape, medium on how reachable.

10. **Keyed values ignore integer slider steps.** `lib/keyframes.ts:490` writes the raw interpolation; `ditherLevels` and `asciiCellSize` have `step: 1` (`style-system.ts:755`, `:759`).
    Input: `ditherLevels` 2 at 0 ms, 8 at 1000 ms reads 3.296 at 300 ms; `asciiCellSize` 4 to 24 reads 8.32 (proved). Labels show fractions, and once finding 1 is fixed the float uniforms (`dither-shader.ts:274`, `ascii-shader.ts:407`) draw off-grid. Sure: high on values, medium on the look.

11. **A viewport remount resets the transport store without notifying.** `lib/take-transport.ts:278-285` resets state with no subscriber notify; `viewport-3d.tsx:11004` calls it on mount, including remounts from the error boundary (`viewport-3d-wrapper.tsx:169`). `DockShell`'s `drawInOpen` and `useKeyClockMs` readers keep old values.
    Input: Draw-in tab open, a scene error remounts the viewport. The store says closed, `DrawInBody` is not portalled, the tab still shows active over an empty panel. Sure: medium.

## Review 2: Hand Draw phase 3 and carve

Scope: `lib/stroke-timing.ts` (rebasePerformed, performedHolds, takeLiftsMs, pace holds), `lib/camera-moves.ts` (orbit lifts), the clock memo and clock handlers in `app/page.tsx`, the lift tip hold in `components/viewport-3d.tsx`, the CARVE-AA shader. No undo split was found: `edit()` stores the whole document and every clock or rate path (`handleRevealEnvelopeChange`, `applyMotionPresetById`) is one `edit()`.

1. **Performed strokes move when the hand clock is re-stamped by anything but the clock pills.** `clockNib` feeds `stampPenClock` -> `humanLiftsMs` -> `assignLetters`, and the `clocked` memo re-derives on it (`app/page.tsx:792`). The Solid Thickness slider (`app/page.tsx:2231`, `2281`) writes only `solidParams`, so `rebasePerformed` never runs and the performed row stays stored against old slots. A spacing or smoothing change does the same through `handleReprocessed` (`app/page.tsx:650`) on either clock.
   Input: Hand clock, perform stroke 3, drag Solid Thickness. Sure: high.

2. **Draw-in and window changes do not rebase performed rows.** `handleDrawInChange` (`app/page.tsx:680-688`) and `handleRevealWindowChange` (824-832) never call `rebaseForClock`, though its own comment (page.tsx:700) says a draw-in change re-stores them and the preset path passes `nextDrawIn` and `nextWindow` (1494). Both move base slots (tracks; Grow to Travel changes `liftsLandBetweenStrokes` and the Natural pace).
   Input: perform a stroke, set Draw-in overlap 0 to 0.3, or Window Grow to Travel under Natural. Sure: high (checked).

3. **The held-back fix in `rebasePerformed` misses the clamp.** `lib/stroke-timing.ts:922-931` adds `old t0 - now t0` to `delayMs`, but `placeSlots` clamps `t0 = max(0, lastEnd + delay)`; when the new clock's unclamped start is below 0 the row still lands at 0.
   Input (proved): stroke 1 performed and held back, delay -3500, old base `[0,4600, 4000,4600]`, swap to rate 2x (new base `[0,2300, 2000,2300]`): slot `[1100,1700]` becomes `[0,600]`. Reachable from the strip: perform a late stroke early, "lands last", drag near 0, pick 2x. Fuzz: 14,582 random takes, non-held path exact every time, all 11 failures this clamp. Sure: high.

4. **A zero-length new slot skips the row, and the swap back writes Infinity.** `withPerformed` (`stroke-timing.ts:1198-1201`) skips when `B1 > B0` is false, so the stroke moves and collapses; swapping back divides by the old 0 length, `speed = Infinity`, saved as `null`, and the build plays it at speed 1 with a shifted delay.
   Input (proved): `[0,1000, 1000,2000]` to `[0,500, 900,900]`, slot `[1000,2000]` to `[900,900]`; back gives `{delayMs:-100, speed:Infinity}`. Needs a stroke zero-length on one clock only (all points one timestamp). Sure: medium on code, low on frequency.

5. **The lift cache key misses the pace.** `entry.lifts` (`viewport-3d.tsx:5482`) is cached under `timed.sig` (`stroke-timing.ts:532`), which holds `base.sig`, `baseMs`, ripple and rows but not the pace. A pace-only change under a timed take (Natural to Authentic, Grow to Travel, hybrid blend) keeps the old tip bake and old triangle keys (`viewport-3d.tsx:6432`), while the strip rebuilds its pace, so "Turn in the lifts" turns the camera during ink. Root cause predates phase 3. Input: one +1 ms row, Natural to Authentic, pick "Turn in the lifts". Sure: medium (traced).

6. **The lift tip hold does not cover Vanish.** `viewport-3d.tsx:7135-7143`, `7159` clamp only `tu.d` (`winNow.hi`). Under Vanish `windowAt` gives `lo = d, hi = 1`, so the moving trailing edge (`tu.w0 = winNow.lo`, `trailOn`) is never held, and Vanish keeps the pace's lift holds. The R13 creep returns there. Input: Inflate, Hand, Window Vanish, one strip row. Sure: medium (traced).

7. **CARVE-AA changes the ramp at every angle, not only grazing ones.** `viewport-3d.tsx:2306` swaps `fwidth(fsSd)` for `length(vec2(dFdx(fsSd), dFdy(fsSd)))`. On a 45 degree screen edge `fwidth` is about 1.41x the gradient length, so the ramp narrows from about 1.41 px to 1 px on every diagonal carved edge, head-on included (the lane's own note: head-on f222 to f224 moved 1843 px to 372 px from the prior). The tip still uses `fwidth` (`viewport-3d.tsx:2812`), so carve and tip now antialias differently. Input: any head-on frame with a carved diagonal edge, `uFsPenAA = 1`. Sure: high that pixels change; whether that is acceptable is the owner's call (checked).

8. **`rebaseForClock` builds slots from inputs the viewport does not use.** `app/page.tsx:715-717` uses `env.mode` and a fixed hybrid blend 0.4; the viewport and strip use `modeOverride ?? env.mode` and the transport's `hybridBlend`. Input: Debug, Smooth, perform a stroke, swap Recorded and Hand. Lands off. Sure: medium; debug controls only.
