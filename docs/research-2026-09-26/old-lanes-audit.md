# Old lanes audit, `~/.fs-lanes/`, 2026-09-26

Read-only. Nothing was deleted, moved, committed or written anywhere except this file.

## The answer

**28 of the 30 `lane*` folders hold nothing that main lacks. 13.8 GB of the 14.0 GB in them is safe to delete.**

- **laneAC holds unmerged work.** It fixed the five Solid diagnostic rows that main still marks `FOUND 2026-08-02, NOT FIXED` at `lib/geometry-engines.ts:5668`. None of that work is in any commit, branch, `refs/lanes/*` or `refs/salvage/*` ref.
- **laneV holds one file that never landed:** `scripts/verify/sweep-browsers.mjs`. On 2026-08-28 main wrote its own version from scratch (commit `2ead54af6`), whose header says *"Measured 2026-08-28: the file did not exist"*. So the job is done in main, and only lane V's own text is left.
- **battery-0828 (11.9 GB), `_salvage-2026-09-04` (0.33 GB) and `_probe` were NOT audited.** I stopped at the context limit before reaching them. A skipped check is not a passed check, so leave all three alone until they have been read.

⚠️ **Do not run the teardown line in `docs/LANES-2026-08-07.md`** (`rm -rf ~/.fs-lanes`). During this audit a new folder, `~/.fs-lanes/hardenA`, appeared. It is a live lane that is not one of the 34 entries audited here. That line would also take out battery-0828 and the salvage folder. Delete by exact folder name only.

The dates in the brief were off. Every `lane*` folder is from **2026-08-07**, the overnight run that `docs/LANES-2026-08-07.md` records, not 08-28 to 09-04. battery-0828's newest file is dated **2026-09-25 20:01**, so something wrote into it yesterday.

## Method, and what it can and cannot see

1. **What I compared.** For each lane, `diff -rq` against the main working tree over `app/ components/ lib/ scripts/ docs/`, leaving out `docs/verification/`. A file counts as differing if its content differs or it exists only in the lane. Files that exist only in main are main's own later work, so they are not counted.
2. **Exact match.** I hashed every differing lane file with `git hash-object` and checked it against every object reachable from `main` and from `--all` (5 heads, 28 `refs/lanes/*`, 2 `refs/salvage/*`, `origin/*`, the stash). Positive control: a current main file and a 2026-07-28 historical version were both found. Negative control: a planted file was not.
3. **Line check.** I built a corpus of every line, with whitespace trimmed, from every blob in all history outside `docs/verification` (3,388 blobs, 636,124 distinct lines of 10 or more characters). A lane line counts as "novel" when it matches no line in that corpus. Control: a planted line was reported novel, and two corpus lines were not.
4. **Who edited what.** Lanes were copied with mtimes preserved, and each lane's `node_modules` symlink carries its dispatch time. A file newer than the dispatch time was edited in the lane. An older file is an untouched copy of the canonical tree at dispatch.
5. **For every lane-edited file with novel lines**, I measured its edit: the lines it has that the previous lane's untouched copy lacks. Then I counted how many of those lines are in git history, or in a later lane's untouched copy, which proves the edit reached the canonical tree that night.

**Classes:**
- **(a) older:** the lane never edited the file. It is a copy of canonical at dispatch, and main has moved past it.
- **(b) in main:** the lane edited the file, and the edit is in main's history, either as the exact blob or as at least 80% of its added lines.
- **(c) nowhere in main:** the lane edited the file, and the edit is in no commit on any ref.

**Blind spots, stated so nobody reads more into this than it holds:**
- Lines under 10 characters are ignored, so a lane edit that changes only a number or a brace is invisible to step 3. It still shows in the exact-hash step.
- `hooks/`, `styles/`, `public/`, `.claude/` and root files were not compared. `docs/verification/` was left out as the brief asked.
- Untouched copies that carry novel lines (about 100 files in each early lane) were spot-checked, not read one by one. Every one I opened was a line canonical changed later: `localhost:3000` became a derived port, and explainer 11's heading was renumbered from `# 10` to `# 11`.

