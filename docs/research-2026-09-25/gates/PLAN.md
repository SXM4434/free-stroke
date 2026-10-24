# Gates plan, #6: the five gates to re-derive

**Status: PARTIAL.** The lane hit its 150k context line before it opened the five gate files. Everything below
comes from `docs/verification/night-u/UNKNOWNS.md`, which ran each gate alone on main and with the old trace
swapped in, and from the one gate line it quotes. Step 1, "read the gate", is NOT done for any of the five.
A fresh lane must read each gate before a single rule here is used. No gate was edited.

The new facts every rule has to match: the word is 12 strokes (was 22 pieces, `77a44826b`), one per letter,
both "e"s crossbar first; the k joint break is off in the live beat and `DEFAULT_HERO_MOTION.ret` is
`identical` (`lib/hero-motion.ts:1681`, `74b0b1147`).

Every rule below follows `silent-degradation`: a must-fail control that proves the instrument can see the
defect, a must-pass control that proves it does not cry wolf, and a denominator.

## 1. assert-closed-loops

**Now.** Red on one row, the KNOWN-BAD "reproduces the SHIPPED gaps". The gate hardcodes the old trace's gaps
by stroke index, `SHIPPED_OPEN_GAPS = { 0: 26.15, 6: 22.77, 7: 29.99 }`
(`scripts/verify/assert-closed-loops.mjs:72`). Old trace on main: green.

**Re-derived rule.** Key the table by letter and loop, not by stroke index, so the next retrace cannot break it
the same way. For the 12-stroke word, measure each closed-loop letter's open gap on main once (the letters with
bowls: e, o, d, the loop of D if it closes), write that table, and assert that the shipped word reproduces it
within the gate's existing tolerance.
- Must fail: the old trace file (`logo-strokes.before-2026-09-24.json`) against the new table. It has different
  gaps, so the row must go red. Also: one loop's end point moved by the gate's tolerance plus 1 px.
- Must pass: current `logo-strokes.json`, run twice, same verdict.
- Denominator: every closed-loop letter in the word, named, with a count.

**Kind of change.** Mostly a data update (a new gap table). Keying by letter instead of stroke index is a small
change to what the row means: it stops asserting "stroke 6 has this gap" and asserts "the e bowl has this
gap". I think that is the meaning the gate always wanted, but it is his call.

## 2. assert-hero-k7-news

**Now.** Red on "K7 IS MEASURABLY DIFFERENT FROM K1". With the break forced open, the k arm over the stem makes
two gaps of paper for one break, cut ratio 0.56 against a window of 0.6 to 1.4. The gate assumes one break is
one gap, which held for the old word only. Since `74b0b114` the live beat never opens the break.

**Re-derived rule, if the break might come back.** Count gaps per break from the junction's geometry: a
crossing junction (arm over stem) gives two, a T gives one. Expected ratio = measured paper / (breaks x gaps
per break x the old per-gap reference).
- Must fail: break forced open with its width set to 0.
- Must pass: break forced open at its design width on the 12-stroke word.

**Recommendation: retire it while the break stays off.** The gate tests a channel nothing ships. Keeping a
gate green on a forced-open path the product never takes is a gate that cannot see the product. If he turns the
break back on, re-derive it by the rule above.

**Kind of change.** Retiring changes what the battery covers. Re-deriving changes what the gate means (one gap
per break becomes gaps per junction type), not only its data.

## 3. assert-hero-k7-intact

**Now.** Red on four rows. Three are KNOWN-BAD controls that were already red at F115 and on 09-24; the
retrace is not the cause (still four red with the old trace). The new row, "the LIVE beat reaches K7 with the
break OPEN", reads 0 px removed because `ret` is now `identical` by design.

**Re-derived rule.** Invert the live-beat row: the LIVE beat reaches K7 with ZERO paper cut at the k junction
across the whole hold, which matches the 0 of 161 white-in-ink hold frames STATUS reports.
- Must fail: the break forced open on the live beat (the old `changed` return). Must read paper above 0.
- Must pass: the shipped beat, 0 px removed, every hold frame.
- The three old KNOWN-BAD rows: read each to find out why it was red at F115 before touching it. They may be
  controls that are meant to be red and are reported wrong, or real misses. Unknown until the gate is read.
