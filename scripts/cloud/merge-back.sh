#!/bin/zsh
# merge-back.sh: bring a cloud session's commits onto a local branch, one commit at a time.
#
#   scripts/cloud/merge-back.sh <label> <ref> [target-clone]
#
# <ref> is the cloud branch as fetched locally (for example refs/cloudrun/fix-camera-refit-race-i61c4j). Its
# root commit is the snapshot it started from, so everything after the root is the session's own work.
# Each commit is cherry-picked with rename detection off (a renamed-looking copy under docs/verification once
# turned a clean pick into a false conflict).
#   - A conflict in the notes files only (default LOG.md and docs/RUN-QUEUE.md): LOG.md keeps the target's
#     copy and the session's copy is saved to <handoffs>/<label>-LOG.md; RUN-QUEUE keeps both sides.
#   - A conflict in any other file: the pick is aborted, the files are named, and the script exits 4.
#     It never resolves a code file to either side by itself.
#   - Any other failure (a bad ref or MB_BASE, a dirty target, a git commit that fails, a notes file it
#     cannot join): the script stops, says what failed and how many commits it picked first, and exits
#     2 (before the loop) or 5 (inside it). The last line reads "<n> of <total> picked, head <sha>" only
#     when every commit landed. Hardened 2026-10-02: Codex had it print "1 of 1 picked" over a failed commit.
# Settings (environment): MB_BASE (pick only commits after this one; default the ref's root commit), MB_TARGET (default ~/.fs-lanes/integrate), MB_NOTES (space-separated notes files),
# MB_HANDOFFS (default docs/cloud-handoffs).
set -u
label=${1:?label}; ref=${2:?ref}
target=${3:-${MB_TARGET:-$HOME/.fs-lanes/integrate}}
notes=(${=MB_NOTES:-LOG.md docs/RUN-QUEUE.md})
handoffs=${MB_HANDOFFS:-docs/cloud-handoffs}
picked=0; total='?'
stop() { echo "STOP $label: $1"; echo "$label: $picked of $total picked before the stop"; exit $2; }
# Drops the pick in progress. The target was clean when the loop started, so this loses nothing else.
drop_pick() { git cherry-pick --abort 2>/dev/null || git reset -q --hard; }   # silent-ok: --abort fails when no pick is recorded; reset covers it
cd "$target" || exit 2

tip=$(git rev-parse --verify -q "$ref^{commit}") || stop "$ref is not a commit in $target" 2
if [ -n "${MB_BASE:-}" ]; then
  root=$(git rev-parse --verify -q "$MB_BASE^{commit}") || stop "MB_BASE=$MB_BASE is not a commit in $target" 2
  git merge-base --is-ancestor "$root" "$tip" || stop "MB_BASE=$MB_BASE is not an ancestor of $ref" 2
else
  roots=$(git rev-list --max-parents=0 "$tip") || stop "git could not list the root commits of $ref" 2
  roots=(${(f)roots})
  (( ${#roots} == 1 )) || stop "$ref has ${#roots} root commits, so its snapshot is not clear; set MB_BASE" 2
  root=$roots[1]
fi
# git commit -C takes the whole index, so anything already staged would ride along inside a picked commit.
git diff --quiet && git diff --cached --quiet || stop "$target has uncommitted changes; commit or stash them first" 2
list=$(git rev-list --reverse "$root..$tip") || stop "git could not list $root..$ref" 2
commits=(${(f)list})
total=${#commits}

commit_pick() {
  local err
  if ! err=$(git commit -q -C "$1" --no-verify 2>&1); then
    drop_pick
    stop "git commit of $(git log -1 --format='%h %s' "$1" | cut -c1-70) failed, so it is not picked. git said: $err" 5
  fi
  picked=$((picked+1))
}

for c in $commits; do
  if out=$(git -c merge.renames=false -c merge.conflictStyle=merge cherry-pick -n "$c" 2>&1); then
    git diff --cached --quiet && { echo "  $c empty, skipped"; continue; }
    commit_pick "$c"; continue
  fi
  u=(${(f)"$(git diff --name-only --diff-filter=U)"})
  code=()
  for f in "${u[@]}"; do (( ${notes[(Ie)$f]} )) || code+=("$f"); done
  if (( ${#u[@]} == 0 || ${#code[@]} > 0 )); then
    drop_pick
    echo "STOP $label at $(git log -1 --format='%h %s' "$c" | cut -c1-70): conflict in ${code[*]:-no listed file}"
    (( ${#u[@]} == 0 )) && echo "  git said: $out"
    echo "$label: $picked of $total picked before the stop"; exit 4
  fi
  for f in "${u[@]}"; do
    if [ "$f" = "LOG.md" ]; then
      { mkdir -p "$handoffs" && git show "$c:LOG.md" > "$handoffs/$label-LOG.md" && git add "$handoffs/$label-LOG.md" \
        && git checkout --ours -- LOG.md; } || { drop_pick; stop "could not keep LOG.md and save the session's copy to $handoffs" 5; }
    else
      python3 -c "
import re,sys;p=sys.argv[1];s=open(p).read();open(p,'w').write(re.sub(r'^<<<<<<< [^\n]*\n(.*?)^=======\n(.*?)^>>>>>>> [^\n]*\n',lambda m:m.group(1)+m.group(2),s,flags=re.S|re.M))" "$f" \
        || { drop_pick; stop "could not join both sides of $f" 5; }
      if grep -qE '^(<<<<<<<|>>>>>>>) ' "$f"; then drop_pick; stop "$f still holds conflict markers after joining both sides" 5; fi
    fi
    git add "$f" || { drop_pick; stop "git add $f failed" 5; }
  done
  commit_pick "$c"
done
echo "$label: $picked of $total picked, head $(git log -1 --format=%h)"
