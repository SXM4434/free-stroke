# LOG-PRESETFIX · 2026-10-03

Lane CL-PRESETFIX, clone ~/.fs-lanes/cl-docs, branch claude/presetfix at integration head 853886863.

## The four gates (pass on main, fail here)
1. assert-custom-presets: panelShut waits for [data-preset-customize] to hide after closeStyle; it stays visible.
2. assert-preset-pixels: page.click on button[title="Edit Preset"] times out.
3. assert-motion-customize: Looping Stroke saved preset does not reapply the edited take after away and back.
4. assert-resize-settles row 1: opening the Preset panel shrinks the 3D canvas 755x890 to 395x890.

## Plan
- Diff main..HEAD on the Preset / Customize / dock files and the four gates.
- For each, drive the real pointer path on my own server (next dev -p 3146, nohup, pid recorded) to decide product or gate.
- Product regression: find the commit with git log on the file, fix it. Stale locator: fix the gate, keep its bar.
- Every fix shows its must-fail firing. tsc stays at 6. Rerun the four plus assert-rearrange (21 of 21).
- Close: server stopped by pid, .next deleted, docs/verification restored.

## Results (lane retired at the 150k context line, before the gate reruns)

Probe on my server (:3146, cwd this clone, real page at 1512x982): openStyle then closeStyle left the Style
panel showing (shown.style true, [data-preset-customize] visible). That is gate 1 reproduced on HEAD 853886863.

1. assert-custom-presets · PRODUCT. components/dock-shell.tsx, harness `workspace.toggle` (was line 1175).
   bfa8fd63c made `toggle` read the flip from React `shown`; the harness is built once in onReady and kept the
   first render's closure (shown all false), so every harness toggle showed and never hid. The rail button itself
   gets the current `toggle`, so his clicks were not affected. Fix 0f2966b0f: `railToggleRef`, harness calls
   `railToggleRef.current(id)`. Gate side 4e9a267ea: `closeStyle` (scripts/verify/lib/dock.mjs) reads its close
   back and throws with the reason.
2. assert-preset-pixels · GATE. Line 222 clicked `button[title="Edit Preset"]`, the style bar pill L4 (842cf0220)
   removed; 0 such buttons on the page. Fix 4e9a267ea: two real clicks (rail `button[data-rail-panel="style"]`,
   then `[data-style-family="presets"]`), read back as the open family; close is the rail click plus a hidden
   wait. Must-fail arm `PP_MUTATE=norail` skips both clicks and has to throw.
3. assert-motion-customize · PRODUCT, exposed by the bigger corpus. Looping Stroke's "away" preset is now
   Stagger (corpus 9, was 7). Stagger (3bc046a30) writes per-stroke delayMs into the take; applyMotionPresetById
   left them there for any later preset, so the saved Looping Stroke came back with 50 ms gaps. Probe: drawIn,
   window and schedule equal, getTotalDuration 108 -> 134 ms. Fix 3d4948e37: leaving a Stagger preset zeroes the
   row delays (`withoutStagger`, lib/stroke-timing.ts); delays under any other preset survive a pick.
4. assert-resize-settles · NOT row 1. Row 1 [fix] PASSES in the sweep (0 px of 395x890). The gate exits 1 because
   row 4 is NOT COMPARED: main's base is 755x533 (main's in-flow dock), and dock-size refuses the 401 px window
   shrink. The 395 width is L4's Style panel taking its width from the 3D view only (592 -> 232 at 1512x982 in
   the probe). Not fixed here; it is a layout call for him, not a commit regression.

tsc: 6 errors after the fixes (the baseline).

## Left, and the next step
NOT RUN: the gate reruns and the must-fails. Runner, ready: `zsh <scratchpad>/presetfix-run.sh`
(scratchpad = /private/tmp/claude-501/-Users-sebs/2a1d3d28-4efb-4862-bdf3-64238bb23149/scratchpad). It needs
`node_modules/.bin/next dev -p 3146` started with nohup from this clone; it preflights the served JS for
`railToggleRef` and `withoutStagger` before each run, runs preset-pixels, its norail arm, custom-presets,
motion-customize, resize-settles and rearrange, then puts the three product files back to 9f1d9ef11 (preflight
must report both strings MISSING) for the custom-presets and motion-customize must-fails, and restores HEAD.
Logs land in <scratchpad>/presetfix-runs/, summary.txt lists exits. Then stop the server by pid, rm .next,
`git checkout -q -- docs/verification`.
