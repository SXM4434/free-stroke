DONE

1. Plan committed: `59c892139`.
2. Dither angle now renders its slider inside `Field` for every Dither type, so `KeySpot` can place its diamond like the neighbouring numeric controls. Committed: `4a3ed5244`.
3. Verification and this log: `HEAD` (the final log commit).

Gates
- `node_modules/.bin/tsc --noEmit -p .`: 6 of 6 expected errors remain, none in the edited component. The errors are one missing `perfect-freehand` module and five `MaskSolidDiagnostics` properties.
- `node scripts/verify/assert-key-paths.mjs`: 7 of 7 rows pass; 8 of 8 mutants caught. Its slider row finds 41 of 41 paths, including `ditherAngle`. It does not count rendered diamonds.
- `node scripts/verify/assert-keyed-ranges.mjs`: 3 of 3 rows pass; 10 of 10 mutants caught.
- `git diff --check`: pass.

Cleanup: `.next` removed. `git checkout -q -- docs/verification` could not resolve that path in this sparse checkout; the directory is absent and `git status --short` shows no verification changes.

Browser check not run, as this job forbids a browser. `assert-key-buttons.mjs` B1 should read: `PASS  B1   enabled key buttons = keyable paths less KEY_DISABLED  :  33/33 enabled (of 41 keyable, 8 disabled, 8 shown disabled with a reason); missing none; extra none; twice none; disabled without cause none; no reason none; wrong family none`. This is an expected row, not a measured result. No Node gate lists keyable controls against rendered diamonds, so no gate row or mutant was added. The browser gate's existing `dropfield` mutant checks that a missing `Field` button turns B1 red.

Model: gpt-6.1-sol, low effort.
