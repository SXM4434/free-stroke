# LOG-KEYEDV · CL-KEYEDV, 2026-10-03

Keyed style landed on the integration head e5082126d: the 3D view and every export read keyed style values.
Node gates are green. This lane runs the browser gates on the Mac and checks one stale sample.
Product code read-only. Only a stale locator or a sample time in a gate may change. Nothing a person sees changes.

## Plan

1. Own server: `nohup node_modules/.bin/next dev -p 3146` from this clone, pid written below.
   Before each gate run, fetch the served JS and find `settleStyleSample`, which only this tree has. No string, no run.
   Gate harness launch path only (scripts/verify/lib/browser.mjs, Chrome, --use-angle=metal),
   no BROWSER_CDP, not :9301 or :9302. One browser at a time. FS_PORT=3146 FS_HEADED=0.
2. `assert-keyed-playback-live.mjs` full run, must-fails included: every row with numbers. The claim to see:
   textureIntensity keyed 0 to 1 over 2 s, the 3D canvas follows the key while playing (L1) and an
   exported video's frames follow it the same way (L2).
3. `assert-keyed-style.mjs` full run. K4 needs `--ref` (a second server on the base tree); this lane owns
   one server, so K4 is reported as not run unless the gate runs it without one.
4. The other browser gates k2live-LOG.md names: assert-take-transport, assert-key-buttons, assert-drawin-timing.
5. `assert-drawin-extras.mjs --only=presentation` with the hcv base file. PRESENTATION 2 requires
   `glow.heads.length > 0` at 0.45 under the Presentation preset (a 4 s eased take, not the 13116 ms one
   TIP 2 sat on). Read the heads around 0.45 under that preset through the page's harness. In a lift:
   move the sample mid-stroke (0.52, the way TIP 2 moved), say why in the gate, keep the bar, show the
   must-fail firing. Mid-stroke: say so, leave the row.
6. tsc stays at 6.
7. Teardown: kill the server and its children by pid, delete .next, `git checkout -q -- docs/verification`.

## Results

Server: `next dev -p 3146`, wrapper pid 54579, next-server pid 54591 (and its postcss workers 56772, 56823), cwd this clone.
Before every gate run, `lsof` named this clone as the listener's cwd and the served chunk
`/_next/static/chunks/lib_a053f2fb._.js` held `settleStyleSample` (4 times). Stopped by those four pids; 0 listeners on :3146 after.
`.next` deleted. `docs/verification` does not exist in this sparse clone, so the checkout had nothing to restore. tsc: 6.

### assert-keyed-playback-live: 16 of 17 PASS, every must-fail fires

- L1, first run: FAIL with the ramp at rank 1.000, because 0 grabs reached the held stretch. The loop stopped at 14 grabs,
  and on the Mac one grab plus the 220 ms wait is about 117 ms of key clock at 0.5x, so the 14th grab sat at 1482 ms.
  SwiftShader grabbed slowly enough that 14 got past 2000 ms. Sample-time fix in the gate: grab until 3 grabs sit past
  2100 ms (cap 40 kept, bars kept). Two runs after: 18 and 17 grabs on the ramp, rank 1.000, the canvas change rising
  0.0, 0.8, 1.7 ... 10.0, 10.3 levels up to 1948 ms, then 3 grabs past the last key at 10.39 levels (spread 0.00), and the
  frame loop drew clock/2000 within 0.0000 over 304 and 307 frames. L1 still FAILS on one bar: the held change must be
  at least 15 levels and Metal draws 10.39. The cloud measured 31 on SwiftShader. That bar is not a locator or a sample
  time, so it stays for a ruling. must-fail (memo): 0.00 levels, fires.
- L2 PASS: the exported WebM, 12 frames on the ramp at rank 1.000 (0.0, 1.5, 4.9 ... 14.7 levels by 1.91 s), past the last
  key 15.27 levels (spread 0.03). must-fail (memo): 2.77 levels, fires.
- L3 PASS: "Not keyed: 26 is outside 4 to 24" beside the diamond, gone after 6.5 s; dropall and silentrefusal fire.
- L4 PASS: live 17 clocks, film 222 frames and 70 clocks, 0.0000 ms off a 12 Hz step, held 2 or 3 frames. ignored-cadence fires (33.33 ms off, holds 1).
- L5 PASS: end readout 1, slider 0.9; Pause worst 0; 5 of 5 clicks keyed inside [before, after]. Both arms fire (0.9971 and 0.0085; 0 of 5).
- L6 PASS: remount resets the store and the tab; no-notify arm fires. L7 PASS: 1 roughness channel, 114 keys, 0.1 to 0.9; arm fires. G1 PASS.

### assert-keyed-style: 13 of 13 PASS after one sample-time fix, K4 not run

- First run: 12 PASS, 1 FAIL. K1's "endspeed" arm was blind at 0.8%: the speed step sat at 2000 ms, which on a steady
  60 Hz key clock is a frame boundary (120 frames), so the arm fired only when a frame happened to end exactly at 2000
  (K1m that run: 65.9%) and read 0.8% when the straddling frame started at about 1999.8 ms. Moved the step to 2008 ms,
  mid-frame, reason in the gate, 2% bar kept.
- Two runs after: K1 0.00% (195 and 194 frames), speedxtime arm 11202% and 10343%, endspeed arm 25.3% and 39.4%.
  K1m 0.00%, arms 19753% / 18630% and 34.3% / 32.3%. K2 frames differ, drew 0 and 1; memo arm same frame. K3 12 of 12
  export frames equal live; shifted arm 0 of 11. K5 equal; nodisable arm differs. G1 0 errors.
- K4 NOT RUN: it needs `--ref`, a second server on the base tree, and this lane owns one server.

### Other browser gates k2live-LOG.md names

- assert-take-transport: 9 of 9 PASS, both arms fire (131 of 131 and 130 of 131 frames off).
- assert-key-buttons: 11 of 12. B1 FAILS on ditherAngle having no key button (32 of 33), the same failure k2live-LOG.md
  records on the base snapshot. Product, not a locator; left. Every arm fires.
- assert-drawin-timing: all 26 PASS (the cloud's one network FAIL does not occur here).

### PRESENTATION 2 at 0.45: not in a lift, row left as it is

PRESENTATION 2 does require `heads > 0` at 0.45, but it reads the Presentation take, not the 13116 ms one TIP 2 sat on.
Presentation re-times the same 12 strokes to 4000 ms with about 22 ms gaps. Read through `__fsTipGlow` on that take:
at 0.45 two heads draw (stroke 4 at frac 0.71, stroke 5 at 0.05), and all 13 samples from 0.40 to 0.54 read at least one
head. `--only=presentation`: 6 of 6 PASS, "tip 0.6 with 2 heads at 0.45", total 4000.0 ms, slope 4000 ms, inOut.
The Smooth Reveal arm does play the 13116 ms take, where 0.45 is inside the 72 ms lift, but it fires on total 13116 and
tip 0 regardless of the heads.
