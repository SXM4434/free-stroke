NOT MERGE-READY

# CLOUD-HERO-REAL cloud log, 2026-10-02

Branch `cloud/hero-real`, cut from the snapshot 2cc9e98. Nothing under `docs/thinking` or `docs/verification` is created or committed.

## Commits

- 8fab4a2 · capture: RETURN.mode is "identical", as the model says (fix 2, pushed)
- this commit · LOG.md

Fix 1 is NOT committed. See below.

## Fix 2 · the paste's RETURN.mode · DONE

`scripts/capture/motion.mjs:153` pasted `RETURN = { mode: "changed", ... }` but the model ships `ret: { mode: "identical", breakK: 0.35 }` (`lib/hero-motion.ts:1707`). That one line is now "identical". The only other reads of `RETURN.mode` in the capture script compare it to "prior", so no capture behaviour changes.

The known-bad rows still fail, each on its own planted key only:
- `drift`: 1 disagreement, BEATS.emerge paste 0.9501 vs source 0.9167. Before the fix it also listed the RETURN.mode disagreement.
- `deleted`: missing SHADOW_LAG_SEC, unresolved 0, disagree 0. Before the fix it was disagree 1, which is why it was red.
- `new key`: unresolved LETTER_PAIR_FROM_XYZ.
- `precision`: MOVE_ACCEL_FRAC 0.1905 to 0.1906, 1 disagreement. Before the fix it was 2.
- The `agree` row can fail on the real file: the unfixed file was that input, and it failed on RETURN.mode.

## Fix 1 · the return's ink flip · NOT DONE, needs a decision

The defect is real. `assert-hero-return` says "ink returns to flat at frame 15, edge-on at frame 13": the return's dwell (`lib/hero-motion.ts:2881`) holds the solid at flat 0, and the ink flips only at `past = u >= 0.5` (`:2903`), on the first frame after the dwell.

It cannot land with every listed check green, for two reasons:

1. **It is a ruling.** The F118 comment at `lib/hero-motion.ts:2874` says the return's dwell is the solid with no carve and no breaks, because "a sliver under the pen carve is the white ghost outline", and that "the drawing now lands one dwell (2 frames) after the edge instead of on it. Ruled by the controller: ghosts are the worse defect." `penCarve = amount x flat`, so flat 1 in the dwell puts the carve back on the 0.5-deep sliver. The comment on `SOLID_EDGE_DEPTH` in `lib/flip-pose.ts:219` gives the same reason.
2. **The shared law has the same late flip.** `flipPoseAt` in `lib/flip-pose.ts:314` returns ink 0 in the return's dwell. `assert-flip-pose` ID-LIVE holds it exactly equal to the lab's `sampleReturn`. Under the brief, flip-pose.ts must not change.

Trial, not committed (dwell `flat: 1`, `jointBreak: opened`, everything else kept): the ink row in `assert-hero-return` turns green (11/13). `assert-flip-pose` drops to 7/8 with ID-LIVE red: the lab and `/` disagree in the dwell. In the browser this also risks the ghost.

The question went to the user and came back undecided, so the return is left as ruled. To land fix 1, someone has to lift either the F118 ruling or the flip-pose.ts rule. Then the change is that one dwell edit in `sampleReturn`, plus the same edit in `flipPoseAt` so ID-LIVE stays exact.

## Checks (Node; before = 2cc9e98, after = this branch)

| check | before | after |
|---|---|---|
| assert-hero-return | 10/13, NOT SOUND (identical control: 2 rows wrongly red) | 10/13, unchanged (output byte-identical) |
| assert-motion-paste | 4/7, FAILED (agree, kb-drift, kb-deleted, kb-precision) | 7/7, all four known-bads fire on their own key |
| assert-hero-turn | 7/8, control 8/8 fail, NOT SOUND | unchanged (byte-identical) |
| assert-hero-hold | 7/8, NOT SOUND | unchanged (byte-identical) |
| assert-hero-options | 40/41 rows, 20/21 controls, NOT SOUND | unchanged (byte-identical) |
| assert-flip-pose | 8/8 rows, 10/10 mutants caught | 8/8 rows, 10/10 mutants caught |
| assert-letters | does not run in Node: it launches Chrome (`/opt/google/chrome/chrome` not found) | same |
| tsc --noEmit | 6 errors (baseline) | 6 errors |

The reds that were there before and are still there in hero-return, hero-turn, hero-hold and hero-options are outside this brief, and none of them comes from either fix:
- hero-return: "depth DEPARTS after the edge" and "comes back CHANGED", as well as the ink row.
- hero-turn: "sliver is REAL THICKNESS" (depth 0.502 at the edge against > 0.99). This follows from the SOLID_EDGE_DEPTH ruling.
- hero-hold: "junctions resolve in K7".
- hero-options: "solid first opens on the object and ends on the drawing".

Several of these look like stale rows written before the F118 depth law and before ret.mode "identical". They need their own ruling.
