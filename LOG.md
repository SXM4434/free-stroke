MERGE-READY

# Animation asks, third pass, cloud log, 2026-10-02

Branch `claude/trace-animation-asks-j2uyvo`, cut from `integrate/cloud-1001` at `2cc9e98`. The brief said to push to `cloud/<name>`; this session can only push to its assigned branch, so that is where the work is. One file changed, `docs/research-2026-09-26/animation-asks-coverage.md`. No product code. Nothing under `docs/thinking` or `docs/verification`.

## Step 1 · 1360a33 · the 10 unknown rows not traced to `/`

Traced from the control down (Animation tab, draw-in controls, dock and workspaces, `lib/export/`). A grep hit in a comment or dead code was not counted as PRESENT.

| row | ask | grade |
|---|---|---|
| 22 | Restart behaviour | PARTIAL |
| 37 | Order that follows how a hand writes | PARTIAL |
| 38 | The pen lifts between strokes | PRESENT (Clock: Hand, `stampPenClock` on `/`, holds on every lift) |
| 43 | A taper-aware reveal | PARTIAL |
| 105 | Works in 2D and 3D | PARTIAL |
| 106 | The 2D draw-in matches the 3D one | PARTIAL |
| 108 | Real key poses for the hero beat | MISSING |
| 118 | Type a word and it draws itself | PARTIAL |
| 121 | The per-unit cascade and its 16 cap | PARTIAL |
| 123 | Leading edge split into thickness and opacity | PARTIAL |

Counts line: 54/27/25/0/18 became **55 PRESENT, 35 PARTIAL, 26 MISSING, 0 CUT BY HIM, 8 UNKNOWN** (124). Checked by tallying the grade column. Appended "## Third pass, 2026-10-02", which also lists rows outside the ten that this branch has probably moved (4, 6, 8, 12, 36, 39, 56, 59, 60, 61). Those rows were left as they were, as asked.

## Step 2 · fd110e2 · the build list

"## Build list": 61 lines, one per MISSING or PARTIAL row in the whole file (checked: 26 + 35). Each gives what building it takes, the files, and the overlapping branch. The overlap is by branch name only, because the codex/* branches are not visible from this session: codex/export, codex/drawin, codex/schedule, codex/perstroke and codex/fusion are marked TAKEN.

## Checks

| check | result |
|---|---|
| tsc | 6 errors, the baseline (snapshot 6, after step 2 6) |
| counts line against grade column | 55 / 35 / 26 / 8, sums to 124 |
| build list lines against MISSING + PARTIAL rows | 61 / 61 |
| em dashes added | 0 |
| new gate rows | none, so no must-fail to show |

## Not run

- Browser gates (`scripts/verify`, headless Chromium against a dev server). No product code and no gate changed, so a run would only re-measure the snapshot. Not attempted.
- Every PRESENT is source level. Nothing in the ten rows was watched on screen.
- The codex/* branches were not read, so TAKEN is a guess from each branch's name.
- Rows 108 and 118 rest partly on greps by name.
