#!/bin/bash
# guard-test.sh: Codex's nine ways through the docs/thinking guard (2026-10-02), plus the cases that must
# keep working. Every case builds its own throwaway repos under /tmp; a bare repo named
# SXM4434/free-stroke.git stands in for the public remote, so the real one is never contacted.
#
#   scripts/cloud/test/guard-test.sh [source-root] [case ...]
#
# source-root holds .githooks/pre-push and scripts/cloud/{merge-back.sh,snapshot.sh,start.exp}; the default
# is this repo. Point it at a copy of the old files to watch the cases fail there. Exit status is the number
# of failed cases. A case passes on what landed, not on what a script printed: for a push, whether the
# private commit is in the bare remote afterwards.
set -u
here=$(cd "$(dirname "$0")/../../.." && pwd)
SRC=${1:-$here}; shift 2>/dev/null
only=" $* "
T=$(mktemp -d /tmp/guard-test.XXXXXX) || { echo "no temp dir"; exit 99; }
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
mkdir -p "$T/hooks" && cp "$SRC/.githooks/pre-push" "$T/hooks/pre-push" || { echo "no pre-push in $SRC"; exit 99; }
pass=0; fail=0
ok()  { echo "PASS $1"; pass=$((pass+1)); }
bad() { echo "FAIL $1: $2"; fail=$((fail+1)); }
want() { [ "$only" = "  " ] || case "$only" in *" $1 "*) return 0 ;; *) return 1 ;; esac; }

# A work repo $W whose origin is a fresh bare "public" remote $PUB, with only the pre-push hook wired in.
newrepo() {
  local d="$T/$1"
  mkdir -p "$d/pub/SXM4434" && git init -q --bare "$d/pub/SXM4434/free-stroke.git" && git init -q -b main "$d/w" || exit 99
  W="$d/w"; PUB="$d/pub/SXM4434/free-stroke.git"
  git -C "$W" config core.hooksPath "$T/hooks"
  git -C "$W" remote add origin "$PUB"
  c app/base.js base "base" >/dev/null
}
# c <path> <content | -> <message>: write (or with -, delete) one file, commit, print the sha.
c() {
  if [ "$2" = - ]; then git -C "$W" rm -q -- "$1"
  else mkdir -p "$W/$(dirname "$1")" && printf '%s\n' "$2" > "$W/$1" && git -C "$W" add -- "$1"; fi
  git -C "$W" commit -q -m "$3" && git -C "$W" rev-parse HEAD
}
landed() { git -C "$PUB" cat-file -e "$1^{commit}" 2>/dev/null; }   # silent-ok: absent is the answer
# refused <case> <sha that must not reach $PUB> <push args...>
refused() {
  local n=$1 sha=$2 out rc; shift 2
  out=$(git -C "$W" push "$@" 2>&1); rc=$?
  # The refusal has to be the hook's, for the right reason, not some other push failure.
  if [ $rc -ne 0 ] && ! landed "$sha" && echo "$out" | grep -q "carries docs/thinking"; then ok "$n"; else bad "$n" "push exit $rc, $sha $(landed "$sha" && echo IS || echo not) on the public remote. $(echo "$out" | tail -2 | tr '\n' ' ')"; fi
}
# allowed <case> <sha that must reach $PUB> <push args...>
allowed() {
  local n=$1 sha=$2 out rc; shift 2
  out=$(git -C "$W" push "$@" 2>&1); rc=$?
  if [ $rc -eq 0 ] && landed "$sha"; then ok "$n"; else bad "$n" "push exit $rc. $(echo "$out" | tail -2 | tr '\n' ' ')"; fi
}

# ---- pre-push -------------------------------------------------------------------------------------------
if want 1; then
  newrepo i1; P=$(c docs/thinking/private.md secret "add private")
  git -C "$W" update-ref refs/remotes/origin/old "$P"
  refused "1 new branch, tracking ref at the private commit" "$P" origin "$P:refs/heads/new"
  git -C "$W" tag t1 "$P"
  refused "1 new tag, same tracking ref" "$P" origin refs/tags/t1