## Table per folder

The differing count is (a) + (b) + (c). Sizes come from `du -sk`. The date is the newest file outside `node_modules` and `.next`.

| folder | size | newest file | differing | (a) | (b) | (c) | verdict |
|---|---|---|---|---|---|---|---|
| laneA | 448 MB | 08-07 04:02 | 267 | 252 | 15 | 0 | SAFE |
| laneB | 456 MB | 08-07 03:16 | 262 | 257 | 5 | 0 | SAFE |
| laneC | 387 MB | 08-07 02:59 | 259 | 255 | 4 | 0 | SAFE |
| laneD | 308 MB | 08-07 02:27 | 262 | 258 | 4 | 0 | SAFE |
| laneE | 602 MB | 08-07 03:07 | 263 | 260 | 3 | 0 | SAFE |
| laneG | 303 MB | 08-07 03:40 | 262 | 257 | 5 | 0 | SAFE |
| laneH | 375 MB | 08-07 04:37 | 260 | 255 | 5 | 0 | SAFE |
| laneI | 408 MB | 08-07 04:35 | 263 | 255 | 8 | 0 | SAFE |
| laneK | 321 MB | 08-07 04:48 | 269 | 266 | 3 | 0 | SAFE |
| laneL | 104 MB | 08-07 05:16 | 267 | 261 | 6 | 0 | SAFE |
| laneM | 371 MB | 08-07 05:28 | 260 | 255 | 5 | 0 | SAFE |
| laneN | 336 MB | 08-07 08:54 | 269 | 255 | 14 | 0 | SAFE |
| laneP | 315 MB | 08-07 08:56 | 262 | 253 | 9 | 0 | SAFE |
| laneQ | 307 MB | 08-07 09:05 | 268 | 264 | 4 | 0 | SAFE |
| laneR | 369 MB | 08-07 09:28 | 269 | 261 | 8 | 0 | SAFE |
| laneS | 385 MB | 08-07 09:28 | 269 | 265 | 4 | 0 | SAFE |
| laneT | 270 MB | 08-07 09:28 | 269 | 265 | 4 | 0 | SAFE |
| laneU | 303 MB | 08-07 09:26 | 268 | 268 | 0 | 0 | SAFE |
| laneV | 92 MB | 08-07 11:47 | 150 | 71 | 78 | 1 | 1 file, rebuilt in main, see below |
| laneW | 93 MB | 08-07 10:03 | 266 | 264 | 2 | 0 | SAFE |
| laneX | 92 MB | 08-07 09:58 | 267 | 264 | 3 | 0 | SAFE |
| laneY | 93 MB | 08-07 09:53 | 268 | 259 | 9 | 0 | SAFE |
| laneZ | 6.8 GB | 08-07 10:26 | 268 | 267 | 1 | 0 | SAFE |
| laneAA | 95 MB | 08-07 11:59 | 270 | 264 | 6 | 0 | SAFE |
| laneAB | 93 MB | 08-07 10:42 | 266 | 264 | 2 | 0 | SAFE |
| **laneAC** | 92 MB | 08-07 12:02 | 268 | 263 | 0 | **5** | **HOLDS UNMERGED WORK** |
| laneAD | 92 MB | 08-07 11:55 | 265 | 263 | 2 | 0 | SAFE |
| laneAE | 92 MB | 08-07 11:59 | 147 | 147 | 0 | 0 | SAFE |
| laneAF | 92 MB | 08-07 11:55 | 147 | 147 | 0 | 0 | SAFE |
| laneAG | 92 MB | 08-07 11:59 | 147 | 147 | 0 | 0 | SAFE |
| battery-0828 | 11.9 GB | 09-25 20:01 | | | | | **NOT AUDITED** |
| _salvage-2026-09-04 | 342 MB | 09-18 00:19 | | | | | **NOT AUDITED** |
| _probe + _probe.md | 16 KB | 08-03 18:17 | | | | | **NOT AUDITED** |

