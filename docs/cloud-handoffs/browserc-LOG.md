# CL-BROWSERC · three browser-gate items, each a call the controller already made

Clone ~/.fs-lanes/cl-docs, branch claude/browserc, from 3500ae146 (integration head). Gate files only; nothing a person sees changes.
Server: my own `next dev -p 3146` from this clone, pid written below, FS_PORT=3146 FS_HEADED=0, killed by exact pid.
Browser: the harness's own launch (scripts/verify/lib/browser.mjs, Chrome with --use-angle=metal). No BROWSER_CDP, no :9301/:9302.
Each run is refused unless the served JS carries `__fsAnimGlbMaterial` (components/viewport-3d.tsx, 18a574f57) and the
listener on :3146 has its cwd in this clone.

## Plan
1. assert-pen-field-alloc.mjs: the setFieldRealloc(false) control requires the GL-storage row red, not comes-apart. The eraser
   thins the mark (26,012 px against 29,404) without splitting it, so comes-apart is printed for the record, not required.
   Run clean (shipped arm, must-fail, control).
2. assert-hero-k7-intact.mjs: prior / nofarside / terminals are graded on the forced-open break (setFlatten({ jointBreak: 1 }),
   the must-fail's own forcing) instead of the live K7, where the identical return opens no break. Each must read red: its
   forced frame comes apart further than the shipped law's forced frame does. Run clean with every control.
3. assert-keyed-playback-live.mjs: rerun whole, report L1 (held bar 6 levels) and every must-fail.
tsc stays at 6.

## Runs

### 1 · pen-field-alloc (before 5 of 6 rows hold, after 5 of 5, SOUND)
Every run below passed the preflight: listener pid 14034 (child of 14018) has its cwd in this clone, served JS carries `__fsAnimGlbMaterial`.
- Shipped arm, both runs: GL storage field 1136x294 / GL 1136x294 on both engines. Comes apart: free-stroke carved 7 comps,
  0 new specks, 29404 px against un-carved 7 comps 38149 px; desk-doodles 7 = 7, 26142 px against 30172 px. Ink cut 150 under grid 203.
- Must-fail, both runs: the 2 px split reads 8 vs 7 comps on both engines, red. It fired.
- Control (setFieldRealloc(false), took: false), same reading both runs: GL-storage row red (field 1136x294 / GL 1135x324 MISMATCH on
  both engines); comes-apart green (free-stroke 7 = 7, 26012 px; desk-doodles 7 = 7, 22734 px).
  Before: FAIL, it required both rows. After: PASS, it requires the storage row and prints comes-apart for the record.

### 2 · hero-k7-intact (before 6 of 9 rows hold, after 8 of 9)
Shipped arm, both runs: selfcross, 4 junctions, carve 0.70. Live cut 0 px on 12 hold frames 12.00-12.37 s; window the 2 regions the
forced break drew (77 px at 447,435 and 60 px at 449,452), padded 13 px, table opened 1. K1 5 = K7 5, crumbs 0 -> 0, console clean.
Must-fail (forced open reads paper): 137 px, fired. crossings arm holds: 3 junctions, -[1-1@8/44], K1 5 -> K7 5.
Known-bads, graded now on the forced-open K7 frame (setFlatten jointBreak 1), against the shipped law's forced frame K1 5 -> 5 (+0):
- prior: before FAIL (live K1 5 -> K7 5, "THIS GATE IS BLIND"). After PASS: table opened 4, K1 5 -> forced 7 (+2), junctions
  +[1-2 2-3 8-9 10-11] -[1-1@8/44].
- nofarside: before FAIL (live 5 -> 5, blind). After PASS: table opened 3, K1 5 -> forced 6 (+1), junctions +[1-2 2-3].
- terminals: before FAIL (live 5 -> 5, blind). After STILL FAIL, and it says so: table opened 1, K1 5 -> forced 5 (+0), same as
  the shipped law. It publishes exactly the crossings set (3 junctions, +[none] -[1-1@8/44]). The junction it is named for,
  18->20 on the final s, is not in the 13-stroke drawing since the stub filter (2026-08-28), so on this drawing terminals IS the
  crossings arm, which this gate grades to hold. No forcing can make it read red. Next: the controller rules whether terminals
  retires as a control or gets a drawing that still has 18->20. Not mine to decide here.

### 3 · keyed-playback-live (17 PASS, 0 FAIL, exit 0, 147 s)
- L1 PASS on the 6-level bar: take 5832 ms, 17 grabs on the ramp, rank correlation 1.000, 3 grabs past the last key at 10.39 levels
  (spread 0.00), drew clock/2000 within 0.0000 over 307 frames. Its must-fail (frame loop fed the doc's styleState) FIRED: 0.00 levels over 22 grabs.
- Every must-fail fired, 9 of 9: L1 0.00 levels · L2 2.77 levels over the film · L3 refused path drops the other key (keys 0:0.2 1000:0.4) ·
  L3 refused key shows no words · L4 film eased with no cadence (33.33 ms off a step) · L5 old throttle (0.0118 off) · L5 clock off the
  readout (0/5 clicks inside) · L6 reset with no notify (tab still active) · L7 file with no keyed material (0 channels).
- L2-L7 and G1 PASS (numbers in the run).

tsc: 6 errors (stays at 6).
