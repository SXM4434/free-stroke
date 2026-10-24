NOT DONE

# CX-ROW8

## Plan
1. Read the inherited diff and trace logs. Fetch integrate/cloud-1001, compare the L4 merge with the cloud page, and commit this plan.
2. Keep only sound inherited gate input changes. Run row 8 against this checkout at main's canvas size. Prove the frame input, the 9 of 9 result for Rod and Inflate, and the late-fit must-fail.
3. Equalize the Customize box focus and scroll input against a freshly recorded main box. Run the Customize row and its 1 px must-fail. Inspect any remaining image difference.
4. Run TypeScript, record gate counts and limits, commit each finished step by pathspec, then stop the owned server, delete .next, and restore docs/verification.

## Steps and commits
- Plan: `2e3ae28f8`.
- Read inherited diff, fetched integrate/cloud-1001 at `92ea77631`, and compared `0670c89c8:app/page.tsx` with cloud `3bd02a10a`. The L4 rail, workspace and Style panel structure landed. The cloud page differs in its later clock policy and the merge's retained flip control, not a missing L4 layout block. Commit: pending.
- Row 8 input: the branch canvas was 731.5x934 after `today()` at 1512x982. `sizeToMain` proved both canvases at 755x890 buffers and 755.5x890 CSS before stroke injection. The clean row 8 was 9/9 Rod and 9/9 Inflate against main, with the performed-frame and 1 ms clock controls unequal. Two attempts to run the optional late-fit arm lost Chrome during frame grabs, before row 8, so that arm has no verdict yet. Commit: pending.
- Browser route: new AGENTS.md instruction prohibits Chrome launch in Codex. `lib/browser.mjs` now connects to a reserved shared CDP browser when BROWSER_CDP is set and disconnects only its own contexts. CDP run pending. Commit: pending.

## Gates
- `assert-perform --dwell-engines=none`: row 8 9/9 Rod, 9/9 Inflate, 12 PASS, 0 FAIL, 3 NOT RUN in unrelated dwell engines. Exit 1 because the command marks NOT RUN as incomplete. The row's paired must-fail condition fired: performed frames unequal, and all three 1 ms clock changes unequal.
- `PERFORM_FIT=late` twice: 10 PASS, 1 gate-threw FAIL, 3 NOT RUN each. Chrome closed during `picture()`, before row 8. No late-fit verdict.
- `tsc --noEmit -p .`: 6 existing errors.

# CL-ROW8V (Claude lane, finishing the two browser checks)

## Plan
1. Own server on :3142 from this clone (nohup, pid written below), FS_PORT=3142 FS_HEADED=0, normal browser.mjs launch path (Google Chrome, --use-angle=metal), no BROWSER_CDP, no :9301/:9302. Before each gate run, grep the served JS for a string only this tree has; no string, no run.
2. Row 8 of assert-perform.mjs: run clean, then PERFORM_FIT=late. Record Rod and Inflate counts for both. The late arm must read red.
3. Customize box row of assert-custom-presets.mjs: make the grab blur the active element and equalize scroll on both sides, re-record main's box if the row needs it, run clean and with its must-fail. If the boxes still differ, open both at 1x and write what was seen.
4. tsc stays at 6. Stop the server by pid, delete .next, git checkout -q -- docs/verification. Commit each result by pathspec. No push.

## Results
- Servers. Main for the base: a detached worktree of 8583f6f0f at .trace-wt/8583f6f0f, node_modules as an APFS clone copy (Turbopack refuses a node_modules symlink: "points out of the filesystem root"), next dev :3142, listener cwd that worktree, `__dockHarness` in 0 of 38 served chunks. Stopped by pid, worktree removed. Then this clone: next dev :3142 pid 82616, listener 82637 cwd the clone, `TRANSPORT_DEFAULTS` (lib/take-transport.ts, absent on main) in 1 of 41 chunks, checked before every run. Browser: lib/browser.mjs normal launch, headless, no BROWSER_CDP.
- Main's Customize box, recorded again with the blur and scroll grab: 1262x275.5 at 213,223.38, `ca48f3145dc541d7`, stable, masked false, focus inside false. Same hash as the uncommitted 20:28 record, so the record repeats.
- Row 8 clean: PASS, rod 9/9, inflate 9/9, both canvases 755x890 (css 755.5x890) before the strokes, 1 ms clock controls unequal. Run total 11 PASS, 1 FAIL, 3 NOT RUN. The FAIL is row 2 (re-perform stroke D: samples 667 -> 354, speed 0.530 -> 1.000). Row 2 passed in the late run, so it is not stable; not touched here.
- Row 8 PERFORM_FIT=late: FAIL, rod 0/9, inflate 0/9, after Esc false. The must-fail reads red. Run total 11 PASS, 1 FAIL (row 8), 3 NOT RUN.
- Customize box row: FAIL. `4833a91ef4c9d816` here vs `ca48f3145dc541d7` main, both 1262x275.5, stable, masked false, focus inside false. Its must-fail (every field 1 px right): PASS, `20e81d1fd9b67062`. Gate total 48 of 49 graded.
- What differs, opened at 1x and 4x: 478 of 348,312 px (5,128 before the grab fix), all in y 16 to 36. 466 px are the "Customize" heading (x 0 to 70), 12 px are the right arc of the Reset all pill (x 1257 to 1260). The focus ring and the bottom fade are gone; the fields and values match (Dither, Bayer 4x4 (ordered), Cell size 3.0, Tone levels 2, Threshold bias 50%). The heading reads as the same word in the same place, but the diff marks the edge pixels of every glyph in it, so it rasterizes differently; no other label moves. The h4 and section markup are the same on main (style-panel-scaffold.tsx:3459) and here (:3620). Not checked: whether the cause is a text style the host passes down or a sub-pixel offset of the header row (box y 226.19 here, 223.38 on main). Row left red, no bar edited.