Notes that change nothing in the verdicts:
- **laneZ is 6.8 GB because it holds a full copy of `docs/verification`** (61,398 files). All but 229 of those files are in git.
- **Four lane-edited files that looked unmerged turned out to be in main.** Lanes B and H: the stroke schedule and draw-in. B's `viewport-3d.tsx` edit has 9,695 of its 9,745 added lines in git. Lanes H, M and P hold one identical `lib/stroke-schedule.ts`, and it is an exact blob in main. Lanes C, G and I: `run-battery.mjs` and `run-browser-battery.mjs`, with 52 of 58 and 85 of 90 added lines in git. The rest was later reworded in main. Lanes V, W and AA: `assert-arm-took.mjs`, which main carries as a 1,306-line successor. Its `deriveDrivers()` became `deriveSurfaces()`, `classifyMember()` and `crossCheckSurfaces()`.
- **laneN has a stray `scripts/verify/assert-still-export.mjs.tmp`**, a draft three minutes older than the real file. 279 of its 290 lines are in git.
- **Lane evidence outside git:** each lane's `docs/verification` holds 5,703 PNG, 113 JSON, 74 MP4, 36 log and 21 WebM files that no ref carries. All of it is gate output. None of it is a write-up: those files contain no `.md`, `.mjs` or `.ts`, and only three `.txt` logs in laneV.
- **Root `LANE-STATE.md` files that are not in main:** laneA, laneAC, laneAE, laneB and laneH. They are lane notes, not source. The other 22 lanes' state files are in main's git as exact blobs under `docs/verification/lane-*/`. laneAC's note belongs with its unmerged work.
- Every lane's `node_modules` is a symlink to main's `node_modules`. `rm -rf laneX` removes the link, not the target.

## Every (c) file

### laneAC: "the baseline of six, retired to zero" (5 files)

The lane computes the five Solid well-formedness predicates that `buildMaskSolid` never produced. It rewrites the tsc gate to a baseline of zero and parks the dead `perfect-freehand` import. **Main still has all five as the documented tsc errors**, with the comment *"FOUND 2026-08-02, NOT FIXED"* at `lib/geometry-engines.ts:5668`. `git log --all -S "assert-solid-diagnostics"` returns nothing, and `holeWindings` appears 0 times in main's `lib/solid-mask.ts` against 9 in the lane.

Its own `LANE-STATE.md` leaves "The five computed and wired" unticked, but the source files are dated 11:50 to 12:02, after that note, and they do carry the computation. **Whether it compiles or passes was not checked.** That is his call before anyone lands it.

**1. `~/.fs-lanes/laneAC/lib/solid-mask.ts`.** 170 lines added, 153 of them in no commit.
```
4667:  holeWindings: string[]
4672:  const holeWindings = holes.map((h) => (signedAreaOf(h) > 0 ? "CCW" : "CW"))
4712:  return { holeWindings, anyHoleSelfIntersects, anyHoleOutsideOuter, holesOverlap }
```

**2. `~/.fs-lanes/laneAC/lib/geometry-engines.ts`.** 36 lines added, 36 in no commit.
```
5218:     * WHAT WAS WRONG. `outerSelfIntersects`, `holeWindings`,
5219:     * `anyHoleSelfIntersects`, `anyHoleOutsideOuter` and `holesOverlap` were
5251:    SOLID_DEBUG.holeWindings = result.diagnostics.holeWindings
```

**3. `~/.fs-lanes/laneAC/scripts/verify/assert-solid-diagnostics.mjs`.** A new gate that exists only in this lane. 201 lines, 179 in no commit.
```
1: // ASSERT-SOLID-DIAGNOSTICS — the five Solid well-formedness rows are REAL.
5: // From the day they were written until 2026-08-07, five rows on the Solid
6: // diagnostics panel reported good news off a value nobody had measured.
```

