# HAND-DRAW-P3 cloud log, 2026-09-30

Branch `cloud/hand-p3` (the snapshot of main at 4bba17b). Two steps, one commit each, both pushed. Nothing under `docs/thinking` or `docs/verification` is committed; the gates wrote there and it is left untracked.

## Step 1 · 4d76046 · phase 2 back on today's main

`git merge-file <path> base/<path> lane/<path>` on the four files. `lib/stroke-timing.ts` and `scripts/verify/assert-hand-clock.mjs` merged clean. Two conflicts, both kept:
- `components/draw-in-timing-controls.tsx`, the import line: main's `curveOfEase, curveProblem` (Custom curve ease) with phase 2 dropping `takeHasPerformed` (the held clock controls are gone).
- `app/page.tsx`, `handleRevealEnvelopeChange`: phase 2's `rebaseForClock`, so a clock or rate change and the rebase of performed rows are one `edit()`, one undo step, with main's `gesture ?? null` key. `clockUnderTake` and its toast are gone: Hand no longer yields to a performed take. Main's flip wiring (`flip`, `patchFlip`) is untouched.
- Checked: base to main and lane to merged give the same diff on every file.
- `docs/cloud-inbox` removed with `git rm -r`.

## Step 2 · 802ccdb · R11, Inflate's holds, the export row

(a) R11, "Turn in the lifts". Under Hand a slot runs to the next stroke's landing (F120), so the logo's slots touch end to end ([0,520] [520,950] ...) and each lift sits in a slot's tail; only one gap existed (67 ms). The word space is 1792.8 to 1967.2 ms, 174.4 ms.
- `paceFromCurve` returns its flats as `TimingPace.holds`. `takeLiftsMs(ts, pace, baseSlots, baseMs)` turns them into take-time lifts: each stroke inks over its slot less the holds in its base slot, carried through the row (delay, speed, ease inverse); a performed stroke inks its whole slot; lifts are the gaps in the union. Under rows it reads `ts.baseSlots`.
- The strip publishes them on `ctx.liftsRef`; the picker passes them as `CameraTake.lifts`; `orbit-lifts` reads them when given and the slot gaps otherwise.
- Live, logo under Hand: the move is offered and turns at 1792.8 to 1967.2 ms, 0.000 ms off the stamped lift.

(b) Inflate's shader holds. Measured with `scripts/verify/measure-hand-tip-creep.mjs` (Inflate, Hand, the 10 lifts of 50 ms or more, 5 frames per lift, control = the same span inside the stroke before):
- No rows: 0 px change in all 10 lifts. The tip reads the beat, which the pace holds flat.
- A timed take (+1 ms on the last stroke): 5, 28, 28, 27, 5, 26, 19, 52, 61, 18 px. It creeps: the tip reads the take's clock, which runs on through a lift, and the stroke end's nose fills in.
- Fed as point holds at the pen-up and pen-down points (uFsTipHold): worst 13 px, single pixels where strokes cross (the LINEAR filter blends two arrivals).
- A lift has no ink anywhere (that is how `takeLiftsMs` finds it), so the frame loop now holds the whole tip at the lift's start under a timed take (`entry.lifts`, published on `__heroPenTip.lifts`). Result: 0 px in all 10, controls 57 to 317 px. uFsTipHold still carries performed stops only; this is the hold with no radius, not the uniform. Say if you want it moved into the uniform instead.

