# CL-REDERIVE · two stale browser gate rows, rewritten

Clone ~/.fs-lanes/cl-docs, branch claude/rederive, from 89226c543. Gate files only; nothing a person sees changes.
Server: my own next dev on :3145 from this clone, pid written below, FS_PORT=3145 FS_HEADED=0, killed by pid.
Each run is refused unless the served JS carries a string only this tree has.

## 1 · assert-hero-k7-intact.mjs, row "the LIVE beat reaches K7 with the break OPEN"
Stale since 74b0b114 made the return identical (DEFAULT_HERO_MOTION.ret.mode "identical"): the live beat never
opens the break, so the row asks for paper that the shipped beat is built not to cut.
Rewrite: "the live beat cuts 0 px at the k junction on every hold frame". Every hold frame (1/30 s steps over
data-hero-phase "hold") is compared with K1 inside the junction window; the window is where the break table draws
when the break is forced open (setFlatten jointBreak 1), so the location comes from the shipped table, not a typed box.
Must-fail: the forced-open frame, read by the same instrument, must read paper above 0.
The other 3 red rows (the prior / nofarside / terminals known-bad controls) are run and reported, not touched.

## 2 · assert-pen-field-alloc.mjs, "the carved mark does not COME APART"
Its 4 specks are a grid line at luma 203, under the ink cut paper - 45 = 205, and they are in the un-carved frame too.
Rewrite: the ink cut goes below the grid's luma (measured per frame off the histogram, not typed), and only specks in
the carved frame that are NOT in the un-carved one count. Must-fail: a stroke split by a 2 px gap must read red.

## Runs
(before / after counts land here with each commit)

### hero-k7-intact (before 4 of 8 rows hold, after 6 of 9)
- Before: the reach row was red, K1 19047 px -> K7 19047 px, 0 gaps, no break table published.
- After: "cuts 0 px at the k junction on every hold frame" PASS, 12 hold frames 12.00-12.37 s, max 0 px. Window: the 2 regions
  the forced break drew (77 px at 447,435 and 60 px at 449,452), padded 13 px; the table opened 1 break.
- Must-fail: forced open reads 137 px, PASS (it fired).
- The 3 old red rows (prior / nofarside / terminals known-bads): all K1 5 -> K7 5. Before they were red on [reach] only, after
  "red: NONE, THIS GATE IS BLIND". They admit +4 / +2 / +0 junctions over the shipped law. Cause, read from these numbers:
  with the return identical, no arm opens a break at K7, so no junction law can sever the mark live and intact holds on all of them.
  Not touched.
- Not checked: I did not open k7-forced.png to confirm by eye that the window sits on the k. That rests on the table
  opening 1 break, which matches 74b0b114's note.

### pen-field-alloc (before 3 of 4 rows hold, after 5 of 6)
- Before: the comes-apart row was red, 12 = 12 comps on both engines, 4 specks (grid at 203 under cut 205).
- After: comes-apart PASS, 7 = 7 comps, 0 new specks, ink cut 150 under grid 203. Must-fail: the 2 px split reads 8 vs 7
  comps on both engines, red, PASS (it fired).
- NEW RED, not hidden: the setFieldRealloc(false) control now fails. The eraser arm's comes-apart row stays green (7 = 7 comps,
  0 new specks, 26012 px against shipped 29404 px). The old control was green only on the grid specks. The GL-storage row
  still catches the eraser (GL 1135x324 against field 1136x294). Next step for a fresh lane: decide whether the
  comes-apart row should also see thinning, or whether this control should require only the storage row. That is a ruling,
  not mine to make here.
