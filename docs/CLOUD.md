# Working in a Claude Code cloud session

github.com/SXM4434/free-stroke is public. This branch carries `docs/thinking` (his own messages) and 8 GB of gate evidence in `docs/verification`, so it is never pushed as is. `.githooks/pre-push` refuses any push to the public repo whose history touches `docs/thinking`.

**To give the cloud the code:** push a snapshot, a single commit of the current tree without `docs/thinking`, `docs/verification` and the transcript dumps under `docs/research-2026-09-25/animation-asks/`, to its own branch, `cloud/<phase>`. Start `claude --cloud` from a shallow clone of that branch.

**To bring the work back:** `claude --teleport <session>`, then cherry-pick the cloud's commits onto the local branch. The snapshot tree equals the local tree outside the excluded folders, so the patches apply as they are. Run the browser gates here before anything lands; the cloud has no browser.
