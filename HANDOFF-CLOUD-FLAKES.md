# CLOUD-FLAKES handoff

Branch `claude/free-stroke-timing-determinism-k14hyw`, on `cloud/integrate-1001` (2cc9e98). Full record with every number: `LOG.md` (first line MERGE-READY).

## Done
- dc2a0fa: assert-drawin-timing reads the reveal on a driven clock. Mid-pass and coverage control: 10 of 10 identical (0.400000; 0.286% vs 0.286%). Before: coverage control red 2 of 10.
- 08e8b50: assert-perform drives the Perform stage's clock. 10 of 10 byte-identical runs. Before: 6 verdict strings in 10 runs, D's slot 26.8 to 49.8 s for a 2 s plan.
- 9bf2857: product fix, Inflate holds the tip still through a performed pause (ramp per side of the hold disc; a pause no other stroke overlaps freezes the whole tip). New row 1c (same pixels across the dwell). Must-fail `FS_GATE_MUTATE=tip-no-pausestill` turns 1b and 1c Inflate red.
- 7e2dc06: row 1b's left-out cap 5% to 3.5% (tighter), so Extrude's 4 px must-fail fires.

## Gates
- assert-perform: 16 PASS, 1 FAIL in each of 10 runs. The FAIL is row 8 throwing on the dockview layout (red before this work too).
- assert-drawin-timing: 25 of 26 in each of 10 runs. The FAIL is "no console or page errors", the analytics script blocked by this sandbox's proxy.
- Must-fails shown firing: 600 ms stall (old draw-in gate red, new green), stage clock 5% fast (perform 1a, 1b, 5 red), tip-no-pausestill, each row's paired arm in every run.
- tsc: 6 errors, the baseline.

## Left
- assert-perform row 8 on the dockview layout (Perform lives in the hidden dock).
- assert-drawin-timing C's delay control still sleeps on wall time (green, but its number moves).
- Inflate's disc path when another stroke inks during a pause: pixels out to 1.2x to 1.35x the hold radius can still move; no gate row covers it.
- Comparing against main: `origin/main` shares no history with this branch.