**4. `~/.fs-lanes/laneAC/scripts/verify/assert-tsc-baseline.mjs`.** 195 lines added, 188 in no commit.
```
1: // ASSERT-TSC-BASELINE — the typecheck is CLEAN, and it actually looked.
3: // ── THE BASELINE IS ZERO. THAT IS NEW, AND THIS FILE IS MOSTLY ITS HISTORY ──
5: // From 2026-08-02 to 2026-08-07 the baseline was SIX, and this gate's whole job
```

**5. `~/.fs-lanes/laneAC/lib/dd-engine/handFeel.ts`.** 58 lines added, 56 in no commit.
```
16: // 🔴 CORRECTION, 2026-08-07 — THE SECOND BULLET ABOVE IS FALSE, AND IS LEFT
17: // STANDING BECAUSE THE RECORD OF WHAT WAS INTENDED IS WORTH KEEPING.
18: // 'perfect-freehand' was NEVER added. Measured this date, four ways: it is
```

### laneV: one file, whose job main has since rebuilt

**`~/.fs-lanes/laneV/scripts/verify/sweep-browsers.mjs`.** 196 lines, 173 in no commit. Main's file of the same name, 226 lines, was written fresh on 2026-08-28 in `2ead54af6` because lane V's never arrived. It covers the same two channels: the registry record and the `--fs-browser` marker. Main also records two lessons lane V's version lacks.
```
1: // SWEEP-BROWSERS — find, and only then kill, the Chromes this repo left behind.
4: // 2026-08-07, ~09:00: **93 orphaned Chrome processes, 4h48m old, spawned ~20 s
12: // `lib/browser.mjs` closes what it opened on exit, SIGINT/SIGTERM/SIGHUP, an
```
The one thing only lane V has is its kill-path table: throw, reject, SIGTERM, exit and `kill -9` measured against a fake browser. My read is that laneV is safe once that table has been looked at.

## What is safe, in GB

| | size |
|---|---|
| All 30 `lane*` folders | 14.0 GB |
| **Safe now: 28 lanes, leaving out laneAC and laneV** | **13.8 GB** |
| Also safe if laneV's superseded file is accepted | 13.9 GB |
| Held: laneAC | 92 MB |
| Not audited: battery-0828, `_salvage-2026-09-04`, `_probe` | 12.2 GB |

Nearly all of the space he could get back is in two folders. laneZ is 6.8 GB, and it is safe. battery-0828 is 11.9 GB, and it has not been read yet.

## Left for the next lane

battery-0828: sort its 650 uncommitted changes by what they are, gate evidence under `docs/verification` or edits to source. Then run the same check over `_salvage-2026-09-04` and `_probe`. Everything under `~/.fs-lanes/hardenA` is off limits because it is live.

## Saved into git, 2026-09-26

Every file this audit found in no ref is now in git at `refs/salvage/lanes-2026-08-07`: laneAC's 5 source files at their own paths, the 5 root `LANE-STATE.md` notes, and laneV's `sweep-browsers.mjs`, both of the latter under `docs/salvage-2026-08-07/`. Written straight from the lane files into objects with a temporary index, so no lane folder, index or checkout changed. Two blobs compared byte for byte against the lane files: same. The parent is `9f4c23e23`, the last main commit before the lanes' 10:28 dispatch, so the ref's diff against its parent also carries main's own work from 07-28 to 08-07. Read the files, not the diff. Nothing in the ref was built or run.

With that ref in place, all 30 `lane*` folders hold nothing outside git except gate output under `docs/verification/`. battery-0828, `_salvage-2026-09-04` and `_probe` are still unaudited.

## The three folders the first pass skipped, 2026-09-26

