#!/bin/sh
# Shared by pre-commit, commit-msg and pre-merge-commit. One implementation --
# three hooks calling three copies is how the rule drifts.
#
# WHY: measured 2026-08-25 on SXM4434/portfolio. Of 792 commits made in August,
# 400 were NOT attributed to Sebs -- 370 authored `arm <arm@local>` (a cloud
# agent container that never inherited a git identity) and 30 authored
# `Claude <noreply@anthropic.com>`. GitHub reports author.login = null for every
# one: they do not appear on his contribution graph and do not read as his work.
# The repo config was correct the whole time. The commits were made somewhere
# the config did not reach.

OWNER_NAME="Sebs"
OWNER_EMAIL="sebastianmm.design@gmail.com"   # verified: maps to github.com/SXM4434

fail() {
  printf '\n\033[31m✖ COMMIT BLOCKED — %s\033[0m\n' "$1" >&2
  printf '  author:    %s <%s>\n' "$(git var GIT_AUTHOR_IDENT | sed 's/ [0-9].*//; s/ </|</' | cut -d'|' -f1)" \
      "$(git config user.email)" >&2
  printf '\n  Fix in THIS clone, then retry:\n' >&2
  printf '    git config user.name  "%s"\n' "$OWNER_NAME" >&2
  printf '    git config user.email "%s"\n' "$OWNER_EMAIL" >&2
  printf '\n  If you are an agent in a fresh container, run that FIRST, every time.\n' >&2
  printf '  Override for one commit only if a human really is co-authoring:\n' >&2
  printf '    ALLOW_FOREIGN_AUTHOR=1 git commit ...\n\n' >&2
  exit 1
}

[ "$ALLOW_FOREIGN_AUTHOR" = "1" ] && exit 0

an=$(git var GIT_AUTHOR_IDENT  | sed -E 's/^(.*) <.*/\1/')
ae=$(git var GIT_AUTHOR_IDENT  | sed -E 's/^.*<([^>]*)>.*/\1/')
cn=$(git var GIT_COMMITTER_IDENT | sed -E 's/^(.*) <.*/\1/')
ce=$(git var GIT_COMMITTER_IDENT | sed -E 's/^.*<([^>]*)>.*/\1/')

[ "$ae" = "$OWNER_EMAIL" ] || fail "author email is '$ae', not the owner's"
[ "$ce" = "$OWNER_EMAIL" ] || fail "committer email is '$ce', not the owner's"
[ "$an" = "$OWNER_NAME" ]  || fail "author name is '$an', not '$OWNER_NAME'"
[ "$cn" = "$OWNER_NAME" ]  || fail "committer name is '$cn', not '$OWNER_NAME'"
exit 0
