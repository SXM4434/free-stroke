MERGE-READY

# CLOUD-REVIEW cloud log, 2026-10-02

Branch `cloud/review`, from `cloud/integrate-1001` (2cc9e98). Read-only for product code: the branch adds `REVIEW.md` and replaces this `LOG.md` (the previous HAND-DRAW-P3 log is in 2cc9e98). Nothing under `docs/thinking` or `docs/verification` is committed.

## How the job reached this session

The prompt arrived with both review bodies missing: only the header, an empty "SECOND REVIEW:" and RULES. The owner said to ask the local session. Its transcript shows the prompt was assembled with `sed '1d'` from two one-line Codex files (`cx-review-layout.txt`, `cx-review-hand-carve.txt`), which deletes each whole review. The review text was recovered verbatim from those heredocs in that transcript and used as written. Worth fixing in the assembly script for the other jobs built the same way.

## Steps

1. **87c8904**: `REVIEW.md`, two independent reviews, most severe first. Review 1 (layout and keyed style): 11 findings. Review 2 (Hand Draw phase 3 and carve): 8 findings. Each review ran in its own agent with no view of the other. I re-read the top findings in the code myself (review 1: 1, 2, 3; review 2: 2, 7) and they hold.
2. This commit: `LOG.md`.

## Checks (all on this unchanged branch; no product file changed, so lane and snapshot are the same tree)

| check | result |
|---|---|
| `pnpm install --frozen-lockfile` | ok, 8.5 s |
| tsc | 6 errors, the baseline (5 `lib/geometry-engines.ts`, 1 `lib/dd-engine/handFeel.ts`) |
| assert-keyframes | 16/16 rows, 21/21 mutants |
| assert-key-paths | 6/7 rows, 8/8 mutants; EXISTING red, the known snapshot gap (needs 747af8fa0 and b0da66626, not in the squash) |
| assert-width-keys | 12/12 rows, 9/9 mutants (runs over 5 minutes here) |
| assert-camera-moves | 11/11 rows, 20/20 mutants |
| assert-flip-pose | 8/8 rows, 10/10 mutants |
| assert-stroke-timing | default base b0da66626 is missing from the snapshot (0/1, RUN red); with `STROKE_TIMING_BASE=HEAD`, 16/16 rows, 12/12 mutants |

No new gate rows, so no new must-fails. No bar was touched.

## What I could not run

- Browser gates: not run. The branch changes no product code, so there is nothing to compare against its own base; every review finding is traced or proved in Node, none confirmed in a browser.
- The lane diffs the reviews were meant to read (`git log 2a16950c7..HEAD`, `--grep HAND-DRAW-P3`, `--grep CARVE-AA`) are not in the squashed snapshot; the reviews read the current files instead.

## Questions for the owner

1. Review 1 finding 3: the dock is built `locked` with `disableDnd`, so no panel can be dragged or resized, only shown or hidden. Your ruling keeps the new layout only while every panel can always be rearranged. Fix this first, or is show/hide on the rail enough for now?
2. Review 2 finding 7: the carve AA change also sharpens diagonal carved edges in head-on frames (about 1.41 px ramp to 1 px), not only at grazing angles. Keep it, or limit the new divisor to grazing angles?
3. Review 1 findings 1 and 2: style keys show only in the panel, not in the 3D view or export, and are dropped on reload. "Keyframe anything" is not live yet. Should that be its own lane?