Read-only, same rules as above: nothing deleted, moved, fetched or committed. Every `git` call ran with `GIT_OPTIONAL_LOCKS=0`, so no `git status` here rewrote an index.

### Verdicts

| folder | du | verdict | would free |
|---|---|---|---|
| battery-0828 | 11.88 GB | **HOLDS UNMERGED WORK**: lane N4's F11 report, which main's ledger cites at this path | up to 11.9 GB, less whatever APFS still shares with main |
| _salvage-2026-09-04 | 0.33 GB | **HOLDS UNMERGED WORK**, by design: 608 of its 6,298 files are in no ref, and its README says keep it | 0.33 GB, once its contents are in git |
| _probe + _probe.md | 16 KB | **SAFE**: all 3 files are exact blobs in main | 16 KB |

None of the three is IN USE. `lsof` matched 0 of 20,981 open-file lines for any of them. Control: the same run shows 1,991 lines under main's repo path, so `lsof` can see this user's processes.

With this pass every folder in `~/.fs-lanes` has been read except the live `hardenA` and `hardenB`.

### Method, and the controls that ran first

The exact-blob check from step 2 above, run from `~/Desktop/Projects/free-stroke`. The object set is `git rev-list --objects --all`: 101,574 objects across 5 heads, 28 `refs/lanes/*`, 3 `refs/salvage/*` (`laneD3`, `stash-2026-07-29` and the new `lanes-2026-08-07`), `origin/*` and `refs/stash`. Controls, run before any result was read:
- Found: battery's unmodified `package.json`; `package.json` as of 07-28 commit `a6c001cb`; laneAC's `handFeel.ts`, which only `refs/salvage/lanes-2026-08-07` carries; a file only `refs/salvage/laneD3` carries.
- Not found: a planted random file, and `package.json` with one byte appended.
- Battery's 739 files hashed from main and from inside battery gave identical hashes. Neither repo has a `.gitattributes`.

For a file that misses as an exact blob, a line check: every trimmed line of 10 or more characters, against every line of every `.md .txt .mjs .ts .tsx .log .sh .py .js .css` blob in any main ref (3,872 blobs, 311,073 distinct lines). Controls: a committed main script reads 0 of 173 lines novel, and a planted line reads 1 of 1.

### battery-0828

**A full clone, not a worktree.** Its own `.git` is 3.2 GB in 3 packs, with no alternates, and origin is `github.com/SXM4434/free-stroke`. `docs/RUN-QUEUE.md:178` records it as lane N4's "frozen APFS clone at HEAD" `6eb76ae6`, served on :3106 on 2026-08-28.

**Commits: nothing main lacks.** All 320 commits reachable from its refs and reflogs are in main's `--all`. Branches: `v0/sebastianmmdesign-3308-12049aa9` at `6eb76ae6` (HEAD), `main` and four `worktree-agent-*` branches at `a6c001cb`, `origin/v0/...` at `ea9a004b`. Its one stash, `71ebbace`, is main's `refs/stash` and `refs/salvage/stash-2026-07-29`. `git fsck --connectivity-only --dangling` found no dangling commit and 3 dangling blobs. One is reachable in main. The other two, an older `docs/LANE-OUTCOMES.md` and an older `docs/thinking/2026-08-25.md`, have 0 of 10 and 0 of 19 lines missing from main's history of those files. `.git/lost-found/commit` names 6 commits from 07-29 whose objects no longer exist. Main's own `.git/lost-found` holds the same 6 names, also without objects, so this copy loses nothing there.

**Uncommitted: 780 status lines.** 41 deletions, 609 modified, 130 untracked.
- The 41 deleted files are in HEAD `6eb76ae6`, which main has.
- 92 of the 739 modified or untracked files are exact blobs in main.
- 645 are under `docs/verification/battery-2026-08-28/`: 547 PNG, 67 log, 19 JSON, 4 WebM, 3 MP4, 3 `.start` timestamps, `rerun/SUMMARY.txt` and `REPORT.md`. All gate output except the report.
- 2 are `.md` files outside verification. No `.ts`, `.tsx` or `.mjs` file differs from HEAD at all.
- Gitignored, outside build output and verification: 12 files, all byte-identical to main's working tree. Gitignored under `docs/verification`: 229, which are 217 PNG, 11 `.raw` and one `.gitignore`.

