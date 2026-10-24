DONE

CX-PORT-LAYOUT, 2026-10-02

## Port

1. Plan: 33031982e.
2. e77bdae0f -> 6f6aca2bf. The Scene parameter conflict kept the current tip highlight and added preview fitting. TypeScript: 6 errors, the existing baseline.
3. 8c1b39339 -> f540dec45. TypeScript: 6 errors, the same baseline.

The union of cloud touched paths equals the union of port touched paths: 9 of 9. `git diff --check HEAD~2 HEAD` passed. Both port commits carry their source commit in the cherry-pick trailer. The cloud ref's LOG.md describes a different Hand Draw session; its bytes are saved at `docs/cloud-handoffs/layout-LOG.md`.

## Node gates

| Gate | Rows | Must-fails |
| --- | ---: | ---: |
| assert-drawin-extras-node | 26/26 | 40/40 |
| assert-fusion-chaos | 10/10 | 20/20 |
| assert-stroke-timing | 16/16 | 12/12 |
| assert-key-paths | 7/7 | 8/8 |
| assert-keyframes | 16/16 | 21/21 |
| assert-export-formats | 3/3 | 9/9 |
| assert-style-contracts | 44/44 assertions | included |
| assert-strip-recorded | 6/6 | included |
| assert-camera-moves | 11/11 | 20/20 |

## Browser gates

`assert-maximize` and `assert-dock-panels`: not run. The job explicitly says "No browser in this job." Both layout gates require a browser. No browser was launched from this checkout. The shared browser reservation attempt did not acquire a slot; its queue ticket disappeared while its waiter was alive, and I stopped the exact waiter PIDs.

The local dev server on port 3197 served this checkout: its served `app/page.js` contained `PREVIEW_FIT_MARGIN_PX` and `previewNoFit`. The first Turbopack start served 404 after Watchpack exhausted file watchers; the polling Webpack restart served HTTP 200. I stopped the exact server and child PIDs and removed `.next`. `docs/verification` is absent from this sparse checkout; `git checkout -q -- docs/verification` had no matching worktree path, and `git status` shows no changes there.

Codex-Run: CX-PORT-LAYOUT
