#!/bin/zsh
# One scoped Codex pass over the ten instruments. Spends his ChatGPT quota, not Anthropic's.
# Quota was empty on 2026-09-18; it resets Sep 19 2026, 4:29 AM. Run after that.
set -u
REPO=/Users/sebs/Desktop/Projects/free-stroke
OUT=$REPO/docs/crosscheck/2026-09-18-instruments.reply.md
# 1 · readiness: one real call, because --version and login status read healthy on an empty quota
P=$(mktemp -d)
codex exec --json --ephemeral --skip-git-repo-check -s read-only -C "$P" \
  -c 'model_reasoning_effort="low"' -c 'notify=[]' -o "$P/reply" \
  "Reply with the single word OK." > "$P/out" 2>&1 < /dev/null
rc=$?   # captured on the next line on purpose: anything in between would overwrite it
if ! { [ $rc -eq 0 ] && grep -qi ok "$P/reply" 2>/dev/null; }; then
  echo "CODEX NOT READY"; grep -m1 -o 'try again at [^."]*' "$P/out" || tail -n 3 "$P/out"; exit 1
fi
echo "CODEX READY, running the crosscheck"
# 2 · the pass: read-only so it cannot write while it mutates to test; prompt on stdin
codex exec -s read-only -C "$REPO" -o "$OUT" < "$REPO/docs/crosscheck/2026-09-18-instruments.prompt.txt"
echo "exit $?  ->  $OUT"