**Every file in no ref that is not gate output:**

1. **`docs/verification/battery-2026-08-28/REPORT.md`**, 200 lines, 08-28 03:03. Lane N4's F11 report. 143 of its 149 lines are in no ref, and no commit carries its title. Main's `docs/RUN-QUEUE.md:843` sends readers to this exact path, so deleting the folder deletes the ledger's only source for F11. The path says verification; the file is a write-up.
```
1: # F11 · The battery's real state at `6eb76ae6`
3: Lane N4, 2026-08-28, in a frozen APFS clone at `/Users/sebs/.fs-lanes/battery-0828`, served on `:3106`.
8: **88 of 100 gates ran clean. Zero of 100 were shown able to fail.**
```
2. **`docs/LANE-OUTCOMES.md`**, 383 lines, 08-28 03:04. The hook-written log of subagent stops. 211 of 260 lines are in no ref: 184 stop entries from 08-28 01:28 to 03:04, every one reading "(no description)", and 27 "last line" quotes of the controller's closing sentence. Nothing authored. Main's copy is now 1,113 lines.
```
16: - **2026-08-28T01:28:27-04:00** · `a3ae2bb5f49dd9923` · (no description)
18: - **2026-08-28T01:28:58-04:00** · `a8d5418978f66b80c` · (no description)
20: - **2026-08-28T01:29:29-04:00** · `a938ad8c69daaa282` · (no description)
```
3. **`docs/thinking/2026-08-28.md`**, 94 lines, 08-28 01:20. Not an exact blob, but 0 of its 34 checked lines are missing from main's history of the same file, so main has all of it.
```
3:Verbatim, captured at submit time, with the media he sent alongside.
5:`/done` reads this and writes the rulings into `docs/rulings/`.
8:## 01:15 · `18af58af` · `v0/sebastianmmdesign-3308-12049aa9`
```

`rerun/SUMMARY.txt` is six lines of gate exit codes from 02:40, gate output, but it belongs with the report.

**What wrote into it on 2026-09-25: only `.git/index`, at 20:01:40.** The 20 newest files by mtime are that index, then 19 `.next/dev` files from 08-28 03:04 to 03:05, when N4's dev server went quiet. No working-tree file changed after 08-28 03:05. A rewritten index with nothing else touched is what a plain `git status` leaves when it refreshes stat data. This audit's git calls did not do it: the index still read 20:01:40 after them. The process that ran it was not identified. Main's commits between 19:30 and 20:30 that evening are all F118 ANIM-1C work, and none of them touches this folder. The `.next/dev` directory itself is dated 09-04 17:02, when an entry was removed from it; no file inside is newer than 08-28.