fi
if want 2; then
  newrepo i2; P=$(c docs/thinking/private.md secret "add private")
  git init -q "$T/i2/other" && git -C "$T/i2/other" commit -q --allow-empty -m "someone else" \
    && git -C "$T/i2/other" push -q "$PUB" HEAD:refs/heads/main || exit 99
  refused "2 force over a remote sha this clone lacks" "$P" --force origin main
fi
if want 3; then
  newrepo i3; P=$(c docs/Thinking/private.md secret "add private, capital T")
  refused "3 docs/Thinking in another case" "$P" origin main
fi
if want 4; then
  newrepo i4; P=$(c docs/thinking/private.md secret "add private")
  git -C "$W" push -q --no-verify origin "$P:refs/heads/leak" || exit 99      # the remote already holds it
  L=$(c app/next.js next "clean on top")
  refused "4 ordinary update over a remote tip that is the private commit" "$L" origin "$L:refs/heads/leak"
  git -C "$W" checkout -q -b side "$P" && P2=$(c docs/thinking/more.md more "second private")
  git -C "$W" push -q --no-verify origin "$P2:refs/heads/leak2" || exit 99
  git -C "$W" checkout -q main
  refused "4 force update over a private remote tip" "$L" --force origin "$L:refs/heads/leak2"
fi
if want keep-push; then
  newrepo k1; A=$(c app/a.js a "clean")
  allowed "keep: plain push of a clean branch" "$A" origin main
  B=$(c app/b.js b "clean again")
  allowed "keep: ordinary update of a clean branch" "$B" origin main
  git -C "$W" checkout -q --orphan snap && S=$(c app/snap.js s "snapshot")
  allowed "keep: orphan snapshot push" "$S" origin snap:refs/heads/cloud/x
  newrepo k2; c docs/thinking/a.md a "add" >/dev/null; c docs/thinking/a.md - "delete" >/dev/null
  R=$(c docs/thinking/a.md again "re-add")
  refused "keep: delete and re-add under docs/thinking" "$R" origin main
  newrepo k3; c docs/thinking/a.md a "add" >/dev/null
  git -C "$W" mv docs/thinking/a.md notes-a.md && git -C "$W" commit -q -m "rename out" && R=$(git -C "$W" rev-parse HEAD)
  refused "keep: rename out of docs/thinking" "$R" origin main
fi
if want extra-push; then
  # A side branch adds and deletes under docs/thinking; the merge looks unchanged on the path.
  newrepo e1; git -C "$W" checkout -q -b side && c docs/thinking/a.md a "add" >/dev/null && c docs/thinking/a.md - "delete" >/dev/null
  git -C "$W" checkout -q main && c app/m.js m "main work" >/dev/null && git -C "$W" merge -q --no-edit side && M=$(git -C "$W" rev-parse HEAD)
  refused "extra: add and delete on a merged side branch" "$M" origin main
  newrepo e2; P=$(c docs/thinking/private.md secret "add private")
  out=$(GIT_LITERAL_PATHSPECS=1 git -C "$W" push origin main 2>&1); rc=$?
  if [ $rc -ne 0 ] && ! landed "$P"; then ok "extra: GIT_LITERAL_PATHSPECS=1 in the caller's env"; else bad "extra: GIT_LITERAL_PATHSPECS=1 in the caller's env" "push exit $rc"; fi
  newrepo e3; P=$(c docs/thinking/private.md secret "add private")
  mkdir -p "$T/e3/alt/sxm4434" && git init -q --bare "$T/e3/alt/sxm4434/Free-Stroke.git" && PUB="$T/e3/alt/sxm4434/Free-Stroke.git"
  git -C "$W" remote add alt "$PUB/"
  refused "extra: public URL in another case with a trailing slash" "$P" alt main
fi

