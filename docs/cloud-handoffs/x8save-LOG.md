# CL-X8SAVE

Branch claude/x8save, from 32368f23c. Clone ~/.fs-lanes/cl-docs. Server: next dev -p 3146 from this clone, pid below.

## Plan

1. X12, the bad save replaced. After loadLayout's catch opens the default, a flag makes the next
   `save()` write even though the layout equals what was loaded, and `saveSoon()` is queued. The
   write goes through `save()` and `writeSaved`, the shell's guarded path (lg only, not while
   maximized, not under Today, storage errors said out loud). The default is written once, after the
   load's fit, so the note shows once. New mutant arm `keepBad`: the catch does not set the flag.
   Gate: X12 waits 900 ms after the first reload, reloads, and asserts 0 notes and 6 panels. A new
   must-fail row runs `keepBad` and fires when the second reload shows the note again. `nocatch`
   stays.
2. X8 split. The preview-inside check runs after 1512x982 shrinks to 1100x620 while maximized (above
   1024 px, maximize holds). The 1512x982 to 760x430 shrink asserts maximize ended (current null) and
   six panels. `previewLoose` must still fire on the preview cases.
3. assert-maximize whole (was 24 of 25, one more must-fail row expected: 26), assert-rearrange (21 of
   21), tsc at 6.

## Results

Server pid 90879 (next dev, nohup), listener child 90898 on :3146, cwd this clone. Before each gate
run the served chunk `components_5b1a168a._.js` held `keepBad` (only this edit has it) and the
listener's cwd was this clone; both runs went ahead.

- Product line: components/dock-shell.tsx:947 sets `replaceBadRef` in loadLayout's catch (skipped
  under `keepBad`), :952 queues `saveSoon()`, :739-740 let `save()` write once though the layout equals
  what was loaded.
- X12 clean PASS: layoutProblem passes the save, the reload showed the toast "...Dockview could not
  load it (dockview: group id must be of type string)..." with 6 panels, the save was replaced, the
  next reload 6 panels and 0 notes.
- X12 must-fail `keepBad` FIRED: the save still the bad one, the next reload 6 panels and 1 note.
- X12 must-fail `nocatch` FIRED: the harness never came. Its detail says "the save gone", which is
  wrong wording: the page never came up, so storage was not read. Left as measured.
- X8 clean PASS: 1512x982, 1512x982 shrunk to 1100x620 while maximized, 1280x720, 900x700 all inside;
  760x430: maximize ended, 6 panels.
- X8 must-fail `previewLoose` FIRED, on 900x700 only (panel and canvas 528,472..888,752). 1512x982,
  1100x620 and 1280x720 held under the mutant.
- assert-maximize: 26 of 26 (13 PASS, 13 FIRED), exit 0. Was 24 of 25; the new row is X12's keepBad.
- assert-rearrange: 21 of 21, exit 0.
- tsc: 6, the baseline (lib/dd-engine/handFeel.ts 1, lib/geometry-engines.ts 5), both routes 200.