**Size.** 11.88 GB by `du`: `docs/verification` 6.7 GB, `.git` 3.2 GB, `node_modules` 1.3 GB (a real directory here, not a symlink like the 08-07 lanes'), `.next` 510 MB. The folder began as an APFS clone, and deleting a clone frees only the blocks it no longer shares with main. 11.9 GB is the ceiling. The real figure was not measured.

**What makes it SAFE:** `REPORT.md` and `rerun/SUMMARY.txt` in git, the way `refs/salvage/lanes-2026-08-07` was written, and `RUN-QUEUE.md:843` pointed at the new home. After that, what is left is gate output and a hook log.

### _salvage-2026-09-04

**The folder is itself the salvage.** Its README, written 2026-09-18, opens: *"Keep this folder. It is what makes the eleven lanes beside it safe to delete."* Those eleven lanes are no longer in `~/.fs-lanes`, so this folder is the only copy of what it holds.

6,298 files, no symlinks. 5,690 are exact blobs in main. **608 are in no ref:**
- 574 gate output under `docs/verification/`: 469 PNG, 40 JSON, 36 log, 17 MP4, 12 WebM. laneE3's three `elbow-nib*` files, which the README calls the evidence for F91, the nib decision, are in no ref.
- 34 outside it: 21 `.mjs`, 5 `.md`, 4 logs, `HANDOFF.json`, `MANIFEST.tsv`, a `tsconfig.tsbuildinfo` and a `.seen-artifacts-*` marker.

The 27 authored files in no ref, with lines missing from every main ref, over lines checked:

| file | novel | README's ruling |
|---|---|---|
| laneC2/_mask.mjs, _mask2.mjs | 16/25, 29/39 | root probe scripts, a record |
| laneC2/_probe-expiry.mjs, _probe-inkfloor.mjs, _probe-pulse.mjs | 93/109, 80/97, 47/53 | probes, a record |
| laneC2/scripts/verify/assert-screen-layers.mjs | 6/483 | older, repeats the "7.6x" claim `d076588b` corrected; do not land |
| laneC3/HANDOFF.json | 101/101 | lane root file |
| laneD1/scripts/verify/assert-carve-graze.mjs | 2/262 | two lines of comment wording |
| laneD3/.claude/skills/storyboarding/SKILL.md | 19/183 | not ruled |
| laneD3/docs/STATUS.md | 8/83 | not ruled |
| laneD3/docs/LANE-OUTCOMES.md | 0/581 | main has every line |
| laneD3/docs/thinking/2026-09-04.md | 0/36 | main has every line |
| laneD3/scripts/verify/assert-fusion-authoring.mjs | 223/1059 | unfinished fix that HEAD's `inkDelta` rewrite covers |
| laneE1/scripts/verify/_probe-e1-ascii, -bisect, -eye, -iso, -mode, -rest, -window `.mjs` | 41/79, 41/69, 82/151, 41/90, 38/76, 81/125, 41/107 | probes, a record |
| laneE1/ and laneE2/scripts/verify/_probe-elbow-nib.mjs | 9/17 each | probes, a record |
| laneE2/_derive.mjs, _measure-extent.mjs, _probe-fixture.mjs, _sheet.mjs | 43/48, 43/70, 14/25, 26/32 | root probe scripts, a record |
| README.md | 35/35 | the folder's own index |

The README already ruled that nothing here should land. The verdict stays HOLDS UNMERGED WORK because deleting the folder deletes the only copy of F91's captures and 18 probe scripts. **What makes it SAFE:** its 608 files written into a `refs/salvage/*` ref.

### _probe and _probe.md

**SAFE.** Three files, each an exact blob in main's history:
- `_probe.md`, 7,834 bytes, 08-03: a version of `docs/DISPATCH.md`.
- `_probe/hooks/use-mobile.ts`: a version of `components/ui/use-mobile.tsx`.
- `_probe/hooks/use-toast.ts`: a version of `components/ui/use-toast.ts`.

### What this pass could not see

- **APFS sharing.** `du` counts battery-0828's logical size. How much of it is still shared with main was not measured.
- **`lsof` sees this user's processes only.** A root process holding a file would not show.
- **battery's `node_modules` and `.next` were not compared.** Both are build output and regenerate.
- **The line check** ignores lines under 10 characters and reads only the text extensions listed above.
- **The 09-25 index refresh** is dated, not attributed.

**Landed after this section was written:** battery-0828's `docs/verification/battery-2026-08-28/REPORT.md` (lane N4's F11 report) is now in main at the same path, byte-identical to the lane copy. `RUN-QUEUE.md:843` still names the lane folder's copy, so after battery-0828 is deleted, main's copy is the one to read. Nothing else in battery-0828 is outside git except gate output and the hook log `docs/LANE-OUTCOMES.md`.
