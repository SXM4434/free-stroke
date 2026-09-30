#!/usr/bin/env bash
# LANE ② — INFLATE ELBOW: the browser passes still owed, in one batch.
#
# Everything in this file needs real Chrome. It was written during a browser
# hold and is the exact list to fire the moment the hold lifts. Each block says
# what it is expected to SETTLE, so a green run is read rather than assumed.
#
# EVERY pass goes through `_run-clean.mjs`. Reason, measured 2026-07-31: two
# `geometry-baseline --save` runs reported "GEOMETRY DIED" on six of thirty-two
# cases while `exportBytes` stayed byte-identical to the previous baseline on
# five of them — geometry that has died does not export the same bytes. A
# sibling lane had saved `components/viewport-3d.tsx` at 11:52:14 and
# `lib/hero-motion.ts` at 11:53:05, inside the run window, and Next's
# fast-refresh remounted the 3-D scene mid-capture. Both runs were DISCARDED,
# not adjusted. The wrapper stamps the mtimes of every file this lane does not
# own before and after, and exits 3 if any moved. **An exit-3 run is discarded
# and repeated, never reported.**
#
# Requires the dev server up: pnpm dev  (http://localhost:3000)
set -u
cd "$(dirname "$0")/../.." || exit 1
RC="node scripts/verify/_run-clean.mjs"
FAILED=0
run() { echo; echo "=== $* ==="; $RC "$@" || FAILED=$((FAILED+1)); }

# ---------------------------------------------------------------------------
# STATUS 2026-07-31 — everything below has RUN CLEAN except block 5.
#
#   verify-gates.mjs .................. ALL GATES PASS, 0 console errors   [clean]
#   geometry-baseline --save=elbow_seam_after + compare vs rim_final:
#       "No hard regressions (nothing died)". Rod / Extrude / Solid
#       byte-identical on all 8 shapes. Only the expected rows moved:
#       closedO/rod export bytes -17% (the closed loop no longer emits two cap
#       spheres), closedO/inflate -2% (wrapped, no caps, no seam taper),
#       zigzag/inflate +110% and scribble/inflate +54% (both fold, so `auto`
#       routes them to the field).                                        [clean]
#   assert-mode-rims --label=seam_after . ALL PASS. Confirms through the REAL UI
#       what the Node path measured: square/inflate rho_out 0.992 / 1.0298 /
#       1.0338 / 1.023 — the seam corner was 0.360.                       [clean]
#   assert-fold-census --label=final .... ALL PASS                        [clean]
#   assert-inflate-fusion ............... ALL PASS 24/24 (was 21/23; the two
#       failures were pre-existing and are corrected in the file, see D2b) [clean]
#   assert-implicit-reveal .............. ALL PASS, negative control fires [clean]
#   assert-draft-taper .................. ALL PASS                        [clean]
#   assert-taper-envelope ............... exit 0                          [clean]
#   assert-joint-beading --holdsteady=rimfinal,seam_after ... PASS, Rod's beads
#       unchanged: word 2->2, zigzag 7->7, loopyS 0->0, openC 0->0        [clean]
#   assert-seam.mjs / assert-elbow calibration ... no browser at all — the real
#       engines run in plain Node through scripts/verify/lib/engine-node.mjs.
#
# Two runs were DISCARDED for contamination (`_run-clean.mjs` exit 3) and
# repeated, never adjusted.
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# 5 · STILL OWED — FRAMES + VIDEO. The one deliverable with no substitute.
#     SETTLES: what the elbow and the seam LOOK like. 24 stills exist for the
#     elbow (docs/verification/elbow/run3/frames) and were looked at: on the
#     loft the elbow is a faceted wedge with a black seam across it and a sliver
#     of the second shell in the specular; on the routed surface it is one
#     continuous rolled knee. MISSING:
#       (a) the VIDEO — a fold is a motion defect as much as a still one (the
#           second sheet swims through the first as the camera moves), and
#           `--orbit` does not exist in verify-elbow.mjs yet;
#       (b) frames of the CLOSED-LOOP SEAM before/after, on `circle`, in both
#           `loopEnds` settings — the taper-vs-no-taper look is the one call
#           only Sebs's eye can make, and no number in assert-seam.mjs settles
#           it.
# ---------------------------------------------------------------------------
RC="node scripts/verify/_run-clean.mjs"
cd "$(dirname "$0")/../.." || exit 1
$RC scripts/verify/verify-elbow.mjs --label=seam_after --cases=loft,auto
