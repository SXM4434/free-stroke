NODE AND BROWSER VERIFIED (2026-10-23)

Plan
1. Trace the two draw-in doors, the Field wrapper, KeySpot, and the envelope provider. Commit this plan.
2. Make the three extras draw diamonds in the standalone Draw-in panel and retain the Style panel wiring. Commit the product change.
3. Add a Node render row for the three extra diamonds and a source mutation that removes the wiring and makes that row fail. Commit the gate change.
4. Run tsc and the four requested Node gates. Record each N of M, the must-fail result, browser handoff, and limits. Commit the final log.

Browser handoff for a Claude lane: assert-key-buttons B1 should stay 36 of 36; the Draw-in panel should show three diamonds for Tip highlight, Pen pressure, and Duration. This Codex job runs no browser.

Check on 38ad409fc in /private/tmp/free-stroke-integration-4cbc8d5f:
- `node scripts/verify/assert-extra-keys-node.mjs`: 9 of 9 rows pass, including DIAMONDS 3 of 3; 9 of 9 mutants caught.
- `node scripts/verify/assert-drawin-extras-node.mjs`: 26 of 26 rows pass; 40 of 40 mutants caught.
- `node scripts/verify/assert-key-paths.mjs`: 7 of 7 rows pass; exit 0 with the must-fails caught.
- `node scripts/verify/assert-style-contracts.mjs`: 44 of 44 assertions pass.
- `./node_modules/.bin/tsc --noEmit --pretty false`: six known baseline errors, five in lib/geometry-engines.ts and one missing perfect-freehand in lib/dd-engine/handFeel.ts. Sparse checkout first omitted hooks/ and gave six extra errors; after adding hooks/, the count returned to six.

The first `npm ci` failed with EPERM in the shared npm cache. The same install passed with a task-owned cache at /private/tmp/free-stroke-npm-cache-4cbc8d5f.

Browser check on 2026-10-23 with a reserved shared browser and an isolated
development server on :3138:
- At 1512x982 and 1280x800, Duration, Pen pressure and Tip highlight each have
  a 24x24 enabled diamond in Draw-in. The lower two begin below the visible
  panel, but scrolling reaches them. Tip highlight's centre is hit-testable
  after scrolling and a click writes one key at 5832 ms. Screenshots were
  opened at both sizes before and after scrolling.
- `assert-key-buttons.mjs` first reported 11 PASS, 1 FAIL: Layers showed
  `stackAnimationSpeed` twice because Speed and Direction wrapped the same
  state field separately. They now share one Field. After a fresh server start,
  the gate reports 12 PASS, 0 FAIL, with 36/36 enabled paths, eight disabled
  buttons explained, no duplicate, and all must-fail arms firing.
- The Layers panel at both sizes shows one Speed diamond beside its label,
  with Direction directly below. The button's centre is hit-testable. The
  probe counted one field wrapper and one button at each size.
- `tsc --noEmit` still reports exactly the six baseline errors above.

The fold into integrate/cloud-1001 remains open. The browser probes are
temporary and were not added to the product commit.
