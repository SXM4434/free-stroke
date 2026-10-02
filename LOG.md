NOT MERGE-READY (duplicate: the controller says claude/trace-animation-asks-j2uyvo is the finished job; merge that one, not both)

# CLOUD-UNKNOWN log, 2026-10-02

Branch `claude/animation-asks-coverage-w39i78`, cut from `integrate/cloud-1001` (snapshot `2cc9e98`). The task asked for `cloud/<your-name>`; this session's harness names `claude/animation-asks-coverage-w39i78` as its one push branch, so the work is there and nowhere else. `cloud/unknown` did not exist on origin, so there was no earlier run to continue. Docs only: the one file changed is `docs/research-2026-09-26/animation-asks-coverage.md`, plus this log. Nothing under `docs/thinking` or `docs/verification`.

A separate session's branch, `claude/trace-animation-asks-j2uyvo`, did the same job on the same snapshot. It was not read or merged; this pass is independent.

## Step 1 · 2ce9a4d · the 10 rows traced to /

Rows 22, 37, 38, 43, 105, 106, 108, 118, 121, 123, each from the control that would show it.

- PRESENT: 22 (Play restarts at the end, Loop wraps), 38 (lifts hold under Natural, Hand times them; off under a reorder, overlap, Align end, Travel or Shrink by design), 105 and 106 (2D on `/` is Flat ink over the same reveal, so both play and match; needs his eye).
- PARTIAL: 37 (hand-ordered font, lab only), 43 (taper tip on Inflate, no control on `/`), 118 (typed word, lab only), 121 (16-letter cap real, `/` passes no letter map), 123 (thickness half only).
- MISSING: 108 (no key-pose table; grep by name).
- Counts line: 54 / 27 / 25 / 0 / 18 to **58 PRESENT, 32 PARTIAL, 26 MISSING, 0 CUT BY HIM, 8 UNKNOWN**. Re-tallied from the table's grade column: 58, 32, 26, 8, total 124.
- Appended "## Third pass, 2026-10-02", with corrections noticed in rows the task did not let this pass regrade: 8, 36 and 39 (`stampPenClock` now runs on `/` under Clock: Hand), 6 and 56 (a Flip row is on `/`), 4 and 5 (an Animate workspace exists).

## Step 2 · cc2d426 · the build list

"## Build list": 58 lines, one per MISSING or PARTIAL row in the whole file. 27 marked TAKEN by codex/export, codex/drawin, codex/schedule, codex/perstroke or codex/fusion, in full or in part; 31 open. None of the five codex branches is on origin, so the match is by branch name and area, not by their diffs. Also in this commit: the third-pass note on rows 4 and 5 corrected after reading `components/workspace/workspaces.ts`.

## Step 3 · this commit · LOG.md

## Checks

| check | count |
|---|---|
| tsc `--noEmit` | 6 errors at the snapshot, 6 after step 1, 6 after step 2: the baseline |
| grade tally against the counts line | 58 / 32 / 26 / 8 = 124, matches |
| build list lines against MISSING + PARTIAL rows | 58 = 58 |
| em dashes in the changed doc | 0 |
| new gate rows | 0, so no must-fail to show |

## Not run

- No browser. Nothing in this diff runs, so `scripts/verify` was not started, Playwright was not installed and no dev server was opened. Every PRESENT in the third pass is source level; 105 and 106 rest on the reveal not reading `flatten`, not on a look at the screen.
- The node gates were not run: the diff is one Markdown file.
- PLAN:1784 (row 22) could not be read; the pasted plan is not in the repo.

## Cross-check of claude/trace-animation-asks-j2uyvo, at the controller's request

Asked by the controller session to stop redoing the job, check the other branch's rows against the code, and log any disagreement. Fetched `origin/claude/trace-animation-asks-j2uyvo` (999326d). Its counts line is 55 PRESENT, 35 PARTIAL, 26 MISSING, 0, 8 UNKNOWN. It changed only the same ten rows.

**Spot-check of five PRESENT rows.** Its updates have only one PRESENT row, 38, so I checked all of 38's cites and four older PRESENT rows (1, 11, 20, 21) that both branches leave as they were.
- Row 38: every cite opens on what it claims. scaffold:3062 and :3079 render `DrawInTimingControls`, `app/page.tsx:790` is `clockStrokesFor`, `lib/pen-reveal.ts:1633` is `humanLiftsMs`, `lib/stroke-timing.ts:647` is `takeLiftsMs`, vp:5482 publishes `entry.lifts`, vp:7135 holds the tip on them, `lib/pen-reveal.ts:211-215` is the switch-off. Agree, PRESENT.
- Rows 1, 11, 20, 21: the code is still there, but every line number has moved since main `95f724f87`. Add-a-key is now `components/key-lanes.tsx:888` (cited :809-813), `sampleKeys` `lib/keyframes.ts:450` (:237), `easeReveal` `lib/stroke-timing.ts:269` (:255), "Ease over the whole draw" dtc:655 (:457), Delay dtc:528 (:366), Reverse dtc:755 and Loop dtc:768 (:523, :536). Neither branch claims to have refreshed these. Grades stand, cites are stale.

**Grades that disagree (3 of 10).** The other seven (37, 38, 43, 108, 118, 121, 123) match mine.
- Row 22: theirs PARTIAL ("no choice of restart behaviour, fixed in code"), mine PRESENT. Both describe the same code. Whether the ask means "pick a restart behaviour" or "restart works" depends on PLAN:1784's wording, which neither branch could read. Theirs is the stricter reading; I would take it.
- Row 105: theirs PARTIAL (no draw-in on 2D strokes themselves), mine PRESENT, needs his eye. Same facts again: 2D on `/` is Flat ink over the 3D mesh. Theirs is the stricter reading, and I would take it.
- Row 106: theirs PARTIAL, mine PRESENT, needs his eye. Theirs says nothing compares 2D with 3D, which is wrong: `scripts/verify/assert-drawin-2d-parity.mjs` does exactly that, running both registers through the shared clock and measuring the 2D raster's ink against it, with negative controls. Neither branch ran it. The grade is still a judgement call, but that sentence should come out.

**Where theirs is better than mine.**
- Row 37: it names the authored hand-order table, `LETTERS` in `scripts/capture/trace-logo.mjs:47`, which I missed (I cited the font's glyph order).
- Rows 105 and 106: my row says `makeFlatRenderer` has "no caller outside two comments in `lib/hero-motion.ts`". That is wrong. Five scripts in `scripts/verify/` call it (`assert-pen-field.mjs`, `assert-drawin-2d-parity.mjs`, `_probe-pen-vs-tube-hero.mjs`, `_probe-carve-preview.mjs`, `lib/nib-carve.mjs`). It has no caller in `app/`, `components/` or the product code in `lib/`. Theirs is closer (it names two of the scripts).

**Recommendation.** Merge `claude/trace-animation-asks-j2uyvo` and drop this branch's doc changes. Before merging, delete the sentence in its row 106 that says no check compares 2D with 3D. This branch's build list is an extra if that one lacks it; the two build lists were not compared.
