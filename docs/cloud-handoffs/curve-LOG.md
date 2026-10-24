# LOG-CURVE: assert-drawin-curve 12 of 13 on the integration branch

The gate's row 5 clicks `[data-selected]` nth(5), stroke-bar-5 in the stroke strip, and the click
times out after 30000 ms. Main reads 18 of 18.

## Plan
1. Run the probe from the previous lane: bar 5's rect, elementFromPoint at its centre, the click log.
2. Name the cause: covered, below the fold in a scroll box, disabled, or zero-size.
3. Product cause: fix in the strip, add a browser row (every bar takes a real click at its centre) with a must-fail.
   Stale locator: fix the gate, keep the row's claim.
4. Gates: assert-drawin-curve (13 of 13 expected), assert-stroke-strip, assert-strip-recorded, assert-strip-keyed. tsc stays at 6.

Server: own `next dev -p 3146` from this clone, pid written here, proof string checked before each run.

## Cause: a stale gate, not the product
The probe at 1512x982: bar 5's rect is at y 990 to 998 with an 8 px height in a 982 px viewport, and
elementFromPoint at its centre returns null. Playwright logs `data-fs-dock-box intercepts pointer events`,
then `element is outside of the viewport`. Snapshots of every dock panel at each gate stage show the
Timeline panel at top 982 and **0 px tall from the first frame after load**, before any Custom editor
opens. The strip moved into the dock's Timeline tab at L3, and the dock opens folded to its header by
ruling (`components/dock-shell.tsx:38`). A person opens the dock first. The gate never did, so it tried
to click a bar under the fold. Main has no dock, which is why main reads green.

Seen on the way, not this item: after row 3's `scrollIntoViewIfNeeded`, the overflow-hidden dock box
(`dock-shell.tsx:1356`) holds scrollTop 87, because the shell is 1868 px tall with the hidden Draw-in and
Export panels parked below. Every panel shifts up 87 px. Only a programmatic scroll reaches it; a mouse
does not.

## Fix
`scripts/verify/assert-drawin-curve.mjs` row 5 calls `openDock(page)` (the strip visible and hit at its
centre) before the real click on bar 5. The row's claim is unchanged. Commit 92409f459.

## Gates, own server :3146 behind the nullfit proof
- assert-drawin-curve: 18 of 18 (was 12 pass, 1 fail, the gate dying at row 5); 8 must-fail arms fire. Main reads 18 of 18.
- assert-stroke-strip: 18 of 18. First run read 17 of 18 because `docs/verification/stroke-strip/base-3a211a36d.json` was missing from the working tree; it is tracked in HEAD, restored, byte-equal to HEAD.
- assert-strip-recorded: 6 of 6, its mutant reads red as expected.
- assert-strip-keyed: 4 of 4.
- tsc: 6 errors, unchanged.

Server pid 30587 (child 30598, postcss 30696 and 30704), all stopped by pid. `.next` deleted, docs/verification checked out, probe copy removed.
