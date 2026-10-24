# CL-GUARD log

Lane: `claude/guard` in `~/.fs-lanes/cl-guard`. Hooks and scripts only, nothing a person sees. No push anywhere; every test runs against throwaway repos under `/tmp`, with a bare repo named `SXM4434/free-stroke.git` standing in for the public remote.

## Plan, 2026-10-02

Codex reproduced nine ways through the guard. Each gets a case in `scripts/cloud/test/guard-test.sh`, run once against the old files (copied out with `git show HEAD:<path>`) to watch it fail, then against the new ones.

**pre-push.** Check the full ancestry of every pushed tip, not a range. Codex's input 4 is a remote that really holds the private commit already, so any "minus what the remote has" set still waves it through; the full ancestry is the only set that refuses it, and it needs no tracking ref and no remote sha, which closes inputs 1 and 2 too. Path match is `:(icase)docs/thinking` with `--full-history`, so a side branch that adds and deletes under a merge that looks unchanged still counts (input 3). Any git error refuses and prints git's own message. Env that would neuter the pathspec (`GIT_LITERAL_PATHSPECS` and friends) and replace refs are switched off inside the hook. The URL match lowercases and drops a trailing `/` or `.git`, since GitHub ignores case.

**merge-back.sh.** Validate the ref and `MB_BASE` as commits, and `MB_BASE` as an ancestor of the ref, before the loop. Refuse a dirty target, because `git commit -C` takes the whole index. Every `git commit` is checked; a failed one drops only its own pick and exits 5 with the count so far.

**snapshot.sh.** `docs/thinking` and the two transcript dumps are always excluded; `SNAP_EXCLUDE` adds to them (default `docs/verification`). The last gate refuses any path with a `docs/thinking` component in any case, which also covers lane copies under the inbox. A clone folder that already exists is refreshed to the new snapshot if it is clean and sits on the old base, refused otherwise, and the printed count is read only after its HEAD is checked against the new commit.

**start.exp.** After the link prints, wait for claude to exit and read its status. `CLOUD_URL` prints only when claude exits 0 or is still running after the grace period; a non-zero exit prints `CLOUD_FAILED` with the status and exits 3.

## Results

`scripts/cloud/test/guard-test.sh [source-root] [case ...]`, 23 cases, 2026-10-02. Old files (`git show 4cefd4b9a:<path>`): 9 passed, 14 failed. New: 23 of 23 passed.

| Input | Old | New |
|---|---|---|
| 1 new branch, and a new tag, with a tracking ref at the private commit | exit 0, private commit on the remote | refused, remote lacks it |
| 2 force over a remote sha this clone lacks | exit 0, on the remote | refused |
| 3 docs/Thinking | exit 0, on the remote | refused |
| 4 ordinary and force update over a private remote tip | exit 0, new tip on the remote | refused, and says the remote already holds it |
| 5 git commit fails (gpgsign, gpg = /usr/bin/false) | "2 of 2 picked", exit 0, head unmoved | exit 5, names the commit and git's error |
| 6 MB_BASE=does-not-exist | "0 of  picked", exit 0 | exit 2 before the loop |
| 7 SNAP_EXCLUDE=docs/verification | pushed docs/thinking and docs/Thinking | both left out, exit 0 |
| 8 same name, new source, folder still there | old clone, old count (2 files), exit 0 | clone moved to the new snapshot, 3 files |
| 9 claude prints a link and exits 7 | CLOUD_URL, exit 0 | CLOUD_FAILED (7), exit 3, no CLOUD_URL |

Still pass on both: a clean branch push and update, an orphan snapshot push, delete and re-add under docs/thinking (refused), a rename out (refused), merge-back 2 of 2, claude exiting 0 or still running.

Found on the way, failing on the old files, passing now: a side branch that adds and deletes under docs/thinking hidden by a merge; the public URL in another case with a trailing slash; the DEFAULT snapshot pushing `docs/Thinking/upper.md`; `SNAP_INBOX_DIRS=docs` pushing lane copies of docs/thinking under the inbox (checked by hand, not in the test file).

Not fixed, noted: snapshot.sh crashes (exit 129) on a lane commit that adds a new file, since `$lane^:$f` does not exist. It fails closed. `git push --no-verify` skips every hook; nothing in a hook can stop that. The silent-catch scanner reads no shell, so it saw 0 files here.
