#!/bin/zsh
# snapshot.sh: hand a cloud session the code without the private or heavy parts.
# Builds one orphan commit (no parents, so nothing is merged) of <source-ref>'s tree minus the excluded paths,
# optionally adds three-way inbox copies of a lane commit's files, pushes it to <remote> as cloud/<name>, and
# shallow-clones it for `claude --cloud`.
#
#   scripts/cloud/snapshot.sh <name> <source-ref> [lane-commit]
#
# docs/thinking and the transcript dumps are ALWAYS left out, in any letter case, and the last gate refuses any
# path with a docs/thinking folder in it, inbox copies included. No setting can put them back.
# Every other value can be overridden from the environment:
#   SNAP_REPO        repo to snapshot (default: the repo this script sits in)
#   SNAP_REMOTE      remote to push to (default: origin)
#   SNAP_EXCLUDE     space-separated paths left out ON TOP of the private ones (default: docs/verification)
#   SNAP_INBOX       folder for lane copies (default: docs/cloud-inbox/<name>)
#   SNAP_INBOX_DIRS  lane paths copied into the inbox (default: app components lib scripts)
#   SNAP_CLONES      where the shallow clone goes (default: ~/.fs-lanes)
#   SNAP_CLONE_URL   clone URL (default: the remote's URL)
# A clone folder left by an earlier run with the same name is brought to the new snapshot when it is clean and
# still on the last snapshot; otherwise the run is refused before anything is pushed.
set -e
name=${1:?name}; src=${2:?source ref}; lane=${3:-}
repo=${SNAP_REPO:-$(cd "$(dirname "$0")/../.." && pwd)}
remote=${SNAP_REMOTE:-origin}
private=(docs/thinking docs/research-2026-09-25/animation-asks/TRANSCRIPTS.md docs/research-2026-09-25/animation-asks/plan-pasted-2026-07-28.txt)
exclude=($private ${=SNAP_EXCLUDE-docs/verification})
specs=(); for p in $exclude; do specs+=(":(icase)$p"); done
inbox=${SNAP_INBOX:-docs/cloud-inbox/$name}
inbox_dirs=(${=SNAP_INBOX_DIRS:-app components lib scripts})
clones=${SNAP_CLONES:-$HOME/.fs-lanes}
dir=$clones/cloud-$name
# Literal pathspecs from the caller's environment would turn :(icase) into a string that matches nothing.
unset GIT_LITERAL_PATHSPECS GIT_GLOB_PATHSPECS GIT_NOGLOB_PATHSPECS GIT_ICASE_PATHSPECS
cd "$repo"
url=${SNAP_CLONE_URL:-$(git remote get-url "$remote")}
old=$(git rev-parse -q --verify "refs/cloud/${name}-base") || old=''

if [ -e "$dir" ]; then
  dirty=$(git -C "$dir" status --porcelain) || { echo "REFUSED: $dir exists and git cannot read it as a clone; move it aside"; exit 4; }
  head=$(git -C "$dir" rev-parse HEAD) || { echo "REFUSED: $dir has no HEAD; move it aside"; exit 4; }
  [ -z "$dirty" ] || { echo "REFUSED: $dir has uncommitted or untracked files; move it aside or remove it"; exit 4; }
  [ -n "$old" ] && [ "$head" = "$old" ] || { echo "REFUSED: $dir is at $head, not the last cloud/$name snapshot ${old:-(none recorded)}; move it aside or remove it"; exit 4; }
fi

idx=$(mktemp -t snapidx); trap 'rm -f "$idx"' EXIT; export GIT_INDEX_FILE=$idx
git read-tree "$src"
git rm -r -q -f --cached --ignore-unmatch -- "${specs[@]}"
if [ -n "$lane" ]; then
  for f in $(git diff --name-only "$lane^" "$lane" -- "${inbox_dirs[@]}"); do
    git update-index --add --cacheinfo 100644,"$(git rev-parse "$lane^:$f")","$inbox/base/$f"
    git update-index --add --cacheinfo 100644,"$(git rev-parse "$lane:$f")","$inbox/lane/$f"
  done
fi
for s in "${specs[@]}"; do [ -z "$(git ls-files -- "$s")" ] || { echo "REFUSED: ${s#:(icase)} is still in the snapshot"; exit 3; }; done
files=$(git ls-files)
leak=$(print -r -- "$files" | grep -iE '(^|/)docs/thinking(/|$)' | head -1)
[ -z "$leak" ] || { echo "REFUSED: $leak sits under docs/thinking"; exit 3; }
tree=$(git write-tree); unset GIT_INDEX_FILE
c=$(printf "Snapshot of %s for cloud work, without: %s\n" "$src" "${exclude[*]}" | git commit-tree "$tree")
git update-ref "refs/cloud/${name}-base" "$c"
git push -q "$remote" "${c}:refs/heads/cloud/${name}"
mkdir -p "$clones"
if [ -e "$dir" ]; then
  git -C "$dir" fetch -q --depth 1 "$url" "+refs/heads/cloud/${name}:refs/remotes/origin/cloud/${name}"
  git -C "$dir" checkout -q -B "cloud/$name" "refs/remotes/origin/cloud/$name"
else
  git clone -q --depth 1 -b "cloud/$name" "$url" "$dir"
fi
got=$(git -C "$dir" rev-parse HEAD)
[ "$got" = "$c" ] || { echo "REFUSED: $dir is at $got, not the snapshot $c"; exit 4; }
echo "SNAP $name $c $(git -C "$dir" ls-files | wc -l | tr -d ' ') files, clone $dir"
