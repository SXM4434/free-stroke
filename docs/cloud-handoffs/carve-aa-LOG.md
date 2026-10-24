# CARVE-AA lane log, 2026-09-30

DONE on `cloud/carve-aa`. The carve ramp is now sized by the length of `sd`'s screen gradient instead of `fwidth(sd)`. `assert-carve-graze` is 12 of 12 here (the snapshot was 11 of 12), f224 reads -0.13 % against the 1.4 % bar, and the letter motion is untouched.

## The cause

The brief read the f224 red as the carve band being weak at 34.6 degrees. It is not the `s`. The letter model has the `s` (letter 2) at flat 1 up to f221 and flat 0 from the flip apex, f222, on:

    f219  yaw 14.6  flat 1        f222  yaw 90.0  flat 0
    f220  yaw 34.6  flat 1        f223  yaw 67.6  flat 0
    f221  yaw 67.6  flat 1        f224  yaw 34.6  flat 0
    letters 3 to 10: yaw 0, flat 1, the same pose on every frame f218 to f226

`fsPenCarveAmount()` multiplies by `vFsLetterFlat`, so at f224 the `s`'s carve is off and neither divisor is evaluated on it. The only carved letters in that frame are the head-on flat ones. The red was the head-on `k`'s carved edge beside the solid `s`: the speckle statistic closes the ink mask by 3 px, and the two divisors antialias the `k`'s edge slightly differently, which opens or closes a few paper pixels in the gap between the letters (about 15 px on this GPU, located by diffing hole maps). The one graded frame where the `s` IS carved at 34.6 degrees, f220, passed on the Mac and here.

Why `fwidth` lost there: `fwidth(sd)` is `|dFdx sd| + |dFdy sd|`, the L1 size of the gradient, up to 1.41 times the true one-pixel width on an edge running diagonally on screen. A wider ramp is more fractional alpha, and `alphaToCoverage` turns fractional alpha into a sample mask.

Proof that a band-limited fix could not work: a temporary hook (reverted, never committed) applied the gradient length only where the letter faces 18 to 45 degrees. It changed f220 by 95 px and f224 by 0 px.

## The change

- `components/viewport-3d.tsx` (5f9ac3a): the carve's shipped divisor is `length(vec2(dFdx(fsSd), dFdy(fsSd)))`. `sd` over it is the signed distance to the edge in pixels. It is never wider than `fwidth`, so nothing `fwidth` closed at grazing reopens. Head-on it lands much nearer the older prior than `fwidth` did: the arms differ by 309 to 425 px at dsf 2, against 1793 to 1960 px under `fwidth`. The prior is still reachable with `__captureHarness.setCarveAA(false)`, and `PEN_CARVE_AA_FWIDTH` keeps its name (1 still means "the derivative of `sd` itself"). The comment block records the finding.
- `scripts/verify/assert-carve-graze.mjs`, `_probe-carve-graze.mjs` (6e5a166): labels only. They named `fwidth(sd)` as the shipped divisor. The gate header now records that f222 to f224 grade the head-on flat letters. No bar, sample, statistic or must-fail changed. The JSON key `fwidth` is kept for older evidence.

How much the look moved: `assert-letters` films 311 frames of the cascade. Snapshot against change, same machine: 112 frames byte-identical, a mean of 239 px per frame differing by more than one 8-bit step (max 746, of about 5.1 M), 1934 px in total differing by more than 64 steps, largest channel delta 76. Those are edge antialiasing pixels on the carved flat letters. At 5x zoom on the frame that moved most (f184) I could not see a difference.

## Checks

All on this container (headless Chromium, ANGLE on SwiftShader), own dev server on :3139, snapshot and change measured the same way.

- tsc: 6 errors, baseline 6.
- `assert-carve-graze`: 12 of 12 on the change; 11 of 12 on the snapshot (KNOWN-BAD A red, as on the Mac). Every row that passed still passes; KNOWN-BAD A now passes too (the reversed claim fails on 2 of 6 frames).

      t      prior  snapshot fwidth   change |grad sd|
      7.300   788    781 (-0.89 %)     770 (-2.28 %)
      7.333   834    841 (+0.84 %)     832 (-0.24 %)
      7.367   706    703 (-0.42 %)     696 (-1.42 %)
      7.400   752    749 (-0.40 %)     742 (-1.33 %)
      7.433   731    728 (-0.41 %)     721 (-1.37 %)
      7.467   764    770 (+0.79 %)     763 (-0.13 %)   f224
      band   4575   4572 (-0.07 %)    4524 (-1.11 %)

- `assert-letters`: 12 of 12 on the snapshot, 12 of 12 on the change, the same rows.
- `assert-hero-options`: 40 of 41 on the snapshot and on the change, the same rows; the one red is main's old "solid first opens on the object and ends on the drawing", unchanged, as the RUN-QUEUE row records.

## What I could not run

- The Mac. This GPU never reproduced the red: f224 was +0.79 % here on the snapshot, +2.17 % on the Mac. The mechanism does not depend on the GPU (the `s` is solid at f224 in the model), and the change moved f224 in the right direction here, but f224 clearing 1.4 % on the Mac is not measured. Run `assert-carve-graze` there first.
- Other gates that film flat carved letters at pixel level (`assert-pentip-specks`, `assert-pen-field`, `assert-stroke-timing-browser --grade-solid` and its `base-*.json`) were not run. Edge pixels of flat letters moved, so any baseline recorded as exact pixels there may need a re-record.
- The pen tip has the same `fwidth` divisor (`PEN_TIP_AA_FWIDTH`). Left alone: it was not in scope.

## Setup notes

- `pnpm install --frozen-lockfile` fails on the snapshot: `package.json` lists `dialkit@^1.4.3` and `motion@^12.43.0`, which `pnpm-lock.yaml` lacks. Installed with `--no-frozen-lockfile`, lockfile not committed. Main needs the matching lockfile.
- The launcher pins `channel: "chrome"`; I linked `/opt/google/chrome/chrome` to the preinstalled Playwright Chromium 1194, container only.
- Gate output under `docs/verification/` is excluded in `.git/info/exclude` (local only) and never committed. Dev server killed by pid after a cwd check, `.next/` deleted.
