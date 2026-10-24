MERGE-READY

# CLOUD-HANDFIX log, 2026-10-02

Branch `cloud/handfix`, cut from the `integrate/cloud-1001` snapshot (0ad6d79). REVIEW.md, "Review 2: Hand Draw phase 3 and carve", findings 1 to 6 and 8. Finding 7 (CARVE-AA) left alone: the carve shader is untouched. One commit per step, each pushed. Nothing under `docs/thinking` or `docs/verification` is committed. Edits stay in the clock and lift code: `lib/clock-rebase.ts` (new), `lib/stroke-timing.ts`, the clock handlers and clock memo in `app/page.tsx`, and in `components/viewport-3d.tsx` only the `timed` memo, the knockouts beside `liftHoldsKnocked`, and the tip lift hold. No keyed-style code was touched. This file replaces the HAND-DRAW-P3 log that was here.

## Steps

1. **207df9b, finding 1.** The page's clock functions (`clockStrokesFor`, `baseSlotsFor`) move to `lib/clock-rebase.ts`, unchanged, with one entry point, `rebaseForPatch(take, doc, patch, csBefore, csAfter, pace)`, so the handlers run in Node. `edit` rebases every patch that moves the nib (both Thickness sliders, the geometry presets, the dev dials). `handleReprocessed` rebases with the strokes it writes, in the same patch. The clock memo keeps the canvas it stamped with (`clockCsRef`), so a spacing or smoothing reprocess rebases from the resample that played to the one that will.
2. **6d711df, finding 2.** `handleDrawInChange` and `handleRevealWindowChange` call `rebaseForClock` with the next draw-in and the next window and write the take in the same edit, as the preset path does.
3. **e2daf85, finding 3.** `rebasePerformed`'s held-back fix solves the delay from where the walk starts the row before its delay and the clamp (`placeSlots(..., heldFrom)`), so a row clamped at 0 no longer reads as in place. The fuzz found the same clamp on a second walk the review did not report: `withPerformed`'s ripple carry skipped strokes with no row, whose start can clamp too, so a NON-held performed stroke moved (79 cases). It now walks every stroke `placeSlots` walks.
4. **515e80a, finding 4.** A row may carry `lengthMs`, read only where the clock gives the stroke a zero base span. `withPerformed` writes it (speed 1) instead of skipping the row; `placeSlots`, the build, the held-back fix, the ripple carry and the viewport's row copy read it. Back on a clock with a span the row gets a finite speed and drops `lengthMs`. `assert-stroke-timing`'s "speed read as 1" mutant moved with the line it sabotages (same sabotage, same rows).
5. **840bce7, finding 5.** `paceFromCurve` digests its table into `TimingPace.sig`; `buildTimedSchedule` puts it in `TimedSchedule.sig`, the key of the tip bake, its lifts and the triangle keys, so a pace-only change rebuilds all three.
6. **39e152e, finding 6.** The frame loop holds both edges through `heldAtLift`: the leading edge (`tu.d`) as before and now the trailing edge (`tu.w0`), the one Vanish moves.
7. **0730166, finding 8.** `clockSlotsOf` and `rebaseForPatch` take the transport's pace; the page reads its own store (`TransportRef` inside `TakeTransportProvider`) and hands `rebaseForClock` `modeOverride` and `hybridBlend`.
8. **This commit.** LOG.md, and one comment in `edit` corrected ("four places", not five).

## Checks

| Check | Before (0ad6d79) | After |
|---|---|---|
| `tsc --noEmit` | 6 errors | 6 errors (same six) |
| `assert-handfix.mjs` (new, Node) | n/a | 18 of 18 rows, 17 of 17 must-fails caught |
| `assert-handfix-browser.mjs` (new) | n/a | 2 of 2 rows, 2 of 2 must-fails fired, 0 page errors |
| `assert-stroke-timing.mjs` (Node) | 16 of 16, 12 of 12 | 16 of 16, 12 of 12 |
| `assert-hand-clock.mjs` (browser) | 9 of 13 green, 11 of 13 must-fails | 9 of 13 green, 11 of 13 must-fails (same rows) |
| `assert-handfeel.mjs` (browser) | 8 pass, 0 fail | 8 pass, 0 fail |
| `assert-stroke-timing-browser.mjs` | 7 pass, 1 fail, then crash | 7 pass, 1 fail, then crash (same) |
| `assert-perform.mjs` | REFUSED | REFUSED (same) |

