MERGE-READY

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
