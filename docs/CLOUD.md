# Working in a Claude Code cloud session

github.com/SXM4434/free-stroke is public. This branch carries `docs/thinking` (his own messages) and 8 GB of gate evidence in `docs/verification`, so it is never pushed as is. `.githooks/pre-push` refuses any push to the public repo whose history touches `docs/thinking`.

**To give the cloud the code:** push a snapshot, a single commit of the current tree without `docs/thinking`, `docs/verification` and the transcript dumps under `docs/research-2026-09-25/animation-asks/`, to its own branch, `cloud/<phase>`. Start `claude --cloud` from a shallow clone of that branch.

**To bring the work back:** `claude --teleport <session>`, then cherry-pick the cloud's commits onto the local branch. The snapshot tree equals the local tree outside the excluded folders, so the patches apply as they are. Run the browser gates here before anything lands; the cloud has no browser.

## The tools

- `scripts/cloud/snapshot.sh <name> <source-ref> [lane-commit]` builds and pushes the snapshot and clones it. Every default (repo, remote, excluded paths, inbox, clone folder) is an environment variable listed in its header, so it works for any repo.
- `scripts/cloud/start.exp <brief-file>` starts `claude --cloud` from the current folder with nobody at the terminal, answers the folder-trust prompt, and prints the session link. Timeout and terminal size are arguments.
- In zsh write `${var}:refs/...`, never `$var:refs/...`: zsh reads `:r` as a modifier and mangles the commit id.

## Where cloud sessions push

They push to `claude/<slug>` branches that the cloud picks itself (for example `claude/fix-camera-refit-race-i61c4j`), not the `cloud/<name>` a brief asks for. Find their work with `git ls-remote origin 'refs/heads/claude/*'`. Missing this on 2026-10-02 made two finished sessions (draw-in extras and export formats, 09-30) look like they had produced nothing. `ListAgents` lists cloud sessions by title, and `SendMessage` reaches them one way.