Gate rows, one or more per finding, each with a must-fail shown firing:
- F1: `F1-THICK` (Thickness +14 under Hand: stroke 3's base moves 236.5 ms, its slot stays [4845.847, 6051.738], un-rebased it would land at [4627.059, 5808.202]); `F1-REPROCESS` (spacing 4 to 6 on Hand and Recorded, smoothing off on Hand); wiring `W1-EDIT`, `W1-REPROCESS`, `W1-CS`.
- F2: `F2-DRAWIN` (overlap 0 to 0.3, Natural and Hand), `F2-WINDOW` (Grow to Travel, Natural and Hand); wiring `W2-DRAWIN`, `W2-WINDOW`.
- F3: `F3-REVIEW` (the review's input stays at [1100, 1700]); `F3-FUZZ` (14,582 seeded takes, 21,055 performed strokes checked, 0 moved); `F3-BEFORE`, the must-fail on the real code: the same takes on 0ad6d79's `rebasePerformed` move 229 performed strokes (150 held back, 79 not), every one on a take where `placeSlots` clamps a start at 0. Mutants: the old held-back formula (red F3-REVIEW, F3-FUZZ), the old ripple carry (red F3-FUZZ).
- F4: `F4-ZERO` (the review's [0,1000,1000,2000] to [0,500,900,900] and back, in sequence and held back: the slot stays [1000, 2000] on both clocks, speed 1 both ways; performed straight onto the zero span builds with 0 rejections).
- F5: `F5-PACEKEY` (six pace-only changes on two clocks change the key; the rebuilt lifts hold 0 ms of ink, the stale Grow lifts 2860 ms under Travel); browser `B5` (Authentic, blend and Travel rekey the live take; after Grow to Travel the bake's lifts equal a fresh page's; must-fail `timed-sig-no-pace` keeps the Grow lifts).
- F6: `F6-TRAIL` (88 of 88 in-lift edges held under Vanish, ink between lifts untouched), `W6-TRAIL`; browser `B6` (Inflate, Hand, Vanish, one +1 ms row: 0 px change in all 10 lifts of 50 ms or more, controls 134 to 699 px; must-fail `tip-no-trail-liftholds` creeps 33 to 122 px).
- F8: `F8-PACE` (Debug Smooth and blend 0.8, Recorded to Hand: 12 of 12 performed strokes keep their slot; through the document's pace alone one lands 1304.4 ms and 128.6 ms off), `W8-PACE`.

## What I could not run, or ran differently

- **Real Chrome.** `scripts/verify/lib/browser.mjs` pins `channel: "chrome"`; downloading Chrome is blocked by this environment's network policy (dl.google.com, 403). Every browser number above ran on Playwright's bundled Chromium 141, headless (`FS_HEADED=0`), placed at Chrome's path with a symlink, against my own `next dev` servers (:3107 for the before runs, :3108 for the after runs). Not the real GPU the repo's DISPATCH asks for.
- **`jiti` and `sharp`** are imported by `assert-hand-clock` but are not in the lockfile; installed locally, untracked, not committed.
- **`assert-stroke-timing.mjs` IDENTITY base.** Its default base rev b0da66626 is not in this clone (the snapshot is one squashed commit, and no remote branch carries it); run with `STROKE_TIMING_BASE=0ad6d79`, so IDENTITY means "unchanged from this branch's start".
- **The review's fuzz** was not in the repo, so F3's fuzz is mine: same take count (14,582), seeded, wider ranges. It finds 229 failures before the fix where the review found 11; all are the clamp.
- **`assert-hand-clock` R9, R11, R12, R13** fail or crash identically before and after: R9 plays 20 ms short (headless frame pacing), R11 finds no camera move, and R12 crashes because the gate routes only six export modules and this branch's `lib/export/index.ts` imports more (GIF, GLB), which also stops R13 from running. So R13 (the Grow tip hold, whose loop step 6 replaced with `heldAtLift`) was not re-measured; B6 measures the same frame-loop block under Vanish, and the Grow branch is the same loop moved into a function.
- **`assert-stroke-timing-browser`** row 6a needs `docs/verification/stroke-timing/base-1051bc8e1.json`, which is not in the repo, and its export arm crashes on the same export route. **`assert-perform`** refuses without `docs/verification/perform/base-main.json`. Neither was recorded.

## Seen, not fixed (outside this task)

- `readTake` in `lib/doc-store.ts` keeps only delay, speed, ease and hold back, so a reload drops `performed` (and now `lengthMs`): a performed stroke does not survive a reload. Before and after this branch.
- A change to the transport's pace override or blend by itself does not rebase performed rows (finding 8 asked only that the rebase read them).