# ---- merge-back.sh --------------------------------------------------------------------------------------
# A target clone on main, and refs/cloudrun/x: a snapshot root plus two session commits.
mbsetup() {
  local d="$T/$1"; git init -q -b main "$d" || exit 99; MT=$d
  printf 'base\n' > "$d/a.txt" && git -C "$d" add a.txt && git -C "$d" commit -q -m base
  git -C "$d" checkout -q --orphan snap && git -C "$d" commit -q -m snapshot
  printf 'one\n' > "$d/b.txt" && git -C "$d" add b.txt && git -C "$d" commit -q -m "session one"
  printf 'two\n' > "$d/c.txt" && git -C "$d" add c.txt && git -C "$d" commit -q -m "session two"
  git -C "$d" update-ref refs/cloudrun/x HEAD && git -C "$d" checkout -q main && git -C "$d" branch -q -D snap
}
mb() { MB_NOTES="LOG.md" zsh "$SRC/scripts/cloud/merge-back.sh" lab refs/cloudrun/x "$MT" 2>&1; }
if want 5; then
  mbsetup m5; before=$(git -C "$MT" rev-parse HEAD)
  git -C "$MT" config commit.gpgsign true && git -C "$MT" config gpg.program /usr/bin/false
  out=$(mb); rc=$?
  after=$(git -C "$MT" rev-parse HEAD)
  if [ $rc -ne 0 ] && [ "$before" = "$after" ] && ! echo "$out" | grep -q " picked, head"; then ok "5 git commit fails under gpgsign"
  else bad "5 git commit fails under gpgsign" "exit $rc, head moved: $([ "$before" = "$after" ] && echo no || echo yes). $(echo "$out" | tail -1)"; fi
fi
if want 6; then
  mbsetup m6; out=$(MB_BASE=does-not-exist mb); rc=$?
  if [ $rc -ne 0 ] && ! echo "$out" | grep -q " picked, head"; then ok "6 MB_BASE that does not exist"; else bad "6 MB_BASE that does not exist" "exit $rc. $(echo "$out" | tail -1)"; fi
fi
if want keep-mb; then
  mbsetup mk; before=$(git -C "$MT" rev-parse HEAD); out=$(mb); rc=$?
  n=$(git -C "$MT" rev-list --count "$before..HEAD")
  if [ $rc -eq 0 ] && [ "$n" = 2 ] && echo "$out" | grep -q "2 of 2 picked"; then ok "keep: merge-back picks 2 of 2"; else bad "keep: merge-back picks 2 of 2" "exit $rc, $n new commits. $out"; fi
fi

# ---- snapshot.sh ----------------------------------------------------------------------------------------
# A repo with private, heavy and code paths, and a bare remote for the cloud/<name> branches.
snsetup() {
  local d="$T/$1"; git init -q -b main "$d/r" && git init -q --bare "$d/remote.git" || exit 99; SR=$d/r; SN=$d/remote.git; SC=$d/clones
  mkdir -p "$SR/docs/thinking" "$SR/docs/verification" "$SR/app"
  printf 'his words\n' > "$SR/docs/thinking/day.md"; printf 'heavy\n' > "$SR/docs/verification/v.png"; printf 'code\n' > "$SR/app/a.js"
  git -C "$SR" add -A && git -C "$SR" remote add origin "$SN"
  # A second private file whose folder differs only in case, written straight into the index.
  git -C "$SR" update-index --add --cacheinfo "100644,$(printf 'upper\n' | git -C "$SR" hash-object -w --stdin),docs/Thinking/upper.md"
  git -C "$SR" commit -q -m one
}
snap() { SNAP_REPO=$SR SNAP_CLONES=$SC zsh "$SRC/scripts/cloud/snapshot.sh" "$@" 2>&1; }
private_in() { git -C "$SN" ls-tree -r --name-only "$1" 2>/dev/null | grep -iE '(^|/)docs/thinking(/|$)'; }
if want 7; then
  snsetup s7; out=$(SNAP_EXCLUDE=docs/verification snap n main); rc=$?
  leak=$(private_in refs/heads/cloud/n)
  if [ -z "$leak" ]; then ok "7 SNAP_EXCLUDE without docs/thinking (exit $rc)"; else bad "7 SNAP_EXCLUDE without docs/thinking" "exit $rc, pushed $(echo $leak)"; fi
