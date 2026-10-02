NOT MERGE-READY: every Node check is green and matches the unchanged snapshot, but the browser rows are written and not run (no browser in this lane), so no extra has been seen rendering in the dock layout.

# CLOUD-DRAWIN lane log, 2026-10-02 (cloud)

Branch `cloud/drawin`, cut from `2cc9e98` (the integration snapshot: main plus the dock layout, keyframe anything, Hand Draw phase 3, the carve fix). Coverage items 10 and 11 of `docs/research-2026-09-26/animation-asks-coverage.md`, rows 15, 19, 41, 42, 47. The rows' "his words" column reads "plan" or "doc". Row 47 says "No single switch for the whole take was found", so it does ask for authored vs recorded, and step 5 builds it.

This is a port, not a rebuild. Each step cherry-picks one commit of `claude/drawin-extras-animation-asks-yj9zyt` (the DRAWIN-EXTRAS lane, 2026-09-30, cut from the older `52982e8`), resolved onto this tree. On top of that, this lane moved the extras' math into lib/ so Node can gate it, fixed one bug the new gate found, and wrote a Node gate with must-fails. Nothing under docs/thinking or docs/verification is committed.

Each extra is off by default and changes nothing when off. Each one is a field on `RevealEnvelopeParams` (`lib/stroke-schedule.ts`), a real control in `components/draw-in-timing-controls.tsx` wrapped for Customize, listed in `MOTION_FIELD_KEYS`, and set to off in every draw-in preset through `DRAW_IN_EXTRAS_OFF` (`lib/style-system.ts`), so `presetFields` lists it under every draw-in preset. Each is read, range-checked and repaired out loud in `lib/doc-store.ts`.

## Steps

| step | commit | ported from | what |
|---|---|---|---|
| 1 tip highlight | `24dccc7` | `1b69711` | `tipHighlight` 0..1. An amber glow on the moving end of each stroke that is part drawn. New here: the head decision is `tipHeadsAt` in `lib/tip-highlight.ts` (the viewport calls it), and a reach tolerance `TIP_REACH_EPS`. **Bug found by the new gate:** under a timed take `sampleTake` gives 1e-15 for a stroke that has not started, and the old strict `> 0` lit every waiting stroke at its first point. |
| 2 pressure-aware reveal | `f1984b5` | `e2087c4` | `pressureReveal` 0..1. Inside each stroke with varying pressure, a harder press means a slower pen. Each stroke keeps its start and end. No pressure, or a mouse's constant pressure, comes back as the same object. Resolved onto hand-p3: the clock hold no longer exists, so the old lane's holds and its `clockKeyOf` change were dropped. Pressure runs in a new pure `clockTail` (`lib/stroke-timing.ts`) inside `clockStrokesFor`, so a change under performed strokes is rebased by `rebaseForClock` like a clock change, in one undo step. |
| 3 duration | `0084dd1` | `5037ce8` | `durationSeconds`, 0 (off) or 0.5 to 30. Above 0 the rate becomes the one that lands the first ink to the last in exactly that long. It is measured on the array the take's length is read from, after the hand and the pressure. The Speed pills are disabled while it is on. Lives in `clockTail`, so it rebases like a clock change too. |
| 4 Presentation | `69fa50c` | `354bc0c` | The fifth reveal style, a shipped preset between Smooth Reveal and Snappy Draw: 4 s however long the drawing took, ease in-out, overlap 0.2, a 0.4 s delay, tip at 0.6. Only choosing it changes anything. |
| 5 authored vs recorded | `1e39ac4` | `c728b87` | `timing`, `authored` (main) or `recorded`. Recorded gives the viewport (render, clock, export) the empty take; the strip and Perform keep the real take, so the rows stay and nothing is written. The choice is `playedTakeOf` in `lib/stroke-timing.ts`. |

## Checks

**tsc**: 6 errors at the snapshot and after every step (5 `lib/geometry-engines.ts`, 1 `lib/dd-engine/handFeel.ts`).

**The new gate**, `scripts/verify/assert-drawin-extras-node.mjs` (Node, `_ts-load.mjs`). OFF rows compare against `2cc9e98` materialised from git into a temp tree, never against stored numbers. Each must-fail is a sabotage applied through `GATE_MUTATE_FILE`; nothing on disk changes.

| after step | rows | must-fails caught |
|---|---|---|
| 1 | 10 of 10 | 12 of 12 |
| 2 | 15 of 15 | 21 of 21 |
| 3 | 19 of 19 | 28 of 28 |
| 4 | 21 of 21 | 31 of 31 |
| 5 | 25 of 25 | 37 of 37 |

