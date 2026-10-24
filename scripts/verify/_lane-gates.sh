#!/usr/bin/env bash
# THIS LANE'S MUST-NOT-REGRESS LIST, RUN IN ONE PASS ON ONE TREE.
#
# Quoting six gate results collected over four hours of editing is a sampled
# verification claim: each row was true of a working tree at a timestamp, and
# the storyboard records three separate occasions where that turned out to
# matter (§11.7's own "the model moved under this measurement mid-pass"). This
# runs the whole list against the tree as it stands, in order, and prints one
# verdict per row plus the aggregate.
#
# FS_PORT points at this lane's own dev server. It is the ONE name for that knob
# (`scripts/verify/lib/dev-server.mjs` derives both surfaces from it) and it
# defaults to 3000, so running this without it targets the shared checkout.
# `HERO_URL` / `LAB_URL` are gone: setting either now THROWS with the
# replacement command, rather than being silently ignored.
#
# Usage: FS_PORT=3077 bash scripts/verify/_lane-gates.sh
set -u
cd "$(dirname "$0")/../.."

pass=0
fail=0
run() {
  local name="$1"; shift
  local out
  out="$("$@" 2>&1)"
  local code=$?
  if [ $code -eq 0 ]; then
    pass=$((pass+1)); printf 'PASS  %-46s exit 0\n' "$name"
  else
    fail=$((fail+1)); printf 'FAIL  %-46s exit %d\n' "$name" "$code"
    printf '%s\n' "$out" | tail -8 | sed 's/^/        /'
  fi
  printf '%s\n' "$out" | grep -E "^(9/9|8/8|5/5|4/4|3/3|all rows passed|ALL GATES PASS|SOUND|[0-9]+/[0-9]+ (gates|rows))" | tail -2 | sed 's/^/        /'
}

echo "=== must-not-regress, one tree, one pass ==="
run "assert-hero-flatstate"                 node scripts/verify/assert-hero-flatstate.mjs
run "assert-hero-transition --label=lit-after" node scripts/verify/assert-hero-transition.mjs --label=lit-after
run "assert-hero-k7-intact"                 node scripts/verify/assert-hero-k7-intact.mjs
run "assert-hero-carve"                     node scripts/verify/assert-hero-carve.mjs
run "assert-flat-silhouette"                node scripts/verify/assert-flat-silhouette.mjs
run "verify-gates"                          node scripts/verify/verify-gates.mjs
echo "=== this lane's own gate, and its two controls ==="
run "assert-hero-switch"                    node scripts/verify/assert-hero-switch.mjs
run "assert-hero-switch --mutate=noevent"   node scripts/verify/assert-hero-switch.mjs --mutate=noevent
run "assert-hero-switch --mutate=inkwash"   node scripts/verify/assert-hero-switch.mjs --mutate=inkwash
echo "=== the meta-gate ==="
run "assert-gate-integrity"                 node scripts/verify/assert-gate-integrity.mjs

echo
echo "$pass passed, $fail failed"
exit $(( fail == 0 ? 0 : 1 ))
