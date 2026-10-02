NOT MERGE-READY

# CLOUD-TRIAGE: the stale red gates, 2026-10-02

Branch `claude/free-stroke-stale-gates-rx4sse` (the session's assigned branch, cut from the snapshot 2cc9e98;
no `cloud/` branch was made). Three gate commits, plus this log. No product code changed. Nothing under
`docs/thinking` or `docs/verification` is committed. The five gates owned by a Claude lane were not opened:
hero-turn, hero-return, hero-hold, hero-options, motion-paste.

Why NOT MERGE-READY: two of the six required Node gates are red in this clone (key-paths, stroke-timing). Both
compare against a pinned commit that this history-less snapshot lacks. I could not show them green here, and no
browser gate was run.

## Steps

| step | commit | gate | verdict | what changed |
|---|---|---|---|---|
| 1 | b3b497f | drawin-pentip | STALE (refactor) | It threw before measuring: it grepped `viewport-3d.tsx` for `setHybridBlend] = useState(0.4)`. The dock layout (ruling 2026-09-26, workspaces on dockable panels) moved that state into `lib/take-transport.ts` `TRANSPORT_DEFAULTS`, and the value is still 0.4. The gate now reads the export and checks that the viewport reads `useTransportSlot(transport, "hybridBlend")`. Must-fails shown firing: blend set to 0.5 throws, and a local `useState(0.4)` in the viewport throws. After the fix it stops at `no capture at docs/verification/pentip/run`, exit 2. The capture needs a browser. |
| 2 | cbbe0f7 | harness-surface | E: STALE, B: REAL | The `_probe-look-ui.mjs` `strokeCount` call that STATUS names is no longer in the tree. Two other rows were red. **E**: the DEAD_ALLOW entry `__revealHarness.schedule` said "RETIRED by a sweep reading it", and `assert-perform.mjs:336` and `assert-hand-clock.mjs:153` read it now, so I removed the entry. That only tightens. Must-fail: with the entry present, E reads STALE (the run before the fix). **B**: not touched, see REAL below. 15/16. |
| 3 | 0ec81e8 | stub-filter | STALE | The retrace `77a44826b` removed the stubs at the source (12 strokes, 0 under the nib), and the 2026-09-25 ruling re-derives the gates on that word. The filter rows (dropped, margin, travel, clock, regularity, letters, and the known-bad matrix) now run on `scripts/capture/logo-strokes.before-2026-09-24.json` with the same bars. New row `shipped-clean`: the live word has 0 polylines under the nib, 12 to 12, 11 letters. Its must-fail is the old trace shipping again (9 stubs), and it fires on every run. 19/19, exit 0 (was 14/17). |
| 4 | this commit | LOG.md | | |

## Every gate on the list

**STALE, rewritten:** drawin-pentip guard (step 1), harness-surface row E (step 2), stub-filter (step 3).

**STALE, already rewritten in this snapshot:** closed-loops. It was re-derived 2026-09-25, keyed by letter, and
the ruling (`docs/rulings/2026-09-25-animation-comes-back.md`, "closed-loops merges now") covers it. I ran it
offline:
- `--offline` row E passes: 4 closed loops of 12 strokes.
- Its must-fail `--trace=...before-2026-09-24.json` fires, exit 1.
- `--selftest` passes 14 of 14.

Rows A to D need a browser and were not run.

**REAL, row not touched:**
- **nib-contrast**, `free-stroke/counterWorst`, 30/31. The "e" of Desk loses its eye in Inflate. Measured:
  - With the round pen (aspect 1), the eye is 298 texels at texel x≈578.
  - With the shipped nib it is 0 texels: 6 enclosed regions become 5.
  - Desk-doodles family: 31/31 rows pass.

  The eye is `scripts/capture/logo-strokes.json` polyline 1 (x 165 to 246), from the retrace in
  `scripts/capture/trace-logo.mjs`. The bar is in `scripts/verify/assert-nib-contrast.mjs:102` (`COUNTER_WORST_MIN = 0.25`).
  The 09-25 ruling's "the e's eye stays parked" is about the Solid line (STATUS:195, `lib/solid-mask.ts`), not
  Inflate's nib, so I read it as not covering this. That reading is a question for him, below.
- **harness-surface row B** (merge order, see decision 5): `scripts/verify/assert-keyed-style.mjs:84-85` calls `__geomDebug.keyedStyle`, but
  `components/viewport-3d.tsx:12683` never publishes it. The viewport also never calls `styleAt` (grep: only
  `lib/keyframes.ts` and `components/key-button.tsx`). So keyframe phase K2's gate is in the tree and K2's
  viewport side is not. Keyframe anything is ruled (2026-09-26), so this is a missing build, not a stale row.

**Browser gates, not run (no browser in this lane). Classified from the code and the 09-25 notes; no row edited,
because a must-fail could not be shown firing:**
- **hero-k7-intact**: STALE on the row "the LIVE beat reaches K7 with the break OPEN"
  (`assert-hero-k7-intact.mjs:533-537`). `74b0b114` made the return identical (`DEFAULT_HERO_MOTION.ret`), so the
  live beat never opens the break. The 09-25 ruling ("the other four merge once their open red is fixed") covers
  the re-derive.
  - Rewrite for a browser lane: the live beat cuts 0 px at the k junction on every hold frame. Must-fail: the
    break forced open, which must read paper above 0.
  - The other 3 red rows have been red since F115. Their cause is UNCLEAR and has not been read.
