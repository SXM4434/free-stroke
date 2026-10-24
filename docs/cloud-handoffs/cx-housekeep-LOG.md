NOT DONE

1. Plan committed: d6a6e7b67 (`docs: plan CX-HOUSEKEEP gate maintenance`).
2. Probe routed through `scripts/verify/lib/browser.mjs`; committed: a76a7b306 (`fix: route layout probe through browser helper`). Row A passed in `assert-one-browser.mjs --static`.
3. K inventory update not completed. `--recite` moved citations for 34 existing entries but refused the gone `assert-take-timeline.mjs` control, as its header requires. The manifest has 113 entries; K discovers 171 gates and reports 58 missing entries. Its calibration rejects a deliberately partial inventory, as required, but real-inventory acceptance fails. The header requires human rulings and live code citations per gate; `--recite` does not record missing entries. No gate bar or manifest ruling was weakened or guessed.

Gate results
- `node scripts/verify/assert-one-browser.mjs --static`: row A PASS. Overall 30 PASS, 2 FAIL. B has unresolved launcher bindings at `_probe-solid-exposure.mjs:10`, `lib/dock-size.mjs:168`, `lib/dock.mjs:170`, and `lib/export-app.mjs:18`. G has stale allow entry `assert-hero-k7-intact.mjs`. No browser was used.
- `node scripts/verify/assert-gate-integrity.mjs --static`: static calibration 38/39; one calibration row fails because K's real manifest acceptance is blocked by 58 missing entries. The deliberate partial-inventory must-fail passes. K real manifest reconciliation: 0/1 acceptance rows; 58 missing entries.
- `node_modules/.bin/tsc --noEmit -p .`: 6 errors, unchanged target count.

No browser gates were run. No dev server was started. No edits were made to `docs/verification`.
