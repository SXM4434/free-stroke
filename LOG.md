MERGE-READY
Both flaky checks now give 10 of 10 identical verdicts and numbers, every must-fail named below fires, and tsc is at the baseline of 6. Two reds remain, both outside this job and both red before it: assert-perform row 8 throws on the dockview layout, and assert-drawin-timing's page-errors row is red because this sandbox's proxy blocks the analytics script. Neither is caused by this branch, and neither changed verdict across runs.

# CLOUD-FLAKES log, 2026-10-02 to 2026-10-03

Branch `claude/free-stroke-timing-determinism-k14hyw`, cut from `cloud/integrate-1001` at 2cc9e98 (this session's assigned branch; the brief's `cloud/<name>` was not used because the session is pinned to this one). Four steps, one commit each, each pushed. Nothing under `docs/thinking` or `docs/verification` is committed; the gates write there and it is listed in `.git/info/exclude` on this machine only.

An older session worked the same job this morning on `claude/fix-timing-flakes-r4whad` (89a97c1, 083f0af, 32bb489). Its step 1 is carried here unchanged (cherry-picked as dc2a0fa) and its measurements are kept below, marked as its own. Its perform fix (083f0af) was not taken: this branch's step 2 was written in parallel and measures the same numbers (dwell 1016.0, slot 1944.0, Inflate -281.2).

"Main": `origin/main` on GitHub (a6c001c) has no history in common with this branch and no `scripts/verify`, so nothing could be compared against it. The base used throughout is the snapshot 2cc9e98.

## Environment

- 4 cores, headless Chromium 141 from /opt/pw-browsers, SwiftShader. `lib/browser.mjs` pins `channel: "chrome"`, so /opt/google/chrome/chrome is a symlink to that Chromium.
- `lsof` in this container sees no TCP listener and no process cwd, so `lib/server-commit.mjs` refused ("no listener on :3138"). A PATH shim in the scratchpad (not committed) answers its two `lsof` calls from /proc. The repo's lookup is unchanged.
- Dev servers: this tree on :3138; the snapshot 2cc9e98 in a separate worktree on :3140, so "before" runs never saw an edited app.
- The proxy blocks va.vercel-scripts.com, so the page logs `net::ERR_TUNNEL_CONNECTION_FAILED` on every load.
- The worker restarted once; both dev servers were started again.

## Step 1 · dc2a0fa · assert-drawin-timing on a driven clock (the older session's 89a97c1)

Cause. The mid-pass row (F) polled the playhead once a frame and read it only inside 0.3..0.5: 336 ms of a 1680 ms pass. One frame of 336 ms or more steps over the band, the poll runs to the end and reads 1.000000: the 24 of 25 on main. It also always read near the band's floor (0.302 to 0.333), the first frame inside it. The B coverage control ("the same ease at the same moment draws the same amount of mark", bar 12%) compared two in-page `setTimeout` windows whose reach the frame rate decided.

Fix. `playDriven(ms)`: inside one page call `performance.now` returns a value the gate sets; it steps 1 ms a frame until the playhead moves, then exactly the rest, and reads on the frame after. F and B use it. No bar moved.

Ten runs each, this session, quiet machine, same app:

| run | before F (0.2..0.8) | before B (12%) | before gate | after F | after B | after gate |
|---|---|---|---|---|---|---|
| 1 | PASS 0.3237 | PASS 0.281 vs 0.281 | 25/26 | PASS 0.400000 | PASS 0.286 vs 0.286 | 25/26 |
| 2 | PASS 0.3022 | FAIL 0.276 vs 0.319 | 24/26 | PASS 0.400000 | PASS 0.286 vs 0.286 | 25/26 |
| 3 | PASS 0.3226 | PASS 0.295 vs 0.281 | 25/26 | PASS 0.400000 | PASS 0.286 vs 0.286 | 25/26 |
| 4 | PASS 0.3199 | PASS 0.319 vs 0.300 | 25/26 | PASS 0.400000 | PASS 0.286 vs 0.286 | 25/26 |
| 5 | PASS 0.3326 | PASS 0.305 vs 0.305 | 25/26 | PASS 0.400000 | PASS 0.286 vs 0.286 | 25/26 |
| 6 | PASS 0.3218 | PASS 0.295 vs 0.300 | 25/26 | PASS 0.400000 | PASS 0.286 vs 0.286 | 25/26 |
| 7 | PASS 0.3150 | PASS 0.271 vs 0.276 | 25/26 | PASS 0.400000 | PASS 0.286 vs 0.286 | 25/26 |
| 8 | PASS 0.3215 | PASS 0.295 vs 0.262 | 25/26 | PASS 0.400000 | PASS 0.286 vs 0.286 | 25/26 |
| 9 | PASS 0.3132 | FAIL 0.276 vs 0.328 | 24/26 | PASS 0.400000 | PASS 0.286 vs 0.286 | 25/26 |
| 10 | PASS 0.3314 | PASS 0.281 vs 0.271 | 25/26 | PASS 0.400000 | PASS 0.286 vs 0.286 | 25/26 |