(c) The export row, R12 in `assert-hand-clock`: `exportAnimation` over `getTotalDuration()` (what the page's own export passes) against live at 8 plan clocks. No rows: 8/8, film 4666.7 ms = take. Last stroke at 0.5x: 8/8, film 5024.9 ms = take (pen 4666.7).

Also in this commit: `assert-stroke-timing`'s two ripple mutants looked for `(t.ripple ? carry : 0)`, which phase 2 moved into `placeSlots` as `(ripple ? carry : 0)`; the mutants now find it (same sabotage, same rows).

## Checks

tsc: 6 errors, the baseline (snapshot 6, after step 1 6, after step 2 6).

Node gates, lane against the snapshot's own run:

| gate | lane | snapshot |
|---|---|---|
| assert-keyframes | 16/16 rows, 21/21 mutants | 16/16, 21/21 |
| assert-key-paths | 6/7, 8/8 (EXISTING red) | 6/7, 8/8 (EXISTING red) |
| assert-camera-moves | 11/11, 20/20 (new IN-LIFTS, 3 new mutants) | 10/10, 17/17 |
| assert-stroke-timing, `STROKE_TIMING_BASE=4bba17b` | 16/16, 12/12 | 16/16, 12/12 |

Browser gates, headless, one browser at a time, lane on :3138 and the snapshot on :3140 from a worktree of 4bba17b:

| gate | lane | snapshot |
|---|---|---|
| assert-hand-clock | 13/13 rows, 13/13 must-fails fired, 0 page errors | 10/10, 10/10 |
| assert-perform, run 1 / run 2 | 11/15, then 10/15 | 13/14 + 1 SELF, then 10/14 + 1 SELF |
| assert-key-lanes (row 11 base re-pinned, see below) | 15/15 graded, row 11 BLIND | 15/15 graded, row 11 SELF |
| assert-stroke-strip | 17/18 | 17/18 |
| assert-take-timeline | 20/21 | 20/21 |

hand-clock must-fails: R11 has two (`lifts-slot-gaps`, `clock-uniform`), counted fired only when both turn it red; both refused the move. R12 `exportpen`: 1/8 clocks, film 4666.7 against take 5024.9. R13 `tip-no-liftholds`: 8 to 40 px per lift. Phase 2's R11 compared `__fsTake.get().slots` (empty with no rows) and called the move itself; it now reads what the picker writes, through the real Camera button. R11 also clears the move's keys after, since R12 and R13 read frames in the lifts it turns in.

Reds read as follows:
- key-paths EXISTING and stroke-timing's own base need 747af8fa0 and b0da66626, which the squashed snapshot does not have. stroke-timing ran with its own `STROKE_TIMING_BASE` knob pointed at the snapshot.
- perform: 1b inflate, extrude, solid and row 2 are red on the snapshot's second run too, so they swing run to run on this machine (4 cores, SwiftShader). Rod 1b passed 2 of 2 on the snapshot and 1 of 2 on the lane (held 1338.2 ms for a 1377.7 ms dwell). Nothing in this change touches Rod's playback, but I could not prove it here; worth one run on the Mac.
- key-lanes row 11: my recorded base came from a docked canvas (755x533) and the full run is undocked (755x890), so the row is BLIND. Its intent holds: the lane's five no-key frame hashes equal the snapshot's, 5 of 5.
- stroke-strip row 0: same cause, the base recorded with `--phase=base` is docked; 18/18 differ on both trees.
- take-timeline E2: 36.0 rAF ticks/s on the lane and 35.9 and 27.4 on the snapshot, against a bar of 50. Headless on a loaded box.

## What I could not run, and how the environment was bent

- `pnpm install --frozen-lockfile` refuses: `pnpm-lock.yaml` lacks `dialkit` and `motion`, which `package.json` lists. Installed with `--no-frozen-lockfile --config.node-linker=hoisted` (the gates import `jiti` directly, which pnpm's default layout does not hoist), then restored the lockfile. Not committed.
- `npx playwright install` was not needed: Chromium 141 is preinstalled. `scripts/verify/lib/browser.mjs` pins channel `chrome`, so `/opt/google/chrome/chrome` was symlinked to it. Outside the repo.
- `lsof` in this container cannot map sockets or cwd to pids, so `serverCommit` saw no server. A PATH-only shim answered its two queries from /proc; dev servers were bound to 127.0.0.1. Outside the repo.
- Bases the snapshot does not carry were recorded from the snapshot server itself, into both trees' `docs/verification` (uncommitted): perform `base-main.json` (`--phase=base --base=4bba17b`), stroke-strip `base-3a211a36d.json` (`--phase=base`), key-lanes `nokeys-base.json` through an uncommitted copy of the gate with `KEYS_BASE` set to 4bba17b (the real one refuses any commit but ea31c5b38). So those rows compare to today's main, not to their named commits.
- Not run: the rest of the plan's PEN rows beyond what these gates carry, `assert-stroke-timing-browser`, `assert-motion-customize`, `assert-custom-presets`, and any look at the result by eye. No Mac numbers were compared.

## Next

- Watch Hand Draw on your own drawing with one row set on the strip, on Inflate: the lifts should now hold as still as with no rows.
- One perform run on the Mac to clear Rod 1b.
- RUN-QUEUE row for HAND-DRAW-P3 is not written; this log is the record.