- Denominator: hold frames counted, not sampled.

**Kind of change.** Changes what the gate means. It stops guarding "the return changes the word" and starts
guarding "the return leaves the word intact". That is the design he chose, so the new meaning matches the
product, but it is a new meaning.

## 4. assert-pen-field-alloc

**Now.** Red on "the carved mark does not COME APART". It is not the carve. The four specks are one horizontal
grid line at stage y=931, luma 203; the gate's ink cut is `paper - 45` = 205, so the grid line counts as ink.
The same four specks sit in the un-carved frame, so the carve split nothing. The row fails on
`shipped.specks > 0` alone.

**Re-derived rule.** Two changes, both to the instrument:
1. Compare carved against un-carved: fail only on specks present in the carved frame and absent from the
   un-carved one. A shared speck is the page, not the carve.
2. Set the ink cut from the measured frame, below the darkest non-ink thing on the stage (grid line at 203)
   with a margin, or mask the grid rows out. Record the cut and the grid luma in the log so the next framing
   change shows up.
- Must fail: a carve with one stroke deliberately split by a 2 px gap. It must report a speck the un-carved
  frame lacks.
- Must pass: the current carved word, 0 new specks, and the old trace, 0 new specks.
- Also measure what UNKNOWNS did not: the grid line's luma under the old trace, so the claim that the framing
  moved a darker line into the stage is measured, not inferred.

**Kind of change.** An instrument fix. The rule it guards, "carving does not break the mark", stays the same; the
gate starts measuring that instead of the grid.

## 5. assert-drawin-pentip, the parked-prior control

**Now.** Red, DECISIVE `free-stroke-off`: margin 0.1745 w against an IQR of 0.1992 w, reproduced to four
decimals on a fresh capture. The `off` arm is the parked prior, a control, not the shipped tip. On the 12-stroke
word it keeps 25 playheads, not 35, and its median moves from 0.43 w to 0.33 w, inside its own spread. The
shipped arm still reads NIB decisively, 1.0131 w against 0.2042. With the old trace, DECISIVE passes and the gate
falls back to its F115 red, "the PARKED PRIOR still reads as a CUT", pen score 1.346.

**Re-derived rule.** Recalibrate the parked prior on the 12-stroke word: re-measure the off arm's median and IQR,
and require the margin between shipped and off to exceed the off arm's IQR by the same factor the gate used on
the old word. Keep the playhead count as a floor and log it, since fewer strokes means fewer playheads.
- Must fail: the shipped arm replaced by the off arm (the two arms equal). Margin must collapse.
- Must pass: shipped against off on the new word, and the verdict stable across two fresh captures.
- Denominator: playheads per arm, both printed.

**Kind of change.** A data update to the calibration. It becomes a change of meaning only if he decides the
`off` arm no longer earns its place; then the control goes and the gate asserts the shipped tip against a fixed
threshold instead. That call is his.

## Summary table

| gate | what broke it | re-derive as | data or meaning |
|---|---|---|---|
| closed-loops | gap table keyed to old stroke numbers | per-letter gap table on the 12-stroke word | data, plus a small key change |
| hero-k7-news | one break is two gaps on the new k | retire while the break is off | retire, or meaning if kept |
| hero-k7-intact | live-beat row expects a break that was removed | live beat must cut 0 px at K7 | meaning |
| pen-field-alloc | ink cut 2 luma above a grid line | carved against un-carved, ink cut below the grid | instrument, same meaning |
| drawin-pentip | parked prior calibrated on the old word | recalibrate the off arm on 12 strokes | data |

## Not checked

- None of the five gate files was opened. Line numbers other than `assert-closed-loops.mjs:72` and
  `lib/hero-motion.ts:1681` come from UNKNOWNS.md, not from my reading.
- The three KNOWN-BAD rows of hero-k7-intact: why they were red at F115 is unknown.
- The letters in the word that carry closed loops were not listed from the trace file.
- No gate was run by this lane.