- **pen-field-alloc**: the instrument is stale and the claim still holds (09-25 nightU: the carve splits nothing).
  - Its 4 "specks" are a grid line at luma 203 under the ink cut `paper - 45` = 205
    (`assert-pen-field-alloc.mjs:77`). The row fails on `shipped.specks > 0` (`:261`), and the same specks are
    in the un-carved frame.
  - Rewrite for a browser lane: count only specks that are in the carved frame and not in the un-carved one, and
    put the ink cut below the grid luma. Must-fail: a stroke split by a 2 px gap.
- **hero-k7-news**: UNCLEAR, question 2.
- **hero-transition**: `docs/RUN-QUEUE.md:7661` reads GREEN on main, 16/16, at 7dd08abb4 (the turn fixes
  8edb488c6, be62c486f). Not run here, so not confirmed on this snapshot.

**Node gates that grade stored evidence, which this snapshot does not carry:**
- **screen-layers**: refuses with "no capture at docs/verification/screen-layers/final/report.json", exit 1, a
  refusal and not a verdict. Per STATUS it is the same red as F115 (Δ 4.760), so this is not a changed verdict.
  A capture needs a browser.
- **eye-white-in-ink, eye-letter-overlap, eye-draw-reads-written, eye-s-shape**: each needs a film folder.
  - Bare, each crashes in this clone on `require('sharp')` before it prints its usage line. `sharp` is not in
    `package.json` (for example `assert-eye-white-in-ink.mjs:47`).
  - With sharp installed in the scratchpad, outside the repo:
    - white-in-ink `--selftest` passes ("SEES the plants").
    - The other three exit 2 with their usage line.
  - UNCLEAR, question 3.

**citations**: UNCLEAR, environment.
- RATCHET: missing 17 -> 68 here, against 17 -> 20 on the Mac (F117: desk-doodles `desktop-strays` copies).
- Most of the 68 point into the sibling repo `~/Desktop/Projects/desk-doodles` (absent here) or into
  `docs/verification` and `docs/thinking` (stripped).
- Nine in-repo files are cited but absent from the snapshot. They may be untracked files on the Mac, which I
  cannot tell from here: `assert-hero-letters.mjs` (cited by `viewport-3d.tsx:3012, 6929, 11779`),
  `scripts/verify/_probe-fusion-coverage.mjs` (x3), `_probe-tipfield.mjs`, `_probe-fusion-builtin-sleep.mjs`,
  `_probe-fusion-animates.mjs`, `assert-pen-kinematics.mjs`, `assert-preset-families.mjs`, `lib/contentHash.ts`,
  `publish.ts`.

## Checks

- **tsc**: 6 errors, the baseline (5 in `lib/geometry-engines.ts`, 1 in `lib/dd-engine/handFeel.ts`).
- **assert-keyframes**: 16 of 16 rows, 21 of 21 mutants.
- **assert-width-keys**: 12 of 12 rows, 9 of 9 mutants.
- **assert-camera-moves**: 11 of 11 rows, 20 of 20 mutants.
- **assert-flip-pose**: 8 of 8 rows, 10 of 10 mutants.
- **assert-key-paths**: 6 of 7 rows, 8 of 8 mutants. The EXISTING row threw `git show 747af8fa0: invalid object
  name`: the snapshot has one commit, so the pinned main is not there. This is the clone, not code. None of my
  commits touch its inputs.
- **assert-stroke-timing**: 0 of 1 rows (RUN). It threw `git archive b0da66626: not a valid object name`, the
  same cause.
- **Edited gates**: stub-filter 19/19, harness-surface 15/16 (B, REAL), drawin-pentip exits 2 for lack of a
  capture once past the fixed guard.
- **Unedited Node gates, as run**: nib-contrast 30/31, citations exit 1 (RATCHET), screen-layers refusal.

## Not run

- Every browser gate: closed-loops rows A to D, hero-k7-news, pen-field-alloc, hero-k7-intact, hero-transition,
  hero-word-legible.
- The drawin-pentip, screen-layers and eye-* verdicts: they need captures or a film.
- key-paths EXISTING and stroke-timing: no pinned commits in this clone.

## Decided here, nothing waits on him

1. **The retrace counts as accepted.** The 09-25 ruling re-derives the gates on the 12-stroke word, so rows
   that only described the old 22-piece trace are stale (stub-filter, step 3).
2. **hero-k7-news is kept, not retired.** Retiring it removes coverage, and that loosens a bar. A browser lane
   re-derives it by the gates PLAN §2 rule (a crossing junction counts two gaps per break). Its must-fail is
   the break forced open at width 0.
3. **The eye checks are film gates.** A browser lane films first and then runs them on that film. `sharp` goes
   into `package.json` in a lane that may change the lockfile; this lane installs with a frozen lockfile.
4. **The missing eye on the "e" of Desk is a defect, and the row stays red.** The fix belongs in the trace
   (`scripts/capture/trace-logo.mjs`, polyline 1), not in the gate.
5. **K2 is not merged, so nothing was lost.** Checked on origin: `cloud/layout-l3` (3bd02a1) has
   `__geomDebug.keyedStyle` in `components/viewport-3d.tsx`; `main` and this snapshot do not. harness-surface
   row B goes green when layout-l3 merges. Until then the gate is in the tree ahead of its code.