Before: 2 verdict strings in 10 runs. After: 10 of 10 the same verdict string, and every row's numbers identical except one (below). The 1 red in every run is "no console or page errors" (the blocked analytics script).

The older session's ten and ten agree: before B red 4 of 10, after 10 of 10 identical; and 5 + 5 runs under six CPU hogs, after identical to quiet.

Must-fails:
- 600 ms main-thread stall each time the playhead crosses 0.25 (scratch copies, this session): before, F CONTROL red, playhead 1.000000 after 1737 ms, "NEVER LANDED IN BAND" (the main failure, reproduced on demand). After, green, 0.400000; the stalls fired, two of them at playhead 0.4000.
- The older session, on the same gate file: frozen transport (Codex F113-5) turns F CONTROL red; Twos cadence turns the identity row red (0.400000 vs 0.396825); B's repeat read at 0.3 against 0.4 turns B CONTROL red (0.286% vs 0.215%). Not re-run here.

Left as is: C's delay control ("with no delay it is already well under way at the same 600 ms", bar > 0.15) still sleeps 600 ms of wall time and read 0.296 to 0.352 over the ten after-runs. Green in all 10, about 0.15 clear of its bar, but its number is not deterministic. Not converted: a delay row cannot use `playDriven`'s arm loop as written (the clock does not move during the delay).

## Step 2 · 08e8b50 · assert-perform drives the Perform stage's clock

Cause. `components/perform-take.tsx` times a performance with `performance.now()` read in its pointer handlers and once a frame. The gate paced the pen with wall-clock sleeps and measured the dwell with `e.timeStamp`. Under SwiftShader each 16 ms CDP step really took about 450 ms, so the stage recorded the machine's speed: a 61-move performance of about 2 s recorded 26.8 to 49.8 s. Consequences, all measured in the before-runs below:
- row 2 (flat run under 200 ms): every slow step is a recorded pause; red in 10 of 10, speeds 0.035 to 0.102;
- rows 1b: the fit's 1600-bin cap made bins about 17 ms, more than the one-frame bar; D's 20 s hold-back no longer cleared a 27 to 50 s slot, so the neighbour audit hit and some masks came out empty (0 px);
- the dwell itself measured 1318 to 1905 ms for a 1000 ms plan.

Fix. Inside a performance `performance.now` reads a value the gate sets. Each pointer event is dispatched, the gate waits until the page has logged it (`__ptrN`), then moves the clock by the plan's step or dwell. The logger reads the same clock (no more `e.timeStamp`). Real sleeps stay, so the real clock is always ahead and the clock is handed back without running backwards. No bar moved.

## Step 3 · 9bf2857 · Inflate holds the tip still through a performed pause; row 1c

With the clock driven, row 1b on Inflate was red every time: stroke D's ink count changed 281 ms before the end of the 1016 ms dwell. Traced pixel by pixel (scratch probes, hero D, Inflate, 1512x982): the count is blind to a swap, and four pixels moved inside the dwell, from 20 ms in. A product defect, two causes, both in `components/viewport-3d.tsx`:

