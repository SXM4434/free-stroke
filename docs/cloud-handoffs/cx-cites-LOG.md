DONE

Plan: Record the citation baseline, inspect each cited claim against existing verification files, change only comments, then run the citation gate and TypeScript check. Commit the plan and each edit step by path. No browser gate is needed for comment-only edits.

Baseline: assert-citations scanned 150 files and 1405 citations. stale=29, missing=26, uncheckable=36. Ratchet failed against the existing baseline (26, 17, 35).

Step 1, plan and baseline: bd9449c64f.

Step 2, comment repairs: a0f6cfc4f.

- `assert-hero-letters.mjs`, three mentions: no retained gate asserts the letter transforms or zero-count branch, so the comments now state that limit.
- `_probe-tipfield.mjs`: no retained probe records the 20.8 ms measurement, so the comment states that limit.
- `_probe-fusion-coverage.mjs`, three mentions: `scripts/verify/assert-fusion-rail.mjs` checks the eight texture, dither, and ASCII subsets and their shipped relationships.
- `_probe-fusion-animates.mjs`: `scripts/verify/assert-fusion-rail.mjs` measures movement of all 14 shipped relationships.
- `_probe-fusion-builtin-sleep.mjs`: `scripts/verify/assert-fusion-newborn.mjs` checks built-in links for sleep.
- `assert-pen-kinematics.mjs`: `verify-pen-kinematics.mjs` captures an A/B, but does not reprint the 93-component distribution, so the comment no longer claims a retained measurement script.
- `assert-preset-families.mjs`: `assert-preset-pixels.mjs` checks rendered preset changes, but does not report the claimed pairwise family matrix, so the comment names that gap.
- `lib/contentHash.ts`: no source file implements that cited normalization here, so the comment assigns it to the caller.
- `publish.ts`, two mentions: no publisher is in this checkout, so the comment no longer claims its parser was checked.

Step 3, verification and final log: this commit.

Citation gate before: 26 missing of 1405 citations, 29 stale, 36 uncheckable. Citation gate after: 15 missing of 1396 citations, 29 stale, 36 uncheckable. Missing fell by 11; neither other count rose. The gate's 16 of 17 checks pass. Its ratchet still fails because its recorded baseline is stale=26 and uncheckable=35. Those two counts were already above the baseline before this edit and did not change.

TypeScript: 6 errors of 6 expected. `git diff --check`: pass. No browser gate ran because the task changed comments only and expressly barred browser use. No server started; `.next` was absent. The citation check cannot establish that historical measurements remain reproducible, and TypeScript does not check comment truth.
