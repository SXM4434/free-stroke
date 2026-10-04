# Handoff · CLOUD-TRIAGE stale red gates · 2026-10-04

Branch `claude/free-stroke-stale-gates-rx4sse`. NOT MERGE-READY. Full detail is in `LOG.md`.

## Done
- b3b497f `assert-drawin-pentip`: the guard now reads the hybrid blend from `TRANSPORT_DEFAULTS`. It used to grep for `useState(0.4)`, which the dock layout moved. Both must-fails fire.
- cbbe0f7 `assert-harness-surface`: retired the stale `__revealHarness.schedule` exemption. 15/16.
- 0ec81e8, 1bab1d0 `assert-stub-filter`: the filter rows run on the parked old trace. A new `shipped-clean` row has its must-fail firing. 19/19.
- 6830b63 `LOG.md`: every listed gate classified, and the open questions decided.

## Gates
- **Pass:**
  - tsc at the baseline of 6
  - keyframes 16/16
  - width-keys 12/12
  - camera-moves 11/11
  - flip-pose 8/8
  - stub-filter 19/19
  - closed-loops offline row E, plus its selftest 14/14
- **Red, from the clone, not code:** key-paths 6/7 and stroke-timing 0/1. Each diffs against a pinned commit that this one-commit snapshot lacks.
- **Red, real:**
  - nib-contrast 30/31: the "e" of Desk has no eye in Inflate. The fix goes in `trace-logo.mjs`.
  - harness-surface B: K2's viewport side is on `cloud/layout-l3`, not merged yet.
- **Need captures or a film:** drawin-pentip, screen-layers, the eye-* gates.
- **citations:** red on environment only (no sibling repo, `docs/verification` stripped).

## Left
- A browser lane to:
  - rewrite the hero-k7-intact live-beat row (the live beat cuts 0 px at K7) and the pen-field-alloc speck test (carved against un-carved, ink cut below the grid);
  - re-derive hero-k7-news (two gaps per crossing break);
  - confirm hero-transition;
  - film for the eye-* gates.
- Add `sharp` to `package.json` in a lane that can change the lockfile.
- Merge `cloud/layout-l3` (K2).
