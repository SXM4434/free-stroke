NOT MERGE-READY

# CLOUD-FLAKES log, 2026-10-02

Branch `claude/fix-timing-flakes-r4whad` (the session's assigned branch, cut from `cloud/integrate-1001` at 2cc9e98). Two steps, one commit each, both pushed. Nothing under `docs/thinking` or `docs/verification` is committed. The gates write there; it is untracked and listed in `.git/info/exclude` on this machine only.

Stopped early: the Free Stroke controller handed this job to the session "Free Stroke CLOUD-FLAKES timing determinism" on `claude/free-stroke-timing-determinism-k14hyw`. Step 1 is done and measured. Step 2 is committed with one run each side, not ten.

## Environment

- 4 cores, headless Chromium 141 from /opt/pw-browsers. `lib/browser.mjs` pins `channel: "chrome"`, so /opt/google/chrome/chrome is a symlink to that Chromium. SwiftShader renders, as in the brief.
- Dev server: `next dev -p 3138` from this tree, `FS_PORT=3138 FS_HEADED=0`.
- This container has no /proc/net/tcp6, so `lsof` names no TCP listener and `lib/server-commit.mjs` refused ("no listener on :3138"). A PATH shim (scratchpad only, not committed) answers the two `lsof` calls it makes from /proc.
- The proxy blocks va.vercel-scripts.com (Vercel Analytics), so the page logs `net::ERR_TUNNEL_CONNECTION_FAILED` on every load.
- The container restarted once mid-session. The dev server was started again.

## Step 1 · 89a97c1 · assert-drawin-timing on a driven clock

Cause. The mid-pass row (F) polled the playhead once a frame and read it only if it was inside 0.3..0.5. That band is 336 ms of the 1680 ms pass, so one frame of 336 ms or more steps over it. The poll then runs to the end and reads 1.000000: the 24 of 25 on main. The B coverage control ("the same ease at the same moment draws the same amount of mark", bar 12%) compared two in-page `setTimeout` windows. How far the pass got was left to the frame rate (linear clock 0.37 to 0.46), and it flipped on unchanged code.

Fix. `playDriven(ms)`: inside one page call `performance.now` returns a value the gate sets. It steps 1 ms a frame until the playhead moves (the controller has armed), then steps exactly `ms - 1` and reads on the frame after. `playFor` and the F row both use it. No bar moved: F still needs 0.2 < head < 0.8 and identity to 1e-9, B still 12%.

Ten runs each, quiet machine, same app code:

| run | before: F mid-pass (bar 0.2..0.8) | before: B coverage control (bar 12%) | before: gate | after: F | after: B | after: gate |
|---|---|---|---|---|---|---|
| 1 | PASS 0.3301 | FAIL 0.333% vs 0.281% | 24/26 | PASS 0.400000 | PASS 0.286% vs 0.286% | 25/26 |
| 2 | PASS 0.3186 | PASS 0.286% vs 0.300% | 25/26 | PASS 0.400000 | PASS 0.286/0.286 | 25/26 |
| 3 | PASS 0.3118 | FAIL 0.328% vs 0.286% | 24/26 | PASS 0.400000 | PASS 0.286/0.286 | 25/26 |
| 4 | PASS 0.3081 | PASS 0.323% vs 0.309% | 25/26 | PASS 0.400000 | PASS 0.286/0.286 | 25/26 |
| 5 | PASS 0.3209 | PASS 0.290% vs 0.300% | 25/26 | PASS 0.400000 | PASS 0.286/0.286 | 25/26 |
| 6 | PASS 0.3352 | PASS 0.276% vs 0.281% | 25/26 | PASS 0.400000 | PASS 0.286/0.286 | 25/26 |
| 7 | PASS 0.3077 | FAIL 0.328% vs 0.286% | 24/26 | PASS 0.400000 | PASS 0.286/0.286 | 25/26 |
| 8 | PASS 0.3275 | FAIL 0.300% vs 0.338% | 24/26 | PASS 0.400000 | PASS 0.286/0.286 | 25/26 |
| 9 | PASS 0.3097 | PASS 0.300% vs 0.286% | 25/26 | PASS 0.400000 | PASS 0.286/0.286 | 25/26 |
| 10 | PASS 0.3254 | PASS 0.309% vs 0.305% | 25/26 | PASS 0.400000 | PASS 0.286/0.286 | 25/26 |

Before: 6 of 10 runs at 25/26 and 4 of 10 at 24/26. After: 10 of 10 at 25/26, every row the same. The one red in every run is "no console or page errors", which is the blocked analytics script (Environment above). Five more runs under six busy-loop CPU hogs: before 5/5 F green (0.302 to 0.345); after 5/5 identical to the quiet runs.

Must-fails (mutants in scratch copies, not committed):
- 600 ms main-thread stall at 25% of the pass. Before: F CONTROL red, playhead 1.000000 after 1829 ms (the main failure, reproduced). After: green, 0.400000.
- Frozen transport (Codex F113-5: progress and clock pinned at 0.4, setPlaying a no-op). After: F CONTROL red, "THE PLAYHEAD DID NOT MOVE while playing".
- Twos cadence clicked before F. After: identity row red, clock 0.400000 vs playhead 0.396825.
- B coverage repeat read at 0.3 against 0.4. After: B CONTROL red, 0.286% vs 0.215%.

The detail strings were changed after the ten runs (two em dashes taken out of failure text). Only the message text changed, not any logic, and that edit was not re-run.

## Step 2 · 083f0af · assert-perform drives the stage's clock

Cause. `components/perform-take.tsx` stamps samples with `performance.now()` read in its pointer handlers and in its frame loop. A performance therefore records when each CDP move was delivered, and under SwiftShader one move took about 450 ms. The gate's expected dwell read `e.timeStamp`, a second clock. Measured on one before run:
- a 61-move performance meant to last about 2 s recorded 28.0 s;
- the 1 s dwell recorded 1420.6 ms, and D's slot came out 27568.9 ms;
- row 2 found a flat run of 200 ms or more because each stall reads as a pause;
- row 1b's neighbour audit fired because D's 20 s hold-back no longer clears a 27 s slot (402 to 844 px "neighbour" ink at 33572.9 ms).

Fix. An init script makes `performance.now` drivable (`__fsDrive`). `perform()` sets each pointer event's time to t0 plus the plan's milliseconds, using whole milliseconds so every difference is exact. The time is applied in a capture listener ahead of the stage's handler, and the clock is handed back only once real time has passed it. The pointer log reads the same clock. No bar moved.

One full run each (the ten-run loops were stopped for the handover):

| row | before (bar) | after |
|---|---|---|
| 1a | PASS, dwell 1420.6, flat run 1412.9 | PASS, dwell 1016.0, flat run 1014.5, slot 1944.0 |
| 1b rod (1 frame) | PASS, held 1422.9 vs 1420.6 | PASS, held 1017.4 vs 1016.0 |
| 1b inflate | FAIL, reach audit hit; held 537.5, ends +172.2/-703.2 | FAIL, reach ok; held 733.8, ends -0.6/-281.2 |
| 1b extrude | FAIL, reach audit hit; held 1415.6 | FAIL, real PASS but must-fail arm did not fire: 4 px margin leaves out 4.4%, under the 5% cap |
| 1b solid | FAIL, reach audit hit; held 1412.4 | PASS, held 1014.4, ends 0.1/-0.1 |
| 2 (flat run < 200 ms) | FAIL, real and arm both false | PASS |
| 5 | PASS, 25873.1 ms performed, slot 12940.5 | PASS, 1180.0 ms performed, slot 590.0 |
| row 8 | gate threw | gate threw |
| total | 9 PASS 5 FAIL | 11 PASS 3 FAIL |

What the after run says about each red:
- Inflate: D's ink count changes 281 ms before the dwell ends, while the tip bake reports the right hold (6368.8 to 7383.2). Under real pacing it also failed to hold (537.5 of 1412). It looks like a product defect in Inflate's hold, not noise, but whether it repeats exactly across ten runs is not measured.
- Extrude: the row cannot pass on this tree. Its alternative must-fail arm (4 px margin under the cap) is true at 4.4% every time the mask is this shape. This is a gate-design question; the bar is not touched.
- Row 8 threw in both: on the undocked page `[data-strip-perform]` never appears (30 s timeout). This comes from the dockview layout (the hidden dock takes the strip with it), not timing. Because it throws, the page-errors row never runs.

## Checks

- tsc: 6 errors, the baseline (measured at the start; both steps touch only `scripts/verify`).
- `node --check` on both gates after each edit.
- assert-drawin-timing: 10 runs before, 10 after, 5 before and 5 after under load, and 4 must-fail mutants (above).
- assert-perform: base recorded with `--phase=base --base=HEAD` (row 8 would read SELF). 1 full run before, 1 full run after.

## Not run, or left

- assert-perform ten runs on each side. The loop was stopped after 1 incomplete before-run, at the handover.
- assert-perform must-fail mutants. They are written (the row 2 re-performance with a 400 ms pause; 1b with D's flat run ramping halfway through) but not run.
- Whether Inflate's early release (-281.2 ms) is identical run to run, and whether it is a product defect.
- Row 8 on the dockview layout, and extrude's must-fail arm.
- The two em-dash text edits in step 1 were not re-run.