What the rows check, and the must-fails that turn them red:
- **OFF-DEFAULTS, OFF-PRESETS, OFF-DOC, OFF-MATH**: the envelope defaults, every shipped preset, `validateSession` on three older documents (output and repairs), and the schedule, windows, timed take and rate on the hero word all equal the base, apart from the extras at off. Must-fails: an extra defaulting on, a preset shipping one on, a shipped constant moved, Presentation's values leaking into Smooth Reveal.
- **LISTED**: every extra is in `presetFields` for all 7 draw-in presets (the 8th, completionPulse, sets no envelope), in `MOTION_FIELD_KEYS`, and wrapped as a control in dtc. The last two are read from source text. Must-fails: the key dropped from the list, the control unwrapped.
- **TIP**: persist and clamp. The head is checked against the point the reveal has reached, computed in the gate from the strokes' own geometry (worst 6e-13 px over 199 playheads). No head before a stroke starts or after it lands. With overlap, one head per drawing stroke; a reversed stroke lights its far end. Under a timed take the heads come from the take's spans. 7 must-fails, including the float-noise one.
- **PRESS**: off is the base clock (the same arrays at rate 1). Fallback: no pressure or constant pressure gives the same objects at any amount; in a mixed drawing only the pressed stroke moves. On: the half-arc time share drops from 0.468 to 0.339 at 0.5 and 0.210 at 1, and starts and ends hold to 1e-9 ms, including a skewed fixture where the slowest-step floor applies. Wired in `/` (source text). 9 must-fails.
- **DUR**: persist and range. Off leaves the rate in charge. On: the take is 2000.000 and 7000.000 ms on the recorded clock, the hand path, with pressure, and when raw runs longer than its resample, at either speed pill. Wired, and the Speed pills are disabled. 7 must-fails.
- **PRES**: shipped, found by `resolveMotionPreset` and `PRESET_REGISTRY`, in the plan's order. Plays 4000.000 ms on the hero and on the hero drawn at half speed. No other preset plays the same take. 3 must-fails.
- **TIMING**: persist. Authored hands back the same object and plays the base's timed take (3390.0 ms with two rows). Recorded builds no timed take and leaves the rows untouched. The viewport gets the played take and the strip gets the real one. 6 must-fails.

**Regression gates**, each compared with its own run on the unchanged snapshot (a worktree at `2cc9e98`) in this container:

| gate | snapshot | step 1 | step 2 | step 3 | step 4 | step 5 |
|---|---|---|---|---|---|---|
| assert-keyframes | 16/16, 21/21 | same | same | same | same | 16/16, 21/21 |
| assert-key-paths | 6/7 (EXISTING red), 8/8 | same | same | same | same | 6/7 (EXISTING), 8/8 |
| assert-width-keys | 12/12, 9/9 | not run | 12/12, 9/9 | not run | 12/12, 9/9 | 12/12, 9/9 |
| assert-camera-moves | 11/11, 20/20 | same | same | same | same | 11/11, 20/20 |
| assert-flip-pose | 8/8, 10/10 | same | same | same | same | 8/8, 10/10 |
| assert-stroke-timing, default | RED: RUN, 0/1, 0/12 | same | same | same | same | same |
| assert-stroke-timing, `STROKE_TIMING_BASE=2cc9e98` | 16/16, 12/12 | same | same | same | same | 16/16, 12/12 |
| assert-no-em-dashes | 7 rows green, 142 files | | | | | 7 rows green, 144 files |

- **assert-stroke-timing is red before any change.** Its default base is `b0da66626`, which is not in this snapshot's history (`fatal: not a valid object name`), so it throws before its first row. That is not this lane's doing. I also ran it against the snapshot commit through its own `STROKE_TIMING_BASE` override, which is green at every step. No bar was changed.
- **assert-width-keys** takes about 15 minutes with its must-fails, so it ran at the snapshot and after steps 2, 4 and 5, not after 1 and 3. Steps 1 and 3 touch nothing it loads beyond what steps 2 and 4 also touch.
- `pnpm install --frozen-lockfile` worked here.

## What was not run

- **Every browser row.** `scripts/verify/assert-drawin-extras.mjs` (the old lane's browser gate, 33 rows and 11 must-fails on `52982e8`) is ported but NOT RUN on this snapshot. I updated it in two places, both unrun: Customize now opens from the rail (`openStyle`, `lib/dock.mjs`) instead of the old Preset pill, and the header records this status. Its `--phase=base` file has to be recorded on `2cc9e98` first. Not run either: assert-motion-customize (its preset count goes from 7 to 8 with Presentation), assert-hand-clock, assert-take-timeline and assert-stroke-strip.
- I did not install Playwright's Chromium or start a dev server, because the brief said no browser in this lane. So the glow, the four new controls in the dock's Animation tab, and Customize have not been seen rendering on this tree.
- I tried to message the controller session back; this cloud session is not allowed to message other sessions. I had already been porting the 09-30 branch, as it asked.

## Questions for the owner

1. **Presentation's values are a reading of one word in the plan** (4 s, ease in-out, a 0.4 s delay, tip at 0.6). Is that right, or should Presentation mean something else?
2. **Duration and per-stroke rows.** Duration sets the pen's length. A held-back stroke or a delay still adds to the take. Should Duration fit the whole take, rows included?
3. **Pressure's direction.** Harder press means a slower pen. It is one sign in `lib/pressure-reveal.ts`, and the must-fail already runs the other way.
4. **Keyframe anything.** The extras are envelope fields like Delay and Overlap, and envelope fields are not on key lanes today (the keyable paths are style values). Should Tip highlight, Pen pressure and Duration get key buttons?
5. **"Recorded" appears twice.** The Clock row's Recorded means his timestamps; the Timing row's Recorded means the take without his per-stroke rows. Rename one?
6. **Under Recorded the strip still shows the rows** that Authored would play. Grey them out, or leave as is? Keyframe lanes (`keys`) still play under Recorded; only per-stroke rows are set aside.
7. **Pressure and Duration under performed strokes.** On this tree they rebase performed rows like a clock change (one undo step). Under the old lane they were held instead. Is rebasing what you want?
8. **assert-stroke-timing's base `b0da66626`** is missing from cloud snapshots, so the gate is red before it starts. Should its default point at a commit the snapshots carry?

---

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
