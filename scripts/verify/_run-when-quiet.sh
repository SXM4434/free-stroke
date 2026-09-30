#!/usr/bin/env bash
# Wait for the sibling-owned files to go quiet, then run through _run-clean.
# A concurrent save fast-refreshes the shared dev server mid-capture; the run is
# DISCARDED and repeated, never adjusted (_run-clean exit 3).
cd "$(dirname "$0")/../.." || exit 1
# Kept in step with _run-clean.mjs's WATCH list on purpose (2026-08-01): this
# script waited on FOUR files while _run-clean fails the run on SEVENTEEN, so a
# lane editing lib/style-system.ts produced attempt after attempt that waited on
# a quiet window that was never the relevant one. Extra entries can only cause
# more waiting; a missing one costs a whole capture.
#
# ASK _run-clean FOR THE LIST; DO NOT SCRAPE ITS SOURCE (2026-08-01, second
# pass). This line used to regex the `const WATCH = [ … ]` array literal out of
# that file, so the two were coupled through its FORMATTING. The moment WATCH
# became a computed expression the match returned null, `$W` came back EMPTY,
# and the quiet loop below found `newest=0`, computed an age of ~57 years, and
# broke out on its first tick — the wait silently stopped waiting. A guard that
# fails open with no error is the exact defect class this pair exists to catch.
# `--watch-paths` is a stable, one-path-per-line contract; if it ever produces
# nothing, that is now a hard failure rather than an instant pass.
W=$(node scripts/verify/_run-clean.mjs --watch-paths)
if [ -z "$W" ]; then
  echo "[quiet] FATAL: _run-clean.mjs --watch-paths returned nothing — refusing to run"
  echo "[quiet] (an empty watch set makes the quiet window vacuous; fix the list first)"
  exit 2
fi
for attempt in 1 2 3 4 5 6 7 8; do
  # quiet window: no watched file touched in the last 25s
  for w in 1 2 3 4 5 6 7 8 9 10 11 12; do
    now=$(date +%s); newest=0
    for f in $W; do [ -e "$f" ] || continue; m=$(stat -f %m "$f"); [ "$m" -gt "$newest" ] && newest=$m; done
    age=$((now - newest))
    [ "$age" -ge 25 ] && break
    /bin/sleep 5
  done
  node scripts/verify/_run-clean.mjs "$@"
  code=$?
  [ $code -ne 3 ] && exit $code
  echo "[quiet] attempt $attempt discarded (contaminated); retrying"
done
echo "[quiet] gave up after 8 contaminated attempts"
exit 3
