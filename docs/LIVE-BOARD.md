# Free Stroke live board, 2026-10-03: PAUSED for his interview slides

One read for a resume. The ledger with the detail is `docs/RUN-QUEUE.md` (newest rows at the end).

## Goal right now

Finish the product on `integrate/cloud-1001` (head `ef04da2a8`, tsc 6), get its browser gates green, show him the panels, merge to main on his word. Main (`v0/sebastianmmdesign-3308-12049aa9`, his server on :3000) stays untouched until then.

## Where the work lives since 2026-10-09

The lane clones under `~/.fs-lanes` were removed on 10-09 to free disk. Every commit was checked reachable in this repo first, and uncommitted edits were saved to `~/lane-evidence/2026-10-09/fs-lanes/<lane>/`.

- **The integrate head `ef04da2a8` has no branch pointing at it.** This repo's `integrate/cloud-1001` is still at `20631eef4`, behind it. The merge gate refused the fast-forward. Recreate the clone from `ef04da2a8` (`git clone --local`, then `git checkout -b integrate/cloud-1001 ef04da2a8`), because `scripts/cloud/merge-back.sh` still defaults `MB_TARGET` to `~/.fs-lanes/integrate`, which no longer exists.
- The Timeline fix plan: `refs/lane-archive/fs-lanes/cl-docs/heads/claude/tlover` (`559d7f396`).
- The diamonds fix: `refs/lane-archive/fs-lanes/cx-greyrows/heads/codex/diamonds` (`38ad409fc`, with `77c82a3dd` under it).
- The panels sheet branch: `refs/lane-archive/fs-lanes/cl-docs/heads/claude/panels` (`f6ea6cbbd`).

## How work is split (his rulings tonight)

- Claude and Codex share the work evenly, several agents on each at once, each job one small item.
- Codex runs a smaller share until it resets Fri Oct 9 17:11 (about 11% left on 10-03): fewer, smaller jobs, Claude takes the bigger share, model and effort named in every report. Codex does code, tests and tooling: `-m gpt-6-sol` at medium for builds, `gpt-6-luna` for reads and reviews, high only for a hard job, Astra never without his yes. Prompts and replies: scratchpad `cx2/`; shared rules: `cx2/rules.txt`.
- Codex cannot launch Chrome. Free Stroke's 3D browser gates run from ONE Claude lane at a time on the normal launch path (Google Chrome 154 with Metal), because the shared slots on :9301 and :9302 run Chrome for Testing 151 without Metal and cannot match main's evidence.
- Claude cloud sessions spend Claude usage too.
- When either side nears 80% of its week, remaining lanes switch to his interview slides (portfolio session).

## Paused

His call, 2026-10-03: the remaining usage goes to his interview slides (Monday 2026-10-05). No new Free Stroke lanes or Codex jobs until he says so. Where it stopped is the last RUN-QUEUE row (integrate head ef04da2a8, tsc 6, Node gates green; two product defects found by the renders: the Timeline drawn over panels with a planned fix in claude/tlover, and the draw-in key diamonds with a fix on codex/diamonds, both unmerged).

## Waiting on him

- The e's eye in Inflate: raise 4, drop 6.5, or keep the shipped e. Renders at 1x done; the sheet (top row default engine, bottom row Free Stroke; shipped, drop, level, raise) is `scratchpad eye-render-work/view-8x-e.png`, opened for him. Level is out (it fuses the e into the D).
- Codex cloud needs an environment for the repo at chatgpt.com/codex (one time, his browser).
- Two orphaned gate Chromes from Sep 29 (pids 87685, 92904): auto mode would not let me stop them.
- What is left in `~/.fs-lanes` after the 10-09 removal, about 10 GB of folders that were never git clones (laneA to laneAG, `_salvage-2026-09-04`, `_probe`, the old logs): his "delete them". Nothing there is proven saved anywhere else.

## Known reds on the branch

- harness-surface row B and keyed style in the view: CLOUD-K2LIVE.
- hand-clock R11 and draw-in's two-phase gate: CL-HANDCLOCKV now. Browser rows owed: perform 1b, 1c, 8 and drawin-timing (flakes port), eraser and blind hero controls, APNG fallback, Customize box sub-pixel offset.
- carve-graze f224 (documented); export REPRODUCIBLE 1 to 6 edge px (GPU, on main too, closed).
