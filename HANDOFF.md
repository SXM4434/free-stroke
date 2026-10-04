# Handoff, claude/animation-asks-coverage-w39i78

**Done.** `docs/research-2026-09-26/animation-asks-coverage.md` is `claude/trace-animation-asks-j2uyvo`'s finished third pass and build list, with 4 lines fixed. Row 106 now names `scripts/verify/assert-drawin-2d-parity.mjs` as the 2D against 3D check. Row 105 counts five script callers of `makeFlatRenderer`, not two. Counts: 55 PRESENT, 35 PARTIAL, 26 MISSING, 0 CUT BY HIM, 8 UNKNOWN. Full record in `LOG.md`.

**Left.**
- Merge this branch, or j2uyvo plus the 4-line fix. Not both.
- Line numbers in the older PRESENT rows (for example 1, 11, 20, 21) still point at main `95f724f87` and have moved.
- `assert-drawin-2d-parity.mjs` was not run.

**Gates.** tsc: 6 errors, the baseline. No gate rows added. No browser gates or node gates run: the diff is docs only.