fi
if want 8; then
  snsetup s8; out1=$(snap n main) || { bad "8 setup" "$out1"; }
  printf 'more\n' > "$SR/app/b.js" && printf 'more\n' > "$SR/app/c.js" && git -C "$SR" add app && git -C "$SR" commit -q -m two
  git -C "$SN" branch -q -D cloud/n                    # the branch was cleaned up, the folder was not
  out=$(snap n main); rc=$?
  newc=$(git -C "$SR" rev-parse -q --verify refs/cloud/n-base); got=$(git -C "$SC/cloud-n" rev-parse HEAD)
  want_n=$(git -C "$SR" ls-tree -r --name-only "$newc" | wc -l | tr -d ' ')
  if [ $rc -ne 0 ] && echo "$out" | grep -q REFUSED; then ok "8 reused clone folder (refused)"
  elif [ $rc -eq 0 ] && [ "$got" = "$newc" ] && echo "$out" | grep -q " $want_n files"; then ok "8 reused clone folder (refreshed to $want_n files)"
  else bad "8 reused clone folder" "exit $rc, clone at ${got:0:9}, snapshot ${newc:0:9}, want $want_n files. $out"; fi
fi
if want keep-snap; then
  snsetup sk; out=$(snap n main); rc=$?
  names=$(git -C "$SN" ls-tree -r --name-only refs/heads/cloud/n 2>&1)
  if [ $rc -eq 0 ] && [ "$names" = "app/a.js" ] && echo "$out" | grep -q " 1 files"; then ok "keep: default snapshot holds app/a.js only"; else bad "keep: default snapshot" "exit $rc, tree: $(echo $names). $out"; fi
fi

# ---- start.exp ------------------------------------------------------------------------------------------
# A fake claude that prints a session link, then exits FAKE_EXIT after FAKE_SLEEP seconds.
mkdir -p "$T/bin" && printf '%s\n' '#!/bin/sh' 'echo "Session: https://claude.ai/code/session_abc123 "' 'sleep ${FAKE_SLEEP:-0}' 'exit ${FAKE_EXIT:-0}' > "$T/bin/claude" && chmod +x "$T/bin/claude"
echo brief > "$T/brief.txt"
st() { (cd "$T" && PATH="$T/bin:$PATH" expect "$SRC/scripts/cloud/start.exp" "$T/brief.txt" /dev/null 20 50 200 3 2>&1); }
if want 9; then
  out=$(FAKE_EXIT=7 st); rc=$?
  if [ $rc -ne 0 ] && ! echo "$out" | grep -q "^CLOUD_URL"; then ok "9 claude prints a link and exits 7"; else bad "9 claude prints a link and exits 7" "exit $rc. $(echo "$out" | tail -1)"; fi
fi
if want keep-start; then
  out=$(FAKE_EXIT=0 st); rc=$?
  if [ $rc -eq 0 ] && echo "$out" | grep -q "^CLOUD_URL https://claude.ai/code/session_abc123"; then ok "keep: claude exits 0, link printed"; else bad "keep: claude exits 0" "exit $rc. $out"; fi
  out=$(FAKE_SLEEP=30 st); rc=$?
  if [ $rc -eq 0 ] && echo "$out" | grep -q "^CLOUD_URL https://claude.ai/code/session_abc123"; then ok "keep: claude still running, link printed"; else bad "keep: claude still running" "exit $rc. $out"; fi
fi

echo "$pass passed, $fail failed, of $((pass+fail)) cases. Source: $SRC. Repos: $T"
exit $fail