- The ramp. A hold makes `fsTipD` differ per fragment, so `fsTsd` jumps at the hold disc's edge by (clock - t0), which grows through the pause. `fwidth(fsTsd)` over a quad straddling the edge read the jump as gradient, so the rim's coverage ramp widened as the clock ran: (288,306) and (291,307) swapped in and out, and (288,306) stayed in at 7108.8 ms, the 281 ms early release. Each ramp is now the gradient of a distance continuous across the quad (running outside the disc, the hold's own inside), in uniform control flow. Program key fs-pentip-v8. Probe: with only this fix those two pixels no longer moved.
- The disc. The tip's clock runs on through a performed pause and only a disc round the pen point is frozen. (282,301) and (286,305) inked 140 and 180 ms in from outside it. Radius sweep: x1.1 neither held, x1.2 one, x1.35 both; the field's own reach (2.6 R in place of 2 R) still left (282,301) moving. So a performed pause that no other stroke's slot overlaps now holds the whole tip at its start, as a lift does (`stills`, published as `__heroPenTip.stills`). `takeLiftsMs` is unchanged: for the camera a stop is still the pen on the page. A pause another stroke overlaps keeps the disc alone.

Gate. Row 1c, on Inflate, Extrude and Solid: the dwell read every 40 ms (26 reads) must ink exactly the middle's pixels. Paired arm: the same test on the slot played without its pace, which must see pixels change (+558, +469, +871 px). Must-fail knockout: `FS_GATE_MUTATE=tip-no-pausestill` (sets `window.__FS_GATE_MUTATE` before load, dev only).

Measured, `--dwell-engines=inflate`:
- fixed: 1b PASS, held 1015.0 ms, ends -0.6 and -0.1 ms; 1c PASS, 26 reads, none differ.
- `FS_GATE_MUTATE=tip-no-pausestill`: 1b FAIL, held 839.2 ms, ends +175.2; 1c FAIL, 5 of 26 reads differ, first at 6373.8 ms at (282,301) (286,305).

No pause, no change: Inflate frames at 9 playheads, snapshot :3140 against this tree :3138, three runs. With no take 9/9, 9/9, 9/9 equal (run 1 read 8/9: its very first grab, playhead 0, caught an unsettled frame; runs 2 and 3 matched it). With a timed take and no performed row 9/9 in all three.

## Step 4 · 7e2dc06 · row 1b's left-out cap 5% to 3.5%, so Extrude's must-fail fires

Row 1b leaves pixels within 1 px of neighbour ink out of D's mask and caps the left-out share; its must-fail reads the same frames with a 4 px margin, which must go over the cap. On this layout the 4 px margin left out 4.4% on Extrude, under the 5% cap, so the arm held and row 1b on Extrude was red in every run, before and after the driven clock. The shares come from frames with no performance and were identical in all 20 runs: at 1 px Inflate 1.6%, Extrude 0.7%, Solid 1.5%; at 4 px 7.4%, 4.4%, 8.4%. The cap is now 3.5%, between the worst real share measured on any layout (2.9%, Solid on a6ee983f9) and the smallest 4 px share. The bar is tighter; NB_WIDE and NB_REACH did not move.

## assert-perform, ten runs each side

Before: the snapshot's own gate on the snapshot app (runs 1 and 2 on :3138 before any app edit, runs 3 to 10 on :3140). Several before-runs shared the machine with scratch probes, which only adds load; the after-runs ran alone.

Before, per run (dwell planned 1000 ms + 16):

| run | verdicts, in order R1 1a R2 1b 1bInflate 1bExtrude 1bSolid 2 4 3 5 6 7 threw | dwell / D's slot, ms | 1b Inflate held, ms | row 2 speeds |
|---|---|---|---|---|
| 1 | `PPPPFFFFPPPPPF` | 1331.0 / 27741.8 | 917.5 | 0.064 to 0.094 |
| 2 | `PPPPFFFFPPPPF` (threw at row 7, a TypeError) | 1318.3 / 27051.9 | 258.2 | 0.065 to 0.056 |
| 3 | `PPPFFFFFPPFPPF` | 1905.1 / 49820.0 | 2076.1, empty mask | 0.035 to 0.059 |
| 4 | `PPPFFFFFPPFPPF` | 1642.9 / 39337.8 | 1910.0, empty mask | 0.045 to 0.053 |
| 5 | `PPPPFFFFPPFPPF` | 1672.3 / 45860.8 | 1900.6, empty mask | 0.038 to 0.057 |
| 6 | `PPPPFFFFPPPPPF` | 1345.2 / 28188.4 | 809.5 | 0.063 to 0.102 |
| 7 | `PPPPFFPFPPFPPF` | 1457.7 / 26780.6 | 1114.8 | 0.066 to 0.101 |
| 8 | `PPPFFFFFPPPPPF` | 1463.1 / 27414.7 | 1660.5, empty mask | 0.064 to 0.102 |
| 9 | `PPPPFFFFPPPPPF` | 1421.4 / 27751.1 | 1306.8 | 0.064 to 0.099 |
| 10 | `PPPPFFFFPPPPPF` | 1332.9 / 27245.7 | 756.5 | 0.065 to 0.101 |

Before: 6 different verdict strings in 10 runs; 1b on Rod, 1b on Solid and row 5 changed verdict, and run 2 threw at row 7; 1b Inflate, 1b Extrude and row 2 were red in all 10 on different numbers each time.

After (this tree, steps 2 to 4): 10 of 10 the same 17 rows, and every row line, verdict and numbers, byte-identical across the 10 (one md5 for all ten). 16 PASS, 1 FAIL:
- 1a: dwell 1016.0, flat run 1014.5 of a 1944.0 ms slot.
- 1b Rod: held 1017.4 vs 1016.0. Inflate held 1015.0, ends -0.6/-0.1; Extrude and Solid held 1014.4, ends +0.1/-0.1.
- 1c: 26 reads, none differ, on all three engines.
- 2: speed 0.907 to 2.827. 5: performed 1180.0, slot 590.0 at 0.5x.
- FAIL: "gate threw", row 8 (below).

Must-fails, all shown firing on this tree:
- Each row's paired arm, in every one of the 10 runs (a row passes only when its arm fails): 1b linear arms 447 to 1005, 430 to 899, 937 to 1808 px; 4 px margins 7.4%, 4.4%, 8.4% over the 3.5% cap; 1c linear arms +558, +469, +871; row 2's arm is the first take, whose 1 s dwell is a flat run over 200 ms.
- `FS_GATE_MUTATE=tip-no-pausestill`: 1b and 1c Inflate red (step 3).
- The stage's clock run 5% fast (`components/perform-take.tsx`, scratch edit, reverted): 1a red (flat run 1063.0 vs 1016.0), 1b Rod red (held 1065.7), 1b Inflate red, 5 red (slot 619.5 vs 590.0). The driven clock does not blind the gate to a stage that times wrong.

## Checks

- tsc: 6 errors, the baseline, at the start and after every step (the 6 are in lib/dd-engine/handFeel.ts and lib/geometry-engines.ts, untouched).
- `node --check` on both gates after every edit. No em dash in any added line.
- assert-drawin-timing: 10 before, 10 after, 1 stall must-fail on each side.
- assert-perform: 10 before, 10 after, 1 smoke run, 2 Inflate-only runs (fix, knockout), 1 clock-sabotage run.
- Inflate no-pause frames, snapshot against this tree: 3 runs.

## Not run, or left

- assert-perform row 8 throws on this layout in every run, before and after: on the undocked page `[data-strip-perform]` never appears, because the hidden dock takes the strip with it (dockview layout). Since it throws, "no page errors" never runs. Not timing; not touched.
- assert-drawin-timing "no console or page errors" is red in every run: the blocked analytics script.
- C's delay control in assert-drawin-timing is still on wall time (above).
- The base for assert-perform's row 8 was last recorded at 08e8b50; a re-record at 9bf2857 refused because a commit moved HEAD during it. Row 8 throws before reading the base, so no verdict depends on it.
- Under the disc path (a pause another stroke inks through) the radius still misses pixels out to between 1.2x and 1.35x; the stills do not apply there. Not covered by a gate row: the corpus has no overlapping pause.
- The older session's frozen-transport, Twos and B-at-0.3 must-fails were not re-run here; the gate file is byte-identical to the one they ran on.
- Draw-in under CPU hogs was not re-run here (the older session ran 5 + 5).
