MERGE-READY

# CLOUD-HERO-REAL cloud log, 2026-10-02

Branch `cloud/hero-real`, cut from the snapshot 2cc9e98. Nothing under `docs/thinking` or `docs/verification` is created or committed. `lib/hero-motion.ts` and `lib/flip-pose.ts` are unchanged.

MERGE-READY here means: both defects in the brief are resolved, and no check is worse than at 2cc9e98. Four red rows in the listed checks were already red at 2cc9e98. They are byte-identical after this branch and outside the brief (see the end of this log).

## Commits

- 8fab4a2 · capture: RETURN.mode is "identical", as the model says (fix 2)
- e0bd5a7 · LOG.md
- 8402d81 · LOG.md: correction
- c54e970 · assert-hero-return: the return's ink swap is measured at the sliver, either side (fix 1)
- this commit · LOG.md, final

## Fix 2 · the paste's RETURN.mode · DONE

`scripts/capture/motion.mjs:153` pasted `RETURN = { mode: "changed", ... }` but the model ships `ret: { mode: "identical", breakK: 0.35 }` (`lib/hero-motion.ts:1707`). That one line is now "identical". The only other reads of `RETURN.mode` in the capture script compare it to "prior", so no capture behaviour changes.

The known-bad rows still fail, each on its own planted key only:
- `drift`: 1 disagreement, BEATS.emerge paste 0.9501 vs source 0.9167. Before the fix it also listed RETURN.mode.
- `deleted`: missing SHADOW_LAG_SEC, unresolved 0, disagree 0. Before the fix it was disagree 1, which is why it was red.
- `new key`: unresolved LETTER_PAIR_FROM_XYZ.
- `precision`: MOVE_ACCEL_FRAC 0.1905 to 0.1906, 1 disagreement. Before the fix it was 2.
- The `agree` row can fail on the real file: the unfixed file was that input, and it failed on RETURN.mode.

## Fix 1 · the return's ink swap · DONE, by ruling the row, not the model

The user handed this ruling to the lane ("these don't need me"). The ruling: F118 stands, the model is right, the row was wrong.

Measured on `DEFAULT_HERO_MOTION` at 30 fps (sx at the original's 409 px):

| frame | way in (sampleEmerge) | return (sampleReturn) |
|---|---|---|
| f12 | drawing, 106 px | solid, 106 px |
| f13 | solid sliver, 14 px | solid sliver, 14 px |
| f14 | solid sliver, 14 px | solid sliver, 14 px |
| f15 | solid, 37 px | drawing, 37 px |

Both turns swap across the sliver's own boundary, in mirror image. The way in swaps on entering the sliver, out of a 106 px frame. The return swaps on leaving it, into a 37 px frame, so it is the better hidden of the two.

Why the swap cannot move into the dwell: F118 (`lib/hero-motion.ts:2874`, ruled 2026-09-25) makes the return's dwell the solid. A drawing at the edge is either the pen carve on a 0.5-deep sliver (`penCarve = amount x flat`), which is the white ghost outline, or a 0.004-deep card side-on, which is a blank frame. Both were seen and rejected. It also could not be done under the brief's rules:
- with `lib/hero-motion.ts` alone, `assert-flip-pose` ID-LIVE goes red (tried; 7/8);
- with `lib/flip-pose.ts` as well, ID-FLIP goes red, because it holds the turn to a frozen copy with `flat: 0` in the dwell (tried; 7/8).

What was wrong with the row: it accepted the first dwell frame plus or minus one. That read the mirror as a defect, and it was blind the other way. With the flip moved one frame early (`u >= 0.45`) the old row PASSED a swap from 218 px to 106 px, before the edge, in plain view.

The row now needs the swap on the first dwell frame or on the frame after the last. Its name, its controls and every other row are unchanged.

Must-fails, through `GATE_MUTATE_FILE` with no source edit:

| mutant on lib/hero-motion.ts | new row | old row |
|---|---|---|
| none (shipped): f14 14 px to f15 37 px | PASS | FAIL |
| late, `past = u >= 0.53`: f15 37 px to f16 166 px | FAIL | FAIL |
| early, `past = u >= 0.45`: f11 218 px to f12 106 px | FAIL | PASS (blind) |
| dwell ink 1 (the brief's literal ask): f12 106 px to f13 14 px | PASS | PASS |
| ret.mode "prior" control | FAIL | FAIL |

The detector also tests itself on every run. It moves the ink frame by frame from f10 to f18 on the shipped rows, and the predicate says yes on f13 and f15 only.

## Checks (Node; before = 2cc9e98, after = c54e970)

| check | before | after |
|---|---|---|
| assert-hero-return | 10/13, NOT SOUND | 11/13, NOT SOUND (the ink row is green; both detector self-tests hold) |
| assert-motion-paste | 4/7, FAILED | 7/7, all four known-bads fire on their own key |
| assert-hero-turn | 7/8, control 8/8 fail, NOT SOUND | byte-identical |
| assert-hero-hold | 7/8, NOT SOUND | byte-identical |
| assert-hero-options | 40/41 rows, 20/21 controls, NOT SOUND | byte-identical |
| assert-flip-pose | 8/8 rows, 10/10 mutants caught | byte-identical |
| assert-letters | does not run in Node: it launches Chrome (`/opt/google/chrome/chrome` not found) | same |
| tsc --noEmit | 6 errors (baseline) | 6 errors |

## Red at 2cc9e98, unchanged, outside this brief

- assert-hero-return: "the depth DEPARTS after the edge" wants depth > 0.99 on every frame before the edge. F118 thins the solid on the turn-out by `solidDepthAt`, so the row predates F118. The identical control flags it as blind for the same reason. "comes back CHANGED" is red because ret.mode ships "identical"; its KILL entry already expects the identical arm to kill it.
- assert-hero-turn: "the sliver is REAL THICKNESS" wants depth > 0.99 at the edge, where `SOLID_EDGE_DEPTH` is 0.5.
- assert-hero-hold: "the junctions resolve in K7, NOT here".
- assert-hero-options: "solid first opens on the object and ends on the drawing".

The first three look like rows written before F118 and before "identical". Each needs the same treatment fix 1 got: a measurement, then a ruling on the row or on the model.
